import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StocksDashboardView } from "../components/Views";
import { calculateBourseSummary, emptyData, money, percent, signedMoney, stockMetrics } from "./portfolio";
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

test("the three stock ratios use all buys for realized/total, but only remaining cost for current", () => {
  const data = portfolio();
  const before = JSON.stringify(data);
  const s = summary(data);
  assert.equal(s.purchases, 250);
  assert.equal(s.sales, 170);
  assert.equal(s.realizedCost, 150, "the sold shares cost is not the chosen denominator for realized profit");
  assert.equal(s.realizedProfit, 34, "sale profit + sale loss + paid dividends, including one on open shares");
  assert.ok(Math.abs(s.realizedReturnPercent - 13.6) < 1e-9); // 34 / 250, not 34 / 150
  assert.equal(s.currentValue, 125);
  assert.equal(s.currentCost, 100, "partial sale removes only the sold share's weighted cost");
  assert.equal(s.currentProfit, 25);
  assert.equal(s.currentProfitPercent, 25); // 25 / 100; no dividends or old sales
  assert.equal(s.pendingDividends, 5);
  assert.equal(s.unrealizedProfit, 30); // 25 current-price gain + 5 pending dividend
  assert.equal(s.toDateProfit, 64);
  assert.equal(s.toDateReturnPercent, 25.6); // (34 + 25 + 5) / 250
  assert.equal(JSON.stringify(data), before, "the ratio calculation cannot rewrite source data");
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
  assert.equal(paid.realizedReturnPercent, 15.6);
  assert.equal(paid.unrealizedProfit, before.unrealizedProfit - 5);
  assert.equal(paid.currentProfitPercent, before.currentProfitPercent);
  assert.equal(paid.toDateProfit, before.toDateProfit);
  assert.equal(paid.toDateReturnPercent, before.toDateReturnPercent);

  const repriced = summary(portfolio(orders, [{ ...prices[0], price: 115 }], dividends));
  assert.equal(repriced.realizedReturnPercent, before.realizedReturnPercent);
  assert.equal(repriced.currentProfitPercent, 15);
  assert.equal(repriced.toDateReturnPercent, 21.6); // (34 + 15 + 5) / 250
});

test("reinvested sale proceeds increase the all-buy denominators; invalid/future orders cannot", () => {
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
  assert.equal(s.realizedProfit, 50);
  assert.equal(s.realizedReturnPercent, (50 / 220) * 100);
  assert.equal(s.toDateReturnPercent, (50 / 220) * 100);
  assert.equal(s.currentCost, 0);
  assert.match(returnCard(stockView(portfolio([...roundTrips, ...extras], [], [])), "current"), /<h2>—<\/h2>/);
});

test("the stock view shows all three percentages, amounts and denominators with explicit labels", () => {
  const markup = stockView(portfolio());
  assert.match(markup, /سه نسبت سود بورس/);
  const ids = [...markup.matchAll(/data-stock-return="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["realized", "current", "total"]);
  const realized = returnCard(markup, "realized");
  assert.match(realized, /سود محقق‌شده \/ همهٔ خریدها/);
  assert.ok(realized.includes(percent(13.6)));
  assert.ok(realized.includes(signedMoney(34)));
  assert.ok(realized.includes(money(250)));
  assert.match(realized, /مخرج: همهٔ خریدهای سهام/);

  const current = returnCard(markup, "current");
  assert.match(current, /سود فعلی \/ بهای سهام موجود/);
  assert.ok(current.includes(percent(25)));
  assert.ok(current.includes(signedMoney(25)));
  assert.ok(current.includes(money(100)));
  assert.match(current, /مخرج: بهای خرید همین سهام/);

  const total = returnCard(markup, "total");
  assert.match(total, /سود کل \/ همهٔ خریدها/);
  assert.ok(total.includes(percent(25.6)));
  assert.ok(total.includes(signedMoney(64)));
  assert.ok(total.includes(money(250)));
  assert.match(total, /محقق‌شده \+ محقق‌نشده/);
  assert.doesNotMatch(markup, /شاخص نهایی عملکرد جامع سرمایه‌گذاری/);
});

test("when there is no valid purchase, none of the three ratios pretends to be zero percent", () => {
  const markup = stockView(portfolio([], [], []));
  for (const id of ["realized", "current", "total"]) {
    assert.match(returnCard(markup, id), /<h2>—<\/h2>/);
    assert.doesNotMatch(returnCard(markup, id), /٪/);
  }
});
