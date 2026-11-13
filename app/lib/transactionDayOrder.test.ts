import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionsView } from "../components/Views";
import { AssetTransactionsModal, StockSymbolTradesModal } from "../components/Modals";
import { analyzeCapital } from "./capitalReport";
import { sanitizePortfolioData } from "./db";
import { emptyData, metricsAt, stockMetrics } from "./portfolio";
import { preparePortfolioData } from "./restore";
import {
  compareRowsWithinDay, ledgerOrderRows, ledgerRowKey,
  reorderRowsWithinDay, sanitizeTransactionDayOrder,
} from "./transactionDayOrder";
import type { Asset, PortfolioData, StockOrder, Transaction } from "./types";

const day = "2026-10-02";
const asOf = "2026-11-11";
const cash: Asset = { id: "cash", name: "بانک", category: "نقد", currentPrice: 1, color: "#333", createdAt: day };
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 20, color: "#a83", createdAt: day };
function tx(id: string, date = day, notes = id): Transaction {
  return { id, assetId: gold.id, type: "buy", quantity: 2, unitPrice: 10,
    totalPrice: 20, date, createdAt: `${date}T15:00:00Z`, notes, attachmentIds: [] };
}
function order(id: string, date = day): StockOrder {
  return { id, symbol: "نمونه", type: "buy", quantity: 2, unitPrice: 10,
    totalPrice: 20, date, sourceAssetId: cash.id };
}
function keysInDateOrder(data: PortfolioData, direction: "asc" | "desc" = "desc") {
  return ledgerOrderRows(data).sort((a, b) =>
    (direction === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) ||
    compareRowsWithinDay(data.settings.transactionDayOrder, a, b)
  ).map((row) => row.orderKey);
}
function ledgerMarkup(data: PortfolioData) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(TransactionsView, {
    data, capitalReport: analyzeCapital(data, 0, 0, asOf),
    onAdd: noop, onEdit: noop, onDelete: noop, onReorder: noop,
    onCsv: noop, onPdf: noop, onStockImport: noop,
  }));
}
function rowFor(markup: string, key: string) {
  const result = [...markup.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)]
    .map((item) => item[0]).find((html) => html.includes(`data-ledger-key="${key}"`));
  assert.ok(result, `row ${key} exists`);
  return result;
}

test("stock orders and transactions share a saved date order without touching any trade data", () => {
  const data: PortfolioData = { ...emptyData(), assets: [cash, gold],
    stockOrders: [order("shared"), order("next-day", "2026-10-03")],
    transactions: [tx("shared"), tx("middle"), tx("other-day", "2026-10-01")],
  };
  const before = JSON.stringify(data);
  assert.equal(ledgerRowKey("transaction", "shared"), "transaction:shared");
  assert.equal(ledgerRowKey("stockOrder", "shared"), "stockOrder:shared");
  assert.deepEqual(keysInDateOrder(data), [
    "stockOrder:next-day", "stockOrder:shared", "transaction:shared", "transaction:middle", "transaction:other-day",
  ]);

  const changed = reorderRowsWithinDay(data, "transaction:middle", "stockOrder:shared", "before");
  assert.notEqual(changed, data);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(changed.settings.transactionDayOrder, {
    [day]: ["transaction:middle", "stockOrder:shared", "transaction:shared"],
  });
  assert.deepEqual(changed.transactions, data.transactions);
  assert.deepEqual(changed.stockOrders, data.stockOrders);
  assert.deepEqual(changed.assets, data.assets);
  assert.deepEqual(keysInDateOrder(changed), [
    "stockOrder:next-day", "transaction:middle", "stockOrder:shared", "transaction:shared", "transaction:other-day",
  ]);
  assert.deepEqual(keysInDateOrder(changed, "asc"), [
    "transaction:other-day", "transaction:middle", "stockOrder:shared", "transaction:shared", "stockOrder:next-day",
  ]);
  const markup = ledgerMarkup(changed);
  assert.ok(markup.indexOf('data-ledger-key="transaction:middle"') < markup.indexOf('data-ledger-key="stockOrder:shared"'));
  assert.match(markup, /ترتیب نمایش در این مرورگر و پشتیبان JSON ذخیره می‌شود/);
  assert.match(rowFor(markup, "transaction:middle"), /class="transaction-drag-handle"/);
  assert.match(rowFor(markup, "stockOrder:shared"), /class="transaction-order-up"/);
  assert.match(rowFor(markup, "transaction:shared"), /class="transaction-order-down"[^>]*disabled/);
});

