export interface HorizonBalance {
  balance: string;
  limit?: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12";
  asset_code?: string;
  asset_issuer?: string;
}

export interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  balances: HorizonBalance[];
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  signers: { weight: number; key: string; type: string }[];
  num_sponsoring: number;
  num_sponsored: number;
}

export interface HorizonPage<T> {
  _embedded: {
    records: T[];
  };
  _links: {
    self: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
}

export interface HorizonTransaction {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  fee_charged: string;
  operation_count: number;
  successful: boolean;
  memo_type: string;
  memo?: string;
}

export interface HorizonOperation {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  from?: string;
  to?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
  source_account: string;
}

export interface HorizonOrderbookEntry {
  price: string;
  price_r: { n: number; d: number };
  amount: string;
}

export interface HorizonOrderbook {
  bids: HorizonOrderbookEntry[];
  asks: HorizonOrderbookEntry[];
  base: { asset_type: string; asset_code?: string; asset_issuer?: string };
  counter: { asset_type: string; asset_code?: string; asset_issuer?: string };
}

export interface HorizonTradeAggregation {
  timestamp: string;
  trade_count: string;
  base_volume: string;
  counter_volume: string;
  avg: string;
  high: string;
  low: string;
  open: string;
  close: string;
}

export interface HorizonAsset {
  asset_type: string;
  asset_code: string;
  asset_issuer: string;
  amount: string;
  num_accounts: number;
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
}

export interface HorizonRoot {
  horizon_version: string;
  core_version: string;
  ingest_latest_ledger: number;
  history_latest_ledger: number;
  history_latest_ledger_closed_at: string;
  network_passphrase: string;
  current_protocol_version: number;
}

export interface HorizonLedger {
  id: string;
  sequence: number;
  hash: string;
  closed_at: string;
  transaction_count: number;
  operation_count: number;
  base_fee_in_stroops: number;
  total_coins: string;
  protocol_version: number;
}

export interface HorizonAssetRef {
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12";
  asset_code?: string;
  asset_issuer?: string;
}

export interface HorizonEffect {
  id: string;
  paging_token: string;
  account: string;
  type: string;
  type_i: number;
  created_at: string;
}

export interface HorizonOffer {
  id: string;
  paging_token: string;
  seller: string;
  selling: HorizonAssetRef;
  buying: HorizonAssetRef;
  amount: string;
  price: string;
  price_r: { n: number; d: number };
  last_modified_ledger: number;
  last_modified_time: string;
}

export interface HorizonLiquidityPool {
  id: string;
  paging_token: string;
  fee_bp: number;
  type: string;
  total_trustlines: string;
  total_shares: string;
  reserves: { asset: string; amount: string }[];
  last_modified_ledger: number;
}

export interface HorizonClaimableBalance {
  id: string;
  paging_token: string;
  asset: string;
  amount: string;
  sponsor?: string;
  claimants: { destination: string; predicate: unknown }[];
  last_modified_ledger: number;
}

export interface PriceQuote {
  base: string;
  counter: string;
  price: string;
  source: string;
  timestamp: string;
}

export interface VWAPResult {
  base: string;
  counter: string;
  vwap: string;
  volume: string;
  periodMs: number;
  candles: number;
  timestamp: string;
}
