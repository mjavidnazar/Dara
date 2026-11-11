import { toGregorian } from "jalaali-js";
import * as XLSX from "xlsx";
import type {
  Asset,
  DepositCertCashTransferItem,
  DepositCertImportResult,
  DepositCertStorageFeeItem,
  DepositCertTradeItem,
  Transaction,
} from "./types";
import { safeNumber, uid } from "./portfolio";

/**
 * Converts a Jalali date string (e.g. "1405/06/21" or "1405-06-21") to an ISO Gregorian date string ("2026-09-12")
 */
export function jalaliToIso(jalaliStr: string): string {
  if (!jalaliStr) return new Date().toISOString().slice(0, 10);
  const clean = String(jalaliStr).trim().replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  const parts = clean.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!parts) return new Date().toISOString().slice(0, 10);
  const [, y, m, d] = parts;
  try {
    const g = toGregorian(Number(y), Number(m), Number(d));
    return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Decodes a raw ArrayBuffer or string into text with proper encoding handling (UTF-16LE, UTF-16BE, UTF-8)
 */
export function decodeFileBuffer(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  if (uint8.length >= 2 && uint8[0] === 0xff && uint8[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (uint8.length >= 2 && uint8[0] === 0xfe && uint8[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  return new TextDecoder("utf-8").decode(buffer);
}

/**
 * Checks if raw text is an HTML table (common for Iranian brokerage .xls exports)
 */
export function isHtmlTable(text: string): boolean {
  return /<table[\s\S]*?>/i.test(text);
}

/**
 * Parses an HTML table string into rows of string arrays
 */
export function parseHtmlTable(html: string): string[][] {
  const rowRegex = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const rows: string[][] = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip any inner HTML tags and entities
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

/**
 * Checks if the file/rows match the Commodity Deposit Certificate Statement format
 */
export function isCommodityDepositStatement(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const header = rows[0].join(" ");
  const content = rows.slice(1, 10).map((r) => r.join(" ")).join(" ");
  const combined = header + " " + content;

  return (
    (header.includes("رديف") || header.includes("ردیف")) &&
    (header.includes("تاريخ") || header.includes("تاریخ")) &&
    (header.includes("شماره سند") || header.includes("سند")) &&
    (header.includes("شرح") || header.includes("بدهکار")) &&
    (combined.includes("TrdVal") ||
      combined.includes("انبارداري") ||
      combined.includes("انبارداری") ||
      combined.includes("گواهی سپرده") ||
      combined.includes("بورس کالا") ||
      combined.includes("ZincIngot") ||
      combined.includes("CopperCthd") ||
      combined.includes("SteelRebar"))
  );
}

/**
 * Matches a commodity symbol to an asset in the user's portfolio
 */
export function matchSymbolToAsset(rawSymbol: string, assets: Asset[]): Asset | undefined {
  if (!rawSymbol) return undefined;
  const symNorm = rawSymbol.toLowerCase().trim();

  // 1. Direct depositSymbol match
  const directMatch = assets.find((a) => {
    if (!a.depositSymbol) return false;
    const ds = a.depositSymbol.toLowerCase().trim();
    return symNorm.includes(ds) || ds.includes(symNorm);
  });
  if (directMatch) return directMatch;

  // 2. Known standard commodity certificate symbols
  // Zinc / روی
  if (symNorm.includes("zinc") || symNorm.includes("شمش روی") || symNorm.includes("روی")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("zinc") ||
        a.name.includes("روی") ||
        a.category.includes("روی")
    );
    if (asset) return asset;
  }

  // Copper / مس
  if (symNorm.includes("copper") || symNorm.includes("مس کاتد") || symNorm.includes("مس")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("copper") ||
        a.name.includes("مس") ||
        a.category.includes("مس")
    );
    if (asset) return asset;
  }

  // Steel Rebar / میلگرد
  if (symNorm.includes("rebar") || symNorm.includes("steel") || symNorm.includes("میلگرد")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("rebar") ||
        a.name.includes("میلگرد") ||
        a.category.includes("میلگرد")
    );
    if (asset) return asset;
  }

  // Gold / طلا
  if (symNorm.includes("gold") || symNorm.includes("شمش طلا") || symNorm.includes("طلا")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("gold") ||
        a.name.includes("طلا") ||
        a.category.includes("طلا")
    );
    if (asset) return asset;
  }

  // Saffron / زعفران
  if (symNorm.includes("saffron") || symNorm.includes("زعفران")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("saffron") ||
        a.name.includes("زعفران") ||
        a.category.includes("زعفران")
    );
    if (asset) return asset;
  }

  // Coin / سکه
  if (symNorm.includes("coin") || symNorm.includes("سکه")) {
    const asset = assets.find(
      (a) =>
        a.depositSymbol?.toLowerCase().includes("coin") ||
        a.name.includes("سکه") ||
        a.category.includes("سکه")
    );
    if (asset) return asset;
  }

  // 3. Fallback: match by asset name or symbol
  return assets.find((a) => {
    const name = a.name.trim().toLowerCase();
    return name && (symNorm.includes(name) || name.includes(symNorm));
  });
}

/**
 * Main parser function for Commodity Certificate statements
 */
export function parseCommodityStatement(
  buffer: ArrayBuffer,
  assets: Asset[],
  existingTransactions: Transaction[]
): DepositCertImportResult | null {
  const decodedText = decodeFileBuffer(buffer);
  let rows: string[][] = [];

  if (isHtmlTable(decodedText)) {
    rows = parseHtmlTable(decodedText);
  } else {
    try {
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    } catch {
      // Fallback: try parsing as text
      rows = parseHtmlTable(decodedText);
    }
  }

  if (rows.length < 2 || !isCommodityDepositStatement(rows)) {
    return null;
  }

  // Map header indexes
  const header = rows[0].map((c) => c.trim());
  const idxDate = header.findIndex((c) => c.includes("تاريخ") || c.includes("تاریخ"));
  const idxTime = header.findIndex((c) => c.includes("زمان"));
  const idxDoc = header.findIndex((c) => c.includes("شماره سند") || c.includes("سند"));
  const idxName = header.findIndex((c) => c.includes("نام مشتري") || c.includes("مشتری"));
  const idxNatCode = header.findIndex((c) => c.includes("NationalCode") || c.includes("کد ملی"));
  const idxSymbol = header.findIndex((c) => c.includes("نماد"));
  const idxDesc = header.findIndex((c) => c.includes("شرح"));
  const idxDebit = header.findIndex((c) => c.includes("بدهکار"));
  const idxCredit = header.findIndex((c) => c.includes("بستانکار"));

  const accountName = idxName !== -1 ? rows[1]?.[idxName] : undefined;
  const nationalCode = idxNatCode !== -1 ? rows[1]?.[idxNatCode] : undefined;

  interface RawTrade {
    date: string;
    jalaliDate: string;
    time: string;
    docNo: string;
    symbol: string;
    type: "buy" | "sell";
    grossRial: number;
    commRial: number;
    fees: Record<string, number>;
  }

  const rawTrades: RawTrade[] = [];
  const rawStorage: Array<{ date: string; jalaliDate: string; symbol: string; docNo: string; amountRial: number }> = [];
  const rawCash: Array<{ date: string; jalaliDate: string; direction: "deposit" | "withdraw"; amountRial: number; docNo: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const desc = (r[idxDesc] || "").trim();
    const jalaliDate = (r[idxDate] || "").trim();
    const dateIso = jalaliToIso(jalaliDate);
    const time = idxTime !== -1 ? (r[idxTime] || "").trim() : "";
    const docNo = idxDoc !== -1 ? (r[idxDoc] || "").trim() : "";
    const symbol = idxSymbol !== -1 ? (r[idxSymbol] || "").trim() : "";
    const debitRial = safeNumber(r[idxDebit]);
    const creditRial = safeNumber(r[idxCredit]);

    if (desc === "TrdVal") {
      const isBuy = debitRial > 0;
      const grossRial = isBuy ? debitRial : creditRial;

      // Scan subsequent commission rows associated with this trade
      const fees: Record<string, number> = {};
      let commRial = 0;
      let j = i + 1;
      while (
        j < rows.length &&
        rows[j][idxDesc] !== "TrdVal" &&
        !rows[j][idxDesc]?.includes("انبار") &&
        !rows[j][idxDesc]?.includes("واريز") &&
        !rows[j][idxDesc]?.includes("واریز")
      ) {
        const d = safeNumber(rows[j][idxDebit]);
        if (d > 0) {
          commRial += d;
          const feeName = (rows[j][idxDesc] || "کارمزد").replace(" جهت انجام معامله", "").trim();
          fees[feeName] = (fees[feeName] || 0) + d;
        }
        j++;
      }

      rawTrades.push({
        date: dateIso,
        jalaliDate,
        time,
        docNo,
        symbol,
        type: isBuy ? "buy" : "sell",
        grossRial,
        commRial,
        fees,
      });
    } else if (desc.includes("انبار")) {
      rawStorage.push({
        date: dateIso,
        jalaliDate,
        symbol,
        docNo,
        amountRial: debitRial,
      });
    } else if (desc.includes("واريز") || desc.includes("واریز")) {
      rawCash.push({
        date: dateIso,
        jalaliDate,
        direction: creditRial > 0 ? "deposit" : "withdraw",
        amountRial: creditRial || debitRial,
        docNo,
      });
    }
  }

  // Group raw trades by (date + symbol + type)
  const groupMap = new Map<
    string,
    {
      date: string;
      jalaliDate: string;
      symbol: string;
      type: "buy" | "sell";
      grossRial: number;
      commRial: number;
      docNos: string[];
      count: number;
      fees: Record<string, number>;
    }
  >();

  for (const t of rawTrades) {
    const key = `${t.date}|${t.symbol}|${t.type}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: t.date,
        jalaliDate: t.jalaliDate,
        symbol: t.symbol,
        type: t.type,
        grossRial: 0,
        commRial: 0,
        docNos: [],
        count: 0,
        fees: {},
      });
    }
    const g = groupMap.get(key)!;
    g.grossRial += t.grossRial;
    g.commRial += t.commRial;
    g.docNos.push(t.docNo);
    g.count++;
    for (const [fName, fRial] of Object.entries(t.fees)) {
      g.fees[fName] = (g.fees[fName] || 0) + fRial;
    }
  }

  // Construct trade items
  const tradeItems: DepositCertTradeItem[] = [];
  for (const g of groupMap.values()) {
    const grossToman = g.grossRial / 10;
    const commToman = g.commRial / 10;
    const netToman = g.type === "buy" ? grossToman + commToman : grossToman - commToman;
    const matchedAsset = matchSymbolToAsset(g.symbol, assets);

    // Build fee breakdown in Toman
    const feeBreakdown: Record<string, number> = {};
    for (const [fName, fRial] of Object.entries(g.fees)) {
      feeBreakdown[fName] = Math.round(fRial / 10);
    }

    // Estimate initial quantity
    let initialQty = 1;
    let initialUnitPrice = Math.round(netToman);
    if (matchedAsset && matchedAsset.currentPrice > 0) {
      initialQty = Math.max(1, Math.round(netToman / matchedAsset.currentPrice));
      initialUnitPrice = Math.round(netToman / initialQty);
    }

    // Check if this trade is already present in existingTransactions
    const sourceKey = `deposit-trade|${g.date}|${g.type}|${g.symbol}|${Math.round(netToman)}`;
    const isDuplicate = existingTransactions.some((tx) => {
      // 1. Check notes for sourceKey or doc numbers
      if (tx.notes?.includes(sourceKey)) return true;
      if (g.docNos.some((doc) => doc && tx.notes?.includes(doc))) return true;

      // 2. Check matching date + type + matched asset/notes + close price
      const isAssetMatch =
        (matchedAsset && tx.assetId === matchedAsset.id) ||
        (matchedAsset && tx.notes?.includes(matchedAsset.name));

      if (isAssetMatch && tx.type === g.type && tx.date === g.date) {
        const diff = Math.abs(tx.totalPrice - netToman);
        if (diff < 5000 || diff / (netToman || 1) < 0.005 || Math.abs(tx.quantity - initialQty) === 0) {
          return true;
        }
      }
      return false;
    });

    tradeItems.push({
      id: uid("dep-trade"),
      date: g.date,
      jalaliDate: g.jalaliDate,
      symbol: g.symbol,
      type: g.type,
      grossAmount: Math.round(grossToman),
      commission: Math.round(commToman),
      netAmount: Math.round(netToman),
      quantity: initialQty,
      unitPrice: initialUnitPrice,
      assetId: matchedAsset?.id,
      assetName: matchedAsset?.name,
      status: isDuplicate ? "duplicate" : "new",
      sourceKey,
      selected: !isDuplicate,
      tradesCount: g.count,
      individualDocNos: g.docNos,
      feeBreakdown,
    });
  }

  // Construct storage fee items
  const storageItems: DepositCertStorageFeeItem[] = [];
  for (const s of rawStorage) {
    const amountToman = Math.round(s.amountRial / 10);
    const matchedAsset = matchSymbolToAsset(s.symbol, assets);
    const sourceKey = `deposit-storage|${s.date}|${s.symbol}|${amountToman}`;

    const isDuplicate = existingTransactions.some((tx) => {
      if (tx.notes?.includes(sourceKey) || (s.docNo && tx.notes?.includes(s.docNo))) return true;
      if (
        matchedAsset &&
        tx.assetId === matchedAsset.id &&
        tx.date === s.date &&
        Math.abs(tx.totalPrice - amountToman) < 100
      ) {
        return true;
      }
      return false;
    });

    storageItems.push({
      id: uid("dep-storage"),
      date: s.date,
      jalaliDate: s.jalaliDate,
      symbol: s.symbol,
      amount: amountToman,
      docNo: s.docNo,
      assetId: matchedAsset?.id,
      assetName: matchedAsset?.name,
      status: isDuplicate ? "duplicate" : "new",
      selected: !isDuplicate,
      applyAs: "cost_basis",
    });
  }

  // Construct cash transfer items
  const cashItems: DepositCertCashTransferItem[] = rawCash.map((c) => ({
    id: uid("dep-cash"),
    date: c.date,
    jalaliDate: c.jalaliDate,
    direction: c.direction,
    amount: Math.round(c.amountRial / 10),
    docNo: c.docNo,
    selected: false, // by default unselected unless user wishes to track
  }));

  return {
    trades: tradeItems,
    storageFees: storageItems,
    cashTransfers: cashItems,
    accountName,
    nationalCode,
  };
}
