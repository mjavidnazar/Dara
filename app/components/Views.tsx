"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpLeft,
  BarChart3,
  Calendar,
  Check,
  DollarSign,
  Download,
  ExternalLink,
  FileArchive,
  FileDown,
  FileText,
  FileUp,
  GripVertical,
  HardDrive,
  Loader2,
  Minus,
  Pencil,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { DonutChart, LineChart } from "./Charts";
import { CapitalHealthPanel } from "./CapitalHealthPanel";
import { ReportOverviewPanel } from "./ReportOverviewPanel";
import { calculateReportOverview } from "../lib/reportOverview";
import { InfoButton } from "./InfoGuide";
import type { AuditTarget, CapitalReport } from "../lib/capitalReport";
import { indexTransactionReviews } from "../lib/transactionReviews";
import type { TransactionReview } from "../lib/transactionReviews";
import { compareRowsWithinDay, ledgerRowKey } from "../lib/transactionDayOrder";
import type { DayRowPosition } from "../lib/transactionDayOrder";
import { JalaliDatePicker } from "./JalaliDatePicker";
import {
  StockDividendModal,
  StockSymbolTradesModal,
} from "./Modals";
import { exportAssetCardPdf } from "../lib/pdfExport";
import { describeTransactionNote } from "../lib/transactionDescriptions";
import {
  CHART_TIME_RANGES,
  ChartTimeRange,
  assetMode,
  filterTimelineByRange,
  getMonthlyCashFlows,
  getRangeStartDate,
  getSegmentsAtDate,
  hasValidTradeAmounts,
  isGeneratedStockTransfer,
  isInterestTransaction,
  money,
  nf,
  percent,
  safeNumber,
  signedMoney,
  todayIso,
  toPersianDate,
  transactionLabel,
  uid,
  validIsoDate,
} from "../lib/portfolio";
import type {
  Asset,
  AssetMetric,
  BourseSummary,
  PortfolioData,
  StockDividend,
  StockOrder,
  StockPrice,
  StockSymbolMetric,
  Transaction,
} from "../lib/types";

export function SortableHeader<T extends string>({
  field,
  currentField,
  direction,
  onSort,
  label,
  style,
}: {
  field: T;
  currentField: T;
  direction: "asc" | "desc";
  onSort: (field: T) => void;
  label: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const isActive = currentField === field;
  return (
    <th
      style={{
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        transition: "background 0.15s ease",
        ...style,
      }}
      onClick={() => onSort(field)}
      title={`مرتب‌سازی بر اساس ${typeof label === "string" ? label : ""}`}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          color: isActive ? "var(--primary)" : undefined,
          fontWeight: isActive ? 700 : undefined,
        }}
      >
        <span>{label}</span>
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp size={13} style={{ flexShrink: 0 }} />
          ) : (
            <ArrowDown size={13} style={{ flexShrink: 0 }} />
          )
        ) : (
          <ArrowUpDown size={12} style={{ opacity: 0.35, flexShrink: 0 }} />
        )}
      </div>
    </th>
  );
}

