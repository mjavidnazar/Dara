import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportOverviewPanel } from "../components/ReportOverviewPanel";
import { ReportsView } from "../components/Views";
import { analyzeCapital } from "./capitalReport";
import { appendAssetPrices } from "./priceHistory";
import { calculateBourseSummary, emptyData, metricsAt, money, stockMetrics, syncStockCashTransfers } from "./portfolio";
import { calculateReportOverview } from "./reportOverview";
import type { Asset, AssetMetric, PortfolioData, Transaction } from "./types";

const asOf = "2026-11-11";
const bank: Asset = { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#888", createdAt: "2026-11-01" };
const gold: Asset = { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 120, color: "#b83", createdAt: "2026-11-01" };
const bourse: Asset = { id: "bourse", name: "بورس", category: "بورس", currentPrice: 0, color: "#34a", createdAt: "2026-11-01" };

function tx(id: string, assetId: string, type: "buy" | "sell", amount: number, day: string, options: Partial<Transaction> = {}): Transaction {
  return { id, assetId, type, quantity: amount, unitPrice: 1, totalPrice: amount,
    date: day, createdAt: `${day}T10:00:00Z`, attachmentIds: [], ...options };
}

function portfolio(): PortfolioData {
  const data: PortfolioData = { ...emptyData(), assets: [bank, gold, bourse], transactions: [
    tx("opening", bank.id, "buy", 1000, "2026-11-01", { kind: "opening_capital" }),
    tx("added", bank.id, "buy", 200, "2026-11-02", { kind: "capital_in" }),
    tx("withdrawn", bank.id, "sell", 100, "2026-11-03", { kind: "capital_out" }),
    tx("gold-buy", gold.id, "buy", 200, "2026-11-04", { quantity: 2, unitPrice: 100, kind: "trade", sourceAssetId: bank.id, linkedTransactionId: "gold-debit" }),
    tx("gold-debit", bank.id, "sell", 200, "2026-11-04", { kind: "transfer", linkedTransactionId: "gold-buy" }),
    tx("gold-sell", gold.id, "sell", 150, "2026-11-05", { quantity: 1, unitPrice: 150, kind: "trade", destinationAssetId: bank.id, linkedTransactionId: "gold-credit" }),
    tx("gold-credit", bank.id, "buy", 150, "2026-11-05", { kind: "transfer", linkedTransactionId: "gold-sell" }),
    tx("bank-interest", bank.id, "buy", 20, "2026-11-06", { kind: "interest" }),
    tx("bank-fee", bank.id, "sell", 5, "2026-11-06", { kind: "fee" }),
    tx("paid-receipt", bank.id, "buy", 10, "2026-11-09", { kind: "stock_dividend", stockDividendId: "paid" }),
  ], prices: [{ id: "gold-quote", assetId: gold.id, date: "2026-11-10", price: 120 }],
  stockOrders: [
    { id: "stock-buy", symbol: "آزمایش", date: "2026-11-07", type: "buy", quantity: 2, unitPrice: 100, totalPrice: 200, sourceAssetId: bank.id },
    { id: "stock-sell", symbol: "آزمایش", date: "2026-11-08", type: "sell", quantity: 1, unitPrice: 130, totalPrice: 130, sourceAssetId: bank.id },
  ], stockPrices: [{ id: "stock-quote", symbol: "آزمایش", date: "2026-11-10", price: 140 }],
  stockDividends: [
    { id: "paid", symbol: "آزمایش", date: "2026-11-09", amount: 10, status: "paid" },
    { id: "pending", symbol: "آزمایش", date: "2026-11-10", amount: 5, status: "pending" },
  ] };
  return { ...data, transactions: syncStockCashTransfers(data.transactions, data.stockOrders, data.assets) };
}

function evaluated(data: PortfolioData) {
  const stocks = stockMetrics(data.stockOrders, data.stockPrices, data.stockDividends);
  const stockSummary = calculateBourseSummary(stocks, data.stockOrders, data.assets, data.transactions, data.prices);
  const metrics: AssetMetric[] = metricsAt(data.assets, data.transactions, data.prices).map((item) =>
    item.asset.id === bourse.id ? { ...item,
      costBasis: stockSummary.currentCost, marketValue: stockSummary.currentValue,
      realizedProfit: stockSummary.realizedProfit, unrealizedProfit: stockSummary.unrealizedProfit,
      totalProfit: stockSummary.toDateProfit } : item);
  const market = metrics.reduce((sum, item) => sum + item.marketValue, 0);
  const profit = metrics.reduce((sum, item) => sum + item.totalProfit, 0);
  const audit = analyzeCapital(data, market, profit, asOf);
  return { audit, metrics, overview: calculateReportOverview(metrics, audit, market, profit) };
}

test("realized ratio uses gross contributions; new market-plus-realized ratio uses opening capital only", () => {
  const data = portfolio();
  const before = JSON.stringify(data);
  const { audit, overview, metrics } = evaluated(data);
  assert.equal(audit.isReliable, true, audit.issues.map((issue) => issue.id).join(", "));
  assert.deepEqual([audit.initialCapital, audit.additionalCapital, audit.withdrawals, audit.netCapital], [1000, 200, 100, 1100]);
  assert.equal(metrics[0].marketValue, 1005); // cash: 1000 + 200 - 100 + 20 - 5 - 200 + 150 - 200 + 130 + 10
  assert.equal(metrics[1].costBasis, 100); // one remaining unit; the sold unit is not counted again
  assert.equal(metrics[2].costBasis, 100); // one remaining share, including stock settlement costs
  assert.equal(overview.grossCapital, 1200); // withdrawals do not reduce the selected denominator
  assert.equal(overview.realizedProfit, 105); // gold sale 50 + stock sale 30 + paid dividend 10 + cash interest/fee 15
  assert.equal(overview.combinedProfit, 170); // + gold 20 + open stock 40 + pending dividend 5
  assert.equal(overview.currentMarketValue, 1265);
  assert.equal(overview.currentValueAtPurchase, 1205); // cash at face 1005 + gold cost 100 + stock cost 100
  assert.equal(overview.realizedToCapitalPercent, 8.75);
  assert.equal(overview.marketPlusRealizedToInitialPercent, 137); // (1265 current cash/holdings + 105 realized) / 1000 opening
  assert.equal(overview.profitComponentsMatch, true);
  assert.equal(JSON.stringify(data), before, "the report must not modify transactions or quotes");

  const updated = appendAssetPrices(data, [{ id: "new-gold", assetId: gold.id, date: "2026-11-10", price: 150 }], asOf);
  const fresh = evaluated(updated).overview;
  assert.equal(fresh.grossCapital, 1200);
  assert.equal(fresh.realizedProfit, 105);
  assert.equal(fresh.currentValueAtPurchase, 1205);
  assert.equal(fresh.currentMarketValue, 1295);
  assert.equal(fresh.combinedProfit, 200);
  assert.equal(fresh.marketPlusRealizedToInitialPercent, 140); // only market changes when today's quote changes
});

test("unknown or zero opening capital never silently becomes a zero denominator or a made-up percentage", () => {
  const { metrics, overview } = evaluated(portfolio());
  const missing = calculateReportOverview(metrics, { initialCapital: null, additionalCapital: 200 }, 1265, 170);
  assert.equal(missing.grossCapital, null);
  assert.equal(missing.realizedToCapitalPercent, null);
  assert.equal(missing.marketPlusRealizedToInitialPercent, null);
  assert.equal(missing.currentMarketValue, overview.currentMarketValue);
  assert.equal(missing.currentValueAtPurchase, overview.currentValueAtPurchase);
  const empty = calculateReportOverview([], { initialCapital: 0, additionalCapital: 0 }, 0, 0);
  assert.equal(empty.grossCapital, 0);
  assert.equal(empty.realizedToCapitalPercent, null);
  assert.equal(empty.marketPlusRealizedToInitialPercent, null);
  const onlyAdditional = calculateReportOverview([], { initialCapital: 0, additionalCapital: 200 }, 0, 0);
  assert.equal(onlyAdditional.grossCapital, 200);
  assert.equal(onlyAdditional.realizedToCapitalPercent, 0);
  assert.equal(onlyAdditional.marketPlusRealizedToInitialPercent, null, "later contributions cannot substitute for initial capital");
  assert.equal(calculateReportOverview([], { initialCapital: null, additionalCapital: 0 }, 0, 0).grossCapital, null);
});

test("cash debt stays signed, fully sold positions do not inflate the open-cost amount, and invalid totals are not displayed as zero", () => {
  const debt: AssetMetric = metricsAt([bank], [tx("debit", bank.id, "sell", 100, "2026-11-02")], [], asOf)[0];
  const sold: AssetMetric = metricsAt([gold], [
    tx("buy", gold.id, "buy", 100, "2026-11-01", { quantity: 1, unitPrice: 100 }),
    tx("sell", gold.id, "sell", 120, "2026-11-02", { quantity: 1, unitPrice: 120 }),
  ], [], asOf)[0];
  const result = calculateReportOverview([debt, sold], { initialCapital: 100, additionalCapital: 0 }, 20, 20);
  assert.equal(result.currentValueAtPurchase, -100, "debt is not clipped to zero; sold assets have no remaining book value");
  assert.equal(result.realizedProfit, 20);
  assert.equal(result.realizedToCapitalPercent, 20);
  assert.equal(result.marketPlusRealizedToInitialPercent, 40); // signed cash debt is included in the provided market total
  const invalid = calculateReportOverview([debt, sold], { initialCapital: 100, additionalCapital: 0 }, Infinity, NaN);
  assert.equal(invalid.currentMarketValue, null);
  assert.equal(invalid.combinedProfit, 20, "finite components can still be shown as raw while the dashboard is invalid");
  assert.equal(invalid.marketPlusRealizedToInitialPercent, null);
  assert.equal(invalid.profitComponentsMatch, false);
  const broken = calculateReportOverview([{ ...sold, realizedProfit: NaN }],
    { initialCapital: 100, additionalCapital: 0 }, 20, 20);
  assert.equal(broken.realizedProfit, null);
  assert.equal(broken.combinedProfit, null);
  assert.equal(broken.realizedToCapitalPercent, null);
  assert.equal(broken.marketPlusRealizedToInitialPercent, null);
  assert.equal(broken.profitComponentsMatch, false);
  const overflowingNumerator = calculateReportOverview([{ ...sold, realizedProfit: Number.MAX_VALUE }],
    { initialCapital: 100, additionalCapital: 0 }, Number.MAX_VALUE, Number.MAX_VALUE);
  assert.equal(overflowingNumerator.marketPlusRealizedToInitialPercent, null,
    "an overflowing market-plus-realized numerator must not display a fabricated percentage");
});

test("copy-trading snapshots use recorded capital cost rather than treating a changed USD balance as a cash withdrawal", () => {
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", color: "#088", currentPrice: 50,
    copyUsdBalance: 5, copyUsdRate: 50, lastValuationAt: "2026-11-10", createdAt: "2026-11-01" };
  const [metric] = metricsAt([copy], [tx("fund", copy.id, "buy", 300, "2026-11-01", { quantity: 10, unitPrice: 30 })], [], asOf);
  assert.equal(metric.marketValue, 250);
  assert.equal(metric.averageCost * metric.quantity, 150);
  assert.equal(metric.costBasis, 300);
  const overview = calculateReportOverview([metric], { initialCapital: 300, additionalCapital: 0 }, metric.marketValue, metric.totalProfit);
  assert.equal(overview.currentValueAtPurchase, 300);
  assert.equal(overview.combinedProfit, -50);
});

