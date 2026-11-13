import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePortfolioData } from "./db";
import { appendAssetPrices, appendStockPrices, editAssetPrice, editStockPrice } from "./priceHistory";
import { emptyData, getSegmentsAtDate, latestAssetPrice, latestStockPrice, metricsAt, portfolioTimeline, stockMetrics } from "./portfolio";
import { preparePortfolioData } from "./restore";
import type { Asset, PortfolioData, StockOrder, Transaction } from "./types";

const previousDay = "2026-11-09";
const quoteDay = "2026-11-10";
const asOf = "2026-11-11";
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: previousDay };
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 70, color: "#b83", createdAt: previousDay };
const bourse: Asset = { id: "bourse", name: "بورس", category: "بورس", currentPrice: 0, color: "#34a", createdAt: previousDay };
const order: StockOrder = { id: "order", symbol: "آزمایش", type: "buy", date: previousDay,
  quantity: 3, unitPrice: 50, totalPrice: 150 };
const purchase: Transaction = { id: "purchase", assetId: gold.id, type: "buy", date: previousDay,
  quantity: 2, unitPrice: 50, totalPrice: 100, createdAt: `${previousDay}T10:00:00Z`, attachmentIds: [] };

function initial(): PortfolioData {
  return { ...emptyData(), assets: [bank, gold, bourse], stockOrders: [order], transactions: [
    { ...purchase, id: "opening", assetId: bank.id, quantity: 100, unitPrice: 1, kind: "opening_capital" },
    purchase,
  ] };
}

test("legacy same-day prices use the last record, but a newer date always outranks a later backdated entry", () => {
  const data = initial();
  data.prices = [
    { id: "old-day", assetId: gold.id, date: previousDay, price: 60 },
    { id: "first", assetId: gold.id, date: quoteDay, price: 70 },
    { id: "second", assetId: gold.id, date: quoteDay, price: 75 },
    { id: "backdated", assetId: gold.id, date: previousDay, price: 999 },
    { id: "invalid-date", assetId: gold.id, date: "2026-10-32", price: 1000 },
    { id: "future", assetId: gold.id, date: "2999-01-01", price: 1000 },
    { id: "invalid-price", assetId: gold.id, date: quoteDay, price: 0 },
  ];
  data.stockPrices = [
    { id: "old-day-stock", symbol: order.symbol, date: previousDay, price: 45 },
    { id: "first-stock", symbol: order.symbol, date: quoteDay, price: 50 },
    { id: "second-stock", symbol: "آزمايش", date: quoteDay, price: 55 },
    { id: "backdated-stock", symbol: order.symbol, date: previousDay, price: 999 },
    { id: "invalid-stock", symbol: order.symbol, date: "2026-10-32", price: 1000 },
    { id: "future-stock", symbol: order.symbol, date: "2999-01-01", price: 1000 },
    { id: "zero-stock", symbol: order.symbol, date: quoteDay, price: 0 },
  ];

  assert.equal(latestAssetPrice(data.prices, gold.id, previousDay)?.id, "backdated");
  assert.equal(latestAssetPrice(data.prices, gold.id, asOf)?.id, "second");
  assert.equal(latestStockPrice(data.stockPrices, order.symbol, asOf)?.id, "second-stock");
  assert.equal(metricsAt(data.assets, data.transactions, data.prices, asOf)[1].marketValue, 150);
  assert.equal(metricsAt(data.assets, data.transactions, data.prices, asOf)[1].asset.currentPrice, 75,
    "the unit price displayed on legacy asset cards must match the chosen valuation");
  assert.equal(data.assets[1].currentPrice, 70, "valuation must not rewrite a legacy backup");
  assert.equal(stockMetrics(data.stockOrders, data.stockPrices)[0].price, 55);
  assert.equal(portfolioTimeline(data).find((point) => point.date === quoteDay)?.value, 415); // bank 100 + gold 150 + stocks 165
  assert.equal(getSegmentsAtDate(data, quoteDay).totalValue, 415);
});

