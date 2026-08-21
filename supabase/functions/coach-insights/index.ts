import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient, requireUser } from '../_shared/auth.ts';

interface StoredTransaction {
  id: string;
  amount: number;
  category: string[];
  merchant_name: string | null;
  name: string;
  posted_date: string;
}

function buildSignal(transaction: StoredTransaction, peers: StoredTransaction[]) {
  const merchant = (transaction.merchant_name ?? transaction.name).toLowerCase();
  const category = transaction.category[0]?.toLowerCase() ?? '';
  const sameMerchantCount = peers.filter((peer) => {
    const peerMerchant = (peer.merchant_name ?? peer.name).toLowerCase();
    return peer.id !== transaction.id && peerMerchant === merchant;
  }).length;

  let score = 15;
  const reasons: string[] = [];

  if (transaction.amount >= 70) {
    score += 25;
    reasons.push('high ticket amount');
  }

  if (
    category.includes('food') ||
    category.includes('general merchandise') ||
    category.includes('entertainment')
  ) {
    score += 20;
    reasons.push('discretionary category');
  }

  if (sameMerchantCount > 0) {
    score += 25;
    reasons.push('repeat merchant behavior');
  }

  if (score < 50) {
    return null;
  }

  return {
    level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
    score: Math.min(score, 100),
    tag: sameMerchantCount > 0 ? 'repeat-merchant' : 'category-spike',
    reason: `Detected from ${reasons.join(', ')}.`,
    suggestion:
      'Move the next planned discretionary spend into a dedicated allowance bucket before purchase.',
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
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit ?? 5), 10));
    const service = getServiceClient();

    const { data: transactions, error } = await service
      .from('transactions')
      .select('id, amount, category, merchant_name, name, posted_date')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('posted_date', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const typedTransactions = (transactions ?? []) as StoredTransaction[];
    const generatedSignals = typedTransactions
      .map((transaction) => {
        const signal = buildSignal(transaction, typedTransactions);

        if (!signal) {
          return null;
        }

        return {
          id: `generated-${transaction.id}`,
          merchantName: transaction.merchant_name ?? transaction.name,
          title: signal.tag === 'repeat-merchant' ? 'Repeat spend pattern' : 'Category spike',
          reason: signal.reason,
          suggestion: signal.suggestion,
          score: signal.score,
          level: signal.level,
          detectedAt: transaction.posted_date,
          amount: transaction.amount,
          transaction_id: transaction.id,
          tag: signal.tag,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);

    const signalRows = generatedSignals.map((signal) => ({
      user_id: user.id,
      transaction_id: signal.transaction_id,
      level: signal.level,
      tag: signal.tag,
      score: signal.score,
      reason: signal.reason,
      suggestion: signal.suggestion,
      detected_at: new Date().toISOString(),
    }));

    if (signalRows.length > 0) {
      const { error: saveError } = await service
        .from('coaching_signals')
        .upsert(signalRows, { onConflict: 'transaction_id' });

      if (saveError) {
        throw saveError;
      }
    }

    const discretionarySpend = typedTransactions.reduce((sum, transaction) => {
      const topCategory = transaction.category[0]?.toLowerCase() ?? '';
      const isDiscretionary =
        topCategory.includes('food') ||
        topCategory.includes('general merchandise') ||
        topCategory.includes('entertainment');

      return isDiscretionary ? sum + transaction.amount : sum;
    }, 0);

    const averageTicket =
      typedTransactions.length > 0
        ? typedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0) /
          typedTransactions.length
        : 0;

    return json({
      generated_at: new Date().toISOString(),
      signals: generatedSignals.slice(0, limit),
      summary: {
        transactionsReviewed: typedTransactions.length,
        signalsFlagged: generatedSignals.length,
        discretionarySpend,
        averageTicket,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
