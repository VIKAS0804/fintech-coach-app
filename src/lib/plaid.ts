import type {
  PlaidExchangePublicTokenResponse,
  CoachingSignalResponse,
  PlaidLinkTokenResponse,
  PlaidSyncResponse,
} from '../types/fintech';
import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.');
  }

  return supabase;
}

export async function createLinkToken(
  platform: 'android' | 'ios' = 'ios',
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
  accessToken: string,
  cursor?: string,
): Promise<PlaidSyncResponse> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<PlaidSyncResponse>(
    'plaid-sync-transactions',
    {
      body: { accessToken, cursor },
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
