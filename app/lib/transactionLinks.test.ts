import assert from "node:assert/strict";
import test from "node:test";
import { emptyData } from "./portfolio";
import { autoRemovedCounterparts, linkedTransactions, removeTransaction, upsertTransaction } from "./transactionLinks";
import type { Asset, PortfolioData, Transaction } from "./types";

const assets: Asset[] = [
  { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: "2026-11-01" },
  { id: "hami", name: "حامی", category: "نقد", currentPrice: 1, color: "#398", createdAt: "2026-11-01" },
  { id: "gold", name: "طلا", category: "طلا", currentPrice: 1, color: "#b83", createdAt: "2026-11-01" },
  { id: "silver", name: "نقره", category: "نقره", currentPrice: 1, color: "#aaa", createdAt: "2026-11-01" },
];

function tx(id: string, assetId: string, type: "buy" | "sell", total: number, fields: Partial<Transaction> = {}): Transaction {
  return { id, assetId, type, quantity: total, unitPrice: 1, totalPrice: total, date: "2026-11-01", createdAt: "2026-11-01", attachmentIds: [], ...fields };
}
function fixture(transactions: Transaction[] = []): PortfolioData {
  return { ...emptyData(), assets, transactions };
}

test("editing a purchase linked to a cash account updates the same cash leg and its attachments", () => {
  const trade = tx("trade", "gold", "buy", 600, { quantity: 10, unitPrice: 60, sourceAssetId: "bank", kind: "trade" });
  let d = upsertTransaction(fixture(), trade, [{ id: "file", transactionId: "trade", name: "رسید", type: "text/plain", size: 1, data: "a" }]);
  assert.equal(d.transactions.length, 2);
  const cash = d.transactions.find((item) => item.assetId === "bank")!;
  assert.equal(cash.type, "sell");
  assert.equal(cash.linkedTransactionId, trade.id);
  const edited = { ...d.transactions.find((item) => item.id === trade.id)!, quantity: 10, unitPrice: 70, totalPrice: 700, date: "2026-11-02" };
  d = upsertTransaction(d, edited, []);
  assert.equal(d.transactions.length, 2);
  assert.equal(d.transactions.find((item) => item.assetId === "bank")?.id, cash.id);
  assert.equal(d.transactions.find((item) => item.assetId === "bank")?.totalPrice, 700);
  assert.equal(d.transactions.find((item) => item.assetId === "bank")?.date, "2026-11-02");
  assert.equal(d.attachments.length, 0);
  d = upsertTransaction(d, { ...edited, kind: "capital_in", sourceAssetId: undefined }, []);
  assert.equal(d.transactions.length, 1);
  assert.equal(d.transactions[0].kind, "capital_in");
});

test("legacy cash receipts with no link id are reused instead of duplicated", () => {
  const old = tx("old-trade", "gold", "sell", 125, { quantity: 5, unitPrice: 25, destinationAssetId: "bank" });
  const receipt = tx("legacy-cash", "bank", "buy", 125, { kind: "transfer", notes: "واریز حاصل فروش به مقصد" });
  let d = fixture([old, receipt]);
  assert.deepEqual(linkedTransactions(d, old).map((item) => item.id), [receipt.id]);
  d = upsertTransaction(d, { ...old, kind: "trade", totalPrice: 130, unitPrice: 26 }, []);
  assert.equal(d.transactions.length, 2);
  assert.equal(d.transactions.find((item) => item.id === receipt.id)?.totalPrice, 130);
  d = removeTransaction(d, d.transactions.find((item) => item.id === receipt.id)!);
  assert.equal(d.transactions.length, 0);
});

test("both sides of a manual cash transfer stay in sync when editing either leg", () => {
  const withdraw = tx("out", "bank", "sell", 100, { kind: "transfer", linkedTransactionId: "in" });
  const deposit = tx("in", "hami", "buy", 100, { kind: "transfer", linkedTransactionId: "out" });
  const d = upsertTransaction(fixture([withdraw, deposit]), { ...deposit, totalPrice: 110, quantity: 110, date: "2026-11-02" }, []);
  assert.equal(d.transactions.length, 2);
  assert.equal(d.transactions.find((item) => item.id === "out")?.totalPrice, 110);
  assert.equal(d.transactions.find((item) => item.id === "out")?.date, "2026-11-02");
  assert.equal(removeTransaction(d, withdraw).transactions.length, 0);
});

