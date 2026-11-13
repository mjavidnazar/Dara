import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetsView } from "../components/Views";
import { metricsAt, money, percent } from "./portfolio";
import type { Asset, Transaction } from "./types";

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
    metrics: [item], onAdd: () => {}, onPrice: () => {}, onUpdateCopy: () => {}, onDelete: () => {},
  }));
  assert.ok(markup.includes(`>${percent(50)}</span>`), "Assets card shows the corrected ratio");
  assert.ok(!markup.includes(">+۱۰۰٪</span>"), "Assets card must not fabricate a 100% gain");
  assert.ok(markup.includes(money(300)), "card explains the historical purchase denominator");
  assert.match(markup, /<small>میانگین خرید موجودی<\/small><b>—<\/b>/,
    "a sold-out holding has no current average cost; historical purchases still define its return");
  assert.ok(markup.includes(money(150)), "realized profit is unchanged");
});

test("the stock-portfolio card does not claim its zero direct-asset purchases are the stock return denominator", () => {
  const bourse: Asset = { ...tether, id: "bourse", name: "بورس", category: "بورس", currentPrice: 0 };
  const [raw] = metricsAt([bourse], [], [], asOf);
  // The stock desk calculates this percent from stock orders; presentation metrics
  // replace the placeholder asset's value, while its direct trades remain empty.
  const item = { ...raw, marketValue: 120, costBasis: 100, totalProfit: 20, unrealizedProfit: 20, profitPercent: 20 };
  const markup = renderToStaticMarkup(createElement(AssetsView, {
    metrics: [item], onAdd: () => {}, onPrice: () => {}, onUpdateCopy: () => {}, onDelete: () => {},
  }));
  assert.ok(markup.includes(`>${percent(20)}</span>`));
  assert.ok(markup.includes("سفارش‌های سهام"), "stock tooltip names its actual source of purchases");
  assert.ok(!markup.includes("جمع بهای خریدهای ثبت‌شده: ۰ تومان"), "no made-up zero denominator for stocks");
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
