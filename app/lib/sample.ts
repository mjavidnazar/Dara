import type { PortfolioData } from "./types";

export const latestPortfolioData: PortfolioData = {
  version: 1,
  assets: [
    {
      id: "asset-1785511934378-drglbz",
      name: "طلا آب شده",
      category: "طلا آبشده",
      unit: "گرم",
      currentPrice: 23473000,
      color: "#dc2626",
      notes: "",
      createdAt: "2026-07-31T15:32:14.378Z"
    },
    {
      "id": "asset-1785512828077-ax9v5m",
      name: "کپی ترید",
      category: "کپی ترید",
      unit: "دلار",
      currentPrice: 228227,
      copyUsdBalance: 1991,
      copyUsdRate: 193800,
      color: "#2563eb",
      notes: "",
      createdAt: "2026-07-31T15:47:08.077Z"
    },
    {
      "id": "asset-1785513179157-pqlcpi",
      name: "تتر",
      category: "تتر",
      unit: "عدد",
      currentPrice: 228227,
      color: "#db2777",
      notes: "",
      createdAt: "2026-07-31T15:52:59.157Z"
    },
    {
      "id": "asset-stocks",
      name: "بورس",
      category: "بورس",
      unit: "پرتفوی سهام",
      currentPrice: 0,
      color: "#2563eb",
      createdAt: "2026-07-31T16:40:16.408Z"
    },
    {
      "id": "asset-hami",
      name: "صندوق درآمد ثابت حامی",
      category: "صندوق درآمد ثابت",
      unit: "تومان",
      currentPrice: 1,
      annualInterestRate: 0,
      color: "#0f766e",
      createdAt: "2026-07-31T16:40:16.408Z"
    },
    {
      "id": "asset-1785608652930-xfw41r",
      name: "مس",
      category: "گواهی سپرده مس",
      unit: "کیلوگرم",
      currentPrice: 2627778,
      color: "#0f766e",
      notes: "",
      isDepositCertificate: true,
      depositSymbol: "CopperCthd(گواهی سپرده پیوسته مس کاتد)",
      createdAt: "2026-08-01T18:24:12.930Z"
    },
    {
      "id": "asset-1785609191710-4tyzha",
      name: "میلگرد",
      category: "گواهی سپرده میلگرد",
      unit: "کیلوگرم",
      currentPrice: 73484,
      color: "#65a30d",
      notes: "",
      isDepositCertificate: true,
      depositSymbol: "SteelRebar(گواهی سپرده پیوسته میلگرد)",
      createdAt: "2026-08-01T18:33:11.710Z"
    },
    {
      id: "asset-kian",
      name: "صندوق درآمد ثابت کیان",
      category: "صندوق درآمد ثابت",
      unit: "تومان",
      currentPrice: 1,
      color: "#7c3aed",
      createdAt: "2026-08-01T19:06:18.503Z"
    },
    {
      id: "asset-bank",
      name: "بانک",
      category: "نقد",
      unit: "تومان",
      currentPrice: 1,
      color: "#475569",
      createdAt: "2026-08-01T19:06:18.503Z"
    },
    {
      id: "asset-1787669955484-cftd5s",
      name: "روی",
      category: "گواهی سپرده روی",
      unit: "کیلوگرم",
      currentPrice: 670257,
      color: "#7c3aed",
      notes: "",
      isDepositCertificate: true,
      depositSymbol: "ZincIngot(گواهی سپرده پیوسته شمش روی)",
      createdAt: "2026-08-25T15:25:55.484Z"
    },
    {
      id: "asset-deposit-cash",
      name: "دفتر گواهی سپرده",
      category: "دفتر نقدینگی",
      unit: "تومان",
      currentPrice: 1,
      annualInterestRate: 0,
      color: "#0284c7",
      notes: "حساب نقدینگی و تسویه معاملات گواهی سپرده کالایی بورس کالا",
      createdAt: "2026-08-01T19:06:18.503Z"
    }
  ],
  transactions: [
    {
      id: "tx-1785512315965-he1h0z",
      assetId: "asset-1785511934378-drglbz",
      type: "buy",
      quantity: 91,
      unitPrice: 16358250,
      totalPrice: 1488600750,
      date: "2026-01-25",
      notes: "۹ عدد سکه امامی که تبدیل به آبشده شد.\nقیمت هر سکه در ۵ بهمن ۱۶۵.۴۰۰.۰۰۰ بود.",
      attachmentIds: [],
      createdAt: "2026-07-31T15:38:35.965Z"
    },
    {
      id: "tx-1785512962114-xjysgb",
      assetId: "asset-1785512828077-ax9v5m",
      type: "buy",
      quantity: 5000,
      unitPrice: 154200,
      totalPrice: 771000000,
      date: "2026-01-28",
      notes: "واریز 5000 دلاری اول",
      attachmentIds: [],
      createdAt: "2026-07-31T15:49:22.114Z"
    },
    {
      id: "tx-1785513032025-wutlru",
      assetId: "asset-1785512828077-ax9v5m",
      type: "buy",
      quantity: 2000,
      unitPrice: 164700,
      totalPrice: 329400000,
      date: "2026-02-09",
      notes: "واریزی دوم 2000 دلار",
      attachmentIds: [],
      createdAt: "2026-07-31T15:50:32.026Z"
    },
    {
      id: "tx-1785513283047-cb61zi",
      assetId: "asset-1785513179157-pqlcpi",
      type: "buy",
      quantity: 1098.9,
      unitPrice: 182000,
      totalPrice: 199999800.00000003,
      date: "2026-05-12",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-07-31T15:54:43.047Z"
    },
    {
      id: "tx-1785513317321-iqp9pt",
      assetId: "asset-1785513179157-pqlcpi",
      type: "buy",
      quantity: 1724.13,
      unitPrice: 174000,
      totalPrice: 299998620,
      date: "2026-05-23",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-07-31T15:55:17.321Z"
    },
    {
      id: "tx-1785513361416-a4astt",
      assetId: "asset-1785513179157-pqlcpi",
      type: "buy",
      quantity: 1795.94,
      unitPrice: 167000,
      totalPrice: 299921980,
      date: "2026-05-23",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-07-31T15:56:01.416Z"
    },
    {
      id: "tx-1785513415068-w403l3",
      assetId: "asset-1785513179157-pqlcpi",
      type: "buy",
      quantity: 1935.29,
      unitPrice: 155000,
      totalPrice: 299969950,
      date: "2026-06-16",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-07-31T15:56:55.068Z"
    },
    {
      id: "tx-1785608886896-c2ri2t",
      assetId: "asset-1785608652930-xfw41r",
      type: "buy",
      quantity: 828,
      unitPrice: 1810712,
      totalPrice: 1499269536,
      date: "2026-02-08",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-08-01T18:28:06.896Z"
    },
    {
      id: "tx-1785609016818-lyicju",
      assetId: "asset-1785608652930-xfw41r",
      type: "buy",
      quantity: 165,
      unitPrice: 2305516,
      totalPrice: 380410140,
      date: "2026-06-20",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-08-01T18:30:16.818Z"
    },
    {
      id: "tx-1785609384020-5diow7",
      assetId: "asset-1785609191710-4tyzha",
      type: "buy",
      quantity: 5357,
      unitPrice: 56134,
      totalPrice: 300709838,
      date: "2026-06-14",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-08-01T18:36:24.020Z"
    },
    {
      id: "tx-1785609526087-b2wdfg",
      assetId: "asset-1785609191710-4tyzha",
      type: "buy",
      quantity: 5831,
      unitPrice: 51443,
      totalPrice: 299964133,
      date: "2026-06-17",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-08-01T18:38:46.087Z"
    },
    {
      id: "tx-1785609589532-0kb982",
      assetId: "asset-1785609191710-4tyzha",
      type: "buy",
      quantity: 11,
      unitPrice: 54290,
      totalPrice: 597190,
      date: "2026-06-20",
      notes: "",
      attachmentIds: [],
      createdAt: "2026-08-01T18:39:49.532Z"
    },
    {
      id: "kian-balance-1785611539131-4liw33",
      assetId: "asset-kian",
      type: "buy",
      quantity: 898884588,
      unitPrice: 1,
      totalPrice: 898884588,
      date: "2026-08-01",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-01T19:12:19.131Z"
    },
    {
      id: "kian-balance-1785667786561-xnd51k",
      assetId: "asset-kian",
      type: "buy",
      quantity: 1398583,
      unitPrice: 1,
      totalPrice: 1398583,
      date: "2026-08-02",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-02T10:49:46.561Z"
    },
    {
      id: "kian-balance-1786026538030-0emzss",
      assetId: "asset-kian",
      type: "buy",
      quantity: 3782915,
      unitPrice: 1,
      totalPrice: 3782915,
      date: "2026-08-06",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-06T14:28:58.030Z"
    },
    {
      id: "hami-interest-1786813335568-ffbclf",
      assetId: "asset-hami",
      type: "buy",
      quantity: 10678247.4,
      unitPrice: 1,
      totalPrice: 10678247.4,
      date: "2026-07-22",
      notes: "بابت سود طرح سرمایه گذاری حامی تیر 1405 [hami|2026-07-22|10678247.4|بابت سود طرح سرمایه گذاری حامی تیر 1405]",
      attachmentIds: [],
      createdAt: "2026-08-15T17:02:15.568Z",
      kind: "interest"
    },
    {
      id: "hami-interest-1786813335568-yx5dfg",
      assetId: "asset-hami",
      type: "buy",
      quantity: 8093869,
      unitPrice: 1,
      totalPrice: 8093869,
      date: "2026-06-21",
      notes: "بابت سود طرح سرمایه گذاری حامی خرداد 1405 [hami|2026-06-21|8093869|بابت سود طرح سرمایه گذاری حامی خرداد 1405]",
      attachmentIds: [],
      createdAt: "2026-08-15T17:02:15.568Z",
      kind: "interest"
    },
    {
      id: "broker-cash-1405-03-04-hami",
      assetId: "asset-hami",
      type: "buy",
      quantity: 1200000000,
      unitPrice: 1,
      totalPrice: 1200000000,
      date: "2026-05-25",
      notes: "واریز از بانک به حامی [broker-cash-1405-03-04]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-25"
    },
    {
      id: "broker-cash-1405-03-04-bank",
      assetId: "asset-bank",
      type: "sell",
      quantity: 1200000000,
      unitPrice: 1,
      totalPrice: 1200000000,
      date: "2026-05-25",
      notes: "واریز از بانک به حامی [broker-cash-1405-03-04]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-25"
    },
    {
      id: "broker-cash-1405-03-23-hami",
      assetId: "asset-hami",
      type: "buy",
      quantity: 150000000,
      unitPrice: 1,
      totalPrice: 150000000,
      date: "2026-06-13",
      notes: "واریز از بانک به حامی [broker-cash-1405-03-23]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-13"
    },
    {
      id: "broker-cash-1405-03-23-bank",
      assetId: "asset-bank",
      type: "sell",
      quantity: 150000000,
      unitPrice: 1,
      totalPrice: 150000000,
      date: "2026-06-13",
      notes: "واریز از بانک به حامی [broker-cash-1405-03-23]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-13"
    },
    {
      id: "tx-1787499133747-8x4rp0",
      assetId: "asset-1785511934378-drglbz",
      type: "sell",
      quantity: 41.41,
      unitPrice: 21650000,
      totalPrice: 896526499.9999999,
      date: "2026-08-23",
      notes: "دو تکه طلا آبشده به جویا فروخته شد.",
      destinationAssetId: "asset-bank",
      attachmentIds: [],
      createdAt: "2026-08-23T15:32:13.747Z"
    },
    {
      id: "transfer-1787499133747-kge8i0",
      assetId: "asset-bank",
      type: "buy",
      quantity: 896526499.9999999,
      unitPrice: 1,
      totalPrice: 896526499.9999999,
      date: "2026-08-23",
      notes: "واریز حاصل فروش به مقصد",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-23T15:32:13.747Z"
    },
    {
      id: "transfer-1787499635162-l1ycme",
      assetId: "asset-bank",
      type: "buy",
      quantity: 87402941,
      unitPrice: 1,
      totalPrice: 87402941,
      date: "2026-08-23",
      notes: "واریز حاصل فروش به مقصد",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-23T15:40:35.162Z"
    },
    {
      id: "kian-balance-1787499968598-h1xs1k",
      assetId: "asset-kian",
      type: "buy",
      quantity: 7262565366,
      unitPrice: 1,
      totalPrice: 7262565366,
      date: "2026-08-23",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-23T15:46:08.598Z"
    },
    {
      id: "kian-balance-1787499985043-dw1vzo",
      assetId: "asset-kian",
      type: "sell",
      quantity: 7349968307,
      unitPrice: 1,
      totalPrice: 7349968307,
      date: "2026-08-23",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-23T15:46:25.043Z"
    },
    {
      id: "hami-interest-1787669404617-mef6p4",
      assetId: "asset-hami",
      type: "buy",
      quantity: 35612566.9,
      unitPrice: 1,
      totalPrice: 35612566.9,
      date: "2026-08-22",
      notes: "بابت سود طرح سرمایه گذاری حامی مرداد 1405 [hami|2026-08-22|35612566.9|بابت سود طرح سرمایه گذاری حامی مرداد 1405]",
      attachmentIds: [],
      kind: "interest",
      createdAt: "2026-08-25T14:50:04.617Z"
    },
    {
      id: "tx-1787670132462-kn9adi",
      assetId: "asset-1787669955484-cftd5s",
      type: "buy",
      quantity: 809,
      unitPrice: 617730,
      totalPrice: 499743570,
      date: "2026-08-24",
      notes: "",
      sourceAssetId: "asset-hami",
      attachmentIds: [],
      createdAt: "2026-08-25T15:02:12.462Z"
    },
    {
      id: "transfer-1787670132462-8pp7dk",
      assetId: "asset-hami",
      type: "sell",
      quantity: 499743570,
      unitPrice: 1,
      totalPrice: 499743570,
      date: "2026-08-24",
      notes: "برداشت برای خرید روی",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-25T15:02:12.462Z"
    },
    {
      id: "transfer-dep-bank-1",
      assetId: "asset-deposit-cash",
      type: "buy",
      quantity: 1500000000,
      unitPrice: 1,
      totalPrice: 1500000000,
      date: "2026-02-08",
      notes: "شارژ حساب بورس کالا از بانک جهت خرید گواهی سپرده",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-02-08T08:00:00.000Z"
    },
    {
      id: "cert-cash-copper-1",
      assetId: "asset-deposit-cash",
      type: "sell",
      quantity: 1499269536,
      unitPrice: 1,
      totalPrice: 1499269536,
      date: "2026-02-08",
      notes: "برداشت بابت خرید گواهی سپرده مس [deposit-trade:tx-1785608886896-c2ri2t]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-02-08T10:00:00.000Z"
    },
    {
      id: "transfer-dep-bank-2",
      assetId: "asset-deposit-cash",
      type: "buy",
      quantity: 400000000,
      unitPrice: 1,
      totalPrice: 400000000,
      date: "2026-06-20",
      notes: "شارژ حساب بورس کالا از بانک جهت خرید گواهی سپرده",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-20T08:00:00.000Z"
    },
    {
      id: "cert-cash-copper-2",
      assetId: "asset-deposit-cash",
      type: "sell",
      quantity: 380410140,
      unitPrice: 1,
      totalPrice: 380410140,
      date: "2026-06-20",
      notes: "برداشت بابت خرید گواهی سپرده مس [deposit-trade:tx-1785609016818-lyicju]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-20T10:00:00.000Z"
    },
    {
      id: "kian-balance-1787670476825-gvf77w",
      assetId: "asset-kian",
      type: "buy",
      quantity: 1768423,
      unitPrice: 1,
      totalPrice: 1768423,
      date: "2026-08-25",
      notes: "اصلاح مانده واقعی صندوق کیان",
      attachmentIds: [],
      kind: "balance_adjustment",
      createdAt: "2026-08-25T15:07:56.825Z"
    },
    {
      id: "transfer-kian-statement-sell-46",
      assetId: "asset-kian",
      type: "sell",
      quantity: 504438.8,
      unitPrice: 1,
      totalPrice: 504438.8,
      date: "2026-08-31",
      notes: "فروش/ابطال ۴۶ واحد صندوق کیان و انتقال وجه به کارگزاری [migrated:so-1788592953888-20f366]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-31T00:00:00.000Z"
    },
    {
      id: "transfer-hami-kian-statement-sell-46",
      assetId: "asset-hami",
      type: "buy",
      quantity: 504438.8,
      unitPrice: 1,
      totalPrice: 504438.8,
      date: "2026-08-31",
      notes: "واریز حاصل از فروش ۴۶ واحد صندوق کیان [migrated:so-1788592953888-20f366]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-31T00:00:00.000Z"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-yjuan5",
      assetId: "asset-hami",
      type: "sell",
      quantity: 300818507.3,
      unitPrice: 1,
      totalPrice: 300818507.3,
      date: "2026-08-15",
      notes: "برداشت برای خرید بورس / برکت [stock-order:stock-order-1786813335568-yjuan5]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-15"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-dd0ebt",
      assetId: "asset-hami",
      type: "sell",
      quantity: 520736.8,
      unitPrice: 1,
      totalPrice: 520736.8,
      date: "2026-08-10",
      notes: "برداشت برای خرید بورس / احیا [stock-order:stock-order-1786813335568-dd0ebt]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-10"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-8lhx24",
      assetId: "asset-hami",
      type: "buy",
      quantity: 114889497.4,
      unitPrice: 1,
      totalPrice: 114889497.4,
      date: "2026-07-26",
      notes: "واریز حاصل فروش بورس / تلیسه [stock-order:stock-order-1786813335568-8lhx24]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-26"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-q1a7m5",
      assetId: "asset-hami",
      type: "buy",
      quantity: 190251087.5,
      unitPrice: 1,
      totalPrice: 190251087.5,
      date: "2026-07-26",
      notes: "واریز حاصل فروش بورس / سخزر [stock-order:stock-order-1786813335568-q1a7m5]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-26"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-nepbak",
      assetId: "asset-hami",
      type: "buy",
      quantity: 82454235.2,
      unitPrice: 1,
      totalPrice: 82454235.2,
      date: "2026-07-26",
      notes: "واریز حاصل فروش بورس / وپست [stock-order:stock-order-1786813335568-nepbak]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-26"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-qbsyvt",
      assetId: "asset-hami",
      type: "buy",
      quantity: 128117200.1,
      unitPrice: 1,
      totalPrice: 128117200.1,
      date: "2026-07-26",
      notes: "واریز حاصل فروش بورس / وبملت [stock-order:stock-order-1786813335568-qbsyvt]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-26"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-ml4edr",
      assetId: "asset-hami",
      type: "buy",
      quantity: 157545620.4,
      unitPrice: 1,
      totalPrice: 157545620.4,
      date: "2026-07-13",
      notes: "واریز حاصل فروش بورس / فسبزوار [stock-order:stock-order-1786813335568-ml4edr]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-13"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-n0aswd",
      assetId: "asset-hami",
      type: "buy",
      quantity: 284028233,
      unitPrice: 1,
      totalPrice: 284028233,
      date: "2026-07-12",
      notes: "واریز حاصل فروش بورس / غدانه [stock-order:stock-order-1786813335568-n0aswd]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-12"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-3vffpq",
      assetId: "asset-hami",
      type: "buy",
      quantity: 138981216,
      unitPrice: 1,
      totalPrice: 138981216,
      date: "2026-07-12",
      notes: "واریز حاصل فروش بورس / کنور [stock-order:stock-order-1786813335568-3vffpq]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-12"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-ps8w75",
      assetId: "asset-hami",
      type: "buy",
      quantity: 134100292.4,
      unitPrice: 1,
      totalPrice: 134100292.4,
      date: "2026-07-12",
      notes: "واریز حاصل فروش بورس / غشان [stock-order:stock-order-1786813335568-ps8w75]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-07-12"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-4pecj4",
      assetId: "asset-hami",
      type: "buy",
      quantity: 48707301,
      unitPrice: 1,
      totalPrice: 48707301,
      date: "2026-06-23",
      notes: "واریز حاصل فروش بورس / درهآور [stock-order:stock-order-1786813335568-4pecj4]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-23"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-59ohbv",
      assetId: "asset-hami",
      type: "buy",
      quantity: 22265519.5,
      unitPrice: 1,
      totalPrice: 22265519.5,
      date: "2026-06-23",
      notes: "واریز حاصل فروش بورس / کنور [stock-order:stock-order-1786813335568-59ohbv]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-23"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-gq7aq0",
      assetId: "asset-hami",
      type: "sell",
      quantity: 29999995.9,
      unitPrice: 1,
      totalPrice: 29999995.9,
      date: "2026-06-21",
      notes: "برداشت برای خرید بورس / سخزر [stock-order:stock-order-1786813335568-gq7aq0]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-21"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-5tdxr2",
      assetId: "asset-hami",
      type: "buy",
      quantity: 44004195.6,
      unitPrice: 1,
      totalPrice: 44004195.6,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / فسبزوار [stock-order:stock-order-1786813335568-5tdxr2]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-ei5k69",
      assetId: "asset-hami",
      type: "buy",
      quantity: 26300466.5,
      unitPrice: 1,
      totalPrice: 26300466.5,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / تلیسه [stock-order:stock-order-1786813335568-ei5k69]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-k0zgdt",
      assetId: "asset-hami",
      type: "buy",
      quantity: 25600376.9,
      unitPrice: 1,
      totalPrice: 25600376.9,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / غشان [stock-order:stock-order-1786813335568-k0zgdt]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-rlebnh",
      assetId: "asset-hami",
      type: "buy",
      quantity: 54657749,
      unitPrice: 1,
      totalPrice: 54657749,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / بموتو [stock-order:stock-order-1786813335568-rlebnh]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-pkfuol",
      assetId: "asset-hami",
      type: "buy",
      quantity: 28000161.3,
      unitPrice: 1,
      totalPrice: 28000161.3,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / وپست [stock-order:stock-order-1786813335568-pkfuol]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-sell-stock-order-1786813335568-1xxnzi",
      assetId: "asset-hami",
      type: "buy",
      quantity: 49000135.2,
      unitPrice: 1,
      totalPrice: 49000135.2,
      date: "2026-06-17",
      notes: "واریز حاصل فروش بورس / وبملت [stock-order:stock-order-1786813335568-1xxnzi]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-17"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-2wad74",
      assetId: "asset-hami",
      type: "sell",
      quantity: 150000531.9,
      unitPrice: 1,
      totalPrice: 150000531.9,
      date: "2026-06-16",
      notes: "برداشت برای خرید بورس / وآذر [stock-order:stock-order-1786813335568-2wad74]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-16"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-cxgwao",
      assetId: "asset-hami",
      type: "sell",
      quantity: 11842440.7,
      unitPrice: 1,
      totalPrice: 11842440.7,
      date: "2026-06-08",
      notes: "برداشت برای خرید بورس / غدانه [stock-order:stock-order-1786813335568-cxgwao]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-08"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-1ra6lx",
      assetId: "asset-hami",
      type: "sell",
      quantity: 126457631.4,
      unitPrice: 1,
      totalPrice: 126457631.4,
      date: "2026-06-08",
      notes: "برداشت برای خرید بورس / تلیسه [stock-order:stock-order-1786813335568-1ra6lx]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-08"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-7n9qh3",
      assetId: "asset-hami",
      type: "sell",
      quantity: 146730997.2,
      unitPrice: 1,
      totalPrice: 146730997.2,
      date: "2026-06-03",
      notes: "برداشت برای خرید بورس / غدانه [stock-order:stock-order-1786813335568-7n9qh3]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-03"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-p7879x",
      assetId: "asset-hami",
      type: "sell",
      quantity: 115344159.8,
      unitPrice: 1,
      totalPrice: 115344159.8,
      date: "2026-06-02",
      notes: "برداشت برای خرید بورس / غشان [stock-order:stock-order-1786813335568-p7879x]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-02"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-0df9z2",
      assetId: "asset-hami",
      type: "sell",
      quantity: 49999631,
      unitPrice: 1,
      totalPrice: 49999631,
      date: "2026-06-01",
      notes: "برداشت برای خرید بورس / درهآور [stock-order:stock-order-1786813335568-0df9z2]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-01"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-lfbcmj",
      assetId: "asset-hami",
      type: "sell",
      quantity: 99999702.7,
      unitPrice: 1,
      totalPrice: 99999702.7,
      date: "2026-06-01",
      notes: "برداشت برای خرید بورس / وپست [stock-order:stock-order-1786813335568-lfbcmj]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-06-01"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-tsanrw",
      assetId: "asset-hami",
      type: "sell",
      quantity: 49999401,
      unitPrice: 1,
      totalPrice: 49999401,
      date: "2026-05-31",
      notes: "برداشت برای خرید بورس / بموتو [stock-order:stock-order-1786813335568-tsanrw]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-31"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-c5s5rw",
      assetId: "asset-hami",
      type: "sell",
      quantity: 149160961.4,
      unitPrice: 1,
      totalPrice: 149160961.4,
      date: "2026-05-26",
      notes: "برداشت برای خرید بورس / کنور [stock-order:stock-order-1786813335568-c5s5rw]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-26"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-hd2f56",
      assetId: "asset-hami",
      type: "sell",
      quantity: 149999903.5,
      unitPrice: 1,
      totalPrice: 149999903.5,
      date: "2026-05-26",
      notes: "برداشت برای خرید بورس / سخزر [stock-order:stock-order-1786813335568-hd2f56]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-26"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-v29jgf",
      assetId: "asset-hami",
      type: "sell",
      quantity: 150467700,
      unitPrice: 1,
      totalPrice: 150467700,
      date: "2026-05-26",
      notes: "برداشت برای خرید بورس / وبملت [stock-order:stock-order-1786813335568-v29jgf]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-26"
    },
    {
      id: "hami-stock-buy-stock-order-1786813335568-0inujn",
      assetId: "asset-hami",
      type: "sell",
      quantity: 149997053.5,
      unitPrice: 1,
      totalPrice: 149997053.5,
      date: "2026-05-25",
      notes: "برداشت برای خرید بورس / فسبزوار [stock-order:stock-order-1786813335568-0inujn]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-05-25"
    },
    {
      id: "hami-stock-buy-stock-order-1787498782555-nlrq9w",
      assetId: "asset-hami",
      type: "sell",
      quantity: 1008215.3,
      unitPrice: 1,
      totalPrice: 1008215.3,
      date: "2026-08-19",
      notes: "برداشت برای خرید بورس / آکو [stock-order:stock-order-1787498782555-nlrq9w]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-19"
    },
    {
      id: "hami-stock-buy-stock-order-1787498782555-l67qrm",
      assetId: "asset-hami",
      type: "sell",
      quantity: 150130749.4,
      unitPrice: 1,
      totalPrice: 150130749.4,
      date: "2026-08-19",
      notes: "برداشت برای خرید بورس / تبرک [stock-order:stock-order-1787498782555-l67qrm]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-19"
    },
    {
      id: "hami-stock-sell-stock-order-1787669404617-716j9l",
      assetId: "asset-hami",
      type: "buy",
      quantity: 183248861.7,
      unitPrice: 1,
      totalPrice: 183248861.7,
      date: "2026-08-25",
      notes: "واریز حاصل فروش بورس / وآذر [stock-order:stock-order-1787669404617-716j9l]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-25"
    },
    {
      id: "hami-stock-sell-stock-order-1787669404617-9vwis4",
      assetId: "asset-hami",
      type: "buy",
      quantity: 361667076.8,
      unitPrice: 1,
      totalPrice: 361667076.8,
      date: "2026-08-24",
      notes: "واریز حاصل فروش بورس / برکت [stock-order:stock-order-1786813335568-9vwis4]",
      attachmentIds: [],
      kind: "transfer",
      createdAt: "2026-08-24"
    }
  ],
  prices: [
    {
      id: "price-1785511934378-odiu00",
      assetId: "asset-1785511934378-drglbz",
      price: 18514000,
      date: "2026-07-31"
    },
    {
      id: "price-1785512828077-iawsuo",
      assetId: "asset-1785512828077-ax9v5m",
      price: 193800,
      date: "2026-07-31"
    },
    {
      id: "price-1785513179157-tf7noi",
      assetId: "asset-1785513179157-pqlcpi",
      price: 193800,
      date: "2026-07-31"
    },
    {
      id: "price-1785513922092-x1utvi",
      assetId: "asset-1785511934378-drglbz",
      price: 18514000,
      date: "2026-07-31"
    },
    {
      id: "price-1785513922092-luzk1r",
      assetId: "asset-1785512828077-ax9v5m",
      price: 193800,
      date: "2026-07-31"
    },
    {
      id: "price-1785513922092-svuea9",
      assetId: "asset-1785513179157-pqlcpi",
      price: 193800,
      date: "2026-07-31"
    },
    {
      id: "price-1785599281175-u31o4e",
      assetId: "asset-1785511934378-drglbz",
      price: 18699000,
      date: "2026-08-01"
    },
    {
      id: "price-1785599281175-0rzhuo",
      assetId: "asset-1785512828077-ax9v5m",
      price: 194500,
      date: "2026-08-01"
    },
    {
      id: "price-1785599281175-5rqw05",
      assetId: "asset-1785513179157-pqlcpi",
      price: 194500,
      date: "2026-08-01"
    },
    {
      id: "price-1785599281175-x2bbnb",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-01"
    },
    {
      id: "price-1785608652930-kkyc8p",
      assetId: "asset-1785608652930-xfw41r",
      price: 2478998,
      date: "2026-08-01"
    },
    {
      id: "price-1785609191710-6s2n91",
      assetId: "asset-1785609191710-4tyzha",
      price: 62000,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-mjcfdd",
      assetId: "asset-1785511934378-drglbz",
      price: 18729000,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-2nx6ee",
      assetId: "asset-1785512828077-ax9v5m",
      price: 195320,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-gxnx6n",
      assetId: "asset-1785513179157-pqlcpi",
      price: 195320,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-gn9pw3",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-uih34h",
      assetId: "asset-1785608652930-xfw41r",
      price: 2478998,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-0xcsaj",
      assetId: "asset-1785609191710-4tyzha",
      price: 62000,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-z1izep",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-01"
    },
    {
      id: "price-1785612031964-mr5v3c",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-01"
    },
    {
      id: "price-1785685439079-fh9rtl",
      assetId: "asset-1785511934378-drglbz",
      price: 18260000,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-rv62he",
      assetId: "asset-1785512828077-ax9v5m",
      price: 192027,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-t1ee0o",
      assetId: "asset-1785513179157-pqlcpi",
      price: 192027,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-weg5xr",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-p8fcn3",
      assetId: "asset-1785608652930-xfw41r",
      price: 2437610,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-bz1czb",
      assetId: "asset-1785609191710-4tyzha",
      price: 59914,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-z4dulm",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-02"
    },
    {
      id: "price-1785685439079-zpmtmd",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-02"
    },
    {
      id: "price-1785773314280-9e5cgj",
      assetId: "asset-1785511934378-drglbz",
      price: 18401000,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-dccqjc",
      assetId: "asset-1785512828077-ax9v5m",
      price: 193530,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-yyyyq4",
      assetId: "asset-1785513179157-pqlcpi",
      price: 193530,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-n3vbgh",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-xzis1g",
      assetId: "asset-1785608652930-xfw41r",
      price: 2439000,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-qanbo6",
      assetId: "asset-1785609191710-4tyzha",
      price: 60960,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-of0yqj",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-03"
    },
    {
      id: "price-1785773314280-oamrkg",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-03"
    },
    {
      id: "price-1786026331284-9i7qbn",
      assetId: "asset-1785511934378-drglbz",
      price: 18593000,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-dnwq4i",
      assetId: "asset-1785512828077-ax9v5m",
      price: 187550,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-mdnn9h",
      assetId: "asset-1785513179157-pqlcpi",
      price: 187550,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-t3veqj",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-i1jprh",
      assetId: "asset-1785608652930-xfw41r",
      price: 2469451,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-iz40fw",
      assetId: "asset-1785609191710-4tyzha",
      price: 61378,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-ipym0k",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-06"
    },
    {
      id: "price-1786026331284-kznnaz",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-06"
    },
    {
      id: "price-1786812978768-zs2syx",
      assetId: "asset-1785511934378-drglbz",
      price: 19045000,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-j5tvpf",
      assetId: "asset-1785512828077-ax9v5m",
      price: 186628,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-sdqown",
      assetId: "asset-1785513179157-pqlcpi",
      price: 186628,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-2jrzoa",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-9umo5i",
      assetId: "asset-1785608652930-xfw41r",
      price: 2398513,
      date: "2026-08-15"
    },
    {
      "id": "price-1786812978768-kws08z",
      assetId: "asset-1785609191710-4tyzha",
      price: 62690,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-7i63fi",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-15"
    },
    {
      id: "price-1786812978768-376m9m",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-15"
    },
    {
      id: "price-1786901156050-loy57h",
      assetId: "asset-1785511934378-drglbz",
      price: 19024000,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-xtihnk",
      assetId: "asset-1785512828077-ax9v5m",
      price: 186609,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-z0jhio",
      assetId: "asset-1785513179157-pqlcpi",
      price: 186609,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-51lpbb",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-wzz5p7",
      assetId: "asset-1785608652930-xfw41r",
      price: 2369922,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-34ossa",
      assetId: "asset-1785609191710-4tyzha",
      price: 62347,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-5ft7m9",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-16"
    },
    {
      id: "price-1786901156050-d1uz17",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-16"
    },
    {
      id: "price-1787499215990-rbyf5t",
      assetId: "asset-1785511934378-drglbz",
      price: 21661000,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-qduhun",
      assetId: "asset-1785512828077-ax9v5m",
      price: 196498,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-2wbl2n",
      assetId: "asset-1785513179157-pqlcpi",
      price: 196498,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-ico0nz",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-gz7nq6",
      assetId: "asset-1785608652930-xfw41r",
      price: 2407544,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-quq5b6",
      assetId: "asset-1785609191710-4tyzha",
      price: 65614,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-rv42ze",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-23"
    },
    {
      id: "price-1787499215990-48jbcn",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-23"
    },
    {
      id: "price-1787669955485-l4pghx",
      assetId: "asset-1787669955484-cftd5s",
      price: 608598,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-2936da",
      assetId: "asset-1785511934378-drglbz",
      price: 21635000,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-sw1uqv",
      assetId: "asset-1785512828077-ax9v5m",
      price: 199173,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-xyw8jd",
      assetId: "asset-1785513179157-pqlcpi",
      price: 199173,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-sib0r8",
      assetId: "asset-hami",
      price: 1,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-v47522",
      assetId: "asset-1785608652930-xfw41r",
      price: 2395737,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-uf4rip",
      assetId: "asset-1785609191710-4tyzha",
      price: 65360,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-kn390n",
      assetId: "asset-kian",
      price: 1,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-fmjyx5",
      assetId: "asset-bank",
      price: 1,
      date: "2026-08-25"
    },
    {
      id: "price-1787670637586-h1fz2t",
      assetId: "asset-1787669955484-cftd5s",
      price: 608598,
      date: "2026-08-25"
    }
  ],
  attachments: [],
  settings: {
    seeded: true,
    sampleCleared: true,
    currency: "تومان",
    cashFundsMigrated: true,
    hamiStatementLedgerMigrated: true,
    kianStockMigrated: true
  },
  stockOrders: [
    {
      id: "stock-order-1786813335568-yjuan5",
      symbol: "برکت",
      type: "buy",
      quantity: 783000,
      unitPrice: 382.7,
      totalPrice: 300818507.3,
      date: "2026-08-15",
      notes: "خرید  783000 سهم برکت به نرخ 3827 ",
      commission: 1164407.300000012,
      sourceKey: "2026-08-15|buy|برکت|783000|382.7|300818507.3",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-dd0ebt",
      symbol: "احیا",
      type: "buy",
      quantity: 1518,
      unitPrice: 341.8,
      totalPrice: 520736.8,
      date: "2026-08-10",
      notes: "خرید  1518 سهم احیا به نرخ 3418 ",
      commission: 1884.399999999965,
      sourceKey: "2026-08-10|buy|احیا|1518|341.8|520736.8",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-8lhx24",
      symbol: "تلیسه",
      type: "sell",
      quantity: 165585,
      unitPrice: 700,
      totalPrice: 114889497.4,
      date: "2026-07-26",
      notes: "فروش  165585 سهم تلیسه به نرخ 7000 ",
      commission: 1020002.599999994,
      sourceKey: "2026-07-26|sell|تلیسه|165585|700|114889497.4"
    },
    {
      id: "stock-order-1786813335568-q1a7m5",
      symbol: "سخزر",
      type: "sell",
      quantity: 393320,
      unitPrice: 488,
      totalPrice: 190251087.5,
      date: "2026-07-26",
      notes: "فروش  393320 سهم سخزر به نرخ 4880 ",
      commission: 1689072.5,
      sourceKey: "2026-07-26|sell|سخزر|393320|488|190251087.5"
    },
    {
      id: "stock-order-1786813335568-nepbak",
      symbol: "وپست",
      type: "sell",
      quantity: 112566,
      unitPrice: 739,
      totalPrice: 82454235.2,
      date: "2026-07-26",
      notes: "فروش  112566 سهم وپست به نرخ 7390 ",
      commission: 732038.799999997,
      sourceKey: "2026-07-26|sell|وپست|112566|739|82454235.2"
    },
    {
      id: "stock-order-1786813335568-qbsyvt",
      symbol: "وبملت",
      type: "sell",
      quantity: 1077122,
      unitPrice: 120,
      totalPrice: 128117200.1,
      date: "2026-07-26",
      notes: "فروش  1077122 سهم وبملت به نرخ 1200 ",
      commission: 1137439.900000006,
      sourceKey: "2026-07-26|sell|وبملت|1077122|120|128117200.1"
    },
    {
      id: "stock-order-1786813335568-ml4edr",
      symbol: "فسبزوار",
      type: "sell",
      quantity: 28978,
      unitPrice: 5485,
      totalPrice: 157545620.4,
      date: "2026-07-13",
      notes: "فروش  28978 سهم فسبزوار به نرخ 54850 ",
      commission: 1398709.599999994,
      sourceKey: "2026-07-13|sell|فسبزوار|28978|5485|157545620.4"
    },
    {
      id: "stock-order-1786813335568-n0aswd",
      symbol: "غدانه",
      type: "sell",
      quantity: 214805,
      unitPrice: 1334,
      totalPrice: 284028233,
      date: "2026-07-12",
      notes: "فروش  214805 سهم غدانه به نرخ 13340 ",
      commission: 2521637,
      sourceKey: "2026-07-12|sell|غدانه|214805|1334|284028233"
    },
    {
      id: "stock-order-1786813335568-3vffpq",
      symbol: "کنور",
      type: "sell",
      quantity: 411188,
      unitPrice: 341,
      totalPrice: 138981216,
      date: "2026-07-12",
      notes: "فروش  411188 سهم کنور به نرخ 3410 ",
      commission: 1233892,
      sourceKey: "2026-07-12|sell|کنور|411188|341|138981216"
    },
    {
      id: "stock-order-1786813335568-ps8w75",
      symbol: "غشان",
      type: "sell",
      quantity: 156225,
      unitPrice: 866,
      totalPrice: 134100292.4,
      date: "2026-07-12",
      notes: "فروش  156225 سهم غشان به نرخ 8660 ",
      commission: 1190557.599999994,
      sourceKey: "2026-07-12|sell|غشان|156225|866|134100292.4"
    },
    {
      id: "stock-order-1786813335568-4pecj4",
      symbol: "درهآور",
      type: "sell",
      quantity: 42435,
      unitPrice: 1158,
      totalPrice: 48707301,
      date: "2026-06-23",
      notes: "فروش  42435 سهم درهآور به نرخ 11580 ",
      commission: 432429,
      sourceKey: "2026-06-23|sell|درهآور|42435|1158|48707301"
    },
    {
      id: "stock-order-1786813335568-59ohbv",
      symbol: "کنور",
      type: "sell",
      quantity: 61442,
      unitPrice: 365.6,
      totalPrice: 22265519.5,
      date: "2026-06-23",
      notes: "فروش  61442 سهم کنور به نرخ 3656 ",
      commission: 197675.70000000298,
      sourceKey: "2026-06-23|sell|کنور|61442|365.6|22265519.5"
    },
    {
      id: "stock-order-1786813335568-gq7aq0",
      symbol: "سخزر",
      type: "buy",
      quantity: 55972,
      unitPrice: 534,
      totalPrice: 29999995.9,
      date: "2026-06-21",
      notes: "خرید  55972 سهم سخزر به نرخ 5340 ",
      commission: 110947.89999999851,
      sourceKey: "2026-06-21|buy|سخزر|55972|534|29999995.9",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-5tdxr2",
      symbol: "فسبزوار",
      type: "sell",
      quantity: 8495,
      unitPrice: 5226,
      totalPrice: 44004195.6,
      date: "2026-06-17",
      notes: "فروش  8495 سهم فسبزوار به نرخ 52260 ",
      commission: 390674.3999999985,
      sourceKey: "2026-06-17|sell|فسبزوار|8495|5226|44004195.6"
    },
    {
      id: "stock-order-1786813335568-ei5k69",
      symbol: "تلیسه",
      type: "sell",
      quantity: 34415,
      unitPrice: 771,
      totalPrice: 26300466.5,
      date: "2026-06-17",
      notes: "فروش  34415 سهم تلیسه به نرخ 7710 ",
      commission: 233498.5,
      sourceKey: "2026-06-17|sell|تلیسه|34415|771|26300466.5"
    },
    {
      id: "stock-order-1786813335568-k0zgdt",
      symbol: "غشان",
      type: "sell",
      quantity: 34668,
      unitPrice: 745,
      totalPrice: 25600376.9,
      date: "2026-06-17",
      notes: "فروش  34668 سهم غشان به نرخ 7450 ",
      commission: 227283.1000000015,
      sourceKey: "2026-06-17|sell|غشان|34668|745|25600376.9"
    },
    {
      id: "stock-order-1786813335568-rlebnh",
      symbol: "بموتو",
      type: "sell",
      quantity: 209922,
      unitPrice: 262.6,
      totalPrice: 54657749,
      date: "2026-06-17",
      notes: "فروش  209922 سهم بموتو به نرخ 2626 ",
      commission: 467768.200000003,
      sourceKey: "2026-06-17|sell|بموتو|209922|262.6|54657749"
    },
    {
      id: "stock-order-1786813335568-pkfuol",
      symbol: "وپست",
      type: "sell",
      quantity: 30375,
      unitPrice: 930,
      totalPrice: 28000161.3,
      date: "2026-06-17",
      notes: "فروش  30375 سهم وپست به نرخ 9300 ",
      commission: 248588.69999999925,
      sourceKey: "2026-06-17|sell|وپست|30375|930|28000161.3"
    },
    {
      id: "stock-order-1786813335568-1xxnzi",
      symbol: "وبملت",
      type: "sell",
      quantity: 350604,
      unitPrice: 141,
      totalPrice: 49000135.2,
      date: "2026-06-17",
      notes: "فروش  350604 سهم وبملت به نرخ 1410 ",
      commission: 435028.799999997,
      sourceKey: "2026-06-17|sell|وبملت|350604|141|49000135.2"
    },
    {
      id: "stock-order-1786813335568-2wad74",
      symbol: "وآذر",
      type: "buy",
      quantity: 266776,
      unitPrice: 560.1,
      totalPrice: 150000531.9,
      date: "2026-06-16",
      notes: "خرید  266776 سهم وآذر به نرخ 5601 ",
      commission: 579294.3000000119,
      sourceKey: "2026-06-16|buy|وآذر|266776|560.1|150000531.9",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-cxgwao",
      symbol: "غدانه",
      type: "buy",
      quantity: 14805,
      unitPrice: 797,
      totalPrice: 11842440.7,
      date: "2026-06-08",
      notes: "خرید  14805 سهم غدانه به نرخ 7970 ",
      commission: 42855.699999999255,
      sourceKey: "2026-06-08|buy|غدانه|14805|797|11842440.7",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-1ra6lx",
      symbol: "تلیسه",
      type: "buy",
      quantity: 200000,
      unitPrice: 630,
      totalPrice: 126457631.4,
      date: "2026-06-08",
      notes: "خرید  200000 سهم تلیسه به نرخ 6300 ",
      commission: 457631.40000000596,
      sourceKey: "2026-06-08|buy|تلیسه|200000|630|126457631.4",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-7n9qh3",
      symbol: "غدانه",
      type: "buy",
      quantity: 200000,
      unitPrice: 731,
      totalPrice: 146730997.2,
      date: "2026-06-03",
      notes: "خرید  200000 سهم غدانه به نرخ 7310 ",
      commission: 530997.1999999881,
      sourceKey: "2026-06-03|buy|غدانه|200000|731|146730997.2",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-p7879x",
      symbol: "غشان",
      type: "buy",
      quantity: 190893,
      unitPrice: 602,
      totalPrice: 115344159.8,
      date: "2026-06-02",
      notes: "خرید  190893 سهم غشان به نرخ 6020 ",
      commission: 426573.799999997,
      sourceKey: "2026-06-02|buy|غشان|190893|602|115344159.8",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-0df9z2",
      symbol: "درهآور",
      type: "buy",
      quantity: 42435,
      unitPrice: 1174,
      totalPrice: 49999631,
      date: "2026-06-01",
      notes: "خرید  42435 سهم درهآور به نرخ 11740 ",
      commission: 180941,
      sourceKey: "2026-06-01|buy|درهآور|42435|1174|49999631",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-lfbcmj",
      symbol: "وپست",
      type: "buy",
      quantity: 142941,
      unitPrice: 697,
      totalPrice: 99999702.7,
      date: "2026-06-01",
      notes: "خرید  142941 سهم وپست به نرخ 6970 ",
      commission: 369825.700000003,
      sourceKey: "2026-06-01|buy|وپست|142941|697|99999702.7",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-tsanrw",
      symbol: "بموتو",
      type: "buy",
      quantity: 209922,
      unitPrice: 237.3,
      totalPrice: 49999401,
      date: "2026-05-31",
      notes: "خرید  209922 سهم بموتو به نرخ 2373 ",
      commission: 184910.3999999985,
      sourceKey: "2026-05-31|buy|بموتو|209922|237.3|49999401",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-c5s5rw",
      symbol: "کنور",
      type: "buy",
      quantity: 472630,
      unitPrice: 314.4,
      totalPrice: 149160961.4,
      date: "2026-05-26",
      notes: "خرید  472630 سهم کنور به نرخ 3144 ",
      commission: 566089.400000006,
      sourceKey: "2026-05-26|buy|کنور|472630|314.4|149160961.4",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-hd2f56",
      symbol: "سخزر",
      type: "buy",
      quantity: 337348,
      unitPrice: 443,
      totalPrice: 149999903.5,
      date: "2026-05-26",
      notes: "خرید  337348 سهم سخزر به نرخ 4430 ",
      commission: 554739.5,
      sourceKey: "2026-05-26|buy|سخزر|337348|443|149999903.5",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-v29jgf",
      symbol: "وبملت",
      type: "buy",
      quantity: 1427726,
      unitPrice: 105,
      totalPrice: 150467700,
      date: "2026-05-26",
      notes: "خرید  1427726 سهم وبملت به نرخ 1050 ",
      commission: 556470,
      sourceKey: "2026-05-26|buy|وبملت|1427726|105|150467700",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1786813335568-0inujn",
      symbol: "فسبزوار",
      type: "buy",
      quantity: 37473,
      unitPrice: 3988,
      totalPrice: 149997053.5,
      date: "2026-05-25",
      notes: "خرید  37473 سهم فسبزوار به نرخ 39880 ",
      commission: 554729.5,
      sourceKey: "2026-05-25|buy|فسبزوار|37473|3988|149997053.5",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1787498782555-nlrq9w",
      symbol: "آکو",
      type: "buy",
      quantity: 305,
      unitPrice: 3293.4,
      totalPrice: 1008215.3,
      date: "2026-08-19",
      notes: "خرید  305 سهم آکو به نرخ 32934 ",
      commission: 3728.3000000000466,
      sourceKey: "2026-08-19|buy|آکو|305|3293.4|1008215.3",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1787498782555-l67qrm",
      symbol: "تبرک",
      type: "buy",
      quantity: 80299,
      unitPrice: 1862.8,
      totalPrice: 150130749.4,
      date: "2026-08-19",
      notes: "خرید  80299 سهم تبرک به نرخ 18628 ",
      commission: 549772.2000000179,
      sourceKey: "2026-08-19|buy|تبرک|80299|1862.8|150130749.4",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1787669404617-716j9l",
      symbol: "وآذر",
      type: "sell",
      quantity: 266776,
      unitPrice: 693,
      totalPrice: 183248861.7,
      date: "2026-08-25",
      notes: "فروش  266776 سهم وآذر به نرخ 6930 ",
      commission: 1626906.300000012,
      sourceKey: "2026-08-25|sell|وآذر|266776|693|183248861.7",
      sourceAssetId: "asset-hami"
    },
    {
      id: "stock-order-1787669404617-9vwis4",
      symbol: "برکت",
      type: "sell",
      quantity: 783000,
      unitPrice: 466,
      totalPrice: 361667076.8,
      date: "2026-08-24",
      notes: "فروش  783000 سهم برکت به نرخ 4660 ",
      commission: 3210923.199999988,
      sourceKey: "2026-08-24|sell|برکت|783000|466|361667076.8",
      sourceAssetId: "asset-hami"
    }
  ],
  stockPrices: [
    {
      id: "price-1785515297186-9pga3y",
      symbol: "وبملت",
      price: 120,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-gx6wim",
      symbol: "سخزر",
      price: 488,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-lx1klm",
      symbol: "تلیسه",
      price: 700,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-vulsyw",
      symbol: "وپست",
      price: 739,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-cgkncw",
      symbol: "فسبزوار",
      price: 5485,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-6e0fe3",
      symbol: "کنور",
      price: 341,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-djbsip",
      symbol: "غشان",
      price: 866,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-bz8y4c",
      symbol: "غدانه",
      price: 1334,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-q201j6",
      symbol: "درهآور",
      price: 1158,
      date: "2026-07-31"
    },
    {
      id: "price-1785515297186-0x0k7p",
      symbol: "بموتو",
      price: 263,
      date: "2026-07-31"
    },
    {
      id: "stock-price-1785523963172-u0tp0a",
      symbol: "وآذر",
      price: 499,
      date: "2026-07-31"
    },
    {
      id: "stock-price-1785667751644-koh52z",
      symbol: "وآذر",
      price: 510,
      date: "2026-08-02"
    },
    {
      id: "stock-price-1785773469635-9y4r1y",
      symbol: "وآذر",
      price: 524,
      date: "2026-08-03"
    },
    {
      id: "stock-price-1786026407776-w5q52b",
      symbol: "وآذر",
      price: 539,
      date: "2026-08-06"
    },
    {
      id: "stock-price-1786813419337-5roqh1",
      symbol: "برکت",
      price: 383,
      date: "2026-08-15"
    },
    {
      id: "stock-price-1786813419337-5q6lo3",
      symbol: "احیا",
      price: 362,
      date: "2026-08-15"
    },
    {
      id: "stock-price-1786813419337-aqikhb",
      symbol: "وآذر",
      price: 610,
      date: "2026-08-15"
    },
    {
      id: "stock-price-1786889550204-xx40t2",
      symbol: "احیا",
      price: 372,
      date: "2026-08-16"
    },
    {
      id: "stock-price-1786889550204-rxmj53",
      symbol: "برکت",
      price: 393,
      date: "2026-08-16"
    },
    {
      id: "stock-price-1786889550204-he34lk",
      symbol: "وآذر",
      price: 621,
      date: "2026-08-16"
    },
    {
      id: "stock-price-1787498838793-rgxqo6",
      symbol: "احیا",
      price: 429,
      date: "2026-08-23"
    },
    {
      id: "stock-price-1787498838793-hg0d4m",
      symbol: "آکو",
      price: 3493,
      date: "2026-08-23"
    },
    {
      id: "stock-price-1787498838793-9wtucg",
      symbol: "برکت",
      price: 453,
      date: "2026-08-23"
    },
    {
      id: "stock-price-1787498838793-k6v2q2",
      symbol: "وآذر",
      price: 677,
      date: "2026-08-23"
    },
    {
      id: "stock-price-1787498838793-da27t1",
      symbol: "تبرک",
      price: 1910,
      date: "2026-08-23"
    },
    {
      id: "stock-price-1787669443669-43peph",
      symbol: "آکو",
      price: 3704,
      date: "2026-08-25"
    },
    {
      id: "stock-price-1787669443669-cn2suz",
      symbol: "احیا",
      price: 454,
      date: "2026-08-25"
    },
    {
      id: "stock-price-1787669443669-zzovm7",
      symbol: "تبرک",
      price: 1899,
      date: "2026-08-25"
    }
  ],
  stockDividends: [
    {
      id: "dividend-1785524335742-dyyc3c",
      symbol: "کنور",
      amount: 29775690,
      date: "2026-07-31",
      status: "pending"
    },
    {
      id: "dividend-1785524353368-hp5jqj",
      symbol: "تلیسه",
      amount: 18379935,
      date: "2026-07-31",
      status: "pending"
    },
    {
      id: "dividend-1785524368275-j89k17",
      symbol: "وپست",
      amount: 12494826,
      date: "2026-07-31",
      status: "paid"
    },
    {
      id: "dividend-1785524380539-zvscle",
      symbol: "درهآور",
      amount: 6322815,
      date: "2026-07-31",
      status: "pending"
    },
    {
      id: "dividend-1785524405881-t3aqjs",
      symbol: "وبملت",
      amount: 4954761,
      date: "2026-07-31",
      status: "paid"
    }
  ]
};

export function sampleData(): PortfolioData {
  return JSON.parse(JSON.stringify(latestPortfolioData));
}
