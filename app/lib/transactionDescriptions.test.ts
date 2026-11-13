import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetTransactionsModal, TransactionModal } from "../components/Modals";
import { TransactionsView } from "../components/Views";
import { CapitalHealthPanel } from "../components/CapitalHealthPanel";
import { analyzeCapital } from "./capitalReport";
import { emptyData, toPersianDate } from "./portfolio";
import { latestPortfolioData } from "./sample";
import { describeTransactionNote } from "./transactionDescriptions";
import { linkedTransactions, upsertTransaction } from "./transactionLinks";
import type { Asset, PortfolioData, Transaction } from "./types";

const date = "2026-05-02";
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", unit: "گرم", currentPrice: 1, color: "#aa0", createdAt: date };
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", unit: "تومان", currentPrice: 1, color: "#00a", createdAt: date };
function tx(id: string, assetId: string, type: "buy" | "sell", quantity: number, unitPrice: number, notes = "", txDate = date): Transaction {
  return { id, assetId, type, quantity, unitPrice, totalPrice: quantity * unitPrice,
    date: txDate, notes, createdAt: `${date}T08:00:00Z`, attachmentIds: [] };
}
function ledger(transactions: Transaction[], orders: PortfolioData["stockOrders"] = []): PortfolioData {
  return { ...emptyData(), assets: [gold, bank], transactions, stockOrders: orders };
}

test("an old receipt names the actual referenced sale, quantity, unit price, Jalali date and total", () => {
  const sale = tx("tx-1792842034739-lmay0w", "gold", "sell", 50, 21_450_000);
  const receipt = tx("bank-in", "bank", "buy", 1_072_500_000, 1,
    `واریز حاصل از معامله ${sale.id}`);
  const data = ledger([sale, receipt]);
  const before = JSON.stringify(data);
  assert.equal(toPersianDate(date), "۱۴۰۵/۰۲/۱۲");
  assert.equal(describeTransactionNote(data, receipt),
    "واریز حاصل از فروش ۵۰ گرم طلا به قیمت هر گرم ۲۱٬۴۵۰٬۰۰۰ تومان در تاریخ ۱۴۰۵/۰۲/۱۲، جمعاً ۱٬۰۷۲٬۵۰۰٬۰۰۰ تومان");
  assert.equal(receipt.notes, `واریز حاصل از معامله ${sale.id}`);
  assert.equal(JSON.stringify(data), before);
});

test("generated debit points to the referenced purchase; personal notes and extra text survive", () => {
  const purchase = tx("tx-12", "gold", "buy", 1.25, 200);
  const debit = tx("bank-out", "bank", "sell", 250, 1,
    "برداشت بابت معامله tx-12\nرسید کاغذی پیش من است");
  const other = tx("other", "bank", "buy", 10, 1, "فاکتور tx-123 از فروشنده گرفتم");
  const data = ledger([purchase, debit, other]);
  assert.equal(describeTransactionNote(data, debit),
    "برداشت بابت خرید ۱٫۲۵ گرم طلا به قیمت هر گرم ۲۰۰ تومان در تاریخ ۱۴۰۵/۰۲/۱۲، جمعاً ۲۵۰ تومان\nرسید کاغذی پیش من است");
  assert.equal(describeTransactionNote(data, other), other.notes);
});

test("a reference is not proof of payment: mismatches, missing trades and duplicate ids are not invented", () => {
  const sale = tx("tx-123", "gold", "sell", 2, 100);
  const receipt = tx("receipt", "bank", "buy", 999, 1,
    "واریز حاصل از معامله tx-123", "2026-05-03");
  const data = ledger([sale, receipt]);
  const display = describeTransactionNote(data, receipt);
  assert.match(display, /فروش ۲ گرم طلا/);
  assert.match(display, /مبلغ دو ردیف متفاوت است/);
  assert.match(display, /تاریخ دو ردیف متفاوت است/);
  const unknown = { ...receipt, notes: "واریز حاصل از معامله tx-1234" };
  const missing = describeTransactionNote(data, unknown);
  assert.match(missing, /ردیف مرتبطِ یکتای آن در اطلاعات پیدا نشد/);
  assert.doesNotMatch(missing, /فروش ۲ گرم طلا/);
  const duplicates = ledger([sale, { ...sale }, receipt]);
  assert.match(describeTransactionNote(duplicates, receipt), /ردیف مرتبطِ یکتای آن در اطلاعات پیدا نشد/);
  const badPrice = ledger([{ ...sale, unitPrice: Number.NaN }, receipt]);
  assert.match(describeTransactionNote(badPrice, receipt), /اطلاعات ناقص/);
  const ambiguousAsset = { ...data, assets: [gold, { ...gold, name: "دارایی دیگر" }, bank] };
  assert.match(describeTransactionNote(ambiguousAsset, receipt), /اطلاعات ناقص/);
});

