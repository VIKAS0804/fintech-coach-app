import type {
  CoachingSignalSummary,
  PatternBreakdownItem,
  SignalTag,
  SpendingSignal,
  Transaction,
} from '../types/fintech';

export const signalTagOrder: SignalTag[] = [
  'merchant-loop',
  'spend-spree',
  'category-spike',
  'high-ticket',
];

const discretionaryKeywords = [
  'food',
  'drink',
  'restaurant',
  'coffee',
  'general merchandise',
  'shopping',
  'clothing',
  'entertainment',
  'subscription',
  'digital',
  'beauty',
];

export function isDiscretionaryCategory(category: string[]) {
  const flattened = category.join(' ').toLowerCase();
  return discretionaryKeywords.some((keyword) => flattened.includes(keyword));
}

export function getSignalTagLabel(tag: SignalTag) {
  switch (tag) {
    case 'merchant-loop':
      return 'Merchant loops';
    case 'spend-spree':
      return 'Spend sprees';
    case 'category-spike':
      return 'Category spikes';
    case 'high-ticket':
    default:
      return 'High tickets';
  }
}

export function buildDashboardSummary(
  transactions: Transaction[],
  signals: SpendingSignal[],
): CoachingSignalSummary {
  const discretionarySpend = transactions.reduce((sum, transaction) => {
    return isDiscretionaryCategory(transaction.category) ? sum + transaction.amount : sum;
  }, 0);

  const averageTicket =
    transactions.length > 0
      ? transactions.reduce((sum, transaction) => sum + transaction.amount, 0) / transactions.length
      : 0;

  const merchantScores = new Map<string, number>();

  signals.forEach((signal) => {
    merchantScores.set(signal.merchantName, (merchantScores.get(signal.merchantName) ?? 0) + signal.score);
  });

  const watchlistMerchants = [...merchantScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([merchant]) => merchant);

  const patternBreakdown: PatternBreakdownItem[] = signalTagOrder.map((tag) => ({
    tag,
    count: signals.filter((signal) => signal.tag === tag).length,
  }));

  const riskPenalty = signals.reduce((sum, signal) => {
    if (signal.level === 'high') {
      return sum + 35;
    }

    if (signal.level === 'medium') {
      return sum + 20;
    }

    return sum + 10;
  }, 0);

  return {
    transactionsReviewed: transactions.length,
    signalsFlagged: signals.length,
    discretionarySpend,
    averageTicket,
    safeToSpend: Math.max(0, 1200 - discretionarySpend - riskPenalty),
    highestSignalScore: signals[0]?.score ?? 0,
    watchlistMerchants,
    patternBreakdown,
  };
}
