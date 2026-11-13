import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCapital } from "./capitalReport";
import { removeTransaction, upsertTransaction } from "./transactionLinks";
import { emptyData, getMonthlyCashFlows, metricsAt, migrateKianStockData, portfolioTimeline, stockMetrics, syncStockCashTransfers, transactionLabel } from "./portfolio";
import type { Asset, PortfolioData, StockOrder, Transaction } from "./types";

const asOf = "2026-11-11";
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: asOf };
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 70, color: "#b83", createdAt: asOf };
const hami: Asset = { id: "hami", name: "صندوق حامی", category: "صندوق درآمد ثابت", currentPrice: 1, color: "#184", createdAt: asOf };
const bourse: Asset = { id: "bourse", name: "بورس", category: "بورس", currentPrice: 0, color: "#34a", createdAt: asOf };
function data(assets: Asset[], transactions: Transaction[], stockOrders: StockOrder[] = []): PortfolioData {
  return { ...emptyData(), assets, transactions, stockOrders };
}
function tx(id: string, assetId: string, type: "buy" | "sell", amount: number, options: Partial<Transaction> = {}): Transaction {
  return {
    id, assetId, type, quantity: amount, unitPrice: 1, totalPrice: amount,
    date: "2026-11-01", createdAt: "2026-11-01T10:00:00Z", attachmentIds: [], ...options,
  };
}
function evaluate(d: PortfolioData) {
  const metrics = metricsAt(d.assets, d.transactions, d.prices);
  const stocks = stockMetrics(d.stockOrders, d.stockPrices, d.stockDividends);
  const currentValue = metrics.filter((item) => item.asset.name !== "بورس")
    .reduce((sum, item) => sum + item.marketValue, 0) + stocks.reduce((sum, item) => sum + item.value, 0);
  const profit = metrics.filter((item) => item.asset.name !== "بورس")
    .reduce((sum, item) => sum + item.totalProfit, 0) + stocks.reduce((sum, item) => sum + item.profit, 0);
  return analyzeCapital(d, currentValue, profit, asOf);
}

test("opening money, internal purchases and later withdrawals reconcile without counting transfers as capital", () => {
  const d = data([bank, gold], [
    tx("opening", bank.id, "buy", 1000, { kind: "opening_capital" }),
    tx("trade", gold.id, "buy", 10, { quantity: 10, unitPrice: 60, totalPrice: 600, kind: "trade", sourceAssetId: bank.id, linkedTransactionId: "cash" }),
    tx("cash", bank.id, "sell", 600, { kind: "transfer", linkedTransactionId: "trade" }),
    tx("later", bank.id, "buy", 50, { kind: "capital_in" }),
    tx("withdraw", bank.id, "sell", 100, { kind: "capital_out", date: "2026-11-02" }),
  ]);
  const report = evaluate(d);
  assert.equal(report.initialCapital, 1000);
  assert.equal(report.additionalCapital, 50);
  assert.equal(report.withdrawals, 100);
  assert.equal(report.netCapital, 950);
  assert.equal(report.currentValue, 1050); // cash 350 + gold 700
  assert.equal(report.estimatedProfit, 100);
  assert.equal(report.profitGap, 0);
  assert.equal(report.flows.length, 3);
  assert.equal(report.isReliable, true);
});

test("an old cash transfer with a uniquely matched unclassified leg is a review warning, not a missing receipt", () => {
  const deposit = tx("deposit", hami.id, "buy", 100, { sourceAssetId: bank.id });
  const cash = tx("cash", bank.id, "sell", 100, { kind: "transfer", notes: "برداشت بابت معامله deposit" });
  const d = data([bank, hami], [tx("opening", bank.id, "buy", 1000, { kind: "opening_capital", date: "2026-10-01" }), deposit, cash]);
  const before = evaluate(d);
  assert.equal(before.currentValue, 1000);
  assert.equal(before.estimatedProfit, 0);
  assert.ok(before.issues.some((issue) => issue.id === "cash-unclassified-link-deposit" && issue.severity === "warning"));
  assert.ok(!before.issues.some((issue) => issue.id === "transfer-cash" || issue.id === "cash-kind-deposit"));
  assert.equal(before.isReliable, false); // owner still has to confirm the classification
  const corrected = upsertTransaction(d, { ...deposit, kind: "trade" }, []);
  assert.equal(evaluate(corrected).isReliable, true);
  assert.equal(evaluate(corrected).currentValue, 1000);
});