test("editing an inferred legacy bank-to-Hami transfer never deletes the other cash row", () => {
  const bankOut = tx("bank-out", "bank", "sell", 1200, { kind: "transfer", date: "2026-05-25" });
  const hamiIn = tx("hami-in", "hami", "buy", 1200, { kind: "transfer", date: "2026-05-25" });
  const d = fixture([bankOut, hamiIn]);
  assert.deepEqual(linkedTransactions(d, bankOut).map((row) => row.id), [hamiIn.id]);
  assert.deepEqual(autoRemovedCounterparts(d, bankOut), []);
  assert.deepEqual(removeTransaction(d, bankOut).transactions, [hamiIn]);
  const edited = upsertTransaction(d, { ...bankOut, totalPrice: 1300, quantity: 1300 }, []);
  assert.deepEqual(edited.transactions.find((row) => row.id === hamiIn.id), hamiIn);
  assert.equal(edited.transactions.length, 2);
  const reclassified = upsertTransaction(d, { ...bankOut, kind: "capital_out" }, []);
  assert.equal(reclassified.transactions.length, 2);
  assert.deepEqual(reclassified.transactions.find((row) => row.id === hamiIn.id), hamiIn);
  const confirmed = upsertTransaction(d, { ...bankOut, destinationAssetId: hamiIn.assetId }, []);
  assert.equal(confirmed.transactions.length, 2);
  assert.equal(confirmed.transactions.find((row) => row.id === hamiIn.id)?.linkedTransactionId, bankOut.id);
});

test("classifying a cash redemption with a legacy destination does not erase its existing receipt", () => {
  const redemption = tx("redemption", "hami", "sell", 100, { destinationAssetId: "bank" });
  const receipt = tx("receipt", "bank", "buy", 100, { kind: "transfer" });
  const d = fixture([redemption, receipt]);
  assert.deepEqual(linkedTransactions(d, redemption).map((row) => row.id), [receipt.id]);
  const saved = upsertTransaction(d, { ...redemption, kind: "capital_out", destinationAssetId: undefined }, []);
  assert.deepEqual(saved.transactions.find((row) => row.id === receipt.id), receipt);
  assert.equal(saved.transactions.length, 2);
  assert.deepEqual(removeTransaction(d, redemption).transactions, [receipt]);
});

test("reclassifying an unlinked trade never silently deletes a uniquely matched legacy cash movement", () => {
  const trade = tx("old-trade", "gold", "sell", 125, { destinationAssetId: "bank" });
  const receipt = tx("old-receipt", "bank", "buy", 125, { kind: "transfer", notes: "واریز حاصل از معامله old-trade" });
  const d = fixture([trade, receipt]);
  assert.deepEqual(linkedTransactions(d, trade).map((row) => row.id), [receipt.id]);
  const classified = upsertTransaction(d, { ...trade, kind: "capital_out", destinationAssetId: undefined }, []);
  assert.deepEqual(classified.transactions.find((row) => row.id === receipt.id), receipt);
  assert.equal(classified.transactions.length, 2);
});

test("stock settlement rows cannot be mistaken for user-created linked transactions", () => {
  const auto = tx("hami-stock-buy-order1", "hami", "sell", 200, { kind: "transfer", notes: "[stock-order:order1]" });
  const d = fixture([auto, tx("trade", "gold", "buy", 200, { sourceAssetId: "hami" })]);
  assert.deepEqual(linkedTransactions(d, d.transactions[1]), []);
});

test("editing a linked transfer keeps the original pair and removing it cleans both attachments", () => {
  const cash = tx("cash", "bank", "sell", 100, {
    kind: "transfer", linkedTransactionId: "trade", attachmentIds: ["cash-file"],
  });
  const trade = tx("trade", "gold", "buy", 100, {
    kind: "trade", sourceAssetId: "bank", linkedTransactionId: "cash", quantity: 1, unitPrice: 100,
  });
  const d = fixture([trade, cash]);
  d.attachments = [{ id: "cash-file", transactionId: "cash", name: "رسید بانک", type: "text/plain", size: 1, data: "x" }];
  const edited = upsertTransaction(d, { ...trade, totalPrice: 120, unitPrice: 120 }, []);
  assert.equal(edited.transactions.find((item) => item.id === "cash")?.attachmentIds[0], "cash-file");
  assert.equal(edited.attachments.length, 1);
  const removedPair = upsertTransaction(edited, { ...trade, kind: "opening_capital", sourceAssetId: undefined, linkedTransactionId: undefined }, []);
  assert.equal(removedPair.transactions.length, 1);
  assert.deepEqual(removedPair.attachments, []);
});

test("several plausible cash legs are not multiplied by editing or saving an unlinked trade", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const cashA = tx("cash-a", "bank", "sell", 100, { kind: "transfer" });
  const cashB = tx("cash-b", "bank", "sell", 100, { kind: "transfer" });
  const d = fixture([trade, cashA, cashB]);
  const updated = upsertTransaction(d, { ...trade, notes: "بررسی شود" }, []);
  assert.deepEqual(new Set(updated.transactions.map((item) => item.id)), new Set(["trade", "cash-a", "cash-b"]));
  assert.equal(updated.transactions.find((item) => item.id === "trade")?.linkedTransactionId, undefined);
  const created = upsertTransaction(fixture([cashA, cashB]), trade, []);
  assert.equal(created.transactions.length, 3);
});

