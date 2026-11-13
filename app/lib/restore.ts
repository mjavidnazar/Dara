import { sanitizePortfolioData } from "./db";
import { migrateKianStockData, syncStockCashTransfers } from "./portfolio";
import type { PortfolioData } from "./types";

/** Backups are read locally in the browser; never fetch a user's ledger from a public URL. */
export function isPortfolioBackup(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const record = raw as Record<string, unknown>;
  return Array.isArray(record.assets) && Array.isArray(record.transactions) &&
    Array.isArray(record.prices);
}

/** The same non-destructive preparation is used on first load and on JSON restore. */
export function preparePortfolioData(raw: unknown): PortfolioData | null {
  const initial = sanitizePortfolioData(raw);
  if (!initial) return null;

  const { data: migrated } = migrateKianStockData(initial);
  const assets = migrated.assets.map((asset) => {
    if (asset.id === "asset-mes" || asset.name.includes("مس")) {
      return {
        ...asset,
        isDepositCertificate: asset.isDepositCertificate ?? true,
        depositSymbol: asset.depositSymbol ?? "مس (تمام نمادهای مس کاتد و مفتول)",
      };
    }
    if (asset.id === "asset-roy" || asset.name.includes("روی")) {
      return {
        ...asset,
        isDepositCertificate: asset.isDepositCertificate ?? true,
        depositSymbol: asset.depositSymbol ?? "روی (شمش روی)",
      };
    }
    if (asset.id === "asset-milgerd" || asset.name.includes("میلگرد")) {
      return {
        ...asset,
        isDepositCertificate: asset.isDepositCertificate ?? true,
        depositSymbol: asset.depositSymbol ?? "میلگرد (تمام نمادهای میلگرد بورس کالا)",
      };
    }
    return asset;
  });

  // Older backups may not include the commodity settlement ledger. Adding an
  // empty account does not invent capital or rewrite any historical transaction.
  if (assets.length && !assets.some((asset) =>
    asset.id === "asset-deposit-cash" || asset.name.includes("دفتر گواهی")
  )) {
    assets.push({
      id: "asset-deposit-cash",
      name: "دفتر گواهی سپرده",
      category: "دفتر نقدینگی",
      unit: "تومان",
      currentPrice: 1,
      annualInterestRate: 0,
      color: "#0284c7",
      notes: "حساب نقدینگی و تسویه معاملات گواهی سپرده کالایی بورس کالا",
      createdAt: "2026-08-01T19:06:18.503Z",
    });
  }

  return {
    ...migrated,
    assets,
    // Keep questionable deposits and corrections intact. Only generate the
    // deterministic cash settlement belonging to a real stock order.
    transactions: syncStockCashTransfers(migrated.transactions, migrated.stockOrders, assets),
  };
}
