import type {
  PlaidExchangePublicTokenResponse,
  CoachingSignalResponse,
  LinkedInstitution,
  PlaidLinkTokenResponse,
  PlaidSyncResponse,
  Transaction,
} from '../types/fintech';
import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.');
  }

  return supabase;
}

export async function createLinkToken(
  platform: 'android' | 'ios' | 'web' = 'ios',
): Promise<PlaidLinkTokenResponse> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<PlaidLinkTokenResponse>('plaid-link-token', {
    body: { platform },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Plaid link token response was empty.');
  }

  return data;
}

export async function syncTransactions(
  params: {
    accessToken?: string;
    cursor?: string;
    itemId?: string;
  },
): Promise<PlaidSyncResponse> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<PlaidSyncResponse>(
    'plaid-sync-transactions',
    {
      body: params,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Plaid sync response was empty.');
  }

  return data;
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<PlaidExchangePublicTokenResponse> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<PlaidExchangePublicTokenResponse>(
    'plaid-exchange-public-token',
    {
      body: { publicToken },
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Plaid exchange response was empty.');
  }

  return data;
}

export async function fetchCoachingSignals(limit = 5): Promise<CoachingSignalResponse> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<CoachingSignalResponse>('coach-insights', {
    body: { limit },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Coach insights response was empty.');
  }

  return data;
}

export async function fetchRecentTransactions(limit = 8): Promise<Transaction[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('transactions')
    .select('plaid_transaction_id, merchant_name, name, amount, posted_date, category, channel, is_pending')
    .is('removed_at', null)
    .order('posted_date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((transaction) => ({
    id: String(transaction.plaid_transaction_id),
    merchantName: transaction.merchant_name ?? transaction.name,
    displayName: transaction.name,
    amount: Number(transaction.amount),
    postedDate: transaction.posted_date,
    category: Array.isArray(transaction.category)
      ? transaction.category.map((value) => String(value))
      : [],
    channel: transaction.channel ?? 'unknown',
    pending: Boolean(transaction.is_pending),
  }));
}

export async function fetchLinkedInstitutions(): Promise<LinkedInstitution[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('plaid_items')
    .select('plaid_item_id, institution_name, status, cursor')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => ({
    plaidItemId: item.plaid_item_id,
    institutionName: item.institution_name,
    status: item.status,
    cursor: item.cursor,
  }));
}