test("adding a price keeps earlier quotes; editing an older row promotes it for that day without changing other dates", () => {
  const data: PortfolioData = { ...initial(), prices: [
    { id: "first", assetId: gold.id, date: quoteDay, price: 70 },
    { id: "second", assetId: gold.id, date: quoteDay, price: 75 },
  ] };
  const snapshot = JSON.stringify(data);
  let next = appendAssetPrices(data, [{ id: "backdated", assetId: gold.id, date: previousDay, price: 999 }], asOf);
  assert.equal(next.assets[1].currentPrice, 75);
  next = editAssetPrice(next, "first", 72, quoteDay, asOf);
  assert.deepEqual(next.prices.map((entry) => entry.id), ["second", "backdated", "first"]);
  assert.equal(latestAssetPrice(next.prices, gold.id, asOf)?.price, 72);
  assert.equal(next.assets[1].currentPrice, 72);
  assert.equal(metricsAt(next.assets, next.transactions, next.prices, asOf)[1].marketValue, 144);

  next = appendAssetPrices(next, [{ id: "third", assetId: gold.id, date: quoteDay, price: 80 }], asOf);
  assert.equal(next.prices.length, 4);
  assert.equal(next.assets[1].currentPrice, 80);
  next = editAssetPrice(next, "first", 66, previousDay, asOf);
  assert.equal(next.assets[1].currentPrice, 80, "editing a price on an older date cannot override a later date");
  next = editAssetPrice(next, "third", 88, "2999-01-01", asOf);
  assert.equal(next.assets[1].currentPrice, 75, "a future price cannot become today's valuation");
  assert.equal(JSON.stringify(data), snapshot, "editing and saving must not mutate the original backup");
});

test("fixed-fund corrections and copy-trade rates follow the same edit priority", () => {
  const fixed: Asset = { id: "fixed", name: "صندوق درآمد ثابت", category: "صندوق درآمد ثابت", color: "#088",
    currentPrice: 1, annualInterestRate: 0, createdAt: previousDay };
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", color: "#088",
    currentPrice: 40, copyUsdRate: 40, copyUsdBalance: 2, lastValuationAt: quoteDay, createdAt: previousDay };
  const data: PortfolioData = { ...emptyData(), assets: [fixed, copy], transactions: [
    { ...purchase, id: "fixed-deposit", assetId: fixed.id, quantity: 1000, unitPrice: 1, totalPrice: 1000 },
  ], prices: [
    { id: "fixed-first", assetId: fixed.id, date: quoteDay, price: 1100 },
    { id: "fixed-second", assetId: fixed.id, date: quoteDay, price: 1200 },
    { id: "copy-first", assetId: copy.id, date: quoteDay, price: 40 },
    { id: "copy-second", assetId: copy.id, date: quoteDay, price: 50 },
  ] };
  const initialMetrics = metricsAt(data.assets, data.transactions, data.prices, asOf);
  assert.equal(initialMetrics[0].marketValue, 1200);
  assert.equal(initialMetrics[0].asset.currentPrice, 1200);
  assert.equal(initialMetrics[1].marketValue, 100);
  assert.equal(initialMetrics[1].asset.copyUsdRate, 50, "legacy copy snapshots display the winning same-day rate");
  const fixedEdited = editAssetPrice(data, "fixed-first", 1300, quoteDay, asOf);
  assert.equal(metricsAt(fixedEdited.assets, fixedEdited.transactions, fixedEdited.prices, asOf)[0].marketValue, 1300);
  const copyEdited = editAssetPrice(fixedEdited, "copy-first", 60, quoteDay, asOf);
  assert.equal(copyEdited.assets[1].copyUsdRate, 60);
  assert.equal(copyEdited.assets[1].currentPrice, 60);
  assert.equal(metricsAt(copyEdited.assets, copyEdited.transactions, copyEdited.prices, asOf)[1].marketValue, 120);
  const copySaved = appendAssetPrices(copyEdited, [
    { id: "copy-balance", assetId: copy.id, date: quoteDay, price: 55 },
  ], asOf);
  assert.deepEqual(copySaved.prices.filter((entry) => entry.assetId === copy.id).map((entry) => entry.price), [50, 60, 55]);
  assert.equal(copySaved.assets[1].copyUsdRate, 55);
  assert.equal(metricsAt(copySaved.assets, copySaved.transactions, copySaved.prices, asOf)[1].marketValue, 110);
  const laterBalance = { ...copyEdited, assets: [copyEdited.assets[0],
    { ...copyEdited.assets[1], copyUsdRate: 65, currentPrice: 65, lastValuationAt: asOf }] };
  assert.equal(metricsAt(laterBalance.assets, laterBalance.transactions, laterBalance.prices, asOf)[1].marketValue, 130,
    "an older quote does not override a newer copy-trading balance snapshot");
});

