import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionsView } from "../components/Views";
import { analyzeCapital } from "./capitalReport";
import type { CapitalReport } from "./capitalReport";
import { emptyData, metricsAt } from "./portfolio";
import { indexTransactionReviews } from "./transactionReviews";
import type { Asset, PortfolioData, Transaction } from "./types";

const asOf = "2026-11-11";
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#777", createdAt: asOf };
const hami: Asset = { id: "hami", name: "حامی", category: "نقد", currentPrice: 1, color: "#377", createdAt: asOf };
const kian: Asset = { id: "kian", name: "کیان", category: "نقد", currentPrice: 1, color: "#734", createdAt: asOf };
function tx(id: string, assetId: string, type: "buy" | "sell", amount: number,
  date: string, extra: Partial<Transaction> = {}): Transaction {
  return { id, assetId, type, quantity: amount, unitPrice: 1, totalPrice: amount,
    date, createdAt: `${date}T10:00:00Z`, attachmentIds: [], ...extra };
}
function report(data: PortfolioData) {
  const metrics = metricsAt(data.assets, data.transactions, data.prices);
  return analyzeCapital(data, metrics.reduce((sum, item) => sum + item.marketValue, 0),
    metrics.reduce((sum, item) => sum + item.totalProfit, 0), asOf);
}
function renderLedger(data: PortfolioData, capitalReport: CapitalReport) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(TransactionsView, {
    data, capitalReport, onAdd: noop, onEdit: noop, onDelete: noop,
    onCsv: noop, onPdf: noop, onStockImport: noop, onEditStockOrder: noop,
  }));
}
function rowFor(markup: string, text: string) {
  const row = [...markup.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)]
    .map((match) => match[0]).find((html) => html.includes(text));
  assert.ok(row, `ledger row containing ${text} exists`);
  return row;
}

test("only exact transaction and stock-order targets are marked, with all reasons and the highest severity", () => {
  const index = indexTransactionReviews({ cashShortfalls: [], issues: [
    { id: "one", severity: "warning", title: "حساب نامعلوم", detail: "بررسی شود", target: { type: "transaction", id: "shared" } },
    { id: "two", severity: "error", title: "تاریخ نادرست", detail: "اصلاح شود", target: { type: "transaction", id: "shared" } },
    { id: "three", severity: "warning", title: "سفارش نامعلوم", detail: "بررسی شود", target: { type: "stockOrder", id: "shared" } },
    { id: "four", severity: "error", title: "قیمت روز", detail: "ثبت شود", target: { type: "price", id: "gold" } },
    { id: "five", severity: "error", title: "سود مجمع", detail: "تطبیق شود", target: { type: "dividend", id: "dividend" } },
    { id: "six", severity: "error", title: "دارایی", detail: "بررسی شود", target: { type: "asset", id: "gold" } },
  ] });
  assert.deepEqual(index.transactions.get("shared")?.issues.map((issue) => issue.title), ["تاریخ نادرست", "حساب نامعلوم"]);
  assert.equal(index.transactions.get("shared")?.severity, "error");
  assert.equal(index.stockOrders.get("shared")?.severity, "warning");
  assert.equal(index.transactions.size, 1);
  assert.equal(index.stockOrders.size, 1);
});

test("several plausible withdrawals are all review leads; the representative is not labelled a proven error", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank, hami, kian], transactions: [
    tx("opening", "bank", "buy", 80, "2026-10-01", { kind: "opening_capital" }),
    tx("to-hami", "bank", "sell", 60, "2026-10-02", { kind: "transfer", linkedTransactionId: "in-hami", notes: "انتقال به حامی" }),
    tx("in-hami", "hami", "buy", 60, "2026-10-02", { kind: "transfer", linkedTransactionId: "to-hami", notes: "واریز حامی" }),
    tx("to-kian", "bank", "sell", 50, "2026-10-02", { kind: "transfer", linkedTransactionId: "in-kian", notes: "انتقال به کیان" }),
    tx("in-kian", "kian", "buy", 50, "2026-10-02", { kind: "transfer", linkedTransactionId: "to-kian" }),
  ] };
  const before = JSON.stringify(data);
  const audit = report(data);
  assert.equal(audit.cashShortfalls[0].attributionCandidates.length, 2);
  assert.ok(audit.issues.some((issue) => issue.id === "negative-bank" && issue.severity === "error"));
  const indexed = indexTransactionReviews(audit);
  for (const id of ["to-hami", "to-kian"]) {
    const review = indexed.transactions.get(id);
    assert.equal(review?.severity, "warning");
    assert.match(review?.issues[0].title || "", /چند برداشت هم‌روز/);
    assert.match(review?.issues[0].detail || "", /نمی‌توان معلوم کرد/);
    assert.doesNotMatch(review?.issues[0].detail || "", /to-hami|to-kian/);
  }
  assert.equal(indexed.transactions.get("in-hami"), undefined);
  const markup = renderLedger(data, audit);
  for (const note of ["انتقال به حامی", "انتقال به کیان"]) {
    const row = rowFor(markup, note);
    assert.match(row, /class="transaction-review-row warning"/);
    assert.match(row, /چند برداشت هم‌روز/);
    assert.match(row, /title="ویرایش تراکنش"[^>]*>بررسی و ویرایش<\/button>/);
  }
  assert.doesNotMatch(rowFor(markup, "واریز حامی"), /transaction-review-row/);
  assert.equal(JSON.stringify(data), before);
  assert.equal(audit.issues.find((issue) => issue.id === "negative-bank")?.severity, "error");
});

