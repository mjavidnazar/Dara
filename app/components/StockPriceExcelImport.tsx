"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { nf, normalizeSymbol, todayIso, toPersianDate, uid, validIsoDate } from "../lib/portfolio";
import { parseStockPortfolioPrices } from "../lib/stockPriceImport";
import type { StockPortfolioPricePreview } from "../lib/stockPriceImport";
import type { StockPrice } from "../lib/types";

function listSymbols(symbols: string[]) {
  const shown = symbols.slice(0, 8).join("، ");
  return symbols.length > 8 ? `${shown} و ${nf.format(symbols.length - 8)} مورد دیگر` : shown;
}

export function StockPriceExcelImport({ symbols, date, onSavePrices }: {
  symbols: string[];
  date: string;
  onSavePrices: (updates: StockPrice[]) => void;
}) {
  const activeKey = [...new Set(symbols.map(normalizeSymbol))].sort().join("|");
  const [selection, setSelection] = useState<{
    name: string; activeKey: string; preview: StockPortfolioPricePreview;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const preview = selection?.preview;
  const unchangedPortfolio = selection?.activeKey === activeKey;
  const validDate = validIsoDate(date) && date <= todayIso();
  const canSave = Boolean(preview?.prices.length && unchangedPortfolio && validDate && !loading);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = ""; // allow choosing the same file again after an error
    if (!file) return;
    setSelection(null);
    setError("");
    if (!/\.xlsx?$/i.test(file.name)) {
      setError("فقط فایل اکسل خروجی پورتفو با پسوند xlsx یا xls را انتخاب کنید.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("حجم فایل اکسل باید کمتر از ۱۰ مگابایت باشد.");
      return;
    }
    setLoading(true);
    try {
      const result = parseStockPortfolioPrices(await file.arrayBuffer(), symbols);
      setSelection({ name: file.name, activeKey, preview: result });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خواندن فایل اکسل با خطا روبه‌رو شد.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!selection || !canSave) return;
    onSavePrices(selection.preview.prices.map(({ symbol, price }) => ({
      id: uid("sp-file"), symbol, price, date,
    })));
    setSelection(null);
  };

  return (
    <section className="stock-price-import" aria-label="ورود قیمت سهام از اکسل پرتفوی">
      <h4>ورود قیمت از اکسل پرتفوی</h4>
      <p>فایل خروجی پرتفوی را انتخاب کنید. فقط ستون «آخرین قیمت» خوانده می‌شود؛ مبلغ ریالی به تومان تبدیل و فقط برای نمادهای دارای موجودی در دارا ثبت می‌شود.</p>
      <label className={`file-drop${loading || !symbols.length ? " disabled" : ""}`}>
        <FileUp size={22} aria-hidden="true" />
        <span>
          <b>انتخاب فایل اکسل پرتفوی (.xlsx یا .xls)</b>
          <small>فایل فقط در مرورگر شما خوانده می‌شود؛ ورود معاملات بورس نیست.</small>
        </span>
        <input type="file" accept=".xlsx,.xls" aria-label="انتخاب فایل اکسل پرتفوی برای قیمت سهام" disabled={loading || !symbols.length} onChange={handleFileChange} />
      </label>
      {!symbols.length && <small className="negative-text">برای ورود قیمت، ابتدا یک نماد دارای موجودی ثبت کنید.</small>}
      {loading && <small role="status"><Loader2 size={14} className="spin" /> در حال خواندن فایل…</small>}
      {error && <small role="alert" className="negative-text">{error}</small>}
      {selection && preview && (
        <div className="stock-price-preview">
          <p role="status"><b>{selection.name}</b> — {nf.format(preview.prices.length)} نماد آمادهٔ ثبت با قیمت «آخرین قیمت» (تومان)</p>
          {preview.prices.length > 0 ? (
            <div className="stock-price-preview-list" aria-label="پیش‌نمایش قیمت‌های قابل ثبت">
              {preview.prices.map(({ symbol, price }) => (
                <div key={symbol}><b>{symbol}</b><span>{nf.format(price)} تومان</span></div>
              ))}
            </div>
          ) : <small className="negative-text">قیمت معتبری برای نمادهای دارای موجودی در این فایل پیدا نشد؛ هیچ قیمتی ثبت نمی‌شود.</small>}
          {preview.unmatchedSymbols.length > 0 && <small>نمادهای فایل که در موجودی فعلی نیستند و نادیده گرفته می‌شوند ({nf.format(preview.unmatchedSymbols.length)}): {listSymbols(preview.unmatchedSymbols)}</small>}
          {preview.invalidPrices.length > 0 && <small className="negative-text">ردیف‌های بدون نماد یا با قیمت نامعتبر و نادیده‌گرفته‌شده ({nf.format(preview.invalidPrices.length)}): {listSymbols(preview.invalidPrices)}</small>}
          {preview.duplicateSymbols.length > 0 && <small className="negative-text">نمادهای تکراری با قیمت مبهم (ثبت نمی‌شوند): {listSymbols(preview.duplicateSymbols)}</small>}
          {preview.missingSymbols.length > 0 && <small>نمادهای موجود بدون قیمت قابل ثبت ({nf.format(preview.missingSymbols.length)}): {listSymbols(preview.missingSymbols)}</small>}
          {!unchangedPortfolio && <small className="negative-text">موجودی نمادها پس از انتخاب فایل تغییر کرده است؛ فایل را دوباره انتخاب کنید.</small>}
          <button type="button" className="button primary" disabled={!canSave} onClick={save}>
            ثبت {nf.format(preview.prices.length)} قیمت از فایل برای {validDate ? toPersianDate(date) : "تاریخ معتبر"}
          </button>
        </div>
      )}
    </section>
  );
}
