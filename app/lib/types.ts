export type AssetCategory =
  | "بورس"
  | "گواهی سپرده مس"
  | "گواهی سپرده میلگرد"
  | "صندوق درآمد ثابت"
  | "نقد"
  | "کپی ترید"
  | "طلا آبشده"
  | "تتر"
  | "خودرو"
  | string;

export interface Asset {
  id: string;
  name: string;
  symbol?: string;
  category: AssetCategory;
  unit?: string;
  currentPrice: number;
  color: string;
  notes?: string;
  annualInterestRate?: number;
  copyUsdBalance?: number;
  copyUsdRate?: number;
  lastValuationAt?: string;
  createdAt: string;
  isDepositCertificate?: boolean;
  depositSymbol?: string;
}

export interface Attachment {
  id: string;
  transactionId: string;
  name: string;
  type: string;
  size: number;
  data: string;
}

export interface Transaction {
  id: string;
  assetId: string;
  type: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  notes?: string;
  attachmentIds: string[];
  destinationAssetId?: string;
  sourceAssetId?: string;
  // External cash flows are distinct from trades, internal transfers and balance corrections.
  // Existing unclassified records remain unclassified until the owner reviews them.
  kind?: "trade" | "interest" | "balance_adjustment" | "transfer" | "fee"
    | "opening_capital" | "capital_in" | "capital_out" | "stock_dividend";
  linkedTransactionId?: string;
  stockDividendId?: string;
  createdAt: string;
}

export interface PriceHistory {
  id: string;
  assetId: string;
  price: number;
  date: string;
}

export interface StockOrder {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  time?: string;
  notes?: string;
  commission?: number;
  sourceKey?: string;
  sourceAssetId?: string;
}

export interface StockPrice {
  id: string;
  symbol: string;
  price: number;
  date: string;
}

export interface StockDividend {
  id: string;
  symbol: string;
  amount: number;
  date: string;
  status: "pending" | "paid";
  // Explicitly confirmed receipt outside the accounts tracked in this portfolio.
  receivedOutside?: boolean;
  notes?: string;
}

export interface AppSettings {
  seeded: boolean;
  sampleCleared: boolean;
  currency: "تومان";
  cashFundsMigrated?: boolean;
  hamiStatementLedgerMigrated?: boolean;
  bankClearingHidden?: boolean;
  kianStockMigrated?: boolean;
}

export interface PortfolioData {
  version: 1;
  assets: Asset[];
  transactions: Transaction[];
  prices: PriceHistory[];
  attachments: Attachment[];
  settings: AppSettings;
  stockOrders: StockOrder[];
  stockPrices: StockPrice[];
  stockDividends: StockDividend[];
}

export interface AssetMetric {
  asset: Asset;
  quantity: number;
  averageCost: number;
  costBasis: number;
  marketValue: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  profitPercent: number;
  freshCapital: number;
  capitalRoi: number;
  totalGrossBuys: number;
  totalGrossSells: number;
  netCashInvested: number;
  isRiskFree: boolean;
}

export interface StockSymbolMetric {
  symbol: string;
  quantity: number;
  average: number;
  price: number;
  value: number;
  purchases: number;
  sales: number;
  cost: number;
  realized: number;
  unrealized: number;
  paidDividend: number;
  pendingDividend: number;
  profit: number;
  profitPercent: number;
  soldReturn: number;
  freshCapital: number;
  capitalRoi: number;
  isRiskFree: boolean;
}

// Preview rows produced by the commodity certificate statement parser.
export interface DepositCertTradeItem {
  id: string;
  date: string;
  jalaliDate: string;
  symbol: string;
  type: "buy" | "sell";
  grossAmount: number;
  commission: number;
  netAmount: number;
  quantity: number;
  unitPrice: number;
  assetId?: string;
  assetName?: string;
  status: "new" | "duplicate";
  sourceKey: string;
  selected: boolean;
  tradesCount: number;
  individualDocNos: string[];
  feeBreakdown: Record<string, number>;
}

export interface DepositCertStorageFeeItem {
  id: string;
  date: string;
  jalaliDate: string;
  symbol: string;
  amount: number;
  docNo: string;
  assetId?: string;
  assetName?: string;
  status: "new" | "duplicate";
  selected: boolean;
  applyAs: "cost_basis";
}

export interface DepositCertCashTransferItem {
  id: string;
  date: string;
  jalaliDate: string;
  direction: "deposit" | "withdraw";
  amount: number;
  docNo: string;
  selected: boolean;
}

export interface DepositCertImportResult {
  trades: DepositCertTradeItem[];
  storageFees: DepositCertStorageFeeItem[];
  cashTransfers: DepositCertCashTransferItem[];
  accountName?: string;
  nationalCode?: string;
}

export interface BourseSummary {
  currentValue: number;
  currentCost: number;
  currentProfit: number;
  currentProfitPercent: number;
  purchases: number;
  sales: number;
  realizedProfit: number;
  realizedCost: number;
  realizedReturnPercent: number;
  unrealizedProfit: number;
  paidDividends: number;
  pendingDividends: number;
  totalDividends: number;
  toDateProfit: number;
  toDateReturnPercent: number;
  hamiBalance: number;
}
