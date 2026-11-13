"use client";

import { FormEvent, ReactNode, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpLeft,
  Check,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { JalaliDatePicker } from "./JalaliDatePicker";
import {
  assetMode,
  hasValidTradeAmounts,
  isDepositCertificate,
  money,
  nf,
  safeNumber,
  signedMoney,
  todayIso,
  toEnglishDigits,
  toPersianDate,
  transactionLabel,
  uid,
  validIsoDate,
} from "../lib/portfolio";
import { linkedTransactions } from "../lib/transactionLinks";
import { describeTransactionNote } from "../lib/transactionDescriptions";
import { compareRowsWithinDay, ledgerRowKey } from "../lib/transactionDayOrder";
import type {
  Asset,
  Attachment,
  PortfolioData,
  PriceHistory,
  StockDividend,
  StockOrder,
  StockPrice,
  Transaction,
} from "../lib/types";

const assetColors = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#475569",
];

function num(value: unknown): number {
  return safeNumber(value);
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" aria-label="بستن" onClick={onClose} />
      <section className={`modal ${wide ? "wide-modal" : ""}`}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmText = "تأیید و حذف",
  confirmKind = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmText?: string;
  confirmKind?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-form">
        <p style={{ margin: "10px 0 20px", lineHeight: "1.8", color: "var(--ink)" }}>
          {message}
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button
            type="button"
            className={`button ${confirmKind === "danger" ? "danger-button" : "primary"}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function KianBalanceModal({
  currentBalance,
  onSave,
  onClose,
}: {
  currentBalance: number;
  onSave: (balance: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(Math.round(currentBalance || 0)));

  return (
    <Modal
      title="ثبت مانده صندوق کیان"
      subtitle="مانده واقعی فعلی صندوق درآمد ثابت کیان را به تومان وارد کنید."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(num(value));
          onClose();
        }}
      >
        <label>
          <span>مانده فعلی (تومان) *</span>
          <input
            required
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
          />
        </label>
        <div className="total-preview">
          <span>تغییر نسبت به مانده فعلی</span>
          <strong className={num(value) - currentBalance >= 0 ? "positive-text" : "negative-text"}>
            {signedMoney(num(value) - currentBalance)}
          </strong>
        </div>
        <small style={{ color: "var(--negative)", lineHeight: 1.8 }}>اختلاف مانده به‌صورت «اصلاح نامشخص» ثبت می‌شود، نه سود یا آورده. برای نهایی شدن گزارش، علت اختلاف را از بخش گزارش‌ها بررسی کنید.</small>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            ثبت مانده
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function HamiBalanceModal({
  currentBalance,
  onSave,
  onClose,
}: {
  currentBalance: number;
  onSave: (balance: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(Math.round(currentBalance || 0)));

  return (
    <Modal
      title="ثبت مانده واقعی صندوق حامی (کارگزاری مفید)"
      subtitle="مانده واقعی فعلی صندوق حامی در سامانه کارگزاری را به تومان وارد کنید."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(num(value));
          onClose();
        }}
      >
        <label>
          <span>مانده واقعی کارگزاری / حامی (تومان) *</span>
          <input
            required
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
          />
        </label>
        <div className="total-preview">
          <span>تغییر نسبت به مانده سیستمی فعلی</span>
          <strong className={num(value) - currentBalance >= 0 ? "positive-text" : "negative-text"}>
            {signedMoney(num(value) - currentBalance)}
          </strong>
        </div>
        <small style={{ color: "var(--negative)", lineHeight: 1.8 }}>اختلاف مانده به‌صورت «اصلاح نامشخص» ثبت می‌شود، نه سود یا آورده. برای نهایی شدن گزارش، علت اختلاف را از بخش گزارش‌ها بررسی کنید.</small>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            ثبت مانده واقعی
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CopyBalanceModal({
  asset,
  onSave,
  onClose,
}: {
  asset: Asset;
  onSave: (usdBalance: number, usdRate?: number) => void;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState(String(asset.copyUsdBalance ?? 0));
  // The user must enter a new rate to mark today's valuation as confirmed.
  // Copying an old prefilled rate would silently hide a stale-price warning.
  const [rate, setRate] = useState("");

  return (
    <Modal
      title={`مانده حسابی ${asset.name}`}
      subtitle="ارزش دلاری فعلی حساب و نرخ روز هر دلار را ثبت کنید."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (num(balance) < 0 || num(rate) <= 0) return;
          onSave(num(balance), num(rate));
          onClose();
        }}
      >
        <div className="form-grid">
          <label>
            <span>موجودی فعلی (دلار) *</span>
            <input
              required
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="1000"
            />
          </label>
          <label>
            <span>نرخ تبدیل دلار (تومان) *</span>
            <input
              required
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={`نرخ پیشین: ${money(asset.copyUsdRate ?? asset.currentPrice ?? 0)}`}
            />
          </label>
        </div>
        <div className="total-preview">
          <span>ارزش تومانی معادل</span>
          <strong>{money(num(balance) * num(rate))}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            ذخیره تغییرات
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AssetModal({
  initialAsset,
  onClose,
  onSave,
}: {
  initialAsset?: Asset | null;
  onClose: () => void;
  onSave: (asset: Asset) => void;
}) {
  const [form, setForm] = useState({
    name: initialAsset?.name ?? "",
    symbol: initialAsset?.symbol ?? "",
    unit: initialAsset?.unit ?? "",
    price: initialAsset?.currentPrice ? String(initialAsset.currentPrice) : "",
    category: initialAsset?.category ?? "",
    color: initialAsset?.color ?? assetColors[0],
    notes: initialAsset?.notes ?? "",
    annualRate: initialAsset?.annualInterestRate ? String(initialAsset.annualInterestRate) : "",
    usdBalance: initialAsset?.copyUsdBalance ? String(initialAsset.copyUsdBalance) : "",
    usdRate: initialAsset?.copyUsdRate ? String(initialAsset.copyUsdRate) : "",
    isDepositCertificate: Boolean(
      initialAsset?.isDepositCertificate || (initialAsset && isDepositCertificate(initialAsset))
    ),
    depositSymbol: initialAsset?.depositSymbol ?? "",
  });

  const preview = {
    ...form,
    id: initialAsset?.id ?? "preview",
    category: form.category,
    currentPrice: num(form.price),
    color: form.color,
    createdAt: initialAsset?.createdAt ?? "",
  } as Asset;
  const mode = assetMode(preview);

  const isEditing = Boolean(initialAsset);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const price = mode === "copy" ? num(form.usdRate) : num(form.price);
    if (!form.name || (!price && mode !== "fixed")) return;

    const defaultCat =
      form.isDepositCertificate
        ? `گواهی سپرده ${form.name.trim()}`
        : mode === "fixed"
        ? "صندوق درآمد ثابت"
        : mode === "copy"
        ? "کپی ترید"
        : mode === "stock"
        ? "بورس"
        : mode === "cash"
        ? "نقد و بانک"
        : "سرمایه‌گذاری";

    onSave({
      id: initialAsset?.id ?? uid("asset"),
      name: form.name.trim(),
      symbol: mode === "stock" ? form.symbol.trim().toUpperCase() : form.symbol || undefined,
      category: form.category.trim() || defaultCat,
      unit: form.isDepositCertificate
        ? form.unit.trim() || "کیلوگرم"
        : mode === "stock"
        ? "سهم"
        : mode === "copy"
        ? "دلار"
        : form.unit.trim() || "واحد",
      currentPrice: price || 1,
      copyUsdBalance: mode === "copy" ? num(form.usdBalance) : undefined,
      copyUsdRate: mode === "copy" ? num(form.usdRate) : undefined,
      lastValuationAt: mode === "copy"
        ? (!initialAsset || num(form.usdRate) !== initialAsset.copyUsdRate
          ? todayIso() : initialAsset.lastValuationAt)
        : undefined,
      annualInterestRate: mode === "fixed" ? num(form.annualRate) : undefined,
      color: form.color || initialAsset?.color || assetColors[Math.floor(Math.random() * assetColors.length)],
      notes: form.notes.trim(),
      isDepositCertificate: Boolean(form.isDepositCertificate),
      depositSymbol: form.isDepositCertificate ? form.depositSymbol.trim() || undefined : undefined,
      createdAt: initialAsset?.createdAt || new Date().toISOString(),
    });
  };

  const defaultCategories = [
    "بورس",
    "گواهی سپرده مس",
    "گواهی سپرده میلگرد",
    "گواهی سپرده روی",
    "گواهی سپرده طلا",
    "گواهی سپرده کالایی",
    "صندوق درآمد ثابت",
    "طلا و مسکوکات",
    "ارز و تتر",
    "کپی ترید",
    "نقد و بانک",
    "ملک و زمین",
    "سایر",
  ];

  return (
    <Modal
      title={isEditing ? `ویرایش دارایی «${initialAsset?.name}»` : "تعریف دارایی جدید"}
      subtitle={
        isEditing
          ? "تغییرات مورد نظر را اعمال و ذخیره نمایید."
          : "فرم بر اساس نام دارایی به‌طور هوشمند تنظیم می‌شود."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-form">
        <label>
          <span>نام دارایی *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثلاً طلای آبشده، تتر، حساب کپی‌ترید، صندوق کیان…"
          />
        </label>

        <div className="form-grid">
          <label>
            <span>دسته‌بندی دارایی</span>
            <input
              list="categories-list"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="مثلاً طلا و مسکوکات، ارز، بورس…"
            />
            <datalist id="categories-list">
              {defaultCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label>
            <span>رنگ برچسب و نمودار</span>
            <div className="color-picker-row">
              {assetColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-circle-btn ${form.color === c ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`انتخاب رنگ ${c}`}
                />
              ))}
            </div>
          </label>
        </div>

        {mode === "copy" ? (
          <div className="form-grid">
            <label>
              <span>موجودی فعلی حساب (دلار) *</span>
              <input
                required
                inputMode="decimal"
                value={form.usdBalance}
                onChange={(e) => setForm({ ...form, usdBalance: e.target.value })}
                placeholder="1000"
              />
            </label>
            <label>
              <span>نرخ روز هر دلار (تومان) *</span>
              <input
                required
                inputMode="numeric"
                value={form.usdRate}
                onChange={(e) => setForm({ ...form, usdRate: e.target.value })}
                placeholder="90000"
              />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label>
              <span>واحد شمارش (اختیاری)</span>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="گرم، کیلوگرم، دستگاه، سهم…"
              />
            </label>
            <label>
              <span>قیمت روز هر واحد (تومان) *</span>
              <input
                inputMode="numeric"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0"
              />
            </label>
          </div>
        )}

        {mode === "fixed" && (
          <label>
            <span>نرخ سود سالانه صندوق (درصد)</span>
            <input
              inputMode="decimal"
              value={form.annualRate}
              onChange={(e) => setForm({ ...form, annualRate: e.target.value })}
              placeholder="مثلاً ۲۸.۵"
            />
          </label>
        )}

        {/* بخش گواهی سپرده کالایی (بورس کالا) */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 14px",
            backgroundColor: form.isDepositCertificate ? "rgba(15, 118, 110, 0.05)" : "transparent",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.isDepositCertificate}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  isDepositCertificate: checked,
                  category:
                    checked && (!prev.category || prev.category === "سرمایه‌گذاری")
                      ? `گواهی سپرده ${prev.name.trim() || "کالایی"}`
                      : prev.category,
                  unit: checked && !prev.unit ? "کیلوگرم" : prev.unit,
                }));
              }}
            />
            <span style={{ fontWeight: 600, fontSize: "13.5px" }}>
              این دارایی از نوع «گواهی سپرده کالایی» (بورس کالا) است
            </span>
          </label>

          {form.isDepositCertificate && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "2px" }}>
              <label>
                <span style={{ fontSize: "12px" }}>نماد یا نام کالا در فایل اکسل بورس کالا</span>
                <input
                  list="deposit-symbol-presets"
                  value={form.depositSymbol}
                  onChange={(e) => setForm({ ...form, depositSymbol: e.target.value })}
                  placeholder="مثلاً CopperCthd، ZincIngot، SteelRebar یا نام در کارگزاری…"
                />
                <datalist id="deposit-symbol-presets">
                  <option value="CopperCthd(گواهی سپرده پیوسته مس کاتد)">مس کاتد</option>
                  <option value="SteelRebar(گواهی سپرده پیوسته میلگرد)">میلگرد</option>
                  <option value="ZincIngot(گواهی سپرده پیوسته شمش روی)">شمش روی</option>
                  <option value="GoldBar(گواهی سپرده پیوسته شمش طلا)">شمش طلا</option>
                  <option value="Coin(گواهی سپرده تمام سکه)">تمام سکه</option>
                  <option value="Saffron(گواهی سپرده زعفران)">زعفران</option>
                </datalist>
              </label>
              <small style={{ color: "var(--muted)", fontSize: "11px", lineHeight: "1.5" }}>
                💡 با تعیین این نماد، هنگام ورود فایل اکسل صورتحساب کارگزاری، تمام معاملات، کارمزدها و هزینه‌های انبارداری به این دارایی متصل می‌شوند.
              </small>
            </div>
          )}
        </div>

        <label>
          <span>توضیحات و یادداشت</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="توضیحات اختیاری درباره دارایی…"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            {isEditing ? "ذخیره تغییرات دارایی" : "افزودن دارایی"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TransactionModal({
  data,
  editing,
  defaultAssetId,
  onClose,
  onSave,
}: {
  data: PortfolioData;
  editing: Transaction | null;
  defaultAssetId?: string;
  onClose: () => void;
  onSave: (tx: Transaction, attachments: Attachment[]) => void;
}) {
  const initialAsset = editing?.assetId ?? defaultAssetId ?? data?.assets?.[0]?.id ?? "";
  const initialCash = assetMode(data.assets.find((asset) => asset.id === initialAsset)) === "cash";
  const existingPair = editing?.linkedTransactionId
    ? data.transactions.find((item) => item.id === editing.linkedTransactionId)
    : undefined;
  const manualTransferAccount = editing?.kind === "transfer" && existingPair?.kind === "transfer"
    ? existingPair.assetId : "";
  const matchedPair = editing ? linkedTransactions(data, editing)[0] : undefined;
  const unconfirmedMatch = Boolean(editing && matchedPair &&
    (editing.linkedTransactionId !== matchedPair.id || matchedPair.linkedTransactionId !== editing.id));
  const brokenLink = Boolean(editing && !matchedPair &&
    (editing.linkedTransactionId || data.transactions.some((tx) => tx.linkedTransactionId === editing.id)));
  const readableEditingNote = editing ? describeTransactionNote(data, editing) : "";
  const hasTechnicalNote = Boolean(editing?.notes && readableEditingNote !== editing.notes);
  const [form, setForm] = useState({
    type: editing?.type ?? "buy",
    assetId: initialAsset,
    quantity: String((initialCash ? editing?.totalPrice : editing?.quantity) ?? ""),
    unitPrice: String(editing?.unitPrice ?? ""),
    date: editing?.date ?? todayIso(),
    notes: editing?.notes ?? "",
    // Never infer outside capital for a new purchase: it might be funded internally.
    // An old account reference is evidence to review, not the owner's confirmation
    // that the cash leg is an internal trade.
    kind: editing?.kind ?? "",
    stockDividendId: editing?.stockDividendId ?? "",
    destinationAssetId: editing?.destinationAssetId ?? (editing?.type === "sell" ? manualTransferAccount : ""),
    sourceAssetId: editing?.sourceAssetId ?? (editing?.type === "buy" ? manualTransferAccount : ""),
  });

  const [files, setFiles] = useState<File[]>([]);
  const selectedAsset = (data?.assets || []).find((asset) => asset.id === form.assetId);
  const mode = selectedAsset ? assetMode(selectedAsset) : "standard";
  const liquidAccounts = (data?.assets || []).filter(
    (asset) => assetMode(asset) === "cash" && asset.id !== form.assetId
  );
  const canKeepManualPair = Boolean(editing?.kind === "transfer" && form.kind === "transfer" &&
    editing.linkedTransactionId && existingPair?.kind === "transfer");

  const total =
    mode === "cash" ? num(form.quantity)
    : mode === "stock" || mode === "fixed" ? num(form.unitPrice)
    : num(form.quantity) * num(form.unitPrice);

  // Explain the selected choice in everyday language without changing its
  // stored `kind`: old transactions must never be classified by the UI itself.
  const moneyKindHelp: Record<string, string> = {
    opening_capital: "فقط اگر این پول برای شروع سرمایه‌گذاری از بیرونِ حساب‌ها و دارایی‌های ثبت‌شده در دارا آمده است؛ قدیمی بودن خرید به‌تنهایی کافی نیست.",
    capital_in: "فقط اگر بعد از شروع، پول تازه‌ای از بیرونِ حساب‌ها و دارایی‌های ثبت‌شده در دارا وارد کرده‌اید؛ جابه‌جایی بین حساب‌ها نیست.",
    capital_out: "فقط اگر پول واقعاً از سرمایه‌گذاری خارج شده است؛ اگر به حساب دیگر خودتان رفته، «جابه‌جایی بین حساب‌ها» را انتخاب کنید.",
    interest: form.type === "sell"
      ? "این ردیف قدیمی برداشت است ولی سود نام‌گذاری شده؛ جهت و دلیل آن را با سند بررسی کنید."
      : "فقط سودی که واقعاً به همین حساب واریز شده است؛ وجه فروش دارایی یا سود مجمع سهام نیست.",
    stock_dividend: "این مبلغ باید همان سود مجمعِ پرداخت‌شده‌ای باشد که قبلاً در بخش بورس ثبت کرده‌اید؛ آن را در فهرست بعدی انتخاب کنید.",
    fee: form.type === "buy"
      ? "این ردیف قدیمی واریز است ولی برگشت هزینه نام‌گذاری شده؛ دلیل آن را با سند بررسی کنید."
      : "فقط هزینه یا کارمزدی که جداگانه از این حساب کم شده؛ کارمزدِ منظورشده در مبلغ معامله را دوباره ثبت نکنید.",
    trade: mode === "cash"
      ? "اگر این مبلغ بابت خرید یا فروش یک دارایی پرداخت یا دریافت شده است؛ اگر فقط بین دو حساب جابه‌جا شده، گزینهٔ جابه‌جایی را بزنید."
      : "پولِ خرید از حسابی که در دارا ثبت کرده‌اید پرداخت شده یا پولِ فروش به آن برگشته؛ حساب واقعی را پایین انتخاب کنید.",
    transfer: "پول فقط از یک حسابِ ثبت‌شده به حسابِ ثبت‌شدهٔ دیگر رفته است؛ حساب مقابل را پایین انتخاب کنید. این پول تازه یا سود نیست.",
    balance_adjustment: "عدد موجودی را تغییر می‌دهد، اما علت پول نامعلوم می‌ماند و هشدارِ گزارش را برطرف نمی‌کند.",
  };
  const explanation = moneyKindHelp[form.kind];
  const selectedMoneyKindHelp = typeof explanation === "string" ? explanation : (editing
    ? "اگر هنوز مطمئن نیستید، ردیف قدیمی را فعلاً تغییر ندهید؛ برای پاک کردن هشدار، ماهیتش را حدس نزنید."
    : "برای ردیف تازه باید منشأ یا مقصد واقعی پول را بدانید؛ اگر نامشخص است، فعلاً آن را ثبت نکنید.");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const quantity = mode === "stock" || mode === "fixed" ? 1 : num(form.quantity);
    const unitPrice = mode === "cash" ? 1 : num(form.unitPrice);
    // Do not erase an old account reference just because an unclassified row's
    // notes were saved without confirming what the cash movement represented.
    if (quantity <= 0 || unitPrice <= 0 || !form.assetId || !form.date ||
        ((!editing || editing.linkedTransactionId || editing.sourceAssetId || editing.destinationAssetId) && !form.kind)) return;
    const cashAccount = (form.type === "buy" ? form.sourceAssetId : form.destinationAssetId);
    if ((form.kind === "trade" || form.kind === "transfer") &&
        (cashAccount ? !liquidAccounts.some((account) => account.id === cashAccount) : !canKeepManualPair)) return;
    if (form.kind === "stock_dividend" && (mode !== "cash" || form.type !== "buy" ||
      !data.stockDividends.some((dividend) => dividend.id === form.stockDividendId && dividend.status === "paid"))) return;

    const id = editing?.id ?? uid("tx");
    try {
      const newAttachments = await Promise.all(
        files.map(async (file) => ({
          id: uid("file"),
          transactionId: id,
          name: file.name,
          type: file.type,
          size: file.size,
          data: await fileToDataUrl(file),
        }))
      );
      const existingAttachments = data.attachments.filter((file) =>
        editing?.attachmentIds.includes(file.id)
      );
      const attachments = [...existingAttachments, ...newAttachments];

      onSave(
        {
          id,
          assetId: form.assetId,
          type: form.type as "buy" | "sell",
          quantity,
          unitPrice,
          totalPrice: total,
          date: form.date,
          notes: form.notes,
          kind: (form.kind || undefined) as Transaction["kind"],
          stockDividendId: form.kind === "stock_dividend" ? form.stockDividendId : undefined,
          sourceAssetId:
            form.type === "buy" && (form.kind === "trade" || form.kind === "transfer")
              ? form.sourceAssetId || undefined : undefined,
          destinationAssetId:
            form.type === "sell" && (form.kind === "trade" || form.kind === "transfer")
              ? form.destinationAssetId || undefined : undefined,
          linkedTransactionId: editing?.linkedTransactionId,
          attachmentIds: attachments.map((file) => file.id),
          createdAt: editing?.createdAt ?? new Date().toISOString(),
        },
        attachments
      );
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Modal
      title={editing ? "ویرایش معامله" : "ثبت معامله جدید"}
      subtitle="تمام مبالغ به تومان محاسبه می‌شوند."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="modal-form">
        <div className="type-toggle">
          <button
            type="button"
            className={form.type === "buy" ? "buy active" : ""}
            onClick={() => setForm({ ...form, type: "buy", kind: "", destinationAssetId: "", stockDividendId: "" })}
          >
            <ArrowDownLeft /> خرید / واریز
          </button>
          <button
            type="button"
            className={form.type === "sell" ? "sell active" : ""}
            onClick={() => setForm({ ...form, type: "sell", kind: "", sourceAssetId: "", stockDividendId: "" })}
          >
            <ArrowUpLeft /> فروش / برداشت
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span>دارایی *</span>
            <select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            >
              {data.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>تاریخ معامله *</span>
            <JalaliDatePicker
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
            />
          </label>
          {mode !== "stock" && mode !== "fixed" && (
            <label>
              <span>{mode === "cash" ? "مبلغ واریز/برداشت (تومان) *" : `تعداد ${selectedAsset?.unit ? `(${selectedAsset.unit})` : ""} *`}</span>
              <input
                required
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
              />
            </label>
          )}
          {mode !== "cash" && (
            <label>
              <span>
                {mode === "stock" || mode === "fixed" ? "مبلغ کل (تومان)" : "قیمت واحد (تومان)"} *
              </span>
              <input
                required
                inputMode="numeric"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                placeholder="0"
              />
            </label>
          )}
        </div>

        <label>
          <span>{form.type === "buy" ? "پول این خرید / واریز از کجا آمده؟ *" : "پول این فروش / برداشت به کجا رفته؟ *"}</span>
          <select
            aria-describedby="transaction-money-kind-help"
            required={!editing || Boolean(editing.linkedTransactionId || editing.sourceAssetId || editing.destinationAssetId)}
            value={form.kind}
            onChange={(e) => setForm({
              ...form,
              kind: e.target.value,
              sourceAssetId: "",
              destinationAssetId: "",
              stockDividendId: e.target.value === "stock_dividend" ? form.stockDividendId : "",
            })}
          >
            <option value="">{editing ? "هنوز نمی‌دانم؛ بعداً بررسی می‌کنم" : "یکی از گزینه‌های زیر را انتخاب کنید"}</option>
            {form.type === "buy" ? (
              <>
                <option value="opening_capital">پولِ شروع سرمایه‌گذاری (از بیرون)</option>
                <option value="capital_in">پول تازهٔ بعدی (از بیرون)</option>
                {mode === "cash" && <option value="interest">سودِ همین حساب واریز شده</option>}
                {mode === "cash" && <option value="stock_dividend">سود مجمع سهام واریز شده</option>}
              </>
            ) : (
              <>
                <option value="capital_out">پول را از سرمایه‌گذاری بیرون بردم</option>
                {mode === "cash" && <option value="fee">کارمزد یا هزینهٔ جداگانه پرداختم</option>}
              </>
            )}
            <option value="trade">{mode === "cash" ? "پرداخت / دریافت بابت خرید یا فروش دارایی" : "خرید / فروش با پولِ حساب ثبت‌شدهٔ خودم"}</option>
            <option value="transfer">پول را بین حساب‌های خودم جابه‌جا کردم</option>
            {editing && <option value="balance_adjustment">فقط موجودی را اصلاح کردم؛ علتش معلوم نیست</option>}
            {editing?.kind === "interest" && form.type === "sell" && <option value="interest">سودِ قدیمی؛ جهت این ردیف را بررسی کنید</option>}
            {editing?.kind === "fee" && form.type === "buy" && <option value="fee">برگشت هزینهٔ قبلی؛ با سند بررسی کنید</option>}
          </select>
          <small id="transaction-money-kind-help" aria-live="polite" style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            {selectedMoneyKindHelp}
          </small>
        </label>

        {form.kind === "stock_dividend" && (
          <label>
            <span>سود مجمع متناظر *</span>
            <select required value={form.stockDividendId} onChange={(event) => {
              const dividend = data.stockDividends.find((item) => item.id === event.target.value);
              setForm({ ...form, stockDividendId: event.target.value,
                ...(!editing && dividend ? { quantity: String(dividend.amount), unitPrice: "1" } : {}) });
            }}>
              <option value="">سود مجمع ثبت‌شده در بخش بورس را انتخاب کنید</option>
              {data.stockDividends.filter((dividend) => dividend.status === "paid").map((dividend) => (
                <option key={dividend.id} value={dividend.id}>
                  {dividend.symbol} · {toPersianDate(dividend.date)} · {money(dividend.amount)}
                </option>
              ))}
            </select>
            <small style={{ color: "var(--muted)", lineHeight: 1.8 }}>
              مبلغ و تاریخ این واریز باید با سود مجمع بخواند. سود دوباره به عملکرد حساب نقدی اضافه نمی‌شود.
            </small>
          </label>
        )}

        {(form.kind === "trade" || form.kind === "transfer") && liquidAccounts.length > 0 && (
          <label>
            <span>{form.type === "buy" ? "پول از کدام حسابِ ثبت‌شده پرداخت شد؟" : "پول به کدام حسابِ ثبت‌شده واریز شد؟"} *</span>
            <select
              required={!canKeepManualPair}
              value={form.type === "buy" ? form.sourceAssetId : form.destinationAssetId}
              onChange={(e) => form.type === "buy"
                ? setForm({ ...form, sourceAssetId: e.target.value })
                : setForm({ ...form, destinationAssetId: e.target.value })}
            >
              <option value="">{canKeepManualPair ? "حسابِ قبلاً پیوندخورده (بدون تغییر)" : "حساب واقعی را انتخاب کنید"}</option>
              {liquidAccounts.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
        )}
        {(form.kind === "trade" || form.kind === "transfer") && liquidAccounts.length === 0 && !canKeepManualPair && (
          <p className="negative-text">ابتدا یک حساب نقدی در بخش دارایی‌ها تعریف کنید، سپس معامله را به آن متصل کنید.</p>
        )}
        {brokenLink ? (
          <p className="negative-text">
            ردیفِ وصل‌شده با تاریخ یا مبلغ این ردیف نمی‌خواند. برای جلوگیری از دست‌کاری پول اشتباه، با ذخیرهٔ این فرم ردیف دیگر تغییر نمی‌کند و واریز تازه‌ای هم ساخته نمی‌شود. هر دو ردیف را با صورت‌حساب بررسی کنید.
          </p>
        ) : editing?.linkedTransactionId && !unconfirmedMatch && (
          <small style={{ color: "var(--muted)" }}>
            این ردیف به ردیف دیگری وصل است: اگر تاریخ یا مبلغ را تغییر دهید، ردیف دیگر هم تغییر می‌کند؛ اگر آن را «پول از بیرون» یا «برداشت به بیرون» کنید، ردیف وصل‌شده حذف می‌شود. اول از اطلاعات خود پشتیبان بگیرید.
          </small>
        )}
        {unconfirmedMatch && (
          <small style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            در حسابی دیگر، مبلغی برابر در همین روز دیده می‌شود، اما معلوم نیست همان پول باشد. بدون انتخاب حساب مرتبط، تغییر این ردیف، آن ردیف را خودکار حذف یا اصلاح نمی‌کند؛ هر دو را با صورت‌حساب بررسی کنید.
          </small>
        )}

        <div className="total-preview">
          <span>مبلغ کل معامله</span>
          <strong>{money(total)}</strong>
        </div>

        {hasTechnicalNote && (
          <div className="transaction-description-preview">
            <b>شرح معاملهٔ مرتبط</b>
            <p>{readableEditingNote}</p>
            <small>این شرح از ردیف‌های ثبت‌شده ساخته شده، نه از تأیید صورت‌حساب. شناسهٔ فنی در یادداشت اصلی محفوظ است تا ارتباط ردیف‌ها از بین نرود.</small>
          </div>
        )}
        {hasTechnicalNote ? (
          <details className="transaction-technical-note">
            <summary>نمایش / ویرایش یادداشت فنیِ اصلی</summary>
            <label>
              <span>متن ذخیره‌شده؛ تغییر شناسه ممکن است ارتباط معامله‌ها را قطع کند</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </details>
        ) : (
          <label>
            <span>توضیحات معامله</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="علت خرید یا فروش، شماره فاکتور، توضیحات کارگزاری…"
            />
          </label>
        )}

        <label className="file-drop">
          <Paperclip />
          <span>
            <b>افزودن فایل پیوست</b>
            <small>تصویر فاکتور، رسید یا سند دلخواه</small>
          </span>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {files.length > 0 && (
          <div className="selected-files">
            {files.map((file) => (
              <span key={file.name}>
                {file.name} · {nf.format(file.size / 1024)} KB
              </span>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            {editing ? "ذخیره تغییرات" : "ثبت معامله"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PriceModalBulk({
  assets,
  history,
  focusAssetId,
  focusHistoryId,
  onClose,
  onSave,
  onEditHistory,
}: {
  assets: Asset[];
  history: PriceHistory[];
  focusAssetId?: string;
  focusHistoryId?: string;
  onClose: () => void;
  onSave: (updates: Array<{ assetId: string; price: number }>, date: string) => void;
  onEditHistory: (id: string, price: number, date: string) => void;
}) {
  // Empty fields mean "leave unchanged"; updating one asset must not stamp all old
  // prices as today's prices or force a fake price for the Bourse/cash ledger.
  const priceableAssets = assets.filter((asset) => !["cash", "stock", "copy"].includes(assetMode(asset)))
    .sort((a, b) => Number(b.id === focusAssetId) - Number(a.id === focusAssetId));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayIso());
  const [editing, setEditing] = useState<{ id: string; price: string; date: string } | null>(() => {
    const record = history.find((item) => item.id === focusHistoryId);
    return record ? { id: record.id, price: String(record.price), date: record.date } : null;
  });
  const [showAllHistory, setShowAllHistory] = useState(false);

  const sortedHistory = [...history].sort((a, b) =>
    Number(b.id === focusHistoryId) - Number(a.id === focusHistoryId) || (b.date || "").localeCompare(a.date || ""));
  const recent = showAllHistory ? sortedHistory : sortedHistory.slice(0, 20);

  return (
    <Modal
      title="به‌روزرسانی و تاریخچه قیمت‌ها"
      subtitle="قیمت جدید دارایی‌ها را ثبت کنید یا رکوردهای قبلی را ویرایش نمایید."
      onClose={onClose}
      wide
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validIsoDate(date) || date > todayIso()) return;
          const updates = priceableAssets
            .filter((asset) => String(prices[asset.id] || "").trim() !== "")
            .map((asset) => ({ assetId: asset.id, price: num(prices[asset.id]) }))
            .filter((item) => item.price > 0);
          if (updates.length) {
            onSave(updates, date);
            onClose();
          }
        }}
      >
        <label>
          <span>تاریخ قیمت‌های جدید</span>
          <JalaliDatePicker value={date} onChange={setDate} />
        </label>
        {!validIsoDate(date) || date > todayIso() ? <small className="negative-text">برای ارزش‌گذاری امروز، تاریخ نرخ باید معتبر و حداکثر امروز باشد.</small> : null}
        <div className="bulk-price-list">
          {priceableAssets.map((asset) => (
            <label className={`bulk-price-row ${focusAssetId === asset.id ? "focused" : ""}`} key={asset.id}>
              <span>
                <b>{asset.name}</b>
                <small>قیمت فعلی: {money(asset.currentPrice)}</small>
              </span>
              <input
                autoFocus={focusAssetId === asset.id}
                inputMode="numeric"
                value={prices[asset.id] ?? ""}
                onChange={(e) => setPrices({ ...prices, [asset.id]: e.target.value })}
                placeholder="قیمت جدید (خالی = بدون تغییر)"
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary" disabled={!validIsoDate(date) || date > todayIso() || !priceableAssets.some((asset) => num(prices[asset.id]) > 0)}>
            ثبت قیمت‌های جدید
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <div className="price-history" style={{ padding: "0 22px 22px" }}>
          <h3 style={{ margin: "16px 0 10px", fontSize: "14px" }}>آخرین قیمت‌های ثبت‌شده در تاریخچه</h3>
          <div style={{ display: "grid", gap: "8px", maxHeight: editing ? undefined : "200px", overflowY: editing ? "visible" : "auto" }}>
            {recent.map((item) => {
              const asset = assets.find((a) => a.id === item.assetId);
              const isEditing = editing?.id === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f8faf9",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  <b>{asset?.name ?? "دارایی"}</b>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <JalaliDatePicker value={editing.date} onChange={(nextDate) => setEditing({ ...editing, date: nextDate })} />
                      <input
                        value={editing.price}
                        inputMode="numeric"
                        style={{ width: "120px", minHeight: "32px" }}
                        onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                      />
                      <button
                        type="button"
                        className="button primary"
                        style={{ minHeight: "32px", padding: "0 10px" }}
                        disabled={num(editing.price) <= 0 || !validIsoDate(editing.date) || editing.date > todayIso()}
                        onClick={() => {
                          if (num(editing.price) <= 0 || !validIsoDate(editing.date) || editing.date > todayIso()) return;
                          onEditHistory(item.id, num(editing.price), editing.date);
                          setEditing(null);
                        }}
                      >
                        ذخیره
                      </button>
                      {(!validIsoDate(editing.date) || editing.date > todayIso()) && <small className="negative-text">تاریخ صحیح را انتخاب کنید.</small>}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                      <span>{money(item.price)}</span>
                      <small style={{ color: "var(--muted)" }}>{toPersianDate(item.date)}</small>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setEditing({ id: item.id, price: String(item.price), date: item.date })
                        }
                      >
                        ویرایش
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {history.length > 20 && (
            <button type="button" className="button ghost small-btn" style={{ marginTop: "10px" }} onClick={() => setShowAllHistory((previous) => !previous)}>
              {showAllHistory ? "نمایش کمتر" : `نمایش همهٔ ${nf.format(history.length)} قیمت ثبت‌شده`}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function StockPriceHistoryModal({
  history,
  focusId,
  onClose,
  onSave,
  onDelete,
}: {
  history: StockPrice[];
  focusId?: string;
  onClose: () => void;
  onSave: (price: StockPrice) => void;
  onDelete: (price: StockPrice) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; symbol: string; date: string; price: string } | null>(() => {
    const record = history.find((item) => item.id === focusId);
    return record ? { id: record.id, symbol: String(record.symbol ?? ""), date: String(record.date ?? ""), price: String(record.price ?? "") } : null;
  });
  const [showAll, setShowAll] = useState(false);
  const ordered = [...history].sort((a, b) =>
    Number(b.id === focusId) - Number(a.id === focusId) || String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const recent = showAll ? ordered : ordered.slice(0, 20);
  const canSave = Boolean(editing && editing.symbol.trim() && num(editing.price) > 0 &&
    validIsoDate(editing.date) && editing.date <= todayIso());

  return (
    <Modal title="تاریخچهٔ قیمت سهام" subtitle="هر نرخ پایانی را با تاریخ و نماد واقعی آن تطبیق دهید؛ اصلاح رکورد، دادهٔ دیگری را تغییر نمی‌دهد." onClose={onClose} wide>
      {editing && (
        <form className="modal-form" onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          const record = history.find((item) => item.id === editing.id);
          if (!record) return;
          onSave({ ...record, symbol: editing.symbol.trim(), date: editing.date, price: num(editing.price) });
          setEditing(null);
        }}>
          <b>اصلاح رکورد قیمت سهام</b>
          <div className="form-grid">
            <label><span>نماد *</span><input required value={editing.symbol} onChange={(event) => setEditing({ ...editing, symbol: event.target.value })} /></label>
            <label><span>تاریخ نرخ *</span><JalaliDatePicker value={editing.date} onChange={(date) => setEditing({ ...editing, date })} /></label>
            <label><span>قیمت پایانی (تومان) *</span><input required inputMode="decimal" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /></label>
          </div>
          {!validIsoDate(editing.date) || editing.date > todayIso() ? <small className="negative-text">تاریخ نرخ باید معتبر باشد و از امروز جلوتر نباشد.</small> : null}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>انصراف</button>
            <button type="submit" className="button primary" disabled={!canSave}>ذخیرهٔ اصلاح قیمت</button>
            <button type="button" className="button ghost" onClick={() => {
              const record = history.find((item) => item.id === editing.id);
              if (record) onDelete(record);
            }}>حذف با تأیید</button>
          </div>
        </form>
      )}
      <div className="price-history" style={{ padding: "0 22px 22px" }}>
        <h3 style={{ fontSize: "14px" }}>رکوردهای ثبت‌شده ({nf.format(history.length)})</h3>
        {recent.length ? <div className="table-wrapper"><table className="data-table">
          <thead><tr><th>نماد</th><th>تاریخ</th><th>قیمت پایانی</th><th>عملیات</th></tr></thead>
          <tbody>{recent.map((item) => <tr key={item.id}>
            <td>{item.symbol || "نماد نامشخص"}</td>
            <td>{toPersianDate(item.date)}</td>
            <td>{money(item.price)}</td>
            <td><button type="button" className="button ghost small-btn" onClick={() => setEditing({ id: item.id, symbol: String(item.symbol ?? ""), date: String(item.date ?? ""), price: String(item.price ?? "") })}>ویرایش</button></td>
          </tr>)}</tbody>
        </table></div> : <p>هنوز قیمتی ثبت نشده است؛ از فرم به‌روزرسانی نرخ‌ها در بخش بورس استفاده کنید.</p>}
        {history.length > 20 && <button type="button" className="button ghost small-btn" style={{ marginTop: "10px" }} onClick={() => setShowAll((previous) => !previous)}>{showAll ? "نمایش کمتر" : `نمایش همهٔ ${nf.format(history.length)} نرخ`}</button>}
      </div>
    </Modal>
  );
}

export function StockOrderModal({
  order,
  onClose,
  onSave,
  existingSymbols = [],
  cashAccounts = [],
}: {
  order?: StockOrder | null;
  onClose: () => void;
  onSave: (order: StockOrder) => void;
  existingSymbols?: string[];
  cashAccounts?: Asset[];
}) {
  const isNew = !order;
  const [form, setForm] = useState({
    symbol: order?.symbol ?? (existingSymbols[0] || ""),
    type: order?.type ?? "buy",
    quantity: order ? String(order.quantity) : "",
    unitPrice: order ? String(order.unitPrice) : "",
    totalPrice: order ? String(order.totalPrice) : "",
    date: order?.date ?? todayIso(),
    notes: order?.notes ?? "",
    commission: String(order?.commission ?? 0),
    sourceAssetId: order?.sourceAssetId ?? (cashAccounts.find((asset) => asset.id === "asset-hami") || cashAccounts[0])?.id ?? "",
  });

  const handleQtyOrRateChange = (qtyStr: string, rateStr: string, commStr: string, type: "buy" | "sell") => {
    const q = num(qtyStr);
    const r = num(rateStr);
    const c = num(commStr);
    if (q > 0 && r > 0) {
      const raw = q * r;
      const net = type === "buy" ? Math.round(raw + c) : Math.round(raw - c);
      setForm((prev) => ({
        ...prev,
        quantity: qtyStr,
        unitPrice: rateStr,
        totalPrice: String(net > 0 ? net : raw),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        quantity: qtyStr,
        unitPrice: rateStr,
      }));
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const quantity = num(form.quantity);
    const totalPrice = num(form.totalPrice) || Math.round(quantity * num(form.unitPrice));
    const symbol = form.symbol.trim();
    if (quantity <= 0 || totalPrice <= 0 || !symbol || !cashAccounts.some((asset) => asset.id === form.sourceAssetId)) return;

    const unitPriceVal = num(form.unitPrice) || Math.round(totalPrice / quantity);
    const commVal = num(form.commission);
    if (commVal < 0) return;
    const action = form.type === "buy" ? "خرید" : "فروش";
    const line1 = `${action} ${nf.format(quantity)} سهم ${symbol} در قیمت ${money(unitPriceVal)}`;
    const line2 = `هزینه‌ها ${money(commVal)}`;
    const defaultNote = `${line1}\n${line2}`;

    onSave({
      id: order?.id || uid("stock-order"),
      symbol,
      type: form.type as "buy" | "sell",
      quantity,
      unitPrice: unitPriceVal,
      totalPrice,
      date: form.date,
      notes: form.notes || defaultNote,
      commission: commVal,
      sourceAssetId: form.sourceAssetId,
      sourceKey: order?.sourceKey || `${form.date}|${form.type}|${symbol}|${quantity}|${form.unitPrice}|${totalPrice}`,
      // Preserve a stored time, but do not invent one for a new order.
      time: order?.time,
    });
    onClose();
  };

  const defaultSymbols = Array.from(new Set([...existingSymbols, "کیان", "وبملت", "تلیسه", "سخزر", "برکت", "وآذر", "فسبزوار", "غدانه", "کنور", "غشان", "درهآور", "بموتو", "آکو", "تبرک", "احیا"]));

  return (
    <Modal
      title={isNew ? "ثبت معامله جدید بورس" : `ویرایش معامله ${order?.symbol || "بورس"}`}
      subtitle="برداشت/واریز متناظر این معامله در حساب تسویهٔ انتخاب‌شده ثبت و هم‌گام می‌شود."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            <span>نماد سهام / صندوق</span>
            <input
              required
              autoFocus={isNew}
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              placeholder="مثلاً: کیان، برکت، وبملت…"
              list="stock-symbols-list"
            />
            <datalist id="stock-symbols-list">
              {defaultSymbols.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label>
            <span>نوع معامله</span>
            <select
              value={form.type}
              onChange={(event) => {
                const nextType = event.target.value as "buy" | "sell";
                setForm({ ...form, type: nextType });
                handleQtyOrRateChange(form.quantity, form.unitPrice, form.commission, nextType);
              }}
            >
              <option value="buy">خرید سهام (برداشت از حساب تسویه)</option>
              <option value="sell">فروش سهام (واریز به حساب تسویه)</option>
            </select>
          </label>
        </div>

        <div className="form-grid">
          <label>
            <span>تعداد سهم</span>
            <input
              required
              inputMode="numeric"
              value={form.quantity}
              onChange={(event) =>
                handleQtyOrRateChange(event.target.value, form.unitPrice, form.commission, form.type as "buy" | "sell")
              }
              placeholder="مثال: ۱۰,۰۰۰"
            />
          </label>
          <label>
            <span>نرخ هر سهم (تومان)</span>
            <input
              required
              inputMode="numeric"
              value={form.unitPrice}
              onChange={(event) =>
                handleQtyOrRateChange(form.quantity, event.target.value, form.commission, form.type as "buy" | "sell")
              }
              placeholder="مثال: ۵۰۰"
            />
          </label>
          <label>
            <span>کارمزد / عوارض (تومان)</span>
            <input
              inputMode="numeric"
              value={form.commission}
              onChange={(event) => {
                const nextComm = event.target.value;
                setForm({ ...form, commission: nextComm });
                handleQtyOrRateChange(form.quantity, form.unitPrice, nextComm, form.type as "buy" | "sell");
              }}
              placeholder="۰"
            />
          </label>
          <label>
            <span>مبلغ خالص معامله (تومان)</span>
            <input
              required
              inputMode="numeric"
              value={form.totalPrice}
              onChange={(event) => setForm({ ...form, totalPrice: event.target.value })}
              placeholder="تعداد × نرخ ± کارمزد"
            />
          </label>
        </div>

        {num(form.totalPrice) > 0 && (
          <div className="total-preview">
            <span>مبلغ تسویه نقدی در حساب انتخاب‌شده:</span>
            <strong>{money(num(form.totalPrice))}</strong>
          </div>
        )}

        <label>
          <span>تاریخ معامله</span>
          <JalaliDatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </label>
        <label>
          <span>حساب تسویهٔ معامله *</span>
          <select required value={form.sourceAssetId} onChange={(event) => setForm({ ...form, sourceAssetId: event.target.value })}>
            <option value="">حساب نقدی را انتخاب کنید</option>
            {cashAccounts.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          {!cashAccounts.length && <small className="negative-text">برای ثبت معاملهٔ بورس، ابتدا یک حساب نقدی در بخش دارایی‌ها تعریف کنید.</small>}
        </label>
        <label>
          <span>توضیحات و یادداشت</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="علت معامله، استراتژی یا توضیحات تکمیلی…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary">
            {isNew ? "ثبت معامله بورس" : "ذخیره تغییرات"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function StockSymbolTradesModal({
  symbol,
  orders,
  dayOrder,
  cashAccounts,
  onClose,
  onEditOrder,
}: {
  symbol: string;
  orders: StockOrder[];
  dayOrder?: PortfolioData["settings"]["transactionDayOrder"];
  cashAccounts: Asset[];
  onClose: () => void;
  onEditOrder: (order: StockOrder) => void;
}) {
  const [editingOrder, setEditingOrder] = useState<StockOrder | null>(null);

  const list = orders
    .filter((item) => item.symbol === symbol)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") ||
      compareRowsWithinDay(dayOrder,
        { date: a.date, orderKey: ledgerRowKey("stockOrder", a.id) },
        { date: b.date, orderKey: ledgerRowKey("stockOrder", b.id) }));

  return (
    <>
      <Modal title={`سوابق معاملات ${symbol}`} onClose={onClose} wide>
        <div style={{ padding: "18px 22px" }}>
          <div className="stock-orders-head">
            <span>نوع معامله</span>
            <span>تعداد و نرخ</span>
            <span>مبلغ نهایی</span>
            <span>تاریخ و عملیات</span>
          </div>
          <div className="stock-orders-list">
            {list.length === 0 ? (
              <div className="empty-state">معامله‌ای برای این نماد ثبت نشده است.</div>
            ) : (
              list.map((order) => (
                <div key={order.id}>
                  <span className={order.type === "buy" ? "negative-text" : "positive-text"}>
                    <b>{order.type === "buy" ? "خرید" : "فروش"}</b>
                  </span>
                  <span>
                    {nf.format(order.quantity)} سهم
                    <small>{money(order.unitPrice)}</small>
                  </span>
                  <b>{money(order.totalPrice)}</b>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>
                      {toPersianDate(order.date)}
                      {order.commission ? <small>کارمزد: {money(order.commission)}</small> : null}
                    </span>
                    <button
                      type="button"
                      className="button ghost"
                      style={{ minHeight: "30px", padding: "4px 8px", fontSize: "11px" }}
                      onClick={() => setEditingOrder(order)}
                    >
                      <Pencil size={13} /> ویرایش
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {editingOrder && (
        <StockOrderModal
          order={editingOrder}
          cashAccounts={cashAccounts}
          onClose={() => setEditingOrder(null)}
          onSave={(updated) => {
            onEditOrder(updated);
            setEditingOrder(null);
          }}
        />
      )}
    </>
  );
}

export function StockDividendModal({
  symbol,
  symbols = [],
  dividends,
  initialDividend,
  onClose,
  onSave,
  onToggleStatus,
  onDelete,
  onShowTransactions,
}: {
  symbol?: string | null;
  symbols?: string[];
  dividends: StockDividend[];
  initialDividend?: StockDividend | null;
  onClose: () => void;
  onSave: (dividend: StockDividend) => void;
  onToggleStatus: (dividend: StockDividend, targetStatus?: "pending" | "paid") => void;
  onDelete?: (id: string) => void;
  onShowTransactions?: () => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialDividend?.symbol || symbol || (symbols[0] ?? "")
  );
  const [amount, setAmount] = useState(
    initialDividend?.amount ? Number(initialDividend.amount).toLocaleString("en-US") : ""
  );
  const [date, setDate] = useState(initialDividend?.date || todayIso());
  const [status, setStatus] = useState<"pending" | "paid">(initialDividend?.status || "pending");
  const [receivedOutside, setReceivedOutside] = useState(Boolean(initialDividend?.receivedOutside));
  const [notes, setNotes] = useState(initialDividend?.notes || "");
  const [editingId, setEditingId] = useState<string | null>(initialDividend?.id || null);

  const activeSymbol = selectedSymbol || symbol || "";
  const symbolDividends = activeSymbol
    ? dividends.filter((item) => item.symbol === activeSymbol)
    : dividends;

  const handleEditClick = (item: StockDividend) => {
    setEditingId(item.id);
    setSelectedSymbol(item.symbol);
    setAmount(item.amount ? Number(item.amount).toLocaleString("en-US") : "");
    setDate(item.date);
    setStatus(item.status);
    setReceivedOutside(Boolean(item.receivedOutside));
    setNotes(item.notes || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAmount("");
    setDate(todayIso());
    setStatus("pending");
    setReceivedOutside(false);
    setNotes("");
  };

  return (
    <Modal
      title={activeSymbol ? `سود مجمع نماد ${activeSymbol}` : "مدیریت سودهای مجمع (DPS)"}
      onClose={onClose}
      wide
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = num(amount);
          if (parsed > 0 && activeSymbol) {
            onSave({
              id: editingId || uid("div"),
              symbol: activeSymbol,
              amount: parsed,
              date,
              status,
              receivedOutside: status === "paid" && receivedOutside ? true : undefined,
              notes: notes.trim() || undefined,
            });
            handleCancelEdit();
          }
        }}
      >
        <div className="form-grid">
          {symbols.length > 0 && (
            <label>
              <span>نماد سهام *</span>
              <select
                value={activeSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                disabled={Boolean(editingId)}
              >
                {symbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            <span>مبلغ سود مجمع (تومان) *</span>
            <input
              required
              autoFocus
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const clean = toEnglishDigits(e.target.value).replace(/[,٬،\s]/g, "");
                const digits = clean.replace(/[^\d]/g, "");
                setAmount(digits ? Number(digits).toLocaleString("en-US") : "");
              }}
              placeholder="مثلاً: ۱۲,۵۰۰,۰۰۰"
            />
            {num(amount) > 0 && (
              <small style={{ color: "var(--primary)", marginTop: "4px", display: "block", fontSize: "12px", fontWeight: 600 }}>
                معادل: {money(num(amount))}
              </small>
            )}
          </label>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
            وضعیت سود مجمع *
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className={`button small-btn ${status === "paid" ? "primary" : "secondary"}`}
              style={{
                flex: 1,
                background: status === "paid" ? "#0b8a63" : undefined,
                color: status === "paid" ? "#fff" : undefined,
                borderColor: status === "paid" ? "#0b8a63" : undefined,
              }}
              onClick={() => setStatus("paid")}
            >
              <Check size={14} /> محقق‌شده (واریزشده به حساب / سجام)
            </button>
            <button
              type="button"
              className={`button small-btn ${status === "pending" ? "primary" : "secondary"}`}
              style={{
                flex: 1,
                background: status === "pending" ? "#d97706" : undefined,
                color: status === "pending" ? "#fff" : undefined,
                borderColor: status === "pending" ? "#d97706" : undefined,
              }}
              onClick={() => setStatus("pending")}
            >
              ⏳ محقق‌نشده (در انتظار پرداخت طبق زمان‌بندی)
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
            {status === "paid"
              ? "سود مجمع یک بار در عملکرد بورس محاسبه می‌شود. محل دریافت آن را برای تطبیق ارزش سبد مشخص کنید."
              : "⏳ سود در مجمع تصویب شده اما هنوز به حساب واریز نشده است (به عنوان سود در انتظار لحاظ می‌گردد)."}
          </p>
          {status === "paid" && (
            <>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px" }}>
                <input type="checkbox" checked={receivedOutside} onChange={(event) => setReceivedOutside(event.target.checked)} style={{ width: "auto", marginTop: "5px" }} />
                <span>تأیید می‌کنم این سود <b>بیرون از حساب‌های ثبت‌شده در سبد</b> دریافت شده است (مثلاً حساب شخصی ثبت‌نشده). اگر در حساب داخل سبد بوده، این گزینه را نزنید؛ واریز را در معاملات با ماهیت «دریافت سود مجمع» ثبت/ویرایش و به همین مجمع وصل کنید.</span>
              </label>
              {onShowTransactions && <button type="button" className="button secondary small-btn" style={{ marginTop: "10px" }} onClick={onShowTransactions}>بررسی / ثبت واریز در معاملات</button>}
            </>
          )}
        </div>

        <div className="form-grid">
          <label>
            <span>تاریخ مجمع / واریز</span>
            <JalaliDatePicker value={date} onChange={setDate} />
          </label>

          <label>
            <span>یادداشت / مجمع سال مالی</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً سود مصوب سال مالی ۱۴۰۲، واریز سجام"
            />
          </label>
        </div>

        <div className="modal-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          {editingId && (
            <button type="button" className="button secondary" onClick={handleCancelEdit}>
              انصراف از ویرایش
            </button>
          )}
          <button type="submit" className="button primary">
            {editingId ? "ویرایش و ذخیره سود مجمع" : "ثبت سود مجمع"}
          </button>
        </div>
      </form>

      {symbolDividends.length > 0 && (
        <div className="dividend-ledger" style={{ padding: "16px 22px 22px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h3 style={{ margin: 0 }}>سوابق و وضعیت سودهای مجمع {activeSymbol && `(${activeSymbol})`}</h3>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              مجموع: {money(symbolDividends.reduce((s, d) => s + d.amount, 0))}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {symbolDividends.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "10px 14px",
                  background: "var(--bg-alt)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: "140px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <b className="stock-symbol">{item.symbol}</b>
                    <b>{money(item.amount)}</b>
                  </div>
                  <small style={{ display: "block", color: "var(--muted)", marginTop: "2px" }}>
                    {toPersianDate(item.date)} {item.notes ? `· ${item.notes}` : ""}
                  </small>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {/* Two-button toggle for exact state selection */}
                  <div style={{ display: "inline-flex", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)", padding: "2px" }}>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: item.status === "paid" ? "#0b8a63" : "transparent",
                        color: item.status === "paid" ? "#fff" : "var(--muted)",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title="کلیک برای تنظیم به عنوان محقق‌شده (واریز شده)"
                      onClick={() => item.status !== "paid" && onToggleStatus(item, "paid")}
                    >
                      ✓ محقق‌شده
                    </button>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: item.status === "pending" ? "#d97706" : "transparent",
                        color: item.status === "pending" ? "#fff" : "var(--muted)",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title="کلیک برای تنظیم به عنوان محقق‌نشده (در انتظار)"
                      onClick={() => item.status !== "pending" && onToggleStatus(item, "pending")}
                    >
                      ⏳ محقق‌نشده
                    </button>
                  </div>

                  <button
                    type="button"
                    className="button ghost small-btn"
                    title="ویرایش این سود مجمع"
                    onClick={() => handleEditClick(item)}
                  >
                    <Pencil size={13} />
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      className="button ghost small-btn negative-text"
                      title="حذف این سود مجمع"
                      onClick={() => {
                        if (window.confirm(`آیا از حذف سود مجمع ${money(item.amount)} نماد ${item.symbol} مطمئن هستید؟`)) {
                          onDelete(item.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AssetTransactionsModal({
  asset,
  data,
  transactions,
  stockOrders,
  focusTransactionId,
  onClose,
  onEditTx,
  onDeleteTx,
  onAddTx,
  onEditOrder,
  onDeleteOrder,
  onAddOrder,
}: {
  asset: Asset;
  data: PortfolioData;
  transactions: Transaction[];
  stockOrders?: StockOrder[];
  focusTransactionId?: string;
  onClose: () => void;
  onEditTx?: (tx: Transaction) => void;
  onDeleteTx?: (tx: Transaction) => void;
  onAddTx?: () => void;
  onEditOrder?: (order: StockOrder) => void;
  onDeleteOrder?: (id: string) => void;
  onAddOrder?: () => void;
}) {
  const [filterType, setFilterType] = useState<"all" | "buy" | "sell">("all");
  const [symbolQuery, setSymbolQuery] = useState("");
  const isBourse = asset.name === "بورس";
  const isCash = assetMode(asset) === "cash";

  // Filter regular asset transactions
  const assetTxs = transactions
    .filter((tx) => tx.assetId === asset.id)
    .sort((a, b) => Number(b.id === focusTransactionId) - Number(a.id === focusTransactionId) ||
      (b.date || "").localeCompare(a.date || "") ||
      compareRowsWithinDay(data.settings.transactionDayOrder,
        { date: a.date, orderKey: ledgerRowKey("transaction", a.id) },
        { date: b.date, orderKey: ledgerRowKey("transaction", b.id) }) ||
      (b.createdAt || "").localeCompare(a.createdAt || ""));

  const filteredTxs = assetTxs.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    return true;
  });

  // A cash account has no trustworthy intraday ordering for backfilled entries.
  // Show the same day-end balance alongside every row of that day, not a made-up
  // running balance based on the time the owner entered a transaction.
  const cashDayEnd = new Map<string, number>();
  if (isCash) {
    const dayChanges = new Map<string, number>();
    for (const tx of assetTxs) {
      if (!validIsoDate(tx.date) || tx.date > todayIso() || !hasValidTradeAmounts(tx)) continue;
      dayChanges.set(tx.date, (dayChanges.get(tx.date) || 0) +
        (tx.type === "buy" ? 1 : -1) * tx.totalPrice);
    }
    let balance = 0;
    for (const date of [...dayChanges.keys()].sort()) {
      balance += dayChanges.get(date)!;
      cashDayEnd.set(date, balance);
    }
  }

  const orders = [...(stockOrders || [])].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") ||
    compareRowsWithinDay(data.settings.transactionDayOrder,
      { date: a.date, orderKey: ledgerRowKey("stockOrder", a.id) },
      { date: b.date, orderKey: ledgerRowKey("stockOrder", b.id) })
  );

  const filteredOrders = orders.filter((order) => {
    if (filterType !== "all" && order.type !== filterType) return false;
    if (symbolQuery.trim() && !order.symbol.toLowerCase().includes(symbolQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate totals
  const totalBuy = isBourse
    ? orders.filter((o) => o.type === "buy").reduce((sum, o) => sum + safeNumber(o.totalPrice), 0)
    : assetTxs.filter((tx) => tx.type === "buy").reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);

  const totalSell = isBourse
    ? orders.filter((o) => o.type === "sell").reduce((sum, o) => sum + safeNumber(o.totalPrice), 0)
    : assetTxs.filter((tx) => tx.type === "sell").reduce((sum, tx) => sum + safeNumber(tx.totalPrice), 0);

  const totalRowsCount = isBourse ? orders.length : assetTxs.length;

  return (
    <Modal
      title={isCash ? `گردش حساب «${asset.name}»` : `سوابق معاملات دارایی «${asset.name}»`}
      subtitle={isCash ? "ماندهٔ پایان هر روز از ردیف‌های ثبت‌شده محاسبه شده است؛ با صورت‌حساب واقعی تطبیق دهید." : `مشاهده و مدیریت تمام معاملات ثبت‌شده برای ${asset.name} (${asset.category || "دارایی"})`}
      onClose={onClose}
      wide
    >
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Quick Summary Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 16px",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>تعداد کل معاملات</span>
            <b style={{ fontSize: "15px" }}>{nf.format(totalRowsCount)} معامله</b>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>{isCash ? "مجموع واریزهای ثبت‌شده" : "مجموع خریدها"}</span>
            <b className={isCash ? "positive-text" : "negative-text"} style={{ fontSize: "15px" }}>{money(totalBuy)}</b>
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>{isCash ? "مجموع برداشت‌های ثبت‌شده" : "مجموع فروش‌ها"}</span>
            <b className={isCash ? "negative-text" : "positive-text"} style={{ fontSize: "15px" }}>{money(totalSell)}</b>
          </div>
          {asset.unit && (
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>واحد سنجش</span>
              <b style={{ fontSize: "15px" }}>{asset.unit}</b>
            </div>
          )}
        </div>
        {isCash && <small style={{ color: "var(--muted)", lineHeight: 1.8 }}>
          واریز به این حساب، لزوماً آوردهٔ بیرونی نیست. ماندهٔ پایان روز برای همهٔ ردیف‌های هم‌تاریخ یکسان نمایش داده می‌شود؛ ترتیب واقعی درون آن روز و موجودی ثبت‌نشدهٔ اولیه را از صورت‌حساب بررسی کنید.
        </small>}
        {focusTransactionId && assetTxs.some((tx) => tx.id === focusTransactionId) && (
          <small style={{ color: "var(--primary)", lineHeight: 1.8 }}>ردیف مرتبطِ انتخاب‌شده برای بررسی در ابتدای جدول نشان داده شده است؛ برای اصلاح، ابتدا سند هر دو طرف را تطبیق دهید.</small>
        )}

        {/* Toolbar with filter and Add button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`button small-btn ${filterType === "all" ? "primary" : "secondary"}`}
              onClick={() => setFilterType("all")}
            >
              همه ({totalRowsCount})
            </button>
            <button
              type="button"
              className={`button small-btn ${filterType === "buy" ? "primary" : "secondary"}`}
              onClick={() => setFilterType("buy")}
            >
              {isCash ? "واریز" : "خرید"} ({isBourse ? orders.filter((o) => o.type === "buy").length : assetTxs.filter((t) => t.type === "buy").length})
            </button>
            <button
              type="button"
              className={`button small-btn ${filterType === "sell" ? "primary" : "secondary"}`}
              onClick={() => setFilterType("sell")}
            >
              {isCash ? "برداشت" : "فروش"} ({isBourse ? orders.filter((o) => o.type === "sell").length : assetTxs.filter((t) => t.type === "sell").length})
            </button>

            {isBourse && (
              <input
                type="text"
                placeholder="فیلتر نماد (برکت، کیان...)"
                value={symbolQuery}
                onChange={(e) => setSymbolQuery(e.target.value)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  width: "150px",
                }}
              />
            )}
          </div>

          {(isBourse ? onAddOrder : onAddTx) && (
            <button
              type="button"
              className="button primary small-btn"
              onClick={isBourse ? onAddOrder : onAddTx}
            >
              + ثبت معامله جدید برای {asset.name}
            </button>
          )}
        </div>

        {/* Special banner for Bourse if managed via stock orders */}
        {isBourse && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(11, 118, 104, 0.08)",
              border: "1px solid rgba(11, 118, 104, 0.2)",
              borderRadius: "10px",
              fontSize: "12px",
              lineHeight: "1.6",
            }}
          >
            💡 دارایی بورس شامل <b>{nf.format(orders.length)} سفارش سهام</b> در بازار است که تسویه نقدینگی آن‌ها به‌صورت خودکار با صندوق حامی هم‌گام شده است. شما می‌توانید هر معامله را مستقیماً ویرایش یا حذف فرمایید.
          </div>
        )}

        {/* Transactions Table */}
        <div className="table-wrapper" style={{ maxHeight: "420px", overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isCash ? "ماهیت گردش" : "نوع معامله"}</th>
                {isBourse && <th>نماد</th>}
                <th>تاریخ</th>
                {!isCash && <th>مقدار / تعداد</th>}
                {!isCash && <th>نرخ واحد (تومان)</th>}
                <th>مبلغ کل (تومان)</th>
                {isCash && <th>ماندهٔ پایان روز</th>}
                <th>توضیحات</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {isBourse ? (
                filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      معامله‌ای برای بورس با این فیلتر یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <span className={`pill-badge ${order.type === "buy" ? "negative" : "positive"}`}>
                          {order.type === "buy" ? "خرید سهام" : "فروش سهام"}
                        </span>
                      </td>
                      <td>
                        <b style={{ color: "var(--primary)" }}>{order.symbol}</b>
                      </td>
                      <td>{toPersianDate(order.date)}</td>
                      <td>
                        <b>{nf.format(order.quantity)}</b> سهم
                      </td>
                      <td>{money(order.unitPrice)}</td>
                      <td>
                        <b>{money(order.totalPrice)}</b>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "12px", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                        {order.notes || "—"}
                        {order.commission ? ` · کارمزد: ${money(order.commission)}` : ""}
                      </td>
                      <td>
                        <div className="table-actions">
                          {onEditOrder && (
                            <button
                              type="button"
                              className="button ghost small-btn"
                              title="ویرایش معامله بورس"
                              onClick={() => onEditOrder(order)}
                            >
                              <Pencil size={13} /> ویرایش
                            </button>
                          )}
                          {onDeleteOrder && (
                            <button
                              type="button"
                              className="button ghost small-btn negative-text"
                              title="حذف معامله بورس"
                              onClick={() => onDeleteOrder(order.id)}
                            >
                              <Trash2 size={13} /> حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={isCash ? 6 : 7} className="empty-state">
                      معامله‌ای برای این دارایی با فیلتر انتخابی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map((tx) => (
                    <tr key={tx.id} className={tx.id === focusTransactionId ? "capital-focused-transaction" : ""}>
                      <td>
                        <span className={`pill-badge ${isCash ? (tx.type === "buy" ? "positive" : "negative") : (tx.type === "buy" ? "negative" : "positive")}`}>
                          {isCash ? transactionLabel(tx, asset) : tx.type === "buy" ? "خرید" : "فروش"}
                        </span>
                      </td>
                      <td>{toPersianDate(tx.date)}</td>
                      {!isCash && <td><b>{nf.format(tx.quantity)}</b> {asset.unit || "واحد"}</td>}
                      {!isCash && <td>{money(tx.unitPrice)}</td>}
                      <td><b>{money(tx.totalPrice)}</b></td>
                      {isCash && <td className={(cashDayEnd.get(tx.date) ?? 0) < -0.01 ? "negative-text" : ""}>
                        {validIsoDate(tx.date) && tx.date <= todayIso() && hasValidTradeAmounts(tx) && cashDayEnd.has(tx.date)
                          ? money(cashDayEnd.get(tx.date)!) : "این ردیف در ماندهٔ امروز لحاظ نشده"}
                      </td>}
                      <td style={{ color: "var(--muted)", fontSize: "12px", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                        {describeTransactionNote(data, tx) || "—"}
                      </td>
                      <td>
                        <div className="table-actions">
                          {onEditTx && (
                            <button
                              type="button"
                              className="button ghost small-btn"
                              title="ویرایش معامله"
                              onClick={() => onEditTx(tx)}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {onDeleteTx && (
                            <button
                              type="button"
                              className="button ghost small-btn negative-text"
                              title="حذف معامله"
                              onClick={() => onDeleteTx(tx)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export function CapitalIncreaseModal({
  onClose,
  onSave,
  assets,
  targetAssetId = "asset-bank",
  initialSource = "آورده نقدی جدید",
  beforeDate,
}: {
  onClose: () => void;
  onSave: (amount: number, date: string, source: string, note: string, targetAssetId: string, initial: boolean) => void;
  assets: Asset[];
  targetAssetId?: string;
  initialSource?: string;
  beforeDate?: string;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(targetAssetId);
  const [amount, setAmount] = useState("");
  // When opened from an old shortfall, today is NOT a valid default for its funding.
  const [date, setDate] = useState(beforeDate ? "" : todayIso());
  const [source, setSource] = useState(initialSource);
  const [isInitial, setIsInitial] = useState(initialSource === "سرمایه اولیه");
  const [note, setNote] = useState("");

  const numAmount = num(amount);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0 || !validIsoDate(date) || date > todayIso() || (beforeDate && date > beforeDate)) return;
    onSave(numAmount, date, source, note, selectedAssetId, isInitial);
    onClose();
  };

  const commonSources = [
    "آورده نقدی جدید",
    "حقوق / درآمد ماهانه",
    "پس‌انداز شخصی",
    "سود کسب‌وکار",
    "سرمایه اولیه",
    "فروش دارایی خارجی",
  ];

  return (
    <Modal
      title="افزایش سرمایه و تزریق نقدینگی"
      subtitle="ثبت ورود سرمایه و آوردهٔ نقدی جدید به حساب بانک یا سایر حساب‌های نقدینگی پورتفو"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={save}>
        <label>
          <span>حساب مقصد دریافت آورده</span>
          <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
            {assets
              .filter((a) => assetMode(a) === "cash")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.category || "نقدینگی"})
                </option>
              ))}
          </select>
        </label>

        <label>
          <span>زمان ورود این پول به سبد</span>
          <select value={isInitial ? "initial" : "later"} onChange={(e) => setIsInitial(e.target.value === "initial")}>
            <option value="initial">آوردهٔ اولیه (پول شروع سرمایه‌گذاری)</option>
            <option value="later">آوردهٔ جدید پس از شروع</option>
          </select>
          <small style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            اگر این پول قبلاً با خرید دارایی یا اصلاح مانده در سبد آمده، ردیف قبلی را ویرایش کنید؛ ثبت دوباره مبلغ سبد را بیشتر از واقع نشان می‌دهد.
          </small>
        </label>
        <label>
          <span>مبلغ افزایش سرمایه (تومان)</span>
          <input
            required
            autoFocus
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const clean = toEnglishDigits(e.target.value).replace(/[,٬،\s]/g, "");
              const digits = clean.replace(/[^\d]/g, "");
              setAmount(digits ? Number(digits).toLocaleString("en-US") : "");
            }}
            placeholder="مثال: ۱۰,۰۰۰,۰۰۰"
          />
          {numAmount > 0 && (
            <small style={{ color: "var(--primary)", marginTop: "4px", display: "block" }}>
              معادل: {money(numAmount)}
            </small>
          )}
        </label>

        <label>
          <span>منبع یا عنوان آورده</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            {commonSources.map((s) => (
              <button
                key={s}
                type="button"
                className={`button small-btn ${source === s ? "primary" : "ghost"}`}
                style={{ fontSize: "11px", padding: "4px 8px", minHeight: "auto" }}
                onClick={() => { setSource(s); if (s === "سرمایه اولیه") setIsInitial(true); }}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="عنوان منبع آورده..."
          />
        </label>

        <label>
          <span>تاریخ واقعی واریز وجه *</span>
          <JalaliDatePicker value={date} onChange={setDate} referenceDate={beforeDate} maxDate={beforeDate || todayIso()} />
          {beforeDate && <small style={{ color: "var(--muted)", lineHeight: 1.8 }}>برای توضیح کسری تاریخی، واریز باید با سند واقعی در تاریخ {toPersianDate(beforeDate)} یا قبل از آن انجام شده باشد. تاریخ امروز پیش‌فرض نشده است؛ انتقال موجود را دوباره ثبت نکنید.</small>}
          {beforeDate && date && date > beforeDate && <small className="negative-text">این تاریخ بعد از کسری حساب است و آن را رفع نمی‌کند.</small>}
        </label>

        <label>
          <span>یادداشت و توضیحات تکمیلی (اختیاری)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="شماره پیگیری واریز، بانک مبدأ یا هرگونه توضیح…"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="button primary" disabled={numAmount <= 0 || !validIsoDate(date) || date > todayIso() || Boolean(beforeDate && date > beforeDate)}>
            ثبت افزایش سرمایه {numAmount > 0 ? `(${money(numAmount)})` : ""}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LiquidityTransferModal({
  onClose,
  onSave,
  assets,
  defaultFromId = "asset-bank",
  defaultToId = "asset-hami",
}: {
  onClose: () => void;
  onSave: (fromAssetId: string, toAssetId: string, amount: number, date: string, note: string) => void;
  assets: Asset[];
  defaultFromId?: string;
  defaultToId?: string;
}) {
  const liquidityAssets = assets.filter(
    (a) =>
      a.id === "asset-bank" ||
      a.id === "asset-hami" ||
      a.id === "asset-kian" ||
      a.id === "asset-deposit-cash" ||
      a.name.includes("دفتر گواهی") ||
      a.category === "نقد" ||
      a.category === "صندوق درآمد ثابت" ||
      a.category === "دفتر نقدینگی"
  );

  const [fromId, setFromId] = useState(defaultFromId);
  const [toId, setToId] = useState(
    defaultToId === defaultFromId
      ? liquidityAssets.find((a) => a.id !== defaultFromId)?.id || ""
      : defaultToId
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const numAmount = num(amount);
  const fromAsset = assets.find((a) => a.id === fromId);
  const toAsset = assets.find((a) => a.id === toId);

  const swapAccounts = () => {
    const temp = fromId;
    setFromId(toId);
    setToId(temp);
  };

  const quickTemplates = [
    { label: "شارژ کارگزاری (بانک ➔ حامی)", from: "asset-bank", to: "asset-hami", note: "واریز وجه به کارگزاری مفید" },
    { label: "برداشت سود/نقد (حامی ➔ بانک)", from: "asset-hami", to: "asset-bank", note: "تقاضای وجه از کارگزاری به بانک" },
    { label: "شارژ دفتر گواهی سپرده (بانک ➔ دفتر گواهی)", from: "asset-bank", to: "asset-deposit-cash", note: "واریز وجه به حساب بورس کالا (دفتر گواهی سپرده)" },
    { label: "برداشت از دفتر گواهی سپرده (دفتر گواهی ➔ بانک)", from: "asset-deposit-cash", to: "asset-bank", note: "تقاضای وجه از دفتر گواهی سپرده به بانک" },
    { label: "جابجایی بین حامی و دفتر گواهی (حامی ➔ دفتر گواهی)", from: "asset-hami", to: "asset-deposit-cash", note: "انتقال نقدینگی از حامی به دفتر گواهی سپرده" },
    { label: "سرمایه‌گذاری کیان (بانک ➔ کیان)", from: "asset-bank", to: "asset-kian", note: "صدور واحدهای صندوق کیان از بانک" },
    { label: "ابطال کیان به بانک (کیان ➔ بانک)", from: "asset-kian", to: "asset-bank", note: "ابطال واحدهای صندوق کیان و واریز به بانک" },
    { label: "جابجایی کارگزاری و کیان (حامی ➔ کیان)", from: "asset-hami", to: "asset-kian", note: "انتقال وجه از صندوق حامی به صندوق کیان" },
  ];

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0 || fromId === toId) return;
    onSave(fromId, toId, numAmount, date, note);
    onClose();
  };

  return (
    <Modal
      title="مدیریت و جابجایی نقدینگی"
      subtitle="انتقال مستقیم نقدینگی بین حساب‌های بانکی، صندوق حامی، صندوق کیان و دفتر گواهی سپرده"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={save}>
        {/* Quick transfer templates */}
        <div style={{ marginBottom: "10px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "6px" }}>
            الگوهای پرتکرار جابجایی بین حساب‌ها:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {quickTemplates.map((tpl, i) => (
              <button
                key={i}
                type="button"
                className="button ghost small-btn"
                style={{ fontSize: "11px", padding: "4px 8px", minHeight: "auto" }}
                onClick={() => {
                  setFromId(tpl.from);
                  setToId(tpl.to);
                  setNote(tpl.note);
                }}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "center" }}>
          <label style={{ margin: 0 }}>
            <span>حساب مبدا (کسر وجه)</span>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {liquidityAssets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === toId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="button secondary"
            style={{ marginTop: "18px", padding: "8px 12px", minHeight: "42px" }}
            onClick={swapAccounts}
            title="جابجایی مبدا و مقصد"
          >
            ⇄
          </button>

          <label style={{ margin: 0 }}>
            <span>حساب مقصد (افزایش وجه)</span>
            <select value={toId} onChange={(e) => setToId(e.target.value)}>
              {liquidityAssets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === fromId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>مبلغ انتقال (تومان)</span>
          <input
            required
            autoFocus
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const clean = toEnglishDigits(e.target.value).replace(/[,٬،\s]/g, "");
              const digits = clean.replace(/[^\d]/g, "");
              setAmount(digits ? Number(digits).toLocaleString("en-US") : "");
            }}
            placeholder="مثال: ۵۰,۰۰۰,۰۰۰"
          />
          {numAmount > 0 && (
            <small style={{ color: "var(--primary)", marginTop: "4px", display: "block" }}>
              معادل: {money(numAmount)}
            </small>
          )}
        </label>

        <label>
          <span>تاریخ انتقال</span>
          <JalaliDatePicker value={date} onChange={setDate} />
        </label>

        <label>
          <span>شرح / یادداشت انتقال</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`علت جابجایی بین ${fromAsset?.name || "مبدا"} و ${toAsset?.name || "مقصد"}…`}
          />
        </label>

        {fromId === toId && (
          <div style={{ color: "var(--danger)", fontSize: "12px" }}>
            حساب مبدا و مقصد نمی‌توانند یکسان باشند.
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            انصراف
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={numAmount <= 0 || fromId === toId}
          >
            ثبت انتقال وجه {numAmount > 0 ? `(${money(numAmount)})` : ""}
          </button>
        </div>
      </form>
    </Modal>
  );
}