test("manual and automatic stock quotes append without erasing history; editing an older quote wins within its date", () => {
  const data: PortfolioData = { ...initial(), stockPrices: [
    { id: "first", symbol: order.symbol, date: quoteDay, price: 50 },
    { id: "second", symbol: order.symbol, date: quoteDay, price: 55 },
  ] };
  let next = appendStockPrices(data, [{ id: "backdated", symbol: order.symbol, date: previousDay, price: 999 }]);
  assert.equal(stockMetrics(next.stockOrders, next.stockPrices)[0].price, 55);
  next = editStockPrice(next, { ...data.stockPrices[0], price: 60 });
  assert.deepEqual(next.stockPrices.map((entry) => entry.id), ["second", "backdated", "first"]);
  assert.equal(stockMetrics(next.stockOrders, next.stockPrices)[0].value, 180);
  next = appendStockPrices(next, [{ id: "auto-fetch", symbol: "آزمايش", date: quoteDay, price: 65 }]);
  assert.equal(next.stockPrices.length, 4);
  assert.equal(stockMetrics(next.stockOrders, next.stockPrices)[0].price, 65);
  assert.equal(latestStockPrice(next.stockPrices, order.symbol, previousDay)?.id, "backdated");
  assert.equal(data.stockPrices.length, 2);
});

test("JSON restore and local sanitization preserve quote history and its tie priority, including old backups", () => {
  const data: PortfolioData = { ...initial(), prices: [
    { id: "old-gold", assetId: gold.id, date: quoteDay, price: 70 },
    { id: "new-gold", assetId: gold.id, date: quoteDay, price: 75 },
  ], stockPrices: [
    { id: "old-stock", symbol: order.symbol, date: quoteDay, price: 50 },
    { id: "new-stock", symbol: order.symbol, date: quoteDay, price: 55 },
  ] };
  const revised = editStockPrice(editAssetPrice(data, "old-gold", 80, quoteDay, asOf),
    { ...data.stockPrices[0], price: 60 });
  const backup = JSON.parse(JSON.stringify(revised));
  for (const restored of [sanitizePortfolioData(backup), preparePortfolioData(backup)]) {
    assert.ok(restored);
    assert.deepEqual(restored.prices.map((entry) => entry.id), ["new-gold", "old-gold"]);
    assert.deepEqual(restored.stockPrices.map((entry) => entry.id), ["new-stock", "old-stock"]);
    assert.equal(latestAssetPrice(restored.prices, gold.id, asOf)?.price, 80);
    assert.equal(latestStockPrice(restored.stockPrices, order.symbol, asOf)?.price, 60);
    assert.equal(metricsAt(restored.assets, restored.transactions, restored.prices, asOf)
      .find((item) => item.asset.id === gold.id)?.marketValue, 160);
  }
  const legacy = preparePortfolioData(JSON.parse(JSON.stringify(data)));
  assert.ok(legacy);
  assert.equal(latestAssetPrice(legacy.prices, gold.id, asOf)?.price, 75);
  assert.equal(latestStockPrice(legacy.stockPrices, order.symbol, asOf)?.price, 55);
  assert.equal(data.prices[0].price, 70);
});

test("duplicate quote IDs cannot silently revise several records at once", () => {
  const data: PortfolioData = { ...initial(), prices: [
    { id: "duplicate", assetId: gold.id, date: quoteDay, price: 70 },
    { id: "duplicate", assetId: gold.id, date: quoteDay, price: 75 },
  ], stockPrices: [
    { id: "duplicate", symbol: order.symbol, date: quoteDay, price: 50 },
    { id: "duplicate", symbol: order.symbol, date: quoteDay, price: 55 },
  ] };
  assert.equal(editAssetPrice(data, "duplicate", 100, quoteDay, asOf), data);
  assert.equal(editStockPrice(data, { ...data.stockPrices[0], price: 100 }), data);
});
