import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StocksDashboardView } from "../components/Views";
import { calculateBourseSummary, emptyData, money, peakOpenStockCost, percent, signedMoney, stockMetrics, toPersianDate } from "./portfolio";
import type { PortfolioData, StockDividend, StockOrder, StockPrice } from "./types";

const orders: StockOrder[] = [
  { id: "open-buy", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, date: "2026-01-01" },
  { id: "open-partial-sale", symbol: "الف", type: "sell", quantity: 1, unitPrice: 130, totalPrice: 130, date: "2026-01-02" },
  { id: "closed-buy", symbol: "ب", type: "buy", quantity: 1, unitPrice: 50, totalPrice: 50, date: "2026-01-03" },
  { id: "closed-sale", symbol: "ب", type: "sell", quantity: 1, unitPrice: 40, totalPrice: 40, date: "2026-01-04" },
];
const prices: StockPrice[] = [{ id: "open-price", symbol: "الف", price: 125, date: "2026-01-05" }];
const dividends: StockDividend[] = [
  { id: "open-paid", symbol: "الف", amount: 10, date: "2026-01-05", status: "paid" },
  { id: "closed-paid", symbol: "ب", amount: 4, date: "2026-01-05", status: "paid" },
  { id: "open-pending", symbol: "الف", amount: 5, date: "2026-01-05", status: "pending" },
];

function portfolio(stockOrders = orders, stockPrices = prices, stockDividends = dividends): PortfolioData {
  return { ...emptyData(), stockOrders, stockPrices, stockDividends };
}

function summary(data: PortfolioData) {
  const items = stockMetrics(data.stockOrders, data.stockPrices, data.stockDividends);
  return calculateBourseSummary(items, data.stockOrders, data.assets, data.transactions, data.prices);
}

function stockView(data: PortfolioData) {
  const items = stockMetrics(data.stockOrders, data.stockPrices, data.stockDividends);
  const stockSummary = calculateBourseSummary(items, data.stockOrders, data.assets, data.transactions, data.prices);
  return renderToStaticMarkup(createElement(StocksDashboardView, {
    items, data, stockSummary,
    onSavePrices: () => {}, onManagePrices: () => {}, onSaveHamiInterest: () => {},
    onDividend: () => {}, onEditOrder: () => {}, onAutoPrices: async () => {},
    onToggleDividend: () => {},
  }));
}

function returnCard(markup: string, id: string) {
  const match = markup.match(new RegExp(`<article[^>]*data-stock-return="${id}"[^>]*>[\\s\\S]*?<\\/article>`));
  assert.ok(match, `stock return card ${id} exists`);
  return match[0];
}

test("realized and total ratios use peak open cost; the current ratio still uses remaining cost", () => {
  const data = portfolio();
  const before = JSON.stringify(data);
  const s = summary(data);
  assert.equal(s.purchases, 250);
  assert.equal(s.sales, 170);
  assert.equal(s.peakOpenCost, 200);
  assert.equal(s.peakOpenCostDate, "2026-01-01");
  assert.equal(s.realizedCost, 150, "sold shares cost is not the chosen denominator");
  assert.equal(s.realizedProfit, 34, "sale profit + sale loss + paid dividends, including one on open shares");
  assert.equal(s.realizedReturnPercent, 17); // 34 / 200, not 34 / 250 or / 150
  assert.equal(s.currentValue, 125);
  assert.equal(s.currentCost, 100, "partial sale removes only the sold share's weighted cost");
  assert.equal(s.currentProfit, 25);
  assert.equal(s.currentProfitPercent, 25); // 25 / 100; no dividends or old sales
  assert.equal(s.pendingDividends, 5);
  assert.equal(s.unrealizedProfit, 30); // 25 current-price gain + 5 pending dividend
  assert.equal(s.toDateProfit, 64);
  assert.equal(s.toDateReturnPercent, 32); // (34 + 25 + 5) / 200
  assert.equal(JSON.stringify(data), before, "the ratio calculation cannot rewrite source data");
});

