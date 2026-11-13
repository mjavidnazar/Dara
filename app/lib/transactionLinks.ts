import { hasValidTradeAmounts, isCashAccount, isGeneratedStockTransfer, uid, validIsoDate } from "./portfolio";
import type { Attachment, PortfolioData, Transaction } from "./types";

/** Legacy trade-created cash rows only had the parent's id in the note. */
function referencesTrade(tx: Transaction, tradeId: string) {
  const note = tx.notes || "";
  return ["برداشت بابت معامله ", "واریز حاصل از معامله ", "deposit-trade:"].some((prefix) => {
    const start = note.indexOf(`${prefix}${tradeId}`);
    if (start < 0) return false;
    const afterId = note[start + prefix.length + tradeId.length];
    // Prevent `tx-12` from borrowing the legacy cash leg of `tx-123`.
    return !afterId || /[\s\]\)\},.،]/.test(afterId);
  });
}

function refersToDifferentTrade(tx: Transaction, tradeId: string) {
  const legacyId = tx.notes?.match(/(?:برداشت بابت معامله |واریز حاصل از معامله |deposit-trade:)([\w-]+)/)?.[1];
  return Boolean(legacyId && legacyId !== tradeId);
}

export function linkedTransactions(data: PortfolioData, tx: Transaction): Transaction[] {
  if (isGeneratedStockTransfer(tx) ||
      (tx.kind && tx.kind !== "trade" && tx.kind !== "transfer")) return [];
  const txAsset = data.assets.find((asset) => asset.id === tx.assetId);
  const expectedId = tx.type === "buy" ? tx.sourceAssetId : tx.destinationAssetId;
  const compatible = (other: Transaction) => {
    const otherAsset = data.assets.find((asset) => asset.id === other.assetId);
    const otherExpected = other.type === "buy" ? other.sourceAssetId : other.destinationAssetId;
    return other.id !== tx.id && other.assetId !== tx.assetId && other.type !== tx.type &&
      !isGeneratedStockTransfer(other) &&
      (!other.kind || other.kind === "trade" || other.kind === "transfer") &&
      (tx.kind === "transfer" || other.kind === "transfer") &&
      (isCashAccount(txAsset) || isCashAccount(otherAsset)) &&
      hasValidTradeAmounts(tx) && hasValidTradeAmounts(other) &&
      validIsoDate(tx.date) && validIsoDate(other.date) &&
      other.date === tx.date && Math.abs(other.totalPrice - tx.totalPrice) < 1 &&
      (!expectedId || other.assetId === expectedId) &&
      (!otherExpected || otherExpected === tx.assetId) &&
      (!other.linkedTransactionId || other.linkedTransactionId === tx.id) &&
      !refersToDifferentTrade(other, tx.id) && !refersToDifferentTrade(tx, other.id);
  };
  const candidates = data.transactions.filter(compatible);
  const explicit = candidates.filter((other) =>
    (tx.linkedTransactionId ? tx.linkedTransactionId === other.id :
      other.linkedTransactionId === tx.id || referencesTrade(other, tx.id) || referencesTrade(tx, other.id))
  );
  // A wrong or ambiguous explicit link is NOT permission to rewrite/delete a
  // same-amount deposit. Leave both original rows intact for manual reconciliation.
  if (tx.linkedTransactionId || explicit.length) return explicit.length === 1 ? explicit : [];
  if (data.transactions.some((other) => other.linkedTransactionId === tx.id || referencesTrade(other, tx.id))) return [];
  // For old unlinked rows, infer only a unique opposite cash movement; never use
  // a stock settlement or an already-linked leg of somebody else's trade.
  const inferred = candidates.filter((other) =>
    expectedId ? other.kind === "transfer" :
      ((other.type === "buy" ? other.sourceAssetId : other.destinationAssetId) === tx.assetId && tx.kind === "transfer") ||
      (tx.kind === "transfer" && other.kind === "transfer")
  );
  return inferred.length === 1 ? inferred : [];
}

export function autoRemovedCounterparts(data: PortfolioData, tx: Transaction): Transaction[] {
  // An unlinked, same-day cash-to-cash match is only a reconciliation clue;
  // deleting one leg must not quietly delete the other account's historical row.
  const txAsset = data.assets.find((asset) => asset.id === tx.assetId);
  return linkedTransactions(data, tx).filter((other) =>
    !isCashAccount(txAsset) || !isCashAccount(data.assets.find((asset) => asset.id === other.assetId)) ||
    (tx.linkedTransactionId === other.id && other.linkedTransactionId === tx.id));
}

export function removeTransaction(data: PortfolioData, tx: Transaction): PortfolioData {
  const existing = data.transactions.find((item) => item.id === tx.id);
  if (!existing) return data;
  const removed = [existing, ...autoRemovedCounterparts(data, existing)];
  const ids = new Set(removed.map((item) => item.id));
  const attachmentIds = new Set(removed.flatMap((item) => item.attachmentIds || []));
  return {
    ...data,
    transactions: data.transactions.filter((item) => !ids.has(item.id)),
    attachments: data.attachments.filter((item) => !ids.has(item.transactionId) && !attachmentIds.has(item.id)),
  };
}

