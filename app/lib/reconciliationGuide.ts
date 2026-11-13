import {
  hasValidTradeAmounts,
  isCashAccount,
  isGeneratedStockTransfer,
  todayIso,
  validIsoDate,
} from "./portfolio";
import { linkedTransactions } from "./transactionLinks";
import type { PortfolioData, Transaction } from "./types";

/** These are questions for the owner, never inferred or booked as outside capital. */
export interface FundingCandidate {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  amount: number;
  description: string;
  source: "cash_credit" | "purchase";
}

export interface RelatedMovement {
  target: { type: "transaction" | "stockOrder"; id: string };
  assetId: string;
  label: string;
  date: string;
  amount: number;
  /** Only reciprocal pointers or a generated order are definite *ledger* links. */
  evidence: "explicit" | "matching_rows" | "stock_order";
}

export interface DayDebit {
  id: string;
  description: string;
  amount: number;
  related: RelatedMovement | null;
}

export interface CashShortfall {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  /** Primary debit (or a representative when several debits could have caused the crossing). */
  triggerId: string;
  triggerDescription: string;
  /** End-of-day balance *without* the primary debit; not necessarily the intraday running balance. */
  balanceBefore: number;
  outflow: number;
  /** End-of-day balance with all that day's rows. */
  balanceAfter: number;
  dayStartBalance: number;
  dayCredits: number;
  dayDebits: DayDebit[];
  dayRowCount: number;
  /** When >1, the ledger cannot single out a definite debit without a time-stamped statement. */
  attributionCandidates: string[];
  lowestBalance: number;
  lowestDate: string;
  recoveredOn: string | null;
  currentBalance: number;
  earlierCreditCount: number;
  precedingAdjustments: number;
  related: RelatedMovement | null;
}

const EPSILON = 0.01;
const isValidAt = (tx: Transaction, date: string) =>
  validIsoDate(tx.date) && tx.date <= date && hasValidTradeAmounts(tx);
const signed = (tx: Transaction) => (tx.type === "buy" ? 1 : -1) * tx.totalPrice;

/** The other side of a ledger row is evidence of *where it went*, not where it came from. */
function relatedMovement(data: PortfolioData, tx: Transaction): RelatedMovement | null {
  if (isGeneratedStockTransfer(tx)) {
    const orderId = tx.notes?.match(/\[stock-order:([^\]]+)\]/)?.[1] ||
      tx.id.replace(/^hami-stock-(buy|sell|sale)-/, "");
    const order = data.stockOrders.find((item) => item.id === orderId && item.date === tx.date &&
      Math.abs(item.totalPrice - tx.totalPrice) < 1 && item.type !== tx.type);
    return order ? {
      target: { type: "stockOrder", id: order.id }, assetId: tx.assetId,
      label: `سفارش ${order.type === "buy" ? "خرید" : "فروش"} بورس / ${order.symbol}`,
      date: order.date, amount: order.totalPrice, evidence: "stock_order",
    } : null;
  }
  const pairs = linkedTransactions(data, tx);
  if (pairs.length !== 1) return null;
  const pair = pairs[0];
  const asset = data.assets.find((item) => item.id === pair.assetId);
  return {
    target: { type: "transaction", id: pair.id }, assetId: pair.assetId,
    label: `${asset?.name || "حساب/دارایی نامشخص"} · ${pair.type === "buy" ? "واریز/خرید" : "برداشت/فروش"}`,
    date: pair.date, amount: pair.totalPrice,
    evidence: tx.linkedTransactionId === pair.id && pair.linkedTransactionId === tx.id
      ? "explicit" : "matching_rows",
  };
}