test("a uniquely necessary shortfall remains on its real debit, without flagging the matching receipt", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank, hami], transactions: [
    tx("out", "bank", "sell", 120, "2026-10-02", { kind: "transfer", linkedTransactionId: "in" }),
    tx("in", "hami", "buy", 120, "2026-10-02", { kind: "transfer", linkedTransactionId: "out", notes: "دریافت وجه حامی" }),
  ] };
  const audit = report(data);
  assert.deepEqual(audit.cashShortfalls[0].attributionCandidates, ["out"]);
  const indexed = indexTransactionReviews(audit);
  assert.equal(indexed.transactions.get("out")?.severity, "error");
  assert.ok(indexed.transactions.get("out")?.issues.some((issue) => issue.title.includes("ماندهٔ منفی")));
  assert.equal(indexed.transactions.get("in"), undefined);
  const markup = renderLedger(data, audit);
  assert.match(rowFor(markup, "ماندهٔ منفی بانک"), /class="transaction-review-row error"/);
  assert.doesNotMatch(rowFor(markup, "دریافت وجه حامی"), /transaction-review-row/);
});

test("ledger rows display only their own review, reasons, and an inline edit action", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank, hami], transactions: [
    tx("bad", "bank", "sell", 80, "2026-10-01", { notes: "برداشت نیازمند اصلاح" }),
    tx("shared", "bank", "buy", 30, "2026-10-02", { notes: "رسید با شناسهٔ مشترک" }),
    tx("clean", "bank", "buy", 25, "2026-10-03", { notes: "ردیف بدون هشدار" }),
    tx("settlement", "hami", "sell", 40, "2026-10-03", {
      notes: "برداشت تسویه [stock-order:shared]", kind: "transfer",
    }),
  ], stockOrders: [
    { id: "shared", symbol: "وآذر", type: "buy", quantity: 4, unitPrice: 10,
      totalPrice: 40, date: "2026-10-03", sourceAssetId: "hami", notes: "سفارش با شناسهٔ مشترک" },
  ] };
  const base = report(data);
  const capitalReport: CapitalReport = { ...base, cashShortfalls: [], issues: [
    { id: "missing-pair", severity: "warning", title: "بررسی سند", detail: "حساب بانکی را تطبیق دهید.", target: { type: "transaction", id: "bad" } },
    { id: "bad-amount", severity: "error", title: "مبلغ نادرست", detail: "مبلغ این ردیف را با سند اصلاح کنید.", target: { type: "transaction", id: "bad" } },
    { id: "uncertain", severity: "warning", title: "منبع نامعلوم", detail: "درستی منبع این واریز را بررسی کنید.", target: { type: "transaction", id: "shared" } },
    { id: "order-date", severity: "error", title: "تاریخ سفارش", detail: "تاریخ سفارش را اصلاح کنید.", target: { type: "stockOrder", id: "shared" } },
    { id: "quote", severity: "error", title: "قیمت روز", detail: "نرخ جدید را ثبت کنید.", target: { type: "price", id: "bank" } },
  ] };
  const before = JSON.stringify(data);
  const markup = renderLedger(data, capitalReport);
  assert.match(markup, /۲ ردیف با خطای کنترلی/);
  assert.match(markup, /۱ ردیف نیازمند بررسی/);
  const bad = rowFor(markup, "برداشت نیازمند اصلاح");
  assert.match(bad, /class="transaction-review-row error"/);
  assert.match(bad, /خطای کنترلی/);
  assert.match(bad, /مبلغ نادرست/);
  assert.match(bad, /بررسی سند/);
  assert.match(bad, /مبلغ این ردیف را با سند اصلاح کنید/);
  assert.match(bad, /<summary>دلیل و راهنمای بررسی<\/summary>/);
  assert.match(bad, /title="ویرایش تراکنش"[^>]*>بررسی و ویرایش<\/button>/);
  assert.match(bad, /aria-label="بررسی و ویرایش معاملهٔ بانک: مبلغ نادرست"/);
  assert.match(bad, /ویرایش همین ردیف/);
  const warning = rowFor(markup, "رسید با شناسهٔ مشترک");
  assert.match(warning, /class="transaction-review-row warning"/);
  assert.match(warning, /ویرایش همین ردیف/);
  const stock = rowFor(markup, "سفارش با شناسهٔ مشترک");
  assert.match(stock, /class="transaction-review-row error"/);
  assert.match(stock, /تاریخ سفارش/);
  assert.match(stock, /title="ویرایش این سفارش سهام"[^>]*>بررسی و ویرایش<\/button>/);
  assert.match(stock, /aria-label="بررسی و ویرایش سفارش بورس \(وآذر\): تاریخ سفارش"/);
  assert.match(stock, /ویرایش همین سفارش/);
  assert.doesNotMatch(stock, /منبع نامعلوم/);
  assert.doesNotMatch(rowFor(markup, "برداشت تسویه"), /transaction-review-row|ویرایش همین ردیف/);
  assert.doesNotMatch(rowFor(markup, "ردیف بدون هشدار"), /transaction-review-row|ویرایش همین ردیف/);
  assert.doesNotMatch(markup, /نرخ جدید را ثبت کنید/);
  assert.equal(JSON.stringify(data), before);
});