export function DashboardView({
  data,
  metrics,
  timeline,
  totalValue,
  totalProfit,
  totalProfitPercent,
  segments,
  stockSummary,
  cashAvailable,
  onSetHamiBalance,
  onSetKianBalance,
  onShowTransactions,
  onNavigateToStocks,
  capitalReport,
  onShowCapitalReport,
  onImportBackup,
}: {
  data: PortfolioData;
  metrics: AssetMetric[];
  timeline: Array<{ date: string; value: number; profit?: number }>;
  totalValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  segments: Array<{ label: string; value: number; color: string }>;
  stockSummary: BourseSummary;
  cashAvailable: { bank?: number; hami: number; kian: number; depositCertCash?: number };
  onSetHamiBalance?: () => void;
  onSetKianBalance: () => void;
  onShowTransactions: () => void;
  onNavigateToStocks: () => void;
  capitalReport: CapitalReport;
  onShowCapitalReport: () => void;
  onImportBackup: () => void;
}) {
  const topAssets = useMemo(
    () => [...metrics].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5),
    [metrics]
  );

  const investmentAssets = useMemo(
    () =>
      metrics.filter(
        (m) =>
          !["حامی", "کیان", "بانک", "دفتر گواهی"].some((name) => m.asset?.name?.includes(name)) &&
          m.asset?.id !== "asset-deposit-cash" &&
          m.marketValue > 0
      ),
    [metrics]
  );

  const lastPriceDate = useMemo(() => {
    const today = todayIso();
    const dates = [
      ...(data.prices || []).filter((p) => Number.isFinite(p.price) && p.price > 0).map((p) => p.date),
      ...(data.stockPrices || []).filter((p) => Number.isFinite(p.price) && p.price > 0).map((p) => p.date),
    ].filter((date) => validIsoDate(date) && date <= today);
    return dates.sort().reverse()[0] || null;
  }, [data.prices, data.stockPrices]);

  const recentTransactions = useMemo(
    () =>
      [...data.transactions]
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") ||
          compareRowsWithinDay(data.settings.transactionDayOrder,
            { date: a.date, orderKey: ledgerRowKey("transaction", a.id) },
            { date: b.date, orderKey: ledgerRowKey("transaction", b.id) }) ||
          (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 5),
    [data.transactions, data.settings.transactionDayOrder]
  );

  const [timelineRange, setTimelineRange] = useState<ChartTimeRange>("all");
  const [allocationRange, setAllocationRange] = useState<ChartTimeRange>("all");
  const [allocationAtStart, setAllocationAtStart] = useState<boolean>(false);

  const filteredTimeline = useMemo(() => {
    return filterTimelineByRange(timeline, timelineRange);
  }, [timeline, timelineRange]);

  const timelineDelta = useMemo(() => {
    if (!filteredTimeline || filteredTimeline.length < 2) return null;
    const start = filteredTimeline[0].value;
    const end = filteredTimeline[filteredTimeline.length - 1].value;
    const diff = end - start;
    const pct = start > 0 ? (diff / start) * 100 : 0;
    return { diff, pct };
  }, [filteredTimeline]);

  const filteredAllocation = useMemo(() => {
    if (allocationRange === "all" || !allocationAtStart) {
      return { segments, total: totalValue };
    }
    const startDate = getRangeStartDate(allocationRange);
    if (!startDate) return { segments, total: totalValue };
    const historic = getSegmentsAtDate(data, startDate);
    return { segments: historic.segments, total: historic.totalValue };
  }, [data, segments, totalValue, allocationRange, allocationAtStart]);
  const allocationBase = segments.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const isNewPortfolio = !data.assets.length && !data.transactions.length && !data.stockOrders.length;
  const needsFundingReview = capitalReport.initialCapital === null || capitalReport.fundingCandidates.length > 0;
  const nextReviewTitle = needsFundingReview
    ? `گام ۱: منشأ سرمایه را مشخص کنید · ${nf.format(capitalReport.fundingCandidates.length)} ورودی بی‌منبع`
    : capitalReport.cashShortfalls.length
      ? `گام ۲: ماندهٔ منفی حساب‌ها را ردگیری کنید · ${nf.format(capitalReport.cashShortfalls.length)} دوره`
      : `تطبیق ${nf.format(capitalReport.issues.length)} مورد باقیمانده`;

  return (
    <div className="view-container">
      <div className={`capital-dashboard-banner ${capitalReport.isReliable ? "ready" : "review"}`}>
        {capitalReport.isReliable ? <ShieldCheck size={23} /> : <Activity size={23} />}
        <div>
          <b>{isNewPortfolio ? "هنوز داده‌ای وارد نشده؛ برای نمایش گزارش واقعی، پشتیبان خود را بازیابی کنید" : capitalReport.isReliable ? "کنترل‌های داخلی بدون هشدارند؛ صورت‌حساب‌ها را هم تطبیق دهید" : nextReviewTitle}</b>
          <span>{isNewPortfolio ? "دادهٔ نمونه به‌جای اطلاعات شما نمایش داده نمی‌شود؛ فایل JSON فقط در مرورگر شما خوانده می‌شود." : capitalReport.isReliable ? `سرمایهٔ اولیهٔ ثبت‌شده: ${money(capitalReport.initialCapital ?? 0)} · سود محاسباتی: ${signedMoney(capitalReport.recordedProfit)}؛ تأیید خارجی انجام نشده است.` : `سرمایهٔ اولیه: ${capitalReport.initialCapital === null ? "هنوز نامشخص" : money(capitalReport.initialCapital)}. سود نهایی تا تعیین منشأ پول و رفع کسری‌ها نمایش داده نمی‌شود.`}</span>
        </div>
        <button type="button" className="button secondary small-btn" onClick={isNewPortfolio ? onImportBackup : onShowCapitalReport}>
          {isNewPortfolio ? <>بازیابی فایل پشتیبان <Upload size={15} /></> : <>مشاهده گزارش و اصلاح <ArrowUpLeft size={15} /></>}
        </button>
      </div>
      {/* 4 Hero KPI Cards */}
      <section className="hero-metrics">
        <article className="hero-card primary-kpi">
          <div className="card-label-with-info">
            <span className="card-label">ارزش کل دارایی‌ها (پرتفوی)</span>
            <InfoButton
              title="ارزش کل دارایی‌ها (پرتفوی)"
              formula="ارزش روز کل = مجموع (موجودی هر دارایی × قیمت روز بازار) + مانده نقدی حامی و کیان + (مانده دلاری × نرخ تتر)"
              description="نشان‌دهنده مجموع ارزش ریالی ثروت سرمایه‌گذاری‌شده شما بر مبنای آخرین نرخ‌های معتبر بازار."
              details={[
                "موجودی هر دارایی از خالص خریدها منهای فروش‌ها استخراج می‌شود.",
                "برای طلا، سکه، تتر و ارز، آخرین قیمت ثبت‌شده در سیستم اعمال می‌گردد.",
                "برای سهام بورس، آخرین قیمت پایانی روز معاملاتی لحاظ می‌شود.",
                "مانده حساب حامی مفید، صندوق درآمد ثابت کیان و دفتر گواهی سپرده به‌عنوان نقدینگی به این رقم افزوده می‌شود.",
                "نشان درصدی این کارت بر پایهٔ بهای تمام‌شدهٔ موجودی فعلی است؛ برای پول اولیه و سود پس از ورود/خروج وجه، گزارش سرمایه را ببینید."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2>{money(totalValue)}</h2>
            {capitalReport.isReliable ? (
              <span className={`pill-badge ${totalProfitPercent >= 0 ? "positive" : "negative"}`} title="نسبت سود به بهای تمام‌شده؛ نه بازدهی زمانی پول اولیه">{percent(totalProfitPercent)}</span>
            ) : <span className="pill-badge neutral">ارزشِ نیازمند تطبیق</span>}
          </div>
          {capitalReport.isReliable && <div className="kpi-progress"><span style={{
            width: `${Math.min(100, Math.max(0, totalProfitPercent + 50))}%`,
            background: totalProfit >= 0 ? "#10b981" : "#ef4444",
          }} /></div>}
          <p className="card-sub">{capitalReport.isReliable ? "نسبت سود به بهای تمام‌شده، نه بازدهی پول اولیه" : "اول منشأ سرمایه و ماندهٔ حساب‌ها را در گزارش گام‌به‌گام بررسی کنید."}</p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">مجموع سود و زیان کل</span>
            <InfoButton
              title="مجموع سود و زیان کل پورتفو"
              formula="سود کل = مجموع سود/زیان محقق‌شده فروش‌ها + سود جاری دارایی‌های موجود (ارزش روز - بهای تمام‌شده) + سود مجامع سهام + سود واریزی حامی"
              description="جمع سود محاسبه‌شده از معاملات و ارزش روز؛ نبود هشدار داخلی، جای تأیید ارقام با صورت‌حساب‌ها را نمی‌گیرد."
              details={[
                "سود محقق‌شده (Realized): سود قطعی حاصل از بستن یا فروش پله‌ای دارایی‌ها.",
                "سود جاری یا تحقق‌نیافته (Unrealized): اختلاف بین ارزش روز موجودی فعلی با قیمت خرید آن.",
                "سودهای نقدی (Dividends & Cash): سود تقسیمی مجامع بورسی (DPS) و سود ماهانه حامی مفید."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2 className={capitalReport.isReliable ? (totalProfit >= 0 ? "positive-text" : "negative-text") : ""}>
              {capitalReport.isReliable ? signedMoney(totalProfit) : "پس از تطبیق سرمایه و حساب‌ها"}
            </h2>
          </div>
          <p className="card-sub">
            {capitalReport.isReliable ? "سود محاسباتی از داده‌های ثبت‌شده؛ با صورت‌حساب‌ها تأیید کنید." : "عدد خامِ سود در جزئیات گزارش هست، اما هنوز نتیجهٔ قابل اتکا نیست."}
          </p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">آخرین به‌روزرسانی قیمت‌ها</span>
            <InfoButton
              title="تاریخ آخرین به‌روزرسانی قیمت‌ها"
              formula="تاریخ جدیدترین رکورد ثبت‌شده میان جدول قیمت دارایی‌ها و قیمت‌های بورسی"
              description="تاریخی که آخرین نرخ بازار در پایگاه داده پورتفوی شما ذخیره شده است."
              details={[
                "محاسبه سود یا زیان جاری وابستگی مستقیم به تازگی قیمت‌های بازار دارد.",
                "می‌توانید با دکمه به‌روزرسانی قیمت‌ها در نمای دارایی‌ها یا دکمه دریافت خودکار در میزکار بورس، نرخ‌ها را تازه کنید."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2 style={{ fontSize: "20px" }}>{lastPriceDate ? toPersianDate(lastPriceDate) : "ثبت نشده"}</h2>
          </div>
          <p className="card-sub">قیمت‌های طلا، سهام، تتر و سایر دارایی‌ها</p>
        </article>

        <article className="hero-card highlight-kpi">
          <div className="card-label-with-info">
            <span className="card-label">نقدینگی در دسترس (بانک + حامی + کیان + دفتر گواهی)</span>
            <InfoButton
              title="نقدینگی در دسترس (بانک + حامی + کیان + دفتر گواهی)"
              formula="نقدینگی = مانده ریالی حساب بانک + مانده ریالی طرح حامی کارگزاری مفید + مانده سرمایه‌گذاری صندوق کیان + مانده دفتر گواهی سپرده"
              description="مجموع وجوه نقد در دسترس و سرمایه‌گذاری‌های بدون ریسک با سود روزشمار که آماده خرید دارایی‌های جدید هستند."
              details={[
                `مانده حساب بانک: ${money(cashAvailable.bank ?? 0)}`,
                `مانده حامی (مفید): ${money(cashAvailable.hami)}`,
                `مانده صندوق کیان: ${money(cashAvailable.kian)}`,
                `مانده دفتر گواهی سپرده: ${money(cashAvailable.depositCertCash ?? 0)}`,
                "وجوه نقد ریسک نوسان منفی ندارند و از بالاترین درجه نقدشوندگی برخوردارند."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2>{money((cashAvailable.bank ?? 0) + cashAvailable.hami + cashAvailable.kian + (cashAvailable.depositCertCash ?? 0))}</h2>
            <div style={{ display: "flex", gap: "6px" }}>
              {onSetHamiBalance && (
                <button
                  type="button"
                  className="button ghost small-btn"
                  onClick={onSetHamiBalance}
                  title="ثبت یا اصلاح مانده واقعی صندوق حامی در کارگزاری مفید"
                >
                  ثبت مانده حامی
                </button>
              )}
              <button
                type="button"
                className="button ghost small-btn"
                onClick={onSetKianBalance}
                title="ثبت یا اصلاح مانده واقعی صندوق کیان"
              >
                ثبت مانده کیان
              </button>
            </div>
          </div>
          <p className="card-sub">
            بانک: {money(cashAvailable.bank ?? 0)} · حامی (مفید): {money(cashAvailable.hami)} · کیان: {money(cashAvailable.kian)} · دفتر گواهی: {money(cashAvailable.depositCertCash ?? 0)}
          </p>
        </article>
      </section>

      {/* Bourse Summary Panel */}
      <section className="bourse-banner" onClick={onNavigateToStocks}>
        <div className="bourse-banner-info">
          <div className="banner-icon">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="title-with-info" style={{ marginBottom: "2px" }}>
              <h3 style={{ margin: 0 }}>وضعیت پورتفوی سهام (بورس)</h3>
              <InfoButton
                title="خلاصه پورتفوی سهام بورس"
                formula="ارزش روز سهام = مجموع (تعداد سهم موجود × آخرین قیمت ثبت‌شده) | سود جاری = ارزش روز - بهای تمام‌شدهٔ سهام موجود | سود محقق‌شده = سود فروش‌ها + مجامع پرداخت‌شده"
                description="خلاصهٔ سهام بورس؛ سه نسبت سود با مخرج‌های جداگانه در میزکار بورس نمایش داده می‌شوند."
                details={[
                  "محاسبات بر اساس فایل‌های خروجی اکسل کارگزاری یا معاملات دستی انجام می‌شود.",
                  "درصد سود جاری بر بهای سهام موجود تقسیم می‌شود؛ نسبت سود محقق‌شده و سود کل هر دو بر بیشترین بهای خریدِ سهام هم‌زمان موجود در پایان یک روز تقسیم می‌شوند، نه جمع همهٔ خریدها.",
                  "سود فروش هر معامله برابر مبلغ خالص فروش منهای بهای میانگین سهم‌های فروخته‌شده است."
                ]}
              />
            </div>
            <p>
              ارزش روز سهام: <b>{money(stockSummary.currentValue)}</b> (
              <span className={stockSummary.currentProfit >= 0 ? "positive-text" : "negative-text"}>
                {percent(stockSummary.currentProfitPercent)}
              </span>
              ) · سود تحقق‌یافته: <b>{signedMoney(stockSummary.realizedProfit)}</b>
            </p>
          </div>
        </div>
        <button type="button" className="button secondary">
          مشاهده میزکار بورس
        </button>
      </section>

      {/* Asset Performance Grid */}
      <section className="asset-performance-section">
        <div className="section-head">
          <div className="title-with-info">
            <h3 style={{ margin: 0 }}>عملکرد دارایی‌های سرمایه‌گذاری</h3>
            <InfoButton
              title="کارت‌های عملکرد هر دارایی"
              formula="ارزش روز = موجودی × نرخ روز | سود هر دارایی = ارزش روز - بهای تمام‌شده موجودی + سود معاملات بسته‌شده"
              description="نمایش کارت اختصاصی برای هر دارایی غیرنقدی شامل ارزش جاری، سود/زیان تجمعی، درصد بازدهی و موجودی."
              details={[
                "کارت‌ها بر اساس بیشترین ارزش روز ریالی مرتب شده‌اند.",
                "رنگ نوار هر کارت نشان‌دهنده دسته‌بندی اختصاصی آن است.",
                "درصد سود سایر دارایی‌های غیرنقدی = سود کل ÷ مجموع خریدها؛ درصد کارت بورس = سود کل بورس ÷ بیشترین بهای خریدِ سهام هم‌زمان موجود در پایان یک روز."
              ]}
            />
          </div>
          <small>مرتب‌شده بر اساس ارزش روز</small>
        </div>
        <div className="asset-cards-grid">
          {investmentAssets.map((item) => (
            <div className="asset-mini-card" key={item.asset.id}>
              <div className="asset-mini-top">
                <span className="asset-badge" style={{ borderColor: item.asset.color }}>
                  {item.asset.name}
                </span>
                <span className={item.totalProfit >= 0 ? "badge-profit-pos" : "badge-profit-neg"}>
                  {percent(item.profitPercent)}
                </span>
              </div>
              <div className="asset-mini-val">
                <b>{money(item.marketValue)}</b>
                <small className={item.totalProfit >= 0 ? "positive-text" : "negative-text"}>
                  {signedMoney(item.totalProfit)}
                </small>
              </div>
              <div className="asset-mini-footer">
                <span>
                  موجودی: {nf.format(item.quantity)} {item.asset.unit || "واحد"}
                </span>
                <span>نرخ: {money(item.asset.currentPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Charts: Timeline & Allocation */}
      <section className="charts-grid">
        <div className="panel-card chart-panel">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>نمودار رشد ارزش پورتفوی</h3>
                <InfoButton
                  title="نمودار رشد ارزش پورتفوی"
                  formula="ترسیم تاریخچه روزانه ارزش کل دارایی‌ها بر پایه نرخ‌های روز و جریان معاملات | تغییر بازه = ارزش پایان بازه - ارزش ابتدای بازه"
                  description="روند ارزش شامل تغییرات قیمت و واریز/برداشت پول است؛ افزایش ارزش در بازه لزوماً سود نیست. برای سود پس از جریان پول گزارش سرمایه را ببینید."
                  details={[
                    "تغییر ارزش بازه ترکیبی از ورود و خروج سرمایه و تغییر قیمت دارایی‌هاست.",
                    "اگر مانده‌های گذشتهٔ کپی‌ترید ثبت نشده باشد، بخش تاریخی آن از خرید/برداشت دلاری تخمین زده می‌شود.",
                    "درصد تغییر ارزش بازه = (تغییر ارزش در بازه ÷ ارزش ابتدای بازه) × ۱۰۰."
                  ]}
                />
              </div>
              <p>
                روند ارزش (شامل واریز/برداشت؛ نه سود خالص)
                {timelineDelta && timelineRange !== "all" && (
                  <span className="chart-delta-badge">
                    · تغییر در بازه:{" "}
                    <b className={timelineDelta.diff >= 0 ? "positive-text" : "negative-text"}>
                      {signedMoney(timelineDelta.diff)} ({percent(timelineDelta.pct)})
                    </b>
                  </span>
                )}
              </p>
            </div>
            <div className="time-filter-pills">
              {CHART_TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`time-filter-btn ${timelineRange === r.id ? "active" : ""}`}
                  onClick={() => setTimelineRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart points={filteredTimeline} color="#0f766e" />
        </div>

        <div className="panel-card chart-panel">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>ترکیب و سهم دارایی‌ها</h3>
                <InfoButton
                  title="ترکیب و سهم دارایی‌ها (Donut Chart)"
                  formula="درصد سهم هر بخش = (ارزش ریالی روز آن بخش ÷ کل ارزش پورتفو) × ۱۰۰"
                  description="نمودار دایره‌ای توزیع سرمایه برای بررسی متوازن بودن سبد و مدیریت ریسک تمرکز دارایی‌ها."
                  details={[
                    "امکان مشاهده ترکیب سبد در زمان حال یا در ابتدای بازه زمانی انتخابی وجود دارد.",
                    "بخش‌های مختلف شامل طلا و سکه، سهام بورسی، صندوق‌های سرمایه‌گذاری، ارز و نقدینگی هستند.",
                    "تغییرات سهم هر دارایی نشان‌دهنده رشد نامتوازن یا نیاز به بازتنظیم (Rebalancing) سبد است."
                  ]}
                />
              </div>
              <p>
                {allocationRange === "all"
                  ? "توزیع فعلی کل سرمایه در سبد"
                  : allocationAtStart
                  ? `ترکیب در شروع بازه (${toPersianDate(getRangeStartDate(allocationRange))})`
                  : "ترکیب دارایی‌ها در بازهٔ انتخابی"}
              </p>
            </div>
            <div className="time-filter-pills">
              {CHART_TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`time-filter-btn ${allocationRange === r.id ? "active" : ""}`}
                  onClick={() => setAllocationRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {allocationRange !== "all" && (
            <div className="allocation-mode-switch">
              <button
                type="button"
                className={`switch-chip ${!allocationAtStart ? "active" : ""}`}
                onClick={() => setAllocationAtStart(false)}
              >
                امروز (پایان بازه)
              </button>
              <button
                type="button"
                className={`switch-chip ${allocationAtStart ? "active" : ""}`}
                onClick={() => setAllocationAtStart(true)}
              >
                ابتدای بازه ({toPersianDate(getRangeStartDate(allocationRange))})
              </button>
            </div>
          )}
          <DonutChart segments={filteredAllocation.segments} total={filteredAllocation.total} />
        </div>
      </section>

      {/* Lower Dual Panel: Top Holdings & Recent Transactions */}
      <section className="lower-grid">
        <div className="panel-card">
          <div className="panel-head">
            <div className="title-with-info">
              <h3 style={{ margin: 0 }}>بزرگ‌ترین سهم‌های پورتفوی</h3>
              <InfoButton
                title="بزرگ‌ترین سهم‌های پورتفوی"
                formula="سهم از دارایی‌های مثبت = ارزش روز این دارایی ÷ مجموع ارزش مثبت دارایی‌ها؛ مانده‌های منفی از خالص ارزش سبد کسر می‌شوند."
                description="نمایش ۵ دارایی با بیشترین حجم سرمایه به همراه میله وزن نسبی و درصد سود یا زیان هر کدام."
                details={[
                  "رتبه ۱ نشان‌دهنده سنگین‌ترین دارایی پورتفوی شماست.",
                  "طول نوار رنگی نشان‌دهنده درصد وزن این دارایی از کل ارزش پورتفو است."
                ]}
              />
            </div>
            <span className="tag">{topAssets.length} دارایی برتر</span>
          </div>
          <div className="ranking-list">
            {topAssets.map((item, idx) => {
              const share = allocationBase > 0 ? (Math.max(0, item.marketValue) / allocationBase) * 100 : 0;
              return (
                <div className="ranking-row" key={item.asset.id}>
                  <span className="rank-num">۰{idx + 1}</span>
                  <div className="rank-info">
                    <b>{item.asset.name}</b>
                    <small>
                      {nf.format(item.quantity)} {item.asset.unit || "واحد"}
                    </small>
                  </div>
                  <div className="rank-bar-wrap">
                    <span className="rank-bar" style={{ width: `${Math.min(100, share)}%` }} />
                  </div>
                  <div className="rank-val">
                    <b>{money(item.marketValue)}</b>
                    <span className={item.profitPercent >= 0 ? "positive-text" : "negative-text"}>
                      {percent(item.profitPercent)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <div className="title-with-info">
              <h3 style={{ margin: 0 }}>آخرین معاملات ثبت‌شده</h3>
              <InfoButton
                title="آخرین معاملات ثبت‌شده"
                formula="مبلغ کل = تعداد معامله × قیمت واحد معامله"
                description="نمایش ۵ معامله اخیر بر اساس تاریخ وقوع برای پیگیری سریع گردش‌های نقدی و خرید/فروش‌ها."
                details={[
                  "فلش سبز رو به پایین: نشان‌دهنده خرید دارایی یا واریز وجه است.",
                  "فلش قرمز رو به بالا: نشان‌دهنده فروش دارایی یا برداشت وجه است.",
                  "با کلیک روی «مشاهده همه» به فهرست کامل تمام معاملات منتقل می‌شوید."
                ]}
              />
            </div>
            <button type="button" className="text-button" onClick={onShowTransactions}>
              مشاهده همه
            </button>
          </div>
          <div className="transactions-mini-list">
            {recentTransactions.map((tx) => {
              const asset = data.assets.find((a) => a.id === tx.assetId);
              return (
                <div className="tx-mini-row" key={tx.id}>
                  <div className={`tx-dot ${tx.type === "buy" ? "buy" : "sell"}`}>
                    {tx.type === "buy" ? <ArrowDownLeft size={16} /> : <ArrowUpLeft size={16} />}
                  </div>
                  <div className="tx-info">
                    <b>{asset?.name ?? "دارایی"}</b>
                    <small>
                      {transactionLabel(tx, asset)} · {toPersianDate(tx.date)}
                    </small>
                  </div>
                  <div className="tx-amount">
                    <b>{money(tx.totalPrice)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export function StocksDashboardView({
  items,
  data,
  stockSummary,
  onSavePrices,
  onManagePrices,
  onSaveHamiInterest,
  onSaveHamiCashTransfer,
  onDividend,
  onEditOrder,
  onAutoPrices,
  onToggleDividend,
  onDeleteDividend,
}: {
  items: StockSymbolMetric[];
  data: PortfolioData;
  stockSummary: BourseSummary;
  onSavePrices: (updates: StockPrice[]) => void;
  onManagePrices: () => void;
  onSaveHamiInterest: (amount: number, date: string, note: string) => void;
  onSaveHamiCashTransfer?: (
    direction: "deposit" | "withdraw",
    amount: number,
    date: string,
    note: string,
    source: "bank" | "external"
  ) => void;
  onDividend: (dividend: StockDividend) => void;
  onEditOrder: (order: StockOrder) => void;
  onAutoPrices: () => Promise<void>;
  onToggleDividend: (dividend: StockDividend, targetStatus?: "pending" | "paid") => void;
  onDeleteDividend?: (id: string) => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [dividendSymbol, setDividendSymbol] = useState<string | null>(null);
  const [editingDividend, setEditingDividend] = useState<StockDividend | null>(null);
  const [dividendFilter, setDividendFilter] = useState<"all" | "paid" | "pending">("all");
  const [priceDate, setPriceDate] = useState(todayIso());
  const [pricesState, setPricesState] = useState<Record<string, string>>({});
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const [hamiOpMode, setHamiOpMode] = useState<"interest" | "deposit" | "withdraw">("interest");
  const [hamiAmount, setHamiAmount] = useState("");
  const [hamidate, setHamiDate] = useState(todayIso());
  const [hamiNote, setHamiNote] = useState("");
  const [hamiCashSource, setHamiCashSource] = useState<"bank" | "external">("bank");
  const bankAccount = data.assets.find((asset) => asset.id === "asset-bank" || asset.name === "بانک");

  const currentStocks = useMemo(() => items.filter((item) => item.quantity > 0), [items]);
  const soldStocks = useMemo(
    () => items.filter((item) => item.quantity === 0 && item.sales > 0),
    [items]
  );

  const allStockSymbols = useMemo(
    () =>
      Array.from(
        new Set([
          ...items.map((i) => i.symbol),
          ...data.stockDividends.map((d) => d.symbol),
        ])
      ).filter(Boolean),
    [items, data.stockDividends]
  );

  // Use the same summary as the dashboard and asset cards for all three ratios.
  const {
    currentValue: totalCurrentValue,
    currentCost: totalCurrentCost,
    currentProfit: totalCurrentProfit,
    currentProfitPercent,
    purchases: totalPurchases,
    sales: totalSales,
    peakOpenCost,
    peakOpenCostDate,
    realizedProfit: totalRealizedProfit,
    realizedReturnPercent,
    unrealizedProfit: totalUnrealizedProfit,
    paidDividends,
    pendingDividends,
    totalDividends,
    toDateProfit,
    toDateReturnPercent,
  } = stockSummary;
  const totalRealizedTrades = items.reduce((sum, item) => sum + item.realized, 0);

  const hami = data.assets.find((asset) => asset.name.includes("حامی"));
  const hamiTransactions = hami
    ? data.transactions.filter((tx) => tx.assetId === hami.id && validIsoDate(tx.date) && tx.date <= todayIso() && hasValidTradeAmounts(tx))
    : [];
  const hamiBalance = hamiTransactions.reduce(
    (sum, tx) =>
      sum + (tx.type === "buy" ? safeNumber(tx.totalPrice) : -safeNumber(tx.totalPrice)),
    0
  );

  // Sorting state for active stocks
  type ActiveStockSortKey =
    | "symbol"
    | "quantity"
    | "average"
    | "price"
    | "value"
    | "dividend"
    | "profit"
    | "profitPercent";
  const [activeSortKey, setActiveSortKey] = useState<ActiveStockSortKey>("value");
  const [activeSortDir, setActiveSortDir] = useState<"asc" | "desc">("desc");

  const handleActiveSort = (key: ActiveStockSortKey) => {
    if (activeSortKey === key) {
      setActiveSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setActiveSortKey(key);
      setActiveSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const sortedCurrentStocks = useMemo(() => {
    return [...currentStocks].sort((a, b) => {
      let cmp = 0;
      if (activeSortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol, "fa");
      } else if (activeSortKey === "quantity") {
        cmp = a.quantity - b.quantity;
      } else if (activeSortKey === "average") {
        cmp = a.average - b.average;
      } else if (activeSortKey === "price") {
        cmp = a.price - b.price;
      } else if (activeSortKey === "value") {
        cmp = a.value - b.value;
      } else if (activeSortKey === "dividend") {
        cmp = a.paidDividend + a.pendingDividend - (b.paidDividend + b.pendingDividend);
      } else if (activeSortKey === "profit") {
        cmp = a.profit - b.profit;
      } else if (activeSortKey === "profitPercent") {
        cmp = a.profitPercent - b.profitPercent;
      }
      return activeSortDir === "asc" ? cmp : -cmp;
    });
  }, [currentStocks, activeSortKey, activeSortDir]);

  // Sorting state for sold stocks
  type SoldStockSortKey =
    | "symbol"
    | "purchases"
    | "sales"
    | "realized"
    | "dividend"
    | "profit"
    | "profitPercent";
  const [soldSortKey, setSoldSortKey] = useState<SoldStockSortKey>("sales");
  const [soldSortDir, setSoldSortDir] = useState<"asc" | "desc">("desc");

  const handleSoldSort = (key: SoldStockSortKey) => {
    if (soldSortKey === key) {
      setSoldSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSoldSortKey(key);
      setSoldSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const sortedSoldStocks = useMemo(() => {
    return [...soldStocks].sort((a, b) => {
      let cmp = 0;
      if (soldSortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol, "fa");
      } else if (soldSortKey === "purchases") {
        cmp = a.purchases - b.purchases;
      } else if (soldSortKey === "sales") {
        cmp = a.sales - b.sales;
      } else if (soldSortKey === "realized") {
        cmp = a.realized - b.realized;
      } else if (soldSortKey === "dividend") {
        cmp = a.paidDividend + a.pendingDividend - (b.paidDividend + b.pendingDividend);
      } else if (soldSortKey === "profit") {
        cmp = a.profit - b.profit;
      } else if (soldSortKey === "profitPercent") {
        cmp = a.profitPercent - b.profitPercent;
      }
      return soldSortDir === "asc" ? cmp : -cmp;
    });
  }, [soldStocks, soldSortKey, soldSortDir]);

  // Sorting state for stock dividends
  type DivSortKey = "symbol" | "amount" | "date" | "notes" | "status";
  const [divSortKey, setDivSortKey] = useState<DivSortKey>("date");
  const [divSortDir, setDivSortDir] = useState<"asc" | "desc">("desc");

  const handleDivSort = (key: DivSortKey) => {
    if (divSortKey === key) {
      setDivSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setDivSortKey(key);
      setDivSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const sortedDividends = useMemo(() => {
    const filtered = data.stockDividends.filter((d) =>
      dividendFilter === "all" ? true : d.status === dividendFilter
    );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (divSortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol, "fa");
      } else if (divSortKey === "amount") {
        cmp = a.amount - b.amount;
      } else if (divSortKey === "date") {
        cmp = (a.date || "").localeCompare(b.date || "");
      } else if (divSortKey === "notes") {
        cmp = (a.notes || "").localeCompare(b.notes || "", "fa");
      } else if (divSortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return divSortDir === "asc" ? cmp : -cmp;
    });
  }, [data.stockDividends, dividendFilter, divSortKey, divSortDir]);

  // Totals for Active stocks table
  const totalActiveShares = currentStocks.reduce((sum, item) => sum + item.quantity, 0);
  const totalActivePaidDiv = currentStocks.reduce((sum, item) => sum + item.paidDividend, 0);
  const totalActivePendingDiv = currentStocks.reduce((sum, item) => sum + item.pendingDividend, 0);
  const totalActiveDividends = totalActivePaidDiv + totalActivePendingDiv;
  const totalActiveProfit = currentStocks.reduce((sum, item) => sum + item.profit, 0);
  const totalActiveReturnPercent =
    totalCurrentCost > 0 ? (totalActiveProfit / totalCurrentCost) * 100 : 0;

  // Totals for Sold stocks table
  const totalSoldPurchases = soldStocks.reduce((sum, item) => sum + item.purchases, 0);
  const totalSoldSales = soldStocks.reduce((sum, item) => sum + item.sales, 0);
  const totalSoldRealized = soldStocks.reduce((sum, item) => sum + item.realized, 0);
  const totalSoldPaidDiv = soldStocks.reduce((sum, item) => sum + item.paidDividend, 0);
  const totalSoldPendingDiv = soldStocks.reduce((sum, item) => sum + item.pendingDividend, 0);
  const totalSoldDividends = totalSoldPaidDiv + totalSoldPendingDiv;
  const totalSoldProfit = soldStocks.reduce((sum, item) => sum + item.profit, 0);
  const totalSoldReturnPercent =
    totalSoldPurchases > 0 ? (totalSoldProfit / totalSoldPurchases) * 100 : 0;
  const hamiTotalInterest = hamiTransactions
    .filter(isInterestTransaction)
    .reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);

  const handlePriceUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validIsoDate(priceDate) || priceDate > todayIso()) return;
    const updates: StockPrice[] = Object.entries(pricesState)
      .map(([symbol, priceStr]) => ({
        id: uid("sp"),
        symbol,
        price: safeNumber(priceStr),
        date: priceDate,
      }))
      .filter((item) => item.price > 0);

    if (updates.length > 0) {
      onSavePrices(updates);
      setPricesState({});
    }
  };

  const handleAutoPricesClick = async () => {
    setIsUpdatingPrices(true);
    try {
      await onAutoPrices();
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleHamiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = safeNumber(hamiAmount);
    if (amount > 0) {
      if (hamiOpMode === "interest") {
        onSaveHamiInterest(amount, hamidate, hamiNote);
      } else if (onSaveHamiCashTransfer) {
        onSaveHamiCashTransfer(hamiOpMode, amount, hamidate, hamiNote, bankAccount ? hamiCashSource : "external");
      }
      setHamiAmount("");
      setHamiNote("");
    }
  };

  return (
    <div className="view-container">
      {/* Values and cash balances are separate from the three stock-profit ratios. */}
      <section className="stock-kpi-grid stock-balance-grid" aria-label="ارزش سهام و نقدینگی بورس">
        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">ارزش روز سهام فعال</span>
            <InfoButton
              title="ارزش روز سهام فعال"
              formula="ارزش روز = مجموع (تعداد سهم موجود هر نماد × آخرین قیمت ثبت‌شده) | سود جاری = ارزش روز - بهای تمام‌شدهٔ سهام موجود"
              description="ارزش سهامی که هنوز فروخته نشده است؛ درصد سود این سهام به‌طور جداگانه در نسبت دوم نمایش داده می‌شود."
              details={[
                "قیمت، آخرین قیمت معتبر ثبت‌شده برای هر نماد است و الزاماً قیمت زندهٔ بازار نیست.",
                "مجامع و سود فروش‌های گذشته در سود قیمتی سهام موجود منظور نمی‌شوند."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2>{money(totalCurrentValue)}</h2>
          </div>
          <p className="card-sub">
            سود قیمتی سهام موجود:{" "}
            <b className={totalCurrentProfit >= 0 ? "positive-text" : "negative-text"}>
              {signedMoney(totalCurrentProfit)}
            </b>
          </p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">موجودی نقدی صندوق حامی</span>
            <InfoButton
              title="موجودی نقدی صندوق حامی (کارگزاری مفید)"
              formula="مانده حامی = واریزها از بانک + حاصل فروش‌های سهام + سودهای ماهانه حامی - خریدهای سهام - برداشت‌ها به بانک"
              description="مانده ریالی موجود در حساب کارگزاری مفید که مشمول طرح سرمایه‌گذاری با سود روزشمار حامی است."
              details={[
                "با هر خرید سهام، وجه مستقیماً از مانده حامی کسر می‌شود.",
                "با هر فروش سهام، وجه حاصل از فروش بلافاصله به مانده حامی اضافه می‌شود.",
                "هر گونه واریز وجه از بانک، مانده حامی را افزایش و برداشت، آن را کاهش می‌دهد.",
                `مجموع سود ماهانه واریزی حامی تا این لحظه: ${money(hamiTotalInterest)}`
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2>{money(hamiBalance)}</h2>
          </div>
          <p className="card-sub">
            سود واریز شده: <b className="positive-text">{money(hamiTotalInterest)}</b>
          </p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">سود نقدی مجامع (DPS)</span>
            <InfoButton
              title="سود نقدی مجامع (DPS)"
              formula="سود کل مجامع = سود مجمع پرداخت‌شده + سود مجمع در انتظار پرداخت"
              description="سود تقسیمی ثبت‌شدهٔ شرکت‌های بورسی و وضعیت پرداخت آن."
              details={[
                "مجامع پرداخت‌شده در سود محقق‌شده (نسبت اول) محاسبه می‌شوند.",
                "مجامع در انتظار پرداخت تنها در سود کل (نسبت سوم) محاسبه می‌شوند.",
                "با کلیک روی دکمه‌های وضعیت در جدول مجامع، می‌توانید وضعیت هر سود را تغییر دهید."
              ]}
            />
          </div>
          <div className="card-val-row">
            <h2>{money(totalDividends)}</h2>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "12px", flexWrap: "wrap" }}>
            <span className="positive-text">
              پرداخت‌شده: <b>{money(paidDividends)}</b>
            </span>
            <span style={{ color: "var(--muted)" }}>|</span>
            <span style={{ color: "#d97706" }}>
              در انتظار: <b>{money(pendingDividends)}</b>
            </span>
          </div>
        </article>
      </section>

      <div className="stock-returns-heading">
        <h3>سه نسبت سود بورس</h3>
        <p>مخرج نسبت‌های ۱ و ۳ اوج بهای سهام هم‌زمان موجود در پایان روز است (ساعت واقعی سفارش‌ها ثبت نشده)؛ مخرج نسبت ۲ بهای سهام فعلی است. این‌ها بازده سالانه نیستند.</p>
      </div>
      <section className="stock-kpi-grid stock-returns-grid" aria-label="سه نسبت سود بورس">
        <article className="hero-card stock-return-card" data-stock-return="realized">
          <div className="card-label-with-info">
            <span className="card-label">۱. سود محقق‌شده / بیشترین پول درگیر بورس</span>
            <InfoButton
              title="نسبت سود محقق‌شده به بیشترین پول درگیر بورس"
              formula="(سود/زیان فروش سهام + مجامع پرداخت‌شده) ÷ بیشترین بهای خریدِ سهام هم‌زمان موجود در پایان یک روز × ۱۰۰"
              description="مخرج، بیشترین بهای تمام‌شدهٔ سهامی است که در پایان یک روز با هم در سبد بوده‌اند؛ نه مجموع خریدهای تکرارشده یا پول نقد حامی."
              details={[
                `سود/زیان فروش‌ها (فروش خالص منهای بهای میانگین سهام فروخته‌شده): ${signedMoney(totalRealizedTrades)}`,
                `مجامع پرداخت‌شده: ${money(paidDividends)}`,
                `بیشترین پول درگیر بورس: ${money(peakOpenCost)}${peakOpenCostDate ? ` در پایان ${toPersianDate(peakOpenCostDate)}` : ""}.`,
                `مجموع خریدهای تاریخی ${money(totalPurchases)} است، اما مخرج این نسبت نیست.`,
                "با فروش، بهای میانگین سهم فروخته‌شده از پول درگیر کم می‌شود؛ سود جاری و مجامع در انتظار در صورتِ این نسبت نیستند."
              ]}
            />
          </div>
          <h2 className={peakOpenCost > 0 ? (totalRealizedProfit >= 0 ? "positive-text" : "negative-text") : undefined}>
            {peakOpenCost > 0 ? percent(realizedReturnPercent) : "—"}
          </h2>
          <p className="card-sub">سود/زیان محقق‌شده: <b>{signedMoney(totalRealizedProfit)}</b></p>
          <p className="card-sub">مخرج: بیشترین پول درگیر بورس، {money(peakOpenCost)}{peakOpenCostDate ? ` (پایان ${toPersianDate(peakOpenCostDate)})` : ""}</p>
        </article>

        <article className="hero-card stock-return-card" data-stock-return="current">
          <div className="card-label-with-info">
            <span className="card-label">۲. سود فعلی / بهای سهام موجود</span>
            <InfoButton
              title="نسبت سود فعلی به بهای سهام موجود"
              formula="(ارزش روز سهام موجود − بهای تمام‌شدهٔ همان سهام) ÷ بهای تمام‌شدهٔ همان سهام × ۱۰۰"
              description="تغییر قیمت سهامی که هنوز در سبد دارید، نسبت به بهای خرید همان تعداد سهم."
              details={[
                `ارزش روز سهام موجود: ${money(totalCurrentValue)}`,
                `بهای خرید سهام موجود، پس از کسر بهای سهم‌های فروخته‌شده: ${money(totalCurrentCost)}`,
                "سود فروش‌های گذشته و مجامع پرداخت‌شده یا در انتظار در این نسبت نیستند."
              ]}
            />
          </div>
          <h2 className={totalCurrentCost > 0 ? (totalCurrentProfit >= 0 ? "positive-text" : "negative-text") : undefined}>
            {totalCurrentCost > 0 ? percent(currentProfitPercent) : "—"}
          </h2>
          <p className="card-sub">سود/زیان قیمتی سهام موجود: <b>{signedMoney(totalCurrentProfit)}</b></p>
          <p className="card-sub">مخرج: بهای خرید همین سهام، {money(totalCurrentCost)}</p>
        </article>

        <article className="hero-card stock-return-card highlight-kpi" data-stock-return="total">
          <div className="card-label-with-info">
            <span className="card-label">۳. سود کل / بیشترین پول درگیر بورس</span>
            <InfoButton
              title="نسبت سود کل به بیشترین پول درگیر بورس"
              formula="(سود/زیان فروش‌ها + مجامع پرداخت‌شده + سود/زیان فعلی سهام موجود + مجامع در انتظار) ÷ بیشترین بهای خریدِ سهام هم‌زمان موجود در پایان یک روز × ۱۰۰"
              description="جمع سود محقق‌شده و محقق‌نشده نسبت به بیشترین بهای تمام‌شدهٔ سهامی که در یک روز هم‌زمان در سبد داشته‌اید."
              details={[
                `سود محقق‌شده: ${signedMoney(totalRealizedProfit)}`,
                `سود محقق‌نشده (تغییر قیمت سهام موجود + مجامع در انتظار): ${signedMoney(totalUnrealizedProfit)}`,
                `بیشترین پول درگیر بورس: ${money(peakOpenCost)}${peakOpenCostDate ? ` در پایان ${toPersianDate(peakOpenCostDate)}` : ""}.`,
                `مجموع خریدهای تاریخی: ${money(totalPurchases)} · مجموع فروش‌ها: ${money(totalSales)}`,
                "فروش‌ها بهای میانگین سهام خارج‌شده را آزاد می‌کنند؛ خرید مجدد تنها وقتی مخرج را بالا می‌برد که جمع بهای سهامِ موجود در پایان روز از اوج قبلی بیشتر شود. این نسبت بازده سالانه یا آوردهٔ نقدی خالص نیست."
              ]}
            />
          </div>
          <h2 className={peakOpenCost > 0 ? (toDateProfit >= 0 ? "positive-text" : "negative-text") : undefined}>
            {peakOpenCost > 0 ? percent(toDateReturnPercent) : "—"}
          </h2>
          <p className="card-sub">سود/زیان کل (محقق‌شده + محقق‌نشده): <b>{signedMoney(toDateProfit)}</b></p>
          <p className="card-sub">مخرج: بیشترین پول درگیر بورس، {money(peakOpenCost)}{peakOpenCostDate ? ` (پایان ${toPersianDate(peakOpenCostDate)})` : ""}</p>
        </article>
      </section>

      {/* Active Holdings Table */}
      <section className="panel-card">
        <div className="panel-head">
          <div>
            <div className="title-with-info">
              <h3 style={{ margin: 0 }}>سبد سهام فعال (دارایی‌های موجود)</h3>
              <InfoButton
                title="جدول سبد سهام فعال"
                formula="میانگین خرید = کل بهای خریدهای موجود ÷ تعداد سهم موجود | ارزش روز = تعداد × قیمت روز | سود جاری = ارزش روز - (تعداد × میانگین خرید) | بازدهی کل = (سود جاری + سود مجمع + سود معاملات گذشته) ÷ کل بهای خرید نماد × ۱۰۰"
                description="فهرست کامل نمادهای موجود در پورتفو به همراه جزییات خرید، سود جاری و بازدهی."
                details={[
                  "میانگین خرید به صورت میانگین موزون با هر خرید جدید بازنگری می‌شود.",
                  "ارزش روز با ثبت قیمت‌های جدید یا دریافت خودکار از بورس به‌روز می‌شود.",
                  "دکمه معاملات: مشاهده تاریخچه کلیه خریدها و فروش‌های ثبت‌شده برای این نماد.",
                  "دکمه مجمع: ثبت سود تقسیمی تصویب‌شده مجمع عمومی سالیانه شرکت."
                ]}
              />
            </div>
            <p>{currentStocks.length} نماد در پورتفوی شما موجود است</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader<ActiveStockSortKey>
                  field="symbol"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="نماد"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="quantity"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="تعداد سهم"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="average"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="میانگین خرید"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="price"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="قیمت روز"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="value"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="ارزش روز"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="dividend"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="سود مجمع (DPS)"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="profit"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="سود / زیان کل"
                />
                <SortableHeader<ActiveStockSortKey>
                  field="profitPercent"
                  currentField={activeSortKey}
                  direction={activeSortDir}
                  onSort={handleActiveSort}
                  label="بازدهی کل"
                />
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sortedCurrentStocks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    در حال حاضر سهام فعالی در پورتفوی شما وجود ندارد.
                  </td>
                </tr>
              ) : (
                sortedCurrentStocks.map((item) => (
                  <tr key={item.symbol}>
                    <td>
                      <b className="stock-symbol">{item.symbol}</b>
                    </td>
                    <td>{nf.format(item.quantity)}</td>
                    <td>{money(item.average)}</td>
                    <td>
                      <b>{money(item.price)}</b>
                    </td>
                    <td>
                      <b>{money(item.value)}</b>
                    </td>
                    <td>
                      {item.paidDividend + item.pendingDividend > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {item.paidDividend > 0 && (
                            <button
                              type="button"
                              className="pill-badge positive"
                              style={{ border: "none", cursor: "pointer", fontSize: "11px", textAlign: "right" }}
                              title="سود مجمع محقق‌شده (کلیک برای مدیریت یا تغییر وضعیت)"
                              onClick={() => {
                                setEditingDividend(null);
                                setDividendSymbol(item.symbol);
                              }}
                            >
                              محقق‌شده: {money(item.paidDividend)}
                            </button>
                          )}
                          {item.pendingDividend > 0 && (
                            <button
                              type="button"
                              className="pill-badge warning"
                              style={{ border: "none", cursor: "pointer", fontSize: "11px", textAlign: "right" }}
                              title="سود مجمع در انتظار (کلیک برای مدیریت یا تغییر وضعیت)"
                              onClick={() => {
                                setEditingDividend(null);
                                setDividendSymbol(item.symbol);
                              }}
                            >
                              در انتظار: {money(item.pendingDividend)}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="button ghost small-btn"
                          style={{ color: "var(--muted)", fontSize: "11px" }}
                          title="ثبت سود مجمع برای این نماد"
                          onClick={() => {
                            setEditingDividend(null);
                            setDividendSymbol(item.symbol);
                          }}
                        >
                          + ثبت مجمع
                        </button>
                      )}
                    </td>
                    <td>
                      <b className={item.profit >= 0 ? "positive-text" : "negative-text"}>
                        {signedMoney(item.profit)}
                      </b>
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>
                        جاری: {signedMoney(item.unrealized)}
                        {item.paidDividend + item.pendingDividend > 0 ? ` · مجمع: ${money(item.paidDividend + item.pendingDividend)}` : ""}
                      </small>
                    </td>
                    <td>
                      <span className={`pill-badge ${item.profitPercent >= 0 ? "positive" : "negative"}`}>
                        {percent(item.profitPercent)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button ghost small-btn"
                          title="مشاهده و ویرایش معاملات"
                          onClick={() => setSelectedSymbol(item.symbol)}
                        >
                          معاملات
                        </button>
                        <button
                          type="button"
                          className="button ghost small-btn"
                          title="مدیریت و ثبت سود مجمع"
                          onClick={() => setDividendSymbol(item.symbol)}
                        >
                          مجمع
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {currentStocks.length > 0 && (
              <tfoot>
                <tr
                  style={{
                    background: "rgba(11, 118, 104, 0.06)",
                    fontWeight: "bold",
                    borderTop: "2px solid var(--border)",
                  }}
                >
                  <td>
                    <b>مجموع ({currentStocks.length} نماد)</b>
                  </td>
                  <td>
                    <b>{nf.format(totalActiveShares)}</b>
                  </td>
                  <td>
                    <b>{money(totalCurrentCost)}</b>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", fontWeight: "normal" }}>
                      بهای تمام‌شده
                    </small>
                  </td>
                  <td>—</td>
                  <td>
                    <b style={{ color: "var(--primary)" }}>{money(totalCurrentValue)}</b>
                  </td>
                  <td>
                    {totalActiveDividends > 0 ? (
                      <div>
                        <b>{money(totalActiveDividends)}</b>
                        <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", fontWeight: "normal" }}>
                          دریافتی: {money(totalActivePaidDiv)}
                        </small>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <b className={totalActiveProfit >= 0 ? "positive-text" : "negative-text"}>
                      {signedMoney(totalActiveProfit)}
                    </b>
                    <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", fontWeight: "normal" }}>
                      سرمایه‌ای: {signedMoney(totalCurrentProfit)}
                    </small>
                  </td>
                  <td>
                    <span className={`pill-badge ${totalActiveReturnPercent >= 0 ? "positive" : "negative"}`}>
                      {percent(totalActiveReturnPercent)}
                    </span>
                  </td>
                  <td>—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Sold Holdings Table */}
      {soldStocks.length > 0 && (
        <section className="panel-card">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>نمادهای بسته‌شده (فروخته‌شده)</h3>
                <InfoButton
                  title="جدول نمادهای بسته‌شده (فروخته‌شده)"
                  formula="سود محقق‌شده = مجموع مبالغ فروش - مجموع بهای خریدها | سود نهایی = سود محقق‌شده معاملات + سود مجمع | بازدهی = (سود نهایی ÷ مجموع خریدها) × ۱۰۰"
                  description="کارنامه و بازدهی قطعی سهامی که به طور کامل فروخته شده و از سبد خارج گردیده‌اند."
                  details={[
                    "مجموع خریدها: تمام وجوهی که در طول دوره سهامداری صرف خرید این نماد شده بود.",
                    "مجموع فروش‌ها: تمام دریافتی حاصل از فروش‌های این نماد.",
                    "سود نهایی: مجموع سود قطعی معاملات به‌علاوه هرگونه سود مجمع تصویب‌شده برای این نماد.",
                    "با دکمه سوابق می‌توانید تاریخچه سفارش‌های گذشته را مرور کنید."
                  ]}
                />
              </div>
              <p>سود یا زیان تحقق‌یافته از فروش‌های قبلی</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableHeader<SoldStockSortKey>
                    field="symbol"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="نماد"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="purchases"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="مجموع خریدها"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="sales"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="مجموع فروش‌ها"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="realized"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="سود معاملات فروش"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="dividend"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="سود مجمع (DPS)"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="profit"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="سود نهایی کل"
                  />
                  <SortableHeader<SoldStockSortKey>
                    field="profitPercent"
                    currentField={soldSortKey}
                    direction={soldSortDir}
                    onSort={handleSoldSort}
                    label="بازدهی"
                  />
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sortedSoldStocks.map((item) => (
                  <tr key={item.symbol}>
                    <td>
                      <b className="stock-symbol">{item.symbol}</b>
                    </td>
                    <td>{money(item.purchases)}</td>
                    <td>{money(item.sales)}</td>
                    <td className={item.realized >= 0 ? "positive-text" : "negative-text"}>
                      {signedMoney(item.realized)}
                    </td>
                    <td>
                      {item.paidDividend + item.pendingDividend > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {item.paidDividend > 0 && (
                            <button
                              type="button"
                              className="pill-badge positive"
                              style={{ border: "none", cursor: "pointer", fontSize: "11px" }}
                              title="سود مجمع محقق‌شده (کلیک برای مشاهده)"
                              onClick={() => setDividendSymbol(item.symbol)}
                            >
                              محقق‌شده: {money(item.paidDividend)}
                            </button>
                          )}
                          {item.pendingDividend > 0 && (
                            <button
                              type="button"
                              className="pill-badge warning"
                              style={{ border: "none", cursor: "pointer", fontSize: "11px" }}
                              title="سود مجمع در انتظار (کلیک برای مشاهده)"
                              onClick={() => setDividendSymbol(item.symbol)}
                            >
                              در انتظار: {money(item.pendingDividend)}
                            </button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={item.profit >= 0 ? "positive-text" : "negative-text"}>
                      <b>{signedMoney(item.profit)}</b>
                    </td>
                    <td>
                      <span className={`pill-badge ${item.profitPercent >= 0 ? "positive" : "negative"}`}>
                        {percent(item.profitPercent)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button ghost small-btn"
                          title="مشاهده سوابق معاملات"
                          onClick={() => setSelectedSymbol(item.symbol)}
                        >
                          سوابق
                        </button>
                        <button
                          type="button"
                          className="button ghost small-btn"
                          title="مدیریت سود مجمع این نماد"
                          onClick={() => setDividendSymbol(item.symbol)}
                        >
                          مجمع
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    background: "rgba(11, 118, 104, 0.06)",
                    fontWeight: "bold",
                    borderTop: "2px solid var(--border)",
                  }}
                >
                  <td>
                    <b>مجموع ({soldStocks.length} نماد)</b>
                  </td>
                  <td>
                    <b>{money(totalSoldPurchases)}</b>
                  </td>
                  <td>
                    <b>{money(totalSoldSales)}</b>
                  </td>
                  <td className={totalSoldRealized >= 0 ? "positive-text" : "negative-text"}>
                    <b>{signedMoney(totalSoldRealized)}</b>
                  </td>
                  <td>
                    <b>{totalSoldDividends > 0 ? money(totalSoldDividends) : "—"}</b>
                  </td>
                  <td className={totalSoldProfit >= 0 ? "positive-text" : "negative-text"}>
                    <b>{signedMoney(totalSoldProfit)}</b>
                  </td>
                  <td>
                    <span className={`pill-badge ${totalSoldReturnPercent >= 0 ? "positive" : "negative"}`}>
                      {percent(totalSoldReturnPercent)}
                    </span>
                  </td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Comprehensive Dividend Management Section */}
      <section className="panel-card">
        <div className="panel-head">
          <div>
            <div className="title-with-info">
              <h3 style={{ margin: 0 }}>دفتر جامع سودهای مجمع (DPS)</h3>
              <InfoButton
                title="مدیریت و وضعیت سودهای مجمع (DPS)"
                formula="سود کل مجامع = سود مجمع محقق‌شده (واریزشده) + سود مجمع محقق‌نشده (در انتظار واریز)"
                description="ثبت، پیگیری و تغییر وضعیت وصول سودهای نقدی تقسیمی مجامع بورسی (DPS)."
                details={[
                  "محقق‌شده (واریزشده): سود نقداً از طریق سجام یا بانک به حساب واریز شده و مستقیماً به سود قطعی محقق‌شده پورتفو اضافه می‌گردد.",
                  "محقق‌نشده (در انتظار): مجمع عمومی عادی سالیانه برگزار و سود نقدی را تصویب کرده اما طبق مهلت قانونی واریز هنوز وصول نشده است.",
                  "با کلیک روی دکمه‌های «محقق‌شده» یا «محقق‌نشده» در هر ردیف، وضعیت سود را مستقیماً با ۱ کلیک تغییر دهید."
                ]}
              />
            </div>
            <p>
              ثبت و رصد تمام سودهای نقدی مجامع، تفکیک محقق‌شده از در انتظار، با امکان تغییر سریع وضعیت با یک کلیک
            </p>
          </div>
          <button
            type="button"
            className="button primary small-btn"
            onClick={() => {
              setEditingDividend(null);
              setDividendSymbol(currentStocks[0]?.symbol || items[0]?.symbol || "ALL");
            }}
          >
            + ثبت سود مجمع جدید
          </button>
        </div>

        {/* Filters and summary bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`button small-btn ${dividendFilter === "all" ? "primary" : "secondary"}`}
              onClick={() => setDividendFilter("all")}
            >
              همه ({data.stockDividends.length})
            </button>
            <button
              type="button"
              className={`button small-btn ${dividendFilter === "paid" ? "primary" : "secondary"}`}
              style={{
                background: dividendFilter === "paid" ? "#0b8a63" : undefined,
                color: dividendFilter === "paid" ? "#fff" : undefined,
                borderColor: dividendFilter === "paid" ? "#0b8a63" : undefined,
              }}
              onClick={() => setDividendFilter("paid")}
            >
              ✓ محقق‌شده ({data.stockDividends.filter((d) => d.status === "paid").length} مورد · {money(paidDividends)})
            </button>
            <button
              type="button"
              className={`button small-btn ${dividendFilter === "pending" ? "primary" : "secondary"}`}
              style={{
                background: dividendFilter === "pending" ? "#d97706" : undefined,
                color: dividendFilter === "pending" ? "#fff" : undefined,
                borderColor: dividendFilter === "pending" ? "#d97706" : undefined,
              }}
              onClick={() => setDividendFilter("pending")}
            >
              ⏳ محقق‌نشده ({data.stockDividends.filter((d) => d.status === "pending").length} مورد · {money(pendingDividends)})
            </button>
          </div>

          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            مجموع سودهای ثبت‌شده: <b style={{ color: "var(--ink)" }}>{money(totalDividends)} تومان</b>
          </div>
        </div>

        {/* Dividends Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader<DivSortKey>
                  field="symbol"
                  currentField={divSortKey}
                  direction={divSortDir}
                  onSort={handleDivSort}
                  label="نماد"
                />
                <SortableHeader<DivSortKey>
                  field="amount"
                  currentField={divSortKey}
                  direction={divSortDir}
                  onSort={handleDivSort}
                  label="مبلغ سود مجمع"
                />
                <SortableHeader<DivSortKey>
                  field="date"
                  currentField={divSortKey}
                  direction={divSortDir}
                  onSort={handleDivSort}
                  label="تاریخ مجمع / واریز"
                />
                <SortableHeader<DivSortKey>
                  field="notes"
                  currentField={divSortKey}
                  direction={divSortDir}
                  onSort={handleDivSort}
                  label="یادداشت / توضیحات"
                />
                <SortableHeader<DivSortKey>
                  field="status"
                  currentField={divSortKey}
                  direction={divSortDir}
                  onSort={handleDivSort}
                  label="وضعیت تحقق سود (تغییر سریع)"
                />
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sortedDividends.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    موردی مطابق فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                sortedDividends.map((div) => (
                  <tr key={div.id}>
                    <td>
                      <b className="stock-symbol">{div.symbol}</b>
                    </td>
                    <td>
                      <b>{money(div.amount)}</b>
                    </td>
                    <td>{toPersianDate(div.date)}</td>
                    <td style={{ color: "var(--muted)", fontSize: "12px" }}>
                      {div.notes || "—"}
                    </td>
                    <td>
                      {/* Interactive Dual Status Toggle */}
                      <div
                        style={{
                          display: "inline-flex",
                          background: "var(--bg)",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          padding: "2px",
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: div.status === "paid" ? "#0b8a63" : "transparent",
                            color: div.status === "paid" ? "#fff" : "var(--muted)",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title="کلیک برای تغییر به محقق‌شده (واریزشده)"
                          onClick={() => div.status !== "paid" && onToggleDividend(div, "paid")}
                        >
                          ✓ محقق‌شده
                        </button>
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: div.status === "pending" ? "#d97706" : "transparent",
                            color: div.status === "pending" ? "#fff" : "var(--muted)",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title="کلیک برای تغییر به محقق‌نشده (در انتظار پرداخت)"
                          onClick={() => div.status !== "pending" && onToggleDividend(div, "pending")}
                        >
                          ⏳ محقق‌نشده
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="button ghost small-btn"
                          title="ویرایش این سود مجمع"
                          onClick={() => {
                            setEditingDividend(div);
                            setDividendSymbol(div.symbol);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        {onDeleteDividend && (
                          <button
                            type="button"
                            className="button ghost small-btn negative-text"
                            title="حذف این سود مجمع"
                            onClick={() => {
                              if (window.confirm(`آیا از حذف سود مجمع ${money(div.amount)} نماد ${div.symbol} مطمئن هستید؟`)) {
                                onDeleteDividend(div.id);
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stock Operations: Price Updates & Hami Interest Deposit */}
      <section className="stock-ops-grid">
        <div className="panel-card">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>به‌روزرسانی قیمت‌های روز بازار سهام</h3>
                <InfoButton
                  title="به‌روزرسانی قیمت‌های روز بازار سهام"
                  formula="نرخ جدید در پایگاه داده ذخیره شده و ارزش روز و سود جاری نمادها بلافاصله بازآرایی می‌گردد"
                  description="امکان ثبت قیمت پایانی نمادها به صورت خودکار از بورس یا ورود دستی نرخ‌ها در تاریخ مشخص."
                  details={[
                    "دریافت خودکار از بورس: استعلام آخرین قیمت پایانی نمادها از وب‌سرویس مدیریت فناوری بورس (TSETMC).",
                    "ورود دستی: مناسب روزهایی که بازار بسته است یا تمایل دارید قیمت خاصی را برای ارزیابی ثبت کنید."
                  ]}
                />
              </div>
              <p>قیمت نمادهای فعال را دستی ثبت کنید یا از بورس دریافت کنید. نرخ جدیدِ هر روز مبنای همان روز است و نرخ‌های قبلی در تاریخچه می‌مانند.</p>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={isUpdatingPrices}
              onClick={handleAutoPricesClick}
            >
              <RefreshCw size={16} className={isUpdatingPrices ? "spin" : ""} />
              {isUpdatingPrices ? "در حال دریافت…" : "دریافت خودکار از بورس"}
            </button>
          </div>
          <form className="modal-form" onSubmit={handlePriceUpdateSubmit}>
            <label>
              <span>تاریخ اعمال قیمت‌ها</span>
              <JalaliDatePicker value={priceDate} onChange={setPriceDate} />
            </label>
            {!validIsoDate(priceDate) || priceDate > todayIso() ? <small className="negative-text">تاریخ نرخ پایانی باید معتبر باشد و از امروز جلوتر نباشد.</small> : null}
            <div className="bulk-price-list">
              {currentStocks.map((stock) => (
                <label className="bulk-price-row" key={stock.symbol}>
                  <span>
                    <b>{stock.symbol}</b>
                    <small>قیمت فعلی: {money(stock.price)}</small>
                  </span>
                  <input
                    inputMode="numeric"
                    placeholder="قیمت جدید"
                    value={pricesState[stock.symbol] ?? ""}
                    onChange={(e) =>
                      setPricesState({ ...pricesState, [stock.symbol]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="submit" className="button primary" disabled={!validIsoDate(priceDate) || priceDate > todayIso() || !Object.values(pricesState).some((value) => safeNumber(value) > 0)}>
                ثبت قیمت‌های جدید سهام
              </button>
              <button type="button" className="button secondary" onClick={onManagePrices}>
                تاریخچه و اصلاح قیمت‌های سهام
              </button>
            </div>
          </form>
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>مدیریت نقدینگی و سود صندوق حامی (مفید)</h3>
                <InfoButton
                  title="عملیات صندوق حامی کارگزاری مفید"
                  formula="مانده حامی = واریزها + سودها + فروش سهام - خریدها - برداشت‌ها"
                  description="ثبت مستقیم واریز سود ماهانه، واریز وجه نقد به حساب کارگزاری یا برداشت وجه به حساب بانکی."
                  details={[
                    "واریز سود ماهانه: سود روزشمار واریزی توسط کارگزاری مفید که مانده را افزایش می‌دهد و به عنوان سود ثبت می‌شود.",
                    "واریز وجه به کارگزاری: افزایش موجودی نقد حامی از محل حساب بانکی.",
                    "برداشت وجه از کارگزاری: تقاضای وجه و واریز به حساب بانکی که از مانده حامی کسر می‌کند."
                  ]}
                />
              </div>
              <p>ثبت واریز سود ماهانه، واریز وجه از بانک یا برداشت وجه به بانک</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              className={`button small-btn ${hamiOpMode === "interest" ? "primary" : "secondary"}`}
              onClick={() => setHamiOpMode("interest")}
            >
              واریز سود ماهانه حامی
            </button>
            <button
              type="button"
              className={`button small-btn ${hamiOpMode === "deposit" ? "primary" : "secondary"}`}
              onClick={() => setHamiOpMode("deposit")}
            >
              واریز وجه نقد به کارگزاری
            </button>
            <button
              type="button"
              className={`button small-btn ${hamiOpMode === "withdraw" ? "primary" : "secondary"}`}
              onClick={() => setHamiOpMode("withdraw")}
            >
              برداشت وجه نقد از کارگزاری
            </button>
          </div>

          <form className="modal-form" onSubmit={handleHamiSubmit}>
            {hamiOpMode !== "interest" && bankAccount && (
              <label>
                <span>مبدأ / مقصد پول</span>
                <select value={hamiCashSource} onChange={(e) => setHamiCashSource(e.target.value as "bank" | "external")}>
                  <option value="bank">حساب بانک داخل سبد (ثبت خودکار هر دو طرف انتقال)</option>
                  <option value="external">بیرون از سبد (آوردهٔ جدید / برداشت از سبد)</option>
                </select>
              </label>
            )}
            <label>
              <span>
                {hamiOpMode === "interest"
                  ? "مبلغ سود واریزی (تومان) *"
                  : hamiOpMode === "deposit"
                  ? "مبلغ واریز وجه به کارگزاری (تومان) *"
                  : "مبلغ برداشت وجه از کارگزاری (تومان) *"}
              </span>
              <input
                required
                inputMode="numeric"
                value={hamiAmount}
                onChange={(e) => setHamiAmount(e.target.value)}
                placeholder={hamiOpMode === "interest" ? "مثلاً ۵,۶۰۰,۰۰۰" : "مثلاً ۱۰,۰۰۰,۰۰۰"}
              />
            </label>
            <label>
              <span>تاریخ عملیات</span>
              <JalaliDatePicker value={hamidate} onChange={setHamiDate} />
            </label>
            <label>
              <span>یادداشت (اختیاری)</span>
              <input
                value={hamiNote}
                onChange={(e) => setHamiNote(e.target.value)}
                placeholder={
                  hamiOpMode === "interest"
                    ? "واریز سود ماهانه طرح حامی مفید"
                    : hamiOpMode === "deposit"
                    ? "واریز نقدی به حساب کارگزاری مفید"
                    : "برداشت وجه نقد از کارگزاری به بانک"
                }
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="button primary">
                {hamiOpMode === "interest"
                  ? "ثبت سود حامی"
                  : hamiOpMode === "deposit"
                  ? "ثبت واریز به حامی"
                  : "ثبت برداشت از حامی"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {selectedSymbol && (
        <StockSymbolTradesModal
          symbol={selectedSymbol}
          orders={data.stockOrders}
          dayOrder={data.settings.transactionDayOrder}
          cashAccounts={data.assets.filter((asset) => assetMode(asset) === "cash")}
          onClose={() => setSelectedSymbol(null)}
          onEditOrder={onEditOrder}
        />
      )}

      {dividendSymbol && (
        <StockDividendModal
          symbol={dividendSymbol === "ALL" ? null : dividendSymbol}
          symbols={allStockSymbols}
          dividends={data.stockDividends}
          initialDividend={editingDividend}
          onClose={() => {
            setDividendSymbol(null);
            setEditingDividend(null);
          }}
          onSave={onDividend}
          onToggleStatus={onToggleDividend}
          onDelete={onDeleteDividend}
        />
      )}
    </div>
  );
}

export function AssetsView({
  metrics,
  stockSummary,
  onAdd,
  onEdit,
  onQuickTx,
  onPrice,
  onUpdateCopy,
  onDelete,
  onViewTransactions,
  onCapitalIncrease,
  onLiquidityTransfer,
  onStockImport,
}: {
  metrics: AssetMetric[];
  stockSummary: BourseSummary;
  onAdd: () => void;
  onEdit?: (asset: Asset) => void;
  onQuickTx?: (asset: Asset) => void;
  onPrice: () => void;
  onUpdateCopy: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onViewTransactions?: (asset: Asset) => void;
  onCapitalIncrease?: (targetAssetId?: string) => void;
  onLiquidityTransfer?: (defaultFromId?: string, defaultToId?: string) => void;
  onStockImport?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("همه");

  const categories = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach((m) => {
      if (m.asset?.category) set.add(m.asset.category);
    });
    return ["همه", ...Array.from(set)];
  }, [metrics]);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      const matchSearch =
        !search ||
        m.asset.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.asset.category && m.asset.category.toLowerCase().includes(search.toLowerCase())) ||
        (m.asset.notes && m.asset.notes.toLowerCase().includes(search.toLowerCase()));
      const matchCat = selectedCat === "همه" || m.asset.category === selectedCat;
      return matchSearch && matchCat;
    });
  }, [metrics, search, selectedCat]);

  const totalFilteredValue = useMemo(
    () => filtered.reduce((sum, item) => sum + item.marketValue, 0),
    [filtered]
  );
  const totalFilteredProfit = useMemo(
    () => filtered.reduce((sum, item) => sum + item.totalProfit, 0),
    [filtered]
  );

  return (
    <div className="view-container">
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="جستجو در نام، دسته‌بندی یا یادداشت دارایی…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          {onStockImport && (
            <button
              type="button"
              className="button secondary"
              onClick={onStockImport}
              title="ورود فایل اکسل معاملات و گردش حساب کارگزاری (مفید)"
            >
              <FileUp size={18} /> ورود اکسل معاملات
            </button>
          )}
          <button type="button" className="button secondary" onClick={onPrice}>
            <RefreshCw size={18} /> به‌روزرسانی قیمت‌ها
          </button>
          <button type="button" className="button primary" onClick={onAdd}>
            <Plus size={18} /> تعریف دارایی جدید
          </button>
        </div>
      </div>

      {/* Category Pills and Summary Stats */}
      <div className="assets-filter-bar">
        <div className="category-pills-list">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-pill-btn ${selectedCat === cat ? "active" : ""}`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="assets-summary-badge">
          <span>{nf.format(filtered.length)} دارایی</span>
          <span className="dot-divider">·</span>
          <span>ارزش کل: <b>{money(totalFilteredValue)}</b></span>
          <span className="dot-divider">·</span>
          <span>
            سود / زیان:{" "}
            <b className={totalFilteredProfit >= 0 ? "positive-text" : "negative-text"}>
              {signedMoney(totalFilteredProfit)}
            </b>
          </span>
          <InfoButton
            title="خلاصه آمار دارایی‌های فیلترشده"
            formula="ارزش کل = مجموع ارزش روز دارایی‌های نمایش‌داده‌شده | سود کل = مجموع سود/زیان جاری و محقق‌شده دارایی‌های فیلترشده"
            description="ارزیابی وضعیت دسته‌بندی انتخاب‌شده از نظر سهم سرمایه و سودآوری."
            details={[
              "با انتخاب هر دسته‌بندی (طلا، سهام، ارز، نقدینگی)، ارقام به صورت پویا برای همان گروه محاسبه می‌گردند.",
              "جستجو در کادر بالا نیز نتایج این خلاصه را فیلتر می‌کند."
            ]}
          />
        </div>
      </div>

      <div className="assets-grid-full">
        {filtered.map((item) => {
          const mode = assetMode(item.asset);
          const isBourse = item.asset.name === "بورس";
          const displayedPercent = isBourse ? stockSummary.toDateReturnPercent : item.profitPercent;
          return (
            <div className="asset-card" key={item.asset.id}>
              <div className="asset-card-head">
                <div className="asset-card-title">
                  <span
                    className="category-tag"
                    style={{ borderRightColor: item.asset.color || "var(--primary)" }}
                  >
                    {item.asset.category}
                  </span>
                  <h3>{item.asset.name}</h3>
                  <InfoButton
                    title={`محاسبات دارایی: ${item.asset.name}`}
                    formula={
                      mode === "cash"
                        ? "مانده ریالی = مجموع واریزها + سودهای ماهانه + حاصل فروش سهام - خریدهای سهام - برداشت‌ها | سود کل = مجموع سودهای واریزی ماهانه"
                        : isBourse
                        ? "سود کل بورس = سود/زیان فروش سهام + سود قیمتی سهام موجود + مجامع پرداخت‌شده و در انتظار | درصد این کارت = سود کل ÷ بیشترین بهای خریدِ سهام هم‌زمان موجود در پایان یک روز × ۱۰۰؛ بازده سالانه نیست"
                        : "ارزش روز = موجودی × قیمت روز | سود کل = سود/زیان فروش‌های گذشته + ارزش روز موجودی − بهای تمام‌شدهٔ موجودی | درصد سود = (سود کل ÷ مجموع مبالغ همهٔ خریدهای ثبت‌شده) × ۱۰۰؛ این نسبت بازده سالانه نیست"
                    }
                    description={
                      mode === "cash"
                        ? `دارایی نقدی / صندوق حامی با سود روزشمار و ماهانه.`
                        : `روش دقیق ارزیابی دارایی ${item.asset.name} در سبد سرمایه‌گذاری.`
                    }
                    details={
                      mode === "cash"
                        ? [
                            `مانده نقدی روز: ${money(item.marketValue)} تومان`,
                            `مجموع سود ماهانه واریز شده: ${money(item.totalProfit)} تومان`,
                            item.asset.name.includes("حامی")
                              ? "با هر خرید سهام وجه از حامی کسر و با هر فروش سهام، وجه به حامی واریز می‌شود."
                              : "سرمایه‌گذاری نقدی با امکان واریز و برداشت مستقیم."
                          ]
                        : isBourse
                        ? [
                            `ارزش سهام فعال: ${money(item.marketValue)}.`,
                            `بیشترین پول درگیر بورس: ${money(stockSummary.peakOpenCost)}${stockSummary.peakOpenCostDate ? ` در پایان ${toPersianDate(stockSummary.peakOpenCostDate)}` : ""}.`,
                            `درصد این کارت همان نسبت سوم میزکار بورس است: سود کل ÷ بیشترین پول درگیر، نه مجموع خریدهای تاریخی (${money(stockSummary.purchases)}).`,
                            "پول نقد حامی و تغییر قیمت بازار در مخرج نیستند؛ این نسبت بازده سالانه یا آوردهٔ خالص نقدی نیست."
                          ]
                        : [
                            `موجودی فعلی: ${nf.format(item.quantity)} ${item.asset.unit || "واحد"} حاصل تفریق تمام فروش‌ها از خریدهاست.`,
                            `جمع بهای خریدهای ثبت‌شده: ${money(item.totalGrossBuys)}؛ مخرج درصد سود، حتی پس از فروش کامل، همین مبلغ است.`,
                            `میانگین بهای خرید موجودی فعلی: ${money(item.averageCost)} به ازای هر واحد است.`,
                            `قیمت روز بازار: ${money(item.asset.currentPrice)} ثبت شده است.`,
                            `ارزش ریالی روز: ${money(item.marketValue)} است.`
                          ]
                    }
                  />
                </div>
                {(mode !== "cash" || item.totalProfit !== 0) && (
                  <span
                    className={`pill-badge ${isBourse && stockSummary.peakOpenCost <= 0 ? "neutral" : displayedPercent >= 0 ? "positive" : "negative"}`}
                    title={mode === "cash" ? undefined : isBourse
                      ? stockSummary.peakOpenCost > 0
                        ? `سود کل بورس نسبت به بیشترین پول درگیر بورس (${money(stockSummary.peakOpenCost)}${stockSummary.peakOpenCostDate ? `؛ پایان ${toPersianDate(stockSummary.peakOpenCostDate)}` : ""})؛ همان نسبت سوم میزکار، نه بازده سالانه`
                        : "بدون خرید معتبر سهام، نسبت سود کل بورس قابل محاسبه نیست."
                      : `سود کل نسبت به مجموع بهای همهٔ خریدها (${money(item.totalGrossBuys)})؛ نه بازده سالانه`}
                  >
                    {isBourse && stockSummary.peakOpenCost <= 0 ? "—" : percent(displayedPercent)}
                  </span>
                )}
              </div>

              <div className="asset-card-body">
                <div className="body-val-row">
                  <span>ارزش روز</span>
                  <strong>{money(item.marketValue)}</strong>
                </div>

                <div className="body-meta-grid">
                  <div>
                    <small>موجودی</small>
                    <b>
                      {nf.format(item.quantity)} {item.asset.unit || "واحد"}
                    </b>
                  </div>
                  {mode !== "cash" && (
                    <div>
                      <small>میانگین خرید موجودی</small>
                      <b>{item.quantity > 0 && item.averageCost > 0 ? money(item.averageCost) : "—"}</b>
                    </div>
                  )}
                  {mode !== "cash" && (
                    <div>
                      <small>قیمت روز هر واحد</small>
                      <b>{money(item.asset.currentPrice)}</b>
                    </div>
                  )}
                  <div>
                    <small>سود / زیان کل</small>
                    <b className={item.totalProfit >= 0 ? "positive-text" : "negative-text"}>
                      {signedMoney(item.totalProfit)}
                    </b>
                  </div>
                </div>

                {item.asset.notes && (
                  <p className="asset-notes-preview" title={item.asset.notes}>
                    {item.asset.notes}
                  </p>
                )}
              </div>

              <div className="asset-card-actions">
                {onViewTransactions && (
                  <button
                    type="button"
                    className="button ghost small-btn"
                    onClick={() => onViewTransactions(item.asset)}
                    title="مشاهده تمام معاملات این دارایی"
                  >
                    <FileText size={14} /> مشاهده معاملات
                  </button>
                )}
                {item.asset.id === "asset-bank" && onCapitalIncrease && (
                  <button
                    type="button"
                    className="button primary small-btn"
                    onClick={() => onCapitalIncrease(item.asset.id)}
                    title="افزایش سرمایه و آورده نقدی به حساب بانک"
                  >
                    <Plus size={14} /> افزایش سرمایه
                  </button>
                )}
                {(item.asset.id === "asset-bank" ||
                  item.asset.id === "asset-hami" ||
                  item.asset.id === "asset-kian" ||
                  item.asset.id === "asset-deposit-cash" ||
                  item.asset.name.includes("دفتر گواهی")) &&
                  onLiquidityTransfer && (
                    <button
                      type="button"
                      className="button secondary small-btn"
                      onClick={() =>
                        onLiquidityTransfer(
                          item.asset.id,
                          item.asset.id === "asset-bank"
                            ? "asset-deposit-cash"
                            : "asset-bank"
                        )
                      }
                      title="جابجایی نقدینگی بین حساب‌ها (دفتر گواهی ⇄ کیان ⇄ حامی ⇄ بانک)"
                    >
                      <ArrowRightLeft size={14} /> انتقال نقدینگی
                    </button>
                  )}
                {onQuickTx && (
                  <button
                    type="button"
                    className="button secondary small-btn"
                    onClick={() => onQuickTx(item.asset)}
                    title="ثبت معامله برای این دارایی"
                  >
                    <Plus size={14} /> معامله
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    className="button ghost small-btn"
                    onClick={() => onEdit(item.asset)}
                    title="ویرایش نام، قیمت و تنظیمات دارایی"
                  >
                    <Pencil size={14} /> ویرایش
                  </button>
                )}
                {mode === "copy" && (
                  <button
                    type="button"
                    className="button ghost small-btn"
                    onClick={() => onUpdateCopy(item.asset)}
                  >
                    مانده دلاری
                  </button>
                )}
                <button
                  type="button"
                  className="button ghost danger small-btn"
                  onClick={() => onDelete(item.asset)}
                  title="حذف دارایی"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function transactionIssueDetail(issue: TransactionReview["issues"][number]) {
  // The audit retains technical IDs for diagnosis, but the list should explain
  // suspected duplicate movements without repeating those opaque IDs.
  if (issue.id.startsWith("cash-duplicate-")) {
    return "دو گردش وجه در یک حساب و یک روز، با مبلغ و شرح یکسان ثبت شده‌اند. صورت‌حساب را مقایسه کنید؛ فقط اگر یکی واقعاً تکراری است پس از تأیید حذف کنید. تغییر ماهیت به‌تنهایی ثبت تکراری را حذف نمی‌کند.";
  }
  if (issue.id.startsWith("duplicate-") && !issue.id.startsWith("duplicate-id-")) {
    return "ردیف دیگری با همین تاریخ، دارایی و مبلغ ثبت شده است. پیش از هر اصلاح یا حذف، اسناد هر دو ردیف را مقایسه کنید.";
  }
  return issue.detail;
}

export function TransactionsView({
  data,
  capitalReport,
  onShowReport,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  onCsv,
  onPdf,
  onStockImport,
  onEditStockOrder,
  onDeleteStockOrder,
  onAddStockOrder,
  onCapitalIncrease,
  onLiquidityTransfer,
  onSetHamiBalance,
}: {
  data: PortfolioData;
  capitalReport: CapitalReport;
  onShowReport?: () => void;
  onAdd: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onReorder?: (sourceKey: string, targetKey: string, position: DayRowPosition) => void;
  onCsv: () => void;
  onPdf: () => void;
  onStockImport: () => void;
  onEditStockOrder?: (order: StockOrder) => void;
  onDeleteStockOrder?: (id: string) => void;
  onAddStockOrder?: () => void;
  onCapitalIncrease?: () => void;
  onLiquidityTransfer?: (fromId?: string, toId?: string) => void;
  onSetHamiBalance?: () => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "errors" | "attention">("all");
  const reviewIndex = useMemo(() => indexTransactionReviews(capitalReport), [capitalReport]);
  const duplicateTransactionIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const tx of data.transactions) {
      if (seen.has(tx.id)) duplicates.add(tx.id);
      seen.add(tx.id);
    }
    return duplicates;
  }, [data.transactions]);

  type TxSortKey = "type" | "asset" | "date" | "quantity" | "unitPrice" | "totalPrice" | "notes";
  const [txSortKey, setTxSortKey] = useState<TxSortKey>("date");
  const [txSortDir, setTxSortDir] = useState<"asc" | "desc">("desc");

  const handleTxSort = (key: TxSortKey) => {
    if (txSortKey === key) {
      setTxSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTxSortKey(key);
      setTxSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const bourseAsset = useMemo(
    () => data.assets.find((a) => a.name === "بورس" || a.id === "asset-stocks"),
    [data.assets]
  );

  const isBourseFilter = useMemo(() => {
    return filterAsset === "asset-stocks" || (bourseAsset && filterAsset === bourseAsset.id);
  }, [filterAsset, bourseAsset]);

  interface UnifiedRow {
    id: string;
    orderKey: string;
    sourceType: "stock_order" | "hami_settlement" | "regular";
    type: "buy" | "sell";
    assetId: string;
    assetName: string;
    symbol?: string;
    date: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    commission?: number;
    notes: string;
    attachmentIds?: string[];
    rawTx?: Transaction;
    stockOrder?: StockOrder;
    review?: TransactionReview;
  }

  const allRows = useMemo<UnifiedRow[]>(() => {
    const bourseId = bourseAsset?.id || "asset-stocks";

    // 1. Stock orders representing Bourse trades
    const stockRows: UnifiedRow[] = (data.stockOrders || []).map((order) => {
      const sourceName =
        order.sourceAssetId === "asset-kian"
          ? "صندوق کیان"
          : "صندوق حامی (مبدا/مقصد معامله)";
      const commissionText = order.commission ? ` · کارمزد: ${money(order.commission)}` : "";
      return {
        id: `stock-${order.id}`,
        orderKey: ledgerRowKey("stockOrder", order.id),
        sourceType: "stock_order",
        type: order.type,
        assetId: bourseId,
        assetName: `بورس (${order.symbol})`,
        symbol: order.symbol,
        date: order.date,
        quantity: order.quantity,
        unit: "سهم",
        unitPrice: order.unitPrice,
        totalPrice: order.totalPrice,
        commission: order.commission,
        notes: order.notes
          ? `${order.notes}${commissionText} [تسویه با ${sourceName}]`
          : `${order.type === "buy" ? "خرید" : "فروش"} ${nf.format(order.quantity)} سهم ${order.symbol}${commissionText} [تسویه با ${sourceName}]`,
        stockOrder: order,
        review: reviewIndex.stockOrders.get(order.id),
      };
    });

    // 2. Regular transactions & auto-generated settlement transfers
    const txRows: UnifiedRow[] = (data.transactions || []).map((tx) => {
      const asset = data.assets.find((a) => a.id === tx.assetId);
      const isHamiSettlement =
        tx.assetId === "asset-hami" && (tx.notes?.includes("[stock-order:") || tx.kind === "transfer");
      
      // A generated settlement can belong to any selected cash account, not
      // only Hami. Its editable source is the stock order, not the cash leg.
      const linkedOrderId = isGeneratedStockTransfer(tx)
        ? tx.notes?.match(/\[stock-order:([^\]]+)\]/)?.[1] || tx.id.replace(/^hami-stock-(buy|sell|sale)-/, "")
        : undefined;
      const linkedOrder = linkedOrderId
        ? data.stockOrders?.find((order) => order.id === linkedOrderId) : undefined;

      return {
        id: tx.id,
        orderKey: ledgerRowKey("transaction", tx.id),
        sourceType: isHamiSettlement ? "hami_settlement" : "regular",
        type: tx.type,
        assetId: tx.assetId,
        assetName: asset?.name || "دارایی",
        date: tx.date,
        quantity: tx.quantity,
        unit: asset?.unit || "تومان",
        unitPrice: tx.unitPrice,
        totalPrice: tx.totalPrice,
        notes: describeTransactionNote(data, tx),
        attachmentIds: tx.attachmentIds,
        rawTx: tx,
        stockOrder: linkedOrder,
        review: reviewIndex.transactions.get(tx.id),
      };
    });

    return [...stockRows, ...txRows];
  }, [data, bourseAsset, reviewIndex]);

  const reviewCounts = useMemo(() => allRows.reduce((counts, row) => {
    if (row.review?.severity === "error") counts.errors += 1;
    else if (row.review?.severity === "warning") counts.warnings += 1;
    return counts;
  }, { errors: 0, warnings: 0 }), [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (reviewFilter === "errors" && row.review?.severity !== "error") return false;
      if (reviewFilter === "attention" && !row.review) return false;
      if (filterType !== "all" && row.type !== filterType) return false;

      if (filterAsset !== "all") {
        if (isBourseFilter) {
          // In Bourse filter: show all stock orders
          if (row.sourceType !== "stock_order") return false;
        } else if (filterAsset === "asset-hami") {
          // In Hami filter: show all Hami operations (interest, transfers, settlements)
          if (row.assetId !== "asset-hami") return false;
        } else {
          // Other specific asset
          if (row.assetId !== filterAsset) return false;
        }
      }

      if (filterFrom && row.date < filterFrom) return false;
      if (filterTo && row.date > filterTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNote = row.notes.toLowerCase().includes(q) ||
          Boolean(row.rawTx?.notes?.toLowerCase().includes(q));
        const matchName = row.assetName.toLowerCase().includes(q);
        const matchSymbol = row.symbol?.toLowerCase().includes(q);
        const matchReview = row.review?.issues.some((issue) =>
          issue.title.toLowerCase().includes(q) || transactionIssueDetail(issue).toLowerCase().includes(q));
        if (!matchNote && !matchName && !matchSymbol && !matchReview) return false;
      }

      return true;
    });
  }, [allRows, reviewFilter, filterType, filterAsset, isBourseFilter, filterFrom, filterTo, searchQuery]);

  const sortedTransactions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (txSortKey === "date") {
        // The saved same-day order is independent of ascending/descending dates.
        const dateCmp = (a.date || "").localeCompare(b.date || "");
        return dateCmp ? (txSortDir === "asc" ? dateCmp : -dateCmp)
          : compareRowsWithinDay(data.settings.transactionDayOrder, a, b);
      } else if (txSortKey === "type") {
        cmp = a.type.localeCompare(b.type);
      } else if (txSortKey === "asset") {
        cmp = (a.assetName || "").localeCompare(b.assetName || "", "fa");
      } else if (txSortKey === "quantity") {
        cmp = safeNumber(a.quantity) - safeNumber(b.quantity);
      } else if (txSortKey === "unitPrice") {
        cmp = safeNumber(a.unitPrice) - safeNumber(b.unitPrice);
      } else if (txSortKey === "totalPrice") {
        cmp = safeNumber(a.totalPrice) - safeNumber(b.totalPrice);
      } else if (txSortKey === "notes") {
        cmp = (a.notes || "").localeCompare(b.notes || "", "fa");
      }
      return txSortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, txSortKey, txSortDir, data.settings.transactionDayOrder]);

  const orderKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.orderKey, (counts.get(row.orderKey) || 0) + 1);
    return counts;
  }, [allRows]);
  const hasSameDayRows = useMemo(() => {
    const seen = new Set<string>();
    return allRows.some((row) => {
      if (!validIsoDate(row.date)) return false;
      if (seen.has(row.date)) return true;
      seen.add(row.date);
      return false;
    });
  }, [allRows]);
  const ambiguousDays = useMemo(() => {
    const seenByDate = new Map<string, Set<string>>();
    const ambiguous = new Set<string>();
    for (const row of allRows) {
      const keys = seenByDate.get(row.date) || new Set<string>();
      if (keys.has(row.orderKey)) ambiguous.add(row.date);
      keys.add(row.orderKey);
      seenByDate.set(row.date, keys);
    }
    return ambiguous;
  }, [allRows]);
  const canReorderRow = (row: UnifiedRow) =>
    Boolean(onReorder) && txSortKey === "date" && validIsoDate(row.date) &&
    !ambiguousDays.has(row.date) &&
    Boolean(row.sourceType === "stock_order" ? row.stockOrder?.id : row.rawTx?.id) &&
    orderKeyCounts.get(row.orderKey) === 1;
  const movableDayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (txSortKey !== "date" || !onReorder) return counts;
    for (const row of sortedTransactions) {
      const id = row.sourceType === "stock_order" ? row.stockOrder?.id : row.rawTx?.id;
      if (id && validIsoDate(row.date) && !ambiguousDays.has(row.date) && orderKeyCounts.get(row.orderKey) === 1) {
        counts.set(row.date, (counts.get(row.date) || 0) + 1);
      }
    }
    return counts;
  }, [sortedTransactions, orderKeyCounts, ambiguousDays, txSortKey, onReorder]);

  type DragSession = {
    pointerId: number;
    handle: HTMLButtonElement;
    sourceKey: string;
    date: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
    targetKey: string | null;
    position: DayRowPosition | null;
  };
  const activeDrag = useRef<DragSession | null>(null);
  const dragScrollFrame = useRef<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    sourceKey: string; targetKey: string | null; position: DayRowPosition | null;
  } | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState("");
  useEffect(() => () => {
    if (dragScrollFrame.current !== null) window.cancelAnimationFrame(dragScrollFrame.current);
    activeDrag.current = null;
  }, []);

  const moveLedgerRow = (sourceKey: string, targetKey: string, position: DayRowPosition, date: string) => {
    onReorder?.(sourceKey, targetKey, position);
    const source = allRows.find((row) => row.orderKey === sourceKey)?.assetName || "معامله";
    const target = allRows.find((row) => row.orderKey === targetKey)?.assetName || "ردیف دیگر";
    setOrderAnnouncement(`ترتیب نمایش ${toPersianDate(date)}: ${source} ${position === "before" ? "بالای" : "پایینِ"} ${target} قرار گرفت.`);
  };

  const updateDropTarget = (drag: DragSession) => {
    const tr = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLTableRowElement>("tr[data-ledger-key]");
    const targetKey = tr?.dataset.ledgerKey;
    const validTarget = tr?.closest("table.transaction-ledger-table") &&
      tr.dataset.ledgerDate === drag.date && targetKey !== drag.sourceKey &&
      targetKey && orderKeyCounts.get(targetKey) === 1;
    const nextKey = validTarget ? targetKey : null;
    const position = nextKey && tr
      ? drag.y < tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2 ? "before" : "after"
      : null;
    if (drag.targetKey !== nextKey || drag.position !== position) {
      drag.targetKey = nextKey;
      drag.position = position;
      setDragPreview({ sourceKey: drag.sourceKey, targetKey: nextKey, position });
    }
  };

  // Pointer capture works for mouse, pen and touch. Only the grip prevents touch
  // scrolling; swiping anywhere else in the table keeps normal mobile scrolling.
  const autoScrollDrag = () => {
    dragScrollFrame.current = null;
    const drag = activeDrag.current;
    if (!drag || !drag.moved) return;
    const edge = 100;
    const speed = drag.y < edge ? -Math.min(16, (edge - drag.y) / 4)
      : drag.y > window.innerHeight - edge ? Math.min(16, (drag.y - window.innerHeight + edge) / 4) : 0;
    if (speed) {
      const before = window.scrollY;
      window.scrollBy(0, speed);
      if (window.scrollY !== before) updateDropTarget(drag);
    }
    dragScrollFrame.current = window.requestAnimationFrame(autoScrollDrag);
  };

  const finishDrag = () => {
    const drag = activeDrag.current;
    activeDrag.current = null;
    if (dragScrollFrame.current !== null) window.cancelAnimationFrame(dragScrollFrame.current);
    dragScrollFrame.current = null;
    setDragPreview(null);
    if (drag?.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
  };

  const onOrderPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, row: UnifiedRow) => {
    if (!canReorderRow(row) || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    if (activeDrag.current) finishDrag();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDrag.current = {
      pointerId: event.pointerId, handle: event.currentTarget, sourceKey: row.orderKey,
      date: row.date, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false, targetKey: null, position: null,
    };
    setDragPreview({ sourceKey: row.orderKey, targetKey: null, position: null });
  };
  const onOrderPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 6) return;
    drag.moved = true;
    updateDropTarget(drag);
    if (dragScrollFrame.current === null) dragScrollFrame.current = window.requestAnimationFrame(autoScrollDrag);
  };
  const onOrderPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      drag.x = event.clientX;
      drag.y = event.clientY;
      updateDropTarget(drag);
    }
    const { sourceKey, targetKey, position, date } = drag;
    finishDrag();
    if (targetKey && position && txSortKey === "date") moveLedgerRow(sourceKey, targetKey, position, date);
  };

  // When viewing "All", avoid double-counting stock buy vs hami cash withdrawal for stats
  const totalSum = useMemo(() => {
    return filtered.reduce((sum, r) => sum + safeNumber(r.totalPrice), 0);
  }, [filtered]);

  const totalBuy = useMemo(() => {
    return filtered
      .filter((r) => {
        if (filterAsset === "all" && r.sourceType === "hami_settlement") return false;
        return r.type === "buy";
      })
      .reduce((sum, r) => sum + safeNumber(r.totalPrice), 0);
  }, [filtered, filterAsset]);

  const totalSell = useMemo(() => {
    return filtered
      .filter((r) => {
        if (filterAsset === "all" && r.sourceType === "hami_settlement") return false;
        return r.type === "sell";
      })
      .reduce((sum, r) => sum + safeNumber(r.totalPrice), 0);
  }, [filtered, filterAsset]);

  const hasActiveFilters =
    reviewFilter !== "all" ||
    filterType !== "all" ||
    filterAsset !== "all" ||
    Boolean(filterFrom) ||
    Boolean(filterTo) ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setReviewFilter("all");
    setFilterType("all");
    setFilterAsset("all");
    setFilterFrom("");
    setFilterTo("");
    setSearchQuery("");
  };

  return (
    <div className="view-container">
      <div className="view-toolbar">
        <div className="filter-controls">
          <div className="search-box small-search">
            <Search size={16} />
            <input
              placeholder="جستجو در شرح، خطا، نماد یا نام دارایی…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            aria-label="فیلتر وضعیت بررسی ردیف‌ها"
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
          >
            <option value="all">همهٔ ردیف‌ها</option>
            <option value="errors">فقط خطاهای کنترلی</option>
            <option value="attention">خطاها و موارد نیازمند بررسی</option>
          </select>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">تمام انواع معاملات</option>
            <option value="buy">فقط خرید / واریز</option>
            <option value="sell">فقط فروش / برداشت</option>
          </select>

          <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}>
            <option value="all">تمام دارایی‌ها</option>
            {data.assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>

          <div className="date-filter-range">
            <span>از:</span>
            <JalaliDatePicker value={filterFrom} onChange={setFilterFrom} allowEmpty />
            <span>تا:</span>
            <JalaliDatePicker value={filterTo} onChange={setFilterTo} allowEmpty />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="button ghost small-btn"
              onClick={resetFilters}
              title="پاک‌سازی فیلترها"
            >
              <RotateCcw size={14} /> بازنشانی
            </button>
          )}
        </div>

        <div className="toolbar-actions" style={{ flexWrap: "wrap", gap: "8px" }}>
          {onCapitalIncrease && (
            <button
              type="button"
              className="button ghost small-btn"
              style={{ borderColor: "var(--border)", fontWeight: 600 }}
              onClick={onCapitalIncrease}
              title="ثبت افزایش سرمایه و تزریق آورده نقدی به بانک"
            >
              <Plus size={16} /> افزایش سرمایه به بانک
            </button>
          )}
          {onLiquidityTransfer && (
            <button
              type="button"
              className="button ghost small-btn"
              style={{ borderColor: "var(--border)", fontWeight: 600 }}
              onClick={() => onLiquidityTransfer()}
              title="مدیریت نقدینگی و جابجایی بین کیان، حامی، دفتر گواهی و بانک"
            >
              <ArrowRightLeft size={16} /> مدیریت نقدینگی
            </button>
          )}
          {onAddStockOrder && (
            <button
              type="button"
              className="button secondary small-btn"
              onClick={onAddStockOrder}
              title="ثبت معامله جدید سهام در بورس"
            >
              <Plus size={16} /> معامله بورس
            </button>
          )}
          <button
            type="button"
            className="button secondary small-btn"
            onClick={onStockImport}
            title="ورود فایل اکسل معاملات یا گردش حساب کارگزاری (مفید)"
          >
            <FileUp size={16} /> ورود اکسل بورس
          </button>
          <button type="button" className="button secondary small-btn" onClick={onCsv}>
            <FileDown size={16} /> خروجی اکسل
          </button>
          <button type="button" className="button secondary small-btn" onClick={onPdf}>
            <FileText size={16} /> چاپ / PDF
          </button>
          <button
            type="button"
            className="button primary small-btn"
            onClick={isBourseFilter && onAddStockOrder ? onAddStockOrder : onAdd}
          >
            <Plus size={16} /> {isBourseFilter ? "ثبت معامله بورس" : "ثبت معامله جدید"}
          </button>
        </div>
      </div>

      {/* Bourse context banner when filtered */}
      {isBourseFilter && (
        <div
          style={{
            background: "rgba(32, 170, 148, 0.08)",
            border: "1px solid rgba(32, 170, 148, 0.25)",
            borderRadius: "10px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🏛️</span>
            <div>
              <b style={{ color: "var(--primary)" }}>معاملات سهام بورس و تسویه نقدینگی</b>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                صندوق حامی (کارگزاری مفید) مبدأ و مقصد مالی این معاملات است. با ثبت، ویرایش یا حذف هر معامله، مانده صندوق حامی به صورت کاملاً خودکار و دقیق همگام‌سازی می‌شود.
              </p>
            </div>
          </div>
          {onAddStockOrder && (
            <button
              type="button"
              className="button primary small-btn"
              onClick={onAddStockOrder}
            >
              <Plus size={14} /> ثبت خرید / فروش سهم
            </button>
          )}
        </div>
      )}

      {/* Hami context banner when filtered */}
      {filterAsset === "asset-hami" && (
        <div
          style={{
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "10px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💼</span>
            <div>
              <b style={{ color: "#2563eb" }}>صندوق حامی مفید (مبدأ و مقصد معاملات بورس)</b>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                شامل سودهای روزشمار ماهانه، واریز/برداشت وجه با بانک، و مبالغ خودکار حاصل از خرید و فروش سهام بورس.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {onSetHamiBalance && (
              <button
                type="button"
                className="button secondary small-btn"
                onClick={onSetHamiBalance}
                title="ثبت یا اصلاح مانده واقعی صندوق حامی (مفید)"
              >
                <DollarSign size={14} /> ثبت مانده واقعی حامی
              </button>
            )}
            {onLiquidityTransfer && (
              <button
                type="button"
                className="button secondary small-btn"
                onClick={() => onLiquidityTransfer("asset-hami", "asset-bank")}
              >
                <ArrowRightLeft size={14} /> جابجایی نقدینگی با بانک / کیان
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deposit Certificate Cash Ledger context banner when filtered */}
      {(filterAsset === "asset-deposit-cash" ||
        data.assets.find((a) => a.id === filterAsset)?.name?.includes("دفتر گواهی")) && (
        <div
          style={{
            background: "rgba(2, 132, 199, 0.08)",
            border: "1px solid rgba(2, 132, 199, 0.25)",
            borderRadius: "10px",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🪙</span>
            <div>
              <b style={{ color: "#0284c7" }}>دفتر گواهی سپرده (مبدأ و مقصد معاملات بورس کالا)</b>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                شامل واریز/برداشت وجه با بانک و حامی، و مبالغ تسویه خودکار خرید و فروش گواهی‌های سپرده کالایی (مس، روی، میلگرد و...).
              </p>
            </div>
          </div>
          {onLiquidityTransfer && (
            <button
              type="button"
              className="button secondary small-btn"
              onClick={() => onLiquidityTransfer(filterAsset, "asset-bank")}
            >
              <ArrowRightLeft size={14} /> جابجایی نقدینگی با بانک / حامی
            </button>
          )}
        </div>
      )}

      {/* KPI Stats Chips */}
      <div className="tx-stats-chips">
        <div className="tx-stat-chip">
          <div className="title-with-info">
            <small>تعداد معاملات</small>
            <InfoButton
              title="تعداد معاملات فیلترشده"
              formula="شمارش تعداد رکوردهای منطبق با فیلترهای وضعیت بررسی، جستجو، نوع، دارایی و بازه تاریخی"
              description="تعداد سفارش‌ها و عملیات مالی انجام‌شده در پورتفو."
            />
          </div>
          <b>{nf.format(filtered.length)} ردیف</b>
        </div>
        <div className="tx-stat-chip">
          <div className="title-with-info">
            <small>مجموع خرید و واریز</small>
            <InfoButton
              title="مجموع خرید و واریز"
              formula="مجموع (تعداد × قیمت واحد) برای کلیه تراکنش‌های از نوع خرید یا واریز نقدی"
              description="کل مبالغ نقدی تزریق‌شده به دارایی‌ها در بازه فیلترشده."
            />
          </div>
          <b className="positive-text">{money(totalBuy)}</b>
        </div>
        <div className="tx-stat-chip">
          <div className="title-with-info">
            <small>مجموع فروش و برداشت</small>
            <InfoButton
              title="مجموع فروش و برداشت"
              formula="مجموع (تعداد × قیمت واحد) برای کلیه تراکنش‌های از نوع فروش دارایی یا برداشت وجه"
              description="کل نقدینگی خارج‌شده یا دریافتی حاصل از نقدکردن دارایی‌ها."
            />
          </div>
          <b className="negative-text">{money(totalSell)}</b>
        </div>
        <div className="tx-stat-chip">
          <div className="title-with-info">
            <small>خالص جریان مالی (خرید منهای فروش)</small>
            <InfoButton
              title="خالص جریان مالی (Cash Flow)"
              formula="خالص جریان مالی = مجموع خریدها و واریزها - مجموع فروش‌ها و برداشت‌ها"
              description="نشان‌دهنده خالص ورود سرمایه تازه (مثبت) یا خروج نقدینگی (منفی) در بازه انتخابی."
            />
          </div>
          <b className={totalBuy - totalSell >= 0 ? "positive-text" : "negative-text"}>
            {signedMoney(totalBuy - totalSell)}
          </b>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head">
          <div className="title-with-info">
            <h3 style={{ margin: 0 }}>دفتر کل معاملات و گردش حساب</h3>
            <InfoButton
              title="دفتر کل معاملات و گردش حساب"
              formula="مبلغ کل هر ردیف = تعداد × قیمت واحد معامله | ته‌برگ جدول = مجموع مبالغ تمام ردیف‌های نمایان"
              description="ثبت رسمی و زمان‌بندی‌شده کلیه خریدها، فروش‌ها، معاملات بورسی و گردش‌های نقدی."
              details={[
                "معاملات بورسی شامل نام نماد، قیمت هر سهم، کارمزد و تسویه با صندوق حامی می‌باشند.",
                "امکان ویرایش مستقیم سفارش‌های بورس و هم‌گام‌سازی خودکار تسویه صندوق حامی فراهم است.",
                "ردیف‌های سبز: نشان‌دهنده خرید دارایی، دریافت سهم یا واریز نقدی است.",
                "ردیف‌های قرمز: نشان‌دهنده فروش سهم، خروج دارایی یا برداشت وجه است.",
              ]}
            />
          </div>
          <span className="tag">{nf.format(filtered.length)} تراکنش</span>
        </div>
        <div className="transaction-review-guide" aria-label="وضعیت بررسی معاملات">
          <div className="transaction-review-counts">
            <span className="transaction-review-count error"><AlertTriangle size={15} aria-hidden="true" /> {nf.format(reviewCounts.errors)} ردیف با خطای کنترلی</span>
            <span className="transaction-review-count warning"><AlertTriangle size={15} aria-hidden="true" /> {nf.format(reviewCounts.warnings)} ردیف نیازمند بررسی</span>
          </div>
          <p>شمارش برای کل دفتر است؛ فیلتر بالا فقط ردیف‌های دلخواه را نشان می‌دهد. این نشان‌ها نتیجهٔ کنترل هستند، نه اثبات اشتباه ردیف. فقط پس از تطبیق با سند ویرایش کنید؛ موارد مربوط به قیمت، سود مجمع و کل سرمایه در گزارش کامل‌اند.</p>
          {onShowReport && <button type="button" className="button ghost small-btn" onClick={onShowReport}>گزارش کامل سرمایه</button>}
        </div>
        {onReorder && hasSameDayRows && (
          <div className="transaction-order-guide" id="transaction-order-help">
            <GripVertical size={18} aria-hidden="true" />
            <p>
              {txSortKey === "date"
                ? "برای جابجایی ردیف‌های یک روز، دستگیره را بکشید یا دکمه‌های بالا و پایین را بزنید."
                : "برای جابجایی ردیف‌های یک روز، ابتدا جدول را بر اساس تاریخ مرتب کنید."}
              <small>ترتیب نمایش در این مرورگر و پشتیبان JSON ذخیره می‌شود؛ تاریخ، ساعت، مبلغ و محاسبات مالی تغییر نمی‌کنند. شناسهٔ تکراری مانع جابجایی آن ردیف و، اگر در همان روز تکرار شود، مانع جابجایی کل روز است.</small>
              {hasActiveFilters && <small>فیلتر فعال است؛ جابجایی نسبت به ردیف‌های نمایان همان روز انجام می‌شود. برای دیدن همهٔ ردیف‌ها، فیلتر را بازنشانی کنید.</small>}
            </p>
            {txSortKey !== "date" && (
              <button type="button" className="button secondary small-btn" onClick={() => { setTxSortKey("date"); setTxSortDir("desc"); }}>
                مرتب‌سازی تاریخ
              </button>
            )}
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">{orderAnnouncement}</span>
        <div className="table-wrapper">
          <table className="data-table transaction-ledger-table">
            <thead>
              <tr>
                <SortableHeader<TxSortKey>
                  field="type"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="نوع معامله"
                />
                <SortableHeader<TxSortKey>
                  field="asset"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="دارایی / نماد"
                />
                <SortableHeader<TxSortKey>
                  field="date"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="تاریخ معامله"
                />
                <SortableHeader<TxSortKey>
                  field="quantity"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="تعداد / مقدار"
                />
                <SortableHeader<TxSortKey>
                  field="unitPrice"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="قیمت واحد"
                />
                <SortableHeader<TxSortKey>
                  field="totalPrice"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="مبلغ کل"
                />
                <SortableHeader<TxSortKey>
                  field="notes"
                  currentField={txSortKey}
                  direction={txSortDir}
                  onSort={handleTxSort}
                  label="یادداشت / جزئیات تسویه"
                />
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    معامله‌ای با این فیلترها یافت نشد.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((row, index) => {
                  const isStockOrder = row.sourceType === "stock_order";
                  const isHamiSettlement = row.sourceType === "hami_settlement";
                  const generatedSettlement = Boolean(row.rawTx && isGeneratedStockTransfer(row.rawTx));
                  const hasDuplicateId = Boolean(row.rawTx && duplicateTransactionIds.has(row.rawTx.id));
                  const canQuickEdit = isStockOrder || generatedSettlement
                    ? Boolean(row.stockOrder && onEditStockOrder) : Boolean(row.rawTx);
                  const sameDayAbove = sortedTransactions[index - 1]?.date === row.date;
                  const sameDayBelow = sortedTransactions[index + 1]?.date === row.date;
                  const above = sameDayAbove && canReorderRow(sortedTransactions[index - 1]) ? sortedTransactions[index - 1] : null;
                  const below = sameDayBelow && canReorderRow(sortedTransactions[index + 1]) ? sortedTransactions[index + 1] : null;
                  const canDrag = canReorderRow(row) && (movableDayCounts.get(row.date) || 0) > 1;
                  const orderLabel = `${row.assetName} در ${toPersianDate(row.date)}`;
                  return (
                    <tr
                      key={orderKeyCounts.get(row.orderKey) === 1 ? row.orderKey : `${row.sourceType}-${row.id}-${index}`}
                      data-ledger-key={row.orderKey}
                      data-ledger-date={row.date}
                      className={[
                        row.review ? `transaction-review-row ${row.review.severity}` : "",
                        dragPreview?.sourceKey === row.orderKey ? "transaction-dragging" : "",
                        dragPreview?.targetKey === row.orderKey ? `transaction-drop-${dragPreview.position}` : "",
                      ].filter(Boolean).join(" ") || undefined}
                    >
                      <td>
                        <span className={`pill-badge ${row.type === "buy" ? "positive" : "negative"}`}>
                          {isStockOrder
                            ? row.type === "buy" ? "خرید سهام" : "فروش سهام"
                            : isHamiSettlement
                            ? row.type === "buy" ? "واریز فروش سهم" : "برداشت خرید سهم"
                            : row.type === "buy" ? "خرید / واریز" : "فروش / برداشت"}
                        </span>
                        {onReorder && txSortKey === "date" && (sameDayAbove || sameDayBelow) && (
                          <div className="transaction-order-controls" role="group" aria-label={`ترتیب ${orderLabel}`}>
                            <button
                              type="button"
                              className="transaction-drag-handle"
                              aria-label={`دستگیرهٔ جابجایی ${orderLabel} در همین روز؛ بکشید یا با صفحه‌کلید کلیدهای بالا و پایین را بزنید`}
                              aria-describedby="transaction-order-help"
                              title={canDrag ? "برای جابجایی در همین روز بکشید" : "جابجایی این ردیف ممکن نیست؛ شناسهٔ تکراری یا تاریخ نامعتبر را بررسی کنید"}
                              disabled={!canDrag}
                              onPointerDown={(event) => onOrderPointerDown(event, row)}
                              onPointerMove={onOrderPointerMove}
                              onPointerUp={onOrderPointerUp}
                              onPointerCancel={finishDrag}
                              onLostPointerCapture={(event) => {
                                if (activeDrag.current?.pointerId === event.pointerId) finishDrag();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Escape" && activeDrag.current?.sourceKey === row.orderKey) finishDrag();
                                if (event.key === "ArrowUp" && above) {
                                  event.preventDefault();
                                  moveLedgerRow(row.orderKey, above.orderKey, "before", row.date);
                                }
                                if (event.key === "ArrowDown" && below) {
                                  event.preventDefault();
                                  moveLedgerRow(row.orderKey, below.orderKey, "after", row.date);
                                }
                              }}
                            >
                              <GripVertical size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="transaction-order-up"
                              aria-label={`بالا بردن ${orderLabel} در همین روز`}
                              title="یک ردیف بالاتر در همین روز"
                              disabled={!canReorderRow(row) || !above}
                              onClick={() => { if (above) moveLedgerRow(row.orderKey, above.orderKey, "before", row.date); }}
                            >
                              <ArrowUp size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="transaction-order-down"
                              aria-label={`پایین بردن ${orderLabel} در همین روز`}
                              title="یک ردیف پایین‌تر در همین روز"
                              disabled={!canReorderRow(row) || !below}
                              onClick={() => { if (below) moveLedgerRow(row.orderKey, below.orderKey, "after", row.date); }}
                            >
                              <ArrowDown size={15} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="transaction-review-asset">
                          <div className="transaction-review-asset-name">
                            <b>{row.assetName}</b>
                            {row.symbol && (
                              <span className="stock-symbol-badge" style={{ fontSize: "11px" }}>
                                {row.symbol}
                              </span>
                            )}
                            {isHamiSettlement && (
                              <span className="tag" style={{ fontSize: "10px", padding: "1px 6px" }}>
                                تسویه معامله
                              </span>
                            )}
                          </div>
                          {row.review && (
                            <div className={`transaction-review-asset-flag ${row.review.severity}`}>
                              <span><AlertTriangle size={13} aria-hidden="true" /> {row.review.severity === "error" ? "خطای کنترلی" : "نیازمند بررسی"}</span>
                              <small>{row.review.issues[0].title}</small>
                              {hasDuplicateId ? (
                                <small>شناسهٔ تکراری؛ ویرایش تکی امن نیست.</small>
                              ) : generatedSettlement && !row.stockOrder ? (
                                <small>سفارش مرتبط پیدا نشد؛ فایل پشتیبان را بررسی کنید.</small>
                              ) : canQuickEdit && (
                                <button
                                  type="button"
                                  className="button secondary small-btn transaction-review-inline-edit"
                                  onClick={() => {
                                    if ((isStockOrder || generatedSettlement) && row.stockOrder) onEditStockOrder?.(row.stockOrder);
                                    else if (row.rawTx) onEdit(row.rawTx);
                                  }}
                                  aria-label={`بررسی و ویرایش ${isStockOrder ? `سفارش ${row.assetName}` : generatedSettlement ? `سفارش مرتبط با ${row.assetName}` : `معاملهٔ ${row.assetName}`}: ${row.review.issues[0].title}`}
                                >
                                  <Pencil size={12} aria-hidden="true" /> {generatedSettlement ? "ویرایش سفارش مرتبط" : isStockOrder ? "ویرایش همین سفارش" : "ویرایش همین ردیف"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{toPersianDate(row.date)}</td>
                      <td>
                        {nf.format(row.quantity)} {row.unit}
                      </td>
                      <td>{money(row.unitPrice)}</td>
                      <td>
                        <b>{money(row.totalPrice)}</b>
                      </td>
                      <td>
                        <div className="notes-cell" style={{ whiteSpace: "pre-line", lineHeight: 1.4 }}>
                          {row.review && (
                            <div className={`transaction-review-note ${row.review.severity}`}>
                              <div className="transaction-review-head">
                                <span className="transaction-review-label">
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  {row.review.severity === "error" ? "خطای کنترلی" : "نیازمند بررسی"}
                                </span>
                                <strong>{row.review.issues[0].title}</strong>
                                {row.review.issues.length > 1 && <span>+ {nf.format(row.review.issues.length - 1)} مورد دیگر</span>}
                              </div>
                              <details className="transaction-review-details">
                                <summary>دلیل و راهنمای بررسی</summary>
                                <ul>{row.review.issues.map((issue) => (
                                  <li key={issue.id}><b>{issue.title}:</b> {transactionIssueDetail(issue)}</li>
                                ))}</ul>
                              </details>
                            </div>
                          )}
                          <span>{row.notes || "—"}</span>
                          {row.attachmentIds && row.attachmentIds.length > 0 && (
                            <span className="tag">
                              {row.attachmentIds.length} فایل پیوست
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          {/* Stock Order Actions */}
                          {isStockOrder && row.stockOrder && onEditStockOrder && (
                            <button
                              type="button"
                              className={`button ${row.review ? "secondary" : "ghost"} small-btn`}
                              onClick={() => onEditStockOrder(row.stockOrder!)}
                              title="ویرایش این سفارش سهام"
                            >
                              {row.review ? "بررسی و ویرایش" : "ویرایش"}
                            </button>
                          )}
                          {isStockOrder && row.stockOrder && onDeleteStockOrder && (
                            <button
                              type="button"
                              className="button ghost danger small-btn"
                              onClick={() => onDeleteStockOrder(row.stockOrder!.id)}
                              title="حذف این سفارش سهام و تعدیل تسویه حامی"
                            >
                              حذف
                            </button>
                          )}

                          {/* Hami Settlement linked to stock order */}
                          {isHamiSettlement && row.stockOrder && onEditStockOrder && (
                            <button
                              type="button"
                              className="button ghost small-btn"
                              onClick={() => onEditStockOrder(row.stockOrder!)}
                              title="ویرایش سفارش سهام مرتبط با این تسویه"
                            >
                              ویرایش سفارش
                            </button>
                          )}

                          {/* Regular Transaction Actions */}
                          {!isStockOrder && row.rawTx && (
                            <>
                              <button
                                type="button"
                                className={`button ${row.review ? "secondary" : "ghost"} small-btn`}
                                onClick={() => onEdit(row.rawTx!)}
                                disabled={hasDuplicateId}
                                title={hasDuplicateId ? "شناسهٔ این تراکنش تکراری است؛ ویرایش تکی امن نیست" : generatedSettlement ? "ویرایش سفارش بورس مرتبط با این تسویه" : "ویرایش تراکنش"}
                              >
                                {generatedSettlement ? "ویرایش سفارش مرتبط" : row.review ? "بررسی و ویرایش" : "ویرایش"}
                              </button>
                              <button
                                type="button"
                                className="button ghost danger small-btn"
                                onClick={() => onDelete(row.rawTx!)}
                                disabled={hasDuplicateId}
                                title={hasDuplicateId ? "شناسهٔ این تراکنش تکراری است؛ حذف تکی امن نیست" : generatedSettlement ? "حذف سفارش بورس و تسویهٔ مرتبط، پس از تأیید" : "حذف تراکنش"}
                              >
                                {generatedSettlement ? "حذف سفارش" : "حذف"}
                              </button>
                              {hasDuplicateId && <span className="transaction-review-unsafe">شناسهٔ تکراری؛ ویرایش یا حذف تکی امن نیست. فایل پشتیبان را بررسی کنید.</span>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  <b>مجموع مبالغ ردیف‌های انتخاب‌شده:</b>
                </td>
                <td colSpan={3}>
                  <b style={{ fontSize: "15px", color: "var(--primary)" }}>
                    {money(totalSum)}
                  </b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function AssetDetailChartVisualizer({
  asset,
  item,
  txs,
  buyTxs,
  sellTxs,
  avgBuyPrice,
  currentPrice,
}: {
  asset: Asset;
  item: AssetMetric;
  txs: Transaction[];
  buyTxs: Transaction[];
  sellTxs: Transaction[];
  avgBuyPrice: number;
  currentPrice: number;
}) {
  const [activeTab, setActiveTab] = useState<"trades" | "flow">("trades");
  const [hoveredTx, setHoveredTx] = useState<{
    tx: Transaction;
    x: number;
    y: number;
  } | null>(null);

  // Prepare sorted chronological points for trades chart
  const chronTxList = useMemo(() => {
    return [...txs]
      .filter((t) => safeNumber(t.unitPrice) > 0)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [txs]);

  // Chart bounds & points calculation
  const chartData = useMemo(() => {
    if (chronTxList.length === 0) return null;

    const prices = chronTxList.map((t) => safeNumber(t.unitPrice));
    if (avgBuyPrice > 0) prices.push(avgBuyPrice);
    if (currentPrice > 0) prices.push(currentPrice);

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const padding = (maxP - minP) * 0.15 || maxP * 0.1 || 100;
    const yMin = Math.max(0, minP - padding);
    const yMax = maxP + padding;

    const svgWidth = 600;
    const svgHeight = 200;
    const padX = 45;
    const padY = 25;
    const usableW = svgWidth - padX * 2;
    const usableH = svgHeight - padY * 2;

    const points = chronTxList.map((tx, idx) => {
      const x =
        chronTxList.length === 1
          ? svgWidth / 2
          : padX + (idx / (chronTxList.length - 1)) * usableW;
      const uPrice = safeNumber(tx.unitPrice);
      const ratio = (uPrice - yMin) / (yMax - yMin || 1);
      const y = svgHeight - padY - ratio * usableH;
      return { tx, x, y, uPrice };
    });

    const avgY =
      avgBuyPrice > 0
        ? svgHeight - padY - ((avgBuyPrice - yMin) / (yMax - yMin || 1)) * usableH
        : null;

    const curY =
      currentPrice > 0
        ? svgHeight - padY - ((currentPrice - yMin) / (yMax - yMin || 1)) * usableH
        : null;

    const linePath =
      points.length > 1
        ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
        : "";

    return {
      points,
      linePath,
      avgY,
      curY,
      yMin,
      yMax,
      svgWidth,
      svgHeight,
    };
  }, [chronTxList, avgBuyPrice, currentPrice]);

  // Financial capital flow calculations
  const totalBuyAmount = useMemo(
    () => buyTxs.reduce((sum, t) => sum + safeNumber(t.totalPrice), 0),
    [buyTxs]
  );
  const totalSellAmount = useMemo(
    () => sellTxs.reduce((sum, t) => sum + safeNumber(t.totalPrice), 0),
    [sellTxs]
  );
  const currentValue = safeNumber(item.marketValue);
  const totalOutflow = totalSellAmount + currentValue;
  const maxCap = Math.max(totalBuyAmount, totalOutflow, 1);

  return (
    <div className="asset-chart-card">
      <div className="asset-chart-header">
        <div className="chart-header-title">
          <div className="chart-header-icon">
            <Activity size={18} />
          </div>
          <div>
            <h6>تجزیه و تحلیل تصویری و چارت دارایی</h6>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              بررسی روند نقطه‌ای معاملات و موازنه جریان نقدینگی
            </span>
          </div>
        </div>
        <div className="chart-mode-toggle">
          <button
            type="button"
            className={`chart-toggle-btn ${activeTab === "trades" ? "active" : ""}`}
            onClick={() => setActiveTab("trades")}
          >
            نمودار معاملات و قیمت
          </button>
          <button
            type="button"
            className={`chart-toggle-btn ${activeTab === "flow" ? "active" : ""}`}
            onClick={() => setActiveTab("flow")}
          >
            توازن و گردش سرمایه
          </button>
        </div>
      </div>

      {activeTab === "trades" ? (
        <div className="asset-timeline-chart-wrap">
          {!chartData || chartData.points.length === 0 ? (
            <div className="chart-empty-state">
              برای رسم نمودار معاملات، حداقل یک تراکنش با قیمت واحد معتبر مورد نیاز است.
            </div>
          ) : (
            <div
              className="chart-svg-container"
              onMouseLeave={() => setHoveredTx(null)}
            >
              <svg
                viewBox={`0 0 ${chartData.svgWidth} ${chartData.svgHeight}`}
                className="asset-interactive-svg"
              >
                {/* Horizontal reference lines */}
                <line
                  x1="30"
                  y1={chartData.svgHeight - 25}
                  x2={chartData.svgWidth - 30}
                  y2={chartData.svgHeight - 25}
                  stroke="var(--line)"
                  strokeWidth="1"
                />

                {/* Average Buy Price reference line */}
                {chartData.avgY !== null && (
                  <g>
                    <line
                      x1="30"
                      y1={chartData.avgY}
                      x2={chartData.svgWidth - 30}
                      y2={chartData.avgY}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartData.svgWidth - 35}
                      y={Math.max(14, chartData.avgY - 4)}
                      fill="#d97706"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      میانگین خرید: {money(avgBuyPrice)}
                    </text>
                  </g>
                )}

                {/* Current Price reference line */}
                {chartData.curY !== null && (
                  <g>
                    <line
                      x1="30"
                      y1={chartData.curY}
                      x2={chartData.svgWidth - 30}
                      y2={chartData.curY}
                      stroke="#059669"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <text
                      x="35"
                      y={Math.max(14, chartData.curY - 4)}
                      fill="#059669"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      قیمت روز: {money(currentPrice)}
                    </text>
                  </g>
                )}

                {/* Connecting Trend Line */}
                {chartData.linePath && (
                  <path
                    d={chartData.linePath}
                    fill="none"
                    stroke="rgba(100, 116, 139, 0.4)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Transaction Dots */}
                {chartData.points.map((p) => {
                  const isBuy = p.tx.type === "buy";
                  const isSelected = hoveredTx?.tx.id === p.tx.id;
                  return (
                    <g
                      key={p.tx.id}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredTx({ tx: p.tx, x: p.x, y: p.y })}
                    >
                      {isSelected && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="10"
                          fill={isBuy ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}
                        />
                      )}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 6 : 4.5}
                        fill={isBuy ? "#10b981" : "#ef4444"}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredTx && (
                <div
                  className="chart-interactive-tooltip"
                  style={{
                    left: `${(hoveredTx.x / chartData.svgWidth) * 100}%`,
                    top: `${(hoveredTx.y / chartData.svgHeight) * 100}%`,
                  }}
                >
                  <div className="tooltip-badge-row">
                    <span
                      className={`pill-badge ${hoveredTx.tx.type === "buy" ? "positive" : "negative"}`}
                      style={{ fontSize: "10px", padding: "1px 6px" }}
                    >
                      {hoveredTx.tx.type === "buy" ? "خرید" : "فروش"}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                      {toPersianDate(hoveredTx.tx.date)}
                    </span>
                  </div>
                  <div className="tooltip-line">
                    <span>قیمت واحد:</span>
                    <b>{money(hoveredTx.tx.unitPrice)}</b>
                  </div>
                  <div className="tooltip-line">
                    <span>تعداد:</span>
                    <b>{nf.format(hoveredTx.tx.quantity)} {asset.unit || ""}</b>
                  </div>
                  <div className="tooltip-line">
                    <span>مبلغ کل:</span>
                    <b>{money(hoveredTx.tx.totalPrice)}</b>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="chart-legend-row">
            <div className="legend-item">
              <span className="legend-marker buy" />
              <span>نقاط خرید (سبز)</span>
            </div>
            <div className="legend-item">
              <span className="legend-marker sell" />
              <span>نقاط فروش (قرمز)</span>
            </div>
            {avgBuyPrice > 0 && (
              <div className="legend-item">
                <span className="legend-marker cost" />
                <span>خط بهای میانگین خرید ({money(avgBuyPrice)})</span>
              </div>
            )}
            {currentPrice > 0 && (
              <div className="legend-item">
                <span className="legend-marker current" />
                <span>خط قیمت روز بازار ({money(currentPrice)})</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="asset-capital-flow-wrap">
          <div className="capital-flow-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="capital-metric-tile" style={{ borderRight: "3px solid #0284c7" }}>
              <span className="tile-label">حداکثر سرمایهٔ درگیر این دارایی</span>
              <span className="tile-val" style={{ color: "#0369a1" }}>
                {money(item.freshCapital)}
              </span>
              <small>حداکثر سرمایه خالص درگیر (بدون چرخش مجدد فروش‌ها)</small>
            </div>
            {totalBuyAmount > item.freshCapital && (
              <div className="capital-metric-tile" style={{ borderRight: "3px solid #6366f1" }}>
                <span className="tile-label">گردش مجدد عایدی‌ها</span>
                <span className="tile-val" style={{ color: "#4f46e5" }}>
                  {money(totalBuyAmount - item.freshCapital)}
                </span>
                <small>خرید انجام‌شده از محل نقدینگی حاصل از فروش قبلی</small>
              </div>
            )}
            <div className="capital-metric-tile">
              <span className="tile-label">بازگشت سرمایه حاصل از فروش</span>
              <span className="tile-val" style={{ color: totalSellAmount > 0 ? "#2563eb" : "var(--muted)" }}>
                {money(totalSellAmount)}
              </span>
              <small>{nf.format(sellTxs.length)} معامله فروش یا نقدکردن</small>
            </div>
            <div className="capital-metric-tile">
              <span className="tile-label">ارزش جاری موجودی فعلی</span>
              <span className="tile-val" style={{ color: "#9333ea" }}>
                {money(currentValue)}
              </span>
              <small>{nf.format(item.quantity)} {asset.unit || "واحد"} در سبد</small>
            </div>
            <div className="capital-metric-tile" style={{ borderRight: `3px solid ${item.totalProfit >= 0 ? "#10b981" : "#ef4444"}` }}>
              <span className="tile-label">سود کل روی سرمایهٔ درگیر این دارایی</span>
              <span
                className="tile-val"
                style={{ color: item.totalProfit >= 0 ? "#059669" : "#dc2626" }}
              >
                {item.totalProfit >= 0 ? "+" : ""}
                {money(item.totalProfit)} ({item.capitalRoi >= 0 ? "+" : ""}{item.capitalRoi.toFixed(1)}٪)
              </span>
              <small>سود به نسبت بیشترین سرمایهٔ درگیر؛ این عدد سرمایهٔ اولیهٔ کل سبد نیست.</small>
            </div>
          </div>

          {item.isRiskFree && (
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={20} style={{ color: "#d97706", flexShrink: 0 }} />
              <div style={{ fontSize: "12px", color: "#92400e" }}>
                <b>پوزیشن بدون ریسک (Free-Ride):</b> مجموع فروش‌های این دارایی ({money(totalSellAmount)}) از کل هزینه‌های خرید ({money(totalBuyAmount)}) بیشتر بوده است. هزینهٔ خریدها با فروش‌ها بازگشته است؛ این شاخص دربارهٔ همین دارایی است، نه پول اولیهٔ کل سبد.
              </div>
            </div>
          )}

          <div className="capital-bars-comparison">
            <div className="capital-bar-item">
              <div className="bar-header">
                <span>۱. بیشترین سرمایهٔ درگیر در این دارایی:</span>
                <b style={{ color: "#0369a1" }}>{money(item.freshCapital)}</b>
              </div>
              <div className="capital-track">
                <div
                  className="capital-fill"
                  style={{
                    width: `${Math.min(100, (item.freshCapital / maxCap) * 100)}%`,
                    backgroundColor: "#0284c7"
                  }}
                />
              </div>
            </div>

            {totalBuyAmount > item.freshCapital && (
              <div className="capital-bar-item">
                <div className="bar-header">
                  <span>۲. مجموع کل معاملات خرید (شامل گردش دوباره پول فروش‌ها):</span>
                  <b>{money(totalBuyAmount)}</b>
                </div>
                <div className="capital-track">
                  <div
                    className="capital-fill buy"
                    style={{ width: `${Math.min(100, (totalBuyAmount / maxCap) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="capital-bar-item">
              <div className="bar-header">
                <span>۳. خروجی و ارزش کل (فروش‌ها + ارزش روز موجودی):</span>
                <b style={{ color: totalOutflow >= (item.freshCapital || 1) ? "#059669" : "#dc2626" }}>
                  {money(totalOutflow)} ({item.capitalRoi >= 0 ? "+" : ""}{item.capitalRoi.toFixed(1)}٪ نسبت به سرمایهٔ درگیر)
                </b>
              </div>
              <div className="capital-track">
                <div
                  className="capital-fill"
                  style={{
                    width: `${Math.min(100, (totalOutflow / maxCap) * 100)}%`,
                    backgroundColor: totalOutflow >= (item.freshCapital || 1) ? "#10b981" : "#ef4444",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetPerformanceDetailRow({
  item,
  data,
  share,
  onClose,
  onViewTransactions,
}: {
  item: AssetMetric;
  data?: PortfolioData;
  share: number;
  onClose: () => void;
  onViewTransactions?: (asset: Asset) => void;
}) {
  const [txFilter, setTxFilter] = useState<"all" | "buy" | "sell" | "dividend">("all");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const asset = item.asset;

  const txs = (!data?.transactions ? [] : data.transactions)
    .filter((tx) => tx.assetId === asset.id)
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") ||
        (b.createdAt || "").localeCompare(a.createdAt || "")
    );

  const buyTxs = txs.filter((tx) => tx.type === "buy");
  const sellTxs = txs.filter((tx) => tx.type === "sell");

  const totalBuyAmount = buyTxs.reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);
  const totalBuyQty = buyTxs.reduce((sum, tx) => sum + safeNumber(tx.quantity), 0);
  const avgBuyPrice = totalBuyQty > 0 ? Math.round(totalBuyAmount / totalBuyQty) : 0;

  const buyDates = buyTxs.map((t) => t.date).filter(Boolean).sort();
  const firstBuyDate = buyDates[0];
  const lastBuyDate = buyDates[buyDates.length - 1];

  const totalSellAmount = sellTxs.reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);
  const totalSellQty = sellTxs.reduce((sum, tx) => sum + safeNumber(tx.quantity), 0);
  const avgSellPrice = totalSellQty > 0 ? Math.round(totalSellAmount / totalSellQty) : 0;

  const sellDates = sellTxs.map((t) => t.date).filter(Boolean).sort();
  const firstSellDate = sellDates[0];
  const lastSellDate = sellDates[sellDates.length - 1];

  // Liquidation ratio
  const liquidationRatio =
    totalBuyQty > 0 ? Math.min(100, Math.max(0, (totalSellQty / totalBuyQty) * 100)) : 0;

  // Matching stock dividends if applicable
  const matchingDividends = (!data?.stockDividends ? [] : data.stockDividends).filter(
    (d) => asset.name.includes(d.symbol) || d.symbol === asset.name
  );

  const totalDividends = matchingDividends
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + safeNumber(d.amount), 0);

  // Price comparison
  const currentPrice = safeNumber(asset.currentPrice);
  const costRef = item.averageCost > 0 ? item.averageCost : avgBuyPrice;
  const priceDiff = costRef > 0 ? currentPrice - costRef : 0;
  const priceDiffPercent = costRef > 0 ? (priceDiff / costRef) * 100 : 0;

  // Filtered transactions
  const displayedTxs = txFilter === "buy" ? buyTxs : txFilter === "sell" ? sellTxs : txs;

  const handleExportAssetPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfSuccess(false);
    try {
      const ok = await exportAssetCardPdf(
        asset,
        item,
        txs,
        buyTxs,
        sellTxs,
        avgBuyPrice,
        currentPrice,
        data ?? { assets: [asset], transactions: txs, stockOrders: [] },
        totalDividends
      );
      if (ok) {
        setPdfSuccess(true);
        setTimeout(() => setPdfSuccess(false), 3500);
      }
    } catch (e) {
      console.error("Asset PDF export error:", e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <tr className="asset-detail-row">
      <td colSpan={9}>
        <div className="asset-detail-container">
          {/* Top Hero Banner */}
          <div className="asset-detail-hero-banner">
            <div className="hero-banner-main">
              <div
                className="hero-asset-avatar"
                style={{ backgroundColor: asset.color || "var(--primary)" }}
              >
                {asset.name.slice(0, 1)}
              </div>
              <div className="hero-asset-text">
                <h4>
                  {asset.name}
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted)" }}>
                    ({asset.unit || "واحد"})
                  </span>
                </h4>
                <div className="hero-asset-badges">
                  <span
                    className="category-tag"
                    style={{ borderRightColor: asset.color || "var(--primary)" }}
                  >
                    {asset.category || "دارایی"}
                  </span>
                  <span className={`pill-badge ${item.quantity > 0 ? "neutral" : "warning"}`}>
                    {item.quantity > 0 ? "موقعیت باز (فعال در سبد)" : "موقعیت بسته (تسویه‌شده)"}
                  </span>
                  <span className="pill-badge neutral">
                    وزن در سبد: {share.toFixed(1)}٪
                  </span>
                </div>
              </div>
            </div>

            <div className="hero-banner-stats">
              <div
                className={`hero-stat-pill ${item.totalProfit >= 0 ? "positive" : "negative"}`}
                title="مجموع بازدهی کل (تحقق‌یافته + جاری + مجامع)"
              >
                {item.totalProfit >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                <span>سود کل: {signedMoney(item.totalProfit)}</span>
                <b style={{ direction: "ltr" }}>({percent(item.profitPercent)})</b>
              </div>

              {costRef > 0 && currentPrice > 0 && (
                <div
                  className={`hero-stat-pill ${priceDiffPercent >= 0 ? "positive" : "negative"}`}
                  title="مقایسه قیمت روز بازار با بهای تمام‌شده خرید شما"
                >
                  <span>نرخ روز نسبت به میانگین خرید:</span>
                  <b style={{ direction: "ltr" }}>
                    {priceDiffPercent >= 0 ? "+" : ""}
                    {priceDiffPercent.toFixed(1)}٪
                  </b>
                </div>
              )}

              {onViewTransactions && (
                <button
                  type="button"
                  className="button secondary small-btn"
                  onClick={() => onViewTransactions(asset)}
                  title="نمایش دفترچه کامل معاملات این دارایی"
                >
                  <ExternalLink size={14} /> معاملات
                </button>
              )}
              <button
                type="button"
                className={`button secondary small-btn ${pdfSuccess ? "success-btn" : ""}`}
                onClick={handleExportAssetPdf}
                disabled={isExportingPdf}
                title={`دریافت فایل PDF کارنامه اختصاصی و سوابق ${asset.name}`}
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> در حال ساخت...
                  </>
                ) : pdfSuccess ? (
                  <>
                    <Check size={14} style={{ color: "#10b981" }} /> دانلود شد
                  </>
                ) : (
                  <>
                    <FileDown size={14} /> دریافت PDF کارنامه
                  </>
                )}
              </button>
              <button
                type="button"
                className="button ghost small-btn"
                onClick={onClose}
                title="بستن این کارنامه"
              >
                بستن ×
              </button>
            </div>
          </div>

          {/* 4 Rich Visual KPI Cards */}
          <div className="asset-cards-grid-v2">
            {/* 1. Buy & Cost Analysis Card */}
            <div className="detail-kpi-card">
              <div className="kpi-card-header">
                <div className="kpi-header-title">
                  <div className="kpi-header-icon buy">
                    <ShoppingCart size={17} />
                  </div>
                  <span>🛒 تحلیل خرید و ورود سرمایه</span>
                </div>
                <span className="pill-badge neutral">
                  {nf.format(buyTxs.length)} خرید ثبت‌شده
                </span>
              </div>

              <div className="kpi-hero-number-box">
                <span className="kpi-label">مجموع کل بهای پرداختی:</span>
                <span className="kpi-value positive-text">{money(totalBuyAmount)}</span>
              </div>

              <div className="kpi-mini-grid cols-2" style={{ marginBottom: "10px", background: "rgba(59, 130, 246, 0.05)", padding: "8px 10px", borderRadius: "8px", border: "1px dashed rgba(59, 130, 246, 0.2)" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "#0369a1", fontWeight: 600, display: "block" }}>بیشترین سرمایهٔ درگیر در این دارایی:</span>
                  <b style={{ color: "#0369a1", fontSize: "13px" }}>{money(item.freshCapital)}</b>
                  <small style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>حداکثر پول نو درگیر (بدون چرخش مجدد)</small>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, display: "block" }}>گردش مجدد عایدی‌ها:</span>
                  <b style={{ fontSize: "13px" }}>{money(Math.max(0, totalBuyAmount - item.freshCapital))}</b>
                  <small style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>خرید از محل فروش‌های قبلی</small>
                </div>
              </div>

              <div className="kpi-mini-grid cols-3">
                <div className="kpi-mini-stat">
                  <span>حجم خریداری‌شده</span>
                  <b>
                    {nf.format(totalBuyQty)} {asset.unit || "واحد"}
                  </b>
                </div>
                <div className="kpi-mini-stat">
                  <span>میانگین نرخ خرید</span>
                  <b>{money(avgBuyPrice)}</b>
                </div>
                <div className="kpi-mini-stat">
                  <span>تعداد دفعات خرید</span>
                  <b>{nf.format(buyTxs.length)} بار</b>
                </div>
              </div>

              <div className="kpi-visual-timeline">
                <div className="timeline-point">
                  <small>اولین خرید</small>
                  <span>{firstBuyDate ? toPersianDate(firstBuyDate) : "—"}</span>
                </div>
                <div className="timeline-arrow">
                  <Calendar size={14} />
                  <span style={{ fontSize: "11px", margin: "0 4px" }}>➔</span>
                </div>
                <div className="timeline-point" style={{ textAlign: "left" }}>
                  <small>آخرین خرید</small>
                  <span>{lastBuyDate ? toPersianDate(lastBuyDate) : "—"}</span>
                </div>
              </div>
            </div>

            {/* 2. Sales & Cash Liquidity Card */}
            <div className="detail-kpi-card">
              <div className="kpi-card-header">
                <div className="kpi-header-title">
                  <div className="kpi-header-icon sell">
                    <Wallet size={17} />
                  </div>
                  <span>💰 تحلیل فروش و بازگشت نقدینگی</span>
                </div>
                <span className={`pill-badge ${sellTxs.length > 0 ? "neutral" : "positive"}`}>
                  {sellTxs.length > 0 ? `${nf.format(sellTxs.length)} فروش` : "بدون فروش"}
                </span>
              </div>

              {sellTxs.length === 0 ? (
                <div className="kpi-holding-banner">
                  <ShieldCheck size={26} className="icon" />
                  <div>
                    <b style={{ display: "block", marginBottom: "3px", fontSize: "12px" }}>
                      دارایی در وضعیت نگهداری (Buy & Hold)
                    </b>
                    <p>
                      تاکنون هیچ معامله فروشی برای این دارایی ثبت نشده و ۱۰۰٪ حجم خریداری‌شده در
                      پورتفوی شما حفظ شده است.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="kpi-hero-number-box">
                    <span className="kpi-label">مجموع کل دریافتی فروش:</span>
                    <span className="kpi-value negative-text">{money(totalSellAmount)}</span>
                  </div>

                  <div className="kpi-mini-grid cols-3">
                    <div className="kpi-mini-stat">
                      <span>حجم فروخته‌شده</span>
                      <b>
                        {nf.format(totalSellQty)} {asset.unit || "واحد"}
                      </b>
                    </div>
                    <div className="kpi-mini-stat">
                      <span>میانگین نرخ فروش</span>
                      <b>{money(avgSellPrice)}</b>
                    </div>
                    <div className="kpi-mini-stat">
                      <span>تعداد دفعات فروش</span>
                      <b>{nf.format(sellTxs.length)} بار</b>
                    </div>
                  </div>

                  <div className="kpi-progress-wrap">
                    <div className="progress-labels">
                      <span>نسبت نقدشوندگی (فروش به کل خرید)</span>
                      <b>{liquidationRatio.toFixed(1)}٪ نقد شده</b>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${liquidationRatio}%`,
                          backgroundColor: "#dc2626",
                        }}
                      />
                    </div>
                  </div>

                  <div className="kpi-visual-timeline">
                    <div className="timeline-point">
                      <small>اولین فروش</small>
                      <span>{firstSellDate ? toPersianDate(firstSellDate) : "—"}</span>
                    </div>
                    <div className="timeline-arrow">➔</div>
                    <div className="timeline-point" style={{ textAlign: "left" }}>
                      <small>آخرین فروش</small>
                      <span>{lastSellDate ? toPersianDate(lastSellDate) : "—"}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 3. Profit & Yield Breakdown Card */}
            <div className="detail-kpi-card">
              <div className="kpi-card-header">
                <div className="kpi-header-title">
                  <div className="kpi-header-icon profit">
                    <TrendingUp size={17} />
                  </div>
                  <span>📈 کارنامه سودآوری و بازدهی</span>
                </div>
                <span
                  className={`pill-badge ${item.totalProfit >= 0 ? "positive" : "negative"}`}
                >
                  بازدهی: {percent(item.profitPercent)}
                </span>
              </div>

              <div className="kpi-hero-number-box">
                <span className="kpi-label">مجموع سود یا زیان کل:</span>
                <span
                  className={`kpi-value ${item.totalProfit >= 0 ? "positive-text" : "negative-text"}`}
                >
                  {signedMoney(item.totalProfit)}
                </span>
              </div>

              <div className="kpi-mini-grid cols-2">
                <div className="kpi-mini-stat">
                  <span>سود محقق‌شده (فروش)</span>
                  <b className={item.realizedProfit >= 0 ? "positive-text" : "negative-text"}>
                    {signedMoney(item.realizedProfit)}
                  </b>
                </div>
                <div className="kpi-mini-stat">
                  <span>سود جاری (موجودی فعلی)</span>
                  <b className={item.unrealizedProfit >= 0 ? "positive-text" : "negative-text"}>
                    {signedMoney(item.unrealizedProfit)}
                  </b>
                </div>
              </div>

              <div className="kpi-mini-stat" style={{ background: item.capitalRoi >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)", marginTop: "8px", border: `1px solid ${item.capitalRoi >= 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: item.capitalRoi >= 0 ? "#059669" : "#dc2626", fontWeight: 700, fontSize: "11.5px" }}>
                    نسبت سود به بیشترین سرمایهٔ درگیر:
                  </span>
                  <b className={item.capitalRoi >= 0 ? "positive-text" : "negative-text"} style={{ direction: "ltr", fontSize: "13px" }}>
                    {item.capitalRoi >= 0 ? "+" : ""}{item.capitalRoi.toFixed(1)}٪
                  </b>
                </div>
                <small style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
                  نسبت سود کل به بیشترین سرمایهٔ درگیر در این دارایی ({money(item.freshCapital)})؛ برای آوردهٔ واقعی کل سبد، بخش گزارش سرمایه را ببینید.
                </small>
              </div>

              {item.isRiskFree && (
                <div style={{ marginTop: "8px", padding: "6px 8px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "11px", color: "#92400e" }}>
                  🛡️ <b>فروش بیشتر از کل خرید این دارایی:</b> این وضعیت به‌تنهایی به معنی بازیابی پول اولیهٔ کل سبد نیست.
                </div>
              )}

              {totalDividends > 0 && (
                <div className="kpi-mini-stat" style={{ background: "rgba(16, 185, 129, 0.08)" }}>
                  <span style={{ color: "#059669" }}>سود نقدی مجمع دریافت‌شده</span>
                  <b className="positive-text">{money(totalDividends)}</b>
                </div>
              )}

              {costRef > 0 && currentPrice > 0 && (
                <div className="price-gauge-box">
                  <div className="price-gauge-row">
                    <span>بهای میانگین خرید شما:</span>
                    <b>{money(costRef)}</b>
                  </div>
                  <div className="price-gauge-row">
                    <span>قیمت روز هر واحد در بازار:</span>
                    <b className={priceDiff >= 0 ? "positive-text" : "negative-text"}>
                      {money(currentPrice)}
                    </b>
                  </div>
                  <div className="price-gauge-row" style={{ borderTop: "1px dashed var(--line)", paddingTop: "4px" }}>
                    <span>تفاوت هر واحد با بهای خرید:</span>
                    <b className={priceDiff >= 0 ? "positive-text" : "negative-text"}>
                      {priceDiff >= 0 ? "+" : ""}
                      {money(priceDiff)} ({priceDiffPercent >= 0 ? "+" : ""}{priceDiffPercent.toFixed(1)}٪)
                    </b>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Current Holding & Status Card */}
            <div className="detail-kpi-card">
              <div className="kpi-card-header">
                <div className="kpi-header-title">
                  <div className="kpi-header-icon holding">
                    <PieChart size={17} />
                  </div>
                  <span>📊 موقعیت فعلی در سبد پورتفو</span>
                </div>
                <span className="pill-badge neutral">
                  سهم وزنی: {share.toFixed(1)}٪
                </span>
              </div>

              <div className="kpi-hero-number-box">
                <span className="kpi-label">ارزش روز دارایی در سبد:</span>
                <span className="kpi-value">{money(item.marketValue)}</span>
              </div>

              <div className="kpi-progress-wrap">
                <div className="progress-labels">
                  <span>سهم از کل ارزش پورتفو</span>
                  <b>{share.toFixed(1)}٪ از کل سبد</b>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(100, share)}%`,
                      backgroundColor: asset.color || "var(--primary)",
                    }}
                  />
                </div>
              </div>

              <div className="kpi-mini-grid cols-2">
                <div className="kpi-mini-stat">
                  <span>موجودی باقیمانده</span>
                  <b>
                    {nf.format(item.quantity)} {asset.unit || "واحد"}
                  </b>
                </div>
                <div className="kpi-mini-stat">
                  <span>بهای تمام‌شده موجودی</span>
                  <b>{money(item.costBasis)}</b>
                </div>
              </div>

              <div className="kpi-mini-grid cols-2">
                <div className="kpi-mini-stat">
                  <span>قیمت روز واحد</span>
                  <b>{money(asset.currentPrice)}</b>
                </div>
                <div className="kpi-mini-stat">
                  <span>وضعیت پوزیشن</span>
                  <b style={{ color: item.quantity > 0 ? "var(--primary)" : "var(--muted)" }}>
                    {item.quantity > 0 ? "فعال و باز" : "تسویه‌شده"}
                  </b>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Chart Visualizer */}
          <AssetDetailChartVisualizer
            asset={asset}
            item={item}
            txs={txs}
            buyTxs={buyTxs}
            sellTxs={sellTxs}
            avgBuyPrice={avgBuyPrice}
            currentPrice={currentPrice}
          />

          {/* Activity / Transactions Section with Tabs */}
          <div className="asset-tx-section">
            <div className="asset-tx-tabs-header">
              <h5>ریز تاریخچه و تراکنش‌های دارایی ({nf.format(txs.length)} معامله)</h5>
              <div className="tx-filter-pills">
                <button
                  type="button"
                  className={`tx-filter-btn ${txFilter === "all" ? "active" : ""}`}
                  onClick={() => setTxFilter("all")}
                >
                  همه تراکنش‌ها ({txs.length})
                </button>
                <button
                  type="button"
                  className={`tx-filter-btn ${txFilter === "buy" ? "active" : ""}`}
                  onClick={() => setTxFilter("buy")}
                >
                  فقط خریدها ({buyTxs.length})
                </button>
                <button
                  type="button"
                  className={`tx-filter-btn ${txFilter === "sell" ? "active" : ""}`}
                  onClick={() => setTxFilter("sell")}
                >
                  فقط فروش‌ها ({sellTxs.length})
                </button>
                {matchingDividends.length > 0 && (
                  <button
                    type="button"
                    className={`tx-filter-btn ${txFilter === "dividend" ? "active" : ""}`}
                    onClick={() => setTxFilter("dividend")}
                  >
                    سود مجمع ({matchingDividends.length})
                  </button>
                )}
              </div>
            </div>

            {txFilter === "dividend" ? (
              <div className="asset-subtable-scroll">
                <table className="asset-subtable">
                  <thead>
                    <tr>
                      <th>نماد / مجمع</th>
                      <th>تاریخ برگزاری</th>
                      <th>مبلغ سود مجمع</th>
                      <th>وضعیت وصول</th>
                      <th>توضیحات و شرح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingDividends.map((div) => (
                      <tr key={div.id}>
                        <td><b>{div.symbol}</b></td>
                        <td>{toPersianDate(div.date)}</td>
                        <td className="positive-text"><b>{money(div.amount)}</b></td>
                        <td>
                          <span className={`pill-badge ${div.status === "paid" ? "positive" : "warning"}`}>
                            {div.status === "paid" ? "وصول‌شده" : "در انتظار پرداخت"}
                          </span>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: "11px" }}>{div.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : displayedTxs.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: "12px 0", fontSize: "12px", textAlign: "center" }}>
                معامله‌ای با این فیلتر ثبت نشده است.
              </p>
            ) : (
              <div className="asset-subtable-scroll">
                <table className="asset-subtable">
                  <thead>
                    <tr>
                      <th>نوع معامله</th>
                      <th>تاریخ ثبت</th>
                      <th>تعداد / مقدار</th>
                      <th>قیمت واحد</th>
                      <th>مبلغ کل</th>
                      <th>تفاوت با میانگین</th>
                      <th>یادداشت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTxs.slice(0, 15).map((tx) => {
                      const isBuy = tx.type === "buy";
                      const diffFromAvg =
                        avgBuyPrice > 0 ? ((tx.unitPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
                      return (
                        <tr key={tx.id}>
                          <td>
                            <span
                              className={`pill-badge ${isBuy ? "positive" : "negative"}`}
                              style={{ fontSize: "11px", padding: "3px 8px" }}
                            >
                              {isBuy ? "خرید / واریز" : "فروش / برداشت"}
                            </span>
                          </td>
                          <td>{toPersianDate(tx.date)}</td>
                          <td>
                            <b>{nf.format(tx.quantity)}</b> {asset.unit || ""}
                          </td>
                          <td>{money(tx.unitPrice)}</td>
                          <td>
                            <b>{money(tx.totalPrice)}</b>
                          </td>
                          <td style={{ fontSize: "11px" }}>
                            {avgBuyPrice > 0 ? (
                              <span
                                className={
                                  isBuy
                                    ? diffFromAvg <= 0
                                      ? "positive-text"
                                      : "negative-text"
                                    : diffFromAvg >= 0
                                    ? "positive-text"
                                    : "negative-text"
                                }
                              >
                                {diffFromAvg >= 0 ? "+" : ""}
                                {diffFromAvg.toFixed(1)}٪
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ color: "var(--muted)", fontSize: "11px", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                            {data ? describeTransactionNote(data, tx) || "—" : tx.notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayedTxs.length > 15 && (
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px", textAlign: "center" }}>
                    نمایش ۱۵ معامله اخیر از مجموع {nf.format(displayedTxs.length)} معامله.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ReportsView({
  data,
  metrics,
  timeline,
  totalValue,
  totalProfit,
  segments,
  capitalReport,
  onResolveIssue,
  onRegisterCapital,
  onPdf,
  onShowTransactions,
  onViewAssetTransactions,
}: {
  data?: PortfolioData;
  metrics: AssetMetric[];
  timeline: Array<{ date: string; value: number; profit?: number }>;
  totalValue: number;
  totalProfit: number;
  segments: Array<{ label: string; value: number; color: string }>;
  capitalReport: CapitalReport;
  onResolveIssue: (target: AuditTarget) => void;
  onRegisterCapital: (accountId?: string, beforeDate?: string) => void;
  onPdf?: () => void;
  onShowTransactions: () => void;
  onViewAssetTransactions?: (asset: Asset, focusTransactionId?: string) => void;
}) {
  const [timelineRange, setTimelineRange] = useState<ChartTimeRange>("all");
  const [allocationRange, setAllocationRange] = useState<ChartTimeRange>("all");
  const [allocationAtStart, setAllocationAtStart] = useState<boolean>(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});

  const toggleAssetExpand = (id: string) => {
    setExpandedAssetIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Sorting state for Monthly Cash Flows
  type MonthlySortKey =
    | "yearMonth"
    | "deposits"
    | "withdrawals"
    | "dividends"
    | "netFlow"
    | "count";
  const [monthlySortKey, setMonthlySortKey] = useState<MonthlySortKey>("yearMonth");
  const [monthlySortDir, setMonthlySortDir] = useState<"asc" | "desc">("desc");

  const handleMonthlySort = (key: MonthlySortKey) => {
    if (monthlySortKey === key) {
      setMonthlySortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setMonthlySortKey(key);
      setMonthlySortDir(key === "yearMonth" ? "desc" : "desc");
    }
  };

  // Sorting state for Performance Ranking
  type RankingSortKey =
    | "name"
    | "share"
    | "marketValue"
    | "costBasis"
    | "realizedProfit"
    | "unrealizedProfit"
    | "totalProfit"
    | "profitPercent";
  const [rankingSortKey, setRankingSortKey] = useState<RankingSortKey>("totalProfit");
  const [rankingSortDir, setRankingSortDir] = useState<"asc" | "desc">("desc");

  const handleRankingSort = (key: RankingSortKey) => {
    if (rankingSortKey === key) {
      setRankingSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setRankingSortKey(key);
      setRankingSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const filteredTimeline = useMemo(() => {
    return filterTimelineByRange(timeline, timelineRange);
  }, [timeline, timelineRange]);

  const profitDelta = useMemo(() => {
    if (!filteredTimeline || filteredTimeline.length < 2) return null;
    const start = filteredTimeline[0].profit ?? 0;
    const end = filteredTimeline[filteredTimeline.length - 1].profit ?? 0;
    const diff = end - start;
    return { diff };
  }, [filteredTimeline]);

  const filteredAllocation = useMemo(() => {
    if (allocationRange === "all" || !allocationAtStart || !data) {
      return { segments, total: totalValue };
    }
    const startDate = getRangeStartDate(allocationRange);
    if (!startDate) return { segments, total: totalValue };
    const historic = getSegmentsAtDate(data, startDate);
    return { segments: historic.segments, total: historic.totalValue };
  }, [data, segments, totalValue, allocationRange, allocationAtStart]);

  const allocationBase = segments.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  const sortedByProfit = useMemo(() => {
    return [...metrics].sort((a, b) => b.totalProfit - a.totalProfit);
  }, [metrics]);

  const sortedRankingMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      let cmp = 0;
      if (rankingSortKey === "name") {
        cmp = a.asset.name.localeCompare(b.asset.name, "fa");
      } else if (rankingSortKey === "share" || rankingSortKey === "marketValue") {
        cmp = a.marketValue - b.marketValue;
      } else if (rankingSortKey === "costBasis") {
        cmp = a.costBasis - b.costBasis;
      } else if (rankingSortKey === "realizedProfit") {
        cmp = a.realizedProfit - b.realizedProfit;
      } else if (rankingSortKey === "unrealizedProfit") {
        cmp = a.unrealizedProfit - b.unrealizedProfit;
      } else if (rankingSortKey === "totalProfit") {
        cmp = a.totalProfit - b.totalProfit;
      } else if (rankingSortKey === "profitPercent") {
        cmp = a.profitPercent - b.profitPercent;
      }
      return rankingSortDir === "asc" ? cmp : -cmp;
    });
  }, [metrics, rankingSortKey, rankingSortDir]);

  const bestAsset = sortedByProfit[0];
  const worstAsset = sortedByProfit[sortedByProfit.length - 1];

  const monthlyFlows = useMemo(() => (data ? getMonthlyCashFlows(data) : []), [data]);

  const sortedMonthlyFlows = useMemo(() => {
    return [...monthlyFlows].sort((a, b) => {
      let cmp = 0;
      if (monthlySortKey === "yearMonth") {
        cmp = a.yearMonth.localeCompare(b.yearMonth);
      } else if (monthlySortKey === "deposits") {
        cmp = a.deposits - b.deposits;
      } else if (monthlySortKey === "withdrawals") {
        cmp = a.withdrawals - b.withdrawals;
      } else if (monthlySortKey === "dividends") {
        cmp = a.dividends - b.dividends;
      } else if (monthlySortKey === "netFlow") {
        cmp = a.netFlow - b.netFlow;
      } else if (monthlySortKey === "count") {
        cmp = a.count - b.count;
      }
      return monthlySortDir === "asc" ? cmp : -cmp;
    });
  }, [monthlyFlows, monthlySortKey, monthlySortDir]);

  const totalMonthlyDeposits = useMemo(
    () => monthlyFlows.reduce((sum, item) => sum + item.deposits, 0),
    [monthlyFlows]
  );
  const totalMonthlyWithdrawals = useMemo(
    () => monthlyFlows.reduce((sum, item) => sum + item.withdrawals, 0),
    [monthlyFlows]
  );
  const totalMonthlyDividends = useMemo(
    () => monthlyFlows.reduce((sum, item) => sum + item.dividends, 0),
    [monthlyFlows]
  );
  const reportOverview = useMemo(
    () => calculateReportOverview(metrics, capitalReport, totalValue, totalProfit),
    [metrics, capitalReport, totalValue, totalProfit]
  );

  return (
    <div className="view-container">
      <ReportOverviewPanel overview={reportOverview} report={capitalReport} />
      <CapitalHealthPanel
        report={capitalReport}
        data={data}
        onResolve={onResolveIssue}
        onRegisterCapital={onRegisterCapital}
        onShowTransactions={onShowTransactions}
        onViewAccount={data && onViewAssetTransactions ? (accountId, focusTransactionId) => {
          const account = data.assets.find((asset) => asset.id === accountId);
          if (account) onViewAssetTransactions(account, focusTransactionId);
        } : undefined}
      />

      <details className="capital-technical reports-optional" open={capitalReport.isReliable}>
        <summary>بعد از تطبیق: نمایش نمودارها و جزئیات عملکرد {capitalReport.isReliable ? "" : "(اعداد خام و تأییدنشده)"}</summary>
        {onPdf && (
          <div className="view-toolbar">
            <div>
              <h3 style={{ fontSize: "17px", margin: "0 0 4px", fontWeight: 700 }}>گزارش جامع تحلیلی و عملکرد پورتفوی</h3>
              <small style={{ color: "var(--muted)" }}>خلاصه بازدهی تاریخی، ترکیب سبد دارایی‌ها و جریان‌های مالی ماهانه</small>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="button secondary" onClick={onShowTransactions}>دفترچه معاملات</button>
              <button type="button" className="button secondary" onClick={onPdf}><Printer size={16} /> چاپ و دریافت PDF گزارش</button>
            </div>
          </div>
        )}
        <section className="hero-metrics">
        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">ارزش کل سبد سرمایه‌گذاری</span>
            <InfoButton
              title="ارزش کل سبد سرمایه‌گذاری"
              formula="ارزش کل = مجموع (موجودی هر دارایی × نرخ روز) + نقدینگی‌های حامی، کیان و دفتر گواهی سپرده"
              description="ارزش نقدی و نقدپذیر ثروت موجود در پورتفو بر مبنای آخرین قیمت‌های بازار."
            />
          </div>
          <h2>{money(totalValue)}</h2>
          <p className="card-sub">محاسبه بر اساس آخرین قیمت‌های ثبت‌شده</p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">کل سود / زیان تاریخی</span>
            <InfoButton
              title="کل سود و زیان تاریخی"
              formula="سود کل = سود محقق‌شده فروش‌ها + سود جاری دارایی‌ها + سود تقسیمی مجامع + سود واریزی حامی"
              description="سود محاسباتی بر اساس داده‌های موجود؛ تا زمانی که گزارش سرمایه هشدار دارد، قابل اتکا به‌عنوان سود نهایی نیست."
            />
          </div>
          <h2 className={capitalReport.isReliable ? (totalProfit >= 0 ? "positive-text" : "negative-text") : ""}>
            {capitalReport.isReliable ? signedMoney(totalProfit) : "هنوز تأیید نشده"}
          </h2>
          <p className="card-sub">{capitalReport.isReliable ? "شامل رشد دارایی‌ها، فروش و مجامع؛ نیازمند تأیید با اسناد." : "ابتدا دو گام بالا را انجام دهید؛ عدد خام در جزئیات محاسبه موجود است."}</p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">بیشترین سودسازی</span>
            <InfoButton
              title="برترین دارایی از نظر سودسازی"
              formula="بیشترین مقدار عددی مجموع سود (جاری + محقق‌شده) میان تمام دارایی‌های پورتفو"
              description="دارایی که بیشترین ثروت و بازدهی ریالی را برای سبد شما ایجاد کرده است."
            />
          </div>
          <h2 style={{ fontSize: "18px" }}>{bestAsset?.asset.name ?? "—"}</h2>
          <p className="card-sub positive-text">
            {signedMoney(bestAsset?.totalProfit ?? 0)} ({percent(bestAsset?.profitPercent ?? 0)})
          </p>
        </article>

        <article className="hero-card">
          <div className="card-label-with-info">
            <span className="card-label">کمترین بازدهی</span>
            <InfoButton
              title="کمترین بازدهی دارایی‌ها"
              formula="کمترین مقدار عددی سود (یا بیشترین زیان) در مقایسه با بهای تمام‌شده خرید"
              description="دارایی با ضعیف‌ترین کارنامه، جهت بازبینی استراتژی یا ارزیابی حد ضرر."
            />
          </div>
          <h2 style={{ fontSize: "18px" }}>{worstAsset?.asset.name ?? "—"}</h2>
          <p className="card-sub negative-text">
            {signedMoney(worstAsset?.totalProfit ?? 0)} ({percent(worstAsset?.profitPercent ?? 0)})
          </p>
        </article>
      </section>

      <section className="charts-grid">
        <div className="panel-card chart-panel">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>روند سود و زیان تاریخی</h3>
                <InfoButton
                  title="نمودار روند سود و زیان تاریخی"
                  formula="نمایش تجمعی خالص سود (بدون احتساب اصل آورده و واریز نقدی) در مقاطع تاریخی | تغییر سود بازه = سود پایان بازه - سود شروع بازه"
                  description="روند سود محاسباتی بر اساس داده‌های هر تاریخ؛ برای کپی‌ترید بدون مانده‌های تاریخی، گذشته برآوردی است. هشدارهای تراز سرمایه را جدا بررسی کنید."
                />
              </div>
              <p>
                سود محاسباتی تاریخی؛ بدون ماندهٔ گذشتهٔ کپی‌ترید، مسیر آن تقریبی است
                {profitDelta && timelineRange !== "all" && (
                  <span className="chart-delta-badge">
                    · تغییر سود در این بازه:{" "}
                    <b className={profitDelta.diff >= 0 ? "positive-text" : "negative-text"}>
                      {signedMoney(profitDelta.diff)}
                    </b>
                  </span>
                )}
              </p>
            </div>
            <div className="time-filter-pills">
              {CHART_TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`time-filter-btn ${timelineRange === r.id ? "active" : ""}`}
                  onClick={() => setTimelineRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart points={filteredTimeline} color="#2563eb" valueKey="profit" />
        </div>

        <div className="panel-card chart-panel">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>توزیع سرمایه و وزن سبد</h3>
                <InfoButton
                  title="نمودار توزیع سرمایه و وزن سبد"
                  formula="درصد وزن هر بخش = (ارزش روز آن بخش ÷ کل ارزش پورتفو) × ۱۰۰"
                  description="پایش میزان تمرکز سرمایه در کلاس‌های مختلف دارایی و نظارت بر ریسک سبد."
                />
              </div>
              <p>
                {allocationRange === "all"
                  ? "توزیع فعلی کل سرمایه در سبد"
                  : allocationAtStart
                  ? `ترکیب در شروع بازه (${toPersianDate(getRangeStartDate(allocationRange))})`
                  : "ترکیب دارایی‌ها در بازهٔ انتخابی"}
              </p>
            </div>
            <div className="time-filter-pills">
              {CHART_TIME_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`time-filter-btn ${allocationRange === r.id ? "active" : ""}`}
                  onClick={() => setAllocationRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {allocationRange !== "all" && (
            <div className="allocation-mode-switch">
              <button
                type="button"
                className={`switch-chip ${!allocationAtStart ? "active" : ""}`}
                onClick={() => setAllocationAtStart(false)}
              >
                امروز (پایان بازه)
              </button>
              <button
                type="button"
                className={`switch-chip ${allocationAtStart ? "active" : ""}`}
                onClick={() => setAllocationAtStart(true)}
              >
                ابتدای بازه ({toPersianDate(getRangeStartDate(allocationRange))})
              </button>
            </div>
          )}
          <DonutChart segments={filteredAllocation.segments} total={filteredAllocation.total} />
        </div>
      </section>

      {/* Monthly Cash Flow & Profit Breakdown */}
      {monthlyFlows.length > 0 && (
        <section className="panel-card">
          <div className="panel-head">
            <div>
              <div className="title-with-info">
                <h3 style={{ margin: 0 }}>گردش تراکنش‌های ماهانه (تقویم شمسی)</h3>
                <InfoButton
                  title="گردش تراکنش‌های ماهانه"
                  formula="خالص گردش ثبت‌شده = خرید/واریز − فروش/برداشت + سود ثبت‌شده؛ این عدد سرمایهٔ اولیه یا سود خالص نیست."
                  description="جدول فعالیت ماهانه شامل معاملات و انتقال‌های داخلی است؛ برای آوردهٔ ثبت‌شده و وضعیت مغایرت‌ها، به بخش گزارش سرمایه در بالای صفحه مراجعه کنید."
                  details={[
                    "یک جابه‌جایی بین حساب‌ها در این جدول دو ردیف دارد و پول تازه‌ای به سبد اضافه نمی‌کند.",
                    "ماهیت تقویمی بر اساس تاریخ خورشیدی دسته‌بندی شده است."
                  ]}
                />
              </div>
              <p>گردش ناخالص خرید/فروش و انتقال‌ها؛ این جدول مبنای محاسبهٔ سرمایه نیست.</p>
            </div>
            <span className="tag">{monthlyFlows.length} ماه ثبت‌شده</span>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableHeader<MonthlySortKey>
                    field="yearMonth"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="ماه"
                  />
                  <SortableHeader<MonthlySortKey>
                    field="deposits"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="خرید و واریز سرمایه"
                  />
                  <SortableHeader<MonthlySortKey>
                    field="withdrawals"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="فروش و برداشت"
                  />
                  <SortableHeader<MonthlySortKey>
                    field="dividends"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="سود نقدی (حامی و مجامع)"
                  />
                  <SortableHeader<MonthlySortKey>
                    field="netFlow"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="خالص جریان مالی"
                  />
                  <SortableHeader<MonthlySortKey>
                    field="count"
                    currentField={monthlySortKey}
                    direction={monthlySortDir}
                    onSort={handleMonthlySort}
                    label="تعداد تراکنش"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedMonthlyFlows.map((item) => (
                  <tr key={item.yearMonth}>
                    <td>
                      <b style={{ color: "var(--ink)" }}>{item.persianLabel}</b>
                    </td>
                    <td className="positive-text">{money(item.deposits)}</td>
                    <td className="negative-text">{money(item.withdrawals)}</td>
                    <td className="positive-text">
                      <b>{money(item.dividends)}</b>
                    </td>
                    <td>
                      <b className={item.netFlow >= 0 ? "positive-text" : "negative-text"}>
                        {signedMoney(item.netFlow)}
                      </b>
                    </td>
                    <td>{nf.format(item.count)} ردیف</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <b>مجموع کل دوره‌ها:</b>
                  </td>
                  <td className="positive-text">
                    <b>{money(totalMonthlyDeposits)}</b>
                  </td>
                  <td className="negative-text">
                    <b>{money(totalMonthlyWithdrawals)}</b>
                  </td>
                  <td className="positive-text">
                    <b>{money(totalMonthlyDividends)}</b>
                  </td>
                  <td>
                    <b
                      style={{ fontSize: "15px" }}
                      className={
                        totalMonthlyDeposits - totalMonthlyWithdrawals + totalMonthlyDividends >= 0
                          ? "positive-text"
                          : "negative-text"
                      }
                    >
                      {signedMoney(
                        totalMonthlyDeposits - totalMonthlyWithdrawals + totalMonthlyDividends
                      )}
                    </b>
                  </td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <section className="panel-card">
        <div className="panel-head">
          <div className="title-with-info">
            <h3 style={{ margin: 0 }}>رتبه‌بندی عملکرد تمام دارایی‌ها</h3>
            <InfoButton
              title="جدول رتبه‌بندی عملکرد تمام دارایی‌ها"
              formula="سهم از پورتفو = (ارزش مثبت دارایی ÷ مجموع دارایی‌های مثبت) × ۱۰۰؛ ماندهٔ منفی از خالص ارزش کسر می‌شود | درصد سود دارایی غیرنقدی به‌جز بورس = سود کل ÷ مجموع بهای خریدهای ثبت‌شده؛ درصد بورس = سود کل بورس ÷ بیشترین بهای سهام هم‌زمان موجود در پایان روز. حساب نقدی مبنای جداگانه دارد؛ این نسبت‌ها بازده سالانه یا بازده پول اولیه نیستند."
              description="مقایسه عملکرد و بازدهی تمام دارایی‌ها به تفکیک بهای تمام‌شده، ارزش روز، سود تحقق‌یافته و جاری."
              details={[
                "بهای تمام‌شده (Cost Basis): کل مبلغ پرداخت‌شده برای خرید سهم یا دارایی موجود.",
                "سود تحقق‌یافته (Realized): سود حاصل از فروش‌های گذشته این دارایی.",
                "سود جاری (Unrealized): سود بالقوه ناشی از رشد قیمت فعلی نسبت به میانگین خرید.",
                "با کلیک بر روی علامت + کنار هر دارایی، خلاصه سوابق معاملات، خرید، فروش و سودآوری نمایش داده می‌شود."
              ]}
            />
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader<RankingSortKey>
                  field="name"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="نام دارایی"
                />
                <SortableHeader<RankingSortKey>
                  field="share"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="سهم از پورتفو"
                />
                <SortableHeader<RankingSortKey>
                  field="marketValue"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="ارزش روز"
                />
                <SortableHeader<RankingSortKey>
                  field="costBasis"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="بهای تمام‌شده"
                />
                <SortableHeader<RankingSortKey>
                  field="realizedProfit"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="سود تحقق‌یافته"
                />
                <SortableHeader<RankingSortKey>
                  field="unrealizedProfit"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="سود جاری"
                />
                <SortableHeader<RankingSortKey>
                  field="totalProfit"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="مجموع سود"
                />
                <SortableHeader<RankingSortKey>
                  field="profitPercent"
                  currentField={rankingSortKey}
                  direction={rankingSortDir}
                  onSort={handleRankingSort}
                  label="بازدهی"
                />
              </tr>
            </thead>
            <tbody>
              {sortedRankingMetrics.map((item) => {
                const share = allocationBase > 0 ? (Math.max(0, item.marketValue) / allocationBase) * 100 : 0;
                const isExpanded = Boolean(expandedAssetIds[item.asset.id]);
                return (
                  <Fragment key={item.asset.id}>
                    <tr className={`ranking-table-row ${isExpanded ? "row-expanded" : ""}`}>
                      <td>
                        <div className="asset-name-cell">
                          <button
                            type="button"
                            className={`asset-expand-trigger ${isExpanded ? "is-active" : ""}`}
                            onClick={() => toggleAssetExpand(item.asset.id)}
                            title={
                              isExpanded
                                ? `بستن کارنامه و سوابق ${item.asset.name}`
                                : `مشاهده کارنامه جامع، تحلیل خرید و فروش و بازدهی ${item.asset.name}`
                            }
                            aria-label={
                              isExpanded
                                ? `بستن کارنامه ${item.asset.name}`
                                : `مشاهده کارنامه ${item.asset.name}`
                            }
                          >
                            <span className="expand-symbol">
                              {isExpanded ? (
                                <Minus size={13} strokeWidth={2.5} />
                              ) : (
                                <Plus size={13} strokeWidth={2.5} />
                              )}
                            </span>
                            <span className="expand-text">
                              {isExpanded ? "بستن" : "کارنامه"}
                            </span>
                          </button>
                          <div className="asset-name-info">
                            <div className="asset-name-primary">
                              <span
                                className="asset-color-bar"
                                style={{ backgroundColor: item.asset.color || "var(--primary)" }}
                              />
                              <b className="asset-main-name">{item.asset.name}</b>
                            </div>
                            <span className="asset-sub-cat">
                              {item.asset.category || "دارایی"} • {nf.format(item.quantity)}{" "}
                              {item.asset.unit || "واحد"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{share.toFixed(1)}٪</td>
                      <td>{money(item.marketValue)}</td>
                      <td>{money(item.costBasis)}</td>
                      <td>{signedMoney(item.realizedProfit)}</td>
                      <td>{signedMoney(item.unrealizedProfit)}</td>
                      <td className={item.totalProfit >= 0 ? "positive-text" : "negative-text"}>
                        <b>{signedMoney(item.totalProfit)}</b>
                      </td>
                      <td>
                        <span
                          className={`pill-badge ${item.profitPercent >= 0 ? "positive" : "negative"}`}
                        >
                          {percent(item.profitPercent)}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <AssetPerformanceDetailRow
                        item={item}
                        data={data}
                        share={share}
                        onClose={() => toggleAssetExpand(item.asset.id)}
                        onViewTransactions={onViewAssetTransactions}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </details>
    </div>
  );
}

export function BackupView({
  data,
  onExport,
  onImport,
  onCsv,
  onPdf,
  onClear,
}: {
  data: PortfolioData;
  onExport: () => void;
  onImport: () => void;
  onCsv: () => void;
  onPdf: () => void;
  onClear: () => void;
}) {
  return (
    <div className="view-container">
      <div className="backup-hero">
        <HardDrive size={48} className="backup-icon" />
        <div className="title-with-info" style={{ justifyContent: "center" }}>
          <h2 style={{ margin: 0 }}>مدیریت نسخه پشتیبان و داده‌های پورتفوی شما</h2>
          <InfoButton
            title="مدیریت داده‌ها و نسخه پشتیبان پورتفو"
            formula="داده‌های پرتفوی در localStorage همین مرورگر نگهداری می‌شوند؛ این حافظه رمزگذاری‌شده نیست."
            description="حفظ امنیت، استقلال و دسترسی همیشگی به داده‌های سبد سرمایه‌گذاری با ابزارهای پشتیبان‌گیری و بازیابی."
            details={[
              "فایل پشتیبان JSON شامل تمامی دارایی‌ها، تاریخچه قیمت‌ها، سفارش‌های سهام، سود مجامع و فایل‌های پیوست است.",
              "می‌توانید فایل JSON را در هر زمان یا در دستگاه‌های دیگر بدون افت اطلاعات بارگذاری کنید."
            ]}
          />
        </div>
        <p>
          فایل پشتیبان در مرورگر خوانده می‌شود و داده‌های پورتفو در حافظهٔ محلی همین مرورگر
          (LocalStorage، بدون رمزگذاری) نگهداری می‌شوند؛ فایل JSON و دستگاه خود را ایمن نگه دارید.
          برای انتقال به دستگاه دیگر، خروجی JSON بگیرید و آن را در مرورگر مقصد بازیابی کنید.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
          <span className="pill-badge neutral">تعداد دارایی‌ها: {nf.format(data.assets.length)}</span>
          <span className="pill-badge neutral">تعداد معاملات ثبت‌شده: {nf.format(data.transactions.length)}</span>
          <span className="pill-badge neutral">معاملات بورس: {nf.format(data.stockOrders.length)}</span>
          <span className="pill-badge neutral">پیوست‌ها: {nf.format(data.attachments.length)}</span>
        </div>
      </div>

      <div className="backup-cards-grid">
        <div className="backup-action-card">
          <FileArchive size={32} />
          <div className="title-with-info" style={{ justifyContent: "center" }}>
            <h3 style={{ margin: 0 }}>پشتیبان‌گیری کامل (JSON)</h3>
            <InfoButton
              title="پشتیبان‌گیری کامل (JSON)"
              formula="استخراج تمام داده‌های پایگاه داده پورتفو در یک فایل ساخت‌یافته استاندارد JSON"
              description="ذخیره یک کپی کامل و امن از تمام اطلاعات ثبت‌شده تا این لحظه."
            />
          </div>
          <p>شامل تمام دارایی‌ها، تاریخچه قیمت‌ها، معاملات بورس و اسناد پیوست.</p>
          <button type="button" className="button primary" onClick={onExport}>
            <Download size={18} /> دریافت فایل پشتیبان
          </button>
        </div>

        <div className="backup-action-card">
          <Upload size={32} />
          <div className="title-with-info" style={{ justifyContent: "center" }}>
            <h3 style={{ margin: 0 }}>بازیابی اطلاعات (Restore)</h3>
            <InfoButton
              title="بازیابی اطلاعات از فایل پشتیبان"
              formula="خواندن JSON در همین مرورگر و جایگزینی کامل پرتفوی جاری پس از تأیید شما"
              description="بازگردانی پورتفو در صورت تعویض سیستم، پاک شدن حافظه مرورگر یا استفاده در دستگاه دیگر."
            />
          </div>
          <p>جایگزینی داده‌های فعلی مرورگر با فایل JSON انتخابی، پس از تأیید شما. اگر دادهٔ فعلی مهم است ابتدا از آن خروجی بگیرید.</p>
          <button type="button" className="button secondary" onClick={onImport}>
            <Upload size={18} /> انتخاب فایل پشتیبان
          </button>
        </div>

        <div className="backup-action-card">
          <FileDown size={32} />
          <div className="title-with-info" style={{ justifyContent: "center" }}>
            <h3 style={{ margin: 0 }}>خروجی اکسل (CSV)</h3>
            <InfoButton
              title="خروجی جدول معاملات اکسل"
              formula="تولید فایل متنی کاما-جدا (CSV) با کدگذاری استاندارد UTF-8 BOM جهت نمایش صحیح متون فارسی در نرم‌افزار Excel"
              description="مناسب برای انجام تحلیل‌های سفارشی، حسابداری و رسم نمودار در مایکروسافت اکسل."
            />
          </div>
          <p>دریافت فهرست جامع معاملات با فرمت سازگار با اکسل (UTF-8).</p>
          <button type="button" className="button secondary" onClick={onCsv}>
            <FileDown size={18} /> دریافت اکسل
          </button>
        </div>

        <div className="backup-action-card">
          <FileText size={32} />
          <div className="title-with-info" style={{ justifyContent: "center" }}>
            <h3 style={{ margin: 0 }}>گزارش چاپی / PDF</h3>
            <InfoButton
              title="تولید و چاپ گزارش PDF پورتفو"
              formula="قالب‌بندی و تبدیل بهینه سبک‌های گرافیکی برای خروجی با کیفیت کاغذ A4 و پرینتر"
              description="امکان تهیه نسخه چاپی مستند یا فایل PDF برای بایگانی کاغذی و اشتراک با مشاور مالی."
            />
          </div>
          <p>تولید گزارش صفحه مدیریت دارایی آماده پرینت یا ذخیره به صورت PDF.</p>
          <button type="button" className="button secondary" onClick={onPdf}>
            <FileText size={18} /> چاپ گزارش
          </button>
        </div>
      </div>

      <div className="panel-card danger-zone">
        <div className="panel-head">
          <div>
            <div className="title-with-info">
              <h3 style={{ color: "#dc2626", margin: 0 }}>پاک‌سازی کل داده‌های این مرورگر و شروع مجدد</h3>
              <InfoButton
                title="پاک‌سازی کامل و بازنشانی پورتفو"
                formula="حذف کلیدهای محلی پورتفو از حافظه LocalStorage و ساخت یک ساختار داده خالی اولیه"
                description="عملیات غیرقابل بازگشت جهت صفر کردن سیستم برای ورود اطلاعات دارایی‌های واقعی خود کاربر."
              />
            </div>
            <p>تمام تراکنش‌ها، دارایی‌ها و قیمت‌های فعلی حذف می‌شوند. پیش از شروع تازه، نسخهٔ پشتیبان بگیرید.</p>
          </div>
          <button type="button" className="button danger-button" onClick={onClear}>
            <Trash2 size={16} /> پاک‌سازی و شروع تازه
          </button>
        </div>
      </div>
    </div>
  );
}