/** Read-only provenance review, starting with the oldest unresolved inflows. */
export function findFundingCandidates(data: PortfolioData, asOf = todayIso()): FundingCandidate[] {
  const result: FundingCandidate[] = [];
  for (const tx of data.transactions) {
    if (!isValidAt(tx, asOf) || tx.type !== "buy" ||
        (tx.kind && tx.kind !== "trade") || tx.sourceAssetId || tx.linkedTransactionId ||
        isGeneratedStockTransfer(tx) || linkedTransactions(data, tx).length) continue;
    const asset = data.assets.find((item) => item.id === tx.assetId);
    if (!asset) continue;
    // A legacy receipt labelled as the settlement of a sale is NOT a candidate
    // opening deposit, even when its link was broken or a second credit exists.
    if (isCashAccount(asset) && /(?:واریز حاصل از معامله|برداشت بابت معامله|\[stock-order:)/.test(tx.notes || "")) continue;
    result.push({
      id: tx.id, assetId: tx.assetId, assetName: asset.name,
      date: tx.date, amount: tx.totalPrice,
      source: isCashAccount(asset) ? "cash_credit" : "purchase",
      description: tx.notes?.trim() || "بدون توضیح ثبت‌شده",
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** One episode per consecutive negative *day-end* balance; within-day entry order is not assumed. */
export function traceCashShortfalls(data: PortfolioData, asOf = todayIso()): CashShortfall[] {
  const result: CashShortfall[] = [];
  for (const asset of data.assets.filter(isCashAccount)) {
    // `createdAt` can be weeks after the transaction's date (backfilled entries).
    // It is NOT evidence of the order in which same-day trades really settled.
    const rows = data.transactions.filter((tx) => tx.assetId === asset.id && isValidAt(tx, asOf))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let balance = 0;
    let earlierCreditCount = 0;
    let precedingAdjustments = 0;
    let active: CashShortfall | null = null;
    const episodes: CashShortfall[] = [];
    for (let offset = 0; offset < rows.length;) {
      const date = rows[offset].date;
      const dayStart = balance;
      const dayRows: Transaction[] = [];
      while (offset < rows.length && rows[offset].date === date) dayRows.push(rows[offset++]);
      const dayCredits = dayRows.filter((tx) => tx.type === "buy")
        .reduce((sum, tx) => sum + tx.totalPrice, 0);
      const debitRows = dayRows.filter((tx) => tx.type === "sell");
      balance = dayRows.reduce((sum, tx) => sum + signed(tx), dayStart);

      if (!active && dayStart >= -EPSILON && balance < -EPSILON && debitRows.length) {
        // If removing exactly one debit would eliminate the day-end shortfall,
        // it is the necessary debit independent of same-day ordering. Otherwise
        // surface every plausible debit instead of inventing a time sequence.
        const necessary = debitRows.filter((tx) => balance + tx.totalPrice >= -EPSILON);
        const candidates = necessary.length ? necessary : debitRows;
        const primary = [...candidates].sort((a, b) => b.totalPrice - a.totalPrice || a.id.localeCompare(b.id))[0];
        const dayDebits = debitRows.map((tx) => ({
          id: tx.id, description: tx.notes?.trim() || "بدون شرح ثبت‌شده",
          amount: tx.totalPrice, related: relatedMovement(data, tx),
        }));
        active = {
          id: `${asset.id}-${primary.id}`, accountId: asset.id, accountName: asset.name,
          date, triggerId: primary.id, triggerDescription: primary.notes?.trim() || "بدون شرح ثبت‌شده",
          balanceBefore: balance + primary.totalPrice, outflow: primary.totalPrice,
          balanceAfter: balance, dayStartBalance: dayStart, dayCredits, dayDebits,
          dayRowCount: dayRows.length, attributionCandidates: candidates.map((tx) => tx.id),
          lowestBalance: balance, lowestDate: date, recoveredOn: null, currentBalance: balance,
          earlierCreditCount, precedingAdjustments, related: relatedMovement(data, primary),
        };
      }
      if (active) {
        if (balance < active.lowestBalance) {
          active.lowestBalance = balance;
          active.lowestDate = date;
        }
        if (balance >= -EPSILON) {
          active.recoveredOn = date;
          episodes.push(active);
          active = null;
        }
      }
      earlierCreditCount += dayRows.filter((tx) => tx.type === "buy").length;
      precedingAdjustments += dayRows.filter((tx) => tx.kind === "balance_adjustment").length;
    }
    if (active) episodes.push(active);
    for (const episode of episodes) {
      episode.currentBalance = balance;
      result.push(episode);
    }
  }
  // Prioritize the missing bank opening, then the oldest other negative episode.
  return result.sort((a, b) =>
    Number(b.accountName.includes("بانک")) - Number(a.accountName.includes("بانک")) ||
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
