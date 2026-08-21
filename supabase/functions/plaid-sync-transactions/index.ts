import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient, requireUser } from '../_shared/auth.ts';
import { decryptString } from '../_shared/crypto.ts';
import {
  analyzeImpulseSignals,
  type InsightTransaction,
} from '../_shared/insights.ts';
import { plaidRequest } from '../_shared/plaid.ts';

interface PlaidTransaction {
  account_id: string;
  amount: number;
  authorized_date: string | null;
  date: string;
  iso_currency_code: string | null;
  merchant_name: string | null;
  name: string;
  payment_channel: string | null;
  pending: boolean;
  personal_finance_category: {
    detailed?: string;
    primary?: string;
  } | null;
  transaction_id: string;
}

interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
  };
  mask: string | null;
  name: string;
  official_name: string | null;
  subtype: string | null;
}

interface PlaidSyncPage {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const { user } = await requireUser(request);
    const { accessToken, cursor, itemId } = await request.json();
    const service = getServiceClient();
    let resolvedAccessToken = accessToken as string | undefined;
    let resolvedCursor = cursor as string | null | undefined;

    if (!resolvedAccessToken) {
      if (!itemId) {
        throw new Error('Either accessToken or itemId is required.');
      }

      const { data: plaidItem, error: plaidItemError } = await service
        .from('plaid_items')
        .select('encrypted_access_token, cursor')
        .eq('user_id', user.id)
        .eq('plaid_item_id', itemId)
        .maybeSingle();

      if (plaidItemError) {
        throw plaidItemError;
      }

      if (!plaidItem?.encrypted_access_token) {
        throw new Error('No stored Plaid access token was found for this item.');
      }

      resolvedAccessToken = await decryptString(plaidItem.encrypted_access_token);
      resolvedCursor = resolvedCursor ?? plaidItem.cursor;
    }

    const pages: PlaidTransaction[] = [];
    const removedIds: string[] = [];
    let nextCursor: string | null = resolvedCursor ?? null;
    let hasMore = true;

    while (hasMore) {
      const page = await plaidRequest<PlaidSyncPage>('/transactions/sync', {
        access_token: resolvedAccessToken,
        cursor: nextCursor,
      });

      pages.push(...page.added, ...page.modified);
      removedIds.push(...page.removed.map((entry) => entry.transaction_id));
      nextCursor = page.next_cursor;
      hasMore = page.has_more;
    }

    const accountsPayload = await plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', {
      access_token: resolvedAccessToken,
    });

    const accountRows = accountsPayload.accounts.map((account) => ({
      user_id: user.id,
      plaid_item_id: itemId ?? null,
      plaid_account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      subtype: account.subtype,
      mask: account.mask,
      current_balance: account.balances.current,
      available_balance: account.balances.available,
      iso_currency_code: account.balances.iso_currency_code ?? 'USD',
    }));

    const { data: savedAccounts, error: accountsError } = await service
      .from('accounts')
      .upsert(accountRows, { onConflict: 'plaid_account_id' })
      .select('id, plaid_account_id');

    if (accountsError) {
      throw accountsError;
    }

    const accountIdByPlaidId = new Map(
      (savedAccounts ?? []).map((account) => [account.plaid_account_id as string, account.id as string]),
    );

    const transactionRows = pages.map((transaction) => ({
      user_id: user.id,
      account_id: accountIdByPlaidId.get(transaction.account_id) ?? null,
      plaid_transaction_id: transaction.transaction_id,
      name: transaction.name,
      merchant_name: transaction.merchant_name,
      amount: transaction.amount,
      authorized_date: transaction.authorized_date,
      posted_date: transaction.date,
      category: [
        transaction.personal_finance_category?.primary,
        transaction.personal_finance_category?.detailed,
      ].filter(Boolean),
      channel: transaction.payment_channel,
      iso_currency_code: transaction.iso_currency_code ?? 'USD',
      is_pending: transaction.pending,
      removed_at: null,
      raw_payload: transaction,
    }));

    const { data: savedTransactions, error: transactionsError } = await service
      .from('transactions')
      .upsert(transactionRows, { onConflict: 'plaid_transaction_id' })
      .select('id, plaid_transaction_id');

    if (transactionsError) {
      throw transactionsError;
    }

    if (removedIds.length > 0) {
      const { error: removedError } = await service
        .from('transactions')
        .update({ removed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('plaid_transaction_id', removedIds);

      if (removedError) {
        throw removedError;
      }
    }

    const { data: recentTransactions, error: recentTransactionsError } = await service
      .from('transactions')
      .select('id, amount, category, merchant_name, name, posted_date, channel')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('posted_date', { ascending: false })
      .limit(120);

    if (recentTransactionsError) {
      throw recentTransactionsError;
    }

    const insightTransactions: InsightTransaction[] = (recentTransactions ?? []).map((transaction) => ({
      id: String(transaction.id),
      amount: Number(transaction.amount),
      category: Array.isArray(transaction.category) ? transaction.category.map((value) => String(value)) : [],
      merchantName: String(transaction.merchant_name ?? transaction.name),
      displayName: String(transaction.name),
      postedDate: String(transaction.posted_date),
      channel: transaction.channel ? String(transaction.channel) : null,
    }));

    const generatedSignals = analyzeImpulseSignals(insightTransactions);
    const signalRows = generatedSignals.map((signal) => ({
      user_id: user.id,
      transaction_id: signal.transactionId,
      level: signal.level,
      tag: signal.tag,
      score: signal.score,
      reason: signal.reason,
      suggestion: signal.suggestion,
      detected_at: new Date().toISOString(),
    }));

    if (signalRows.length > 0) {
      const { error: signalsError } = await service
        .from('coaching_signals')
        .upsert(signalRows, { onConflict: 'transaction_id' });

      if (signalsError) {
        throw signalsError;
      }
    }

    const generatedTransactionIds = new Set(signalRows.map((signal) => signal.transaction_id));
    const staleTransactionIds = insightTransactions
      .map((transaction) => transaction.id)
      .filter((transactionId) => !generatedTransactionIds.has(transactionId));

    if (staleTransactionIds.length > 0) {
      const { error: cleanupError } = await service
        .from('coaching_signals')
        .delete()
        .eq('user_id', user.id)
        .in('transaction_id', staleTransactionIds);

      if (cleanupError) {
        throw cleanupError;
      }
    }

    if (itemId) {
      const { error: itemError } = await service.from('plaid_items').upsert(
        {
          user_id: user.id,
          plaid_item_id: itemId,
          status: 'active',
          cursor: nextCursor,
        },
        { onConflict: 'plaid_item_id' },
      );

      if (itemError) {
        throw itemError;
      }
    }

    return json({
      next_cursor: nextCursor,
      accounts_synced: accountRows.length,
      transactions_upserted: transactionRows.length,
      signals_flagged: generatedSignals.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