test("a marked generated cash settlement points to its stock order, even outside Hami", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank, hami], transactions: [
    tx("hami-stock-buy-order", "bank", "sell", 40, "2026-10-02", {
      kind: "transfer", notes: "برداشت برای خرید بورس / وبملت [stock-order:order]",
    }),
  ], stockOrders: [
    { id: "order", symbol: "وبملت", type: "buy", quantity: 4, unitPrice: 10,
      totalPrice: 40, date: "2026-10-02", sourceAssetId: "bank" },
  ] };
  const capitalReport: CapitalReport = { ...report(data), cashShortfalls: [], issues: [
    { id: "stock-pair", severity: "error", title: "تسویه نیازمند بررسی", detail: "سفارش را با سند تطبیق دهید.", target: { type: "transaction", id: "hami-stock-buy-order" } },
  ] };
  const markup = renderLedger(data, capitalReport);
  const cash = rowFor(markup, "برداشت بابت خرید");
  assert.match(cash, /class="transaction-review-row error"/);
  assert.match(cash, /aria-label="بررسی و ویرایش سفارش مرتبط با بانک: تسویه نیازمند بررسی"/);
  assert.match(cash, /ویرایش سفارش مرتبط/);
  assert.match(cash, /title="حذف سفارش بورس و تسویهٔ مرتبط، پس از تأیید"/);
  assert.doesNotMatch(rowFor(markup, "بورس (وبملت)"), /transaction-review-row/);
});

test("duplicate ledger IDs remain visible but cannot be edited or deleted as if unique", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank], transactions: [
    tx("same", "bank", "buy", 100, "2026-10-01", { notes: "ورودی اول" }),
    tx("same", "bank", "buy", 200, "2026-10-02", { notes: "ورودی دوم" }),
  ] };
  const markup = renderLedger(data, report(data));
  for (const note of ["ورودی اول", "ورودی دوم"]) {
    const row = rowFor(markup, note);
    assert.match(row, /class="transaction-review-row error"/);
    assert.match(row, /شناسهٔ تکراری/);
    assert.match(row, /ویرایش یا حذف تکی امن نیست/);
    assert.doesNotMatch(row, /ویرایش همین ردیف/);
    assert.match(row, /disabled=""/);
  }
});

test("duplicate review copy is readable without changing the audit's original diagnostic IDs", () => {
  const data: PortfolioData = { ...emptyData(), assets: [bank], transactions: [
    tx("suspect", "bank", "buy", 100, "2026-10-01", { notes: "واریز مورد بررسی" }),
  ] };
  const audit: CapitalReport = { ...report(data), cashShortfalls: [], issues: [
    { id: "cash-duplicate-suspect", severity: "error", title: "دو ثبت وجه برای یک معامله دیده شد",
      detail: "ردیف‌های tx-opaque-987 و suspect یکسان‌اند؛ تغییر ماهیت به‌تنهایی آن‌ها را حذف نمی‌کند.",
      target: { type: "transaction", id: "suspect" } },
  ] };
  const markup = rowFor(renderLedger(data, audit), "واریز مورد بررسی");
  assert.match(markup, /دو گردش وجه در یک حساب/);
  assert.match(markup, /تغییر ماهیت به‌تنهایی/);
  assert.doesNotMatch(markup, /tx-opaque-987/);
  assert.match(audit.issues[0].detail, /tx-opaque-987/);
});
