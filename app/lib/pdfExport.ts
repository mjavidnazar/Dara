import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Asset, AssetMetric, PortfolioData, Transaction } from "./types";
import { money, percent, nf, toPersianDate, todayIso, safeNumber } from "./portfolio";
import { VAZIRMATN_PDF_CSS } from "./pdfFonts";

const CATEGORY_NAMES: Record<string, string> = {
  stock: "سهام بورس",
  gold: "طلا و سکه",
  crypto: "ارز دیجیتال",
  forex: "ارز و اسکناس",
  fixed: "صندوق درآمد ثابت",
  other: "سایر دارایی‌ها",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  stock: { bg: "#eff6ff", text: "#1d4ed8" },
  gold: { bg: "#fefce8", text: "#a16207" },
  crypto: { bg: "#fdf4ff", text: "#a21caf" },
  forex: { bg: "#ecfeff", text: "#0e7490" },
  fixed: { bg: "#f0fdf4", text: "#15803d" },
  other: { bg: "#f8fafc", text: "#475569" },
};

/** Format clean integer number with Persian locale */
function fmt(value: number): string {
  return nf.format(Math.round(safeNumber(value)));
}

/** Format signed money string with Persian digits */
function fmtSigned(value: number): { text: string; color: string; bg: string } {
  const num = safeNumber(value);
  if (Math.abs(num) < 0.5) {
    return { text: "۰", color: "#475569", bg: "#f1f5f9" };
  }
  const isPos = num > 0;
  return {
    text: `${isPos ? "+" : "−"} ${nf.format(Math.abs(Math.round(num)))}`,
    color: isPos ? "#047857" : "#b91c1c",
    bg: isPos ? "#ecfdf5" : "#fef2f2",
  };
}

/**
 * Fallback to download raw HTML in case html2canvas fails
 */
function downloadHtmlBackup(htmlContent: string, fileName: string) {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Render HTML snippet to a clean, custom-proportioned, unclipped PDF with Vazirmatn font.
 * Crucial rule: letter-spacing is strictly normal to avoid breaking Persian cursive script.
 */
async function renderHtmlToPdf(htmlBody: string, fileName: string): Promise<boolean> {
  const targetWidth = 1040;
  const container = document.createElement("div");
  container.id = "dara-pdf-render-sandbox";
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: -9999px;
    width: ${targetWidth}px;
    background-color: #ffffff;
    color: #0f172a;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    direction: rtl;
    text-align: right;
    z-index: -9999;
    overflow: visible;
  `;

  // Strict CSS reset & embedded font definitions to guarantee 100% sharp, joined Persian script
  container.innerHTML = `
    <style>
      ${VAZIRMATN_PDF_CSS}

      #dara-pdf-render-sandbox, #dara-pdf-render-sandbox * {
        box-sizing: border-box !important;
        font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        letter-spacing: normal !important;
        word-spacing: normal !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #dara-pdf-render-sandbox {
        background-color: #ffffff !important;
        color: #0f172a !important;
        direction: rtl !important;
        text-align: right !important;
      }
      #dara-pdf-render-sandbox b,
      #dara-pdf-render-sandbox strong {
        color: #0f172a !important;
        font-weight: 700 !important;
        letter-spacing: normal !important;
      }
      #dara-pdf-render-sandbox table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }
      #dara-pdf-render-sandbox th {
        background-color: #f8fafc !important;
        color: #334155 !important;
        font-weight: 700 !important;
        text-align: right !important;
        letter-spacing: normal !important;
      }
      #dara-pdf-render-sandbox td {
        color: #0f172a !important;
        text-align: right !important;
        word-break: break-word !important;
        letter-spacing: normal !important;
      }
    </style>
    ${htmlBody}
  `;
  document.body.appendChild(container);

  try {
    // Wait for the browser font cache and rendering engine
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn("document.fonts.ready wait skipped:", e);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));

    const canvas = await html2canvas(container, {
      scale: 2, // 2x crispness for professional printing
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: targetWidth,
      windowWidth: targetWidth + 40,
    });

    // Match PDF aspect ratio exactly to content height, eliminating artificial A4 page-breaks
    const mmWidth = 265;
    const mmHeight = (canvas.height * mmWidth) / canvas.width;
    const isLandscape = mmWidth > mmHeight;

    const pdf = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "mm",
      format: isLandscape ? [mmHeight, mmWidth] : [mmWidth, mmHeight],
      hotfixes: ["px_scaling"],
    });

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, mmWidth, mmHeight, undefined, "FAST");
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error("PDF generation via html2canvas failed:", err);
    downloadHtmlBackup(
      `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${fileName}</title><style>${VAZIRMATN_PDF_CSS}body{font-family:'Vazirmatn',sans-serif;background:#fff;padding:24px;direction:rtl;}</style></head><body>${htmlBody}</body></html>`,
      fileName.replace(/\.pdf$/i, ".html")
    );
    return false;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * 1. General Portfolio Comprehensive PDF Export (گزارش جامع پورتفوی)
 */