test("two same-day cash receipts for one trade are shown rather than silently dropped or made into funding", () => {
  const d = data([bank, gold], [
    tx("purchase", gold.id, "buy", 100, { kind: "opening_capital", date: "2026-10-01" }),
    tx("sale", gold.id, "sell", 100, { destinationAssetId: bank.id, kind: "trade", linkedTransactionId: "new-receipt" }),
    tx("old-receipt", bank.id, "buy", 100, { notes: "واریز حاصل از معامله sale" }),
    tx("new-receipt", bank.id, "buy", 100, { kind: "transfer", linkedTransactionId: "sale", notes: "واریز حاصل از معامله sale" }),
  ]);
  const original = JSON.stringify(d);
  const report = evaluate(d);
  assert.equal(report.currentValue, 200); // both credits are still visible in the ledger
  assert.ok(report.issues.some((issue) => issue.id === "cash-duplicate-old-receipt" && issue.severity === "error"));
  assert.ok(report.issues.some((issue) => issue.id === "cash-kind-old-receipt"));
  assert.equal(JSON.stringify(d), original); // audit is read-only
  const oneReceipt = removeTransaction(d, d.transactions[2]);
  assert.deepEqual(oneReceipt.transactions.map((item) => item.id), ["purchase", "sale", "new-receipt"]);
  assert.ok(!evaluate(oneReceipt).issues.some((issue) => issue.id.startsWith("cash-duplicate-")));
});

test("an unlinked legacy purchase is an assumption, NOT initial money; editing its kind resolves it", () => {
  const purchase = tx("buy", gold.id, "buy", 100, { quantity: 10, unitPrice: 10 });
  const d = data([{ ...gold, currentPrice: 12 }], [purchase]);
  const before = evaluate(d);
  assert.equal(before.initialCapital, null);
  assert.equal(before.possibleDeposits, 100);
  assert.equal(before.estimatedProfit, 20);
  assert.ok(before.issues.some((issue) => issue.id === "external-buy" && issue.target.type === "transaction"));
  assert.equal(before.isReliable, false);
  const after = evaluate({ ...d, transactions: [{ ...purchase, kind: "opening_capital" }] });
  assert.equal(after.initialCapital, 100);
  assert.equal(after.possibleDeposits, 0);
  assert.equal(after.recordedProfit, 20);
  assert.equal(after.isReliable, true);
});

test("an unknown balance correction stays unknown; negative cash is visible rather than clamped to zero", () => {
  const d = data([bank], [tx("debit", bank.id, "sell", 200, { kind: "balance_adjustment" })]);
  const before = evaluate(d);
  assert.equal(before.currentValue, -200);
  assert.equal(before.initialCapital, null);
  assert.ok(before.issues.some((issue) => issue.id === "adjustment-debit"));
  assert.ok(before.issues.some((issue) => issue.id === "negative-bank"));
  const opening = tx("opening", bank.id, "buy", 300, { kind: "opening_capital", date: "2026-10-01" });
  const after = evaluate(data([bank], [opening, { ...d.transactions[0], kind: "capital_out" }]));
  assert.equal(after.currentValue, 100);
  assert.equal(after.initialCapital, 300);
  assert.equal(after.withdrawals, 200);
  assert.equal(after.isReliable, true);
});

