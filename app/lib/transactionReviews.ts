import type { AuditIssue, CapitalReport } from "./capitalReport";
import { toPersianDate } from "./portfolio";

type RowIssue = Pick<AuditIssue, "id" | "severity" | "title" | "detail">;

export interface TransactionReview {
  severity: AuditIssue["severity"];
  issues: RowIssue[];
}

export interface TransactionReviewIndex {
  transactions: Map<string, TransactionReview>;
  stockOrders: Map<string, TransactionReview>;
}

/**
 * Attach only issues with an actual ledger-row target to the transactions list.
 * A portfolio-wide price or dividend problem must not be attributed to a trade.
 * This is presentation-only; it neither classifies nor changes any transaction.
 */
export function indexTransactionReviews(
  report: Pick<CapitalReport, "issues" | "cashShortfalls">,
): TransactionReviewIndex {
  const transactions = new Map<string, TransactionReview>();
  const stockOrders = new Map<string, TransactionReview>();
  const add = (target: "transaction" | "stockOrder", id: string, issue: RowIssue) => {
    const index = target === "transaction" ? transactions : stockOrders;
    const existing = index.get(id);
    if (existing) {
      // Put the actionable error before any warnings, even if the report was
      // supplied in another order; the first reason appears beside the row.
      if (issue.severity === "error") {
        existing.severity = "error";
        const firstWarning = existing.issues.findIndex((item) => item.severity === "warning");
        existing.issues.splice(firstWarning === -1 ? existing.issues.length : firstWarning, 0, issue);
      } else existing.issues.push(issue);
    } else index.set(id, { severity: issue.severity, issues: [issue] });
  };

  // A negative day-end balance with several possible same-day debits is real,
  // but the audit's representative trigger is NOT a verified first culprit.
  const ambiguous = report.cashShortfalls.filter((gap) => gap.attributionCandidates.length > 1);
  const ambiguousTriggers = new Set(ambiguous.map((gap) => gap.triggerId));
  for (const issue of report.issues) {
    if (issue.target.type !== "transaction" && issue.target.type !== "stockOrder") continue;
    if (issue.target.type === "transaction" && issue.id.startsWith("negative-") &&
        ambiguousTriggers.has(issue.target.id)) continue;
    add(issue.target.type, issue.target.id, issue);
  }
  for (const gap of ambiguous) {
    for (const id of new Set(gap.attributionCandidates)) {
      add("transaction", id, {
        id: `negative-review-${gap.id}-${id}`,
        severity: "warning",
        title: "کسری مانده با چند برداشت هم‌روز",
        detail: `ماندهٔ ثبت‌شدهٔ پایان روز ${gap.accountName} در ${toPersianDate(gap.date)} منفی شده است. نمی‌توان معلوم کرد کدام برداشت نخست باعث کسری شده؛ همهٔ برداشت‌های محتمل و ماندهٔ آغازین را با صورت‌حساب بررسی کنید.`,
      });
    }
  }
  return { transactions, stockOrders };
}
