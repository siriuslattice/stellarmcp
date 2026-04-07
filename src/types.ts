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
