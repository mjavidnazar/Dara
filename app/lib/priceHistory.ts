import { assetMode, latestAssetPrice, todayIso } from "./portfolio";
import type { PortfolioData, PriceHistory, StockPrice } from "./types";

// Array order is the persisted entry/edit order for quotes on the same date.
// Keep every older record, but move an edited record to the end so it wins its
// day's tie. Do not infer an edit time from a quote's date or legacy ID.
function moveEditedToEnd<T extends { id: string }>(history: T[], edited: T): T[] {
  const index = history.findIndex((entry) => entry.id === edited.id);
  if (index < 0 || history.some((entry, i) => i !== index && entry.id === edited.id)) return history;
  return [...history.slice(0, index), ...history.slice(index + 1), edited];
}

function withAssetPrices(data: PortfolioData, prices: PriceHistory[], assetIds: Set<string>, asOf: string): PortfolioData {
  return {
    ...data,
    prices,
    assets: data.assets.map((asset) => {
      if (!assetIds.has(asset.id)) return asset;
      const latest = latestAssetPrice(prices, asset.id, asOf);
      if (!latest || (assetMode(asset) === "copy" && asset.lastValuationAt && latest.date < asset.lastValuationAt)) return asset;
      return assetMode(asset) === "copy"
        ? { ...asset, currentPrice: latest.price, copyUsdRate: latest.price }
        : { ...asset, currentPrice: latest.price };
    }),
  };
}

export function appendAssetPrices(data: PortfolioData, entries: PriceHistory[], asOf = todayIso()): PortfolioData {
  if (!entries.length) return data;
  return withAssetPrices(data, [...data.prices, ...entries], new Set(entries.map((entry) => entry.assetId)), asOf);
}

export function editAssetPrice(data: PortfolioData, id: string, price: number, date: string, asOf = todayIso()): PortfolioData {
  const original = data.prices.find((entry) => entry.id === id);
  if (!original) return data;
  const prices = moveEditedToEnd(data.prices, { ...original, price, date });
  if (prices === data.prices) return data; // a missing or duplicate ID is ambiguous
  return withAssetPrices(data, prices, new Set([original.assetId]), asOf);
}

export function appendStockPrices(data: PortfolioData, entries: StockPrice[]): PortfolioData {
  return entries.length ? { ...data, stockPrices: [...data.stockPrices, ...entries] } : data;
}

export function editStockPrice(data: PortfolioData, edited: StockPrice): PortfolioData {
  const stockPrices = moveEditedToEnd(data.stockPrices, edited);
  return stockPrices === data.stockPrices ? data : { ...data, stockPrices };
}
