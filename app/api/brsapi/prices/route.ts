import { NextResponse } from "next/server";

interface NormalizedPriceItem {
  l18: string;
  l30: string;
  pc: number;
  pl: number;
  py?: number;
}

// 1. Direct TSETMC CDN (REST JSON API - Works natively in Iran without any API key)
async function fetchFromTsetmcCdn(): Promise<NormalizedPriceItem[]> {
  const url =
    "https://cdn.tsetmc.com/api/ClosingPrice/GetMarketWatch?market=0&showAll=true";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://tsetmc.com/",
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`TSETMC CDN status ${res.status}`);
    }

    const data = await res.json();
    const rawList = data?.marketwatch || data?.marketWatch || data?.data || [];
    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new Error("TSETMC CDN returned empty list");
    }

    const result: NormalizedPriceItem[] = [];
    for (const item of rawList) {
      const l18 = (
        item.l18 ||
        item.lVal18 ||
        item.symbol ||
        item.lVal18AFC ||
        ""
      ).trim();
      const l30 = (item.l30 || item.lVal30 || item.name || "").trim();
      const pc = Number(item.pc ?? item.pClosing ?? item.closingPrice) || 0;
      const pl = Number(item.pl ?? item.pDrCotVal ?? item.lastPrice) || 0;
      const py = Number(item.py ?? item.priceYesterday) || 0;

      if (l18 && (pc > 0 || pl > 0)) {
        result.push({
          l18,
          l30: l30 || l18,
          pc: pc || pl,
          pl: pl || pc,
          py,
        });
      }
    }

    if (result.length === 0) {
      throw new Error("No valid price items parsed from TSETMC CDN");
    }
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// 2. Direct TSETMC Classic (MarketWatchPlus.aspx - Works natively in Iran)
async function fetchFromTsetmcClassic(): Promise<NormalizedPriceItem[]> {
  const url = "http://old.tsetmc.com/tsev2/data/MarketWatchPlus.aspx";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "http://old.tsetmc.com/",
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`TSETMC Classic status ${res.status}`);
    }

    const text = await res.text();
    if (!text || !text.includes(";")) {
      throw new Error("TSETMC Classic returned unexpected format");
    }

    const parts = text.split("@");
    const rows = parts[0] ? parts[0].split(";") : [];
    const result: NormalizedPriceItem[] = [];

    for (const row of rows) {
      if (!row) continue;
      const cols = row.split(",");
      if (cols.length < 8) continue;
      const l18 = cols[2]?.trim();
      const l30 = cols[3]?.trim();
      const pc = parseFloat(cols[6]) || 0;
      const pl = parseFloat(cols[7]) || 0;
      const py = parseFloat(cols[13]) || 0;

      if (l18 && (pc > 0 || pl > 0)) {
        result.push({
          l18,
          l30: l30 || l18,
          pc: pc || pl,
          pl: pl || pc,
          py,
        });
      }
    }

    if (result.length === 0) {
      throw new Error("No valid price items parsed from TSETMC Classic");
    }
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// 3. BrsApi service (when user configures BRSAPI_KEY in environment)
async function fetchFromBrsApi(apiKey: string): Promise<NormalizedPriceItem[]> {
  const upstreamUrl = `https://Api.BrsApi.ir/Tsetmc/AllSymbols.php?key=${encodeURIComponent(
    apiKey
  )}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Dara-Portfolio/1.0",
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`BrsApi HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error(
        data?.message_error || data?.message || "BrsApi response is not an array"
      );
    }

    const result: NormalizedPriceItem[] = [];
    for (const item of data) {
      const l18 = (item.l18 || item.l30 || item.symbol || "").trim();
      const l30 = (item.l30 || item.name || l18).trim();
      const pc = Number(item.pclosing ?? item.pc) || 0;
      const pl = Number(item.pl ?? item.lastPrice) || 0;

      if (l18 && (pc > 0 || pl > 0)) {
        result.push({
          l18,
          l30,
          pc: pc || pl,
          pl: pl || pc,
        });
      }
    }

    if (result.length === 0) {
      throw new Error("BrsApi returned 0 usable symbol prices");
    }
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function GET() {
  const customKey = process.env.BRSAPI_KEY?.trim();

  // 1. If user provided their own BRSAPI key, try it first
  if (customKey && customKey !== "FreeSV0E1LSgB9RDjuf0QorSLViX8pPG") {
    try {
      const items = await fetchFromBrsApi(customKey);
      return NextResponse.json(items);
    } catch (err) {
      console.warn("BrsApi with custom key failed, attempting TSETMC directly:", err);
    }
  }

  // 2. Direct official TSETMC CDN (works natively in Iran without any API key)
  try {
    const items = await fetchFromTsetmcCdn();
    return NextResponse.json(items);
  } catch (cdnErr) {
    console.warn("TSETMC CDN failed, trying TSETMC Classic gateway:", cdnErr);
  }

  // 3. Classic TSETMC Gateway
  try {
    const items = await fetchFromTsetmcClassic();
    return NextResponse.json(items);
  } catch (classicErr) {
    console.warn("TSETMC Classic gateway failed:", classicErr);
  }

  // 4. Return helpful Persian error message
  const message = customKey
    ? "ارتباط با سرویس‌های قیمت بورس (TSETMC و BrsApi) با خطا مواجه شد. در صورت روشن بودن VPN، لطفاً آن را غیرفعال کنید یا اتصال اینترنت خود را بررسی نمایید."
    : "امکان دریافت خودکار قیمت‌ها از بورس (TSETMC) فراهم نشد. اگر فیلترشکن (VPN) روشن است، لطفاً آن را خاموش کنید تا اتصال مستقیم به بورس برقرار شود، یا کلید رایگان brsapi.ir را در متغیر BRSAPI_KEY فایل .env.local قرار دهید.";

  return NextResponse.json(
    { error: message },
    { status: 503 }
  );
}
