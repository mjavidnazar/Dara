import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCapital } from "./capitalReport";
import { emptyData, metricsAt, syncStockCashTransfers } from "./portfolio";
import { findFundingCandidates, traceCashShortfalls } from "./reconciliationGuide";
import type { Asset, PortfolioData, Transaction } from "./types";

const asOf = "2026-11-11";
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: asOf };
const hami: Asset = { id: "hami", name: "حامی", category: "صندوق درآمد ثابت", currentPrice: 1, color: "#184", createdAt: asOf };
const kian: Asset = { id: "kian", name: "کیان", category: "صندوق درآمد ثابت", currentPrice: 1, color: "#722", createdAt: asOf };
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 1, color: "#b83", createdAt: asOf };
const bourse: Asset = { id: "bourse", name: "بورس", category: "بورس", currentPrice: 0, color: "#12a", createdAt: asOf };
function tx(id: string, assetId: string, type: "buy" | "sell", amount: number,
  date: string, extra: Partial<Transaction> = {}): Transaction {
  return { id, assetId, type, quantity: amount, unitPrice: 1, totalPrice: amount,
    date, createdAt: `${date}T10:00:00Z`, attachmentIds: [], ...extra };
}
function data(assets: Asset[], transactions: Transaction[]): PortfolioData {
  return { ...emptyData(), assets, transactions };
}
function report(d: PortfolioData) {
  const metrics = metricsAt(d.assets, d.transactions, d.prices);
  return analyzeCapital(d, metrics.reduce((sum, item) => sum + item.marketValue, 0),
    metrics.reduce((sum, item) => sum + item.totalProfit, 0), asOf);
}

test("missing bank opening is traced to the actual Hami receipt, not called an outside loss", () => {
  const bankOut = tx("bank-out", bank.id, "sell", 1200, "2026-05-25", { kind: "transfer", linkedTransactionId: "hami-in" });
  const hamiIn = tx("hami-in", hami.id, "buy", 1200, "2026-05-25", { kind: "transfer", linkedTransactionId: "bank-out" });
  const d = data([bank, hami], [bankOut, hamiIn]);
  const snapshot = JSON.stringify(d);
  const [gap] = traceCashShortfalls(d, asOf);
  assert.equal(gap.accountName, "بانک");
  assert.equal(gap.date, "2026-05-25");
  assert.equal(gap.triggerId, "bank-out");
  assert.equal(gap.balanceBefore, 0);
  assert.equal(gap.outflow, 1200);
  assert.equal(gap.balanceAfter, -1200);
  assert.equal(gap.earlierCreditCount, 0);
  assert.equal(gap.related?.target.id, "hami-in");
  assert.equal(gap.related?.evidence, "explicit");
  assert.equal(findFundingCandidates(d, asOf).length, 0); // transfer is not initial money
  assert.equal(JSON.stringify(d), snapshot); // read-only tracing
  const r = report(d);
  assert.equal(r.initialCapital, null);
  assert.ok(r.issues.some((i) => i.id === "negative-bank" && i.detail.includes("حامی")));

  const withOpening = data([bank, hami], [tx("opening", bank.id, "buy", 1200, "2026-05-24", { kind: "opening_capital" }), bankOut, hamiIn]);
  assert.equal(traceCashShortfalls(withOpening, asOf).length, 0);
  assert.equal(report(withOpening).initialCapital, 1200);
  assert.equal(report(withOpening).isReliable, true);
});

test("same-day temporary debit is not reported; separate negative episodes are both explained", () => {
  const d = data([hami], [
    tx("day1-debit", hami.id, "sell", 100, "2026-10-01", { kind: "capital_out", createdAt: "2026-10-01T09:00:00Z" }),
    tx("day1-credit", hami.id, "buy", 110, "2026-10-01", { kind: "opening_capital", createdAt: "2026-10-01T12:00:00Z" }),
    tx("first", hami.id, "sell", 30, "2026-10-02", { kind: "capital_out" }),
    tx("recover", hami.id, "buy", 40, "2026-10-03", { kind: "capital_in" }),
    tx("second", hami.id, "sell", 50, "2026-10-04", { kind: "capital_out" }),
  ]);
  const gaps = traceCashShortfalls(d, asOf);
  assert.deepEqual(gaps.map((g) => g.triggerId), ["first", "second"]);
  assert.deepEqual(gaps.map((g) => g.balanceAfter), [-20, -30]);
  assert.equal(gaps[0].recoveredOn, "2026-10-03");
  assert.equal(gaps[1].recoveredOn, null);
  assert.equal(gaps[1].currentBalance, -30);
  assert.equal(report(d).issues.filter((issue) => issue.id.startsWith("negative-hami")).length, 2);
});

test("a cash shortfall caused by a stock settlement opens its actual order", () => {
  const d = data([hami, bourse], [tx("opening", hami.id, "buy", 100, "2026-10-01", { kind: "opening_capital" })]);
  d.stockOrders = [{ id: "stock-buy", symbol: "نماد", type: "buy", quantity: 1,
    unitPrice: 150, totalPrice: 150, date: "2026-10-02", sourceAssetId: hami.id }];
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  const [gap] = traceCashShortfalls(d, asOf);
  assert.equal(gap.balanceBefore, 100);
  assert.equal(gap.balanceAfter, -50);
  assert.deepEqual(gap.related?.target, { type: "stockOrder", id: "stock-buy" });
  assert.equal(gap.related?.evidence, "stock_order");
});

