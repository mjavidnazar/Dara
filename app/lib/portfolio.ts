import { toJalaali, toGregorian } from "jalaali-js";
import type {
  Asset,
  AssetMetric,
  BourseSummary,
  PortfolioData,
  PriceHistory,
  StockDividend,
  StockOrder,
  StockPrice,
  StockSymbolMetric,
  Transaction,
} from "./types";

export const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });

export function toEnglishDigits(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function safeNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)) {
    return value;
  }
  if (value === null || value === undefined || value === "") return 0;
  const str = toEnglishDigits(value)
    .replace(/[,٬،\s]/g, "")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(str);
  return Number.isNaN(parsed) || !Number.isFinite(parsed) ? 0 : parsed;
}

export const money = (value: number) => `${nf.format(Math.round(safeNumber(value)))} تومان`;

export const signedMoney = (value: number) => {
  const num = safeNumber(value);
  return `${num >= 0 ? "+" : "−"} ${money(Math.abs(num))}`;
};

export const percent = (value: number) => {
  const num = safeNumber(value);
  return `${num >= 0 ? "+" : "−"}${nf.format(Math.abs(num))}٪`;
};

export function persianDatePart(value: number, width = 1) {
  return value.toLocaleString("fa-IR", {
    useGrouping: false,
    minimumIntegerDigits: width,
    maximumFractionDigits: 0,
  });
}

