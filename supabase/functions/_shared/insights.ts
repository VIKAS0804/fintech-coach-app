export type SignalLevel = 'low' | 'medium' | 'high';
export type SignalTag = 'merchant-loop' | 'category-spike' | 'spend-spree' | 'high-ticket';

export interface InsightTransaction {
  id: string;
  amount: number;
  category: string[];
  merchantName: string;
  displayName: string;
  postedDate: string;
  channel?: string | null;
}

export interface InsightSignal {
  transactionId: string;
  merchantName: string;
  title: string;
  reason: string;
  suggestion: string;
  score: number;
  level: SignalLevel;
  detectedAt: string;
  amount: number;
  tag: SignalTag;
  patternCount: number;
}

interface PatternBreakdownItem {
  tag: SignalTag;
  count: number;
}

export interface InsightSummary {
  transactionsReviewed: number;
  signalsFlagged: number;
  discretionarySpend: number;
  averageTicket: number;
  safeToSpend: number;
  highestSignalScore: number;
  watchlistMerchants: string[];
  patternBreakdown: PatternBreakdownItem[];
}

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

function getUtcDate(value: string) {
  const normalized = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(normalized);
}

function getDayDiff(left: string, right: string) {
  const difference = Math.abs(getUtcDate(left).getTime() - getUtcDate(right).getTime());
  return Math.floor(difference / (1000 * 60 * 60 * 24));
}

function normalizeMerchant(value: string) {
  return value.trim().toLowerCase();
}

function getPrimaryCategory(category: string[]) {
  return category[0]?.toLowerCase() ?? 'uncategorized';
}

function isDiscretionaryCategory(category: string[]) {
  const flattened = category.join(' ').toLowerCase();
  return discretionaryKeywords.some((keyword) => flattened.includes(keyword));
}

function formatUsd(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function averageAmount(transactions: InsightTransaction[]) {
  if (transactions.length === 0) {
    return 0;
  }

  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0) / transactions.length;
}

function getLevel(score: number): SignalLevel {
  if (score >= 84) {
    return 'high';
  }

  if (score >= 64) {
    return 'medium';
  }

  return 'low';
}

function getSignalCopy(
  tag: SignalTag,
  transaction: InsightTransaction,
  patternCount: number,
  sameMerchantWeek: InsightTransaction[],
  categoryAverage: number,
) {
  const primaryCategory = transaction.category[0] ?? 'discretionary';
  const merchantLoopTotal =
    transaction.amount + sameMerchantWeek.reduce((sum, peer) => sum + peer.amount, 0);

  switch (tag) {
    case 'merchant-loop':
      return {
        title: 'Merchant loop detected',
        reason: `${patternCount} charges from ${transaction.merchantName} landed within 7 days, totaling ${formatUsd(merchantLoopTotal)}.`,
        suggestion:
          'Set a 48-hour cooling-off rule for this merchant and move the same amount into savings before buying again.',
      };
    case 'spend-spree':
      return {
        title: 'Discretionary spree detected',
        reason: `${patternCount} discretionary purchases clustered within 3 days, which can signal momentum spending.`,
        suggestion:
          'Pause non-essential purchases until tomorrow and review the full cluster together before another checkout.',
      };
    case 'category-spike': {
      const multiplier = categoryAverage > 0 ? Math.round((transaction.amount / categoryAverage) * 10) / 10 : 1;
      return {
        title: 'Category spike building',
        reason: `${primaryCategory} spend is ${multiplier}x your recent average, with ${patternCount} nearby charges reinforcing the trend.`,
        suggestion:
          'Cap this category for the week and route the next planned purchase through a manual budget check first.',
      };
    }
    case 'high-ticket':
    default:
      return {
        title: 'High-ticket impulse risk',
        reason: `${transaction.merchantName} posted a ${formatUsd(transaction.amount)} discretionary charge above your usual ticket size.`,
        suggestion:
          'Use a same-day review rule for larger wants so the purchase has to survive one more intentional check.',
      };
  }
}

