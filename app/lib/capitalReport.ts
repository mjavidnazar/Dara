import {
  assetMode,
  hasValidStockOrder,
  hasValidTradeAmounts,
  isCashAccount,
  isGeneratedStockTransfer,
  normalizeSymbol,
  safeNumber,
  todayIso,
  validIsoDate,
} from "./portfolio";
import type { PortfolioData, StockOrder, Transaction } from "./types";
import { linkedTransactions } from "./transactionLinks";
import { findFundingCandidates, traceCashShortfalls } from "./reconciliationGuide";
import type { CashShortfall, FundingCandidate } from "./reconciliationGuide";

export type AuditTarget =
  | { type: "transaction"; id: string }
  | { type: "stockOrder"; id: string }
  | { type: "asset"; id: string }
  | { type: "price"; id?: string; recordId?: string }
  | { type: "stockPrice"; id: string }
  | { type: "dividend"; id?: string }
  | { type: "capital" };

export interface AuditIssue {
  id: string;
  severity: "error" | "warning";
  title: string;
  detail: string;
  target: AuditTarget;
}

export interface CapitalFlow {
  id: string;
  target: AuditTarget;
  date: string;
  label: string;
  amount: number;
  kind: "initial" | "deposit" | "withdrawal" | "possibleDeposit" | "possibleWithdrawal";
}

export interface CapitalReport {
  initialCapital: number | null;
  additionalCapital: number;
  withdrawals: number;
  possibleDeposits: number;
  possibleWithdrawals: number;
  netCapital: number;
  estimatedNetCapital: number;
  currentValue: number;
  recordedProfit: number;
  // Cash-flow check, including *unconfirmed* external trades. Never present as a final profit
  // while there are issues; it is a diagnostic against the existing per-asset P&L.
  estimatedProfit: number;
  profitGap: number;
  pendingDividends: number;
  paidOutside: number;
  issues: AuditIssue[];
  flows: CapitalFlow[];
  fundingCandidates: FundingCandidate[];
  cashShortfalls: CashShortfall[];
  isReliable: boolean;
}

const EPSILON = 0.01;
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 1;