/** Save the trade and its cash side together. Re-editing never leaves a second cash leg. */
export function upsertTransaction(
  data: PortfolioData,
  tx: Transaction,
  attachments: Attachment[],
): PortfolioData {
  const old = data.transactions.find((item) => item.id === tx.id);
  const oldPairs = old ? linkedTransactions(data, old) : [];
  const brokenReference = Boolean(old && oldPairs.length === 0 && (old.linkedTransactionId ||
    data.transactions.some((item) => item.id !== old.id &&
      (item.linkedTransactionId === old.id || referencesTrade(item, old.id)))));
  // Older transfers had no link id (e.g. a bank receipt from selling gold). Reuse a
  // uniquely matching cash leg when the owner selects the account, instead of adding a
  // second receipt and silently doubling the balance.
  const oldAccountId = old?.type === "buy" ? old.sourceAssetId : old?.destinationAssetId;
  const selectedAccountId = tx.type === "buy" ? tx.sourceAssetId : tx.destinationAssetId;
  const pairAccountId = oldAccountId || selectedAccountId;
  let ambiguousLegacyPair = false;
  if (oldPairs.length === 0 && !brokenReference && pairAccountId) {
    const original = old ?? tx;
    const candidates = data.transactions.filter((item) =>
      item.id !== original.id && item.assetId === pairAccountId && item.kind === "transfer" &&
      !item.linkedTransactionId && !isGeneratedStockTransfer(item) &&
      !refersToDifferentTrade(item, original.id) &&
      item.type !== original.type && item.date === original.date &&
      Math.abs(item.totalPrice - original.totalPrice) < 1
    );
    if (candidates.length === 1) oldPairs.push(candidates[0]);
    // Never manufacture a THIRD cash movement if several old rows could already
    // settle this trade. Keep the ambiguity visible in the audit for the owner.
    if (candidates.length > 1) ambiguousLegacyPair = true;
  }
  const pairIds = new Set(oldPairs.map((item) => item.id));
  let updated = { ...tx };
  let pair: Transaction | undefined;

  if (brokenReference && (tx.kind === "trade" || tx.kind === "transfer")) {
    // A previously mismatched link may be repaired by editing the owner's row to
    // match the existing cash leg. Never create a second cash leg or overwrite the
    // mismatched one merely because this row was saved.
    updated = { ...tx, linkedTransactionId: old?.linkedTransactionId };
  } else if (ambiguousLegacyPair && selectedAccountId) {
    updated = { ...tx, kind: tx.kind === "transfer" ? "transfer" : "trade", linkedTransactionId: undefined };
  } else if ((tx.type === "buy" && tx.sourceAssetId) || (tx.type === "sell" && tx.destinationAssetId)) {
    const cashAssetId = tx.type === "buy" ? tx.sourceAssetId! : tx.destinationAssetId!;
    const oldPair = oldPairs.find((item) => item.assetId === cashAssetId) || oldPairs[0];
    const pairId = oldPair?.id || uid("tx-pair");
    updated = { ...tx, kind: tx.kind === "transfer" ? "transfer" : "trade", linkedTransactionId: pairId };
    pair = {
      id: pairId,
      assetId: cashAssetId,
      type: tx.type === "buy" ? "sell" : "buy",
      quantity: tx.totalPrice,
      unitPrice: 1,
      totalPrice: tx.totalPrice,
      date: tx.date,
      notes: tx.type === "buy" ? `برداشت بابت معامله ${tx.id}` : `واریز حاصل از معامله ${tx.id}`,
      attachmentIds: oldPair?.attachmentIds || [],
      kind: "transfer",
      linkedTransactionId: tx.id,
      createdAt: oldPair?.createdAt || tx.createdAt,
    };
  } else if (old?.kind === "transfer" && old.linkedTransactionId && oldPairs.length === 1 &&
    oldPairs[0].kind === "transfer" && !oldPairs[0].sourceAssetId && !oldPairs[0].destinationAssetId && tx.kind === "transfer") {
    // Editing either side of an explicitly paired cash-to-cash transfer updates the other.
    const other = oldPairs[0];
    updated = { ...tx, linkedTransactionId: other.id };
    pair = {
      ...other,
      type: tx.type === "buy" ? "sell" : "buy",
      quantity: tx.totalPrice,
      unitPrice: 1,
      totalPrice: tx.totalPrice,
      date: tx.date,
      linkedTransactionId: tx.id,
    };
  } else if (old && oldPairs.length === 1 && !selectedAccountId &&
      (old.linkedTransactionId !== oldPairs[0].id || oldPairs[0].linkedTransactionId !== old.id)) {
    // A uniquely matching *legacy* pair is a clue, not permission to erase the
    // other account's real cash movement on an unrelated classification/edit.
    // In particular this protects bank-to-fund rows without reciprocal ids,
    // and trades with a cash receipt identified by an old note or amount.
    pairIds.clear();
    updated = { ...tx, linkedTransactionId: undefined };
  } else {
    // Reclassifying an explicitly linked trade removes its generated cash leg.
    updated = { ...tx, linkedTransactionId: undefined };
  }

  return {
    ...data,
    transactions: [
      ...data.transactions.filter((item) => item.id !== tx.id && !pairIds.has(item.id)),
      updated,
      ...(pair ? [pair] : []),
    ],
    attachments: [
      ...data.attachments.filter((item) => item.transactionId !== tx.id &&
        (!pairIds.has(item.transactionId) || item.transactionId === pair?.id)),
      ...attachments,
    ],
  };
}