test("the peak is whole-portfolio closing cost, not historical buys or summed per-symbol peaks", () => {
  const sequence: StockOrder[] = [
    { id: "a-buy", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, date: "2026-01-01" },
    { id: "a-partial-sale", symbol: "الف", type: "sell", quantity: 1, unitPrice: 120, totalPrice: 120, date: "2026-01-02" },
    { id: "b-buy", symbol: "ب", type: "buy", quantity: 1, unitPrice: 150, totalPrice: 150, date: "2026-01-03" },
    { id: "b-sale", symbol: "ب", type: "sell", quantity: 1, unitPrice: 200, totalPrice: 200, date: "2026-01-04" },
    { id: "a-rebuy", symbol: "الف", type: "buy", quantity: 1, unitPrice: 110, totalPrice: 110, date: "2026-01-05" },
  ];
  const snapshot = JSON.stringify(sequence);
  assert.deepEqual(peakOpenStockCost(sequence), { amount: 250, date: "2026-01-03" });
  assert.deepEqual(peakOpenStockCost([...sequence].reverse()), { amount: 250, date: "2026-01-03" },
    "different-day input order cannot affect the result");
  assert.deepEqual(peakOpenStockCost(sequence, "2026-01-02"), { amount: 200, date: "2026-01-01" });
  const s = summary(portfolio(sequence, [{ id: "price", symbol: "الف", price: 110, date: "2026-01-05" }], []));
  assert.equal(s.purchases, 460);
  assert.equal(s.currentCost, 210);
  assert.equal(s.peakOpenCost, 250, "not 360 (the sum of peaks for individual symbols)");
  assert.equal(s.realizedProfit, 70);
  assert.ok(Math.abs(s.realizedReturnPercent - 28) < 1e-9);
  assert.equal(s.toDateProfit, 80);
  assert.equal(s.toDateReturnPercent, 32);
  assert.equal(JSON.stringify(sequence), snapshot, "history is read only");
});

test("selling part of a mixed-price holding frees its weighted-average cost before the next day's purchases", () => {
  const sequence: StockOrder[] = [
    { id: "first", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, date: "2026-01-01" },
    { id: "second", symbol: "الف", type: "buy", quantity: 1, unitPrice: 160, totalPrice: 160, date: "2026-01-02" },
    { id: "partial-sale", symbol: "الف", type: "sell", quantity: 2, unitPrice: 210, totalPrice: 420, date: "2026-01-03" },
    { id: "another-symbol", symbol: "ب", type: "buy", quantity: 1, unitPrice: 300, totalPrice: 300, date: "2026-01-04" },
    { id: "sell-b", symbol: "ب", type: "sell", quantity: 1, unitPrice: 320, totalPrice: 320, date: "2026-01-05" },
    { id: "rebuy-b", symbol: "ب", type: "buy", quantity: 1, unitPrice: 300, totalPrice: 300, date: "2026-01-06" },
  ];
  assert.deepEqual(peakOpenStockCost(sequence, "2026-01-03"), { amount: 360, date: "2026-01-02" });
  assert.deepEqual(peakOpenStockCost(sequence), { amount: 420, date: "2026-01-04" },
    "selling 2 of 3 shares releases 240, leaving 120; a later tie keeps the first date");
  const s = summary(portfolio(sequence, [], []));
  assert.equal(s.purchases, 960);
  assert.equal(s.currentCost, 420, "current cost agrees with the peak's cost-basis bookkeeping");
  assert.equal(s.peakOpenCost, 420);
});

