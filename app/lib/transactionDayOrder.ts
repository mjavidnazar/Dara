import { validIsoDate } from "./portfolio";
import type { PortfolioData } from "./types";

export type DayRowPosition = "before" | "after";
type DayOrder = Record<string, string[]>;

export interface LedgerOrderRow {
  date: string;
  orderKey: string;
}

/** The prefixes keep a transaction and a stock order with the same ID distinct. */
export function ledgerRowKey(source: "transaction" | "stockOrder", id: string): string {
  return `${source}:${id}`;
}

/** Matches the unified transactions table's initial order, without touching either ledger. */
export function ledgerOrderRows(data: Pick<PortfolioData, "transactions" | "stockOrders">): LedgerOrderRow[] {
  return [
    ...data.stockOrders.filter((order) => typeof order.id === "string" && order.id.length > 0)
      .map((order) => ({ date: order.date, orderKey: ledgerRowKey("stockOrder", order.id) })),
    ...data.transactions.filter((tx) => typeof tx.id === "string" && tx.id.length > 0)
      .map((tx) => ({ date: tx.date, orderKey: ledgerRowKey("transaction", tx.id) })),
  ];
}

/** Ignore malformed backup metadata; never turn it into a transaction or a trade time. */
export function sanitizeTransactionDayOrder(raw: unknown): DayOrder | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const cleaned: DayOrder = {};
  for (const [date, keys] of Object.entries(raw)) {
    if (!validIsoDate(date) || !Array.isArray(keys)) continue;
    const unique = [...new Set(keys.filter((key): key is string =>
      typeof key === "string" && /^(?:transaction|stockOrder):.+$/.test(key)))];
    if (unique.length) cleaned[date] = unique;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

/** A manual tie-breaker only. Date sorting is performed by the caller first. */
export function compareRowsWithinDay(
  order: DayOrder | undefined,
  a: LedgerOrderRow,
  b: LedgerOrderRow,
): number {
  if (a.date !== b.date) return 0;
  const day = order?.[a.date];
  if (!day) return 0;
  const first = day.indexOf(a.orderKey);
  const second = day.indexOf(b.orderKey);
  if (first < 0) return second < 0 ? 0 : 1;
  if (second < 0) return -1;
  return first - second;
}

/**
 * Move one visible ledger row before/after another on the *same* date.
 * Only settings change: financial rows, linked IDs, dates and audit math remain intact.
 * Unknown or duplicate IDs cannot be safely identified and are ignored.
 */
export function reorderRowsWithinDay(
  data: PortfolioData,
  sourceKey: string,
  targetKey: string,
  position: DayRowPosition,
): PortfolioData {
  if (sourceKey === targetKey || (position !== "before" && position !== "after")) return data;
  const rows = ledgerOrderRows(data);
  const source = rows.filter((row) => row.orderKey === sourceKey);
  const target = rows.filter((row) => row.orderKey === targetKey);
  if (source.length !== 1 || target.length !== 1 ||
      !validIsoDate(source[0].date) || source[0].date !== target[0].date) return data;

  const date = source[0].date;
  const dayRows = rows.filter((row) => row.date === date);
  // A rank for one duplicated key would move both indistinguishable rows on
  // reload. Refuse to write ambiguous metadata for the whole day instead.
  if (new Set(dayRows.map((row) => row.orderKey)).size !== dayRows.length) return data;
  const existing = dayRows
    .sort((a, b) => compareRowsWithinDay(data.settings.transactionDayOrder, a, b))
    .map((row) => row.orderKey);
  const moved = existing.filter((key) => key !== sourceKey);
  const at = moved.indexOf(targetKey);
  moved.splice(at + (position === "after" ? 1 : 0), 0, sourceKey);
  if (moved.every((key, index) => key === existing[index])) return data;

  return {
    ...data,
    settings: {
      ...data.settings,
      transactionDayOrder: { ...data.settings.transactionDayOrder, [date]: moved },
    },
  };
}