test("an already-linked leg is not reused for another same-amount trade", () => {
  const first = tx("first", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank", linkedTransactionId: "cash" });
  const cash = tx("cash", "bank", "sell", 100, { kind: "transfer", linkedTransactionId: "first" });
  const second = tx("second", "silver", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const d = fixture([first, cash, second]);
  assert.deepEqual(linkedTransactions(d, second), []);
  assert.deepEqual(linkedTransactions(d, first).map((item) => item.id), ["cash"]);
});

test("a legacy note referring to a longer id cannot be paired with a shorter trade id", () => {
  const short = tx("tx-12", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const long = tx("tx-123", "silver", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const cash = tx("cash", "bank", "sell", 100, { kind: "transfer", notes: "برداشت بابت معامله tx-123" });
  const d = fixture([short, long, cash]);
  assert.deepEqual(linkedTransactions(d, short), []);
  assert.deepEqual(linkedTransactions(d, long).map((item) => item.id), ["cash"]);
});

test("a broken explicit link is not overwritten or deleted; correcting the original row can restore it", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank", linkedTransactionId: "cash" });
  const cash = tx("cash", "bank", "sell", 150, {
    date: "2026-11-03", kind: "transfer", linkedTransactionId: "trade",
  });
  const d = fixture([trade, cash]);
  assert.deepEqual(linkedTransactions(d, trade), []);
  assert.deepEqual(linkedTransactions(d, cash), []);
  const saved = upsertTransaction(d, { ...trade, notes: "review" }, []);
  assert.deepEqual(saved.transactions.map((item) => item.id), ["cash", "trade"]);
  assert.deepEqual(saved.transactions.find((item) => item.id === "cash"), cash);
  assert.equal(saved.transactions.find((item) => item.id === "trade")?.linkedTransactionId, "cash");
  assert.deepEqual(removeTransaction(d, trade).transactions, [cash]);
  const corrected = upsertTransaction(d, { ...trade, totalPrice: 150, quantity: 150, date: cash.date }, []);
  assert.deepEqual(linkedTransactions(corrected, corrected.transactions.find((item) => item.id === "trade")!)
    .map((item) => item.id), ["cash"]);
  assert.equal(removeTransaction(corrected, corrected.transactions.find((item) => item.id === "trade")!).transactions.length, 0);
});

test("an explicit pointer to outside capital is not mistaken for a cash settlement", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank", linkedTransactionId: "deposit" });
  const deposit = tx("deposit", "bank", "sell", 100, { kind: "capital_out" });
  const d = fixture([trade, deposit]);
  assert.deepEqual(linkedTransactions(d, trade), []);
  assert.deepEqual(removeTransaction(d, trade).transactions, [deposit]);
  const saved = upsertTransaction(d, { ...trade, notes: "مغایرت دارد" }, []);
  assert.equal(saved.transactions.length, 2);
  assert.deepEqual(saved.transactions.find((item) => item.id === deposit.id), deposit);
});

test("a mismatched reverse-only link or legacy note never generates a third cash movement", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const reverse = tx("reverse", "bank", "sell", 150, { kind: "transfer", linkedTransactionId: "trade" });
  const byNote = tx("note", "bank", "sell", 150, { kind: "transfer", notes: "برداشت بابت معامله trade" });
  for (const other of [reverse, byNote]) {
    const d = fixture([trade, other]);
    assert.deepEqual(linkedTransactions(d, trade), []);
    const saved = upsertTransaction(d, { ...trade, notes: "بررسی مبلغ" }, []);
    assert.equal(saved.transactions.length, 2);
    assert.deepEqual(saved.transactions.find((item) => item.id === other.id), other);
  }
});

test("a stale row object cannot delete another transaction after its own row was removed", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank" });
  const d = fixture([trade, tx("cash", "bank", "sell", 100, { kind: "transfer" })]);
  const once = removeTransaction(d, trade);
  assert.deepEqual(removeTransaction(once, trade), once);
});

test("an invalid date or amount cannot authorize deleting a linked cash receipt", () => {
  const trade = tx("trade", "gold", "buy", 100, { kind: "trade", sourceAssetId: "bank", linkedTransactionId: "cash" });
  const cash = tx("cash", "bank", "sell", 100, { kind: "transfer", linkedTransactionId: "trade" });
  const invalidDate = fixture([{ ...trade, date: "2026-10-32" }, { ...cash, date: "2026-10-32" }]);
  const invalidAmount = fixture([trade, { ...cash, quantity: 0 }]);
  for (const d of [invalidDate, invalidAmount]) {
    assert.deepEqual(linkedTransactions(d, d.transactions[0]), []);
    assert.deepEqual(removeTransaction(d, d.transactions[0]).transactions, [d.transactions[1]]);
  }
});
