import type { CapitalReport } from "./capitalReport";
import { assetMode } from "./portfolio";
import type { AssetMetric } from "./types";

export interface ReportOverview {
  // Gross external contributions: withdrawals are displayed separately, never
  // silently deducted from the realized-profit ratio's denominator.
  grossCapital: number | null;
  realizedProfit: number | null;
  combinedProfit: number | null;
  currentMarketValue: number | null;
  currentValueAtPurchase: number | null;
  realizedToCapitalPercent: number | null;
  marketPlusRealizedToInitialPercent: number | null;
  profitComponentsMatch: boolean;
}

const finiteOrNull = (value: number): number | null => Number.isFinite(value) ? value : null;
const closeEnough = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-12);

/** Read-only summary of the same presented metrics used by the dashboard and capital audit. */
export function calculateReportOverview(
  metrics: AssetMetric[],
  report: Pick<CapitalReport, "initialCapital" | "additionalCapital">,
  currentMarketValue: number,
  dashboardTotalProfit: number,
): ReportOverview {
  const grossCapital = report.initialCapital === null || report.initialCapital < 0 || report.additionalCapital < 0
    ? null : finiteOrNull(report.initialCapital + report.additionalCapital);
  const realizedProfit = finiteOrNull(metrics.reduce((sum, item) => sum + item.realizedProfit, 0));

  // Remaining noncash holdings use their recorded weighted-average cost basis
  // (including the open stock position). Cash has no purchase price: carry its
  // actual signed balance at face value, including credited interest and debt.
  // Fully sold positions do not add their historical purchase cost again.
  const currentValueAtPurchase = finiteOrNull(metrics.reduce((sum, item) => sum + (
    assetMode(item.asset) === "cash" ? item.marketValue : item.quantity > 0 ? item.costBasis : 0
  ), 0));
  const combinedProfit = finiteOrNull(metrics.reduce(
    (sum, item) => sum + item.realizedProfit + item.unrealizedProfit, 0
  ));
  const safeMarket = finiteOrNull(currentMarketValue);
  const hasCapital = grossCapital !== null && grossCapital > 0;
  const initialCapital = report.initialCapital;
  const hasInitialCapital = initialCapital !== null && Number.isFinite(initialCapital) && initialCapital > 0;
  const marketPlusRealized = safeMarket !== null && realizedProfit !== null
    ? finiteOrNull(safeMarket + realizedProfit) : null;

  return {
    grossCapital,
    realizedProfit,
    combinedProfit,
    currentMarketValue: safeMarket,
    currentValueAtPurchase,
    realizedToCapitalPercent: hasCapital && realizedProfit !== null ? finiteOrNull(realizedProfit / grossCapital * 100) : null,
    // This is the user's literal formula, NOT net equity or a time-weighted
    // return: realized gains still held as cash may already be in market value.
    marketPlusRealizedToInitialPercent: hasInitialCapital && marketPlusRealized !== null
      ? finiteOrNull(marketPlusRealized / initialCapital * 100) : null,
    // A special account can disagree with its own profit breakdown. Compare
    // both each position AND the overall dashboard total: compensating errors
    // must not make a contradictory sum look verified.
    profitComponentsMatch: combinedProfit !== null && closeEnough(combinedProfit, dashboardTotalProfit) &&
      metrics.every((item) => closeEnough(item.realizedProfit + item.unrealizedProfit, item.totalProfit)),
  };
}