/** A read-only audit: never invent missing capital or silently rewrite the owner's history. */
export function analyzeCapital(
  data: PortfolioData,
  currentValue: number,
  recordedProfit: number,
  asOf = todayIso(),
): CapitalReport {
  const issues: AuditIssue[] = [];
  const flows: CapitalFlow[] = [];
  const assets = new Map((data.assets || []).map((asset) => [asset.id, asset]));
  const transactions = data.transactions || [];
  const orders = data.stockOrders || [];
  const fundingCandidates = findFundingCandidates(data, asOf);
  const cashShortfalls = traceCashShortfalls(data, asOf);
  const addIssue = (id: string, severity: AuditIssue["severity"], title: string, detail: string, target: AuditTarget) => {
    issues.push({ id, severity, title, detail, target });
  };
  const addFlow = (target: AuditTarget, date: string, label: string, amount: number, kind: CapitalFlow["kind"]) => {
    flows.push({ id: `${target.type}-${"id" in target ? target.id : date}`, target, date, label, amount, kind });
  };

  const datedTransactions = transactions.filter((tx) => validIsoDate(tx.date) && tx.date <= asOf);
  const validDatedTransactions = datedTransactions.filter(hasValidTradeAmounts);
  const datedOrders = orders.filter((order) => validIsoDate(order.date) && order.date <= asOf);
  const validDatedOrders = datedOrders.filter(hasValidStockOrder);
  const matches = (tx: Transaction, other: Transaction) =>
    other.id !== tx.id && other.assetId !== tx.assetId && other.type !== tx.type &&
    other.date === tx.date && sameAmount(safeNumber(other.totalPrice), safeNumber(tx.totalPrice));

  const cashCounterparts = (tx: Transaction, expectedAssetId?: string) =>
    validDatedTransactions.filter((other) =>
      matches(tx, other) && other.kind === "transfer" &&
      isCashAccount(assets.get(other.assetId)) && !isGeneratedStockTransfer(other) &&
      (!other.linkedTransactionId || other.linkedTransactionId === tx.id) &&
      (!tx.linkedTransactionId || tx.linkedTransactionId === other.id) &&
      (!expectedAssetId || other.assetId === expectedAssetId)
    );

  const idSet = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const tx of transactions) {
    const target: AuditTarget = { type: "transaction", id: tx.id };
    if (idSet.has(tx.id)) addIssue(`duplicate-id-${tx.id}`, "error", "شناسهٔ تکراری تراکنش", "دو ردیف با شناسهٔ یکسان وجود دارد؛ ویرایش و حذف ممکن است هر دو را تغییر دهد. نسخهٔ پشتیبان را بررسی کنید.", target);
    idSet.add(tx.id);
    if (!assets.has(tx.assetId)) addIssue(`orphan-${tx.id}`, "error", "دارایی تراکنش پیدا نشد", "این مبلغ در ارزش‌گذاری دارایی‌ها لحاظ نمی‌شود. دارایی را در فایل پشتیبان یا ردیف معامله اصلاح کنید.", target);
    if (!validIsoDate(tx.date) || tx.date > asOf) {
      addIssue(`date-${tx.id}`, "error", "تاریخ معامله نامعتبر یا آینده است", "تاریخ را اصلاح کنید؛ معاملهٔ آینده در گزارش امروز لحاظ نمی‌شود.", target);
      continue;
    }
    if (!hasValidTradeAmounts(tx)) {
      addIssue(`amount-${tx.id}`, "error", "مبلغ، تعداد یا نرخ نامعتبر", "اعداد باید مثبت و معتبر باشند؛ مقدار صفر یا نامعتبر نتیجهٔ گزارش را مخدوش می‌کند.", target);
      continue;
    }
    const fingerprint = `${tx.assetId}|${tx.type}|${tx.date}|${Math.round(tx.quantity * 1000)}|${Math.round(tx.totalPrice)}|${tx.kind || ""}`;
    if (fingerprints.has(fingerprint)) {
      addIssue(`duplicate-${tx.id}`, "warning", "معاملهٔ احتمالاً تکراری", `این ردیف با تراکنش ${fingerprints.get(fingerprint)} از نظر تاریخ، دارایی و مبلغ یکسان است. پیش از حذف، اسناد را مقایسه کنید.`, target);
    } else fingerprints.set(fingerprint, tx.id);
    const gross = tx.quantity * tx.unitPrice;
    if (Math.abs(gross - tx.totalPrice) > Math.max(100, gross * 0.02)) {
      addIssue(`total-${tx.id}`, "warning", "تعداد × نرخ با مبلغ کل نمی‌خواند", "مبلغ کل در مانده و سود استفاده می‌شود؛ تعداد و قیمت واحد را با سند اصلی تطبیق دهید.", target);
    }
  }

  // A legacy cash receipt can coexist with a newer, classified cash receipt for
  // the *same* trade. Different kinds defeat the generic fingerprint above and
  // would count both credits. Do not discard either row: show the exact suspect
  // so the owner can compare the broker statement before removing a duplicate.
  const cashReceiptsByTrade = new Map<string, Transaction[]>();
  for (const tx of validDatedTransactions) {
    const note = tx.notes?.trim();
    if (!isCashAccount(assets.get(tx.assetId)) || isGeneratedStockTransfer(tx) ||
        !note || !/^(?:واریز حاصل از معامله|برداشت بابت معامله) [\w-]+$/.test(note)) continue;
    const key = `${tx.assetId}|${tx.type}|${tx.date}|${Math.round(tx.totalPrice)}|${note}`;
    cashReceiptsByTrade.set(key, [...(cashReceiptsByTrade.get(key) || []), tx]);
  }
  for (const group of cashReceiptsByTrade.values()) {
    if (group.length < 2 || group.every((tx) => tx.kind === group[0].kind)) continue;
    const suspect = group.find((tx) => !tx.kind) || group[group.length - 1];
    addIssue(`cash-duplicate-${suspect.id}`, "error", "دو ثبت وجه برای یک معامله دیده شد",
      `ردیف‌های ${group.map((tx) => tx.id).join(" و ")} در یک حساب، یک روز و با مبلغ و شرح یکسان ثبت شده‌اند، اما ماهیت‌های متفاوت دارند. گردش حساب را تطبیق دهید؛ فقط اگر واقعاً تکراری است، یکی را حذف کنید. تغییر ماهیت به‌تنهایی این دو ثبت را حذف نمی‌کند.`,
      { type: "transaction", id: suspect.id });
  }

  for (const order of orders) {
    const target: AuditTarget = { type: "stockOrder", id: order.id };
    if (!validIsoDate(order.date) || order.date > asOf) {
      addIssue(`order-date-${order.id}`, "error", "تاریخ سفارش بورس نامعتبر یا آینده است", "تاریخ سفارش را اصلاح کنید.", target);
      continue;
    }
    if (!hasValidStockOrder(order)) {
      addIssue(`order-amount-${order.id}`, "error", "سفارش بورس ناقص است", "نماد، تعداد، نرخ، کارمزد و مبلغ خالص سفارش باید معتبر باشند.", target);
    } else {
      const expected = order.quantity * order.unitPrice + (order.type === "buy" ? 1 : -1) * (order.commission || 0);
      if (Math.abs(order.totalPrice - expected) > Math.max(100, Math.abs(expected) * 0.02)) {
        addIssue(`order-total-${order.id}`, "warning", "مبلغ تسویهٔ سفارش با تعداد، نرخ یا کارمزد نمی‌خواند", "مبلغ خالص سفارش در ماندهٔ نقدی به کار می‌رود. اطلاعات را با گزارش کارگزاری تطبیق دهید.", target);
      }
    }
  }

  const assetQuotes = new Map<string, number>();
  for (const price of data.prices || []) {
    const target: AuditTarget = { type: "price", id: price.assetId, recordId: price.id };
    if (!validIsoDate(price.date) || price.date > asOf) {
      addIssue(`quote-date-${price.id}`, "warning", "تاریخ قیمت ثبت‌شده نیاز به بررسی دارد", "قیمتِ بدون تاریخ معتبر یا مربوط به آینده نباید مبنای ارزش امروز باشد. تاریخ آن را در تاریخچهٔ قیمت‌ها اصلاح کنید و ارزش روز را بازبینی کنید.", target);
    }
    if (!Number.isFinite(price.price) || price.price <= 0) {
      addIssue(`quote-value-${price.id}`, "error", "قیمت ثبت‌شده معتبر نیست", "قیمت صفر یا منفی را در تاریخچهٔ قیمت‌ها اصلاح کنید؛ در غیر این صورت ارزش روز قابل اتکا نیست.", target);
    }
    if (validIsoDate(price.date) && price.date <= asOf && Number.isFinite(price.price) && price.price > 0) {
      const key = `${price.assetId}|${price.date}`;
      const earlier = assetQuotes.get(key);
      if (earlier !== undefined && Math.abs(earlier - price.price) > EPSILON) {
        addIssue(`quote-conflict-${price.id}`, "warning", "دو قیمت متفاوت برای یک روز ثبت شده", "دو نرخ متفاوت برای همین دارایی در یک روز وجود دارد. نرخ معتبر یا تاریخ صحیح را با سند تطبیق دهید؛ انتخاب یکی به‌صورت خودکار ممکن نیست.", target);
      }
      assetQuotes.set(key, price.price);
    }
  }

  const stockQuotes = new Map<string, number>();
  for (const price of data.stockPrices || []) {
    const target: AuditTarget = { type: "stockPrice", id: price.id };
    if (!validIsoDate(price.date) || price.date > asOf) {
      addIssue(`stock-quote-date-${price.id}`, "warning", "تاریخ قیمت سهام نامعتبر یا آینده است", "این نرخ در ارزش روز سهام به کار نمی‌رود. تاریخ واقعی را در تاریخچهٔ قیمت سهام اصلاح کنید.", target);
    }
    if (!Number.isFinite(price.price) || price.price <= 0 || !normalizeSymbol(price.symbol)) {
      addIssue(`stock-quote-value-${price.id}`, "error", "نرخ یا نماد قیمت سهام معتبر نیست", "نماد و قیمت مثبت را با سند اصلی در تاریخچهٔ قیمت سهام اصلاح کنید.", target);
    }
    if (validIsoDate(price.date) && price.date <= asOf && Number.isFinite(price.price) && price.price > 0 && normalizeSymbol(price.symbol)) {
      const key = `${normalizeSymbol(price.symbol)}|${price.date}`;
      const earlier = stockQuotes.get(key);
      if (earlier !== undefined && Math.abs(earlier - price.price) > EPSILON) {
        addIssue(`stock-quote-conflict-${price.id}`, "warning", "دو نرخ پایانی متفاوت برای یک نماد در یک روز", "برای محاسبهٔ ارزش روز فقط یک نرخ پایانی معتبر لازم است. تاریخ و نرخ هر دو رکورد را بررسی کنید.", target);
      }
      stockQuotes.set(key, price.price);
    }
  }

  const datedTxById = new Map(validDatedTransactions.map((tx) => [tx.id, tx]));
  for (const tx of validDatedTransactions) {
    const asset = assets.get(tx.assetId);
    if (!asset || !(tx.totalPrice > 0) || !(tx.quantity > 0)) continue;
    const target: AuditTarget = { type: "transaction", id: tx.id };
    const cash = isCashAccount(asset);
    const expectedAccount = tx.type === "buy" ? tx.sourceAssetId : tx.destinationAssetId;
    const counterpart = expectedAccount ? cashCounterparts(tx, expectedAccount) : [];

    if (expectedAccount && (counterpart.length !== 1 || !assets.has(expectedAccount))) {
      addIssue(`pair-${tx.id}`, "error", "طرف نقدی معامله پیدا نشد", `انتقال وجهِ «${asset.name}» در حساب مبدأ/مقصد ناقص یا تکراری است. حساب و معاملهٔ مرتبط را بررسی کنید.`, target);
    }
    if (tx.linkedTransactionId) {
      const pair = datedTxById.get(tx.linkedTransactionId);
      if (!pair || !matches(tx, pair) || (pair.linkedTransactionId && pair.linkedTransactionId !== tx.id)) {
        addIssue(`link-${tx.id}`, "error", "انتقال پیوندخورده ناهماهنگ است", "تاریخ، مبلغ یا طرف مقابل با این انتقال یکسان نیست. هر دو ردیف را بررسی کنید.", target);
      }
    }

    if (tx.kind === "opening_capital" || tx.kind === "capital_in" || tx.kind === "capital_out") {
      if (expectedAccount || tx.linkedTransactionId ||
          (tx.type === "sell" && tx.kind !== "capital_out") ||
          (tx.type === "buy" && tx.kind === "capital_out")) {
        addIssue(`classification-${tx.id}`, "error", "ماهیت آورده با جهت معامله نمی‌خواند", "پول نمی‌تواند هم‌زمان آوردهٔ بیرونی و انتقال داخلی باشد. نوع و حساب رابط را اصلاح کنید.", target);
      } else {
        addFlow(target, tx.date, asset.name, tx.totalPrice,
          tx.kind === "opening_capital" ? "initial" : tx.kind === "capital_in" ? "deposit" : "withdrawal");
      }
      continue;
    }
    if (tx.kind === "balance_adjustment") {
      addIssue(`adjustment-${tx.id}`, "error", "اصلاح مانده با منبع نامشخص", `در ${asset.name} ${tx.type === "buy" ? "افزایش" : "کاهش"} ${Math.round(tx.totalPrice).toLocaleString("fa-IR")} تومان ثبت شده است. آیا آورده، برداشت، سود/هزینه یا اصلاح یک معاملهٔ قبلی بوده؟`, target);
      continue;
    }
    if (tx.kind === "transfer") {
      if (isGeneratedStockTransfer(tx)) {
        const orderId = tx.notes?.match(/\[stock-order:([^\]]+)\]/)?.[1] || tx.id.replace(/^hami-stock-(buy|sell|sale)-/, "");
        const order = validDatedOrders.find((o) => o.id === orderId);
        const settlementAccount = order?.sourceAssetId
          ? assets.get(order.sourceAssetId)
          : (data.assets || []).find((item) => item.name.includes("حامی") && isCashAccount(item));
        if (!order || !settlementAccount || tx.assetId !== settlementAccount.id ||
            !sameAmount(order.totalPrice, tx.totalPrice) || order.date !== tx.date || order.type === tx.type) {
          addIssue(`stock-pair-${tx.id}`, "error", "تسویهٔ بورس با سفارش نمی‌خواند", "این برداشت/واریز خودکار باید با سفارش بورس هم‌مبلغ، هم‌تاریخ و در جهت مخالف باشد.", target);
        }
      } else {
        const potential = validDatedTransactions.filter((other) => matches(tx, other) && !isGeneratedStockTransfer(other) &&
          (!other.linkedTransactionId || other.linkedTransactionId === tx.id) &&
          (!tx.linkedTransactionId || tx.linkedTransactionId === other.id) &&
          (other.kind === "transfer" || (!isCashAccount(assets.get(other.assetId)) && (!other.kind || other.kind === "trade"))));
        const legacyPair = linkedTransactions(data, tx);
        // A strict explicit/legacy link can identify the opposite leg even when
        // its kind is blank or labelled "trade" instead of "transfer". Never
        // report a fictitious missing cash movement for that real linked row.
        if (potential.length !== 1 && legacyPair.length !== 1) {
          addIssue(`transfer-${tx.id}`, "error", "انتقال داخلی بدون طرف مقابل", "یک انتقال باید هم‌زمان یک برداشت و یک واریز هم‌مبلغ داشته باشد. ردیف مقابل را ثبت یا این ردیف را بازبینی کنید.", target);
        }
      }
      continue;
    }
    if (tx.kind === "stock_dividend") {
      const dividend = (data.stockDividends || []).find((item) => item.id === tx.stockDividendId);
      if (!cash || tx.type !== "buy" || expectedAccount || tx.linkedTransactionId ||
          !dividend || dividend.status !== "paid" || !validIsoDate(dividend.date) ||
          dividend.date > tx.date || !sameAmount(tx.totalPrice, dividend.amount) || dividend.receivedOutside) {
        addIssue(`dividend-receipt-${tx.id}`, "error", "واریز سود مجمع با دفتر بورس نمی‌خواند", "این واریز باید به یک سود مجمعِ محقق‌شدهٔ هم‌مبلغ با تاریخ حداکثر تاریخ دریافت وصل شود و در حساب نقدی ثبت شده باشد.", target);
      }
      continue;
    }
    if (cash) {
      if (tx.kind === "interest" || tx.kind === "fee" ||
          (tx.kind === "trade" && expectedAccount && counterpart.length === 1)) continue;
      const legacyPair = !tx.kind ? linkedTransactions(data, tx) : [];
      if (legacyPair.length === 1 && legacyPair[0].kind === "transfer") {
        addIssue(`cash-unclassified-link-${tx.id}`, "warning", "حساب مقابل پیدا شد؛ ماهیت پول هنوز تأیید نشده", `برای ${asset.name} یک برداشت/واریز هم‌مبلغ و هم‌تاریخ در حساب مقابل ثبت شده است. ارتباط و نوع «انتقال داخلی» را با سند تأیید و روی همین ردیف ثبت کنید؛ آن را دوباره واریز نکنید.`, target);
      } else {
        addIssue(`cash-kind-${tx.id}`, "error", "منبع واریز/برداشت نقدی مشخص نیست", `برای ${asset.name} مشخص کنید این مبلغ آوردهٔ اولیه، آوردهٔ جدید، برداشت، سود یا انتقال داخلی بوده است.`, target);
      }
      continue;
    }
    if (tx.kind === "interest" || tx.kind === "fee") {
      addIssue(`noncash-kind-${tx.id}`, "warning", "نوع سود/هزینه برای دارایی غیرنقدی", "این نوع تراکنش فقط برای حساب نقدی محاسبه می‌شود؛ ماهیت خرید یا فروش را بازبینی کنید.", target);
    }
    // A purchase without a tracked funding account may be outside capital, or simply a
    // missing internal transfer. Show it separately, never claim it was initial money.
    if (!expectedAccount) {
      const potential = cashCounterparts(tx);
      if (potential.length) {
        addIssue(`unlinked-${tx.id}`, "warning", "معامله بدون اتصال به حساب", `برای «${asset.name}» انتقال هم‌مبلغی دیده شد، اما ارتباط ثبت نشده است. برای جلوگیری از دوباره‌شماری حساب مبدأ/مقصد را انتخاب کنید.`, target);
      } else {
        const direction = tx.type === "buy" ? "possibleDeposit" : "possibleWithdrawal";
        addFlow(target, tx.date, asset.name, tx.totalPrice, direction);
        addIssue(`external-${tx.id}`, "warning", "منبع یا مقصد پول معامله نامشخص است", `برای ${asset.name} فرض شده ${tx.type === "buy" ? "پول از خارج سبد وارد شده" : "وجه از سبد خارج شده"} است. اگر از حساب داخلی بوده، حساب رابط را انتخاب کنید؛ وگرنه نوع آورده/برداشت را مشخص کنید.`, target);
      }
    }
  }

  const generatedForOrder = (order: StockOrder) => validDatedTransactions.filter((tx) =>
    isGeneratedStockTransfer(tx) &&
    (tx.notes?.includes(`[stock-order:${order.id}]`) || tx.id.endsWith(`-${order.id}`))
  );
  for (const order of validDatedOrders) {
    if (!(order.totalPrice > 0)) continue;
    const target: AuditTarget = { type: "stockOrder", id: order.id };
    const paired = generatedForOrder(order);
    const account = order.sourceAssetId
      ? assets.get(order.sourceAssetId)
      : (data.assets || []).find((asset) => asset.name.includes("حامی") && isCashAccount(asset));
    if (!order.sourceAssetId && (!account || paired.length !== 1 || paired[0].assetId !== account.id)) {
      addIssue(`order-account-${order.id}`, "warning", "حساب تسویهٔ سفارش مشخص نیست", "برای سفارش قدیمی حساب تسویه را انتخاب کنید؛ حساب حامی فقط وقتی تسویهٔ هم‌مبلغ واقعاً در آن ثبت شده باشد قابل تأیید است.", target);
    } else if (!account || !isCashAccount(account)) {
      addIssue(`order-account-${order.id}`, "error", "حساب تسویهٔ سفارش معتبر نیست", "حساب تسویه حذف شده یا نقدی نیست. سفارش را ویرایش و یک حساب نقدی واقعی انتخاب کنید.", target);
    }
    if (paired.length !== 1) {
      if (account && isCashAccount(account)) {
        addIssue(`order-pair-${order.id}`, "error", "تسویهٔ نقدی سفارش بورس ثبت نشده", "حساب تسویه برای این سفارش وجود دارد اما واریز/برداشت متناظر ثبت نشده است. سفارش را بازبینی کنید.", target);
      } else {
        addFlow(target, order.date, `بورس / ${order.symbol}`, order.totalPrice,
          order.type === "buy" ? "possibleDeposit" : "possibleWithdrawal");
        addIssue(`order-external-${order.id}`, "warning", "منبع خرید/فروش بورس نامشخص است", "تسویهٔ سفارش در حساب نقدی ثبت نشده؛ حساب مبدأ/مقصد را مشخص کنید.", target);
      }
    }
  }

  // Negative running balances and selling more units than were bought must not disappear
  // behind the non-negative quantities used by some of the asset/stock widgets.
  for (const asset of data.assets || []) {
    if (assetMode(asset) === "fixed" && asset.annualInterestRate !== undefined &&
        (!Number.isFinite(asset.annualInterestRate) || asset.annualInterestRate < 0)) {
      addIssue(`fixed-rate-${asset.id}`, "error", `نرخ سود ${asset.name} معتبر نیست`, "نرخ سالانهٔ صندوق باید عددی نامنفی باشد؛ دارایی را ویرایش و نرخ مستند را ثبت کنید.", { type: "asset", id: asset.id });
    }
    if (assetMode(asset) === "copy" && asset.copyUsdBalance !== undefined &&
        (!Number.isFinite(asset.copyUsdBalance) || asset.copyUsdBalance < 0)) {
      addIssue(`copy-balance-${asset.id}`, "error", `ماندهٔ دلاری ${asset.name} معتبر نیست`, "ماندهٔ دلاری فعلی باید عددی نامنفی و مستند باشد؛ آن را در فرم به‌روزرسانی مانده اصلاح کنید.", { type: "price", id: asset.id });
    }
    let balance = 0;
    const assetTxs = validDatedTransactions.filter((tx) => tx.assetId === asset.id)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
    if (!assetTxs.length && assetMode(asset) === "copy" && safeNumber(asset.copyUsdBalance) > EPSILON) {
      addIssue(`copy-unfunded-${asset.id}`, "error", `منبع ماندهٔ ${asset.name} ثبت نشده`, "ماندهٔ دلاری دارید اما هیچ واریز/خرید دلاری برای این دارایی ثبت نشده است. تراکنش واقعی آغازین را ثبت کنید؛ آن را سود فرض نکنید.", { type: "capital" });
    }
    if (!assetTxs.length && assetMode(asset) === "fixed" && (data.prices || []).some((p) =>
      p.assetId === asset.id && validIsoDate(p.date) && p.date <= asOf && p.price > 0)) {
      addIssue(`fixed-unfunded-${asset.id}`, "error", `ارزش ${asset.name} بدون واریز ثبت شده`, "برای این صندوق ارزش‌گذاری وجود دارد اما واریز/خرید آغازین ثبت نشده است. منشأ مبلغ را در معاملات مشخص کنید.", { type: "capital" });
    }
    for (const tx of assetTxs) {
      if (isCashAccount(asset) || assetMode(asset) === "stock" || assetMode(asset) === "fixed") continue;
      balance += tx.type === "buy" ? safeNumber(tx.quantity) : -safeNumber(tx.quantity);
      if (balance < -EPSILON) {
        addIssue(`oversell-${tx.id}`, "error", `فروش بیش از موجودی ${asset.name}`, "تعداد فروش از موجودی خریداری‌شده تا تاریخ این ردیف بیشتر است. مقدار یا تاریخ معامله را اصلاح کنید.", { type: "transaction", id: tx.id });
      }
    }
    if (!isCashAccount(asset) && assetMode(asset) !== "stock" && assetMode(asset) !== "fixed" && balance > EPSILON) {
      if (assetMode(asset) === "copy" && asset.copyUsdBalance !== undefined && !asset.lastValuationAt) {
        addIssue(`copy-snapshot-${asset.id}`, "warning", `تاریخ ماندهٔ دلاری ${asset.name} مشخص نیست`, "ماندهٔ دلاری فعلی تاریخ ندارد؛ نمودار گذشته تا زمان ثبت ماندهٔ امروز تقریبی است. مانده و نرخ را تأیید کنید.", { type: "price", id: asset.id });
      }
      const history = (data.prices || []).filter((p) => p.assetId === asset.id && validIsoDate(p.date) && p.date <= asOf && Number.isFinite(p.price) && p.price > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      const price = assetMode(asset) === "copy" ? (asset.copyUsdRate ?? asset.currentPrice) : (history[0]?.price ?? asset.currentPrice);
      const priceDate = assetMode(asset) === "copy" ? (asset.lastValuationAt || history[0]?.date) : (history[0]?.date || asset.createdAt?.slice(0, 10));
      if (!Number.isFinite(price) || price <= 0) addIssue(`price-${asset.id}`, "error", `قیمت روز ${asset.name} ثبت نشده`, "با قیمت صفر یا نامعتبر، ارزش و سود این دارایی نادرست است. نرخ روز را ثبت کنید.", { type: "price", id: asset.id });
      else if (!priceDate || !validIsoDate(priceDate)) {
        addIssue(`undated-price-${asset.id}`, "warning", `تاریخ نرخ ${asset.name} مشخص نیست`, "بدون تاریخ معتبر نمی‌توان تازه بودن قیمت/مانده را تأیید کرد. نرخ امروز را ثبت کنید.", { type: "price", id: asset.id });
      } else if (priceDate > asOf) {
        addIssue(`future-price-${asset.id}`, "error", `ارزش‌گذاری ${asset.name} در آینده ثبت شده`, "مانده یا نرخ آینده نمی‌تواند مبنای ارزش امروز باشد. تاریخ/نرخ را بررسی کنید.", { type: "price", id: asset.id });
      } else if ((Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${priceDate}T12:00:00Z`)) / 86400000 > 30) {
        addIssue(`stale-${asset.id}`, "warning", `قیمت ${asset.name} قدیمی است`, `آخرین نرخ ثبت‌شده مربوط به ${priceDate} است. برای سود تا امروز، قیمت را به‌روز کنید.`, { type: "price", id: asset.id });
      }
    }
  }

  // Show every separate negative episode (not only the first one per account).
  // The guide uses end-of-day balances so an unknown within-day ordering cannot
  // create a spurious shortfall. The paired receipt/order is a lead, not funding.
  const negativeAccounts = new Set<string>();
  for (const gap of cashShortfalls) {
    const id = negativeAccounts.has(gap.accountId)
      ? `negative-${gap.accountId}-${gap.triggerId}` : `negative-${gap.accountId}`;
    negativeAccounts.add(gap.accountId);
    const format = (amount: number) => Math.round(amount).toLocaleString("fa-IR");
    const related = gap.related
      ? ` ردیف مرتبط: ${gap.related.label} به مبلغ ${format(gap.related.amount)} تومان؛ وجود طرف مقابل منبع موجودی آغازین را ثابت نمی‌کند.`
      : " ردیف متناظر قابل‌اعتماد پیدا نشد.";
    const explanation = gap.attributionCandidates.length > 1
      ? `چند برداشت در روز ${gap.date} بر کسری اثر دارند؛ ترتیب واقعیِ آن‌ها معلوم نیست. ماندهٔ روز قبل ${format(gap.dayStartBalance)} و ماندهٔ پایان روز ${format(gap.balanceAfter)} تومان است. ردیف‌های ${gap.attributionCandidates.join("، ")} را با سند تطبیق دهید.`
      : gap.dayRowCount > 1
        ? `بدون برداشت ${format(gap.outflow)} تومانی، ماندهٔ پایان روز ${format(gap.balanceBefore)}؛ با آن، ${format(gap.balanceAfter)} تومان می‌شود. ترتیب ردیف‌های همان روز اثبات نشده است.${related}`
        : `پیش از برداشت ${format(gap.balanceBefore)}، خروج ${format(gap.outflow)} و پس از آن ${format(gap.balanceAfter)} تومان بوده است.${related}`;
    addIssue(id, "error", `ماندهٔ منفی ${gap.accountName}`,
      `${explanation}${gap.earlierCreditCount ? "" : " پیش از این روز هیچ واریزی در همین حساب ثبت نشده است."} تاریخ، منبع واقعی و اسناد مرتبط را بررسی کنید.`,
      { type: "transaction", id: gap.triggerId });
  }

  const bySymbol = new Map<string, StockOrder[]>();
  for (const order of validDatedOrders) {
    const symbol = normalizeSymbol(order.symbol);
    bySymbol.set(symbol, [...(bySymbol.get(symbol) || []), order]);
  }
  for (const [symbol, symbolOrders] of bySymbol) {
    let quantity = 0;
    for (const order of symbolOrders.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))) {
      quantity += order.type === "buy" ? safeNumber(order.quantity) : -safeNumber(order.quantity);
      if (quantity < -EPSILON) addIssue(`stock-oversell-${order.id}`, "error", `فروش بیش از موجودی ${symbol}`, "تعداد سهام فروخته‌شده از موجودی تا تاریخ سفارش بیشتر است. مقدار/تاریخ را اصلاح کنید.", { type: "stockOrder", id: order.id });
    }
    if (quantity > EPSILON) {
      const latest = (data.stockPrices || []).filter((p) => normalizeSymbol(p.symbol) === symbol && validIsoDate(p.date) && p.date <= asOf && Number.isFinite(p.price) && p.price > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!latest || !(latest.price > 0)) addIssue(`stock-price-${symbol}`, "error", `قیمت سهام ${symbol} ثبت نشده`, "بدون قیمت پایانی، سود و ارزش روز این نماد قابل اتکا نیست.", { type: "price" });
      else if ((Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${latest.date}T12:00:00Z`)) / 86400000 > 30) {
        addIssue(`stock-stale-${symbol}`, "warning", `قیمت سهام ${symbol} قدیمی است`, `آخرین نرخ ثبت‌شده مربوط به ${latest.date} است. قیمت‌ها را در بخش بورس به‌روز کنید.`, { type: "price" });
      }
    }
  }
  if (validDatedOrders.length && !(data.assets || []).some((asset) => asset.name === "بورس")) {
    addIssue("missing-stock-asset", "error", "دارایی بورس در سبد وجود ندارد", "سفارش‌های بورسی در جمع ارزش و سود سبد وارد نمی‌شوند. دارایی بورس را تعریف یا فایل پشتیبان را اصلاح کنید.", { type: "capital" });
  }

  let pendingDividends = 0;
  let paidOutside = 0;
  for (const dividend of data.stockDividends || []) {
    if (!validIsoDate(dividend.date) || !Number.isFinite(dividend.amount) || dividend.amount <= 0 ||
        (dividend.status !== "pending" && dividend.status !== "paid")) {
      addIssue(`dividend-data-${dividend.id}`, "error", "سود مجمع ناقص است", "تاریخ، وضعیت و مبلغ مثبت و معتبر سود مجمع را در دفتر بورس اصلاح کنید.", { type: "dividend", id: dividend.id });
      continue;
    }
    if (dividend.date > asOf) {
      addIssue(`dividend-future-${dividend.id}`, "warning", "تاریخ سود مجمع در آینده است", "این سود در گزارش امروز وارد نشده؛ اگر تاریخ مجمع یا واریز اشتباه است، آن را در دفتر بورس اصلاح کنید.", { type: "dividend", id: dividend.id });
      continue;
    }
    if (dividend.status === "pending") {
      pendingDividends += dividend.amount;
      if (dividend.receivedOutside) addIssue(`dividend-status-${dividend.id}`, "error", "وضعیت سود مجمع متناقض است", "سود در انتظار نمی‌تواند هم‌زمان دریافت‌شده در بیرون سبد باشد.", { type: "dividend", id: dividend.id });
      continue;
    }
    const receipts = validDatedTransactions.filter((tx) => tx.kind === "stock_dividend" &&
      tx.stockDividendId === dividend.id && isCashAccount(assets.get(tx.assetId)) && tx.type === "buy" &&
      sameAmount(tx.totalPrice, dividend.amount) && tx.date >= dividend.date);
    if (receipts.length > 1) {
      addIssue(`dividend-duplicate-${dividend.id}`, "error", "سود مجمع چند بار به حساب واریز شده", "دو یا چند واریز به یک سود مجمع پیوند دارند. تراکنش‌های تکراری را پس از بررسی سند حذف کنید.", { type: "dividend", id: dividend.id });
    }
    if (receipts.length && dividend.receivedOutside) {
      addIssue(`dividend-outside-${dividend.id}`, "error", "محل دریافت سود مجمع متناقض است", "این سود هم به حساب داخل سبد وصل شده و هم دریافت بیرونی علامت خورده است؛ محل واقعی را در دفتر مجامع اصلاح کنید.", { type: "dividend", id: dividend.id });
    }
    if (!receipts.length) {
      // Until confirmed otherwise, a paid dividend absent from the tracked accounts
      // is only *assumed* to have been paid outside. A same-amount deposit alone is
      // never enough evidence of a link (it might be someone's additional capital).
      paidOutside += dividend.amount;
      if (!dividend.receivedOutside) {
        const candidates = validDatedTransactions.filter((tx) => isCashAccount(assets.get(tx.assetId)) && tx.type === "buy" &&
          tx.date >= dividend.date && sameAmount(tx.totalPrice, dividend.amount) && !isGeneratedStockTransfer(tx));
        addIssue(`dividend-unlocated-${dividend.id}`, "warning", "محل دریافت سود مجمع نامشخص است",
          candidates.length
            ? "واریز هم‌مبلغی دیده شد اما ارتباط آن تأیید نشده است. اگر همین دریافت است، ردیف واریز را به «دریافت سود مجمع» تغییر داده و مجمع را انتخاب کنید؛ وگرنه دریافت بیرون سبد را تأیید کنید."
            : "اگر در حساب داخل سبد دریافت شده، واریز را در معاملات ثبت و به این سود مجمع وصل کنید؛ اگر بیرون سبد دریافت شده، آن را در دفتر مجامع تأیید کنید.",
          { type: "dividend", id: dividend.id });
        if (candidates.length === 1) {
          addIssue(`dividend-candidate-${dividend.id}`, "warning", "واریزِ شبیه سود مجمع بررسی شود", "این واریز هم‌مبلغ سود مجمع است. اگر همان سود است، نوع آن را «دریافت سود مجمع» و مجمع متناظر را انتخاب کنید؛ در غیر این صورت آن را تغییر ندهید.", { type: "transaction", id: candidates[0].id });
        }
      }
    }
  }

  const initialFlows = flows.filter((flow) => flow.kind === "initial");
  const initialCapital = initialFlows.length ? initialFlows.reduce((sum, flow) => sum + flow.amount, 0) : null;
  const sumKind = (kind: CapitalFlow["kind"]) => flows.filter((flow) => flow.kind === kind).reduce((sum, flow) => sum + flow.amount, 0);
  const additionalCapital = sumKind("deposit");
  const withdrawals = sumKind("withdrawal");
  const possibleDeposits = sumKind("possibleDeposit");
  const possibleWithdrawals = sumKind("possibleWithdrawal");
  const netCapital = (initialCapital ?? 0) + additionalCapital - withdrawals;
  const estimatedNetCapital = netCapital + possibleDeposits - possibleWithdrawals;
  const estimatedProfit = currentValue - estimatedNetCapital + pendingDividends + paidOutside;
  const profitGap = recordedProfit - estimatedProfit;

  if ((datedTransactions.length || datedOrders.length || currentValue !== 0) && initialCapital === null) {
    addIssue("opening-missing", "warning", "سرمایهٔ اولیه هنوز مشخص نشده", "از میان واریزها یا خریدهای آغازین، ردیفِ واقعاً مربوط به پول اولیه را ویرایش و «آورده اولیه» انتخاب کنید. ثبت دوبارهٔ پول موجود، ارزش سبد را دو برابر می‌کند.", { type: "capital" });
  }
  if (Math.abs(profitGap) > 100 && (flows.length || datedTransactions.length || datedOrders.length)) {
    addIssue("profit-gap", "error", "سود با جریان ورود و خروج پول تطبیق ندارد", `اختلاف سود محاسباتی دارایی‌ها و سود برآوردیِ جریان پول ${Math.round(Math.abs(profitGap)).toLocaleString("fa-IR")} تومان است. ردیف‌های هشدار، مانده‌های منفی و اصلاح مانده را بازبینی کنید.`, { type: "capital" });
  }

  flows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  return {
    initialCapital, additionalCapital, withdrawals, possibleDeposits, possibleWithdrawals,
    netCapital, estimatedNetCapital, currentValue, recordedProfit, estimatedProfit, profitGap,
    pendingDividends, paidOutside, issues, flows, fundingCandidates, cashShortfalls,
    isReliable: initialCapital !== null && issues.length === 0,
  };
}