test("the word 'سود' in the source of an outside deposit is not treated as interest", () => {
  const opening = tx("opening", bank.id, "buy", 200, { kind: "opening_capital", notes: "سرمایه اولیه از سود کسب‌وکار" });
  const interest = tx("interest", bank.id, "buy", 10, { kind: "interest", notes: "واریز سود" });
  const d = data([bank], [opening, interest]);
  assert.equal(transactionLabel(opening, bank), "سرمایه اولیه");
  assert.equal(metricsAt(d.assets, d.transactions)[0].totalProfit, 10);
  assert.equal(evaluate(d).isReliable, true);
});

test("stock settlements are internal; pending dividends bridge current value and accounting profit", () => {
  const order: StockOrder = { id: "stock1", symbol: "آزمایش", type: "buy", quantity: 10, unitPrice: 50, totalPrice: 500, date: "2026-11-02", sourceAssetId: hami.id };
  const transactions = [
    tx("opening", bank.id, "buy", 1000, { kind: "opening_capital", date: "2026-11-01" }),
    tx("move-out", bank.id, "sell", 500, { kind: "transfer", linkedTransactionId: "move-in", date: "2026-11-02" }),
    tx("move-in", hami.id, "buy", 500, { kind: "transfer", linkedTransactionId: "move-out", date: "2026-11-02" }),
  ];
  const d = data([bank, hami, bourse], transactions, [order]);
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  d.stockPrices = [{ id: "price", symbol: "آزمایش", date: "2026-11-10", price: 55 }];
  d.stockDividends = [{ id: "div", symbol: "آزمایش", amount: 10, date: "2026-11-10", status: "pending" }];
  const report = evaluate(d);
  assert.equal(report.currentValue, 1050); // bank 500 + shares 550, pending is a receivable
  assert.equal(report.recordedProfit, 60);
  assert.equal(report.pendingDividends, 10);
  assert.equal(report.estimatedProfit, 60);
  assert.equal(report.isReliable, true);
});

test("an oversold position and a missing price are explicit, actionable issues", () => {
  const d = data([bank, { ...gold, currentPrice: 0 }], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("bought", gold.id, "buy", 10, { quantity: 1, unitPrice: 10, kind: "capital_in" }),
    tx("oversold", gold.id, "sell", 20, { quantity: 2, unitPrice: 10, kind: "capital_out", date: "2026-11-02" }),
  ]);
  const issues = evaluate(d).issues;
  assert.ok(issues.some((issue) => issue.id === "oversell-oversold" && issue.target.type === "transaction"));
  const order: StockOrder = { id: "missing", symbol: "بدون‌قیمت", type: "buy", quantity: 1, unitPrice: 10, totalPrice: 10, date: "2026-11-02", sourceAssetId: hami.id };
  const d2 = data([hami, bourse], [], [order]);
  assert.ok(evaluate(d2).issues.some((issue) => issue.id === "stock-price-بدون‌قیمت" && issue.target.type === "price"));
});

