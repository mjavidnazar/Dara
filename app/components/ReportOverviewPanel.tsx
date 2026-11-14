"use client";

import type { CapitalReport } from "../lib/capitalReport";
import type { ReportOverview } from "../lib/reportOverview";
import { money, nf, signedMoney } from "../lib/portfolio";
import { InfoButton } from "./InfoGuide";

type MetricId = "gross-capital" | "realized-profit" | "combined-profit" | "market-value" |
  "purchase-value" | "realized-ratio" | "market-ratio" | "market-withdrawals-ratio";

function ReportMetricCard({
  id, title, value, detail, formula, description, tone,
}: {
  id: MetricId;
  title: string;
  value: string;
  detail: string;
  formula: string;
  description: string;
  tone?: "positive" | "negative";
}) {
  return (
    <article className="report-overview-card" data-report-metric={id}>
      <div className="card-label-with-info">
        <span className="card-label">{title}</span>
        <InfoButton title={title} formula={formula} description={description} />
      </div>
      <strong className={`report-overview-value ${tone ? `${tone}-text` : ""}`}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

const displayMoney = (amount: number | null) => amount === null ? "نامشخص" : money(amount);
const displayProfit = (amount: number | null) => amount === null ? "نامشخص" : signedMoney(amount);
const displayRatio = (ratio: number | null) => ratio === null ? "—" : `${nf.format(ratio)}٪`;

export function ReportOverviewPanel({ overview, report }: { overview: ReportOverview; report: CapitalReport }) {
  const ready = report.isReliable && overview.profitComponentsMatch;
  const realizedRatioDetail = overview.grossCapital === null
    ? "تا ثبت سرمایهٔ اولیه، مخرج معلوم نیست."
    : overview.grossCapital <= 0 ? "کل سرمایه باید مثبت باشد." : "مخرج: سرمایهٔ اولیه + آورده‌های بعدی";
  const marketRatioDetail = report.initialCapital === null
    ? "تا ثبت سرمایهٔ اولیه، مخرج معلوم نیست."
    : !Number.isFinite(report.initialCapital) || report.initialCapital <= 0
      ? "سرمایهٔ اولیه باید مثبت باشد." : "مخرج: فقط سرمایهٔ اولیه، بدون آورده‌های بعدی";
  const withdrawalsRatioDetail = overview.grossCapital === null
    ? "تا ثبت سرمایهٔ اولیه، مخرج معلوم نیست."
    : overview.grossCapital <= 0
      ? "کل سرمایه باید مثبت باشد."
      : !Number.isFinite(report.withdrawals) || report.withdrawals < 0
        ? "مبلغ برداشت بیرونی نامعتبر است."
        : `مخرج: سرمایهٔ اولیه + آورده‌های بعدی · برداشت بیرونی در صورت: ${money(report.withdrawals)}`;

  return (
    <section className="panel-card report-overview" aria-labelledby="report-overview-heading">
      <div className="report-overview-head">
        <div>
          <span className="capital-health-eyebrow">خلاصهٔ سرمایه و عملکرد</span>
          <h2 id="report-overview-heading">شاخص‌های کل سبد</h2>
          <p>مقادیر امروز بر پایهٔ ردیف‌های ثبت‌شده و آخرین قیمت‌های معتبر محاسبه می‌شوند.</p>
        </div>
        <span className={`report-overview-status ${ready ? "ready" : "review"}`}>
          {ready ? "بدون هشدار داخلی؛ نیازمند تطبیق با اسناد" : "اعداد خام؛ نیازمند بررسی"}
        </span>
      </div>

      {!report.isReliable && (
        <p className="report-overview-caution" role="note">
          گزارش تطبیق سرمایه هنوز هشدار دارد. این ارقام و نسبت‌ها از داده‌های ثبت‌شده محاسبه شده‌اند،
          اما نتیجهٔ قطعی نیستند؛ منشأ پول، مانده‌ها و نرخ‌ها را در بخش پایین بازبینی کنید.
        </p>
      )}
      {!overview.profitComponentsMatch && (
        <p className="report-overview-caution" role="note">
          جمع سود محقق‌شده و جاریِ ردیف‌ها با سود کل داشبورد یا با جمع خودِ بعضی ردیف‌ها یکسان نیست.
          این جمع، عدد خامِ مؤلفه‌هاست؛ آن را سود تأییدشده ندانید و ردیف‌های دارایی را بررسی کنید.
        </p>
      )}

      <div className="report-overview-grid">
        <ReportMetricCard
          id="gross-capital"
          title="کل سرمایهٔ اولیه و سرمایهٔ اضافه‌شده"
          value={displayMoney(overview.grossCapital)}
          detail={`اولیه: ${report.initialCapital === null ? "نامشخص" : money(report.initialCapital)} · افزوده: ${money(report.additionalCapital)} · برداشت: ${money(report.withdrawals)} (کسر نشده)`}
          formula="کل سرمایه = سرمایهٔ اولیهٔ ثبت‌شده + آورده‌های بعدی؛ برداشت‌ها کم نمی‌شوند."
          description="جمع آوردهٔ واقعیِ مشخص‌شده؛ وقتی سرمایهٔ اولیه هنوز تعیین نشده باشد، این جمع و نسبت‌های وابسته به آن نامشخص‌اند."
        />
        <ReportMetricCard
          id="realized-profit"
          title="کل سود / زیان محقق‌شده"
          value={displayProfit(overview.realizedProfit)}
          detail="فروش‌ها، مجامع پرداخت‌شده و سود واریزی حساب‌ها؛ با کسر زیان و هزینه‌ها"
          formula="سود محقق‌شده = سود/زیان فروش دارایی و سهام + سود مجمع پرداخت‌شده + سود واریزی حساب‌های نقدی − هزینه‌های ثبت‌شده"
          description="فقط سودهای تحقق‌یافته؛ سود قیمت‌گذاری فعلی و سود مجمع در انتظار پرداخت در این عدد نیستند."
          tone={overview.realizedProfit === null ? undefined : overview.realizedProfit >= 0 ? "positive" : "negative"}
        />
        <ReportMetricCard
          id="combined-profit"
          title="کل سود / زیان محقق‌شده و محقق‌نشده"
          value={displayProfit(overview.combinedProfit)}
          detail={overview.profitComponentsMatch
            ? "سود محاسباتی سبد؛ سود در انتظار مجمع در بخش جاری است"
            : "جمع خام مؤلفه‌ها؛ ناسازگاری با سود داشبورد/ردیف‌ها را بررسی کنید"}
          formula="سود کل = سود محقق‌شده + سود جاریِ ناشی از ارزش روز دارایی‌ها و سهام + سود مجمع در انتظار پرداخت"
          description="سود کلِ محاسبه‌شده در همین سبد؛ تا زمان رفع هشدارهای تطبیق، نتیجهٔ قطعی یا وجه نقدِ دریافت‌شده نیست."
          tone={overview.combinedProfit === null ? undefined : overview.combinedProfit >= 0 ? "positive" : "negative"}
        />
        <ReportMetricCard
          id="market-value"
          title="ارزش دارایی‌های فعلی با قیمت روز"
          value={displayMoney(overview.currentMarketValue)}
          detail="ارزش روز موجودی باز، سهام و ماندهٔ حساب‌های نقدی"
          formula="ارزش روز = مجموع ارزش‌گذاری دارایی‌ها و سهام باقی‌مانده با آخرین نرخ معتبر + ماندهٔ امضادار حساب‌های نقدی"
          description="همان ارزش کل سبد در داشبورد؛ سود مجمع در انتظار وصول، تا پیش از دریافت، به ارزش نقدی اضافه نمی‌شود."
        />
        <ReportMetricCard
          id="purchase-value"
          title="ارزش دارایی‌های فعلی با میانگین خرید"
          value={displayMoney(overview.currentValueAtPurchase)}
          detail="بهای خرید موجودی باز + ماندهٔ اسمی نقد؛ بدون خریدهای فروخته‌شده"
          formula="ارزش در بهای خرید = مجموع بهای تمام‌شدهٔ موجودی‌های غیرنقدیِ باقی‌مانده (بر مبنای میانگین موزون خرید) + ماندهٔ واقعی حساب‌های نقدی"
          description="دارایی‌های فروخته‌شده دوباره شمرده نمی‌شوند. وجه نقد نرخ خرید ندارد و با ارزش اسمیِ مانده‌اش لحاظ می‌شود؛ برای کپی‌ترید بهای تمام‌شدهٔ ثبت‌شده مبناست."
        />
        <ReportMetricCard
          id="realized-ratio"
          title="نسبت سود محقق‌شده به کل سرمایهٔ اولیه و اضافه‌شده"
          value={displayRatio(overview.realizedToCapitalPercent)}
          detail={realizedRatioDetail}
          formula="نسبت = (سود / زیان محقق‌شده ÷ (سرمایهٔ اولیه + آورده‌های بعدی)) × ۱۰۰"
          description="برداشت‌ها از مخرج کم نشده‌اند. این عدد بازدهی سالانه یا بازدهی زمان‌وزن نیست و در صورت فقدان مخرج معتبر نمایش داده نمی‌شود."
          tone={overview.realizedToCapitalPercent === null ? undefined : overview.realizedToCapitalPercent >= 0 ? "positive" : "negative"}
        />
        <ReportMetricCard
          id="market-ratio"
          title="نسبت (ارزش روز دارایی‌ها + سود محقق‌شده) به سرمایهٔ اولیه"
          value={displayRatio(overview.marketPlusRealizedToInitialPercent)}
          detail={marketRatioDetail}
          formula="نسبت = ((ارزش روز دارایی‌ها و ماندهٔ نقدی + کل سود / زیان محقق‌شده) ÷ سرمایهٔ اولیه) × ۱۰۰"
          description="طبق فرمول درخواستی، آورده‌های بعدی و برداشت‌ها در مخرج این نسبت نیستند. سود محقق‌شده‌ای که هنوز در حساب نقدی است ممکن است از قبل در ارزش روز باشد و با این جمع دوبار شمرده شود؛ این نسبت بازدهی خالص یا ارزش واقعی سبد نیست. اگر سرمایهٔ اولیه مثبت و معتبر نباشد درصد نمایش داده نمی‌شود."
        />
        <ReportMetricCard
          id="market-withdrawals-ratio"
          title="نسبت (ارزش روز دارایی‌ها + برداشت بیرونی + سود محقق‌شده) به (سرمایهٔ اولیه + آورده‌های بعدی)"
          value={displayRatio(overview.marketPlusWithdrawalsAndRealizedToCapitalPercent)}
          detail={withdrawalsRatioDetail}
          formula="نسبت = ((ارزش روز دارایی‌ها و ماندهٔ نقدی + برداشت بیرونی ثبت‌شده + سود / زیان محقق‌شده) ÷ (سرمایهٔ اولیه + آورده‌های بعدی)) × ۱۰۰"
          description="فقط برداشت واقعی از سبد در صورت جمع می‌شود؛ جابه‌جایی پول بین حساب‌ها و خریدوفروش داخلی برداشت بیرونی نیست. برداشت از مخرج کم نمی‌شود. سود محقق‌شده ممکن است از قبل در ماندهٔ نقدیِ ارزش روز باشد و دوباره شمرده شود؛ این شاخص بازده خالص یا سالانه نیست. بدون مخرج مثبت و مبالغ معتبر، درصد نمایش داده نمی‌شود."
        />
      </div>
      <p className="report-overview-footnote">
        مخرج نسبت سود محقق‌شده و نسبتِ شامل برداشت بیرونی، «سرمایهٔ اولیه + آورده‌های بعدی» است؛ مخرج نسبت «ارزش روز + سود محقق‌شده» فقط «سرمایهٔ اولیه» است.
        برداشت‌ها از هیچ مخرجی کسر نمی‌شوند و فقط به صورتِ کارت جدید اضافه می‌شوند. ارزش خریدِ موجودی فعلی شامل ماندهٔ نقدی با ارزش اسمی است.
        در دو نسبتِ شامل سود محقق‌شده و ارزش روز، سودِ باقی‌مانده در نقد ممکن است دوباره شمرده شود؛ آن‌ها را بازدهی خالص تلقی نکنید.
      </p>
    </section>
  );
}
