"use client";

import { useMemo, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { nf, persianDatePart, validIsoDate } from "../lib/portfolio";

const week = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function partsFromIso(value: string) {
  const date = validIsoDate(value) ? new Date(`${value}T12:00:00`) : new Date();
  const j = toJalaali(date);
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}

function isoFromJalali(jy: number, jm: number, jd: number) {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

export function JalaliDatePicker({ value, onChange, allowEmpty = false, referenceDate, maxDate }: { value: string; onChange: (value: string) => void; allowEmpty?: boolean; referenceDate?: string; maxDate?: string }) {
  const initial = partsFromIso(value || referenceDate || "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm });
  const selected = partsFromIso(value);
  const days = useMemo(() => {
    const first = isoFromJalali(view.jy, view.jm, 1);
    const start = (new Date(`${first}T12:00:00`).getDay() + 1) % 7;
    const length = jalaaliMonthLength(view.jy, view.jm);
    return [...Array(start).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  }, [view]);

  const move = (amount: number) => {
    let jm = view.jm + amount;
    let jy = view.jy;
    if (jm > 12) { jm = 1; jy += 1; }
    if (jm < 1) { jm = 12; jy -= 1; }
    setView({ jy, jm });
  };
  const invalidValue = Boolean(value && !validIsoDate(value));
  const display = invalidValue ? "تاریخ نامعتبر؛ اصلاح کنید" : value
    ? `${persianDatePart(selected.jy)}/${persianDatePart(selected.jm, 2)}/${persianDatePart(selected.jd, 2)}` : "انتخاب تاریخ";

  return (
    <div className="date-picker">
      <button type="button" className="date-input" onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={18} />
        <span>{display}</span>
      </button>
      {open && (
        <>
          <button className="picker-backdrop" aria-label="بستن تقویم" onClick={() => setOpen(false)} />
          <div className="calendar-popover">
            <div className="calendar-head">
              <button type="button" onClick={() => move(-1)}><ChevronRight size={18} /></button>
              <b>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(new Date(`${isoFromJalali(view.jy, view.jm, 1)}T12:00:00`))}</b>
              <button type="button" onClick={() => move(1)}><ChevronLeft size={18} /></button>
            </div>
            <div className="calendar-grid">
              {week.map((day) => <span className="weekday" key={day}>{day}</span>)}
              {days.map((day, index) => day ? (
                <button
                  type="button"
                  key={index}
                  className={value && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day ? "selected" : ""}
                  disabled={Boolean(maxDate && isoFromJalali(view.jy, view.jm, day) > maxDate)}
                  onClick={() => { onChange(isoFromJalali(view.jy, view.jm, day)); setOpen(false); }}
                >
                  {nf.format(day)}
                </button>
              ) : <span key={index} />)}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "7px" }}>
              {(!maxDate || new Date().toISOString().slice(0, 10) <= maxDate) && (
                <button type="button" className="today-button" style={{ flex: 1, marginTop: 0 }} onClick={() => { onChange(new Date().toISOString().slice(0, 10)); setOpen(false); }}>
                  امروز
                </button>
              )}
              {allowEmpty && (
                <button type="button" className="today-button" style={{ flex: 1, marginTop: 0, color: "#ca4545", background: "#fef2f2" }} onClick={() => { onChange(""); setOpen(false); }}>
                  پاک‌کردن
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