test("duplicate deposits are reported, not modified by the audit", () => {
  const d = data([bank], [
    tx("a", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("b", bank.id, "buy", 100, { kind: "opening_capital" }),
  ]);
  const snapshot = JSON.stringify(d);
  assert.ok(evaluate(d).issues.some((issue) => issue.id === "duplicate-b"));
  assert.equal(JSON.stringify(d), snapshot);
});

test("a paid stock dividend requires an explicitly linked receipt or confirmation it was paid outside", () => {
  const order: StockOrder = { id: "buy-stock", symbol: "آزمایش", type: "buy", quantity: 10, unitPrice: 50, totalPrice: 500, date: "2026-11-02", sourceAssetId: bank.id };
  const d = data([bank, bourse], [tx("opening", bank.id, "buy", 1000, { kind: "opening_capital" })], [order]);
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  d.stockPrices = [{ id: "price", symbol: "آزمایش", price: 50, date: "2026-11-10" }];
  d.stockDividends = [{ id: "div", symbol: "آزمایش", amount: 10, date: "2026-11-10", status: "paid" }];
  const unknown = evaluate(d);
  assert.equal(unknown.paidOutside, 10);
  assert.equal(unknown.estimatedProfit, 10);
  assert.equal(unknown.recordedProfit, 10);
  assert.ok(unknown.issues.some((issue) => issue.id === "dividend-unlocated-div"));
  assert.equal(unknown.isReliable, false); // A zero profit gap is NOT proof that the money left the portfolio.

  d.stockDividends[0].receivedOutside = true;
  assert.equal(evaluate(d).isReliable, true);
  d.stockDividends[0].receivedOutside = false;
  const receipt = tx("receipt", bank.id, "buy", 10, { date: "2026-11-10", kind: "stock_dividend", stockDividendId: "div" });
  d.transactions.push(receipt);
  const inside = evaluate(d);
  assert.equal(inside.paidOutside, 0);
  assert.equal(inside.currentValue, 1010);
  assert.equal(inside.recordedProfit, 10);
  assert.equal(inside.estimatedProfit, 10);
  assert.equal(inside.isReliable, true);
  d.transactions.push(tx("receipt-2", bank.id, "buy", 10, { date: "2026-11-11", kind: "stock_dividend", stockDividendId: "div" }));
  assert.ok(evaluate(d).issues.some((issue) => issue.id === "dividend-duplicate-div"));
});

test("a same-amount cash deposit is not automatically treated as a stock dividend receipt", () => {
  const d = data([bank], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("receipt", bank.id, "buy", 10, { date: "2026-11-10", kind: "interest" }),
  ]);
  d.stockDividends = [{ id: "div", symbol: "آزمایش", amount: 10, date: "2026-11-10", status: "paid" }];
  const report = evaluate(d);
  assert.equal(report.paidOutside, 10);
  assert.ok(report.issues.some((issue) => issue.id === "dividend-candidate-div" && issue.target.type === "transaction"));
  d.transactions[1] = { ...d.transactions[1], kind: "stock_dividend", stockDividendId: "div" };
  assert.equal(evaluate(d).paidOutside, 0);
});

test("explicitly missing stock account never falls back to Hami on reload", () => {
  const order: StockOrder = { id: "bad-account", symbol: "آزمایش", type: "buy", quantity: 1, unitPrice: 10, totalPrice: 10, date: "2026-11-02", sourceAssetId: "deleted-bank" };
  const d = data([bank, hami, bourse], [tx("opening", bank.id, "buy", 100, { kind: "opening_capital" })], [order]);
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  d.stockPrices = [{ id: "price", symbol: "آزمایش", price: 10, date: "2026-11-10" }];
  assert.equal(d.transactions.length, 1);
  const report = evaluate(d);
  assert.equal(report.possibleDeposits, 10);
  assert.ok(report.issues.some((issue) => issue.id === "order-account-bad-account"));
  assert.ok(report.issues.some((issue) => issue.id === "order-external-bad-account"));
});

test("future transactions do not change today's equity and are explicitly flagged", () => {
  const d = data([bank], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("future", bank.id, "sell", 1000, { kind: "capital_out", date: "2026-12-01" }),
  ]);
  assert.equal(metricsAt(d.assets, d.transactions, d.prices, asOf)[0].marketValue, 100);
  assert.equal(evaluate(d).withdrawals, 0);
  assert.ok(evaluate(d).issues.some((issue) => issue.id === "date-future"));
});

test("stale valuation and inconsistent stock order settlement require corrections", () => {
  const oldGold = { ...gold, createdAt: "2026-01-01" };
  const order: StockOrder = { id: "wrong-total", symbol: "آزمایش", type: "buy", quantity: 10, unitPrice: 50, totalPrice: 700, date: "2026-11-02", sourceAssetId: bank.id };
  const d = data([bank, oldGold, bourse], [
    tx("opening", bank.id, "buy", 1000, { kind: "opening_capital" }),
    tx("gold", oldGold.id, "buy", 10, { quantity: 1, unitPrice: 10, kind: "capital_in" }),
  ], [order]);
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  d.stockPrices = [{ id: "stock-price", symbol: "آزمایش", price: 50, date: "2026-11-10" }];
  const report = evaluate(d);
  assert.ok(report.issues.some((issue) => issue.id === "stale-gold"));
  assert.ok(report.issues.some((issue) => issue.id === "order-total-wrong-total"));
});

