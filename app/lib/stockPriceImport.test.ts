import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { appendStockPrices } from "./priceHistory";
import { emptyData, latestStockPrice, todayIso } from "./portfolio";
import { parseStockPortfolioPrices } from "./stockPriceImport";

function workbook(rows: unknown[][], preamble?: unknown[][]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  if (preamble) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(preamble), "توضیحات");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "پرتفو");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

test("uses only the exact last-price column, converts rial to toman and matches held symbols", () => {
  const file = workbook([
    ["نام نماد", "تاریخ آخرین تراکنش و رویداد", "تعداد دارایی", "", "", "ارزش فعلی", "آخرین قیمت", "درصد آخرین قیمت", "قیمت پایانی"],
    ["ومعادن", "1400/01/01", 2, "", "", 10000, 4290, 9, 4320],
    ["كروى", "1400/01/01", 1, "", "", 10000, "۱۲٬۳۴۵٫۰", 3, 13000],
    ["فروخته", "1400/01/01", 0, "", "", 0, 2500, 2, 2600],
  ]);
  const preview = parseStockPortfolioPrices(file, ["ومعادن", "کروی", "غایب"]);
  assert.deepEqual(preview.prices, [
    { symbol: "ومعادن", price: 429 },
    { symbol: "کروی", price: 1234.5 },
  ]);
  assert.deepEqual(preview.unmatchedSymbols, ["فروخته"]);
  assert.deepEqual(preview.missingSymbols, ["غایب"]);
  assert.deepEqual(preview.invalidPrices, []);
  assert.deepEqual(preview.duplicateSymbols, []);

  const data = { ...emptyData(), stockOrders: [{
    id: "trade", symbol: "ومعادن", date: todayIso(), type: "buy" as const,
    quantity: 2, unitPrice: 100, totalPrice: 200,
  }], stockPrices: [{ id: "old", symbol: "ومعادن", price: 400, date: todayIso() }] };
  const saved = appendStockPrices(data, preview.prices.map((item, i) => ({
    ...item, id: `file-${i}`, date: todayIso(),
  })));
  assert.equal(saved.stockOrders, data.stockOrders, "importing prices must not change trades");
  assert.equal(saved.transactions, data.transactions, "importing prices must not change balances");
  assert.equal(saved.stockPrices.length, 3);
  assert.equal(latestStockPrice(saved.stockPrices, "ومعادن")?.price, 429);
  assert.equal(saved.stockPrices[0].price, 400, "previous price history must remain available");
});

test("skips bad, unrelated and ambiguous rows instead of registering arbitrary prices", () => {
  const preview = parseStockPortfolioPrices(workbook([
    ["نام نماد", "آخرین قیمت"],
    ["الف", 4290],
    [" الف ", 4300],
    ["ب", 0],
    ["ج", "توقف"],
    ["د", -100],
    ["غیرمرتبط", 8000],
    ["", 3400],
  ]), ["الف", "ب", "ج", "د", "ه"]);
  assert.deepEqual(preview.prices, []);
  assert.deepEqual(preview.duplicateSymbols, ["الف"]);
  assert.deepEqual(preview.unmatchedSymbols, ["غیرمرتبط"]);
  assert.deepEqual(preview.invalidPrices, ["ب (ردیف 4)", "ج (ردیف 5)", "د (ردیف 6)", "ردیف 8: نام نماد خالی"]);
  assert.deepEqual(preview.missingSymbols, ["الف", "ب", "ج", "د", "ه"]);
});

test("accepts a later sheet and headers below an introduction, without assuming column positions", () => {
  const preview = parseStockPortfolioPrices(workbook([
    ["گزارش پرتفوی"],
    ["آخرین قیمت", "نام نماد", "قیمت پایانی"],
    ["2,500", "فولاد", 9999],
  ], [["این صفحه گزارش نیست"]]), ["فولاد"]);
  assert.deepEqual(preview.prices, [{ symbol: "فولاد", price: 250 }]);
});

test("reports the actual spreadsheet row number even when there are blank rows", () => {
  const preview = parseStockPortfolioPrices(workbook([
    [], [],
    ["نام نماد", "آخرین قیمت"],
    [],
    ["الف", "نامعتبر"],
  ]), ["الف"]);
  assert.deepEqual(preview.invalidPrices, ["الف (ردیف 5)"]);
});

test("rejects wrong or ambiguous headers, empty and unreadable exports", () => {
  assert.throws(() => parseStockPortfolioPrices(workbook([
    ["نام نماد", "درصد آخرین قیمت", " قیمت پایانی"], ["الف", 100, 150],
  ]), ["الف"]), /آخرین قیمت/);
  assert.throws(() => parseStockPortfolioPrices(workbook([
    ["نام نماد", "آخرین قیمت", "آخرین قیمت"], ["الف", 100, 150],
  ]), ["الف"]), /تکراری/);
  assert.throws(() => parseStockPortfolioPrices(new ArrayBuffer(0), ["الف"]), /خالی/);
  assert.throws(() => parseStockPortfolioPrices(new TextEncoder().encode("not an Excel export").buffer, ["الف"]), /پیدا نشد|خواندن نیست/);
});
