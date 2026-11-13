import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionModal } from "../components/Modals";
import { emptyData } from "./portfolio";
import type { Asset, PortfolioData, Transaction } from "./types";

const date = "2026-11-01";
const assets: Asset[] = [
  { id: "bank", name: "بانک", category: "نقد", currentPrice: 1, color: "#123", createdAt: date },
  { id: "hami", name: "حامی", category: "نقد", currentPrice: 1, color: "#456", createdAt: date },
  { id: "gold", name: "طلا", category: "طلا آبشده", currentPrice: 1, color: "#789", createdAt: date },
];
const data: PortfolioData = { ...emptyData(), assets };
function tx(id: string, assetId: string, type: "buy" | "sell", kind?: Transaction["kind"]): Transaction {
  return { id, assetId, type, kind, quantity: 100, unitPrice: 1, totalPrice: 100,
    date, createdAt: `${date}T10:00:00Z`, attachmentIds: [] };
}
function render(editing: Transaction | null, assetId = "bank", portfolio = data) {
  return renderToStaticMarkup(createElement(TransactionModal, {
    data: portfolio, editing, defaultAssetId: assetId, onClose: () => {}, onSave: () => {},
  }));
}
function kindOptions(markup: string) {
  const select = markup.match(/<select aria-describedby="transaction-money-kind-help"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(select, "money source/destination field must be labelled for assistive technology");
  return select;
}

test("new cash deposit uses plain choices while preserving every stored kind", () => {
  const markup = render(null);
  const options = kindOptions(markup);
  assert.match(markup, /پول این خرید \/ واریز از کجا آمده؟/);
  for (const kind of ["opening_capital", "capital_in", "interest", "stock_dividend", "trade", "transfer"]) {
    assert.match(options, new RegExp(`<option value="${kind}">`));
  }
  assert.match(options, /پولِ شروع سرمایه‌گذاری \(از بیرون\)/);
  assert.match(options, /پول تازهٔ بعدی \(از بیرون\)/);
  assert.match(options, /پرداخت \/ دریافت بابت خرید یا فروش دارایی/);
  assert.match(options, /پول را بین حساب‌های خودم جابه‌جا کردم/);
  assert.doesNotMatch(options, /value="capital_out"|value="fee"|value="balance_adjustment"/);
  assert.match(markup, /برای ردیف تازه باید منشأ یا مقصد واقعی پول را بدانید/);
});

test("existing unclassified purchase stays undecided and explains internal payment", () => {
  const markup = render(tx("gold-purchase", "gold", "buy"));
  const options = kindOptions(markup);
  assert.match(options, /<option value="" selected="">هنوز نمی‌دانم؛ بعداً بررسی می‌کنم<\/option>/);
  assert.match(options, /خرید \/ فروش با پولِ حساب ثبت‌شدهٔ خودم/);
  assert.match(options, /value="balance_adjustment"/);
  assert.doesNotMatch(options, /value="interest"|value="stock_dividend"/);
  assert.match(markup, /اگر هنوز مطمئن نیستید، ردیف قدیمی را فعلاً تغییر ندهید/);
});

test("cash withdrawal describes money leaving the portfolio, not a transfer", () => {
  const markup = render(tx("withdrawal", "bank", "sell", "capital_out"));
  const options = kindOptions(markup);
  assert.match(markup, /پول این فروش \/ برداشت به کجا رفته؟/);
  assert.match(options, /<option value="capital_out" selected="">پول را از سرمایه‌گذاری بیرون بردم<\/option>/);
  assert.match(options, /value="fee"/);
  assert.doesNotMatch(options, /value="opening_capital"|value="capital_in"|value="interest"/);
  assert.match(markup, /اگر به حساب دیگر خودتان رفته، «جابه‌جایی بین حساب‌ها» را انتخاب کنید/);
});

test("linked cash transfer asks for the real account and warns before changing its other row", () => {
  const out = { ...tx("bank-out", "bank", "sell", "transfer"), linkedTransactionId: "hami-in" };
  const incoming = { ...tx("hami-in", "hami", "buy", "transfer"), linkedTransactionId: "bank-out" };
  const markup = render(out, "bank", { ...data, transactions: [out, incoming] });
  assert.match(kindOptions(markup), /<option value="transfer" selected="">پول را بین حساب‌های خودم جابه‌جا کردم<\/option>/);
  assert.match(markup, /پول به کدام حسابِ ثبت‌شده واریز شد؟/);
  assert.match(markup, /اگر تاریخ یا مبلغ را تغییر دهید، ردیف دیگر هم تغییر می‌کند/);
  assert.match(markup, /این پول تازه یا سود نیست/);
});
