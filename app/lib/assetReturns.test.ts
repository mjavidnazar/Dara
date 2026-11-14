import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetsView } from "../components/Views";
import { calculateBourseSummary, metricsAt, money, percent, stockMetrics, toPersianDate } from "./portfolio";
import type { Asset, StockOrder, Transaction } from "./types";

const asOf = "2026-11-11";
const tether: Asset = {
  id: "tether",
  name: "تتر",
  category: "تتر",
  unit: "عدد",
  currentPrice: 120,
  color: "#4b8",
  createdAt: "2026-11-01",
};

function trade(id: string, type: "buy" | "sell", quantity: number, unitPrice: number, date: string): Transaction {
  return {
    id,
    assetId: tether.id,
    type,
    quantity,
    unitPrice,
    totalPrice: quantity * unitPrice,
    date,
    createdAt: `${date}T12:00:00Z`,
    attachmentIds: [],
  };
}

test("a fully sold profitable asset uses all purchase costs, not its zero remaining cost or its own profit", () => {
  const transactions = [
    trade("buy-1", "buy", 2, 50, "2026-11-01"),
    trade("buy-2", "buy", 4, 50, "2026-11-02"),
    trade("sell-1", "sell", 2, 80, "2026-11-03"),
    trade("sell-2", "sell", 4, 72.5, "2026-11-04"),
  ];
  const before = JSON.stringify(transactions);
  const [item] = metricsAt([tether], transactions, [], asOf);
  assert.equal(item.quantity, 0);
  assert.equal(item.marketValue, 0);
  assert.equal(item.costBasis, 0);
  assert.equal(item.totalGrossBuys, 300);
  assert.equal(item.totalGrossSells, 450);
  assert.equal(item.realizedProfit, 150);
  assert.equal(item.unrealizedProfit, 0);
  assert.equal(item.profitPercent, 50); // 150 / 300 × 100, not 150 / 150 × 100
  assert.equal(JSON.stringify(transactions), before, "valuation must not rewrite the ledger");

  const markup = renderToStaticMarkup(createElement(AssetsView, {
    metrics: [item], stockSummary: calculateBourseSummary(),
    onAdd: () => {}, onPrice: () => {}, onUpdateCopy: () => {}, onDelete: () => {},
  }));
  assert.ok(markup.includes(`>${percent(50)}</span>`), "Assets card shows the corrected ratio");
  assert.ok(!markup.includes(">+۱۰۰٪</span>"), "Assets card must not fabricate a 100% gain");
  assert.ok(markup.includes(money(300)), "card explains the historical purchase denominator");
  assert.match(markup, /<small>میانگین خرید موجودی<\/small><b>—<\/b>/,
    "a sold-out holding has no current average cost; historical purchases still define its return");
  assert.ok(markup.includes(money(150)), "realized profit is unchanged");
});

test("the Bourse asset badge equals ratio 3, using peak open stock cost rather than total purchases or current cost", () => {
  const bourse: Asset = { ...tether, id: "bourse", name: "بورس", category: "بورس", currentPrice: 0 };
  const orders: StockOrder[] = [
    { id: "open-buy", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, date: "2026-11-01" },
    { id: "partial-sale", symbol: "الف", type: "sell", quantity: 1, unitPrice: 130, totalPrice: 130, date: "2026-11-02" },
    { id: "closed-buy", symbol: "ب", type: "buy", quantity: 1, unitPrice: 50, totalPrice: 50, date: "2026-11-03" },
    { id: "closed-sale", symbol: "ب", type: "sell", quantity: 1, unitPrice: 40, totalPrice: 40, date: "2026-11-04" },
  ];
  const summary = calculateBourseSummary(stockMetrics(orders, [
    { id: "quote", symbol: "الف", date: "2026-11-05", price: 125 },
  ]), orders);
  assert.equal(summary.peakOpenCost, 200);
  assert.equal(summary.purchases, 250);
  assert.equal(summary.currentCost, 100);
  assert.equal(summary.toDateProfit, 45); // 20 realized + 25 on the remaining share
  assert.equal(summary.toDateReturnPercent, 22.5); // 45 / 200, not 45 / 250 or / 100

  // The page mirrors stockSummary onto the placeholder metric, but even a stale
  // metric must not make this badge disagree with ratio 3 in the stock desk.
  const [raw] = metricsAt([bourse], [], [], asOf);
  const item = { ...raw, marketValue: summary.currentValue, costBasis: summary.currentCost,
    totalProfit: summary.toDateProfit, profitPercent: -99 };
  const markup = renderToStaticMarkup(createElement(AssetsView, {
    metrics: [item], stockSummary: summary,
    onAdd: () => {}, onPrice: () => {}, onUpdateCopy: () => {}, onDelete: () => {},
  }));
  assert.ok(markup.includes(`>${percent(summary.toDateReturnPercent)}</span>`));
  assert.ok(!markup.includes(`>${percent(item.profitPercent)}</span>`), "stale asset metrics cannot alter the Bourse ratio");
  assert.match(markup, /pill-badge positive[^>]*>/);
  assert.ok(markup.includes(money(summary.peakOpenCost)));
  assert.ok(markup.includes(toPersianDate(summary.peakOpenCostDate!)));
  assert.match(markup, /همان نسبت سوم میزکار/);
  assert.doesNotMatch(markup, /سود کل بورس نسبت به جمع مبالغ خرید/);
  assert.ok(!markup.includes("جمع بهای خریدهای ثبت‌شده: ۰ تومان"), "no made-up zero denominator for stocks");
});

test("without a valid stock purchase, the Bourse badge shows unavailable just like ratio 3", () => {
  const bourse: Asset = { ...tether, id: "bourse", name: "بورس", category: "بورس", currentPrice: 0 };
  const [item] = metricsAt([bourse], [], [], asOf);
  const markup = renderToStaticMarkup(createElement(AssetsView, {
    metrics: [item], stockSummary: calculateBourseSummary(),
    onAdd: () => {}, onPrice: () => {}, onUpdateCopy: () => {}, onDelete: () => {},
  }));
  assert.match(markup, /pill-badge neutral[^>]*>—<\/span>/);
});

test("a fully sold losing asset shows its loss percentage instead of zero", () => {
  const [item] = metricsAt([tether], [
    trade("buy", "buy", 5, 20, "2026-11-01"),
    trade("sell", "sell", 5, 12, "2026-11-02"),
  ], [], asOf);
  assert.equal(item.costBasis, 0);
  assert.equal(item.totalProfit, -40);
  assert.equal(item.profitPercent, -40); // -40 / 100 × 100
});

test("a partially sold and an unsold position both use gross purchase costs, not just the current holding", () => {
  const buy = trade("buy", "buy", 2, 100, "2026-11-01");
  const sell = trade("sell", "sell", 1, 150, "2026-11-02");
  const [unsold] = metricsAt([tether], [buy], [], asOf);
  assert.equal(unsold.totalProfit, 40); // two units at 120 minus 200 paid
  assert.equal(unsold.profitPercent, 20);

  const [partial] = metricsAt([tether], [buy, sell], [], asOf);
  assert.equal(partial.quantity, 1);
  assert.equal(partial.costBasis, 100);
  assert.equal(partial.realizedProfit, 50);
  assert.equal(partial.unrealizedProfit, 20);
  assert.equal(partial.totalProfit, 70);
  assert.equal(partial.profitPercent, 35); // 70 / 200 × 100, not 70 / (100 + 50)
});
