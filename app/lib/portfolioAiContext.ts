import type {
  AssetMetric,
  BourseSummary,
  PortfolioData,
  StockSymbolMetric,
} from "./types";
import { money, percent, toPersianDate, nf } from "./portfolio";
import { describeTransactionNote } from "./transactionDescriptions";

export function buildPortfolioAiContext({
  data,
  metrics,
  stockData,
  bourseSummary,
  totalValue,
  totalProfit,
}: {
  data: PortfolioData;
  metrics: AssetMetric[];
  stockData: StockSymbolMetric[];
  bourseSummary?: BourseSummary;
  totalValue: number;
  totalProfit: number;
}): string {
  const totalCost = totalValue - totalProfit;
  const returnPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Group assets by category
  const categoryTotals = new Map<string, { value: number; count: number }>();
  metrics.forEach((m) => {
    if (m.marketValue <= 0 && m.quantity <= 0) return;
    const cat = m.asset.category || "سایر";
    const existing = categoryTotals.get(cat) || { value: 0, count: 0 };
    categoryTotals.set(cat, {
      value: existing.value + m.marketValue,
      count: existing.count + 1,
    });
  });

  const categoryLines: string[] = [];
  categoryTotals.forEach((val, cat) => {
    const share = totalValue > 0 ? (val.value / totalValue) * 100 : 0;
    categoryLines.push(
      `- دسته ${cat}: ارزش ${money(val.value)} (سهم: ${share.toFixed(1)}٪، شامل ${nf.format(val.count)} دارایی)`
    );
  });

  // Active assets detail
  const activeAssets = metrics.filter(
    (m) => m.marketValue > 0 || m.quantity > 0 || Math.abs(m.totalProfit) > 0
  );
  const assetLines = activeAssets.map((m) => {
    const weight = totalValue > 0 ? (m.marketValue / totalValue) * 100 : 0;
    return `* دارایی: ${m.asset.name} (${m.asset.category || "عمومی"}${m.asset.symbol ? ` - نماد: ${m.asset.symbol}` : ""})
  - مقدار موجود: ${nf.format(m.quantity)} ${m.asset.unit || "واحد"}
  - قیمت فعلی واحد: ${money(m.asset.currentPrice)}
  - بهای تمام‌شده کل: ${money(m.costBasis)} (میانگین خرید: ${money(m.averageCost)})
  - ارزش روز بازار: ${money(m.marketValue)} (وزن در کل سبد: ${weight.toFixed(1)}٪)
  - سود/زیان جاری (محقق‌نشده): ${money(m.unrealizedProfit)}
  - سود/زیان شناسایی‌شده (معاملات گذشته): ${money(m.realizedProfit)}
  - سود کل: ${money(m.totalProfit)} (${percent(m.profitPercent)})`;
  });

  // Active bourse stocks detail
  const activeStocks = stockData.filter((s) => s.quantity > 0 || s.purchases > 0);
  const stockLines = activeStocks.map((s) => {
    return `* نماد بورسی: ${s.symbol}
  - تعداد سهام: ${nf.format(s.quantity)} سهم
  - قیمت روز: ${money(s.price)}
  - بهای میانگین: ${money(s.average)}
  - بهای تمام‌شده: ${money(s.cost)}
  - ارزش روز: ${money(s.value)}
  - سود جاری: ${money(s.unrealized)} (${percent(s.cost > 0 ? (s.unrealized / s.cost) * 100 : 0)})
  - سود محقق‌شده از فروش‌ها: ${money(s.realized)}
  - سود نقدی دریافتی (DPS): ${money(s.paidDividend)} (مطالبات در انتظار: ${money(s.pendingDividend)})
  - سود کل نماد: ${money(s.profit)} (${percent(s.profitPercent)})`;
  });

  // Recent transactions (up to 10)
  const recentTxs = [...data.transactions]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 10)
    .map((tx) => {
      const asset = data.assets.find((a) => a.id === tx.assetId);
      const typeLabel = tx.type === "buy" ? "خرید" : "فروش";
      return `- تاریخ ${toPersianDate(tx.date)} | ${typeLabel} ${asset?.name || "دارایی"} | مقدار: ${nf.format(tx.quantity)} | قیمت واحد: ${money(tx.unitPrice)} | مبلغ کل: ${money(tx.totalPrice)}${tx.notes ? ` (یادداشت: ${describeTransactionNote(data, tx)})` : ""}`;
    });

  return `[خلاصه کلی پورتفوی]
- ارزش کل فعلی پورتفو: ${money(totalValue)}
- کل سرمایه‌گذاری (بهای تمام‌شده): ${money(totalCost)}
- سود / زیان کل: ${money(totalProfit)} (${percent(returnPercent)})
- تعداد کل دارایی‌ها: ${nf.format(activeAssets.length)}

[ترکیب و سهم دسته‌های دارایی]
${categoryLines.length > 0 ? categoryLines.join("\n") : "اطلاعات دسته‌بندی موجود نیست."}

[جزئیات دارایی‌های فعال در پورتفو]
${assetLines.length > 0 ? assetLines.join("\n\n") : "هیچ دارایی فعالی وجود ندارد."}

${
  stockLines.length > 0
    ? `[وضعیت سبد سهام بورس]
- ارزش روز سهام بورس: ${money(bourseSummary?.currentValue || 0)}
- بیشترین پول درگیر بورس (اوج مجموع بهای سهام موجود در پایان یک روز): ${money(bourseSummary?.peakOpenCost || 0)}${bourseSummary?.peakOpenCostDate ? `، پایان ${toPersianDate(bourseSummary.peakOpenCostDate)}` : ""}؛ چون ساعت واقعی سفارش‌ها ثبت نشده اوج میان‌روز را حدس نمی‌زنیم؛ این عدد آوردهٔ خالص نقدی یا ارزش بازار نیست
- نسبت سود محقق‌شده (فروش‌ها + مجامع پرداخت‌شده) به بیشترین پول درگیر بورس: ${bourseSummary?.peakOpenCost ? percent(bourseSummary.realizedReturnPercent) : "—"}؛ سود محقق‌شده ${money(bourseSummary?.realizedProfit || 0)}
- نسبت سود قیمتی سهام موجود به بهای خرید همین سهام: ${bourseSummary?.currentCost ? percent(bourseSummary.currentProfitPercent) : "—"}؛ سود فعلی ${money(bourseSummary?.currentProfit || 0)}
- نسبت سود کل (محقق‌شده + سود فعلی + مجامع در انتظار) به بیشترین پول درگیر بورس: ${bourseSummary?.peakOpenCost ? percent(bourseSummary.toDateReturnPercent) : "—"}؛ سود کل ${money(bourseSummary?.toDateProfit || 0)}؛ همان درصد کارت بورس در دارایی‌ها و نه بازده سالانه
- سود نقدی مجامع پرداخت‌شده (DPS): ${money(bourseSummary?.paidDividends || 0)}
- مانده سپرده نزد کارگزاری (حامی): ${money(bourseSummary?.hamiBalance || 0)}

فهرست نمادهای بورسی:
${stockLines.join("\n\n")}`
    : ""
}

[۱۰ معامله اخیر ثبت‌شده]
${recentTxs.length > 0 ? recentTxs.join("\n") : "هنوز معامله‌ای ثبت نشده است."}
`;
}
