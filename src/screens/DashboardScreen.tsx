import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LinkedInstitution, SpendingSignal, Transaction } from '../types/fintech';
import { formatCompactDate, formatCurrency, truncateToken } from '../utils/format';

interface DashboardScreenProps {
  functionsBaseUrl: string;
  isConfigured: boolean;
  isSyncing?: boolean;
  linkTokenPreview: string | null;
  linkedInstitutions: LinkedInstitution[];
  onRefreshSync?: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
  plaidAction: ReactNode;
  signals: SpendingSignal[];
  syncMessage: string;
  transactions: Transaction[];
  userEmail?: string | null;
}

function getDiscretionarySpend(transactions: Transaction[]) {
  return transactions.reduce((sum, transaction) => {
    const topCategory = transaction.category[0]?.toLowerCase() ?? '';
    const isDiscretionary =
      topCategory.includes('food') ||
      topCategory.includes('general merchandise') ||
      topCategory.includes('entertainment');

    return isDiscretionary ? sum + transaction.amount : sum;
  }, 0);
}

function getLevelAccent(level: SpendingSignal['level']) {
  switch (level) {
    case 'high':
      return '#F97360';
    case 'medium':
      return '#FFCD57';
    default:
      return '#6EE7B7';
  }
}

export function DashboardScreen({
  functionsBaseUrl,
  isConfigured,
  isSyncing,
  linkTokenPreview,
  linkedInstitutions,
  onRefreshSync,
  onSignOut,
  plaidAction,
  signals,
  syncMessage,
  transactions,
  userEmail,
}: DashboardScreenProps) {
  const discretionarySpend = getDiscretionarySpend(transactions);
  const safeToSpend = Math.max(0, 1200 - discretionarySpend);
  const flaggedSignals = signals.filter((signal) => signal.level !== 'low').length;

  return (
    <View style={styles.root}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>REAL-TIME MONEY COACH</Text>
        <Text style={styles.title}>Catch impulse spending before it snowballs.</Text>
        <Text style={styles.subtitle}>
          React Native front end, Supabase auth + RLS, Plaid transaction sync, and edge analytics
          tuned for fast user-scoped reads.
        </Text>
        {userEmail ? (
          <View style={styles.sessionRow}>
            <Text style={styles.sessionText}>Signed in as {userEmail}</Text>
            {onSignOut ? (
              <Pressable onPress={onSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Discretionary spend</Text>
            <Text style={styles.metricValue}>{formatCurrency(discretionarySpend)}</Text>
            <Text style={styles.metricHint}>last 7 days</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Signals flagged</Text>
            <Text style={styles.metricValue}>{flaggedSignals}</Text>
            <Text style={styles.metricHint}>high + medium</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Safe to spend</Text>
            <Text style={styles.metricValue}>{formatCurrency(safeToSpend)}</Text>
            <Text style={styles.metricHint}>after cushions</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PLAID + SUPABASE</Text>
          <Text style={styles.cardTitle}>
            {isConfigured ? 'Backend wiring is ready.' : 'Finish environment setup to go live.'}
          </Text>
          <Text style={styles.cardBody}>{syncMessage}</Text>
          <Text style={styles.endpointLabel}>
            Functions endpoint: {functionsBaseUrl || 'Waiting for EXPO_PUBLIC_SUPABASE_URL'}
          </Text>

          <View style={styles.actionRow}>
            {plaidAction}
            <Pressable
              disabled={!onRefreshSync || isSyncing}
              onPress={onRefreshSync}
              style={[styles.secondaryButton, !onRefreshSync || isSyncing ? styles.buttonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>Refresh synced data</Text>
            </Pressable>
          </View>

          {linkTokenPreview ? (
            <View style={styles.tokenPreview}>
              <Text style={styles.tokenLabel}>Latest token preview</Text>
              <Text style={styles.tokenValue}>{truncateToken(linkTokenPreview)}</Text>
            </View>
          ) : null}

          <View style={styles.institutionBlock}>
            <Text style={styles.tokenLabel}>Linked institutions</Text>
            {linkedInstitutions.length > 0 ? (
              linkedInstitutions.map((institution) => (
                <Text key={institution.plaidItemId} style={styles.institutionRow}>
                  {institution.institutionName ?? 'Unnamed institution'} / {institution.status}
                </Text>
              ))
            ) : (
              <Text style={styles.emptyText}>No institutions linked yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>BACKEND BLUEPRINT</Text>
          <Text style={styles.cardTitle}>What ships in this scaffold</Text>
          <Text style={styles.blueprintRow}>
            RLS: profiles, plaid_items, accounts, transactions, coaching_signals
          </Text>
          <Text style={styles.blueprintRow}>
            Edge functions: plaid-link-token, plaid-sync-transactions, coach-insights
          </Text>
          <Text style={styles.blueprintRow}>
            Performance: user-scoped indexes, cursor sync, summarized coaching reads
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>COACHING SIGNALS</Text>
          <Text style={styles.cardTitle}>Latest spending behaviors to review</Text>
          {signals.length > 0 ? (
            signals.map((signal) => (
              <View key={signal.id} style={styles.signalCard}>
                <View
                  style={[
                    styles.signalBadge,
                    {
                      backgroundColor: getLevelAccent(signal.level),
                    },
                  ]}
                />
                <View style={styles.signalCopy}>
                  <View style={styles.signalHeader}>
                    <Text style={styles.signalTitle}>{signal.title}</Text>
                    <Text style={styles.signalScore}>{signal.score}</Text>
                  </View>
                  <Text style={styles.signalMeta}>
                    {signal.merchantName} / {formatCurrency(signal.amount)} /{' '}
                    {formatCompactDate(signal.detectedAt)}
                  </Text>
                  <Text style={styles.signalReason}>{signal.reason}</Text>
                  <Text style={styles.signalSuggestion}>{signal.suggestion}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Connect a bank to generate live coaching signals.</Text>
          )}
        </View>

        <View style={[styles.card, styles.bottomCard]}>
          <Text style={styles.cardEyebrow}>SYNCED TRANSACTIONS</Text>
          <Text style={styles.cardTitle}>Recent activity stream</Text>
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionRow}>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionTitle}>{transaction.displayName}</Text>
                  <Text style={styles.transactionMeta}>
                    {transaction.merchantName} / {transaction.category.join(' > ')}
                  </Text>
                </View>
                <View style={styles.transactionAmountWrap}>
                  <Text style={styles.transactionAmount}>{formatCurrency(transaction.amount)}</Text>
                  <Text style={styles.transactionDate}>{formatCompactDate(transaction.postedDate)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No synced transactions yet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#081226',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 48,
  },
  orbOne: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#143A7B',
    opacity: 0.85,
  },
  orbTwo: {
    position: 'absolute',
    top: 160,
    left: -70,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#0C7C93',
    opacity: 0.4,
  },
  kicker: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    marginBottom: 12,
    maxWidth: 320,
  },
  subtitle: {
    color: '#B9C5DB',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  sessionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sessionText: {
    color: '#8CA0C1',
    flex: 1,
    fontSize: 13,
    marginRight: 12,
  },
  signOutButton: {
    borderColor: '#29406B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: '#0F1C34',
    borderColor: '#243657',
    borderWidth: 1,
    borderRadius: 22,
    marginHorizontal: 6,
    marginBottom: 12,
    padding: 16,
  },
  metricLabel: {
    color: '#8CA0C1',
    fontSize: 13,
    marginBottom: 10,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  metricHint: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0B162B',
    borderColor: '#1D3155',
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
  },
  bottomCard: {
    marginBottom: 0,
  },
  cardEyebrow: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
  },
  cardBody: {
    color: '#B9C5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  endpointLabel: {
    color: '#5EEAD4',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    borderColor: '#29406B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  tokenPreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#132342',
  },
  tokenLabel: {
    color: '#8CA0C1',
    fontSize: 12,
    marginBottom: 6,
  },
  tokenValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  institutionBlock: {
    marginTop: 16,
  },
  institutionRow: {
    color: '#D6E3F8',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
  },
  blueprintRow: {
    color: '#D6E3F8',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 8,
  },
  signalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderTopColor: '#192B49',
    borderTopWidth: 1,
  },
  signalBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
    marginRight: 12,
  },
  signalCopy: {
    flex: 1,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  signalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  signalScore: {
    color: '#7DD3FC',
    fontSize: 18,
    fontWeight: '900',
  },
  signalMeta: {
    color: '#8CA0C1',
    fontSize: 12,
    marginBottom: 8,
  },
  signalReason: {
    color: '#D6E3F8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  signalSuggestion: {
    color: '#6EE7B7',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyText: {
    color: '#8CA0C1',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopColor: '#192B49',
    borderTopWidth: 1,
  },
  transactionCopy: {
    flex: 1,
    marginRight: 16,
  },
  transactionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  transactionMeta: {
    color: '#8CA0C1',
    fontSize: 12,
    lineHeight: 18,
  },
  transactionAmountWrap: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  transactionDate: {
    color: '#6EE7B7',
    fontSize: 12,
  },
});