test("initial-funding review shows unsourced purchases and credits but not matched transfers or a sale's receipt", () => {
  const d = data([bank, hami, kian, gold], [
    tx("gold-start", gold.id, "buy", 500, "2026-01-25"),
    tx("cash-start", bank.id, "buy", 100, "2026-02-08"),
    tx("bank-out", bank.id, "sell", 60, "2026-02-09", { kind: "transfer", linkedTransactionId: "hami-in" }),
    tx("hami-in", hami.id, "buy", 60, "2026-02-09", { kind: "transfer", linkedTransactionId: "bank-out" }),
    tx("kian-adjustment", kian.id, "buy", 1000, "2026-02-10", { kind: "balance_adjustment" }),
    tx("sale-receipt", bank.id, "buy", 300, "2026-10-03", { notes: "واریز حاصل از معامله gold-sale" }),
    tx("future", gold.id, "buy", 200, "2026-12-01"),
  ]);
  assert.deepEqual(findFundingCandidates(d, asOf).map((candidate) => candidate.id), ["gold-start", "cash-start"]);
  assert.equal(findFundingCandidates(d, asOf)[1].source, "cash_credit");
  assert.equal(report(d).fundingCandidates.length, 2);
  const kianGap = traceCashShortfalls(data([kian], [
    tx("adjust", kian.id, "buy", 80, "2026-01-01", { kind: "balance_adjustment" }),
    tx("out", kian.id, "sell", 100, "2026-01-02", { kind: "transfer" }),
  ]), asOf)[0];
  assert.equal(kianGap.precedingAdjustments, 1);
  assert.equal(kianGap.balanceBefore, 80);
});

test("same-day stock buy and larger account transfer: day-end culprit does not depend on createdAt", () => {
  const opening = tx("opening", hami.id, "buy", 664_300_471.1, "2026-10-06", { kind: "opening_capital" });
  const out = tx("out", hami.id, "sell", 664_553_436, "2026-10-07", {
    kind: "transfer", linkedTransactionId: "bank-in", createdAt: "2026-11-01T01:00:00Z",
  });
  const bankIn = tx("bank-in", bank.id, "buy", 664_553_436, "2026-10-07", {
    kind: "transfer", linkedTransactionId: "out", createdAt: out.createdAt,
  });
  const d = data([hami, bank, bourse], [opening, out, bankIn]);
  d.stockOrders = [{ id: "small-buy", symbol: "نماد", type: "buy", quantity: 1,
    unitPrice: 448_263.7, totalPrice: 448_263.7, date: out.date, sourceAssetId: hami.id }];
  d.transactions = syncStockCashTransfers(d.transactions, d.stockOrders, d.assets);
  for (const order of [d.transactions, [...d.transactions].reverse()]) {
    const [gap] = traceCashShortfalls({ ...d, transactions: order }, asOf);
    assert.equal(gap.triggerId, "out");
    assert.deepEqual(gap.attributionCandidates, ["out"]);
    assert.ok(Math.abs(gap.balanceBefore - 663_852_207.4) < 0.001);
    assert.ok(Math.abs(gap.balanceAfter + 701_228.6) < 0.001);
    assert.equal(gap.dayRowCount, 2);
    assert.equal(gap.related?.target.id, "bank-in");
    assert.deepEqual(gap.dayDebits.find((row) => row.id !== "out")?.related?.target,
      { type: "stockOrder", id: "small-buy" });
  }
  assert.ok(report(d).issues.some((issue) => issue.id === "negative-hami" && issue.detail.includes("ترتیب ردیف‌های همان روز اثبات نشده")));
});

test("when two same-day debits could each cause the negative balance, both are leads, not a verified first debit", () => {
  const d = data([bank, hami, kian], [
    tx("opening", bank.id, "buy", 80, "2026-10-01", { kind: "opening_capital" }),
    tx("to-hami", bank.id, "sell", 60, "2026-10-02", { kind: "transfer", linkedTransactionId: "in-hami" }),
    tx("in-hami", hami.id, "buy", 60, "2026-10-02", { kind: "transfer", linkedTransactionId: "to-hami" }),
    tx("to-kian", bank.id, "sell", 50, "2026-10-02", { kind: "transfer", linkedTransactionId: "in-kian" }),
    tx("in-kian", kian.id, "buy", 50, "2026-10-02", { kind: "transfer", linkedTransactionId: "to-kian" }),
  ]);
  const [gap] = traceCashShortfalls(d, asOf);
  assert.equal(gap.dayStartBalance, 80);
  assert.equal(gap.balanceAfter, -30);
  assert.deepEqual(gap.attributionCandidates, ["to-hami", "to-kian"]);
  assert.deepEqual(gap.dayDebits.map((debit) => debit.related?.target.id), ["in-hami", "in-kian"]);
  assert.ok(report(d).issues.find((issue) => issue.id === "negative-bank")?.detail.includes("چند برداشت"));
});

test("multiple plausible same-amount destinations are not presented as a verified counterpart", () => {
  const d = data([bank, hami, kian], [
    tx("out", bank.id, "sell", 100, "2026-05-25", { kind: "transfer" }),
    tx("to-hami", hami.id, "buy", 100, "2026-05-25", { kind: "transfer" }),
    tx("to-kian", kian.id, "buy", 100, "2026-05-25", { kind: "transfer" }),
  ]);
  assert.equal(traceCashShortfalls(d, asOf)[0].related, null);
});