test("asset and stock history panels display the chosen tie order without reordering source arrays", () => {
  const stocks: Asset = { id: "asset-stocks", name: "بورس", category: "بورس", currentPrice: 0, color: "#256", createdAt: day };
  const firstOrder = { ...order("first"), quantity: 1, unitPrice: 10, totalPrice: 10, notes: "سفارش اول" };
  const secondOrder = { ...order("second"), quantity: 2, unitPrice: 20, totalPrice: 40, notes: "سفارش دوم" };
  const original: PortfolioData = { ...emptyData(), assets: [cash, gold, stocks],
    transactions: [tx("first", day, "ثبت اول"), tx("second", day, "ثبت دوم")],
    stockOrders: [firstOrder, secondOrder],
  };
  const txMoved = reorderRowsWithinDay(original, "transaction:second", "transaction:first", "before");
  const moved = reorderRowsWithinDay(txMoved, "stockOrder:second", "stockOrder:first", "before");
  const noop = () => {};
  const assetMarkup = renderToStaticMarkup(createElement(AssetTransactionsModal, {
    asset: gold, data: moved, transactions: moved.transactions, onClose: noop,
  }));
  assert.ok(assetMarkup.indexOf("ثبت دوم") < assetMarkup.indexOf("ثبت اول"));
  const bourseMarkup = renderToStaticMarkup(createElement(AssetTransactionsModal, {
    asset: stocks, data: moved, transactions: moved.transactions, stockOrders: moved.stockOrders, onClose: noop,
  }));
  assert.ok(bourseMarkup.indexOf("سفارش دوم") < bourseMarkup.indexOf("سفارش اول"));
  const symbolMarkup = renderToStaticMarkup(createElement(StockSymbolTradesModal, {
    symbol: "نمونه", orders: moved.stockOrders, dayOrder: moved.settings.transactionDayOrder,
    cashAccounts: [cash], onClose: noop, onEditOrder: noop,
  }));
  assert.ok(symbolMarkup.indexOf("۲ سهم") < symbolMarkup.indexOf("۱ سهم"));
  assert.deepEqual(original.stockOrders.map((item) => item.id), ["first", "second"]);
  assert.deepEqual(original.transactions.map((item) => item.id), ["first", "second"]);
});

test("a filtered-view move preserves hidden rows, and new/deleted records are reconciled on the next move", () => {
  const data: PortfolioData = { ...emptyData(), transactions: [tx("a"), tx("hidden"), tx("b")],
    stockOrders: [order("stock")],
  };
  // The UI can show only a and b (a filtered search), yet stores the whole day's order.
  const changed = reorderRowsWithinDay(data, "transaction:a", "transaction:b", "after");
  assert.deepEqual(keysInDateOrder(changed), [
    "stockOrder:stock", "transaction:hidden", "transaction:b", "transaction:a",
  ]);
  const updated = { ...changed, transactions: [...changed.transactions.filter((item) => item.id !== "hidden"), tx("new")] };
  assert.deepEqual(keysInDateOrder(updated), [
    "stockOrder:stock", "transaction:b", "transaction:a", "transaction:new",
  ]);
  const movedAgain = reorderRowsWithinDay(updated, "transaction:new", "transaction:b", "before");
  assert.deepEqual(movedAgain.settings.transactionDayOrder?.[day], [
    "stockOrder:stock", "transaction:new", "transaction:b", "transaction:a",
  ]);
  assert.strictEqual(reorderRowsWithinDay(movedAgain, "transaction:new", "transaction:b", "before"), movedAgain);
});

test("other dates, unknown rows and duplicate IDs cannot be moved", () => {
  const data: PortfolioData = { ...emptyData(), stockOrders: [order("shared")], transactions: [
    tx("first"), tx("other", "2026-10-03"), tx("shared"),
  ] };
  for (const [source, target] of [
    ["transaction:first", "transaction:other"], ["transaction:missing", "stockOrder:shared"],
    ["transaction:first", "transaction:first"],
  ]) assert.strictEqual(reorderRowsWithinDay(data, source, target, "before"), data);
  const dupeTx: PortfolioData = { ...data, transactions: [...data.transactions, tx("first", "2026-10-01")] };
  assert.strictEqual(reorderRowsWithinDay(dupeTx, "transaction:first", "stockOrder:shared", "after"), dupeTx);
  assert.strictEqual(reorderRowsWithinDay(dupeTx, "stockOrder:shared", "transaction:first", "after"), dupeTx);
  const dupeOrder: PortfolioData = { ...data, stockOrders: [...data.stockOrders, order("shared")] };
  assert.strictEqual(reorderRowsWithinDay(dupeOrder, "stockOrder:shared", "transaction:first", "after"), dupeOrder);
  const sameDayDupe: PortfolioData = { ...data, transactions: [...data.transactions, tx("first")] };
  assert.strictEqual(reorderRowsWithinDay(sameDayDupe, "transaction:shared", "stockOrder:shared", "before"), sameDayDupe);
  const sameDayMarkup = ledgerMarkup(sameDayDupe);
  assert.match(rowFor(sameDayMarkup, "stockOrder:shared"), /class="transaction-drag-handle"[^>]*disabled/);
  const markup = ledgerMarkup(dupeTx);
  assert.match(rowFor(markup, "stockOrder:shared"), /class="transaction-drag-handle"/);
  assert.match(rowFor(markup, "transaction:first"), /class="transaction-drag-handle"[^>]*disabled/);
});

