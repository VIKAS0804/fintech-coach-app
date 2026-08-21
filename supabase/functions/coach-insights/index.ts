import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient, requireUser } from '../_shared/auth.ts';
import {
  analyzeImpulseSignals,
  buildInsightSummary,
  type InsightTransaction,
} from '../_shared/insights.ts';

interface StoredTransaction {
  id: string;
  amount: number;
  category: string[];
  merchant_name: string | null;
  name: string;
  posted_date: string;
  channel: string | null;
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
      .select('id, amount, category, merchant_name, name, posted_date, channel')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('posted_date', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const typedTransactions = (transactions ?? []) as StoredTransaction[];
    const insightTransactions: InsightTransaction[] = typedTransactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      category: Array.isArray(transaction.category) ? transaction.category : [],
      merchantName: transaction.merchant_name ?? transaction.name,
      displayName: transaction.name,
      postedDate: transaction.posted_date,
      channel: transaction.channel,
    }));

    const generatedInsights = analyzeImpulseSignals(insightTransactions);
    const generatedSignals = generatedInsights.map((signal) => ({
      id: `generated-${signal.transactionId}`,
      merchantName: signal.merchantName,
      title: signal.title,
      tag: signal.tag,
      reason: signal.reason,
      suggestion: signal.suggestion,
      score: signal.score,
      level: signal.level,
      detectedAt: signal.detectedAt,
      amount: signal.amount,
      patternCount: signal.patternCount,
      transaction_id: signal.transactionId,
    }));

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

    return json({
      generated_at: new Date().toISOString(),
      signals: generatedSignals.slice(0, limit),
      summary: buildInsightSummary(insightTransactions, generatedInsights),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