function scoreTransaction(
  transaction: InsightTransaction,
  allTransactions: InsightTransaction[],
): InsightSignal | null {
  const merchantKey = normalizeMerchant(transaction.merchantName);
  const primaryCategory = getPrimaryCategory(transaction.category);
  const sameMerchantWeek = allTransactions.filter((peer) => {
    if (peer.id === transaction.id) {
      return false;
    }

    return (
      normalizeMerchant(peer.merchantName) === merchantKey &&
      getDayDiff(peer.postedDate, transaction.postedDate) <= 7
    );
  });

  const sameCategoryMonth = allTransactions.filter((peer) => {
    if (peer.id === transaction.id) {
      return false;
    }

    return (
      getPrimaryCategory(peer.category) === primaryCategory &&
      getDayDiff(peer.postedDate, transaction.postedDate) <= 30
    );
  });

  const sameCategoryWeekCount = sameCategoryMonth.filter(
    (peer) => getDayDiff(peer.postedDate, transaction.postedDate) <= 7,
  ).length;

  const discretionaryCluster = allTransactions.filter((peer) => {
    if (peer.id === transaction.id) {
      return false;
    }

    return (
      isDiscretionaryCategory(peer.category) &&
      getDayDiff(peer.postedDate, transaction.postedDate) <= 3
    );
  });

  const categoryAverage = averageAmount(sameCategoryMonth);
  const isDiscretionary = isDiscretionaryCategory(transaction.category);
  const impulseChannel =
    transaction.channel?.toLowerCase().includes('online') ||
    transaction.channel?.toLowerCase().includes('mobile');

  let score = 0;

  if (isDiscretionary) {
    score += 18;
  }

  if (transaction.amount >= 60) {
    score += 14;
  }

  if (transaction.amount >= 90) {
    score += 10;
  }

  if (transaction.amount >= 140) {
    score += 8;
  }

  if (sameMerchantWeek.length >= 1) {
    score += 20;
  }

  if (sameMerchantWeek.length >= 2) {
    score += 10;
  }

  if (discretionaryCluster.length >= 2) {
    score += 16;
  }

  if (
    categoryAverage > 0 &&
    transaction.amount >= categoryAverage * 1.5 &&
    transaction.amount >= categoryAverage + 20
  ) {
    score += 18;
  }

  if (sameCategoryWeekCount >= 2) {
    score += 8;
  }

  if (impulseChannel) {
    score += 5;
  }

  if (score < 46) {
    return null;
  }

  let tag: SignalTag = 'high-ticket';
  let patternCount = 1;

  if (sameMerchantWeek.length >= 2) {
    tag = 'merchant-loop';
    patternCount = sameMerchantWeek.length + 1;
  } else if (discretionaryCluster.length >= 3) {
    tag = 'spend-spree';
    patternCount = discretionaryCluster.length + 1;
  } else if (
    categoryAverage > 0 &&
    transaction.amount >= categoryAverage * 1.5 &&
    transaction.amount >= categoryAverage + 20
  ) {
    tag = 'category-spike';
    patternCount = sameCategoryWeekCount + 1;
  }

  const copy = getSignalCopy(tag, transaction, patternCount, sameMerchantWeek, categoryAverage);

  return {
    transactionId: transaction.id,
    merchantName: transaction.merchantName,
    title: copy.title,
    reason: copy.reason,
    suggestion: copy.suggestion,
    score: Math.min(score, 100),
    level: getLevel(score),
    detectedAt: transaction.postedDate,
    amount: transaction.amount,
    tag,
    patternCount,
  };
}

export function analyzeImpulseSignals(transactions: InsightTransaction[]) {
  return [...transactions]
    .sort((left, right) => getUtcDate(right.postedDate).getTime() - getUtcDate(left.postedDate).getTime())
    .map((transaction, _, allTransactions) => scoreTransaction(transaction, allTransactions))
    .filter((signal): signal is InsightSignal => signal !== null)
    .sort((left, right) => right.score - left.score);
}

export function buildInsightSummary(
  transactions: InsightTransaction[],
  signals: InsightSignal[],
): InsightSummary {
  const discretionarySpend = transactions.reduce((sum, transaction) => {
    return isDiscretionaryCategory(transaction.category) ? sum + transaction.amount : sum;
  }, 0);

  const averageTicket =
    transactions.length > 0
      ? transactions.reduce((sum, transaction) => sum + transaction.amount, 0) / transactions.length
      : 0;

  const scoreByMerchant = new Map<string, number>();

  signals.forEach((signal) => {
    scoreByMerchant.set(signal.merchantName, (scoreByMerchant.get(signal.merchantName) ?? 0) + signal.score);
  });

  const watchlistMerchants = [...scoreByMerchant.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([merchantName]) => merchantName);

  const highSignalPenalty = signals.reduce((penalty, signal) => {
    if (signal.level === 'high') {
      return penalty + 35;
    }

    if (signal.level === 'medium') {
      return penalty + 20;
    }

    return penalty + 10;
  }, 0);

  const patternBreakdown = signalTagOrder.map((tag) => ({
    tag,
    count: signals.filter((signal) => signal.tag === tag).length,
  })) satisfies PatternBreakdownItem[];

  return {
    transactionsReviewed: transactions.length,
    signalsFlagged: signals.length,
    discretionarySpend,
    averageTicket,
    safeToSpend: Math.max(0, 1200 - discretionarySpend - highSignalPenalty),
    highestSignalScore: signals[0]?.score ?? 0,
    watchlistMerchants,
    patternBreakdown,
  };
}