test("JSON save and restore retain manual order, discard invalid metadata, and regenerate settlements", () => {
  const raw = { ...emptyData(), assets: [cash, gold], transactions: [tx("a"), tx("b")],
    stockOrders: [order("one")], settings: { ...emptyData().settings,
      transactionDayOrder: {
        [day]: ["transaction:b", "stockOrder:one", "transaction:a", "transaction:a", 3, "fake:bad"],
        "2026-02-30": ["transaction:a"], "2026-10-03": "transaction:a", ["__proto__"]: ["transaction:untrusted"],
      },
    },
  };
  const saved = sanitizePortfolioData(raw);
  assert.ok(saved);
  assert.deepEqual(saved.settings.transactionDayOrder, { [day]: ["transaction:b", "stockOrder:one", "transaction:a"] });
  const loaded = preparePortfolioData(JSON.parse(JSON.stringify(saved)));
  assert.ok(loaded);
  assert.deepEqual(loaded.settings.transactionDayOrder, saved.settings.transactionDayOrder);
  assert.equal(loaded.stockOrders[0].time, undefined, "a missing hour must not become an invented midnight");
  assert.equal(sanitizePortfolioData({ ...raw, stockOrders: [{ ...order("one"), time: "13:40" }] })?.stockOrders[0].time, "13:40");
  assert.deepEqual(loaded.transactions.filter((item) => !item.id.startsWith("hami-stock-")).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(loaded.transactions.filter((item) => item.id.startsWith("hami-stock-")).map((item) => item.id), ["hami-stock-buy-one"]);
  assert.deepEqual(keysInDateOrder(loaded).slice(0, 3), ["transaction:b", "stockOrder:one", "transaction:a"]);
  const withSettlementMoved = reorderRowsWithinDay(loaded, "transaction:hami-stock-buy-one", "transaction:b", "before");
  const restoredAgain = preparePortfolioData(JSON.parse(JSON.stringify(withSettlementMoved)));
  assert.ok(restoredAgain);
  assert.deepEqual(keysInDateOrder(restoredAgain), [
    "transaction:hami-stock-buy-one", "transaction:b", "stockOrder:one", "transaction:a",
  ]);
  assert.deepEqual(restoredAgain.transactions, loaded.transactions, "regenerated settlement keeps its real financial fields");
  assert.deepEqual(sanitizeTransactionDayOrder({ [day]: ["transaction:a", "transaction:a"] }), { [day]: ["transaction:a"] });
  assert.equal(sanitizeTransactionDayOrder(["transaction:a"]), undefined);
});

test("changing the display order does not silently change P&L or the order-independent cash audit", () => {
  const data: PortfolioData = { ...emptyData(), assets: [cash, gold],
    transactions: [tx("buy"), { ...tx("sell"), type: "sell", quantity: 1, totalPrice: 12, unitPrice: 12 }],
    stockOrders: [order("one")],
  };
  const beforeMetrics = metricsAt(data.assets, data.transactions, data.prices, asOf);
  const beforeStocks = stockMetrics(data.stockOrders, data.stockPrices, data.stockDividends);
  const beforeAudit = analyzeCapital(data, 0, 0, asOf);
  const changed = reorderRowsWithinDay(data, "transaction:sell", "transaction:buy", "before");
  assert.notEqual(changed, data);
  assert.deepEqual(metricsAt(changed.assets, changed.transactions, changed.prices, asOf), beforeMetrics);
  assert.deepEqual(stockMetrics(changed.stockOrders, changed.stockPrices, changed.stockDividends), beforeStocks);
  assert.deepEqual(analyzeCapital(changed, 0, 0, asOf), beforeAudit);
});