test("an inconsistent legacy profit breakdown is flagged rather than presented as reconciled", () => {
  const copy: Asset = { id: "copy", name: "کپی ترید", category: "کپی ترید", color: "#088", currentPrice: 100,
    copyUsdBalance: 0, copyUsdRate: 100, lastValuationAt: "2026-11-10", createdAt: "2026-11-01" };
  const [metric] = metricsAt([copy], [
    tx("fund", copy.id, "buy", 100, "2026-11-01", { quantity: 10, unitPrice: 10 }),
    tx("exit", copy.id, "sell", 150, "2026-11-10", { quantity: 10, unitPrice: 15 }),
  ], [], asOf);
  assert.equal(metric.realizedProfit, 50);
  assert.equal(metric.totalProfit, 0); // existing special-account calculation is inconsistent here
  const overview = calculateReportOverview([metric], { initialCapital: 100, additionalCapital: 0 }, metric.marketValue, metric.totalProfit);
  assert.equal(overview.realizedProfit, 50);
  assert.equal(overview.combinedProfit, 50, "the requested indicator sums realized and unrealized even when the dashboard disagrees");
  assert.equal(overview.profitComponentsMatch, false);

  const { metrics } = evaluated(portfolio());
  const compensatingErrors = metrics.map((item, index) => index < 2
    ? { ...item, totalProfit: item.totalProfit + (index === 0 ? 10 : -10) }
    : item);
  assert.equal(calculateReportOverview(compensatingErrors, { initialCapital: 100, additionalCapital: 0 },
    1265, 170).profitComponentsMatch, false, "equal aggregate totals must not hide mismatched positions");
});

