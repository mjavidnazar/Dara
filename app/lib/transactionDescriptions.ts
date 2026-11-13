import { hasValidStockOrder, hasValidTradeAmounts, isCashAccount, toPersianDate, validIsoDate } from "./portfolio";
import type { PortfolioData, StockOrder, Transaction } from "./types";

type Ledger = Pick<PortfolioData, "assets" | "transactions" | "stockOrders">;
const quantityFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 20 });
const tomanFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 12 });
const unitPriceFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 20 });
const toman = (value: number) => `${tomanFormat.format(value)} تومان`;

/** Only replace machine references we recognize. A person's own notes remain verbatim. */
function transactionSummary(data: Ledger, trade: Transaction): string | null {
  const assets = data.assets.filter((item) => item.id === trade.assetId);
  const asset = assets.length === 1 ? assets[0] : undefined;
  if (!asset || !validIsoDate(trade.date) || !hasValidTradeAmounts(trade)) return null;
  if (isCashAccount(asset)) {
    return `${trade.type === "buy" ? "واریز" : "برداشت"} ${toman(trade.totalPrice)} ${trade.type === "buy" ? "به" : "از"} ${asset.name} در تاریخ ${toPersianDate(trade.date)}`;
  }
  const unit = asset.unit?.trim() || "واحد";
  return `${trade.type === "buy" ? "خرید" : "فروش"} ${quantityFormat.format(trade.quantity)} ${unit} ${asset.name} به قیمت هر ${unit} ${unitPriceFormat.format(trade.unitPrice)} تومان در تاریخ ${toPersianDate(trade.date)}، جمعاً ${toman(trade.totalPrice)}`;
}

function stockOrderSummary(order: StockOrder): string | null {
  if (!validIsoDate(order.date) || !hasValidStockOrder(order)) return null;
  return `${order.type === "buy" ? "خرید" : "فروش"} ${quantityFormat.format(order.quantity)} سهم ${order.symbol} به قیمت هر سهم ${unitPriceFormat.format(order.unitPrice)} تومان در تاریخ ${toPersianDate(order.date)}، جمعاً ${toman(order.totalPrice)}`;
}

function mismatchWarnings(cash: Transaction, trade: Transaction | StockOrder, expectedTrade: "buy" | "sell") {
  const warnings: string[] = [];
  if (trade.type !== expectedTrade) warnings.push("جهت معامله با این یادداشت نمی‌خواند");
  if (cash.type === expectedTrade) warnings.push("جهت گردش پول با این یادداشت نمی‌خواند");
  if (cash.date !== trade.date) warnings.push("تاریخ دو ردیف متفاوت است");
  if (!Number.isFinite(cash.totalPrice) || !Number.isFinite(trade.totalPrice) ||
      Math.abs(cash.totalPrice - trade.totalPrice) >= 1) warnings.push("مبلغ دو ردیف متفاوت است");
  if ("linkedTransactionId" in trade && trade.linkedTransactionId && trade.linkedTransactionId !== cash.id) {
    warnings.push("ردیف معامله به گردش پول دیگری پیوند دارد");
  }
  const settlementId = "assetId" in trade
    ? (trade.type === "buy" ? trade.sourceAssetId : trade.destinationAssetId)
    : trade.sourceAssetId;
  if (settlementId && settlementId !== cash.assetId) {
    warnings.push("حساب تسویهٔ معامله با این ردیف متفاوت است");
  }
  return warnings.length ? ` (نیازمند بررسی: ${warnings.join("؛ ")})` : "";
}

/**
 * Show the actual referenced trade, not an opaque tx/order id. This is a
 * read-only presentation: raw notes and ids MUST remain intact for legacy
 * pairing, safe edits and JSON backups. A reference is not proof of payment.
 */