test("stock-order and commodity-trade tags show their real order without changing stored markers", () => {
  const order = { id: "stock-123", symbol: "وآذر", type: "buy" as const,
    quantity: 10, unitPrice: 500, totalPrice: 5_000, date };
  const settlement = tx("hami-stock-buy-stock-123", "bank", "sell", 5_000, 1,
    "برداشت برای خرید بورس / وآذر [stock-order:stock-123]");
  const purchase = tx("tx-12", "gold", "buy", 1, 500);
  const certificate = tx("certificate-cash", "bank", "sell", 500, 1,
    "برداشت بابت خرید گواهی سپرده [deposit-trade:tx-12]");
  const data = ledger([settlement, purchase, certificate], [order]);
  assert.match(describeTransactionNote(data, settlement), /^برداشت بابت خرید ۱۰ سهم وآذر به قیمت هر سهم ۵۰۰ تومان/);
  assert.doesNotMatch(describeTransactionNote(data, settlement), /stock-123/);
  assert.match(describeTransactionNote(data, certificate), /^برداشت بابت خرید ۱ گرم طلا به قیمت هر گرم ۵۰۰ تومان/);
  assert.equal(settlement.notes, "برداشت برای خرید بورس / وآذر [stock-order:stock-123]");
  assert.equal(certificate.notes, "برداشت بابت خرید گواهی سپرده [deposit-trade:tx-12]");
  const orphan = ledger([settlement], []);
  assert.match(describeTransactionNote(orphan, settlement), /سفارش مرتبط پیدا نشد/);
});

test("manual text before a technical tag survives, and inconsistent directions or account links need review", () => {
  const order = { id: "order-a", symbol: "وآذر", type: "buy" as const, quantity: 10,
    unitPrice: 500, totalPrice: 5_000, date, sourceAssetId: "different-account" };
  const bankOut = tx("settlement", "bank", "buy", 5_000, 1,
    "برداشت برای خرید بورس / وآذر · رسید کاغذی [stock-order:order-a]");
  const purchase = { ...tx("purchase", "gold", "sell", 1, 500), linkedTransactionId: "different-account" };
  const certificate = tx("certificate", "bank", "sell", 500, 1,
    "برداشت بابت خرید گواهی سپرده · رسید کاغذی [deposit-trade:purchase]");
  const data = ledger([bankOut, purchase, certificate], [order]);
  const stockNote = describeTransactionNote(data, bankOut);
  assert.match(stockNote, /رسید کاغذی/);
  assert.match(stockNote, /خرید ۱۰ سهم وآذر/);
  assert.match(stockNote, /جهت گردش پول با این یادداشت نمی‌خواند/);
  assert.match(stockNote, /حساب تسویهٔ معامله با این ردیف متفاوت است/);
  assert.doesNotMatch(stockNote, /stock-order:order-a/);
  const certificateNote = describeTransactionNote(data, certificate);
  assert.match(certificateNote, /رسید کاغذی/);
  assert.match(certificateNote, /جهت معامله با این یادداشت نمی‌خواند/);
  assert.match(certificateNote, /ردیف معامله به گردش پول دیگری پیوند دارد/);
  assert.doesNotMatch(certificateNote, /deposit-trade:purchase/);
});