test("same-day buy and sell use the end-of-day position, not an unknowable intraday high", () => {
  const sequence: StockOrder[] = [
    { id: "a-buy", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, date: "2026-01-01", time: "00:00:00" },
    { id: "b-buy", symbol: "ب", type: "buy", quantity: 1, unitPrice: 200, totalPrice: 200, date: "2026-01-02", time: "00:00:00" },
    { id: "a-sale", symbol: "الف", type: "sell", quantity: 2, unitPrice: 115, totalPrice: 230, date: "2026-01-02", time: "00:00:00" },
  ];
  const invalid: StockOrder[] = [
    { ...sequence[0], id: "future", totalPrice: 1000, date: "2999-01-01" },
    { ...sequence[0], id: "bad-date", totalPrice: 1000, date: "2026-02-30" },
    { ...sequence[0], id: "special-fund", symbol: "کیان", totalPrice: 1000, date: "2026-01-03" },
  ];
  assert.deepEqual(peakOpenStockCost([...sequence, ...invalid]), { amount: 200, date: "2026-01-01" });
  const s = summary(portfolio([...sequence, ...invalid], [
    { id: "b-price", symbol: "ب", date: "2026-01-02", price: 220 },
  ], []));
  assert.equal(s.purchases, 400, "neither invalid/future orders nor the excluded Kian fund enter stock buys");
  assert.equal(s.peakOpenCost, 200, "same-day intermediate 400 is not a documented portfolio exposure");
  assert.equal(s.currentCost, 200);
  assert.equal(s.toDateProfit, 50); // 30 realized + 20 current
  assert.equal(s.toDateReturnPercent, 25);
  assert.deepEqual(peakOpenStockCost([], "2026-01-02"), { amount: 0, date: null });
});

test("settlement fees affect sold and remaining costs, and the current ratio can show a loss", () => {
  const feeOrders: StockOrder[] = [
    { id: "fee-buy", symbol: "الف", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 210, commission: 10, date: "2026-01-01" },
    { id: "fee-sale", symbol: "الف", type: "sell", quantity: 1, unitPrice: 125, totalPrice: 120, commission: 5, date: "2026-01-02" },
  ];
  const data = portfolio(feeOrders, [{ id: "price", symbol: "الف", price: 90, date: "2026-01-05" }], []);
  const s = summary(data);
  assert.equal(s.purchases, 210, "the buy-side commission is included once in the purchase amount");
  assert.equal(s.realizedCost, 105);
  assert.equal(s.peakOpenCost, 210, "the peak includes the recorded buy settlement and its fee");
  assert.equal(s.realizedProfit, 15, "net sale proceeds minus the sold share's average cost");
  assert.equal(s.currentCost, 105);
  assert.equal(s.currentProfit, -15);
  assert.equal(s.toDateProfit, 0);
  assert.equal(s.realizedReturnPercent, (15 / 210) * 100);
  assert.equal(s.currentProfitPercent, (-15 / 105) * 100);
  assert.equal(s.toDateReturnPercent, 0);
  const markup = stockView(data);
  assert.ok(returnCard(markup, "current").includes(percent(s.currentProfitPercent)));
  assert.match(returnCard(markup, "current"), /<h2 class="negative-text">/);
});

test("marking a dividend paid moves profit from unrealized to realized without changing total or current", () => {
  const before = summary(portfolio());
  const paid = summary(portfolio(orders, prices, dividends.map((d) =>
    d.id === "open-pending" ? { ...d, status: "paid" } : d)));
  assert.equal(paid.realizedProfit, before.realizedProfit + 5);
  assert.equal(paid.realizedReturnPercent, 19.5);
  assert.equal(paid.unrealizedProfit, before.unrealizedProfit - 5);
  assert.equal(paid.currentProfitPercent, before.currentProfitPercent);
  assert.equal(paid.peakOpenCost, before.peakOpenCost);
  assert.equal(paid.toDateProfit, before.toDateProfit);
  assert.equal(paid.toDateReturnPercent, before.toDateReturnPercent);

  const repriced = summary(portfolio(orders, [{ ...prices[0], price: 115 }], dividends));
  assert.equal(repriced.peakOpenCost, before.peakOpenCost, "quotes cannot change purchase-cost exposure");
  assert.equal(repriced.realizedReturnPercent, before.realizedReturnPercent);
  assert.equal(repriced.currentProfitPercent, 15);
  assert.equal(repriced.toDateReturnPercent, 27); // (34 + 15 + 5) / 200
});