export async function exportPortfolioPdf(
  data: PortfolioData,
  metrics: AssetMetric[],
  stockData: Array<{
    symbol: string;
    quantity: number;
    value: number;
    realized: number;
    unrealized: number;
    paidDividend: number;
    pendingDividend: number;
  }>,
  totalValue: number,
  totalProfit: number
): Promise<boolean> {
  const dateStr = toPersianDate(todayIso());
  const totalCostBasis = metrics.reduce((sum, m) => sum + safeNumber(m.costBasis), 0);
  const totalFreshCapital = metrics.reduce((sum, m) => sum + safeNumber(m.freshCapital), 0);
  const totalRoi = totalCostBasis > 0 ? (totalProfit / totalCostBasis) * 100 : 0;
  const totalCapitalRoi = totalFreshCapital > 0 ? (totalProfit / totalFreshCapital) * 100 : 0;
  const distinctCategories = new Set(metrics.map((m) => m.asset.category)).size;

  const totalProfitFmt = fmtSigned(totalProfit);

  // Asset Rows HTML with share percentage and clean currency columns
  const assetRowsHtml = metrics
    .map((item, idx) => {
      const catKey = item.asset.category;
      const catName = CATEGORY_NAMES[catKey] || catKey;
      const catColor = CATEGORY_COLORS[catKey] || { bg: "#f1f5f9", text: "#334155" };
      const profitMeta = fmtSigned(item.totalProfit);
      const sharePct = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#fbfcfd";

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #edf2f7;">
          <!-- 1. Asset Name -->
          <td style="padding: 10px 14px; font-weight: 700; color: #0f172a; width: 19%;">
            <div style="font-size: 11.5px; line-height: 1.4;">${item.asset.name}</div>
          </td>

          <!-- 2. Category Badge -->
          <td style="padding: 10px 14px; width: 12%;">
            <span style="background: ${catColor.bg}; color: ${catColor.text}; padding: 3px 8px; border-radius: 5px; font-size: 10.5px; font-weight: 600; display: inline-block;">
              ${catName}
            </span>
          </td>

          <!-- 3. Quantity -->
          <td style="padding: 10px 14px; color: #0f172a; width: 12%; font-weight: 600; font-size: 11.5px;">
            ${nf.format(item.quantity)} <span style="font-size: 10px; color: #64748b; font-weight: 400;">${item.asset.unit || ""}</span>
          </td>

          <!-- 4. Cost Basis & Fresh Capital -->
          <td style="padding: 10px 14px; color: #334155; width: 16%; font-weight: 600; font-size: 11px; text-align: left; direction: ltr;">
            <div>${fmt(item.costBasis)}</div>
            <div style="font-size: 9.5px; color: #0284c7; margin-top: 2px;">آورده اولیه: ${fmt(item.freshCapital)}</div>
          </td>

          <!-- 5. Market Value (Toman) -->
          <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; width: 16%; text-align: left; direction: ltr; font-size: 12px;">
            ${fmt(item.marketValue)}
          </td>

          <!-- 6. Share of Portfolio % -->
          <td style="padding: 10px 14px; width: 8%; text-align: center;">
            <span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 600;">
              ${nf.format(Number(sharePct.toFixed(1)))}٪
            </span>
          </td>

          <!-- 7. Profit / Loss & True ROI -->
          <td style="padding: 10px 14px; width: 17%; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <span style="display: inline-block; font-size: 10px; font-weight: 700; color: ${profitMeta.color}; background: ${profitMeta.bg}; padding: 2px 6px; border-radius: 4px;">
                ${percent(item.profitPercent)}
              </span>
              <span style="color: ${profitMeta.color}; font-weight: 700; font-size: 11.5px; direction: ltr;">
                ${profitMeta.text}
              </span>
            </div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px; text-align: left; direction: rtl;">
              بازده روی آورده: <b style="color: ${item.capitalRoi >= 0 ? "#059669" : "#dc2626"}; direction: ltr; display: inline-block;">${percent(item.capitalRoi)}</b>
              ${item.isRiskFree ? `<span style="background: #fef3c7; color: #92400e; padding: 1px 4px; border-radius: 3px; font-size: 9px; margin-right: 4px;">ریسک‌فری</span>` : ""}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Stock Summary & Sorting: Active positions first, closed positions second
  const sortedStockData = [...stockData].sort((a, b) => {
    // Group active stocks first
    if (a.quantity > 0 && b.quantity === 0) return -1;
    if (a.quantity === 0 && b.quantity > 0) return 1;
    if (a.quantity > 0 && b.quantity > 0) return b.value - a.value;
    const totA = a.realized + a.paidDividend + a.pendingDividend;
    const totB = b.realized + b.paidDividend + b.pendingDividend;
    return totB - totA;
  });

  const totalStockValue = stockData.reduce((sum, s) => sum + safeNumber(s.value), 0);
  const totalStockProfit = stockData.reduce((sum, s) => sum + safeNumber(s.realized + s.unrealized), 0);
  const totalStockDiv = stockData.reduce((sum, s) => sum + safeNumber(s.paidDividend + s.pendingDividend), 0);
  const totalStockProfitFmt = fmtSigned(totalStockProfit);

  const stockRowsHtml =
    sortedStockData.length > 0
      ? sortedStockData
          .map((item, idx) => {
            const isActive = item.quantity > 0;
            const totProfit = item.realized + item.unrealized;
            const profitMeta = fmtSigned(totProfit);
            const totalDiv = item.paidDividend + item.pendingDividend;
            const totalReturn = totProfit + totalDiv;
            const totalReturnMeta = fmtSigned(totalReturn);
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#fbfcfd";

            return `
              <tr style="background-color: ${rowBg}; border-bottom: 1px solid #edf2f7;">
                <!-- Symbol -->
                <td style="padding: 9px 12px; font-weight: 800; color: #1e3a8a; width: 14%; font-size: 12px;">
                  ${item.symbol}
                </td>

                <!-- Status -->
                <td style="padding: 9px 12px; width: 12%;">
                  ${
                    isActive
                      ? `<span style="background: #ecfdf5; color: #047857; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700;">جاری در پورتفو</span>`
                      : `<span style="background: #f1f5f9; color: #64748b; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600;">تسویه‌شده</span>`
                  }
                </td>

                <!-- Shares Count -->
                <td style="padding: 9px 12px; color: #334155; width: 12%; font-weight: 600; font-size: 11.5px;">
                  ${isActive ? `${nf.format(item.quantity)} سهم` : `<span style="color: #94a3b8;">—</span>`}
                </td>

                <!-- Current Market Value -->
                <td style="padding: 9px 12px; font-weight: 700; color: #0f172a; width: 16%; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${isActive ? fmt(item.value) : `<span style="color: #94a3b8;">—</span>`}
                </td>

                <!-- Capital Profit/Loss -->
                <td style="padding: 9px 12px; width: 16%; text-align: left; direction: ltr;">
                  <span style="font-size: 11.5px; font-weight: 700; color: ${profitMeta.color};">
                    ${profitMeta.text}
                  </span>
                </td>

                <!-- DPS Dividend -->
                <td style="padding: 9px 12px; width: 15%; text-align: left; direction: ltr;">
                  ${
                    totalDiv > 0
                      ? `<span style="color: #7c3aed; font-weight: 700; font-size: 11.5px;">${fmt(totalDiv)}</span>`
                      : `<span style="color: #94a3b8;">—</span>`
                  }
                </td>

                <!-- Total Return (Profit + DPS) -->
                <td style="padding: 9px 12px; width: 15%; text-align: left; direction: ltr;">
                  <span style="font-size: 11.5px; font-weight: 700; color: ${totalReturnMeta.color};">
                    ${totalReturnMeta.text}
                  </span>
                </td>
              </tr>
            `;
          })
          .join("")
      : "";

  const htmlBody = `
    <div style="width: 1040px; padding: 34px 38px; background-color: #ffffff; color: #0f172a; direction: rtl; text-align: right; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 22px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #0d9488, #0f766e); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 22px; font-weight: 900; box-shadow: 0 4px 10px rgba(15, 118, 110, 0.2);">
            د
          </div>
          <div>
            <h1 style="margin: 0 0 4px; font-size: 21px; color: #0f172a; font-weight: 800; line-height: 1.3;">
              گزارش جامع وضعیت پورتفوی سرمایه‌گذاری
            </h1>
            <div style="font-size: 11.5px; color: #475569; font-weight: 500;">
              تحلیل عملکرد دارایی‌ها، سود و زیان تجمیعی و موازنه پورتفو · سیستم پورتفوی هوشمند دارا
            </div>
          </div>
        </div>

        <!-- Meta Info Badge Box -->
        <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; gap: 3px;">
          <div style="font-size: 11px; color: #475569;">
            تاریخ گزارش: <b style="color: #0f172a; font-weight: 700;">${dateStr}</b>
          </div>
          <div style="font-size: 10px; color: #64748b;">
            واحد ارقام: <b style="color: #0f172a; font-weight: 700;">تومان</b> · امنیت: <b style="color: #047857; font-weight: 700;">ذخیره ۱۰۰٪ محلی و آفلاین</b>
          </div>
        </div>
      </div>

      <!-- Executive 4 KPI Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
        <!-- KPI 1: Total Value -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #0f766e; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px;">ارزش کل سبد سرمایه‌گذاری</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 4px; direction: ltr; text-align: right;">${money(totalValue)}</div>
          <div style="font-size: 10px; color: #94a3b8;">مجموع ارزش روز دارایی‌ها + موجودی نقد</div>
        </div>

        <!-- KPI 2: Total Profit -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid ${totalProfitFmt.color}; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px;">مجموع سود / زیان کل</div>
          <div style="font-size: 18px; font-weight: 900; color: ${totalProfitFmt.color}; margin-bottom: 4px; direction: ltr; text-align: right;">
            ${totalProfitFmt.text} تومان
          </div>
          <div style="font-size: 10.5px; display: flex; gap: 6px;">
            <span style="font-weight: 700; color: ${totalProfitFmt.color}; background: ${totalProfitFmt.bg}; padding: 2px 7px; border-radius: 4px; display: inline-block;">
              بازده روی آورده: ${percent(totalCapitalRoi)}
            </span>
          </div>
        </div>

        <!-- KPI 3: Fresh Capital & Cost Basis -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #0284c7; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px;">آورده واقعی از جیب (بدون گردش مجدد)</div>
          <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-bottom: 4px; direction: ltr; text-align: right;">${money(totalFreshCapital)}</div>
          <div style="font-size: 10px; color: #64748b;">بهای تمام‌شده موجودی فعلی: <b style="color: #0f172a;">${money(totalCostBasis)}</b></div>
        </div>

        <!-- KPI 4: Diversification -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #0284c7; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px;">تنوع اقلام و دسته‌بندی‌ها</div>
          <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-bottom: 4px;">${nf.format(metrics.length)} قلم دارایی</div>
          <div style="font-size: 10px; color: #94a3b8;">در ${nf.format(distinctCategories)} دسته‌بندی مالی مختلف</div>
        </div>
      </div>

      <!-- Asset Performance Table -->
      <div style="margin-bottom: 26px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 11px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; border-right: 4px solid #0f766e; padding-right: 10px;">
            عملکرد تفکیکی دارایی‌ها و توزیع سرمایه (${nf.format(metrics.length)} قلم)
          </h3>
          <span style="font-size: 10.5px; color: #64748b; font-weight: 500;">کلیه مبالغ به تومان محاسبه شده است</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: #ffffff; table-layout: fixed;">
          <thead>
            <tr style="background: #f8fafc; color: #334155; border-bottom: 1.5px solid #cbd5e1;">
              <th style="padding: 10px 14px; text-align: right; width: 20%;">نام دارایی</th>
              <th style="padding: 10px 14px; text-align: right; width: 13%;">دسته‌بندی</th>
              <th style="padding: 10px 14px; text-align: right; width: 12%;">موجودی</th>
              <th style="padding: 10px 14px; text-align: left; width: 15%;">بهای تمام‌شده (تومان)</th>
              <th style="padding: 10px 14px; text-align: left; width: 16%;">ارزش روز (تومان)</th>
              <th style="padding: 10px 14px; text-align: center; width: 9%;">سهم از پورتفو</th>
              <th style="padding: 10px 14px; text-align: left; width: 15%;">سود / زیان کل</th>
            </tr>
          </thead>
          <tbody>
            ${assetRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800;">
              <td colspan="3" style="padding: 12px 14px; color: #0f172a; font-size: 12px;">
                مجموع کل دارایی‌ها
              </td>
              <td style="padding: 12px 14px; color: #0f172a; font-size: 12px; text-align: left; direction: ltr;">
                ${fmt(totalCostBasis)}
              </td>
              <td style="padding: 12px 14px; color: #0f172a; font-size: 12.5px; text-align: left; direction: ltr;">
                ${fmt(totalValue)}
              </td>
              <td style="padding: 12px 14px; text-align: center; font-size: 11px; color: #0f172a;">
                ۱۰۰٪
              </td>
              <td style="padding: 12px 14px; text-align: left;">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                  <span style="display: inline-block; font-size: 10px; font-weight: 700; color: ${totalProfitFmt.color}; background: ${totalProfitFmt.bg}; padding: 2px 6px; border-radius: 4px;">
                    ${percent(totalRoi)}
                  </span>
                  <span style="color: ${totalProfitFmt.color}; font-size: 12px; direction: ltr; font-weight: 800;">
                    ${totalProfitFmt.text}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${
        stockRowsHtml
          ? `
        <!-- Stock Details Section -->
        <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #f8fafc; padding: 11px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; border-right: 4px solid #1d4ed8; padding-right: 10px;">
              پرتفوی سهام بورس و سود نقدی مجمع (${nf.format(stockData.length)} نماد)
            </h3>
            <span style="font-size: 10.5px; color: #64748b;">تفکیک موقعیت‌های باز جاری و تسویه‌شده · سود مجمع (DPS)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: #ffffff; table-layout: fixed;">
            <thead>
              <tr style="background: #f8fafc; color: #334155; border-bottom: 1.5px solid #cbd5e1;">
                <th style="padding: 9px 12px; text-align: right; width: 14%;">نماد</th>
                <th style="padding: 9px 12px; text-align: right; width: 12%;">وضعیت</th>
                <th style="padding: 9px 12px; text-align: right; width: 12%;">تعداد سهام</th>
                <th style="padding: 9px 12px; text-align: left; width: 16%;">ارزش روز (تومان)</th>
                <th style="padding: 9px 12px; text-align: left; width: 16%;">سود سرمایه‌ای</th>
                <th style="padding: 9px 12px; text-align: left; width: 15%;">سود مجمع DPS</th>
                <th style="padding: 9px 12px; text-align: left; width: 15%;">مجموع عایدی نماد</th>
              </tr>
            </thead>
            <tbody>
              ${stockRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800;">
                <td colspan="3" style="padding: 11px 12px; color: #0f172a; font-size: 11.5px;">
                  مجموع سبد سهام
                </td>
                <td style="padding: 11px 12px; color: #0f172a; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${fmt(totalStockValue)}
                </td>
                <td style="padding: 11px 12px; color: ${totalStockProfitFmt.color}; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${totalStockProfitFmt.text}
                </td>
                <td style="padding: 11px 12px; color: #7c3aed; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${fmt(totalStockDiv)}
                </td>
                <td style="padding: 11px 12px; color: ${fmtSigned(totalStockProfit + totalStockDiv).color}; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${fmtSigned(totalStockProfit + totalStockDiv).text}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `
          : ""
      }

      <!-- Footer Bar -->
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748b;">
        <span>سامانه مدیریت پرتفوی دارا · بدون نیاز به ثبت‌نام و اینترنت · ذخیره‌سازی ۱۰۰٪ محلی و امن</span>
        <span>تاریخ سند: ${dateStr}</span>
      </div>
    </div>
  `;

  const fileName = `dara-portfolio-report-${todayIso()}.pdf`;
  return await renderHtmlToPdf(htmlBody, fileName);
}

/**
 * 2. Dedicated Asset Report Card PDF Export (کارنامه اختصاصی دارایی)
 */
export async function exportAssetCardPdf(
  asset: Asset,
  item: AssetMetric,
  txs: Transaction[],
  buyTxs: Transaction[],
  sellTxs: Transaction[],
  avgBuyPrice: number,
  currentPrice: number,
  totalDividend: number = 0
): Promise<boolean> {
  const dateStr = toPersianDate(todayIso());
  const categoryName = CATEGORY_NAMES[asset.category] || asset.category;

  const totalBuyAmount = buyTxs.reduce((sum, t) => sum + safeNumber(t.totalPrice), 0);
  const totalBuyQty = buyTxs.reduce((sum, t) => sum + safeNumber(t.quantity), 0);

  const totalSellAmount = sellTxs.reduce((sum, t) => sum + safeNumber(t.totalPrice), 0);
  const totalSellQty = sellTxs.reduce((sum, t) => sum + safeNumber(t.quantity), 0);
  const avgSellPrice = totalSellQty > 0 ? totalSellAmount / totalSellQty : 0;

  const realizedProfit = safeNumber(item.realizedProfit);
  const unrealizedProfit = safeNumber(item.unrealizedProfit);
  const totalProfit = safeNumber(item.totalProfit);
  const totalDividendAmt = safeNumber(totalDividend);

  // Capital Flow calculations
  const currentValue = safeNumber(item.marketValue);
  const totalOutflow = totalSellAmount + currentValue;
  const netReturn = totalOutflow - totalBuyAmount;

  const profitMeta = fmtSigned(totalProfit);
  const realizedMeta = fmtSigned(realizedProfit);
  const unrealizedMeta = fmtSigned(unrealizedProfit);
  const netReturnMeta = fmtSigned(netReturn);

  // Sorted Transactions with clean styling and zebra striping
  const sortedTxs = [...txs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const txRowsHtml =
    sortedTxs.length > 0
      ? sortedTxs
          .map((tx, idx) => {
            const isBuy = tx.type === "buy";
            const badgeBg = isBuy ? "#ecfdf5" : "#fef2f2";
            const badgeColor = isBuy ? "#047857" : "#b91c1c";
            const typeLabel = isBuy ? "خرید" : "فروش";
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#fbfcfd";

            return `
              <tr style="background-color: ${rowBg}; border-bottom: 1px solid #edf2f7;">
                <td style="padding: 9px 12px; color: #334155; width: 16%; font-weight: 600; font-size: 11px;">
                  ${toPersianDate(tx.date)}
                </td>
                <td style="padding: 9px 12px; width: 14%;">
                  <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-block;">
                    ${typeLabel}
                  </span>
                </td>
                <td style="padding: 9px 12px; color: #0f172a; width: 16%; font-weight: 700; font-size: 11.5px;">
                  ${nf.format(tx.quantity)} <span style="font-size: 10px; color: #64748b; font-weight: 400;">${asset.unit || ""}</span>
                </td>
                <td style="padding: 9px 12px; color: #0f172a; width: 18%; font-weight: 600; font-size: 11.5px; text-align: left; direction: ltr;">
                  ${fmt(tx.unitPrice)}
                </td>
                <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; width: 20%; font-size: 12px; text-align: left; direction: ltr;">
                  ${fmt(tx.totalPrice)}
                </td>
                <td style="padding: 9px 12px; color: #475569; width: 16%; font-size: 10.5px;">
                  ${tx.notes || "—"}
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748b; font-weight: 600;">هیچ معامله‌ای برای این دارایی ثبت نشده است.</td></tr>`;

  const htmlBody = `
    <div style="width: 1040px; padding: 34px 38px; background-color: #ffffff; color: #0f172a; direction: rtl; text-align: right; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 22px;">
        <div>
          <div style="font-size: 11px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 2px 8px; border-radius: 5px; font-weight: 700;">
              کارنامه جامع عملکرد دارایی
            </span>
            <span style="background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 5px; font-weight: 600;">
              ${categoryName}
            </span>
          </div>
          <h1 style="margin: 0 0 6px; font-size: 23px; color: #0f172a; font-weight: 800; line-height: 1.3;">
            ${asset.name}
          </h1>
          <div style="font-size: 11.5px; color: #64748b;">
            واحد سنجش: <b style="color: #0f172a;">${asset.unit || "واحد"}</b> · تاریخ صدور گزارش: <b style="color: #0f172a;">${dateStr}</b>
          </div>
        </div>

        <!-- Current Market Price Card -->
        <div style="text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px;">
            قیمت روز بازار (هر ${asset.unit || "واحد"})
          </div>
          <div style="font-size: 19px; font-weight: 900; color: #0284c7; direction: ltr;">
            ${money(currentPrice)}
          </div>
        </div>
      </div>

      <!-- Top 4 KPI Metrics -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #0f766e; border-radius: 12px; padding: 13px 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 5px;">ارزش جاری موجودی در سبد</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 3px; direction: ltr; text-align: right;">${money(item.marketValue)}</div>
          <div style="font-size: 10.5px; color: #64748b;">حجم موجود: <b style="color: #0f172a;">${nf.format(item.quantity)} ${asset.unit || ""}</b></div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #0284c7; border-radius: 12px; padding: 13px 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 5px;">آورده واقعی از جیب (بدون گردش مجدد)</div>
          <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-bottom: 3px; direction: ltr; text-align: right;">${money(item.freshCapital)}</div>
          <div style="font-size: 10.5px; color: #64748b;">بهای تمام‌شده موجودی فعلی: <b style="color: #0f172a;">${money(item.costBasis)}</b></div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid ${profitMeta.color}; border-radius: 12px; padding: 13px 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 5px;">مجموع سود / زیان کل</div>
          <div style="font-size: 18px; font-weight: 900; color: ${profitMeta.color}; margin-bottom: 3px; direction: ltr; text-align: right;">
            ${profitMeta.text} تومان
          </div>
          <div style="font-size: 10.5px; display: flex; align-items: center; gap: 5px;">
            <span style="font-weight: 700; color: ${profitMeta.color}; background: ${profitMeta.bg}; padding: 2px 7px; border-radius: 4px; display: inline-block;">
              بازده روی آورده: ${percent(item.capitalRoi)}
            </span>
            ${item.isRiskFree ? `<span style="font-size: 9.5px; font-weight: 800; background: #fef3c7; color: #92400e; padding: 2px 5px; border-radius: 4px;">ریسک‌فری</span>` : ""}
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3.5px solid #7c3aed; border-radius: 12px; padding: 13px 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 5px;">عایدی نقدشده و مجمع</div>
          <div style="font-size: 18px; font-weight: 900; color: ${fmtSigned(realizedProfit + totalDividendAmt).color}; margin-bottom: 3px; direction: ltr; text-align: right;">
            ${fmtSigned(realizedProfit + totalDividendAmt).text} تومان
          </div>
          <div style="font-size: 10.5px; color: #64748b;">سود مجمع DPS: <b style="color: #7c3aed;">${money(totalDividendAmt)}</b></div>
        </div>
      </div>

      <!-- 4 Pillars Section in 2x2 Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 26px;">
        <!-- Pillar 1: Buy Analysis -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 10px 16px; font-size: 12px; font-weight: 800; color: #065f46; display: flex; justify-content: space-between; align-items: center;">
            <span>🛒 ۱. تحلیل خریدها و سرمایه ورودی</span>
            <span style="font-size: 10.5px; font-weight: 600; color: #15803d;">${nf.format(buyTxs.length)} معامله</span>
          </div>
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">مجموع هزینه خریدها:</span>
              <b style="color: #0f172a; font-size: 12px; direction: ltr;">${money(totalBuyAmount)}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">حجم کل خریداری‌شده:</span>
              <b style="color: #0f172a;">${nf.format(totalBuyQty)} ${asset.unit || ""}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">میانگین بهای خرید:</span>
              <b style="color: #0f172a; direction: ltr;">${money(avgBuyPrice)}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">تعداد معاملات خرید:</span>
              <b style="color: #0f172a;">${nf.format(buyTxs.length)} تراکنش</b>
            </div>
          </div>
        </div>

        <!-- Pillar 2: Sell Analysis -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="background: #f0f9ff; border-bottom: 1px solid #bae6fd; padding: 10px 16px; font-size: 12px; font-weight: 800; color: #0369a1; display: flex; justify-content: space-between; align-items: center;">
            <span>💰 ۲. تحلیل فروش‌ها و سود نقدشده</span>
            <span style="font-size: 10.5px; font-weight: 600; color: #0284c7;">${nf.format(sellTxs.length)} معامله</span>
          </div>
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">مجموع مبلغ وصولی فروش:</span>
              <b style="color: #0f172a; font-size: 12px; direction: ltr;">
                ${totalSellAmount > 0 ? money(totalSellAmount) : "۰ تومان"}
              </b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">حجم کل فروخته‌شده:</span>
              <b style="color: #0f172a;">
                ${totalSellQty > 0 ? `${nf.format(totalSellQty)} ${asset.unit || ""}` : `۰ ${asset.unit || ""}`}
              </b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">میانگین بهای فروش:</span>
              <b style="color: #0f172a; direction: ltr;">
                ${avgSellPrice > 0 ? money(avgSellPrice) : `<span style="color: #94a3b8; font-weight: normal;">— (بدون فروش)</span>`}
              </b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">سود / زیان محقق‌شده:</span>
              <b style="color: ${realizedMeta.color}; direction: ltr;">
                ${realizedProfit !== 0 ? `${realizedMeta.text} تومان` : "۰ تومان"}
              </b>
            </div>
          </div>
        </div>

        <!-- Pillar 3: Position Status -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="background: #faf5ff; border-bottom: 1px solid #e9d5ff; padding: 10px 16px; font-size: 12px; font-weight: 800; color: #6b21a8;">
            📦 ۳. وضعیت موقعیت فعلی در سبد
          </div>
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">موجودی باقی‌مانده در سبد:</span>
              <b style="color: #0f172a;">${nf.format(item.quantity)} ${asset.unit || ""}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">بهای تمام‌شده موجودی:</span>
              <b style="color: #0f172a; direction: ltr;">${money(item.costBasis)}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">سود / زیان نامحقق (روی کاغذ):</span>
              <b style="color: ${unrealizedMeta.color}; direction: ltr;">
                ${unrealizedProfit !== 0 ? `${unrealizedMeta.text} تومان` : "۰ تومان"}
              </b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">سود نقدی مجمع (DPS):</span>
              <b style="color: #7c3aed; direction: ltr;">${money(totalDividendAmt)}</b>
            </div>
          </div>
        </div>

        <!-- Pillar 4: Capital Flow & Fresh Capital Balance -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 10px 16px; font-size: 12px; font-weight: 800; color: #92400e; display: flex; justify-content: space-between; align-items: center;">
            <span>⚖️ ۴. تراز سرمایه و آورده واقعی (بدون گردش مجدد)</span>
            ${item.isRiskFree ? `<span style="font-size: 10px; background: #fef3c7; color: #b45309; padding: 2px 7px; border-radius: 4px; font-weight: 800; border: 1px solid #fcd34d;">🛡️ پوزیشن بدون ریسک</span>` : ""}
          </div>
          <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <div>
                <span style="color: #64748b; display: block;">آورده اولیه واقعی از جیب:</span>
                <span style="font-size: 9.5px; color: #94a3b8;">حداکثر سرمایه درگیر (بدون احتساب گردش مجدد فروش‌ها)</span>
              </div>
              <b style="color: #0284c7; font-size: 12px; direction: ltr;">${money(item.freshCapital)}</b>
            </div>
            ${
              totalBuyAmount > item.freshCapital
                ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <div>
                <span style="color: #64748b; display: block;">گردش مجدد عایدی‌ها در خرید:</span>
                <span style="font-size: 9.5px; color: #94a3b8;">خرید انجام‌شده با پول حاصل از فروش‌های قبلی</span>
              </div>
              <b style="color: #4f46e5; direction: ltr;">${money(totalBuyAmount - item.freshCapital)}</b>
            </div>
            `
                : ""
            }
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">کل عایدی حاصله (فروش + ارزش روز):</span>
              <b style="color: #0f172a; direction: ltr;">${money(totalOutflow)}</b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
              <span style="color: #64748b;">سود کل به نسبت آورده واقعی:</span>
              <b style="color: ${profitMeta.color}; font-size: 12px; direction: ltr;">
                ${profitMeta.text} تومان (${percent(item.capitalRoi)})
              </b>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b;">وضعیت ریسک اصل سرمایه:</span>
              <span style="padding: 2px 8px; border-radius: 5px; font-weight: 800; font-size: 10.5px; background: ${item.isRiskFree ? "#ecfdf5" : netReturnMeta.bg}; color: ${item.isRiskFree ? "#047857" : netReturnMeta.color};">
                ${item.isRiskFree ? "اصل سرمایه اولیه کاملاً نقد شده (ریسک صفر)" : netReturn > 0 ? "سودده و افزایشی" : netReturn < 0 ? "زیان‌ده" : "سربه‌سر"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History Table -->
      <div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 11px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; border-right: 4px solid #0f766e; padding-right: 10px;">
            ریز تاریخچه معاملات ثبت‌شده (${nf.format(txs.length)} معامله)
          </h3>
          <span style="font-size: 10.5px; color: #64748b;">کلیه مبالغ به تومان محاسبه شده است</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: #ffffff; table-layout: fixed;">
          <thead>
            <tr style="background: #f8fafc; color: #334155; border-bottom: 1.5px solid #cbd5e1;">
              <th style="padding: 9px 12px; text-align: right; width: 16%;">تاریخ</th>
              <th style="padding: 9px 12px; text-align: right; width: 14%;">نوع معامله</th>
              <th style="padding: 9px 12px; text-align: right; width: 16%;">حجم</th>
              <th style="padding: 9px 12px; text-align: left; width: 18%;">قیمت واحد (تومان)</th>
              <th style="padding: 9px 12px; text-align: left; width: 20%;">مبلغ کل (تومان)</th>
              <th style="padding: 9px 12px; text-align: right; width: 16%;">کارگزاری / یادداشت</th>
            </tr>
          </thead>
          <tbody>
            ${txRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top: 18px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748b;">
        <span>کارنامه اختصاصی دارایی در سامانه پورتفوی دارا · نگهداری و پردازش ۱۰۰٪ آفلاین</span>
        <span>تاریخ تهیه: ${dateStr}</span>
      </div>
    </div>
  `;

  const safeSymbol = (asset.name || "asset").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
  const fileName = `dara-asset-card-${safeSymbol}-${todayIso()}.pdf`;
  return await renderHtmlToPdf(htmlBody, fileName);
}