test("today's copy-trading balance is not backdated before its first deposit", () => {
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", color: "#397", currentPrice: 50,
    copyUsdBalance: 5, copyUsdRate: 50, createdAt: "2026-09-01" };
  const d = data([copy], [tx("first", copy.id, "buy", 100, {
    kind: "opening_capital", date: "2026-10-01", quantity: 2, unitPrice: 50,
  })]);
  assert.equal(metricsAt(d.assets, d.transactions, [], "2026-09-01")[0].marketValue, 0);
  assert.equal(metricsAt(d.assets, d.transactions, [], "2026-10-02")[0].marketValue, 100);
  assert.equal(metricsAt(d.assets, d.transactions)[0].marketValue, 250);
  assert.ok(evaluate(d).issues.some((issue) => issue.id === "copy-snapshot-copy"));
  d.assets[0].lastValuationAt = asOf;
  assert.ok(!evaluate(d).issues.some((issue) => issue.id === "copy-snapshot-copy"));
});

test("copy-trading or fixed-fund value without an opening transaction cannot be called profit", () => {
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", color: "#397", currentPrice: 50,
    copyUsdBalance: 5, copyUsdRate: 50, lastValuationAt: asOf, createdAt: asOf };
  const fixed: Asset = { id: "fixed", name: "صندوق درآمد ثابت", category: "صندوق درآمد ثابت", color: "#088", currentPrice: 1, createdAt: asOf };
  const d = data([bank, copy, fixed], [tx("opening", bank.id, "buy", 1000, { kind: "opening_capital" })]);
  d.prices = [{ id: "fixed-price", assetId: fixed.id, price: 100, date: asOf }];
  const report = evaluate(d);
  assert.ok(report.issues.some((issue) => issue.id === "copy-unfunded-copy"));
  assert.ok(report.issues.some((issue) => issue.id === "fixed-unfunded-fixed"));
  assert.equal(report.isReliable, false);
});

test("a future price is flagged and cannot override a past price in today's valuation", () => {
  const d = data([bank, gold], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("purchase", gold.id, "buy", 10, { quantity: 1, unitPrice: 10, kind: "capital_in" }),
  ]);
  d.prices = [
    { id: "today-price", assetId: gold.id, price: 70, date: asOf },
    { id: "future-price", assetId: gold.id, price: 1000, date: "2026-12-01" },
  ];
  assert.equal(metricsAt(d.assets, d.transactions, d.prices, asOf)[1].marketValue, 70);
  assert.ok(evaluate(d).issues.some((issue) => issue.id === "quote-date-future-price" && issue.target.type === "price"));
});

test("invalid calendar dates remain visible for correction but cannot enter balances or price history", () => {
  const d = data([bank, gold], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("bad", bank.id, "buy", 900, { kind: "capital_in", date: "2026-10-32" }),
    tx("purchase", gold.id, "buy", 10, { quantity: 1, unitPrice: 10, kind: "capital_in" }),
  ]);
  d.prices = [
    { id: "valid-price", assetId: gold.id, price: 70, date: "2026-10-25" },
    { id: "invalid-price", assetId: gold.id, price: 999, date: "2026-10-32" },
  ];
  assert.equal(metricsAt(d.assets, d.transactions, d.prices, asOf)[0].marketValue, 100);
  const report = evaluate(d);
  assert.equal(report.additionalCapital, 10);
  assert.equal(report.currentValue, 170);
  assert.equal(report.estimatedProfit, 60);
  assert.ok(report.issues.some((issue) => issue.id === "date-bad"));
  assert.ok(report.issues.some((issue) => issue.id === "quote-date-invalid-price"));
  assert.ok(!portfolioTimeline(d).some((point) => point.date === "2026-10-32"));
  assert.equal(getMonthlyCashFlows(d).reduce((sum, row) => sum + row.deposits, 0), 110);
});

