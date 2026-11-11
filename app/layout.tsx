import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دارا | مدیریت آفلاین پرتفوی",
  description: "ابزار فارسی و آفلاین مدیریت سرمایه‌گذاری و دارایی‌های شخصی",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