const card = (markup: string, id: string) => {
  const match = markup.match(new RegExp(`<article[^>]*data-report-metric="${id}"[^>]*>[\\s\\S]*?<\\/article>`));
  assert.ok(match, `overview card ${id} is visible`);
  return match[0];
};

test("all seven indicators are immediately visible in ReportsView, above the collapsible audit details", () => {
  const data = portfolio();
  const { audit, metrics, overview } = evaluated(data);
  const markup = renderToStaticMarkup(createElement(ReportsView, {
    data, metrics, timeline: [], totalValue: overview.currentMarketValue ?? 0,
    totalProfit: overview.combinedProfit ?? 0, segments: [], capitalReport: audit,
    onResolveIssue: () => {}, onRegisterCapital: () => {}, onShowTransactions: () => {},
  }));
  const ids = [...markup.matchAll(/data-report-metric="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["gross-capital", "realized-profit", "combined-profit", "market-value",
    "purchase-value", "realized-ratio", "market-ratio"]);
  assert.ok(markup.indexOf('data-report-metric="gross-capital"') <
    markup.indexOf('class="capital-technical reports-optional"'), "overview is outside the optional details");
  assert.ok(card(markup, "gross-capital").includes(money(1200)));
  assert.ok(card(markup, "realized-profit").includes(money(105)));
  assert.ok(card(markup, "combined-profit").includes(money(170)));
  assert.ok(card(markup, "market-value").includes(money(1265)));
  assert.ok(card(markup, "purchase-value").includes(money(1205)));
  assert.match(card(markup, "realized-ratio"), /۸٫۷۵٪/);
  assert.match(card(markup, "market-ratio"), /۱۳۷٪/);
  assert.match(card(markup, "market-ratio"), /مخرج: فقط سرمایهٔ اولیه، بدون آورده‌های بعدی/);
  assert.match(markup, /در نسبت آخر، سودِ باقی‌مانده در نقد ممکن است دوباره شمرده شود/);
  assert.match(markup, /برداشت:.*کسر نشده/);
});