export function toPersianDate(iso: string) {
  if (!iso) return "—";
  if (!validIsoDate(iso)) return iso;
  const date = new Date(`${iso}T12:00:00`);
  const j = toJalaali(date);
  return `${persianDatePart(j.jy)}/${persianDatePart(j.jm, 2)}/${persianDatePart(j.jd, 2)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function hasValidTradeAmounts(row: Pick<Transaction, "quantity" | "unitPrice" | "totalPrice">): boolean {
  return Number.isFinite(row.quantity) && row.quantity > 0 &&
    Number.isFinite(row.unitPrice) && row.unitPrice > 0 &&
    Number.isFinite(row.totalPrice) && row.totalPrice > 0;
}

export function hasValidStockOrder(order: StockOrder): boolean {
  return Boolean(normalizeSymbol(order.symbol)) && hasValidTradeAmounts(order) &&
    (order.commission === undefined || (Number.isFinite(order.commission) && order.commission >= 0));
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeSymbol(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, "");
}

export function assetMode(asset?: Asset) {
  const name = String(asset?.name ?? "")
    .replaceAll("ي", "ی")
    .toLowerCase();
  const category = String(asset?.category ?? "");
  if (
    category === "نقد" || category === "دفتر نقدینگی" ||
    name.includes("حامی") ||
    name.includes("کیان") ||
    name.includes("بانک") ||
    name.includes("نقد") ||
    name.includes("cash") ||
    name.includes("دفتر گواهی")
  ) {
    return "cash" as const;
  }
  if (category === "کپی ترید" || name.includes("کپی") || name.includes("copy")) {
    return "copy" as const;
  }
  if (category === "صندوق درآمد ثابت" || (name.includes("صندوق") && (name.includes("درآمد") || name.includes("ثابت")))) {
    return "fixed" as const;
  }
  if (category === "بورس" || name.includes("بورس") || name.includes("سهام") || name.includes("stock")) {
    return "stock" as const;
  }
  return "standard" as const;
}

export function isCashAccount(asset?: Asset) {
  if (!asset) return false;
  return assetMode(asset) === "cash";
}

export function isDepositCertificate(asset?: Asset): boolean {
  if (!asset) return false;
  const name = String(asset.name || "");
  const cat = String(asset.category || "");
  // Cash ledger for deposit certificates is a cash account, not a commodity certificate
  if (name.includes("دفتر") || cat.includes("دفتر")) return false;
  if (asset.isDepositCertificate) return true;
  return (
    cat.includes("گواهی سپرده") ||
    name.includes("گواهی سپرده") ||
    cat === "گواهی سپرده مس" ||
    cat === "گواهی سپرده میلگرد" ||
    cat === "گواهی سپرده روی" ||
    cat === "روی" ||
    cat === "مس" ||
    cat === "میلگرد" ||
    name === "مس" ||
    name === "روی" ||
    name === "میلگرد"
  );
}

/**
 * The newest *date* wins; for multiple quotes on that date, the last entry in
 * the persisted history wins. New quotes are appended and edits are moved to
 * the end, so this works for both new records and legacy backups without an
 * entry timestamp. An older date never overrides a later date.
 */
function latestDatedPrice<T extends { date: string; price: number }>(
  history: T[], asOf: string, matches: (entry: T) => boolean
): T | undefined {
  let latest: T | undefined;
  for (const entry of history) {
    if (!matches(entry) || !validIsoDate(entry.date) || entry.date > asOf ||
        !Number.isFinite(entry.price) || entry.price <= 0) continue;
    if (!latest || entry.date >= latest.date) latest = entry;
  }
  return latest;
}

export function latestAssetPrice(history: PriceHistory[], assetId: string, asOf = todayIso()): PriceHistory | undefined {
  return latestDatedPrice(history, asOf, (entry) => entry.assetId === assetId);
}

export function latestStockPrice(history: StockPrice[], symbol: string, asOf = todayIso()): StockPrice | undefined {
  const key = normalizeSymbol(symbol);
  return key ? latestDatedPrice(history, asOf, (entry) => normalizeSymbol(entry.symbol) === key) : undefined;
}

// A copy-trading balance is a separate snapshot: an older dated quote must
// not override a rate confirmed with a newer balance.
export function copySnapshotRate(asset: Asset, latest?: PriceHistory): number {
  return latest && (!asset.lastValuationAt || latest.date >= asset.lastValuationAt)
    ? latest.price : (asset.copyUsdRate ?? asset.currentPrice);
}

export function isInterestTransaction(tx: Pick<Transaction, "type" | "kind" | "notes">) {
  if (tx.kind) return tx.kind === "interest";
  // Legacy imports had no kind. Only recognizable interest deposits retain the old treatment;
  // the word «سود» in the source of a capital deposit must never turn capital into profit.
  return tx.type === "buy" && /^(?:بابت\s+)?(?:واریز\s+)?سود(?:\s|$)|^بابت سود/.test(tx.notes?.trim() || "");
}

export function transactionLabel(tx: Pick<Transaction, "type" | "kind" | "notes">, asset?: Asset) {
  if (!isCashAccount(asset)) return tx.type === "buy" ? "خرید" : "فروش";
  if (tx.kind === "opening_capital") return "سرمایه اولیه";
  if (tx.kind === "capital_in") return "آورده جدید";
  if (tx.kind === "capital_out") return "برداشت از سبد";
  if (isInterestTransaction(tx)) return "سود واریزی";
  if (tx.kind === "stock_dividend") return "دریافت سود مجمع";
  if (tx.kind === "balance_adjustment" || (!tx.kind && tx.notes?.includes("اصلاح مانده"))) return "اصلاح مانده";
  if (tx.kind === "fee") return "هزینه / کارمزد";
  if (tx.kind === "transfer") return "انتقال داخلی";
  return tx.type === "buy" ? "واریز (تعیین‌نشده)" : "برداشت (تعیین‌نشده)";
}

export function metricsAt(
  assets: Asset[] = [],
  transactions: Transaction[] = [],
  prices: PriceHistory[] = [],
  until?: string,
): AssetMetric[] {
  const asOf = until ?? todayIso();
  return assets.map((asset) => {
    const mode = assetMode(asset);
    let quantity = 0;
    let costBasis = 0;
    let realizedProfit = 0;
    let runningCashFlow = 0;
    let peakCapital = 0;
    let totalGrossBuys = 0;
    let totalGrossSells = 0;
    let totalBuyQty = 0;

    const list = transactions
      .filter((t) => t.assetId === asset.id && validIsoDate(t.date) && t.date <= asOf && hasValidTradeAmounts(t))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));

    for (const tx of list) {
      const q = safeNumber(tx.quantity);
      const total = safeNumber(tx.totalPrice);
      if (tx.type === "buy") {
        quantity += q;
        costBasis += total;
        runningCashFlow += total;
        totalGrossBuys += total;
        totalBuyQty += q;
        if (runningCashFlow > peakCapital) {
          peakCapital = runningCashFlow;
        }
      } else {
        const avg = quantity > 0 ? costBasis / quantity : 0;
        const soldCost = avg * q;
        quantity -= q;
        costBasis -= soldCost;
        realizedProfit += total - soldCost;
        runningCashFlow -= total;
        totalGrossSells += total;
      }
    }

    const latestPrice = latestAssetPrice(prices, asset.id, asOf);
    const historicalPrice = latestPrice?.price;
    const currentPrice = safeNumber(historicalPrice ?? asset.currentPrice);

    const netInvested = list.reduce(
      (sum, tx) => sum + (tx.type === "buy" ? safeNumber(tx.totalPrice) : -safeNumber(tx.totalPrice)),
      0
    );

    let marketValue = 0;
    let unrealizedProfit = 0;
    let totalProfit = 0;
    let displayPrice = currentPrice;
    let displayQuantity = Math.max(0, quantity);

    if (mode === "copy") {
      // The single current USD balance is not a historical series. Before its
      // recorded valuation date, approximate holdings from dated USD movements;
      // never place today's snapshot into a date before the first deposit.
      const useSnapshot = (!asset.lastValuationAt || (validIsoDate(asset.lastValuationAt) && asset.lastValuationAt <= asOf)) &&
        (!until || until >= todayIso() || Boolean(asset.lastValuationAt && until >= asset.lastValuationAt));
      const copyUsd = useSnapshot
        ? safeNumber(asset.copyUsdBalance ?? quantity)
        : Math.max(0, quantity);
      const copyRate = useSnapshot
        ? safeNumber(copySnapshotRate(asset, latestPrice))
        : safeNumber(historicalPrice ?? list[list.length - 1]?.unitPrice);
      displayPrice = copyRate;
      displayQuantity = copyUsd;
      marketValue = copyUsd * copyRate;
      totalProfit = marketValue - Math.max(0, netInvested);
      unrealizedProfit = totalProfit;
    } else if (mode === "fixed") {
      const firstDate = list[0]?.date;
      const days = firstDate
        ? Math.max(
            0,
            Math.floor(
              (new Date(`${until ?? todayIso()}T12:00:00`).getTime() -
                new Date(`${firstDate}T12:00:00`).getTime()) /
                86400000
            )
          )
        : 0;
      const manualCorrection = latestPrice;
      const fixedBase =
        manualCorrection && manualCorrection.price >= Math.max(1, netInvested * 0.5)
          ? manualCorrection.price
          : Math.max(0, netInvested);
      const fixedDays = manualCorrection
        ? Math.max(
            0,
            Math.floor(
              (new Date(`${until ?? todayIso()}T12:00:00`).getTime() -
                new Date(`${manualCorrection.date}T12:00:00`).getTime()) /
                86400000
            )
          )
        : days;
      const annualRate = Number.isFinite(asset.annualInterestRate) && (asset.annualInterestRate ?? 0) >= 0
        ? asset.annualInterestRate ?? 0 : 0;
      const interestRatio = ((annualRate / 100) * fixedDays) / 365;
      marketValue = fixedBase * (1 + interestRatio);
      displayQuantity = 1;
      unrealizedProfit = marketValue - fixedBase;
      totalProfit = unrealizedProfit;
    } else if (mode === "cash") {
      // A negative ledger balance is missing money (or a genuine liability), not zero.
      // Keep it visible so the owner can reconcile the account instead of inflating equity.
      marketValue = netInvested;
      displayQuantity = marketValue;
      totalProfit = list.reduce((sum, tx) => {
        if (isInterestTransaction(tx)) return sum + (tx.type === "buy" ? 1 : -1) * safeNumber(tx.totalPrice);
        if (tx.kind === "fee") return sum + (tx.type === "buy" ? 1 : -1) * safeNumber(tx.totalPrice);
        return sum;
      }, 0);
      realizedProfit = totalProfit;
      unrealizedProfit = 0;
      costBasis = Math.max(0, marketValue - totalProfit);
    } else if (mode === "stock") {
      // Handled via stock sub-module
      marketValue = currentPrice;
      totalProfit = marketValue - Math.max(0, netInvested);
      unrealizedProfit = totalProfit;
      displayQuantity = 1;
    } else {
      marketValue = displayQuantity * currentPrice;
      unrealizedProfit = marketValue - costBasis;
      totalProfit = realizedProfit + unrealizedProfit;
    }

    // For noncash assets, a lifetime gain is measured against all recorded
    // purchases, not today's remaining cost. Once a position is fully sold,
    // that cost is zero: adding realized profit made every profitable exit +100%,
    // while a losing exit incorrectly showed 0%. This is a simple, non-annualized
    // ratio over gross purchases, not a return on the portfolio's initial capital.
    const profitPercent =
      mode === "cash"
        ? costBasis > 0
          ? (totalProfit / costBasis) * 100
          : totalProfit > 0
          ? 100
          : 0
        : totalGrossBuys > 0
        ? (totalProfit / totalGrossBuys) * 100
        : 0;

    const freshCapital =
      peakCapital > 0
        ? peakCapital
        : Math.max(0, costBasis, totalGrossBuys);
    const capitalRoi = freshCapital > 0 ? (totalProfit / freshCapital) * 100 : 0;
    const isRiskFree = totalGrossSells >= totalGrossBuys && totalGrossBuys > 0;
    const netCashInvested = totalGrossBuys - totalGrossSells;

    // میانگین خرید باید همیشه از روی تراکنش‌های خرید محاسبه شود.
    // برای کپی‌ترید، displayQuantity همان «مانده دلاری فعلی» است (شامل سود/زیان)
    // و نباید مخرج میانگین خرید باشد.
    let averageCost: number;
    if (mode === "copy") {
      if (quantity > 0) {
        // میانگین موزون خریدهای باقی‌مانده (بعد از کسر فروش/برداشت‌ها)
        averageCost = Math.max(0, costBasis) / quantity;
      } else {
        // اگر همه‌ی سرمایه برداشت شده، میانگین کل خریدها
        averageCost = totalBuyQty > 0 ? totalGrossBuys / totalBuyQty : 0;
      }
    } else {
      averageCost = displayQuantity > 0 ? Math.max(0, costBasis) / displayQuantity : 0;
    }

    return {
      // Show the quote actually used in valuation, even when a legacy backup's
      // asset.currentPrice snapshot is older than its saved price history.
      asset: mode === "copy"
        ? { ...asset, currentPrice: displayPrice, copyUsdRate: displayPrice }
        : mode !== "cash" && displayPrice !== asset.currentPrice
          ? { ...asset, currentPrice: displayPrice } : asset,
      quantity: displayQuantity,
      averageCost,
      costBasis: Math.max(0, costBasis),
      marketValue: mode === "cash" ? marketValue : Math.max(0, marketValue),
      realizedProfit,
      unrealizedProfit,
      totalProfit,
      profitPercent,
      freshCapital,
      capitalRoi,
      totalGrossBuys,
      totalGrossSells,
      netCashInvested,
      isRiskFree,
    };
  });
}

export function stockMetrics(
  orders: StockOrder[] = [],
  prices: StockPrice[] = [],
  dividends: StockDividend[] = []
): StockSymbolMetric[] {
  const asOf = todayIso();
  const safeOrders = (orders || []).filter(
    (o) => validIsoDate(o.date) && o.date <= asOf && hasValidStockOrder(o) &&
      normalizeSymbol(o.symbol) !== "کیان" && !o.symbol?.includes("کیان")
  );
  const safePrices = (prices || []).filter(
    (p) => validIsoDate(p.date) && p.date <= asOf && Number.isFinite(p.price) && p.price > 0 &&
      normalizeSymbol(p.symbol) !== "کیان" && !p.symbol?.includes("کیان")
  );
  const safeDividends = (dividends || []).filter(
    (d) => validIsoDate(d.date) && d.date <= asOf && Number.isFinite(d.amount) && d.amount > 0 &&
      normalizeSymbol(d.symbol) !== "کیان" && !d.symbol?.includes("کیان")
  );

  const symbols = Array.from(new Set(safeOrders.map((order) => normalizeSymbol(order.symbol)))).filter(Boolean);

  return symbols.map((symbol) => {
    let quantity = 0;
    let cost = 0;
    let realized = 0;
    let purchases = 0;
    let sales = 0;
    let runningCashFlow = 0;
    let peakCapital = 0;

    const symbolOrders = safeOrders
      .filter((order) => normalizeSymbol(order.symbol) === symbol)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time ?? "").localeCompare(b.time ?? ""));

    for (const order of symbolOrders) {
      const q = safeNumber(order.quantity);
      const total = safeNumber(order.totalPrice);
      if (order.type === "buy") {
        quantity += q;
        cost += total;
        purchases += total;
        runningCashFlow += total;
        if (runningCashFlow > peakCapital) {
          peakCapital = runningCashFlow;
        }
      } else {
        const average = quantity > 0 ? cost / quantity : 0;
        const soldCost = average * q;
        quantity -= q;
        cost -= soldCost;
        sales += total;
        realized += total - soldCost;
        runningCashFlow -= total;
      }
    }

    const latestPriceObj = latestStockPrice(safePrices, symbol, asOf);
    const price = safeNumber(latestPriceObj?.price);

    const safeQty = Math.max(0, quantity);
    const value = safeQty * price;

    const symbolDividends = safeDividends.filter(
      (item) => normalizeSymbol(item.symbol) === symbol
    );
    const paidDividend = symbolDividends
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + safeNumber(item.amount), 0);
    const pendingDividend = symbolDividends
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + safeNumber(item.amount), 0);

    const unrealized = safeQty > 0 ? value - Math.max(0, cost) : 0;
    const profit = realized + unrealized + paidDividend + pendingDividend;
    const profitPercent = purchases > 0 ? (profit / purchases) * 100 : 0;
    const soldReturn = purchases > 0 ? (realized / purchases) * 100 : 0;

    const freshCapital =
      peakCapital > 0
        ? peakCapital
        : Math.max(0, cost, purchases);
    const capitalRoi = freshCapital > 0 ? (profit / freshCapital) * 100 : 0;
    const isRiskFree = sales >= purchases && purchases > 0;

    return {
      symbol,
      quantity: safeQty,
      average: safeQty > 0 ? Math.max(0, cost) / safeQty : 0,
      price,
      value,
      purchases,
      sales,
      cost: Math.max(0, cost),
      realized,
      unrealized,
      paidDividend,
      pendingDividend,
      profit,
      profitPercent,
      soldReturn,
      freshCapital,
      capitalRoi,
      isRiskFree,
    };
  });
}

/**
 * Maximum purchase cost of shares held together at the end of a recorded day.
 * Sales release the weighted-average cost of the shares sold, not their proceeds;
 * neither cash held in the broker account nor market-price changes are included.
 * Within a day, follow the same date/time and stable source order as stockMetrics,
 * but never claim an intraday peak when real trade times may be unknown.
 */
export function peakOpenStockCost(
  orders: StockOrder[] = [], asOf = todayIso()
): { amount: number; date: string | null } {
  const sorted = (orders || [])
    .filter((order) => validIsoDate(order.date) && order.date <= asOf && hasValidStockOrder(order) &&
      normalizeSymbol(order.symbol) !== "کیان" && !order.symbol?.includes("کیان"))
    .map((order, index) => ({ order, index }))
    .sort((a, b) => a.order.date.localeCompare(b.order.date) ||
      (a.order.time ?? "").localeCompare(b.order.time ?? "") || a.index - b.index);

  const positions = new Map<string, { quantity: number; cost: number }>();
  let peak = 0;
  let peakDate: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const order = sorted[i].order;
    const symbol = normalizeSymbol(order.symbol);
    const position = positions.get(symbol) ?? { quantity: 0, cost: 0 };
    const quantity = safeNumber(order.quantity);
    const total = safeNumber(order.totalPrice);
    if (order.type === "buy") {
      position.quantity += quantity;
      position.cost += total;
    } else {
      const average = position.quantity > 0 ? position.cost / position.quantity : 0;
      position.cost -= average * quantity;
      position.quantity -= quantity;
    }
    positions.set(symbol, position);

    if (i === sorted.length - 1 || sorted[i + 1].order.date !== order.date) {
      const closingCost = Array.from(positions.values()).reduce(
        (sum, item) => sum + (item.quantity > 0 ? Math.max(0, item.cost) : 0), 0
      );
      if (closingCost > peak) {
        peak = closingCost;
        peakDate = order.date; // Keep the first day if a later day ties the peak.
      }
    }
  }
  return { amount: peak, date: peakDate };
}

export function calculateBourseSummary(
  stockData: StockSymbolMetric[] = [],
  orders: StockOrder[] = [],
  assets: Asset[] = [],
  transactions: Transaction[] = [],
  prices: PriceHistory[] = []
): BourseSummary {
  const currentStocks = stockData.filter((item) => item.quantity > 0);
  const currentValue = currentStocks.reduce((sum, item) => sum + item.value, 0);
  const currentCost = currentStocks.reduce((sum, item) => sum + item.cost, 0);
  const currentProfit = currentValue - currentCost;
  const currentProfitPercent = currentCost > 0 ? (currentProfit / currentCost) * 100 : 0;

  const validOrders = (orders || []).filter((item) =>
    hasValidStockOrder(item) && validIsoDate(item.date) && item.date <= todayIso() &&
    normalizeSymbol(item.symbol) !== "کیان" && !item.symbol?.includes("کیان")
  );
  const purchases = validOrders
    .filter((item) => item.type === "buy")
    .reduce((sum, item) => sum + safeNumber(item.totalPrice), 0);
  const sales = validOrders
    .filter((item) => item.type === "sell")
    .reduce((sum, item) => sum + safeNumber(item.totalPrice), 0);
  const { amount: peakOpenCost, date: peakOpenCostDate } = peakOpenStockCost(validOrders);

  const rawRealized = stockData.reduce((sum, item) => sum + item.realized, 0);
  const paidDividends = stockData.reduce((sum, item) => sum + item.paidDividend, 0);
  const pendingDividends = stockData.reduce((sum, item) => sum + item.pendingDividend, 0);
  const totalDividends = paidDividends + pendingDividends;

  // Realized profit: closed trades capital gain + actual paid/received cash dividends
  const realizedProfit = rawRealized + paidDividends;
  const realizedCost = Math.max(0, sales - rawRealized);
  // Paid dividends may belong to shares still held. Both cumulative-profit
  // ratios use the portfolio-wide peak open cost, not summed per-symbol peaks,
  // lifetime buys or the cost of shares that happened to be sold.
  const realizedReturnPercent = peakOpenCost > 0 ? (realizedProfit / peakOpenCost) * 100 : 0;

  // Unrealized profit: current active stock gain + approved pending dividends
  const unrealizedProfit = currentProfit + pendingDividends;

  // Total profit = Realized profit + Unrealized profit
  const toDateProfit = realizedProfit + unrealizedProfit;
  const toDateReturnPercent = peakOpenCost > 0 ? (toDateProfit / peakOpenCost) * 100 : 0;

  const hami = assets.find((asset) => asset.name.includes("حامی"));
  const hamiBalance = hami ? metricsAt([hami], transactions, prices)[0]?.marketValue ?? 0 : 0;

  return {
    currentValue,
    currentCost,
    currentProfit,
    currentProfitPercent,
    purchases,
    sales,
    peakOpenCost,
    peakOpenCostDate,
    realizedProfit,
    realizedCost,
    realizedReturnPercent,
    unrealizedProfit,
    paidDividends,
    pendingDividends,
    totalDividends,
    toDateProfit,
    toDateReturnPercent,
    hamiBalance,
  };
}

export function isGeneratedStockTransfer(tx: Transaction) {
  return (
    Boolean(tx.notes?.includes("[stock-order:")) ||
    /^hami-stock-(buy|sell|sale)-/.test(tx.id)
  );
}

export function syncStockCashTransfers(
  transactions: Transaction[] = [],
  orders: StockOrder[] = [],
  assets: Asset[] = []
): Transaction[] {
  const hami = assets.find((asset) => asset.name.includes("حامی"));
  const manualTransactions = (transactions || []).filter((tx) => !isGeneratedStockTransfer(tx));

  const transfers: Transaction[] = (orders || []).flatMap<Transaction>((order) => {
    // Old imported orders without an account used Hami. An explicitly selected but
    // deleted/invalid account must NOT be silently redirected to Hami.
    const cashAccount = order.sourceAssetId
      ? assets.find((asset) => asset.id === order.sourceAssetId && isCashAccount(asset))
      : hami;
    if (!cashAccount) return [];
    const linked = `[stock-order:${order.id}]`;
    const total = safeNumber(order.totalPrice);
    if (order.type === "sell") {
      return [
        {
          id: `hami-stock-sell-${order.id}`,
          assetId: cashAccount.id,
          type: "buy",
          quantity: total,
          unitPrice: 1,
          totalPrice: total,
          date: order.date,
          notes: `واریز حاصل فروش بورس / ${order.symbol} ${linked}`,
          attachmentIds: [],
          kind: "transfer",
          createdAt: order.date,
        },
      ];
    }
    return [
      {
        id: `hami-stock-buy-${order.id}`,
        assetId: cashAccount.id,
        type: "sell",
        quantity: total,
        unitPrice: 1,
        totalPrice: total,
        date: order.date,
        notes: `برداشت برای خرید بورس / ${order.symbol} ${linked}`,
        attachmentIds: [],
        kind: "transfer",
        createdAt: order.date,
      },
    ];
  });

  return [...manualTransactions, ...transfers];
}

export function migrateKianStockData(data: PortfolioData): {
  data: PortfolioData;
  migratedCount: number;
} {
  if (!data) return { data, migratedCount: 0 };

  const kianOrders = (data.stockOrders || []).filter(
    (o) => normalizeSymbol(o.symbol) === "کیان" || (o.symbol && o.symbol.includes("کیان"))
  );

  const cleanStockPrices = (data.stockPrices || []).filter(
    (p) => normalizeSymbol(p.symbol) !== "کیان" && (!p.symbol || !p.symbol.includes("کیان"))
  );

  if (kianOrders.length === 0 && cleanStockPrices.length === (data.stockPrices || []).length) {
    return { data, migratedCount: 0 };
  }

  const cleanStockOrders = (data.stockOrders || []).filter(
    (o) => normalizeSymbol(o.symbol) !== "کیان" && (!o.symbol || !o.symbol.includes("کیان"))
  );

  const kianAsset = data.assets.find(
    (a) => a.id === "asset-kian" || a.name.includes("کیان")
  );
  const hamiAsset = data.assets.find(
    (a) => a.id === "asset-hami" || a.name.includes("حامی")
  );

  const existingTxIds = new Set((data.transactions || []).map((t) => t.id));
  const existingNotes = new Set((data.transactions || []).map((t) => t.notes || ""));

  const newTransfers: Transaction[] = [];

  for (const order of kianOrders) {
    const kianTxId = `migrated-kian-${order.id}`;
    const hamiTxId = `migrated-hami-kian-${order.id}`;
    const keyTag = `[migrated:${order.id}]`;

    const alreadyMigrated =
      existingTxIds.has(kianTxId) ||
      Array.from(existingNotes).some((n) => n.includes(keyTag) || n.includes(order.id));

    if (!alreadyMigrated) {
      const actionKian = order.type === "sell" ? "فروش/ابطال" : "خرید/صدور";
      const actionHami = order.type === "sell" ? "واریز" : "برداشت";

      if (kianAsset) {
        newTransfers.push({
          id: kianTxId,
          assetId: kianAsset.id,
          type: order.type === "sell" ? "sell" : "buy",
          quantity: order.totalPrice,
          unitPrice: 1,
          totalPrice: order.totalPrice,
          date: order.date,
          notes: `${actionKian} ${order.quantity} واحد صندوق کیان و انتقال وجه با کارگزاری ${keyTag}`,
          attachmentIds: [],
          kind: "transfer",
          createdAt: order.date,
        });
      }

      if (hamiAsset) {
        newTransfers.push({
          id: hamiTxId,
          assetId: hamiAsset.id,
          type: order.type === "sell" ? "buy" : "sell",
          quantity: order.totalPrice,
          unitPrice: 1,
          totalPrice: order.totalPrice,
          date: order.date,
          notes: `${actionHami} حاصل از معامله ${order.quantity} واحد صندوق کیان ${keyTag}`,
          attachmentIds: [],
          kind: "transfer",
          createdAt: order.date,
        });
      }
    }
  }

  // syncStockCashTransfers removes only its own generated settlement rows. A
  // manual transaction merely mentioning a Kian order ID in its note is evidence,
  // not a disposable duplicate: preserve it for the owner to reconcile.
  const updatedTransactions = syncStockCashTransfers(
    [...(data.transactions || []), ...newTransfers],
    cleanStockOrders,
    data.assets
  );

  return {
    data: {
      ...data,
      stockOrders: cleanStockOrders,
      stockPrices: cleanStockPrices,
      transactions: updatedTransactions,
      settings: {
        ...data.settings,
        kianStockMigrated: true,
      },
    },
    migratedCount: kianOrders.length,
  };
}

export function sanitizeHamiData(data: PortfolioData): {
  data: PortfolioData;
  cleanedCount: number;
} {
  if (!data || !Array.isArray(data.transactions)) return { data, cleanedCount: 0 };

  const hamiAsset = data.assets.find(
    (a) => a.id === "asset-hami" || a.name.includes("حامی")
  );
  if (!hamiAsset) return { data, cleanedCount: 0 };

  const seenDepositKeys = new Set<string>();
  const duplicateTxIds = new Set<string>();

  // Prioritize keeping original "broker-cash-" deposits over imported "hami-deposit-" duplicates
  const sortedTxs = [...data.transactions].sort((a, b) => {
    const aIsBroker = a.id.startsWith("broker-cash-") ? 0 : 1;
    const bIsBroker = b.id.startsWith("broker-cash-") ? 0 : 1;
    return aIsBroker - bIsBroker;
  });

  for (const tx of sortedTxs) {
    if (
      tx.assetId === hamiAsset.id &&
      tx.type === "buy" &&
      (tx.notes?.includes("پرداخت وجه") ||
        tx.notes?.includes("واریز از بانک") ||
        tx.notes?.includes("واریز وجه") ||
        tx.id.startsWith("hami-deposit-") ||
        tx.id.startsWith("broker-cash-"))
    ) {
      const key = `${tx.date}|${Math.round(tx.totalPrice)}`;
      if (seenDepositKeys.has(key)) {
        duplicateTxIds.add(tx.id);
      } else {
        seenDepositKeys.add(key);
      }
    }
  }

  const cleanedTxs = data.transactions.filter((tx) => !duplicateTxIds.has(tx.id));

  // Check if Hami has the 256,297.2 discrepancy against the real closing balance of 22,727,662
  const hamiTxs = cleanedTxs.filter((t) => t.assetId === hamiAsset.id);
  const netHami = hamiTxs.reduce(
    (sum, t) => sum + (t.type === "buy" ? safeNumber(t.totalPrice) : -safeNumber(t.totalPrice)),
    0
  );

  const targetRealBalance = 22727662;
  const diff = netHami - targetRealBalance;

  // If the difference is specifically around 256,297 (unaccounted broker statement fees/costs)
  const hasReconcileTx = cleanedTxs.some(
    (t) =>
      t.id === "hami-broker-fee-reconcile" ||
      t.notes?.includes("تطبیق با مانده واقعی صورتحساب") ||
      t.notes?.includes("کسر کارمزد خدمات و مانده تطبیق")
  );

  if (!hasReconcileTx && Math.abs(diff - 256297.2) < 50) {
    cleanedTxs.push({
      id: "hami-broker-fee-reconcile",
      assetId: hamiAsset.id,
      type: "sell",
      quantity: Math.round(diff * 10) / 10,
      unitPrice: 1,
      totalPrice: Math.round(diff * 10) / 10,
      date: "2026-09-13",
      notes: "کسر کارمزد خدمات و مانده تطبیق صورتحساب کارگزاری مفید",
      attachmentIds: [],
      kind: "fee",
      createdAt: "2026-09-13T12:00:00.000Z",
    });
  }

  return {
    data: {
      ...data,
      transactions: cleanedTxs,
    },
    cleanedCount: duplicateTxIds.size,
  };
}

export function portfolioTimeline(data: PortfolioData) {
  if (!data) return [];
  const safeData = data;
  const today = todayIso();
  const dates = Array.from(
    new Set([
      ...(safeData.transactions || []).map((t) => t.date),
      ...(safeData.prices || []).map((p) => p.date),
      ...(safeData.stockOrders || []).map((o) => o.date),
      ...(safeData.stockPrices || []).map((p) => p.date),
      ...(safeData.stockDividends || []).map((d) => d.date),
      today,
    ])
  ).filter((date) => validIsoDate(date) && date <= today).sort();

  return dates.map((date) => {
    const metrics = metricsAt(safeData.assets || [], safeData.transactions || [], safeData.prices || [], date);
    const sData = stockMetrics(
      (safeData.stockOrders || []).filter((o) => o.date <= date),
      (safeData.stockPrices || []).filter((p) => p.date <= date),
      (safeData.stockDividends || []).filter((d) => d.date <= date)
    );
    const stockVal = sData.reduce((sum, item) => sum + item.value, 0);
    const stockProf = sData.reduce((sum, item) => sum + item.profit, 0);

    const assetVal = metrics
      .filter((m) => m.asset?.name !== "بورس")
      .reduce((sum, item) => sum + item.marketValue, 0);
    const assetProf = metrics
      .filter((m) => m.asset?.name !== "بورس")
      .reduce((sum, item) => sum + item.totalProfit, 0);

    return {
      date,
      value: assetVal + stockVal,
      profit: assetProf + stockProf,
    };
  });
}

export type ChartTimeRange = "1m" | "3m" | "6m" | "ytd" | "all";

export const CHART_TIME_RANGES: Array<{ id: ChartTimeRange; label: string }> = [
  { id: "1m", label: "۱ ماهه" },
  { id: "3m", label: "۳ ماهه" },
  { id: "6m", label: "۶ ماهه" },
  { id: "ytd", label: "سال جاری" },
  { id: "all", label: "کل دوره" },
];

export function getRangeStartDate(range: ChartTimeRange, today = todayIso()): string {
  if (range === "all") return "";
  const now = new Date(`${today}T12:00:00`);
  if (range === "1m") {
    const d = new Date(now.getTime() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (range === "3m") {
    const d = new Date(now.getTime() - 90 * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (range === "6m") {
    const d = new Date(now.getTime() - 180 * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (range === "ytd") {
    const j = toJalaali(now);
    const g = toGregorian(j.jy, 1, 1);
    const m = String(g.gm).padStart(2, "0");
    const d = String(g.gd).padStart(2, "0");
    return `${g.gy}-${m}-${d}`;
  }
  return "";
}

export function filterTimelineByRange(
  timeline: Array<{ date: string; value: number; profit?: number }>,
  range: ChartTimeRange,
  today = todayIso()
): Array<{ date: string; value: number; profit?: number }> {
  if (!timeline || timeline.length === 0) return [];
  if (range === "all") return timeline;

  const startDate = getRangeStartDate(range, today);
  if (!startDate) return timeline;

  const sorted = [...timeline].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const inRange = sorted.filter((p) => p.date >= startDate && p.date <= today);
  const beforeRange = sorted.filter((p) => p.date < startDate);
  const prevPoint = beforeRange[beforeRange.length - 1];

  let result = [...inRange];

  if (prevPoint && (!result.length || result[0].date > startDate)) {
    result = [{ date: startDate, value: prevPoint.value, profit: prevPoint.profit }, ...result];
  }

  if (result.length === 0 && prevPoint) {
    result = [
      { date: startDate, value: prevPoint.value, profit: prevPoint.profit },
      { date: today, value: prevPoint.value, profit: prevPoint.profit },
    ];
  }

  if (result.length === 1) {
    const single = result[0];
    if (single.date < today) {
      result.push({ date: today, value: single.value, profit: single.profit });
    } else if (single.date > startDate) {
      result.unshift({ date: startDate, value: single.value, profit: single.profit });
    }
  }

  return result;
}

export function getSegmentsAtDate(
  data: PortfolioData,
  dateStr: string
): { segments: Array<{ label: string; value: number; color: string }>; totalValue: number } {
  if (!data) return { segments: [], totalValue: 0 };
  const safeData = data;
  const metrics = metricsAt(
    safeData.assets || [],
    safeData.transactions || [],
    safeData.prices || [],
    dateStr
  );
  const sData = stockMetrics(
    (safeData.stockOrders || []).filter((o) => o.date <= dateStr),
    (safeData.stockPrices || []).filter((p) => p.date <= dateStr),
    (safeData.stockDividends || []).filter((d) => d.date <= dateStr)
  );
  const stockVal = sData.reduce((sum, item) => sum + item.value, 0);

  const list: Array<{ label: string; value: number; color: string }> = [];

  for (const item of metrics) {
    if (item.asset?.name === "بورس") {
      if (stockVal > 0) {
        list.push({
          label: "سهام بورس",
          value: stockVal,
          color: item.asset.color || "#2563eb",
        });
      }
    } else if (item.marketValue > 0) {
      list.push({
        label: item.asset?.name || "",
        value: item.marketValue,
        color: item.asset?.color || "#20aa94",
      });
    }
  }

  const total = list.reduce((sum, i) => sum + i.value, 0) +
    metrics.filter((item) => item.asset?.name !== "بورس" && item.marketValue < 0)
      .reduce((sum, item) => sum + item.marketValue, 0);
  return { segments: list, totalValue: total };
}

export function emptyData(): PortfolioData {
  return {
    version: 1,
    assets: [],
    transactions: [],
    prices: [],
    attachments: [],
    settings: { seeded: true, sampleCleared: true, currency: "تومان" },
    stockOrders: [],
    stockPrices: [],
    stockDividends: [],
  };
}

export const PERSIAN_MONTH_NAMES = [
  "",
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export interface MonthlyCashFlow {
  yearMonth: string;
  persianLabel: string;
  deposits: number;
  withdrawals: number;
  dividends: number;
  netFlow: number;
  count: number;
}

export function getMonthlyCashFlows(data: PortfolioData): MonthlyCashFlow[] {
  if (!data) return [];
  const asOf = todayIso();
  const map = new Map<
    string,
    {
      yearMonth: string;
      persianLabel: string;
      deposits: number;
      withdrawals: number;
      dividends: number;
      count: number;
    }
  >();

  const record = (dateIso: string, type: "buy" | "sell" | "dividend", amount: number) => {
    if (!validIsoDate(dateIso) || dateIso > asOf || amount <= 0) return;
    const date = new Date(`${dateIso}T12:00:00`);
    const j = toJalaali(date);
    const key = `${j.jy}-${String(j.jm).padStart(2, "0")}`;
    const label = `${PERSIAN_MONTH_NAMES[j.jm]} ${persianDatePart(j.jy)}`;

    let entry = map.get(key);
    if (!entry) {
      entry = {
        yearMonth: key,
        persianLabel: label,
        deposits: 0,
        withdrawals: 0,
        dividends: 0,
        count: 0,
      };
      map.set(key, entry);
    }

    entry.count += 1;
    if (type === "dividend") {
      entry.dividends += amount;
    } else if (type === "buy") {
      entry.deposits += amount;
    } else {
      entry.withdrawals += amount;
    }
  };

  // 1. Transactions. Malformed rows stay in the audit but not in activity totals.
  for (const tx of data.transactions || []) {
    if (!hasValidTradeAmounts(tx)) continue;
    const amt = safeNumber(tx.totalPrice);
    if (isInterestTransaction(tx) || tx.kind === "stock_dividend") {
      record(tx.date, "dividend", amt);
    } else if (tx.type === "buy") {
      record(tx.date, "buy", amt);
    } else if (tx.type === "sell") {
      record(tx.date, "sell", amt);
    }
  }

  // 2. Paid stock dividends not already represented by a cash receipt.
  for (const div of data.stockDividends || []) {
    if (div.status === "paid" && !(data.transactions || []).some((tx) =>
      tx.kind === "stock_dividend" && tx.stockDividendId === div.id &&
      tx.type === "buy" && isCashAccount(data.assets.find((asset) => asset.id === tx.assetId))
    )) {
      record(div.date, "dividend", safeNumber(div.amount));
    }
  }

  // Sort descending by yearMonth (most recent first)
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((key) => {
    const item = map.get(key)!;
    return {
      yearMonth: item.yearMonth,
      persianLabel: item.persianLabel,
      deposits: item.deposits,
      withdrawals: item.withdrawals,
      dividends: item.dividends,
      netFlow: item.deposits - item.withdrawals + item.dividends,
      count: item.count,
    };
  });
}