export function describeTransactionNote(data: Ledger, tx: Transaction): string {
  let note = tx.notes || "";
  if (!note) return note;

  // Old cash legs used a Persian prefix plus the trade id instead of a link id.
  note = note.replace(
    /(واریز حاصل از معامله|برداشت بابت معامله)\s+([A-Za-z0-9_][\w-]*)(?=$|[\s\])},.،])/g,
    (_match, prefix: string, tradeId: string) => {
      const matches = data.transactions.filter((item) => item.id === tradeId);
      const verb = prefix.startsWith("واریز") ? "واریز حاصل از " : "برداشت بابت ";
      if (matches.length !== 1 || matches[0].id === tx.id) {
        return `${verb}معامله‌ای که ردیف مرتبطِ یکتای آن در اطلاعات پیدا نشد (یادداشت فنی را بررسی کنید)`;
      }
      const trade = matches[0];
      const summary = transactionSummary(data, trade);
      if (!summary) return `${verb}معامله‌ای با اطلاعات ناقص (ردیف اصلی را بررسی کنید)`;
      const expected = prefix.startsWith("واریز") ? "sell" : "buy";
      const linkWarning = tx.linkedTransactionId && tx.linkedTransactionId !== tradeId
        ? " (نیازمند بررسی: شناسهٔ پیوند با یادداشت متفاوت است)" : "";
      return `${verb}${summary}${mismatchWarnings(tx, trade, expected)}${linkWarning}`;
    },
  );

  // Stock settlements and older commodity certificates stored references in tags.
  const stockTag = note.match(/\[stock-order:([^\]\s]+)\]/);
  if (stockTag) {
    const orders = data.stockOrders.filter((order) => order.id === stockTag[1]);
    const order = orders.length === 1 ? orders[0] : undefined;
    const summary = order && stockOrderSummary(order);
    if (!summary) return note.replace(stockTag[0], "(سفارش مرتبط پیدا نشد یا اطلاعاتش ناقص است؛ بررسی کنید)");
    const debitNote = /^\s*برداشت برای خرید بورس\s*\//.test(note);
    const receiptNote = /^\s*واریز حاصل فروش بورس\s*\//.test(note);
    const expected = debitNote ? "buy" : receiptNote ? "sell" : tx.type === "buy" ? "sell" : "buy";
    const warning = mismatchWarnings(tx, order, expected);
    // Only the *exact* generated phrase can be replaced wholesale. A person's
    // appended comments (even before the tag) must not disappear.
    const generated = note.trim() === `${debitNote ? "برداشت برای خرید بورس" : "واریز حاصل فروش بورس"} / ${order.symbol} ${stockTag[0]}`;
    if ((debitNote || receiptNote) && generated) {
      return `${receiptNote ? "واریز حاصل از " : "برداشت بابت "}${summary}${warning}`;
    }
    note = note.replace(stockTag[0], `(سفارش مرتبط: ${summary}${warning})`);
  }

  const certificateTag = note.match(/\[deposit-trade:([^\]\s]+)\]/);
  if (certificateTag) {
    const trades = data.transactions.filter((item) => item.id === certificateTag[1]);
    const trade = trades.length === 1 ? trades[0] : undefined;
    const summary = trade && transactionSummary(data, trade);
    if (!summary) return note.replace(certificateTag[0], "(معاملهٔ مرتبط پیدا نشد یا اطلاعاتش ناقص است؛ بررسی کنید)");
    const debitNote = /^\s*برداشت بابت خرید گواهی سپرده/.test(note);
    const warning = mismatchWarnings(tx, trade, debitNote ? "buy" : tx.type === "buy" ? "sell" : "buy");
    const assetName = data.assets.find((asset) => asset.id === trade.assetId)?.name;
    const generated = note.trim() === `برداشت بابت خرید گواهی سپرده ${certificateTag[0]}` ||
      Boolean(assetName && note.trim() === `برداشت بابت خرید گواهی سپرده ${assetName} ${certificateTag[0]}`);
    if (debitNote && generated) {
      return `برداشت بابت ${summary}${warning}`;
    }
    note = note.replace(certificateTag[0], `(معاملهٔ مرتبط: ${summary}${warning})`);
  }
  return note;
}
