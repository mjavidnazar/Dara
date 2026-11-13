"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as XLSX from "xlsx";
import { toGregorian } from "jalaali-js";
import {
  ArrowDownLeft,
  BarChart3,
  CheckCircle2,
  HardDrive,
  Landmark,
  Menu,
  Moon,
  MoreHorizontal,
  PieChart,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import {
  AssetModal,
  AssetTransactionsModal,
  CapitalIncreaseModal,
  ConfirmModal,
  CopyBalanceModal,
  HamiBalanceModal,
  KianBalanceModal,
  LiquidityTransferModal,
  Modal,
  PriceModalBulk,
  StockOrderModal,
  StockPriceHistoryModal,
  StockDividendModal,
  TransactionModal,
} from "./components/Modals";
import {
  AssetsView,
  BackupView,
  DashboardView,
  ReportsView,
  StocksDashboardView,
  TransactionsView,
} from "./components/Views";
import { loadData, saveData } from "./lib/db";
import {
  assetMode,
  calculateBourseSummary,
  emptyData,
  hasValidStockOrder,
  metricsAt,
  money,
  nf,
  normalizeSymbol,
  portfolioTimeline,
  isCashAccount,
  isGeneratedStockTransfer,
  stockMetrics,
  syncStockCashTransfers,
  todayIso,
  toPersianDate,
  transactionLabel,
  uid,
  validIsoDate,
} from "./lib/portfolio";
import { isPortfolioBackup, preparePortfolioData } from "./lib/restore";
import { analyzeCapital } from "./lib/capitalReport";
import type { AuditTarget } from "./lib/capitalReport";
import { autoRemovedCounterparts, linkedTransactions, removeTransaction, upsertTransaction } from "./lib/transactionLinks";
import { describeTransactionNote } from "./lib/transactionDescriptions";
import { reorderRowsWithinDay } from "./lib/transactionDayOrder";
import { appendAssetPrices, appendStockPrices, editAssetPrice, editStockPrice } from "./lib/priceHistory";
import { exportPortfolioPdf } from "./lib/pdfExport";
import type {
  Asset,
  PortfolioData,
  PriceHistory,
  StockDividend,
  StockOrder,
  StockPrice,
  Transaction,
} from "./lib/types";

type View = "dashboard" | "stocks" | "assets" | "transactions" | "reports" | "backup";
type Toast = { message: string; kind: "success" | "error" };

function cleanDigits(value: unknown): number {
  const str = String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,\s]/g, "");
  return Number(str) || 0;
}

function getCell(row: Record<string, unknown>, ...candidates: string[]): unknown {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && row[c] !== "") return row[c];
  }
  const cleanCandidates = candidates.map((c) => c.replace(/[\s()（）_ـ-]/g, "").trim());
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null || val === "") continue;
    const cleanKey = key.replace(/[\s()（）_ـ-]/g, "").trim();
    if (cleanCandidates.includes(cleanKey)) return val;
  }
  return "";
}

function brokerDateToIso(value: unknown): string {
  const match = String(value ?? "").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!match) return todayIso();
  const [, year, month, day] = match;
  const g = toGregorian(Number(year), Number(month), Number(day));
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

function parseAccountDescription(description: unknown) {
  const text = String(description ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(
    /(خرید|فروش|صدور|ابطال)\s+([\d,٬۰-۹]+)\s*(?:سهم|واحد)?\s+([^\s]+(?:\s+[^\s]+)?)\s+به\s+نرخ\s+([\d,٬۰-۹]+)/
  );
  if (!match) {
    const simple = text.match(/(خرید|فروش)\s+([\d,٬۰-۹]+)\s+سهم\s+([^\s]+)\s+به\s+نرخ\s+([\d,٬۰-۹]+)/);
    if (!simple) return null;
    return {
      type: simple[1] === "فروش" ? ("sell" as const) : ("buy" as const),
      quantity: cleanDigits(simple[2]),
      symbol: normalizeSymbol(simple[3]),
      unitPrice: cleanDigits(simple[4]) / 10,
    };
  }
  const isSell = match[1] === "فروش" || match[1] === "ابطال";
  return {
    type: isSell ? ("sell" as const) : ("buy" as const),
    quantity: cleanDigits(match[2]),
    symbol: normalizeSymbol(match[3]),
    unitPrice: cleanDigits(match[4]) / 10,
  };
}

function stockKey(row: {
  date: string;
  type: string;
  symbol: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}) {
  return [row.date, row.type, row.symbol, row.quantity, row.unitPrice, row.totalPrice].join("|");
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 2000);
}

function exportCsv(data: PortfolioData) {
  const kindNames: Record<NonNullable<Transaction["kind"]>, string> = {
    opening_capital: "آورده اولیه", capital_in: "آورده جدید", capital_out: "برداشت بیرونی",
    trade: "معامله داخلی", transfer: "انتقال داخلی", interest: "سود حساب",
    stock_dividend: "دریافت سود مجمع", fee: "کارمزد/هزینه", balance_adjustment: "اصلاح مانده نامشخص",
  };
  const rows = [
    ["شناسه", "نوع معامله", "دارایی", "ماهیت پول", "حساب مبدأ", "حساب مقصد", "ردیف مرتبط", "سود مجمع مرتبط", "تاریخ شمسی", "تاریخ میلادی (ISO)", "تعداد", "قیمت واحد (تومان)", "مبلغ کل (تومان)", "یادداشت", "یادداشت اصلی (فنی؛ برای پیوندها)"],
    ...data.transactions.map((tx) => {
      const asset = data.assets.find((item) => item.id === tx.assetId);
      return [
        tx.id,
        transactionLabel(tx, asset),
        asset?.name ?? "—",
        tx.kind ? kindNames[tx.kind] : "تعیین‌نشده",
        data.assets.find((item) => item.id === tx.sourceAssetId)?.name ?? "",
        data.assets.find((item) => item.id === tx.destinationAssetId)?.name ?? "",
        tx.linkedTransactionId ?? "",
        tx.stockDividendId ?? "",
        toPersianDate(tx.date),
        tx.date,
        tx.quantity,
        tx.unitPrice,
        tx.totalPrice,
        describeTransactionNote(data, tx),
        tx.notes ?? "",
      ];
    }),
  ];
  const csv = "\uFEFF" + rows.map((row) =>
    row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");
  download(`dara-transactions-${todayIso()}.csv`, csv, "text/csv;charset=utf-8");
}

async function exportPdfReport(
  data: PortfolioData,
  metrics: any[],
  stockData: any[],
  totalValue: number,
  totalProfit: number
) {
  return await exportPortfolioPdf(data, metrics, stockData, totalValue, totalProfit);
}

const themeListeners = new Set<() => void>();

function getThemeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("dara-theme") as "light" | "dark" | null;
    if (saved === "dark" || saved === "light") return saved;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  window.addEventListener("storage", callback);
  const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  media?.addEventListener?.("change", callback);
  return () => {
    themeListeners.delete(callback);
    window.removeEventListener("storage", callback);
    media?.removeEventListener?.("change", callback);
  };
}

function notifyThemeChange() {
  themeListeners.forEach((listener) => listener());
}

