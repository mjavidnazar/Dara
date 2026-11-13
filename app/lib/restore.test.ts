import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, isGeneratedStockTransfer } from "./portfolio";
import { isPortfolioBackup, preparePortfolioData } from "./restore";
import type { Asset, PortfolioData, Transaction } from "./types";

const date = "2026-11-10";
const bank: Asset = { id: "asset-bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: date };
const hami: Asset = { id: "asset-hami", name: "صندوق درآمد ثابت حامی", category: "صندوق درآمد ثابت", currentPrice: 1, color: "#184", createdAt: date };
const oldCash: Transaction = {
  id: "uncertain", assetId: bank.id, type: "buy", quantity: 100, unitPrice: 1,
  totalPrice: 100, date, createdAt: `${date}T09:00:00Z`, attachmentIds: [],
};

test("local JSON restore is non-destructive and idempotently prepares stock settlements", () => {
  const raw: PortfolioData = {
    ...emptyData(), assets: [bank, hami], transactions: [oldCash],
    stockOrders: [{ id: "order-1", symbol: "نمونه", type: "buy", quantity: 1,
      unitPrice: 40, totalPrice: 40, date, sourceAssetId: hami.id }],
  };
  assert.equal(isPortfolioBackup(raw), true);
  const snapshot = JSON.stringify(raw);
  const prepared = preparePortfolioData(raw);
  assert.ok(prepared);
  assert.equal(JSON.stringify(raw), snapshot);
  assert.equal(prepared.assets.length, 3); // only the missing, empty certificate ledger
  assert.equal(prepared.transactions.length, 2);
  assert.equal(prepared.transactions.find((tx) => tx.id === oldCash.id)?.kind, undefined);
  assert.equal(prepared.transactions.filter(isGeneratedStockTransfer).length, 1);
  assert.equal(prepared.stockOrders.length, 1);
  assert.equal(preparePortfolioData(prepared)?.transactions.length, 2);
});

test("non-backup JSON is rejected before replacing the browser's portfolio", () => {
  assert.equal(isPortfolioBackup({ assets: [] }), false);
  assert.equal(isPortfolioBackup({ assets: [], transactions: {}, prices: [] }), false);
  assert.equal(isPortfolioBackup(emptyData()), true);
  assert.equal(preparePortfolioData({ transactions: [] }), null);
  assert.deepEqual(preparePortfolioData(emptyData())?.assets, []);
});
