import * as XLSX from "xlsx";
import { normalizeSymbol, toEnglishDigits } from "./portfolio";

export interface StockPortfolioPricePreview {
  // Prices are per share in toman, ready for the existing stock-price history.
  prices: Array<{ symbol: string; price: number }>;
  unmatchedSymbols: string[];
  invalidPrices: string[];
  duplicateSymbols: string[];
  missingSymbols: string[];
}

function headerKey(value: unknown): string {
  return normalizeSymbol(value).replace(/[\u200c-\u200f\ufeff]/g, "");
}

function rialPrice(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = typeof value === "number" ? String(value) : toEnglishDigits(value)
    .trim()
    .replace(/[\s,٬،]/g, "")
    .replace(/٫/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const price = Number(text);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Read the portfolio export's exact «آخرین قیمت» column (rial), not «قیمت پایانی»
 * or «درصد آخرین قیمت». Only held symbols are returned; no orders or balances
 * are imported. The file's last-transaction date is NOT a market quote date.
 */
export function parseStockPortfolioPrices(buffer: ArrayBuffer, heldSymbols: string[]): StockPortfolioPricePreview {
  if (!buffer.byteLength) throw new Error("فایل اکسل خالی است.");

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  } catch {
    throw new Error("فایل اکسل قابل خواندن نیست. فایل خروجی پورتفو را انتخاب کنید.");
  }

  const held = new Map<string, string>();
  for (const symbol of heldSymbols) {
    const key = normalizeSymbol(symbol);
    if (key && !held.has(key)) held.set(key, symbol);
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1, defval: "", raw: true, blankrows: true,
    });
    // Keep blank rows so the row numbers in the preview refer to real Excel rows.
    const firstRow = XLSX.utils.decode_range(sheet["!ref"] || "A1").s.r + 1;
    let inspected = 0;
    for (let headerIndex = 0; headerIndex < rows.length && inspected < 10; headerIndex++) {
      const headers = rows[headerIndex].map(headerKey);
      if (!headers.some(Boolean)) continue;
      inspected++;
      const symbolColumns = headers.flatMap((key, i) => key === "نامنماد" ? [i] : []);
      const priceColumns = headers.flatMap((key, i) => key === "آخرینقیمت" ? [i] : []);
      if (!symbolColumns.length || !priceColumns.length) continue;
      if (symbolColumns.length !== 1 || priceColumns.length !== 1) {
        throw new Error("ستون «نام نماد» یا «آخرین قیمت» در فایل تکراری است.");
      }

      const symbolCol = symbolColumns[0];
      const priceCol = priceColumns[0];
      const pricesBySymbol = new Map<string, number>();
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      const unmatched = new Map<string, string>();
      const invalid: string[] = [];

      for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const rawSymbol = String(row[symbolCol] ?? "").trim();
        const rawPrice = row[priceCol];
        if (!rawSymbol && (rawPrice === "" || rawPrice === null || rawPrice === undefined)) continue;
        const key = normalizeSymbol(rawSymbol);
        if (!key) {
          invalid.push(`ردیف ${firstRow + i}: نام نماد خالی`);
          continue;
        }
        const symbol = held.get(key);
        if (!symbol) {
          unmatched.set(key, rawSymbol);
          continue;
        }
        if (seen.has(key)) {
          duplicates.add(symbol);
          pricesBySymbol.delete(key); // ambiguous: never choose a row arbitrarily
          continue;
        }
        seen.add(key);
        const price = rialPrice(rawPrice);
        if (price === null) {
          invalid.push(`${symbol} (ردیف ${firstRow + i})`);
          continue;
        }
        pricesBySymbol.set(key, price / 10); // exported rial -> app's toman
      }

      const prices = Array.from(held, ([key, symbol]) => ({ symbol, price: pricesBySymbol.get(key) }))
        .filter((item): item is { symbol: string; price: number } => item.price !== undefined);
      return {
        prices,
        unmatchedSymbols: [...unmatched.values()],
        invalidPrices: invalid,
        duplicateSymbols: [...duplicates],
        missingSymbols: [...held].filter(([key]) => !pricesBySymbol.has(key)).map(([, symbol]) => symbol),
      };
    }
  }

  throw new Error("ستون‌های «نام نماد» و «آخرین قیمت» در فایل پیدا نشد. فایل خروجی پورتفو را انتخاب کنید.");
}
