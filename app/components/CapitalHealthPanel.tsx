"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Pencil, Plus } from "lucide-react";
import { money, nf, signedMoney, toPersianDate } from "../lib/portfolio";
import type { AuditTarget, CapitalReport, CapitalFlow } from "../lib/capitalReport";
import type { PortfolioData } from "../lib/types";
import type { RelatedMovement } from "../lib/reconciliationGuide";
import { describeTransactionNote } from "../lib/transactionDescriptions";

const flowLabels: Record<CapitalFlow["kind"], string> = {
  initial: "سرمایهٔ اولیه",
  deposit: "آوردهٔ بعدی",
  withdrawal: "برداشت از سبد",
  possibleDeposit: "خرید با منبع نامعلوم",
  possibleWithdrawal: "فروش با مقصد نامعلوم",
};

export function CapitalHealthPanel({
  report,
  data,
  onResolve,
  onRegisterCapital,
  onShowTransactions,
  onViewAccount,
}: {
  report: CapitalReport;
  data?: PortfolioData;
  onResolve: (target: AuditTarget) => void;
  onRegisterCapital: (accountId?: string, beforeDate?: string) => void;
  onShowTransactions: () => void;
  onViewAccount?: (accountId: string, focusTransactionId?: string) => void;
}) {
  const inspectRelated = (related: RelatedMovement) => {
    if (related.target.type === "transaction" && onViewAccount) onViewAccount(related.assetId, related.target.id);
    else onResolve(related.target);
  };
  // Report descriptions retain the original ledger notes for auditing. Only the
  // visible copy resolves machine references; missing data keeps the old fallback.
  const noteFor = (id: string, fallback: string) => {
    if (data) {
      const matches = data.transactions.filter((item) => item.id === id);
      if (matches.length !== 1) return "ردیف یکتای این گردش پیدا نشد؛ شناسه‌ها را بررسی کنید";
      return describeTransactionNote(data, matches[0]).trim() || fallback;
    }
    return fallback.replace(/\[[^\]]*\]/g, "").trim();
  };
  const [showAllFunding, setShowAllFunding] = useState(false);
  const [showAllShortfalls, setShowAllShortfalls] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showAllFlows, setShowAllFlows] = useState(false);
  const { fundingCandidates, cashShortfalls } = report;
  const funding = showAllFunding ? fundingCandidates : fundingCandidates.slice(0, 4);
  const shortfalls = showAllShortfalls ? cashShortfalls : cashShortfalls.slice(0, 1);
  const bankGap = cashShortfalls.find((gap) => gap.accountName.includes("بانک") && gap.earlierCreditCount === 0);
  const duplicate = report.issues.find((issue) => issue.id.startsWith("cash-duplicate-"));
  const incompleteTransfers = report.issues.filter((issue) => issue.id.startsWith("transfer-"));
  const adjustments = report.issues.filter((issue) => issue.id.startsWith("adjustment-"));
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const hasData = report.flows.length > 0 || report.issues.length > 0 || report.currentValue !== 0;

  return (
    <section className="capital-health" aria-label="راهنمای گام‌به‌گام سرمایه و ماندهٔ حساب‌ها">
      <div className="capital-health-head">
        <div>
          <span className="capital-health-eyebrow">دو گام به جای یک فهرست بلند خطا</span>
          <h2>اول پولِ شروع را مشخص کنیم؛ بعد حساب‌ها را تطبیق دهیم</h2>
          <p>ردیف‌های زیر از سوابق خود شما آمده‌اند. یافتن ردیف مرتبط دلیلِ درستی مبلغ یا منشأ پول نیست؛ هیچ ردیفی بدون تأیید و سند شما اصلاح نمی‌شود.</p>
        </div>
        <span className={`capital-health-status ${report.isReliable ? "ready" : "review"}`}>
          {report.isReliable ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          {report.isReliable ? "کنترل‌های داخلی بدون هشدار؛ با اسناد تأیید کنید" : hasData ? "سود نهایی هنوز قابل تأیید نیست" : "هنوز داده‌ای ثبت نشده"}
        </span>
      </div>

      <nav className="capital-step-nav" aria-label="مراحل بررسی">
        <a href="#capital-step-one">۱. منشأ سرمایه <span>{nf.format(fundingCandidates.length)} ردیفِ نیازمند پاسخ</span></a>
        <a href="#capital-step-two">۲. ماندهٔ حساب‌ها <span>{nf.format(cashShortfalls.length)} دورهٔ کسری</span></a>
      </nav>

      <section className="capital-step" id="capital-step-one" aria-labelledby="capital-step-one-title">
        <div className="capital-step-head">
          <span className="capital-step-number">۱</span>
          <div>
            <h3 id="capital-step-one-title">پول این خریدها و واریزها از کجا آمده؟</h3>
            <p>خریدها و واریزهای قدیمی که منبعشان مشخص نیست را یکی‌یکی با سند بررسی کنید؛ قدیمی بودنِ یک خرید به معنی پولِ شروع سرمایه‌گذاری نیست.</p>
          </div>
        </div>
        <div className="capital-step-totals">
          <div><span>سرمایهٔ اولیهٔ تأییدشده</span><strong>{report.initialCapital === null ? "هنوز نامشخص" : money(report.initialCapital)}</strong></div>
          <div><span>ورودی‌هایی که منشأشان معلوم نیست</span><strong>{nf.format(fundingCandidates.length)} ردیف</strong></div>
        </div>

        {fundingCandidates.length ? (
          <>
            <p className="capital-step-instruction">با سند مشخص کنید پولِ هر ردیف <b>برای شروع از بیرون آمده</b>، <b>بعداً از بیرون اضافه شده</b>، <b>از حسابی که در دارا ثبت کرده‌اید پرداخت شده</b> یا <b>بین حساب‌های خودتان جابه‌جا شده</b> است. اگر نمی‌دانید، ردیف قدیمی را فعلاً نامشخص بگذارید؛ پول را دوباره ثبت نکنید.</p>
            <div className="capital-review-list">
              {funding.map((item) => (
                <div className="capital-review-row" key={item.id}>
                  <div className="capital-review-text">
                    <span className="capital-review-type">{item.source === "cash_credit" ? "واریز نقدیِ بدون منبع" : "خرید با منبع نامشخص"}</span>
                    <b>{item.assetName} · {toPersianDate(item.date)}</b>
                    {item.description !== "بدون توضیح ثبت‌شده" && <small>{noteFor(item.id, item.description)}</small>}
                  </div>
                  <strong>{money(item.amount)}</strong>
                  <button type="button" className="button secondary small-btn" onClick={() => onResolve({ type: "transaction", id: item.id })}>تعیین منبع همین ردیف <ArrowLeft size={14} /></button>
                </div>
              ))}
            </div>
            {fundingCandidates.length > 4 && <button type="button" className="button ghost small-btn" onClick={() => setShowAllFunding((old) => !old)}>{showAllFunding ? "نمایش چهار مورد اول" : `نمایش همهٔ ${nf.format(fundingCandidates.length)} مورد`}</button>}
          </>
        ) : (
          <div className="capital-health-empty"><CheckCircle2 size={18} /> {report.initialCapital === null ? "خرید/واریز بی‌منبعی باقی نمانده، اما آوردهٔ اولیه هنوز ثبت نشده است؛ فقط اگر واقعاً جا افتاده، با سند ثبت کنید." : "منشأ خریدها و واریزهای آغازین تعیین شده است."}</div>
        )}
        {report.initialCapital === null && (
          <div className="capital-row-actions capital-step-new-money">
            <span>واریزی که قبلاً ثبت شده را دوباره نسازید. اگر واقعاً یک واریز قدیمی جا افتاده است:</span>
            <button type="button" className="button secondary small-btn" onClick={() => onRegisterCapital(bankGap?.accountId, bankGap?.date)}>ثبت مبلغ و تاریخ واقعی با سند <Plus size={14} /></button>
          </div>
        )}
      </section>

      <section className="capital-step" id="capital-step-two" aria-labelledby="capital-step-two-title">
        <div className="capital-step-head">
          <span className="capital-step-number">۲</span>
          <div>
            <h3 id="capital-step-two-title">ماندهٔ منفی دقیقاً از کدام خروج شروع شد؟</h3>
            <p>ماندهٔ هر حساب از جمع ردیف‌های ثبت‌شده، با فرض صفر بودنِ ماندهٔ ثبت‌نشدهٔ آغاز حساب، به دست می‌آید. ترتیب واقعی تراکنش‌های هم‌روز را نمی‌توان از زمان ایجاد ردیف نتیجه گرفت؛ کسری‌ها بر اساس ماندهٔ پایان روز هستند. طرف مقابلِ انتقال هم کسری حساب مبدأ را توجیه نمی‌کند.</p>
          </div>
        </div>

        {cashShortfalls.length ? (
          <>
            <div className="capital-shortfall-list">
              {shortfalls.map((gap) => (
                <article className="capital-shortfall" key={gap.id}>
                  <div className="capital-shortfall-head">
                    <div><b>{gap.accountName}</b><span>شروع کسری: {toPersianDate(gap.date)} · {gap.recoveredOn ? `بعداً در ${toPersianDate(gap.recoveredOn)} دوباره مثبت شده` : "تا امروز همچنان منفی است"}</span></div>
                    <span className="capital-shortfall-amount">کسری پایان روز: {money(Math.abs(gap.balanceAfter))}</span>
                  </div>
                  {gap.attributionCandidates.length === 1 ? (
                    <>
                      <p><b>خروجی که بدون آن این کسریِ پایان روز رخ نمی‌داد:</b> {noteFor(gap.triggerId, gap.triggerDescription)} ({toPersianDate(gap.date)})</p>
                      <div className="capital-shortfall-equation">
                        <div><span>{gap.dayRowCount > 1 ? "ماندهٔ پایان روز بدون همین خروج" : "ماندهٔ ثبت‌شده پیش از خروج"}</span><strong>{money(gap.balanceBefore)}</strong></div>
                        <b>−</b>
                        <div><span>مبلغ همین خروج</span><strong>{money(gap.outflow)}</strong></div>
                        <b>=</b>
                        <div className="capital-shortfall-negative"><span>{gap.dayRowCount > 1 ? "ماندهٔ پایان روز با همهٔ ردیف‌ها" : "مانده پس از خروج"}</span><strong>{money(gap.balanceAfter)}</strong></div>
                      </div>
                      {gap.dayRowCount > 1 && <p className="capital-shortfall-hint">این معادله بر پایهٔ جمع همهٔ ردیف‌های همان روز است، نه ترتیب اثبات‌شدهٔ برداشت‌ها و واریزها.</p>}
                    </>
                  ) : (
                    <>
                      <p><b>چند برداشت در همین روز مؤثرند:</b> از تاریخ روز و زمان ایجاد ردیف نمی‌توان معلوم کرد کدام‌یک نخست مانده را منفی کرد. همهٔ برداشت‌های زیر را با گردش واقعی تطبیق دهید.</p>
                      <div className="capital-shortfall-equation">
                        <div><span>ماندهٔ روز قبل</span><strong>{money(gap.dayStartBalance)}</strong></div>
                        <b>+</b>
                        <div><span>واریزهای همان روز</span><strong>{money(gap.dayCredits)}</strong></div>
                        <b>−</b>
                        <div><span>جمع برداشت‌های همان روز</span><strong>{money(gap.dayDebits.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
                        <b>=</b>
                        <div className="capital-shortfall-negative"><span>ماندهٔ پایان روز</span><strong>{money(gap.balanceAfter)}</strong></div>
                      </div>
                      <div className="capital-shortfall-peers">{gap.dayDebits.map((row) => (
                        <div key={row.id}>
                          <span>{noteFor(row.id, row.description)} · {money(row.amount)}{row.related ? ` ↔ ${row.related.label}` : ""}</span>
                          <button type="button" className="button ghost small-btn" onClick={() => onResolve({ type: "transaction", id: row.id })}>بررسی برداشت</button>
                          {row.related && <button type="button" className="button ghost small-btn" onClick={() => inspectRelated(row.related!)}>بررسی طرف مقابل</button>}
                        </div>
                      ))}</div>
                    </>
                  )}
                  {gap.attributionCandidates.length === 1 && <div className="capital-shortfall-related">
                    {gap.related ? (
                      <>
                        <b>{gap.related.evidence === "stock_order" ? "سفارش متناظر این برداشت" : "ردیفِ طرف مقابل پیدا شد"}: {gap.related.label}</b>
                        <p>{toPersianDate(gap.related.date)} · {money(gap.related.amount)}. {gap.related.evidence === "matching_rows" ? "تطبیق یکتای تاریخ، مبلغ و جهت است؛ سندِ منشأ پول یا درستی دو ردیف نیست." : gap.related.evidence === "explicit" ? "دو ردیف در دفتر به هم پیوند خورده‌اند؛ با صورت‌حساب واقعی تأیید کنید." : "برداشت نقدیِ خودکار به این سفارش بورس مربوط است؛ مبلغ و موجودی قبلی را بررسی کنید."}</p>
                        <button type="button" className="button ghost small-btn" onClick={() => inspectRelated(gap.related!)}>{gap.related.target.type === "transaction" ? "مشاهده ردیف در گردش حساب مقابل" : "بررسی سفارش بورس"} <ArrowLeft size={14} /></button>
                      </>
                    ) : <p>طرفِ قابل‌اعتماد پیدا نشد؛ صرفِ هم‌مبلغ بودن برای پیوند یا ساخت واریز تازه کافی نیست.</p>}
                  </div>}
                  {gap.dayDebits.length > 1 && gap.attributionCandidates.length === 1 && (
                    <div className="capital-shortfall-peers">
                      <b>برداشت‌های دیگر همین روز (بدون ترتیب قطعی):</b>
                      {gap.dayDebits.filter((row) => row.id !== gap.triggerId).map((row) => (
                        <div key={row.id}>
                          <span>{noteFor(row.id, row.description)} · {money(row.amount)}{row.related ? ` ↔ ${row.related.label}` : ""}</span>
                          <button type="button" className="button ghost small-btn" onClick={() => onResolve({ type: "transaction", id: row.id })}>بررسی برداشت</button>
                          {row.related && <button type="button" className="button ghost small-btn" onClick={() => inspectRelated(row.related!)}>بررسی معاملهٔ مربوط</button>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="capital-shortfall-hint">
                    {gap.earlierCreditCount === 0
                      ? "پیش از این روز هیچ واریزی در این حساب ثبت نشده؛ ماندهٔ واقعیِ آغاز حساب یا تاریخ/مبلغ انتقال را با سند بررسی کنید."
                      : gap.attributionCandidates.length === 1 && gap.dayRowCount === 1
                        ? `پیش از این برداشت، ${money(gap.balanceBefore)} در حساب ثبت شده بود؛ مبلغ خروج از آن بیشتر است. تاریخ و گردش واقعی را تطبیق دهید.`
                        : "ماندهٔ همین روز را با صورت‌حساب واقعی تطبیق دهید؛ معادلهٔ روزانه، ترتیبِ معاملات هم‌روز را ثابت نمی‌کند."}
                    {gap.precedingAdjustments > 0 && ` پیشینهٔ این حساب ${nf.format(gap.precedingAdjustments)} اصلاح مانده با منبع نامعلوم دارد؛ آن‌ها را هم با صورت‌حساب تطبیق دهید.`}
                    {gap.lowestBalance < gap.balanceAfter - 1 && ` کمترین ماندهٔ پایان روز در این دوره: ${money(gap.lowestBalance)} (${toPersianDate(gap.lowestDate)}).`}
                    {gap.recoveredOn && " مثبت‌شدنِ بعدی، کسری تاریخی را خودبه‌خود تأیید یا اصلاح نمی‌کند."}
                  </p>
                  <div className="capital-row-actions">
                    {gap.attributionCandidates.length === 1 && <button type="button" className="button secondary small-btn" onClick={() => onResolve({ type: "transaction", id: gap.triggerId })}><Pencil size={14} /> بررسی خروجِ مشخص‌شده</button>}
                    {onViewAccount && <button type="button" className="button ghost small-btn" onClick={() => onViewAccount(gap.accountId, gap.triggerId)}>دیدن تمام گردش {gap.accountName}</button>}
                    {gap.earlierCreditCount === 0 && <button type="button" className="button ghost small-btn" onClick={() => onRegisterCapital(gap.accountId, gap.date)}>فقط اگر واریز پیشین واقعاً جا افتاده: ثبت با سند</button>}
                  </div>
                </article>
              ))}
            </div>
            {cashShortfalls.length > 1 && <button type="button" className="button ghost small-btn" onClick={() => setShowAllShortfalls((old) => !old)}>{showAllShortfalls ? "فقط نخستین کسری" : `نمایش ${nf.format(cashShortfalls.length - 1)} دورهٔ کسریِ دیگر`}</button>}
          </>
        ) : <div className="capital-health-empty"><CheckCircle2 size={18} /> در ماندهٔ پایان روزِ حساب‌های ثبت‌شده کسری دیده نشد.</div>}

        {(duplicate || incompleteTransfers.length || adjustments.length) ? (
          <div className="capital-followup">
            <h4>بعد از ردگیری کسری‌ها، این ثبت‌های مرتبط را تطبیق دهید</h4>
            {duplicate && <div><b>واریزِ احتمالاً دوباره‌شمرده‌شده در بانک</b><p>دو ردیف واریز در یک روز با مبلغ و شرح یکسان وجود دارند. هر دو در ماندهٔ بانک شمرده شده‌اند؛ فقط پس از دیدن صورت‌حساب، تکراری بودن یکی را تأیید و اصلاح کنید.</p><button type="button" className="button ghost small-btn" onClick={() => onResolve(duplicate.target)}>بررسی همان واریز</button></div>}
            {incompleteTransfers.length > 0 && <div><b>{nf.format(incompleteTransfers.length)} انتقال بدون طرف مقابل</b><p>برای هرکدام صورت‌حساب مبدأ و مقصد را پیدا کنید؛ از روی حدس واریز تازه نسازید.</p><div className="capital-row-actions">{incompleteTransfers.slice(0, 2).map((issue, index) => {
              const targetId = issue.target.type === "transaction" ? issue.target.id : null;
              const row = targetId ? data?.transactions.find((tx) => tx.id === targetId) : null;
              return <button type="button" className="button ghost small-btn" key={issue.id} onClick={() => onResolve(issue.target)}>انتقال {nf.format(index + 1)}{row ? ` · ${money(row.totalPrice)} (${toPersianDate(row.date)})` : ""}</button>;
            })}</div></div>}
            {adjustments.length > 0 && <div><b>{nf.format(adjustments.length)} اصلاح ماندهٔ بی‌منبع</b><p>به‌ویژه برای کیان، این ردیف‌ها می‌توانند پیشینهٔ ماندهٔ منفی را تغییر دهند. اولین مورد را با گردش واقعی بررسی کنید.</p><button type="button" className="button ghost small-btn" onClick={() => onResolve(adjustments[0].target)}>بررسی اولین اصلاح مانده</button></div>}
          </div>
        ) : null}
      </section>

      <details className="capital-technical" id="capital-audit">
        <summary>بعداً: جزئیات محاسبه و فهرست کامل {nf.format(report.issues.length)} مورد</summary>
        <p>این بخش برای بعد از تعیین سرمایهٔ اولیه و تطبیق مانده‌هاست. تا آن زمان سودِ زیر فقط یک محاسبهٔ تشخیصی است، نه سود تأییدشده.</p>
        <div className="capital-health-grid">
          <div className="capital-health-stat prominent"><span>سرمایهٔ اولیهٔ مشخص‌شده</span><strong>{report.initialCapital === null ? "هنوز تعیین نشده" : money(report.initialCapital)}</strong><small>فقط ردیف‌های تأییدشده</small></div>
          <div className="capital-health-stat"><span>آورده‌های بعدی</span><strong>{money(report.additionalCapital)}</strong><small>واریز تأییدشده از خارج سبد</small></div>
          <div className="capital-health-stat"><span>برداشت بیرونی</span><strong>{money(report.withdrawals)}</strong><small>خروج واقعی پول از سبد</small></div>
          <div className="capital-health-stat"><span>خالص آوردهٔ مشخص‌شده</span><strong>{money(report.netCapital)}</strong><small>{report.initialCapital === null ? "بدون سرمایهٔ اولیهٔ نامعلوم" : "اولیه + بعدی − برداشت"}</small></div>
        </div>
        <div className="capital-health-bridge">
          <div><span>ارزش محاسباتی سبد</span><strong>{money(report.currentValue)}</strong></div>
          <span className="capital-health-operator">−</span>
          <div><span>خالص آورده با فرض خریدهای بی‌منبع</span><strong>{money(report.estimatedNetCapital)}</strong></div>
          <span className="capital-health-operator">+</span>
          <div><span>مجمع در انتظار / بی‌واریز پیوندخورده</span><strong>{money(report.pendingDividends + report.paidOutside)}</strong></div>
          <span className="capital-health-operator">=</span>
          <div className="capital-health-result"><span>ماندهٔ سودِ فرضی، نه قطعی</span><strong>{signedMoney(report.estimatedProfit)}</strong></div>
        </div>
        <p className="capital-health-note">سود محاسباتی دارایی‌ها: {signedMoney(report.recordedProfit)} · اختلاف دو روش: {money(Math.abs(report.profitGap))}. تا رفع موارد نامشخص، هیچ‌یک بازدهی نهایی نیست؛ سود مجمعِ بدون محل دریافت مشخص نیز موقتاً خارج از سبد فرض شده است.</p>
        <div className="capital-health-section">
          <div className="capital-health-section-head"><div><h3>فهرست فنی همهٔ موارد</h3><p>اگر موردی در دو گام بالا روشن نشد، اینجا ردیفش را ویرایش کنید.</p></div><span className={errors ? "capital-health-count danger" : "capital-health-count"}>{nf.format(errors)} خطا · {nf.format(report.issues.length - errors)} هشدار</span></div>
          {report.issues.length ? (
            <>
              <div className="capital-health-issues">{(showAllIssues ? report.issues : report.issues.slice(0, 5)).map((issue) => (
                <div className={`capital-health-issue ${issue.severity}`} key={issue.id}>
                  <AlertTriangle size={17} aria-hidden="true" />
                  <div><b>{issue.title}</b><p>{issue.detail}</p></div>
                  <button type="button" className="button ghost small-btn" onClick={() => onResolve(issue.target)}>
                    {issue.target.type === "capital" ? "بررسی معاملات" : issue.target.type === "asset" ? "ویرایش دارایی" : issue.target.type === "price" ? (issue.target.recordId ? "اصلاح رکورد قیمت" : "ثبت قیمت") : issue.target.type === "stockPrice" ? "اصلاح قیمت سهام" : issue.target.type === "dividend" ? "بررسی مجمع" : "ویرایش ردیف"}<ArrowLeft size={14} />
                  </button>
                </div>
              ))}</div>
              {report.issues.length > 5 && <button type="button" className="button ghost small-btn" onClick={() => setShowAllIssues((old) => !old)}>{showAllIssues ? "نمایش کمتر" : `نمایش همهٔ ${nf.format(report.issues.length)} مورد`}</button>}
            </>
          ) : <div className="capital-health-empty"><CheckCircle2 size={18} /> ناسازگاری ثبت‌شده‌ای باقی نمانده است.</div>}
        </div>
        {report.flows.length > 0 && (
          <div className="capital-health-section">
            <div className="capital-health-section-head"><div><h3>ورود و خروج پول</h3><p>خریدهای بی‌منبع از آوردهٔ تأییدشده جدا هستند.</p></div><span className="capital-health-count">{nf.format(report.flows.length)} ردیف</span></div>
            <div className="table-wrapper"><table className="data-table capital-health-table">
              <thead><tr><th>تاریخ</th><th>حساب / دارایی</th><th>ماهیت</th><th>مبلغ</th><th>عملیات</th></tr></thead>
              <tbody>{(showAllFlows ? report.flows : report.flows.slice(0, 8)).map((flow) => (
                <tr key={flow.id}><td>{toPersianDate(flow.date)}</td><td>{flow.label}</td><td><span className={`capital-flow-tag ${flow.kind.startsWith("possible") ? "uncertain" : ""}`}>{flowLabels[flow.kind]}</span></td><td>{money(flow.amount)}</td><td><button type="button" className="button ghost small-btn" onClick={() => onResolve(flow.target)}>ویرایش</button></td></tr>
              ))}</tbody>
            </table></div>
            {report.flows.length > 8 && <button type="button" className="button ghost small-btn" onClick={() => setShowAllFlows((old) => !old)}>{showAllFlows ? "نمایش کمتر" : `نمایش همهٔ ${nf.format(report.flows.length)} ردیف`}</button>}
          </div>
        )}
        <button type="button" className="button ghost small-btn" onClick={onShowTransactions}><Pencil size={14} /> مشاهده دفتر معاملات</button>
      </details>
    </section>
  );
}
