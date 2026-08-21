import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient, requireUser } from '../_shared/auth.ts';
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

function scoreSignal(transaction: PlaidTransaction, peerTransactions: PlaidTransaction[]) {
  const merchantKey = (transaction.merchant_name ?? transaction.name).toLowerCase();
  const categoryPrimary = transaction.personal_finance_category?.primary?.toLowerCase() ?? '';
  const similarTransactions = peerTransactions.filter((item) => {
    const peerMerchant = (item.merchant_name ?? item.name).toLowerCase();
    return peerMerchant === merchantKey && item.transaction_id !== transaction.transaction_id;
  });

  let score = 10;
  const reasons: string[] = [];

  if (transaction.amount >= 75) {
    score += 30;
    reasons.push('large single purchase');
  }

  if (
    categoryPrimary.includes('food') ||
    categoryPrimary.includes('entertainment') ||
    categoryPrimary.includes('general merchandise')
  ) {
    score += 20;
    reasons.push('discretionary category');
  }

  if (similarTransactions.length > 0) {
    score += 25;
    reasons.push('repeat merchant in recent sync');
  }

  if (score < 45) {
    return null;
  }

  return {
    level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
    score: Math.min(score, 100),
    tag: similarTransactions.length > 0 ? 'repeat-merchant' : 'high-ticket',
    reason: `Flagged due to ${reasons.join(', ')}.`,
    suggestion:
      'Create a 24-hour cool-off rule for non-essential purchases and recheck the need after the delay.',
  };
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

    if (!accessToken) {
      throw new Error('accessToken is required.');
    }

    const service = getServiceClient();
    const pages: PlaidTransaction[] = [];
    const removedIds: string[] = [];
    let nextCursor: string | null = cursor ?? null;
    let hasMore = true;

    while (hasMore) {
      const page = await plaidRequest<PlaidSyncPage>('/transactions/sync', {
        access_token: accessToken,
        cursor: nextCursor,
      });

      pages.push(...page.added, ...page.modified);
      removedIds.push(...page.removed.map((entry) => entry.transaction_id));
      nextCursor = page.next_cursor;
      hasMore = page.has_more;
    }

    const accountsPayload = await plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', {
      access_token: accessToken,
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

    const signalRows = (savedTransactions ?? [])
      .map((transaction) => {
        const sourceTransaction = pages.find((entry) => entry.transaction_id === transaction.plaid_transaction_id);

        if (!sourceTransaction) {
          return null;
        }

        const signal = scoreSignal(sourceTransaction, pages);

        if (!signal) {
          return null;
        }

        return {
          user_id: user.id,
          transaction_id: transaction.id,
          level: signal.level,
          tag: signal.tag,
          score: signal.score,
          reason: signal.reason,
          suggestion: signal.suggestion,
          detected_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (signalRows.length > 0) {
      const { error: signalsError } = await service
        .from('coaching_signals')
        .upsert(signalRows, { onConflict: 'transaction_id' });

      if (signalsError) {
        throw signalsError;
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
      signals_flagged: signalRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
