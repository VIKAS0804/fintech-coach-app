export type SignalLevel = 'low' | 'medium' | 'high';
export type SignalTag = 'merchant-loop' | 'category-spike' | 'spend-spree' | 'high-ticket';

export interface PatternBreakdownItem {
  tag: SignalTag;
  count: number;
}

export interface Transaction {
  id: string;
  merchantName: string;
  displayName: string;
  amount: number;
  postedDate: string;
  category: string[];
  channel: string;
  pending?: boolean;
}

export interface SpendingSignal {
  id: string;
  merchantName: string;
  title: string;
  tag: SignalTag;
  reason: string;
  suggestion: string;
  score: number;
  level: SignalLevel;
  detectedAt: string;
  amount: number;
  patternCount: number;
}

export interface PlaidLinkTokenResponse {
  link_token: string;
  expiration: string;
  request_id?: string;
}

export interface PlaidExchangePublicTokenResponse {
  item_id: string;
  institution_name: string | null;
  request_id?: string;
}

export interface PlaidSyncResponse {
  next_cursor: string | null;
  accounts_synced: number;
  transactions_upserted: number;
  signals_flagged: number;
}

export interface CoachingSignalSummary {
  transactionsReviewed: number;
  signalsFlagged: number;
  discretionarySpend: number;
  averageTicket: number;
  safeToSpend: number;
  highestSignalScore: number;
  watchlistMerchants: string[];
  patternBreakdown: PatternBreakdownItem[];
}

export interface LinkedInstitution {
  plaidItemId: string;
  institutionName: string | null;
  status: string;
  cursor: string | null;
}

export interface CoachingSignalResponse {
  generated_at: string;
  signals: SpendingSignal[];
  summary: CoachingSignalSummary;
}