export default function App() {
  // Never display demo holdings as if they belonged to a new visitor. Real
  // records are restored explicitly from a local JSON file or this browser.
  const [data, setData] = useState<PortfolioData>(() => emptyData());
  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("dara-theme", next);
    } catch {}
    notifyThemeChange();
  };

  const setThemeExplicit = (next: "light" | "dark") => {
    try {
      localStorage.setItem("dara-theme", next);
    } catch {}
    notifyThemeChange();
  };

  // Modal controls
  const [assetModal, setAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [txModal, setTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [quickTxAssetId, setQuickTxAssetId] = useState<string | undefined>(undefined);
  const [priceModal, setPriceModal] = useState(false);
  const [priceFocusAssetId, setPriceFocusAssetId] = useState<string | null>(null);
  const [priceFocusHistoryId, setPriceFocusHistoryId] = useState<string | null>(null);
  const [stockPriceModal, setStockPriceModal] = useState(false);
  const [stockPriceFocusId, setStockPriceFocusId] = useState<string | null>(null);
  const [kianModal, setKianModal] = useState(false);
  const [hamiModal, setHamiModal] = useState(false);
  const [copyModalAsset, setCopyModalAsset] = useState<Asset | null>(null);
  const [viewingTxAsset, setViewingTxAsset] = useState<Asset | null>(null);
  const [viewingTxFocusId, setViewingTxFocusId] = useState<string | undefined>();
  const [stockOrderModal, setStockOrderModal] = useState(false);
  const [editingStockOrder, setEditingStockOrder] = useState<StockOrder | null>(null);
  const [auditDividendId, setAuditDividendId] = useState<string | null>(null);
  const [capitalIncreaseModal, setCapitalIncreaseModal] = useState(false);
  const [capitalIncreaseTargetId, setCapitalIncreaseTargetId] = useState<string>("asset-bank");
  const [capitalIncreaseSource, setCapitalIncreaseSource] = useState("آورده نقدی جدید");
  const [capitalIncreaseBeforeDate, setCapitalIncreaseBeforeDate] = useState<string | undefined>();
  const [liquidityModal, setLiquidityModal] = useState(false);
  const [liquidityFromId, setLiquidityFromId] = useState<string>("asset-bank");
  const [liquidityToId, setLiquidityToId] = useState<string>("asset-hami");
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    confirmKind?: "danger" | "primary";
    onConfirm: () => void;
  } | null>(null);

  // Stock preview modal
  const [stockPreview, setStockPreview] = useState<any[] | null>(null);
  const stockImportRef = useRef<HTMLInputElement | null>(null);
  const backupImportRef = useRef<HTMLInputElement | null>(null);

  const isLoadedRef = useRef(false);

  // Restore only records already in this browser. A private backup is selected
  // explicitly by its owner; no demo ledger and no server-side file fetch.
  useEffect(() => {
    async function init() {
      try {
        const stored = await loadData();
        const prepared = stored ? preparePortfolioData(stored) : null;
        if (prepared) setData(prepared);
      } catch (err) {
        console.warn("Storage load error:", err);
      } finally {
        isLoadedRef.current = true;
      }
    }
    init();
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveData(data);
  }, [data]);

  const notify = (message: string, kind: "success" | "error" = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  };

  // Portfolio calculations
  const rawMetrics = useMemo(
    () => metricsAt(data.assets, data.transactions, data.prices),
    [data.assets, data.transactions, data.prices]
  );

  const currentOrders = useMemo(
    () => data.stockOrders.filter((order) => validIsoDate(order.date) && order.date <= todayIso() && hasValidStockOrder(order)),
    [data.stockOrders]
  );
  const stockData = useMemo(
    () => stockMetrics(
      currentOrders,
      data.stockPrices.filter((price) => price.date <= todayIso()),
      data.stockDividends.filter((dividend) => dividend.date <= todayIso())
    ),
    [currentOrders, data.stockPrices, data.stockDividends]
  );

  const stockSummary = useMemo(
    () =>
      calculateBourseSummary(
        stockData,
        currentOrders,
        data.assets,
        data.transactions,
        data.prices
      ),
    [stockData, currentOrders, data.assets, data.transactions, data.prices]
  );

  // Replace Bourse asset in presentation metrics with live stock portfolio values
  const presentationMetrics = useMemo(() => {
    return rawMetrics.map((metric) => {
      if (metric.asset?.name === "بورس") {
        return {
          ...metric,
          marketValue: stockSummary.currentValue,
          costBasis: stockSummary.currentCost,
          unrealizedProfit: stockSummary.unrealizedProfit,
          realizedProfit: stockSummary.realizedProfit,
          totalProfit: stockSummary.toDateProfit,
          profitPercent: stockSummary.toDateReturnPercent,
        };
      }
      return metric;
    });
  }, [rawMetrics, stockSummary]);

  const totalValue = useMemo(
    () => presentationMetrics.reduce((sum, item) => sum + item.marketValue, 0),
    [presentationMetrics]
  );

  const totalProfit = useMemo(
    () => presentationMetrics.reduce((sum, item) => sum + item.totalProfit, 0),
    [presentationMetrics]
  );

  const totalCost = useMemo(() => {
    const sumCost = presentationMetrics.reduce((sum, item) => sum + Math.max(0, item.costBasis), 0);
    return sumCost > 0 ? sumCost : Math.max(0, totalValue - totalProfit);
  }, [presentationMetrics, totalValue, totalProfit]);

  const capitalReport = useMemo(
    () => analyzeCapital(data, totalValue, totalProfit),
    [data, totalValue, totalProfit]
  );
  const auditDividend = data.stockDividends.find((dividend) => dividend.id === auditDividendId);
  // This badge is a cost-basis ratio, NOT the owner's initial invested capital.
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const assetSegments = useMemo(
    () =>
      presentationMetrics
        .filter((item) => item.marketValue > 0)
        .map((item) => ({
          label: item.asset?.name || "",
          value: item.marketValue,
          color: item.asset?.color || "#20aa94",
        })),
    [presentationMetrics]
  );

  const timeline = useMemo(() => portfolioTimeline(data), [data]);

  const hamiMetric = presentationMetrics.find((m) => m.asset?.name?.includes("حامی"));
  const kianMetric = presentationMetrics.find((m) => m.asset?.name?.includes("کیان"));
  const depositCashMetric = presentationMetrics.find(
    (m) => m.asset?.id === "asset-deposit-cash" || m.asset?.name?.includes("دفتر گواهی")
  );
  const bankMetrics = presentationMetrics.filter(
    (m) =>
      (m.asset?.id === "asset-bank" ||
        m.asset?.category === "نقد" ||
        m.asset?.name?.includes("بانک")) &&
      m.asset?.id !== "asset-deposit-cash" &&
      !m.asset?.name?.includes("دفتر گواهی") &&
      !m.asset?.name?.includes("حامی") &&
      !m.asset?.name?.includes("کیان")
  );
  const bankBalance = bankMetrics.reduce((sum, m) => sum + (m.marketValue || 0), 0);

  const handlePortfolioPdf = async () => {
    notify("در حال آماده‌سازی و ساخت فایل PDF پورتفو...");
    try {
      const ok = await exportPdfReport(
        data,
        presentationMetrics,
        stockData,
        totalValue,
        totalProfit
      );
      if (ok) {
        notify("فایل PDF گزارش پورتفو با موفقیت دانلود شد.");
      } else {
        notify("فایل گزارش با موفقیت دانلود شد.");
      }
    } catch (err) {
      console.error("Portfolio PDF export error:", err);
      notify("خطا در ایجاد فایل PDF گزارش.", "error");
    }
  };

  // Stock price auto fetcher
  const fetchCurrentStockPrices = async () => {
    try {
      const res = await fetch("/api/brsapi/prices");
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.error || "ارتباط با سرویس قیمت‌های بورس برقرار نشد."
        );
      }
      const list = await res.json();
      if (!Array.isArray(list)) {
        throw new Error("قالب داده‌های دریافتی از سرور بورس نامعتبر است.");
      }

      const priceMap = new Map<string, number>();
      list.forEach((item: any) => {
        const symbol = normalizeSymbol(item.l18 || item.l30 || item.symbol);
        const price =
          cleanDigits(item.pc || item.pclosing || item.pl) / 10;
        if (symbol && price > 0) priceMap.set(symbol, price);
      });

      const today = todayIso();
      const currentSymbols = new Set(
        stockData.filter((item) => item.quantity > 0).map((item) => item.symbol)
      );

      const updates: StockPrice[] = [];
      for (const symbol of currentSymbols) {
        const found = priceMap.get(symbol);
        if (found) {
          updates.push({
            id: uid("sp-auto"),
            symbol,
            price: found,
            date: today,
          });
        }
      }

      if (updates.length > 0) {
        setData((prev) => appendStockPrices(prev, updates));
        notify(`${updates.length} قیمت سهام از بورس به‌روزرسانی شد.`);
      } else {
        notify("قیمت جدیدی برای نمادهای شما دریافت نشد.", "error");
      }
    } catch (err: any) {
      notify(
        err?.message || "ارتباط با سرویس قیمت‌های بورس برقرار نشد.",
        "error"
      );
    }
  };

  const hasDuplicateTransactionId = (tx: Transaction) =>
    data.transactions.filter((item) => item.id === tx.id).length > 1;

  const openTransactionForEdit = (tx: Transaction) => {
    if (hasDuplicateTransactionId(tx)) {
      notify("چند تراکنش با این شناسه وجود دارد؛ ویرایش تکی امن نیست. فایل پشتیبان را بررسی کنید.", "error");
      return;
    }
    if (isGeneratedStockTransfer(tx)) {
      const orderId = tx.notes?.match(/\[stock-order:([^\]]+)\]/)?.[1] || tx.id.replace(/^hami-stock-(buy|sell|sale)-/, "");
      const order = data.stockOrders.find((item) => item.id === orderId);
      if (order) {
        setEditingStockOrder(order);
        setStockOrderModal(true);
      } else notify("سفارش متناظر این تسویه پیدا نشد؛ از فایل پشتیبان یا گزارش خطا بررسی کنید.", "error");
      return;
    }
    const linked = linkedTransactions(data, tx);
    const parent = linked.find((item) => item.sourceAssetId || item.destinationAssetId);
    const target = parent && !tx.sourceAssetId && !tx.destinationAssetId ? parent : tx;
    if (hasDuplicateTransactionId(target) || linked.some(hasDuplicateTransactionId)) {
      notify("شناسهٔ یکی از ردیف‌های پیوندخورده تکراری است؛ ویرایش امن نیست. فایل پشتیبان را بررسی کنید.", "error");
      return;
    }
    setEditingTx(target);
    setQuickTxAssetId(undefined);
    setTxModal(true);
  };

  const confirmStockOrderDeletion = (id: string) => {
    const order = data.stockOrders.find((item) => item.id === id);
    setConfirmState({
      title: "حذف سفارش بورس",
      message: `آیا از حذف سفارش ${order?.symbol || "بورس"} به مبلغ ${money(order?.totalPrice || 0)} مطمئن هستید؟ تسویهٔ نقدی آن نیز به‌روز می‌شود.`,
      onConfirm: () => {
        setData((prev) => {
          const stockOrders = prev.stockOrders.filter((item) => item.id !== id);
          return { ...prev, stockOrders, transactions: syncStockCashTransfers(prev.transactions, stockOrders, prev.assets) };
        });
        notify("سفارش و تسویهٔ نقدی مربوط حذف شد.");
      },
    });
  };

  const confirmTransactionDeletion = (tx: Transaction) => {
    if (hasDuplicateTransactionId(tx)) {
      notify("چند تراکنش با این شناسه وجود دارد؛ حذف تکی امن نیست. فایل پشتیبان را بررسی کنید.", "error");
      return;
    }
    if (isGeneratedStockTransfer(tx)) {
      const orderId = tx.notes?.match(/\[stock-order:([^\]]+)\]/)?.[1] || tx.id.replace(/^hami-stock-(buy|sell|sale)-/, "");
      confirmStockOrderDeletion(orderId);
      return;
    }
    const linkedCount = linkedTransactions(data, tx).length;
    const removedPairs = autoRemovedCounterparts(data, tx);
    if (removedPairs.some(hasDuplicateTransactionId)) {
      notify("شناسهٔ ردیف مرتبط تکراری است؛ حذف امن نیست. فایل پشتیبان را بررسی کنید.", "error");
      return;
    }
    const removedCount = removedPairs.length;
    const inferredRemoval = removedPairs.some((other) =>
      tx.linkedTransactionId !== other.id || other.linkedTransactionId !== tx.id);
    const inferredPair = linkedCount > removedCount;
    const brokenLink = !linkedCount && (tx.linkedTransactionId ||
      data.transactions.some((item) => item.linkedTransactionId === tx.id));
    setConfirmState({
      title: "حذف معامله",
      message: `آیا از حذف معامله به مبلغ ${money(tx.totalPrice)} مطمئن هستید؟${removedCount ? ` ${removedCount} طرف نقدیِ مرتبط نیز حذف می‌شود.` : ""}${inferredRemoval ? " این ارتباط بر اساس ثبت قدیمی و مبلغ/تاریخ تطبیق داده شده، نه پیوند دوطرفهٔ صریح؛ پیش از تأیید هر دو سند را بررسی کنید." : ""}${inferredPair ? " یک طرف مقابلِ احتمالی در حساب دیگر پیدا شده؛ این ردیف حذف نمی‌شود و پس از حذف باید جداگانه بررسی شود." : ""}${brokenLink ? " پیوند این ردیف ناهماهنگ است؛ طرف مقابل خودکار حذف نمی‌شود و باید جداگانه بررسی شود." : ""}`,
      onConfirm: () => {
        setData((prev) => removeTransaction(prev, tx));
        notify(removedCount ? "ردیف و طرف نقدیِ مرتبط، پس از تأیید شما حذف شدند." : "فقط همین ردیف حذف شد؛ سایر تراکنش‌ها تغییر نکردند.");
      },
    });
  };

  const openCapitalDeposit = (source: string, preferredId?: string, beforeDate?: string) => {
    const account = data.assets.find((asset) => asset.id === preferredId && isCashAccount(asset)) ||
      data.assets.find((asset) => asset.id === "asset-bank" && isCashAccount(asset)) ||
      data.assets.find((asset) => isCashAccount(asset));
    if (!account) {
      setView("assets");
      notify("ابتدا یک حساب نقدی در بخش دارایی‌ها تعریف کنید؛ سپس آورده را ثبت کنید.", "error");
      return;
    }
    setCapitalIncreaseTargetId(account.id);
    setCapitalIncreaseSource(source);
    setCapitalIncreaseBeforeDate(beforeDate);
    setCapitalIncreaseModal(true);
  };

  const saveDividend = (dividend: StockDividend) => {
    setData((prev) => ({
      ...prev,
      stockDividends: [...prev.stockDividends.filter((item) => item.id !== dividend.id), dividend],
    }));
    if (auditDividendId === dividend.id) setAuditDividendId(null);
    notify(`سود مجمع ${dividend.symbol} ثبت شد؛ محل دریافت آن در گزارش بازبینی می‌شود.`);
  };

  const toggleDividend = (dividend: StockDividend, targetStatus?: "pending" | "paid") => {
    const nextStatus = targetStatus ?? (dividend.status === "paid" ? "pending" : "paid");
    setData((prev) => ({
      ...prev,
      stockDividends: prev.stockDividends.map((item) => item.id === dividend.id
        ? { ...item, status: nextStatus, receivedOutside: undefined } : item),
    }));
    if (auditDividendId === dividend.id) setAuditDividendId(null);
    notify(`سود مجمع ${dividend.symbol} به ${nextStatus === "paid" ? "محقق‌شده" : "در انتظار"} تغییر یافت؛ محل دریافت را بازبینی کنید.`);
  };

  const deleteDividend = (id: string) => {
    setData((prev) => ({
      ...prev,
      stockDividends: prev.stockDividends.filter((item) => item.id !== id),
    }));
    if (auditDividendId === id) setAuditDividendId(null);
    notify("سود مجمع حذف شد؛ اگر واریزی به آن پیوند خورده بود، ردیف واریز را بازبینی کنید.");
  };

  const resolveAuditIssue = (target: AuditTarget) => {
    if (target.type === "transaction") {
      const tx = data.transactions.find((item) => item.id === target.id);
      if (tx) openTransactionForEdit(tx);
      else notify("ردیف معامله پیدا نشد. فایل پشتیبان را بررسی کنید.", "error");
    } else if (target.type === "stockOrder") {
      const order = data.stockOrders.find((item) => item.id === target.id);
      if (order) {
        setEditingStockOrder(order);
        setStockOrderModal(true);
      } else notify("سفارش پیدا نشد.", "error");
    } else if (target.type === "asset") {
      const asset = data.assets.find((item) => item.id === target.id);
      if (asset) { setEditingAsset(asset); setAssetModal(true); }
      else notify("دارایی پیدا نشد؛ فایل پشتیبان را بررسی کنید.", "error");
    } else if (target.type === "price") {
      const asset = data.assets.find((item) => item.id === target.id);
      if (target.recordId) {
        setPriceFocusAssetId(target.id ?? null);
        setPriceFocusHistoryId(target.recordId);
        setPriceModal(true);
      } else if (asset && assetMode(asset) === "copy") setCopyModalAsset(asset);
      else if (target.id) { setPriceFocusAssetId(target.id); setPriceFocusHistoryId(null); setPriceModal(true); }
      else {
        setView("stocks");
        notify("قیمت نماد را در بخش بورس به‌روزرسانی کنید.");
      }
    } else if (target.type === "stockPrice") {
      if (data.stockPrices.some((item) => item.id === target.id)) {
        setStockPriceFocusId(target.id);
        setStockPriceModal(true);
      } else notify("رکورد قیمت سهام پیدا نشد؛ فایل پشتیبان را بررسی کنید.", "error");
    } else if (target.type === "dividend") {
      const dividend = data.stockDividends.find((item) => item.id === target.id);
      if (dividend) setAuditDividendId(dividend.id);
      else notify("ردیف سود مجمع پیدا نشد؛ فایل پشتیبان را بررسی کنید.", "error");
    } else {
      setView("transactions");
      notify("اگر پول قبلاً در سبد ثبت شده، همان تراکنش را ویرایش کنید؛ آن را دوباره واریز نکنید.");
    }
  };

  const nav = [
    { id: "dashboard" as View, label: "داشبورد", icon: PieChart },
    { id: "stocks" as View, label: "بورس", icon: BarChart3 },
    { id: "assets" as View, label: "دارایی‌ها", icon: WalletCards },
    { id: "transactions" as View, label: "معاملات", icon: ArrowDownLeft },
    { id: "reports" as View, label: "گزارش‌ها", icon: Landmark },
    { id: "backup" as View, label: "پشتیبان‌گیری", icon: HardDrive },
  ];

  return (
    <main className="app-shell">
      {/* Navigation Sidebar */}
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">د</div>
          <div>
            <b>دارا</b>
            <span>مدیریت هوشمند دارایی</span>
          </div>
          <button
            type="button"
            className="close-mobile"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav>
          <span className="nav-label">منوی اصلی</span>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMobileMenu(false);
              }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <ShieldCheck size={24} />
          <b>داده‌های شما امن است</b>
          <p>تمام اطلاعات فقط روی حافظهٔ همین مرورگر ذخیره می‌شود.</p>
        </div>

        <div className="sidebar-theme-switch">
          <span>حالت تاریک / روشن</span>
          <div className="theme-pills-wrap">
            <button
              type="button"
              className={`theme-pill ${theme === "light" ? "active" : ""}`}
              onClick={() => setThemeExplicit("light")}
            >
              <Sun size={13} /> روز
            </button>
            <button
              type="button"
              className={`theme-pill ${theme === "dark" ? "active" : ""}`}
              onClick={() => setThemeExplicit("dark")}
            >
              <Moon size={13} /> شب
            </button>
          </div>
        </div>

        <div className="profile">
          <div className="avatar">م</div>
          <div>
            <b>پرتفوی شخصی من</b>
            <span>نسخه آفلاین</span>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      {mobileMenu && (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="بستن منو"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* Main Workspace */}
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="menu-button"
              aria-label="باز کردن منو"
              title="منوی اصلی"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <h1>{nav.find((item) => item.id === view)?.label}</h1>
              <p>{toPersianDate(todayIso())} · آخرین ذخیره خودکار</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "تغییر به حالت روز (روشن)" : "تغییر به حالت شب (تاریک)"}
              aria-label="تغییر تم"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => { setPriceFocusAssetId(null); setPriceFocusHistoryId(null); setPriceModal(true); }}
            >
              <RefreshCw size={18} /> به‌روزرسانی قیمت
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setEditingTx(null);
                setTxModal(true);
              }}
            >
              <Plus size={18} /> ثبت معامله
            </button>
          </div>
        </header>

        <div className="page-content">
          {view === "dashboard" && (
            <DashboardView
              data={data}
              metrics={presentationMetrics}
              timeline={timeline}
              totalValue={totalValue}
              totalProfit={totalProfit}
              totalProfitPercent={totalProfitPercent}
              segments={assetSegments}
              stockSummary={stockSummary}
              cashAvailable={{
                bank: bankBalance,
                hami: hamiMetric?.marketValue ?? 0,
                kian: kianMetric?.marketValue ?? 0,
                depositCertCash: depositCashMetric?.marketValue ?? 0,
              }}
              onSetHamiBalance={() => setHamiModal(true)}
              onSetKianBalance={() => setKianModal(true)}
              onShowTransactions={() => setView("transactions")}
              onNavigateToStocks={() => setView("stocks")}
              capitalReport={capitalReport}
              onShowCapitalReport={() => setView("reports")}
              onImportBackup={() => backupImportRef.current?.click()}
            />
          )}

          {view === "stocks" && (
            <StocksDashboardView
              items={stockData}
              data={data}
              onManagePrices={() => { setStockPriceFocusId(null); setStockPriceModal(true); }}
              onSavePrices={(updates: StockPrice[]) => {
                setData((prev) => appendStockPrices(prev, updates));
                notify("قیمت‌های سهام با موفقیت به‌روزرسانی شد.");
              }}
              onSaveHamiInterest={(amount: number, date: string, note: string) => {
                const hami = data.assets.find((a) => a.name.includes("حامی"));
                if (!hami) {
                  notify("دارایی «صندوق درآمد ثابت حامی» یافت نشد.", "error");
                  return;
                }
                const tx: Transaction = {
                  id: uid("hami-interest"),
                  assetId: hami.id,
                  type: "buy",
                  quantity: amount,
                  unitPrice: 1,
                  totalPrice: amount,
                  date,
                  notes: note || "واریز سود ماهانه صندوق حامی",
                  attachmentIds: [],
                  kind: "interest",
                  createdAt: new Date().toISOString(),
                };
                setData((prev) => ({
                  ...prev,
                  transactions: [...prev.transactions, tx],
                }));
                notify("سود صندوق حامی ثبت شد.");
              }}
              onSaveHamiCashTransfer={(
                direction: "deposit" | "withdraw",
                amount: number,
                date: string,
                note: string,
                source: "bank" | "external"
              ) => {
                const hami = data.assets.find((a) => a.name.includes("حامی"));
                if (!hami) {
                  notify("دارایی «صندوق درآمد ثابت حامی» یافت نشد.", "error");
                  return;
                }
                const bank = data.assets.find((a) => a.id === "asset-bank" || a.name === "بانک");
                const fromBank = source === "bank" && Boolean(bank);
                const tx: Transaction = {
                  id: uid(`hami-${direction}`),
                  assetId: hami.id,
                  type: direction === "deposit" ? "buy" : "sell",
                  quantity: amount,
                  unitPrice: 1,
                  totalPrice: amount,
                  date,
                  notes: note || (direction === "deposit" ? "واریز وجه به حامی" : "برداشت وجه از حامی"),
                  attachmentIds: [],
                  kind: fromBank ? "transfer" : direction === "deposit" ? "capital_in" : "capital_out",
                  sourceAssetId: fromBank && direction === "deposit" ? bank!.id : undefined,
                  destinationAssetId: fromBank && direction === "withdraw" ? bank!.id : undefined,
                  createdAt: new Date().toISOString(),
                };
                setData((prev) => upsertTransaction(prev, tx, []));
                notify(
                  direction === "deposit"
                    ? "واریز وجه نقد به صندوق حامی ثبت شد."
                    : "برداشت وجه نقد از صندوق حامی ثبت شد."
                );
              }}
              onDividend={saveDividend}
              onToggleDividend={toggleDividend}
              onDeleteDividend={deleteDividend}
              onEditOrder={(order: StockOrder) => {
                const orders = data.stockOrders.map((o) => (o.id === order.id ? order : o));
                setData((prev) => ({
                  ...prev,
                  stockOrders: orders,
                  transactions: syncStockCashTransfers(prev.transactions, orders, prev.assets),
                }));
                notify("معاملهٔ بورس و ماندهٔ صندوق حامی هم‌گام شد.");
              }}
              onAutoPrices={fetchCurrentStockPrices}
            />
          )}

          {view === "assets" && (
            <AssetsView
              metrics={presentationMetrics}
              onAdd={() => {
                setEditingAsset(null);
                setAssetModal(true);
              }}
              onEdit={(asset: Asset) => {
                setEditingAsset(asset);
                setAssetModal(true);
              }}
              onQuickTx={(asset: Asset) => {
                setEditingTx(null);
                setQuickTxAssetId(asset.id);
                setTxModal(true);
              }}
              onPrice={() => { setPriceFocusAssetId(null); setPriceFocusHistoryId(null); setPriceModal(true); }}
              onUpdateCopy={(asset: Asset) => setCopyModalAsset(asset)}
              onViewTransactions={(asset: Asset) => { setViewingTxFocusId(undefined); setViewingTxAsset(asset); }}
              onCapitalIncrease={(targetAssetId?: string) => openCapitalDeposit("آورده نقدی جدید", targetAssetId)}
              onLiquidityTransfer={(defaultFromId?: string, defaultToId?: string) => {
                if (defaultFromId) {
                  setLiquidityFromId(defaultFromId);
                  setLiquidityToId(defaultToId || (defaultFromId === "asset-bank" ? "asset-hami" : "asset-bank"));
                }
                setLiquidityModal(true);
              }}
              onStockImport={() => stockImportRef.current?.click()}
              onDelete={(asset: Asset) => {
                const related = data.transactions.filter((tx) => tx.assetId === asset.id);
                setConfirmState({
                  title: `حذف دارایی «${asset.name}»`,
                  message: `آیا از حذف دارایی «${asset.name}» و ${nf.format(related.length)} معاملهٔ وابسته به آن اطمینان دارید؟ این عمل غیرقابل بازگشت است.`,
                  onConfirm: () => {
                    setData((prev) => {
                      const cleared = prev.transactions.filter((tx) => tx.assetId === asset.id && !isGeneratedStockTransfer(tx))
                        .reduce((state, tx) => removeTransaction(state, tx), prev);
                      const assets = cleared.assets.filter((item) => item.id !== asset.id);
                      return {
                        ...cleared,
                        assets,
                        transactions: syncStockCashTransfers(cleared.transactions.filter((tx) => tx.assetId !== asset.id), cleared.stockOrders, assets),
                        prices: cleared.prices.filter((item) => item.assetId !== asset.id),
                      };
                    });
                    notify("دارایی و داده‌های وابسته حذف شد.");
                  },
                });
              }}
            />
          )}

          {view === "transactions" && (
            <TransactionsView
              data={data}
              capitalReport={capitalReport}
              onShowReport={() => setView("reports")}
              onAdd={() => {
                setEditingTx(null);
                setTxModal(true);
              }}
              onEdit={openTransactionForEdit}
              onDelete={confirmTransactionDeletion}
              onReorder={(sourceKey, targetKey, position) =>
                setData((prev) => reorderRowsWithinDay(prev, sourceKey, targetKey, position))}
              onCsv={() => exportCsv(data)}
              onPdf={handlePortfolioPdf}
              onStockImport={() => stockImportRef.current?.click()}
              onEditStockOrder={(order: StockOrder) => {
                setEditingStockOrder(order);
                setStockOrderModal(true);
              }}
              onDeleteStockOrder={confirmStockOrderDeletion}
              onAddStockOrder={() => {
                setEditingStockOrder(null);
                setStockOrderModal(true);
              }}
              onCapitalIncrease={() => openCapitalDeposit("آورده نقدی جدید")}
              onLiquidityTransfer={(fromId?: string, toId?: string) => {
                setLiquidityFromId(fromId || "asset-bank");
                setLiquidityToId(toId || "asset-deposit-cash");
                setLiquidityModal(true);
              }}
              onSetHamiBalance={() => setHamiModal(true)}
            />
          )}

          {view === "reports" && (
            <ReportsView
              data={data}
              metrics={presentationMetrics}
              timeline={timeline}
              totalValue={totalValue}
              totalProfit={totalProfit}
              segments={assetSegments}
              capitalReport={capitalReport}
              onResolveIssue={resolveAuditIssue}
              onRegisterCapital={(accountId, beforeDate) => openCapitalDeposit("سرمایه اولیه", accountId, beforeDate)}
              onPdf={handlePortfolioPdf}
              onShowTransactions={() => setView("transactions")}
              onViewAssetTransactions={(asset: Asset, focusId?: string) => { setViewingTxFocusId(focusId); setViewingTxAsset(asset); }}
            />
          )}

          {view === "backup" && (
            <BackupView
              data={data}
              onExport={() => {
                download(
                  `dara-backup-${todayIso()}.json`,
                  JSON.stringify(data, null, 2),
                  "application/json"
                );
                notify("فایل پشتیبان کامل ساخته شد.");
              }}
              onImport={() => backupImportRef.current?.click()}
              onCsv={() => exportCsv(data)}
              onPdf={handlePortfolioPdf}
              onClear={() => {
                setConfirmState({
                  title: "پاک‌سازی کامل و ایجاد پرتفوی جدید",
                  message:
                    "این کار تمام اطلاعات پرتفوی فعلی همین مرورگر را حذف می‌کند. پیش از ادامه فایل پشتیبان JSON بگیرید. آیا مطمئن هستید؟",
                  onConfirm: () => {
                    setData(emptyData());
                    notify("پرتفوی خالی آماده شد.");
                  },
                });
              }}
            />
          )}
        </div>
      </section>

      {/* Hidden File Inputs for Imports */}
      <input
        ref={stockImportRef}
        hidden
        multiple
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length === 0) return;

          const accountFile = files.find((file) => file.name.includes("گردش"));
          const orderFile =
            files.find((file) => file.name.includes("سفارش")) ??
            files.find((file) => file !== accountFile);

          if (accountFile) {
            try {
              const accountBook = XLSX.read(await accountFile.arrayBuffer(), { type: "array" });
              const accountRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                accountBook.Sheets[accountBook.SheetNames[0]],
                { defval: "" }
              );
              const accountTrades = accountRows
                .map((row, index) => {
                  const rawDesc = String(getCell(row, "شرح", "شرح سند", "توضیحات") ?? "");
                  const description = rawDesc.replace(/\s+/g, " ").trim();
                  if (!description && !getCell(row, "بدهکار") && !getCell(row, "بستانکار")) {
                    return null;
                  }

                  // 1. KIAN FUND DETECTION (PRIORITIZED FIRST TO AVOID PARSING ERRORS)
                  if (description.includes("کیان") || normalizeSymbol(description).includes("کیان")) {
                    const credit = cleanDigits(getCell(row, "بستانکار", "بستانکار (ریال)", "مبلغ بستانکار", "بستانکار(ریال)")) / 10;
                    const debit = cleanDigits(getCell(row, "بدهکار", "بدهکار (ریال)", "مبلغ بدهکار", "بدهکار(ریال)")) / 10;
                    const directAmount = cleanDigits(getCell(row, "ارزش معامله", "مبلغ", "ارزش", "مبلغ (ریال)")) / 10;

                    const qtyMatch =
                      description.match(/([\d,٬۰-۹]+)\s*(?:واحد|سهم)/) ||
                      description.match(/(?:خرید|فروش|صدور|ابطال)\s+([\d,٬۰-۹]+)/);
                    const quantity = qtyMatch ? cleanDigits(qtyMatch[1]) : 0;

                    const priceMatch =
                      description.match(/به\s+نرخ\s+([\d,٬۰-۹]+)/) ||
                      description.match(/قیمت\s+([\d,٬۰-۹]+)/);
                    const rawUnitPrice = priceMatch ? cleanDigits(priceMatch[1]) : 0;
                    const unitPrice =
                      rawUnitPrice > 0
                        ? rawUnitPrice / 10
                        : (quantity > 0 && (credit || debit || directAmount)
                        ? (credit || debit || directAmount) / quantity
                        : 1);

                    let totalPrice = credit || debit || directAmount;
                    if (!totalPrice && quantity > 0 && unitPrice > 0) {
                      totalPrice = quantity * unitPrice;
                    }

                    const isSell =
                      credit > 0 ||
                      description.includes("فروش") ||
                      description.includes("ابطال");

                    const type = isSell ? ("sell" as const) : ("buy" as const);
                    const date = brokerDateToIso(getCell(row, "تاریخ", "تاریخ سند", "تاریخ معامله"));
                    const docNo = String(getCell(row, "سند", "شماره سند", "ردیف", "شماره پیگیری") || (index + 2));

                    return {
                      type,
                      symbol: "کیان",
                      quantity,
                      unitPrice,
                      totalPrice: totalPrice || (quantity * unitPrice),
                      commission: 0,
                      kind: "kian" as const,
                      date,
                      docNo,
                      rowIndex: index + 2,
                      source: "account",
                      status: "new" as const,
                      description: description || `معامله صندوق کیان (${type === "sell" ? "ابطال/فروش" : "صدور/خرید"})`,
                    };
                  }

                  // 2. HAMI FUND INTEREST
                  if (description.includes("سود طرح سرمایه گذاری حامی") || description.includes("طرح حامی")) {
                    return {
                      kind: "hami" as const,
                      date: brokerDateToIso(getCell(row, "تاریخ", "تاریخ سند")),
                      totalPrice: cleanDigits(getCell(row, "بستانکار", "بستانکار (ریال)", "مبلغ بستانکار")) / 10,
                      commission: 0,
                      source: "account",
                      status: "new" as const,
                      description,
                      rowIndex: index + 2,
                    };
                  }

                  // 3. CASH TRANSFERS
                  if (
                    description.includes("پرداخت وجه") ||
                    description.includes("واریز وجه") ||
                    description.includes("برداشت وجه")
                  ) {
                    const credit = cleanDigits(getCell(row, "بستانکار", "بستانکار (ریال)")) / 10;
                    const debit = cleanDigits(getCell(row, "بدهکار", "بدهکار (ریال)")) / 10;
                    const totalPrice = credit || debit;
                    if (totalPrice > 0) {
                      return {
                        kind: "cash-transfer" as const,
                        direction: credit > 0 ? ("deposit" as const) : ("withdraw" as const),
                        date: brokerDateToIso(getCell(row, "تاریخ", "تاریخ سند")),
                        totalPrice,
                        commission: 0,
                        source: "account",
                        status: "new" as const,
                        description,
                        rowIndex: index + 2,
                      };
                    }
                  }

                  // 4. REGULAR STOCK TRADES
                  const parsed = parseAccountDescription(description);
                  if (parsed) {
                    const totalPrice =
                      (parsed.type === "buy"
                        ? cleanDigits(getCell(row, "بدهکار", "بدهکار (ریال)"))
                        : cleanDigits(getCell(row, "بستانکار", "بستانکار (ریال)"))) / 10;
                    const gross = parsed.quantity * parsed.unitPrice;
                    return {
                      ...parsed,
                      kind: "trade" as const,
                      date: brokerDateToIso(getCell(row, "تاریخ", "تاریخ سند")),
                      totalPrice,
                      commission: Math.abs(gross - totalPrice),
                      source: "account",
                      status: "new" as const,
                      description,
                      rowIndex: index + 2,
                    };
                  }

                  return null;
                })
                .filter(Boolean) as any[];

              const existingKeys = new Set([
                ...data.stockOrders.map((item) => item.sourceKey ?? stockKey(item)),
                ...data.transactions
                  .map((item) => item.notes?.match(/\[(.+)\]$/)?.[1])
                  .filter(Boolean),
              ]);

              const seenKeysInPreview = new Set<string>();

              setStockPreview(
                accountTrades.map((item, idx) => {
                  const key =
                    item.kind === "hami"
                      ? `hami|${item.date}|${item.totalPrice}|${item.description}`
                      : item.kind === "cash-transfer"
                      ? `cash|${item.direction}|${item.date}|${item.totalPrice}|${item.description}`
                      : item.kind === "kian"
                      ? `kian|${item.type}|${item.date}|${item.totalPrice}|${item.quantity}|${item.docNo || idx}`
                      : stockKey(item);

                  const isDuplicate = existingKeys.has(key) || seenKeysInPreview.has(key);
                  seenKeysInPreview.add(key);

                  return {
                    ...item,
                    sourceKey: key,
                    matched: true,
                    status: isDuplicate ? ("duplicate" as const) : ("new" as const),
                  };
                })
              );
            } catch {
              notify("فایل گردش حساب قابل خواندن نیست.", "error");
            }
            event.target.value = "";
            return;
          }

          if (orderFile) {
            try {
              const book = XLSX.read(await orderFile.arrayBuffer(), { type: "array" });
              const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                book.Sheets[book.SheetNames[0]],
                { defval: "" }
              );
              const orders = rows
                .map((row) => {
                  const type = String(row["نوع معامله"] ?? "").includes("فروش")
                    ? ("sell" as const)
                    : ("buy" as const);
                  const symbol = normalizeSymbol(row["نماد"]);
                  const quantity = cleanDigits(row["تعداد"]);
                  const unitPrice = cleanDigits(row["قیمت"]) / 10;
                  const totalPrice = cleanDigits(row["ارزش معامله"] || row["مبلغ"]) / 10;
                  if (!symbol || symbol === "کیان" || symbol.includes("کیان") || !quantity || !totalPrice) return null;
                  const action = type === "buy" ? "خرید" : "فروش";
                  const comm = cleanDigits(row["کارمزد"]) / 10;
                  const line1 = `${action} ${nf.format(quantity)} سهم ${symbol} در قیمت ${money(unitPrice)}`;
                  const line2 = `هزینه‌ها ${money(comm)}`;
                  return {
                    id: uid("order"),
                    symbol,
                    type,
                    quantity,
                    unitPrice,
                    totalPrice,
                    commission: comm,
                    date: brokerDateToIso(row["تاریخ"]),
                    notes: `${line1}\n${line2}`,
                  };
                })
                .filter(Boolean) as StockOrder[];

              if (orders.length > 0) {
                const newOrders = [...data.stockOrders, ...orders];
                setData((prev) => ({
                  ...prev,
                  stockOrders: newOrders,
                  transactions: syncStockCashTransfers(prev.transactions, newOrders, prev.assets),
                }));
                notify(`${orders.length} معامله بورس از فایل وارد شد.`);
              } else {
                notify("معامله معتبری در فایل سفارش‌ها یافت نشد.", "error");
              }
            } catch {
              notify("خطا در خواندن فایل سفارش‌های بورس.", "error");
            }
            event.target.value = "";
          }
        }}
      />

      <input
        ref={backupImportRef}
        hidden
        type="file"
        accept=".json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const parsed = JSON.parse(await file.text());
            const restored = isPortfolioBackup(parsed) ? preparePortfolioData(parsed) : null;
            if (restored) {
              setConfirmState({
                title: "جایگزینی پرتفوی با فایل پشتیبان",
                message: `فایل ${file.name}: ${nf.format(restored.assets.length)} دارایی، ${nf.format(restored.transactions.length)} تراکنش و ${nf.format(restored.stockOrders.length)} سفارش بورس. این کار تمام اطلاعات فعلی همین مرورگر را جایگزین می‌کند؛ اگر به آن‌ها نیاز دارید ابتدا خروجی JSON بگیرید. معاملات مبهم به‌صورت خودکار به آورده یا سود تبدیل نمی‌شوند. فایل فقط در مرورگر خوانده می‌شود و به سرور ارسال نمی‌شود.`,
                confirmText: "بازیابی و نمایش گزارش سرمایه",
                confirmKind: "primary",
                onConfirm: () => {
                  setData(restored);
                  setView("reports");
                  notify("فایل پشتیبان بازیابی شد؛ موارد نیازمند بررسی را در گزارش سرمایه ببینید.");
                },
              });
            } else notify("فرمت فایل پشتیبان نامعتبر است: فهرست دارایی‌ها، معاملات و قیمت‌ها باید موجود باشد.", "error");
          } catch {
            notify("خواندن فایل پشتیبان با خطا مواجه شد.", "error");
          }
          event.target.value = "";
        }}
      />

      {/* Stock Preview Modal for Account Import */}
      {stockPreview && (
        <Modal
          title="پیش‌نمایش معاملات استخراج‌شده از گردش حساب"
          subtitle={`${stockPreview.filter((i) => i.status === "new").length} از ${stockPreview.length} ردیف برای ورود انتخاب شده است.`}
          onClose={() => setStockPreview(null)}
          wide
        >
          <div style={{ padding: "16px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                ردیف‌های علامت‌خورده به عنوان <b>جدید</b> وارد پورتفو خواهند شد. با کلیک روی وضعیت هر ردیف می‌توانید آن را تغییر دهید.
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="button secondary sm"
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                  onClick={() => {
                    setStockPreview((prev) =>
                      prev ? prev.map((item) => ({ ...item, status: "new" })) : null
                    );
                  }}
                >
                  ✓ انتخاب همه برای ورود
                </button>
                <button
                  type="button"
                  className="button secondary sm"
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                  onClick={() => {
                    setStockPreview((prev) =>
                      prev ? prev.map((item) => ({ ...item, status: "duplicate" })) : null
                    );
                  }}
                >
                  ✕ عدم انتخاب همه
                </button>
              </div>
            </div>

            <div className="table-wrapper" style={{ maxHeight: "380px", overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>وضعیت ورود</th>
                    <th style={{ width: "60px" }}>ردیف</th>
                    <th>نوع / عنوان</th>
                    <th>تاریخ</th>
                    <th>تعداد / واحد</th>
                    <th>مبلغ (تومان)</th>
                    <th>شرح سند</th>
                  </tr>
                </thead>
                <tbody>
                  {stockPreview.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor: item.kind === "kian" ? "rgba(59, 130, 246, 0.04)" : undefined,
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          className={`pill-badge ${item.status === "new" ? "positive" : "neutral"}`}
                          style={{
                            cursor: "pointer",
                            border: "none",
                            fontWeight: 600,
                            padding: "4px 8px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="برای تغییر وضعیت کلیک کنید"
                          onClick={() => {
                            setStockPreview((prev) =>
                              prev
                                ? prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, status: p.status === "new" ? "duplicate" : "new" }
                                      : p
                                  )
                                : null
                            );
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.status === "new"}
                            onChange={() => {}} // handled by button onClick
                            style={{ cursor: "pointer", margin: 0 }}
                          />
                          {item.status === "new" ? "جدید" : "تکراری"}
                        </button>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {item.rowIndex ? item.rowIndex : idx + 1}
                      </td>
                      <td>
                        <b>
                          {item.kind === "trade"
                            ? `${item.type === "buy" ? "خرید" : "فروش"} ${item.symbol}`
                            : item.kind === "kian"
                            ? `صندوق کیان (${item.type === "buy" ? "خرید/صدور" : "فروش/ابطال"})`
                            : item.kind === "hami"
                            ? "سود طرح حامی"
                            : item.direction === "deposit"
                            ? "واریز وجه"
                            : "برداشت وجه"}
                        </b>
                        {item.kind === "kian" && (
                          <span
                            style={{
                              marginRight: "6px",
                              fontSize: "0.75rem",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: "#dbeafe",
                              color: "#1e40af",
                            }}
                          >
                            صندوق درآمد ثابت
                          </span>
                        )}
                      </td>
                      <td>{toPersianDate(item.date)}</td>
                      <td>{item.quantity ? nf.format(item.quantity) : "—"}</td>
                      <td>
                        <b>{money(item.totalPrice)}</b>
                      </td>
                      <td>
                        <small style={{ color: "var(--muted)" }}>{item.description || "—"}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setStockPreview(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  const newItems = stockPreview.filter((i) => i.status === "new");
                  const newOrders: StockOrder[] = [];
                  const newTransactions: Transaction[] = [];

                  const hami = data.assets.find((a) => a.name.includes("حامی"));

                  for (const item of newItems) {
                    if (item.kind === "trade") {
                      const action = item.type === "buy" ? "خرید" : "فروش";
                      const comm = item.commission || 0;
                      const line1 = `${action} ${nf.format(item.quantity)} سهم ${item.symbol} در قیمت ${money(item.unitPrice)}`;
                      const line2 = `هزینه‌ها ${money(comm)}`;
                      newOrders.push({
                        id: uid("so"),
                        symbol: item.symbol,
                        type: item.type,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        commission: item.commission,
                        date: item.date,
                        sourceKey: item.sourceKey,
                        notes: `${line1}\n${line2}`,
                      });
                    } else if (item.kind === "hami" && hami) {
                      newTransactions.push({
                        id: uid("hami-interest"),
                        assetId: hami.id,
                        type: "buy",
                        quantity: item.totalPrice,
                        unitPrice: 1,
                        totalPrice: item.totalPrice,
                        date: item.date,
                        notes: `${item.description} [${item.sourceKey}]`,
                        attachmentIds: [],
                        kind: "interest",
                        createdAt: item.date,
                      });
                    } else if (item.kind === "cash-transfer" && hami) {
                      newTransactions.push({
                        id: uid(`hami-${item.direction}`),
                        assetId: hami.id,
                        type: item.direction === "deposit" ? "buy" : "sell",
                        quantity: item.totalPrice,
                        unitPrice: 1,
                        totalPrice: item.totalPrice,
                        date: item.date,
                        notes: `${item.description} [${item.sourceKey}]`,
                        attachmentIds: [],
                        kind: "transfer",
                        createdAt: item.date,
                      });
                    } else if (item.kind === "kian") {
                      const kianAsset = data.assets.find((a) => a.id === "asset-kian" || a.name.includes("کیان"));
                      const actionKian = item.type === "sell" ? "فروش/ابطال" : "خرید/صدور";
                      const actionHami = item.type === "sell" ? "واریز" : "برداشت";
                      const qtyText = item.quantity ? ` ${nf.format(item.quantity)} واحد` : "";

                      if (kianAsset) {
                        newTransactions.push({
                          id: uid("kian-trade"),
                          assetId: kianAsset.id,
                          type: item.type === "sell" ? "sell" : "buy",
                          quantity: item.totalPrice,
                          unitPrice: 1,
                          totalPrice: item.totalPrice,
                          date: item.date,
                          notes: `${actionKian}${qtyText} صندوق کیان و انتقال وجه با کارگزاری [${item.sourceKey}]`,
                          attachmentIds: [],
                          kind: "transfer",
                          createdAt: item.date,
                        });
                      }
                      if (hami) {
                        newTransactions.push({
                          id: uid("hami-kian-transfer"),
                          assetId: hami.id,
                          type: item.type === "sell" ? "buy" : "sell",
                          quantity: item.totalPrice,
                          unitPrice: 1,
                          totalPrice: item.totalPrice,
                          date: item.date,
                          notes: `${actionHami} حاصل از معامله${qtyText} صندوق کیان [${item.sourceKey}]`,
                          attachmentIds: [],
                          kind: "transfer",
                          createdAt: item.date,
                        });
                      }
                    }
                  }

                  const allOrders = [...data.stockOrders, ...newOrders];
                  const synced = syncStockCashTransfers(
                    [...data.transactions, ...newTransactions],
                    allOrders,
                    data.assets
                  );

                  setData((prev) => ({
                    ...prev,
                    stockOrders: allOrders,
                    transactions: synced,
                  }));

                  setStockPreview(null);
                  notify(`${newItems.length} ردیف با موفقیت به پورتفو اضافه شد.`);
                }}
              >
                تأیید و افزودن به پورتفو
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Asset Modal */}
      {assetModal && (
        <AssetModal
          initialAsset={editingAsset}
          onClose={() => {
            setAssetModal(false);
            setEditingAsset(null);
          }}
          onSave={(savedAsset) => {
            const mode = assetMode(savedAsset);
            const date = todayIso();
            // Editing the price in the asset form is also a new quote, not just
            // a stale currentPrice snapshot that history silently overrides.
            const changedPrice = editingAsset && !["cash", "stock"].includes(mode) &&
              savedAsset.currentPrice > 0 &&
              (mode === "copy" ? savedAsset.copyUsdRate !== editingAsset.copyUsdRate
                : savedAsset.currentPrice !== editingAsset.currentPrice);
            const priceEntry: PriceHistory | null = changedPrice
              ? { id: uid("asset-price"), assetId: savedAsset.id, price: savedAsset.currentPrice, date }
              : null;
            setData((prev) => {
              const exists = prev.assets.some((a) => a.id === savedAsset.id);
              const newAssets = exists
                ? prev.assets.map((a) => (a.id === savedAsset.id ? savedAsset : a))
                : [...prev.assets, savedAsset];
              const next = { ...prev, assets: newAssets };
              return priceEntry ? appendAssetPrices(next, [priceEntry], date) : next;
            });
            setAssetModal(false);
            const wasEditing = Boolean(editingAsset);
            setEditingAsset(null);
            notify(wasEditing ? `دارایی «${savedAsset.name}» ویرایش شد.` : `دارایی «${savedAsset.name}» تعریف شد.`);
          }}
        />
      )}

      {/* Transaction Modal */}
      {txModal && (
        <TransactionModal
          data={data}
          editing={editingTx}
          defaultAssetId={quickTxAssetId}
          onClose={() => {
            setTxModal(false);
            setEditingTx(null);
            setQuickTxAssetId(undefined);
          }}
          onSave={(tx, attachments) => {
            setData((prev) => upsertTransaction(prev, tx, attachments));
            setTxModal(false);
            setEditingTx(null);
            setQuickTxAssetId(undefined);
            notify(editingTx ? "معامله با موفقیت ویرایش شد." : "معامله جدید با موفقیت ثبت شد.");
          }}
        />
      )}

      {/* Price Modal */}
      {priceModal && (
        <PriceModalBulk
          assets={presentationMetrics.map((metric) => metric.asset)}
          history={data.prices}
          focusAssetId={priceFocusAssetId ?? undefined}
          focusHistoryId={priceFocusHistoryId ?? undefined}
          onClose={() => { setPriceModal(false); setPriceFocusAssetId(null); setPriceFocusHistoryId(null); }}
          onSave={(updates, date) => {
            const newHistory: PriceHistory[] = updates.map((u) => ({
              id: uid("price"),
              assetId: u.assetId,
              price: u.price,
              date,
            }));
            setData((prev) => appendAssetPrices(prev, newHistory));
            notify("قیمت‌های جدید با موفقیت ثبت شدند.");
          }}
          onEditHistory={(id, price, date) => {
            if (data.prices.filter((item) => item.id === id).length !== 1) {
              notify("شناسهٔ این قیمت یکتا نیست؛ برای ویرایش ایمن، فایل پشتیبان را بررسی کنید.", "error");
              return;
            }
            setData((prev) => editAssetPrice(prev, id, price, date));
            notify("رکورد قیمت اصلاح شد.");
          }}
        />
      )}

      {/* Edit the exact stock quote flagged by the capital audit, without rewriting other days. */}
      {stockPriceModal && (
        <StockPriceHistoryModal
          history={data.stockPrices}
          focusId={stockPriceFocusId ?? undefined}
          onClose={() => { setStockPriceModal(false); setStockPriceFocusId(null); }}
          onSave={(edited) => {
            if (data.stockPrices.filter((item) => item.id === edited.id).length !== 1) {
              notify("شناسهٔ این قیمت سهام یکتا نیست؛ برای ویرایش ایمن، فایل پشتیبان را بررسی کنید.", "error");
              return;
            }
            setData((prev) => editStockPrice(prev, edited));
            notify("رکورد نرخ پایانی سهام اصلاح شد.");
          }}
          onDelete={(price) => setConfirmState({
            title: "حذف رکورد قیمت سهام",
            message: `قیمت ${price.symbol} در تاریخ ${toPersianDate(price.date)} پس از حذف از تاریخچه پاک می‌شود. ابتدا با سند یا نسخهٔ پشتیبان مطابقت دهید. آیا مطمئن هستید؟`,
            onConfirm: () => {
              setData((prev) => ({ ...prev, stockPrices: prev.stockPrices.filter((item) => item.id !== price.id) }));
              setStockPriceModal(false);
              setStockPriceFocusId(null);
              notify("رکورد نرخ سهام حذف شد؛ ارزش روز و هشدارها بازبینی شدند.");
            },
          })}
        />
      )}

      {/* Kian Balance Modal */}
      {kianModal && (
        <KianBalanceModal
          currentBalance={kianMetric?.marketValue ?? 0}
          onSave={(balance) => {
            const kian = data.assets.find((asset) => asset.name.includes("کیان"));
            if (!kian) {
              notify("دارایی صندوق کیان یافت نشد.", "error");
              return;
            }
            const currentBalance = kianMetric?.marketValue ?? 0;
            const diff = balance - currentBalance;
            if (!diff) return;

            const tx: Transaction = {
              id: uid("kian-balance"),
              assetId: kian.id,
              type: diff >= 0 ? "buy" : "sell",
              quantity: Math.abs(diff),
              unitPrice: 1,
              totalPrice: Math.abs(diff),
              date: todayIso(),
              notes: "اصلاح مانده واقعی صندوق کیان",
              attachmentIds: [],
              kind: "balance_adjustment",
              createdAt: new Date().toISOString(),
            };

            setData((prev) => ({
              ...prev,
              transactions: [...prev.transactions, tx],
            }));
            notify("مانده واقعی صندوق کیان به‌روزرسانی شد.");
          }}
          onClose={() => setKianModal(false)}
        />
      )}

      {/* Hami Balance Modal */}
      {hamiModal && (
        <HamiBalanceModal
          currentBalance={hamiMetric?.marketValue ?? 0}
          onSave={(balance) => {
            const hami = data.assets.find((asset) => asset.name.includes("حامی"));
            if (!hami) {
              notify("دارایی صندوق حامی یافت نشد.", "error");
              return;
            }
            const currentBalance = hamiMetric?.marketValue ?? 0;
            const diff = balance - currentBalance;
            if (!diff) return;

            const tx: Transaction = {
              id: uid("hami-balance"),
              assetId: hami.id,
              type: diff >= 0 ? "buy" : "sell",
              quantity: Math.abs(diff),
              unitPrice: 1,
              totalPrice: Math.abs(diff),
              date: todayIso(),
              notes: "اصلاح مانده واقعی صندوق حامی (مفید)",
              attachmentIds: [],
              kind: "balance_adjustment",
              createdAt: new Date().toISOString(),
            };

            setData((prev) => ({
              ...prev,
              transactions: [...prev.transactions, tx],
            }));
            notify("مانده واقعی صندوق حامی به‌روزرسانی شد.");
          }}
          onClose={() => setHamiModal(false)}
        />
      )}

      {/* Copy-Trade Modal */}
      {copyModalAsset && (
        <CopyBalanceModal
          asset={copyModalAsset}
          onSave={(usdBalance, usdRate) => {
            const date = todayIso();
            const rateEntry: PriceHistory | null = usdRate && usdRate > 0
              ? { id: uid("copy-rate"), assetId: copyModalAsset.id, price: usdRate, date }
              : null;
            setData((prev) => {
              const withBalance = {
                ...prev,
                assets: prev.assets.map((a) =>
                  a.id === copyModalAsset.id
                    ? { ...a, copyUsdBalance: usdBalance, copyUsdRate: usdRate ?? a.copyUsdRate,
                        currentPrice: usdRate ?? a.currentPrice, lastValuationAt: date }
                    : a
                ),
              };
              return rateEntry ? appendAssetPrices(withBalance, [rateEntry], date) : withBalance;
            });
            notify(`مانده حساب ${copyModalAsset.name} به‌روزرسانی شد.`);
          }}
          onClose={() => setCopyModalAsset(null)}
        />
      )}

      {/* Asset Transactions Modal */}
      {viewingTxAsset && (
        <AssetTransactionsModal
          asset={viewingTxAsset}
          data={data}
          transactions={data.transactions}
          stockOrders={data.stockOrders}
          focusTransactionId={viewingTxFocusId}
          onClose={() => { setViewingTxAsset(null); setViewingTxFocusId(undefined); }}
          onAddTx={() => {
            const currentAsset = viewingTxAsset;
            setViewingTxAsset(null);
            setEditingTx(null);
            setQuickTxAssetId(currentAsset.id);
            setTxModal(true);
          }}
          onEditTx={(tx: Transaction) => {
            setViewingTxAsset(null);
            openTransactionForEdit(tx);
          }}
          onDeleteTx={confirmTransactionDeletion}
          onEditOrder={(order: StockOrder) => {
            setViewingTxAsset(null);
            setEditingStockOrder(order);
            setStockOrderModal(true);
          }}
          onDeleteOrder={confirmStockOrderDeletion}
          onAddOrder={() => {
            setViewingTxAsset(null);
            setEditingStockOrder(null);
            setStockOrderModal(true);
          }}
        />
      )}

      {/* Stock Order Modal (Add/Edit) */}
      {stockOrderModal && (
        <StockOrderModal
          order={editingStockOrder}
          existingSymbols={Array.from(new Set((data.stockOrders || []).map((o) => o.symbol)))}
          cashAccounts={data.assets.filter((asset) => isCashAccount(asset))}
          onClose={() => {
            setStockOrderModal(false);
            setEditingStockOrder(null);
          }}
          onSave={(order: StockOrder) => {
            const isEdit = Boolean(editingStockOrder);
            let updatedOrders: StockOrder[];
            if (isEdit) {
              updatedOrders = (data.stockOrders || []).map((o) => (o.id === order.id ? order : o));
            } else {
              updatedOrders = [order, ...(data.stockOrders || [])];
            }
            const updatedTxs = syncStockCashTransfers(data.transactions, updatedOrders, data.assets);
            setData((prev) => ({
              ...prev,
              stockOrders: updatedOrders,
              transactions: updatedTxs,
            }));
            setStockOrderModal(false);
            setEditingStockOrder(null);
            notify(
              isEdit
                ? `معامله ${order.symbol} با موفقیت ویرایش و با صندوق حامی هم‌گام شد.`
                : `معامله جدید ${order.symbol} با موفقیت ثبت و با صندوق حامی هم‌گام شد.`
            );
          }}
        />
      )}

      {/* Open the exact problematic dividend from the reconciliation panel. */}
      {auditDividend && (
        <StockDividendModal
          key={auditDividend.id}
          symbol={auditDividend.symbol}
          initialDividend={auditDividend}
          dividends={data.stockDividends}
          symbols={Array.from(new Set(data.stockOrders.map((order) => order.symbol)))}
          onClose={() => setAuditDividendId(null)}
          onSave={saveDividend}
          onToggleStatus={toggleDividend}
          onDelete={deleteDividend}
          onShowTransactions={() => { setAuditDividendId(null); setView("transactions"); }}
        />
      )}

      {/* Capital Increase Modal */}
      {capitalIncreaseModal && (
        <CapitalIncreaseModal
          assets={data.assets}
          targetAssetId={capitalIncreaseTargetId}
          initialSource={capitalIncreaseSource}
          beforeDate={capitalIncreaseBeforeDate}
          onClose={() => setCapitalIncreaseModal(false)}
          onSave={(amount: number, date: string, source: string, note: string, targetAssetId: string, initial: boolean) => {
            const target = data.assets.find((a) => a.id === targetAssetId);
            const targetName = target?.name || "بانک";
            const tx: Transaction = {
              id: uid("tx-cap-inc"),
              assetId: targetAssetId,
              date,
              type: "buy",
              quantity: amount,
              unitPrice: 1,
              totalPrice: amount,
              kind: initial ? "opening_capital" : "capital_in",
              notes: `افزایش سرمایه و آورده نقدی [منبع: ${source}]${note ? ` - ${note}` : ""}`,
              attachmentIds: [],
              createdAt: new Date().toISOString(),
            };

            setData((prev) => ({
              ...prev,
              transactions: [tx, ...prev.transactions],
            }));
            setCapitalIncreaseModal(false);
            notify(`افزایش سرمایه به مبلغ ${money(amount)} با موفقیت در «${targetName}» ثبت شد.`);
          }}
        />
      )}

      {/* Liquidity Transfer Modal */}
      {liquidityModal && (
        <LiquidityTransferModal
          assets={data.assets}
          defaultFromId={liquidityFromId}
          defaultToId={liquidityToId}
          onClose={() => setLiquidityModal(false)}
          onSave={(fromAssetId: string, toAssetId: string, amount: number, date: string, note: string) => {
            const fromAsset = data.assets.find((a) => a.id === fromAssetId);
            const toAsset = data.assets.find((a) => a.id === toAssetId);
            const fromName = fromAsset?.name || "حساب مبدأ";
            const toName = toAsset?.name || "حساب مقصد";
            const withdrawId = uid("tx-transfer-out");
            const depositId = uid("tx-transfer-in");

            const txWithdraw: Transaction = {
              id: withdrawId,
              linkedTransactionId: depositId,
              assetId: fromAssetId,
              date,
              type: "sell",
              quantity: amount,
              unitPrice: 1,
              totalPrice: amount,
              kind: "transfer",
              notes: `انتقال نقدینگی به ${toName}${note ? ` (${note})` : ""}`,
              attachmentIds: [],
              createdAt: new Date().toISOString(),
            };

            const txDeposit: Transaction = {
              id: depositId,
              linkedTransactionId: withdrawId,
              assetId: toAssetId,
              date,
              type: "buy",
              quantity: amount,
              unitPrice: 1,
              totalPrice: amount,
              kind: "transfer",
              notes: `انتقال نقدینگی از ${fromName}${note ? ` (${note})` : ""}`,
              attachmentIds: [],
              createdAt: new Date().toISOString(),
            };

            setData((prev) => ({
              ...prev,
              transactions: [txWithdraw, txDeposit, ...prev.transactions],
            }));
            setLiquidityModal(false);
            notify(`انتقال نقدینگی ${money(amount)} از «${fromName}» به «${toName}» با موفقیت انجام شد.`);
          }}
        />
      )}

      {/* Confirm Modal */}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          confirmKind={confirmState.confirmKind}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.kind}`}>
          <CheckCircle2 size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="ناوبری سریع">
        {nav.map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={`mob-${item.id}`}
              type="button"
              className={`mob-nav-btn ${isActive ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                setMobileMenu(false);
              }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