test("reinvested sale proceeds do not turn historical purchases into the peak denominator", () => {
  const roundTrips: StockOrder[] = [
    { id: "buy-1", symbol: "الف", type: "buy", quantity: 1, unitPrice: 100, totalPrice: 100, date: "2026-01-01" },
    { id: "sell-1", symbol: "الف", type: "sell", quantity: 1, unitPrice: 120, totalPrice: 120, date: "2026-01-02" },
    { id: "buy-2", symbol: "الف", type: "buy", quantity: 1, unitPrice: 120, totalPrice: 120, date: "2026-01-03" },
    { id: "sell-2", symbol: "الف", type: "sell", quantity: 1, unitPrice: 150, totalPrice: 150, date: "2026-01-04" },
  ];
  const extras: StockOrder[] = [
    { ...roundTrips[0], id: "future", totalPrice: 1000, date: "2999-01-01" },
    { ...roundTrips[0], id: "invalid", totalPrice: 1000, date: "2026-02-30" },
  ];
  const s = summary(portfolio([...roundTrips, ...extras], [], []));
  assert.equal(s.purchases, 220);
  assert.equal(s.peakOpenCost, 120, "only one purchase was open at a time; invalid/future orders are ignored");
  assert.equal(s.peakOpenCostDate, "2026-01-03");
  assert.equal(s.realizedProfit, 50);
  assert.equal(s.realizedReturnPercent, (50 / 120) * 100);
  assert.equal(s.toDateReturnPercent, (50 / 120) * 100);
  assert.equal(s.currentCost, 0);
  assert.match(returnCard(stockView(portfolio([...roundTrips, ...extras], [], [])), "current"), /<h2>—<\/h2>/);
});

test("the stock view shows all three percentages, amounts and denominators with explicit labels", () => {
  const markup = stockView(portfolio());
  assert.match(markup, /سه نسبت سود بورس/);
  const ids = [...markup.matchAll(/data-stock-return="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["realized", "current", "total"]);
  const realized = returnCard(markup, "realized");
  assert.match(realized, /سود محقق‌شده \/ بیشترین پول درگیر بورس/);
  assert.ok(realized.includes(percent(17)));
  assert.ok(realized.includes(signedMoney(34)));
  assert.ok(realized.includes(money(200)));
  assert.match(realized, /مخرج: بیشترین پول درگیر بورس/);
  assert.ok(realized.includes(toPersianDate("2026-01-01")));

  const current = returnCard(markup, "current");
  assert.match(current, /سود فعلی \/ بهای سهام موجود/);
  assert.ok(current.includes(percent(25)));
  assert.ok(current.includes(signedMoney(25)));
  assert.ok(current.includes(money(100)));
  assert.match(current, /مخرج: بهای خرید همین سهام/);

  const total = returnCard(markup, "total");
  assert.match(total, /سود کل \/ بیشترین پول درگیر بورس/);
  assert.ok(total.includes(percent(32)));
  assert.ok(total.includes(signedMoney(64)));
  assert.ok(total.includes(money(200)));
  assert.match(total, /محقق‌شده \+ محقق‌نشده/);
  assert.ok(total.includes(toPersianDate("2026-01-01")));
  assert.doesNotMatch(markup, /شاخص نهایی عملکرد جامع سرمایه‌گذاری/);
});

test("when there is no valid purchase, none of the three ratios pretends to be zero percent", () => {
  const markup = stockView(portfolio([], [], []));
  for (const id of ["realized", "current", "total"]) {
    assert.match(returnCard(markup, id), /<h2>—<\/h2>/);
    assert.doesNotMatch(returnCard(markup, id), /٪/);
  }
});
