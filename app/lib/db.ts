"use client";

import type { PortfolioData } from "./types";
import { sanitizeTransactionDayOrder } from "./transactionDayOrder";

const LOCAL_STORAGE_KEY = "dara_portfolio_state_v4";

let memoryCache: PortfolioData | null = null;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function sanitizePortfolioData(data: unknown): PortfolioData | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Partial<PortfolioData>;

  if (!Array.isArray(raw.assets)) return null;

  return {
    version: 1,
    assets: Array.isArray(raw.assets)
      ? raw.assets
          .filter((a: any) => a && typeof a === "object")
          .map((a: any, idx: number) => ({
            ...a,
            id: String(a.id || `asset-${idx}`),
            name: String(a.name || `دارایی ${idx + 1}`),
            type: a.type || "other",
            currentPrice: Number(a.currentPrice) || 0,
            currency: a.currency || "IRR",
            color: a.color || "#137769",
          }))
      : [],
    transactions: Array.isArray(raw.transactions)
      ? raw.transactions
          .filter((tx: any) => tx && typeof tx === "object")
          .map((tx: any, idx: number) => ({
            ...tx,
            id: String(tx.id || `tx-${idx}`),
            assetId: String(tx.assetId || ""),
            type: tx.type === "sell" ? "sell" : "buy",
            quantity: Number(tx.quantity) || 0,
            unitPrice: Number(tx.unitPrice) || 0,
            totalPrice: Number(tx.totalPrice) || 0,
            createdAt: tx.createdAt || tx.date || new Date().toISOString(),
            date: tx.date || new Date().toISOString().slice(0, 10),
            attachmentIds: Array.isArray(tx.attachmentIds) ? tx.attachmentIds : [],
          }))
      : [],
    // Quote order is significant: the last entry/edit for a given date wins.
    // Do not sort or deduplicate when loading a local state or JSON backup.
    prices: Array.isArray(raw.prices)
      ? raw.prices
          .filter((p: any) => p && typeof p === "object")
          .map((p: any) => ({
            ...p,
            id: String(p.id || ""),
            assetId: String(p.assetId || ""),
            price: Number(p.price) || 0,
            date: String(p.date || ""),
          }))
      : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    stockOrders: Array.isArray(raw.stockOrders)
      ? raw.stockOrders
          .filter((o: any) => o && typeof o === "object")
          .map((o: any) => ({
            ...o,
            symbol: String(o.symbol || ""),
            // An absent time is unknown, not a midnight trade. Reordering never fabricates one.
            time: typeof o.time === "string" && o.time.trim() ? o.time : undefined,
            quantity: Number(o.quantity) || 0,
            unitPrice: Number(o.unitPrice) || 0,
            totalPrice: Number(o.totalPrice) || 0,
            date: String(o.date || ""),
            type: o.type === "sell" ? "sell" : "buy",
          }))
      : [],
    stockPrices: Array.isArray(raw.stockPrices)
      ? raw.stockPrices
          .filter((sp: any) => sp && typeof sp === "object")
          .map((sp: any) => ({
            ...sp,
            symbol: String(sp.symbol || ""),
            price: Number(sp.price) || 0,
            date: String(sp.date || ""),
          }))
      : [],
    stockDividends: Array.isArray(raw.stockDividends) ? raw.stockDividends : [],
    settings: {
      seeded: Boolean(raw.settings?.seeded),
      sampleCleared: Boolean(raw.settings?.sampleCleared),
      currency: "تومان",
      cashFundsMigrated: Boolean(raw.settings?.cashFundsMigrated),
      hamiStatementLedgerMigrated: Boolean(raw.settings?.hamiStatementLedgerMigrated),
      bankClearingHidden: Boolean(raw.settings?.bankClearingHidden),
      kianStockMigrated: Boolean(raw.settings?.kianStockMigrated),
      transactionDayOrder: sanitizeTransactionDayOrder(raw.settings?.transactionDayOrder),
    },
  };
}

export function getFromLocalStorage(): PortfolioData | null {
  if (memoryCache) return memoryCache;
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sanitized = sanitizePortfolioData(parsed);
    if (sanitized) {
      memoryCache = sanitized;
      return sanitized;
    }
  } catch (err) {
    console.warn("Could not read from localStorage:", err);
  }
  return null;
}

export function saveToLocalStorage(data: PortfolioData): void {
  const sanitized = sanitizePortfolioData(data);
  if (!sanitized) return;
  memoryCache = sanitized;
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn("Could not write to localStorage:", err);
  }
}

export async function loadData(): Promise<PortfolioData | null> {
  const local = getFromLocalStorage();
  return local;
}

export async function saveData(data: PortfolioData): Promise<void> {
  saveToLocalStorage(data);
}

export async function estimateStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}