test("UI distinguishes raw, unreconciled figures and never displays a made-up percentage without opening capital", () => {
  const { audit, overview, metrics } = evaluated(portfolio());
  const flagged = { ...audit, isReliable: false, issues: [{ id: "unreviewed", severity: "warning" as const,
    title: "بازبینی", detail: "تأیید نشده", target: { type: "capital" as const } }] };
  const raw = renderToStaticMarkup(createElement(ReportOverviewPanel, { overview, report: flagged }));
  assert.match(raw, /اعداد خام؛ نیازمند بررسی/);
  assert.match(raw, /نتیجهٔ قطعی نیستند/);
  assert.match(card(raw, "realized-ratio"), /۸٫۷۵٪/);

  const divergent = renderToStaticMarkup(createElement(ReportOverviewPanel, {
    overview: { ...overview, profitComponentsMatch: false }, report: audit,
  }));
  assert.match(divergent, /اعداد خام؛ نیازمند بررسی/);
  assert.match(divergent, /با سود کل داشبورد یا با جمع خودِ بعضی ردیف‌ها یکسان نیست/);
  assert.match(card(divergent, "combined-profit"), /جمع خام مؤلفه‌ها/);

  const missingReport = { ...flagged, initialCapital: null };
  const missingOverview = calculateReportOverview(metrics, missingReport, 1265, 170);
  const missing = renderToStaticMarkup(createElement(ReportOverviewPanel, {
    overview: missingOverview, report: missingReport,
  }));
  assert.match(card(missing, "gross-capital"), /نامشخص/);
  for (const id of ["realized-ratio", "market-ratio"]) {
    assert.match(card(missing, id), /report-overview-value[^>]*>—<\/strong>/);
  }
});