test("the linked pair remains intact when descriptions are read or the sale is edited", () => {
  const sale = { ...tx("sale", "gold", "sell", 2, 100),
    destinationAssetId: "bank", kind: "trade" as const, linkedTransactionId: "cash" };
  const cash = { ...tx("cash", "bank", "buy", 200, 1, "واریز حاصل از معامله sale"),
    kind: "transfer" as const, linkedTransactionId: "sale" };
  const data = ledger([sale, cash]);
  assert.deepEqual(linkedTransactions(data, sale).map((row) => row.id), ["cash"]);
  assert.match(describeTransactionNote(data, cash), /فروش ۲ گرم طلا/);
  const edited = upsertTransaction(data, { ...sale, quantity: 3, totalPrice: 300 }, []);
  const updatedCash = edited.transactions.find((row) => row.id === "cash")!;
  assert.equal(updatedCash.notes, "واریز حاصل از معامله sale");
  assert.deepEqual(linkedTransactions(edited, edited.transactions.find((row) => row.id === "sale")!).map((row) => row.id), ["cash"]);
  assert.match(describeTransactionNote(edited, updatedCash), /فروش ۳ گرم طلا/);
  assert.match(describeTransactionNote(edited, updatedCash), /۳۰۰ تومان/);
  assert.equal(cash.notes, "واریز حاصل از معامله sale");
});

test("sample certificate and stock settlement descriptions resolve without modifying the sample", () => {
  const data = latestPortfolioData;
  const before = JSON.stringify(data);
  const copper = data.transactions.find((row) => row.id === "cert-cash-copper-1")!;
  const stock = data.transactions.find((row) => row.notes?.includes("[stock-order:"))!;
  assert.match(describeTransactionNote(data, copper), /خرید ۸۲۸ کیلوگرم مس/);
  assert.doesNotMatch(describeTransactionNote(data, copper), /deposit-trade:tx-/);
  assert.match(describeTransactionNote(data, stock), /(?:خرید|فروش) [۰-۹٬]+ سهم/);
  assert.doesNotMatch(describeTransactionNote(data, stock), /stock-order:stock-order-/);
  assert.equal(JSON.stringify(data), before);
});

test("transaction list, account history and editor show readable details, keeping the stored id in the collapsed technical field", () => {
  const sale = tx("tx-1792842034739-lmay0w", "gold", "sell", 50, 21_450_000);
  const receipt = tx("bank-in", "bank", "buy", 1_072_500_000, 1, `واریز حاصل از معامله ${sale.id}`);
  const data = ledger([sale, receipt]);
  const noop = () => {};
  const list = renderToStaticMarkup(createElement(TransactionsView, {
    data, capitalReport: analyzeCapital(data, 0, 0, date),
    onAdd: noop, onEdit: noop, onDelete: noop, onCsv: noop, onPdf: noop, onStockImport: noop,
  }));
  assert.match(list, /واریز حاصل از فروش ۵۰ گرم طلا/);
  assert.doesNotMatch(list, /واریز حاصل از معامله tx-/);
  const history = renderToStaticMarkup(createElement(AssetTransactionsModal, {
    asset: bank, data, transactions: data.transactions, onClose: noop,
  }));
  assert.match(history, /واریز حاصل از فروش ۵۰ گرم طلا/);
  assert.doesNotMatch(history, /واریز حاصل از معامله tx-/);
  const editor = renderToStaticMarkup(createElement(TransactionModal, {
    data, editing: receipt, onClose: noop, onSave: noop,
  }));
  assert.match(editor, /شرح معاملهٔ مرتبط/);
  assert.match(editor, /واریز حاصل از فروش ۵۰ گرم طلا/);
  assert.match(editor, /<details class="transaction-technical-note">/);
  assert.match(editor, /<textarea[^>]*>واریز حاصل از معامله tx-1792842034739-lmay0w<\/textarea>/);
});

test("cash shortfall guidance uses the readable trade description without rewriting the audit", () => {
  const purchase = { ...tx("purchase", "gold", "buy", 2, 100),
    kind: "trade" as const, sourceAssetId: "bank", linkedTransactionId: "debit" };
  const debit = { ...tx("debit", "bank", "sell", 200, 1, "برداشت بابت معامله purchase"),
    kind: "transfer" as const, linkedTransactionId: "purchase" };
  const data = ledger([purchase, debit]);
  const report = analyzeCapital(data, 0, 0, date);
  assert.equal(report.cashShortfalls.length, 1);
  assert.equal(report.cashShortfalls[0].triggerDescription, debit.notes);
  const noop = () => {};
  const markup = renderToStaticMarkup(createElement(CapitalHealthPanel, {
    report, data, onResolve: noop, onRegisterCapital: noop, onShowTransactions: noop,
  }));
  assert.match(markup, /برداشت بابت خرید ۲ گرم طلا/);
  assert.doesNotMatch(markup, /برداشت بابت معامله purchase/);
  assert.equal(debit.notes, "برداشت بابت معامله purchase");
});
