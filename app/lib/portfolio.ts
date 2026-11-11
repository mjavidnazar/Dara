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
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const j = toJalaali(date);
  return `${persianDatePart(j.jy)}/${persianDatePart(j.jm, 2)}/${persianDatePart(j.jd, 2)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  if (
    name.includes("حامی") ||
    name.includes("کیان") ||
    name.includes("بانک") ||
    name.includes("نقد") ||
    name.includes("cash") ||
    name.includes("دفتر گواهی")
  ) {
    return "cash" as const;
  }
  if (name.includes("کپی") || name.includes("copy")) {
    return "copy" as const;
  }
  if (name.includes("صندوق") && (name.includes("درآمد") || name.includes("ثابت"))) {
    return "fixed" as const;
  }
  if (name.includes("بورس") || name.includes("سهام") || name.includes("stock")) {
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

export function transactionLabel(tx: Pick<Transaction, "type" | "kind" | "notes">, asset?: Asset) {
  if (!isCashAccount(asset)) return tx.type === "buy" ? "خرید" : "فروش";
  if (tx.kind === "interest" || tx.notes?.includes("سود")) return "سود واریزی";
  if (tx.kind === "balance_adjustment" || tx.notes?.includes("اصلاح مانده")) return "اصلاح مانده";
  return tx.type === "buy" ? "واریز" : "برداشت";
}

export function metricsAt(
  assets: Asset[] = [],
  transactions: Transaction[] = [],
  prices: PriceHistory[] = [],
  until?: string,
): AssetMetric[] {
  return assets.map((asset) => {
    const mode = assetMode(asset);
    let quantity = 0;
    let costBasis = 0;
    let realizedProfit = 0;
    let runningCashFlow = 0;
    let peakCapital = 0;
    let totalGrossBuys = 0;
    let totalGrossSells = 0;

    const list = transactions
      .filter((t) => t.assetId === asset.id && (!until || t.date <= until))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));

    for (const tx of list) {
      const q = safeNumber(tx.quantity);
      const total = safeNumber(tx.totalPrice);
      if (tx.type === "buy") {
        quantity += q;
        costBasis += total;
        runningCashFlow += total;
        totalGrossBuys += total;
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

    const historicalPrice = prices
      .filter((p) => p.assetId === asset.id && (!until || p.date <= until))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]?.price;
    const currentPrice = safeNumber(historicalPrice ?? asset.currentPrice);

    const netInvested = list.reduce(
      (sum, tx) => sum + (tx.type === "buy" ? safeNumber(tx.totalPrice) : -safeNumber(tx.totalPrice)),
      0
    );

    let marketValue = 0;
    let unrealizedProfit = 0;
    let totalProfit = 0;
    let displayQuantity = Math.max(0, quantity);

    if (mode === "copy") {
      const copyUsd = safeNumber(asset.copyUsdBalance ?? quantity);
      const copyRate = safeNumber(asset.copyUsdRate ?? currentPrice);
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
      const manualCorrection = prices
        .filter((p) => p.assetId === asset.id && (!until || p.date <= until))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
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
      const interestRatio = (((asset.annualInterestRate ?? 0) / 100) * fixedDays) / 365;
      marketValue = fixedBase * (1 + interestRatio);
      displayQuantity = 1;
      unrealizedProfit = marketValue - fixedBase;
      totalProfit = unrealizedProfit;
    } else if (mode === "cash") {
      marketValue = Math.max(0, netInvested);
      displayQuantity = marketValue;
      totalProfit = list
        .filter((tx) => tx.kind === "interest" || tx.notes?.includes("سود"))
        .reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);
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

    const denominator = costBasis + Math.max(0, realizedProfit);
    const profitPercent =
      mode === "cash"
        ? costBasis > 0
          ? (totalProfit / costBasis) * 100
          : totalProfit > 0
          ? 100
          : 0
        : denominator > 0
        ? (totalProfit / denominator) * 100
        : 0;

    const freshCapital =
      peakCapital > 0
        ? peakCapital
        : Math.max(0, costBasis, totalGrossBuys);
    const capitalRoi = freshCapital > 0 ? (totalProfit / freshCapital) * 100 : 0;
    const isRiskFree = totalGrossSells >= totalGrossBuys && totalGrossBuys > 0;
    const netCashInvested = totalGrossBuys - totalGrossSells;

    return {
      asset,
      quantity: displayQuantity,
      averageCost: displayQuantity > 0 ? Math.max(0, costBasis) / displayQuantity : 0,
      costBasis: Math.max(0, costBasis),
      marketValue: Math.max(0, marketValue),
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
  const safeOrders = (orders || []).filter(
    (o) => normalizeSymbol(o.symbol) !== "کیان" && !o.symbol?.includes("کیان")
  );
  const safePrices = (prices || []).filter(
    (p) => normalizeSymbol(p.symbol) !== "کیان" && !p.symbol?.includes("کیان")
  );
  const safeDividends = (dividends || []).filter(
    (d) => normalizeSymbol(d.symbol) !== "کیان" && !d.symbol?.includes("کیان")
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

    const latestPriceObj = [...safePrices]
      .filter((item) => normalizeSymbol(item.symbol) === symbol)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
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

  const purchases = (orders || [])
    .filter((item) => item.type === "buy")
    .reduce((sum, item) => sum + safeNumber(item.totalPrice), 0);
  const sales = (orders || [])
    .filter((item) => item.type === "sell")
    .reduce((sum, item) => sum + safeNumber(item.totalPrice), 0);

  const rawRealized = stockData.reduce((sum, item) => sum + item.realized, 0);
  const paidDividends = stockData.reduce((sum, item) => sum + item.paidDividend, 0);
  const pendingDividends = stockData.reduce((sum, item) => sum + item.pendingDividend, 0);
  const totalDividends = paidDividends + pendingDividends;

  // Realized profit: closed trades capital gain + actual paid/received cash dividends
  const realizedProfit = rawRealized + paidDividends;
  const realizedCost = Math.max(0, sales - rawRealized);
  const realizedReturnPercent = realizedCost > 0 ? (realizedProfit / realizedCost) * 100 : 0;

  // Unrealized profit: current active stock gain + approved pending dividends
  const unrealizedProfit = currentProfit + pendingDividends;

  // Total profit = Realized profit + Unrealized profit
  const toDateProfit = realizedProfit + unrealizedProfit;
  const toDateReturnPercent = purchases > 0 ? (toDateProfit / purchases) * 100 : 0;

  const hami = assets.find((asset) => asset.name.includes("حامی"));
  const hamiBalance = hami ? metricsAt([hami], transactions, prices)[0]?.marketValue ?? 0 : 0;

  return {
    currentValue,
    currentCost,
    currentProfit,
    currentProfitPercent,
    purchases,
    sales,
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

  if (!hami) return manualTransactions;

  const transfers: Transaction[] = (orders || []).flatMap<Transaction>((order) => {
    const linked = `[stock-order:${order.id}]`;
    const total = safeNumber(order.totalPrice);
    if (order.type === "sell") {
      return [
        {
          id: `hami-stock-sell-${order.id}`,
          assetId: hami.id,
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
        assetId: hami.id,
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

  // Remove generated stock transfers that were tied to Kian orders
  const baseTxs = (data.transactions || []).filter((tx) => {
    if (kianOrders.some((ko) => tx.id.includes(ko.id) || (tx.notes && tx.notes.includes(ko.id)))) {
      return false;
    }
    return true;
  });

  const updatedTransactions = syncStockCashTransfers(
    [...baseTxs, ...newTransfers],
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
  const dates = Array.from(
    new Set([
      ...(safeData.transactions || []).map((t) => t.date),
      ...(safeData.prices || []).map((p) => p.date),
      ...(safeData.stockOrders || []).map((o) => o.date),
      todayIso(),
    ])
  ).filter(Boolean).sort();

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

  const total = list.reduce((sum, i) => sum + i.value, 0);
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
    if (!dateIso || amount <= 0) return;
    const date = new Date(`${dateIso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
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

  // 1. Transactions
  for (const tx of data.transactions || []) {
    const amt = safeNumber(tx.totalPrice);
    if (tx.kind === "interest" || tx.notes?.includes("سود")) {
      record(tx.date, "dividend", amt);
    } else if (tx.type === "buy") {
      record(tx.date, "buy", amt);
    } else if (tx.type === "sell") {
      record(tx.date, "sell", amt);
    }
  }

  // 2. Paid stock dividends
  for (const div of data.stockDividends || []) {
    if (div.status === "paid") {
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