test("an invalid stock order or quote cannot inflate current holdings or overwrite a valid price", () => {
  const orders: StockOrder[] = [
    { id: "good", symbol: "آزمایش", type: "buy", date: "2026-10-25", quantity: 2, unitPrice: 50, totalPrice: 100 },
    { id: "invalid", symbol: "آزمایش", type: "buy", date: "2026-10-32", quantity: 10, unitPrice: 50, totalPrice: 500 },
  ];
  const stocks = stockMetrics(orders, [
    { id: "good-price", symbol: "آزمایش", date: "2026-10-25", price: 70 },
    { id: "bad-price", symbol: "آزمایش", date: "2026-10-32", price: 1000 },
  ]);
  assert.equal(stocks[0].quantity, 2);
  assert.equal(stocks[0].price, 70);
  assert.equal(stocks[0].value, 140);
});

test("legacy Kian migration preserves a manual cash record that mentions an order ID", () => {
  const kian: Asset = { ...bank, id: "kian", name: "صندوق کیان" };
  const order: StockOrder = { id: "old-kian", symbol: "کیان", type: "buy", quantity: 10, unitPrice: 50, totalPrice: 500, date: "2026-11-01" };
  const manual = tx("manual", bank.id, "buy", 500, { kind: "capital_in", notes: "رسید مستقل برای old-kian؛ بررسی شود" });
  const d = data([bank, kian, hami], [manual], [order]);
  const migrated = migrateKianStockData(d).data;
  assert.ok(migrated.transactions.some((item) => item.id === manual.id && item.notes === manual.notes));
  assert.equal(migrated.stockOrders.length, 0);
  assert.equal(d.transactions.length, 1); // migration does not mutate the original backup
});

test("invalid amounts are audited but cannot become capital, holdings or cash activity", () => {
  const badOrder: StockOrder = {
    id: "bad-order", symbol: "آزمایش", type: "buy", quantity: 0, unitPrice: 50,
    totalPrice: 500, date: "2026-11-02", sourceAssetId: bank.id,
  };
  const d = data([bank, gold, bourse], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("invalid-cash", bank.id, "buy", 900, { quantity: 0, kind: "capital_in" }),
    tx("invalid-gold", gold.id, "buy", 500, { unitPrice: 0, kind: "capital_in" }),
  ], [badOrder]);
  const report = evaluate(d);
  assert.equal(report.currentValue, 100);
  assert.equal(report.initialCapital, 100);
  assert.equal(report.additionalCapital, 0);
  assert.equal(report.possibleDeposits, 0);
  assert.equal(report.recordedProfit, 0);
  assert.ok(report.issues.some((issue) => issue.id === "amount-invalid-cash"));
  assert.ok(report.issues.some((issue) => issue.id === "amount-invalid-gold"));
  assert.ok(report.issues.some((issue) => issue.id === "order-amount-bad-order"));
  assert.equal(getMonthlyCashFlows(d).reduce((sum, row) => sum + row.deposits, 0), 100);
});

test("future, nonfinite and unknown-status dividends are not treated as received profit", () => {
  const d = data([bank], [tx("opening", bank.id, "buy", 100, { kind: "opening_capital" })]);
  d.stockDividends = [
    { id: "future", symbol: "آزمایش", date: "2026-12-01", amount: 10, status: "paid" },
    { id: "nonfinite", symbol: "آزمایش", date: "2026-11-01", amount: Infinity, status: "paid" },
    { id: "unknown", symbol: "آزمایش", date: "2026-11-01", amount: 5, status: "other" as "paid" },
  ];
  const report = evaluate(d);
  assert.equal(report.paidOutside, 0);
  assert.equal(report.pendingDividends, 0);
  assert.equal(report.estimatedProfit, 0);
  assert.ok(report.issues.some((issue) => issue.id === "dividend-future-future"));
  assert.ok(report.issues.some((issue) => issue.id === "dividend-data-nonfinite"));
  assert.ok(report.issues.some((issue) => issue.id === "dividend-data-unknown"));
});

