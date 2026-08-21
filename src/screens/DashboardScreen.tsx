import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildDashboardSummary, getSignalTagLabel } from '../lib/coach';
import type { LinkedInstitution, SpendingSignal, Transaction } from '../types/fintech';
import {
  formatCompactDate,
  formatCurrency,
  formatRelativeTime,
  truncateToken,
} from '../utils/format';

interface DashboardScreenProps {
  functionsBaseUrl: string;
  isConfigured: boolean;
  isSyncing?: boolean;
  lastInsightsAt: string | null;
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

function getLevelLabel(level: SpendingSignal['level']) {
  switch (level) {
    case 'high':
      return 'High risk';
    case 'medium':
      return 'Watch';
    default:
      return 'Monitor';
  }
}

export function DashboardScreen({
  functionsBaseUrl,
  isConfigured,
  isSyncing,
  lastInsightsAt,
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
  const summary = buildDashboardSummary(transactions, signals);
  const primarySignal = signals[0] ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>REAL-TIME MONEY COACH</Text>
        <Text style={styles.title}>Catch impulse spending before it snowballs.</Text>
        <Text style={styles.subtitle}>
          React Native, TypeScript, Supabase auth + RLS, Plaid transaction sync, PostgreSQL, and
          edge analytics built around user-scoped spending patterns.
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
            <Text style={styles.metricValue}>{formatCurrency(summary.discretionarySpend)}</Text>
            <Text style={styles.metricHint}>recent synced activity</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Signals flagged</Text>
            <Text style={styles.metricValue}>{summary.signalsFlagged}</Text>
            <Text style={styles.metricHint}>active behavior patterns</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Safe to spend</Text>
            <Text style={styles.metricValue}>{formatCurrency(summary.safeToSpend)}</Text>
            <Text style={styles.metricHint}>after risk buffer</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Watchlist merchants</Text>
            <Text style={styles.metricValue}>{summary.watchlistMerchants.length}</Text>
            <Text style={styles.metricHint}>repeat pressure points</Text>
          </View>
        </View>

        <View style={[styles.card, styles.pulseCard]}>
          <Text style={styles.cardEyebrow}>COACH PULSE</Text>
          <Text style={styles.cardTitle}>
            {primarySignal ? primarySignal.title : 'No high-risk patterns detected yet'}
          </Text>
          <Text style={styles.cardBody}>
            {primarySignal
              ? primarySignal.reason
              : 'Once transactions start syncing, this panel highlights the strongest impulse-spending behavior in plain English.'}
          </Text>

          <View style={styles.pulseRow}>
            <View style={styles.pulsePill}>
              <Text style={styles.pulsePillLabel}>Last refresh</Text>
              <Text style={styles.pulsePillValue}>{formatRelativeTime(lastInsightsAt)}</Text>
            </View>
            <View style={styles.pulsePill}>
              <Text style={styles.pulsePillLabel}>Peak score</Text>
              <Text style={styles.pulsePillValue}>{summary.highestSignalScore || 0}</Text>
            </View>
          </View>

          {primarySignal ? (
            <View style={styles.nextMoveBox}>
              <Text style={styles.nextMoveLabel}>Next coaching move</Text>
              <Text style={styles.nextMoveText}>{primarySignal.suggestion}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PATTERN RADAR</Text>
          <Text style={styles.cardTitle}>What the engine is seeing right now</Text>
          <View style={styles.patternGrid}>
            {summary.patternBreakdown.map((pattern) => (
              <View key={pattern.tag} style={styles.patternChip}>
                <Text style={styles.patternCount}>{pattern.count}</Text>
                <Text style={styles.patternLabel}>{getSignalTagLabel(pattern.tag)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.watchlistSection}>
            <Text style={styles.tokenLabel}>Watchlist merchants</Text>
            {summary.watchlistMerchants.length > 0 ? (
              <View style={styles.watchlistRow}>
                {summary.watchlistMerchants.map((merchant) => (
                  <View key={merchant} style={styles.watchlistChip}>
                    <Text style={styles.watchlistChipText}>{merchant}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No merchants are repeatedly triggering alerts yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PLAID + SUPABASE</Text>
          <Text style={styles.cardTitle}>
            {isConfigured ? 'Live bank sync pipeline is ready.' : 'Finish environment setup to go live.'}
          </Text>
          <Text style={styles.cardBody}>{syncMessage}</Text>
          <Text style={styles.endpointLabel}>
            Functions endpoint: {functionsBaseUrl || 'Waiting for EXPO_PUBLIC_SUPABASE_URL'}
          </Text>
          <Text style={styles.refreshHint}>
            {isConfigured
              ? 'Signed-in sessions quietly refresh dashboard reads every 60 seconds.'
              : 'This desktop demo uses local mock data until Supabase and Plaid are configured.'}
          </Text>

          <View style={styles.actionRow}>
            {plaidAction}
            <Pressable
              disabled={!onRefreshSync || isSyncing}
              onPress={onRefreshSync}
              style={[
                styles.secondaryButton,
                !onRefreshSync || isSyncing ? styles.buttonDisabled : null,
              ]}
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
          <Text style={styles.cardTitle}>How this matches the fintech coaching brief</Text>
          <Text style={styles.blueprintRow}>
            Stack: React Native, TypeScript, Supabase, PostgreSQL, Plaid, and edge functions.
          </Text>
          <Text style={styles.blueprintRow}>
            Isolation: RLS protects profiles, plaid_items, accounts, transactions, and
            coaching_signals per authenticated user.
          </Text>
          <Text style={styles.blueprintRow}>
            Detection: shared edge scoring flags merchant loops, spend sprees, category spikes,
            and high-ticket purchases from synced transaction data.
          </Text>
          <Text style={styles.blueprintRow}>
            Performance target: indexed user-scoped reads and summarized coaching responses aimed
            at sub-200ms dashboard calls after deployment tuning.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>COACHING SIGNALS</Text>
          <Text style={styles.cardTitle}>Latest behaviors to review</Text>
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

                  <View style={styles.signalPillRow}>
                    <View
                      style={[
                        styles.signalPill,
                        {
                          borderColor: getLevelAccent(signal.level),
                        },
                      ]}
                    >
                      <Text style={styles.signalPillText}>{getLevelLabel(signal.level)}</Text>
                    </View>
                    <View style={styles.signalPill}>
                      <Text style={styles.signalPillText}>{getSignalTagLabel(signal.tag)}</Text>
                    </View>
                    <View style={styles.signalPill}>
                      <Text style={styles.signalPillText}>{signal.patternCount} related hits</Text>
                    </View>
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
                  <Text style={styles.transactionDate}>
                    {formatCompactDate(transaction.postedDate)}
                    {transaction.pending ? ' / pending' : ''}
                  </Text>
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
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
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
  pulseCard: {
    backgroundColor: '#0E1D38',
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
  pulseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginTop: 16,
  },
  pulsePill: {
    backgroundColor: '#132342',
    borderColor: '#27406B',
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 5,
    marginBottom: 10,
    minWidth: 130,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pulsePillLabel: {
    color: '#8CA0C1',
    fontSize: 12,
    marginBottom: 4,
  },
  pulsePillValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  nextMoveBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#132342',
  },
  nextMoveLabel: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  nextMoveText: {
    color: '#D6E3F8',
    fontSize: 14,
    lineHeight: 21,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  patternChip: {
    backgroundColor: '#111F39',
    borderColor: '#253859',
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 6,
    marginBottom: 12,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  patternCount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  patternLabel: {
    color: '#8CA0C1',
    fontSize: 13,
    lineHeight: 18,
  },
  watchlistSection: {
    marginTop: 8,
  },
  watchlistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  watchlistChip: {
    backgroundColor: '#17305A',
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  watchlistChipText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  endpointLabel: {
    color: '#5EEAD4',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  refreshHint: {
    color: '#8CA0C1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
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
    marginBottom: 8,
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
  signalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  signalPill: {
    borderColor: '#29406B',
    borderWidth: 1,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  signalPillText: {
    color: '#D6E3F8',
    fontSize: 12,
    fontWeight: '700',
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
