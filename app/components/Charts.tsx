"use client";

import { useState } from "react";
import { money, toPersianDate } from "../lib/portfolio";

export function LineChart({
  points,
  color = "#0f766e",
  valueKey = "value",
}: {
  points: Array<{ date: string; value: number; profit?: number }>;
  color?: string;
  valueKey?: "value" | "profit";
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!points.length) return <div className="empty-chart">هنوز داده‌ای برای نمایش وجود ندارد.</div>;
  const values = points.map((point) => (valueKey === "profit" ? point.profit ?? 0 : point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((value, index) => ({
    x: points.length === 1 ? 500 : 36 + (index / (points.length - 1)) * 928,
    y: 205 - ((value - min) / range) * 160,
  }));
  const line = coords.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L 964 220 L 36 220 Z`;
  const active = hovered === null ? null : { point: coords[hovered], value: values[hovered], date: points[hovered].date };

  return (
    <div className="chart-wrap" onMouseLeave={() => setHovered(null)}>
      <div className="chart-top-label">{money(max)}</div>
      {active && <div className="chart-tooltip" style={{ left: `${(active.point.x / 1000) * 100}%`, top: `${(active.point.y / 240) * 100}%` }}><b>{toPersianDate(active.date)}</b><span>{money(active.value)}</span></div>}
      <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="line-chart" aria-label="نمودار خطی">
        <defs>
          <linearGradient id={`fill-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".24" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[45, 98, 151, 205].map((y) => <line key={y} x1="36" x2="964" y1={y} y2={y} className="grid-line" />)}
        <path d={area} fill={`url(#fill-${valueKey})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.3" vectorEffect="non-scaling-stroke" />
        {coords.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={hovered === index ? "7" : "4"} fill="var(--panel, #fff)" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" onMouseEnter={() => setHovered(index)} style={{ cursor: "pointer" }} />
        ))}
      </svg>
      <div className="chart-axis">
        <span>{toPersianDate(points[0].date)}</span>
        <span>{toPersianDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  // Negative cash is included in net equity, but not a slice of a positive allocation chart.
  const positiveTotal = segments.filter((item) => item.value > 0).reduce((sum, item) => sum + item.value, 0);
  const gradient = segments
    .filter((item) => item.value > 0)
    .reduce<{ parts: string[]; cursor: number }>(
      (acc, item) => {
        const start = acc.cursor;
        const end = start + (positiveTotal ? (item.value / positiveTotal) * 100 : 0);
        return {
          parts: [...acc.parts, `${item.color} ${start}% ${end}%`],
          cursor: end,
        };
      },
      { parts: [], cursor: 0 }
    )
    .parts.join(", ");
  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: gradient ? `conic-gradient(${gradient})` : "#e5e7eb" }}>
        <div className="donut-hole">
          <span>{total < positiveTotal - 1 ? "خالص پس از کسری" : "ارزش کل"}</span>
          <strong>{money(total).replace(" تومان", "")}</strong>
          <small>تومان</small>
        </div>
      </div>
      <div className="legend">
        {segments.filter((item) => item.value > 0).map((item) => (
          <div className="legend-row" key={item.label}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{positiveTotal ? `${((item.value / positiveTotal) * 100).toFixed(1)}٪` : "۰٪"}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="bar-chart">
      {items.filter((item) => item.value > 0).map((item) => (
        <div className="bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
          </div>
          <b>{money(item.value)}</b>
        </div>
      ))}
    </div>
  );
}