test("nonfinite asset rates and copy balances cannot poison portfolio totals", () => {
  const fixed: Asset = { id: "fixed", name: "درآمد ثابت", category: "صندوق درآمد ثابت", currentPrice: 1,
    annualInterestRate: Infinity, color: "#398", createdAt: asOf };
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", currentPrice: 50,
    copyUsdBalance: Infinity, copyUsdRate: 50, color: "#397", createdAt: asOf };
  const d = data([bank, { ...gold, currentPrice: Infinity }, fixed, copy], [
    tx("opening", bank.id, "buy", 100, { kind: "opening_capital" }),
    tx("gold-buy", gold.id, "buy", 10, { quantity: 1, unitPrice: 10, kind: "capital_in" }),
    tx("fixed-buy", fixed.id, "buy", 100, { quantity: 1, unitPrice: 100, kind: "capital_in" }),
  ]);
  const report = evaluate(d);
  assert.ok(Number.isFinite(report.currentValue));
  assert.equal(report.currentValue, 200);
  assert.ok(report.issues.some((issue) => issue.id === "price-gold"));
  assert.ok(report.issues.some((issue) => issue.id === "fixed-rate-fixed" && issue.target.type === "asset"));
  assert.ok(report.issues.some((issue) => issue.id === "copy-balance-copy" && issue.target.type === "price"));
  assert.equal(report.isReliable, false);
});

test("different same-day quotes are accepted; invalid prices and dates still need correction", () => {
  const d = data([bank, gold], [tx("opening", bank.id, "buy", 100, { kind: "opening_capital" })]);
  d.prices = [
    { id: "first", assetId: gold.id, date: "2026-11-10", price: 70 },
    { id: "second", assetId: gold.id, date: "2026-11-10", price: 75 },
  ];
  d.stockPrices = [
    { id: "stock-first", symbol: "آزمایش", date: "2026-11-10", price: 50 },
    { id: "stock-second", symbol: "آزمایش", date: "2026-11-10", price: 55 },
  ];
  assert.equal(evaluate(d).isReliable, true, "different same-day quotes alone are not an issue");

  d.prices.push(
    { id: "asset-invalid", assetId: gold.id, date: "2026-10-32", price: 60 },
    { id: "asset-zero", assetId: gold.id, date: "2026-11-10", price: 0 },
  );
  d.stockPrices.push(
    { id: "stock-invalid", symbol: "آزمایش", date: "2026-10-32", price: 60 },
    { id: "stock-future", symbol: "آزمایش", date: "2026-12-01", price: 60 },
    { id: "stock-zero", symbol: "", date: "2026-11-10", price: 0 },
  );
  const report = evaluate(d);
  assert.ok(!report.issues.some((issue) => issue.id.includes("quote-conflict")));
  assert.ok(report.issues.some((issue) => issue.id === "quote-date-asset-invalid" && issue.target.type === "price" && issue.target.recordId === "asset-invalid"));
  assert.ok(report.issues.some((issue) => issue.id === "quote-value-asset-zero" && issue.severity === "error"));
  assert.ok(report.issues.some((issue) => issue.id === "stock-quote-date-stock-invalid" && issue.target.type === "stockPrice"));
  assert.ok(report.issues.some((issue) => issue.id === "stock-quote-date-stock-future"));
  assert.ok(report.issues.some((issue) => issue.id === "stock-quote-value-stock-zero" && issue.severity === "error"));
  assert.equal(report.isReliable, false);
});
