import 'react-native-url-polyfill/auto';

import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { PlaidLinkLauncher } from './src/components/PlaidLinkLauncher';
import { appConfig, isSupabaseConfigured } from './src/config/env';
import { mockSignals, mockTransactions } from './src/data/mock';
import {
  exchangePublicToken,
  fetchCoachingSignals,
  fetchLinkedInstitutions,
  fetchRecentTransactions,
  syncTransactions,
} from './src/lib/plaid';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import type { LinkedInstitution, SpendingSignal, Transaction } from './src/types/fintech';

const initialSyncMessage = isSupabaseConfigured
  ? 'Supabase keys detected. Sign in, connect a bank with Plaid, and sync live transaction data.'
  : 'Add the values from .env.example to enable Supabase auth, Plaid sync, and edge functions.';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(initialSyncMessage);
  const [lastInsightsAt, setLastInsightsAt] = useState<string | null>(new Date().toISOString());
  const [linkTokenPreview, setLinkTokenPreview] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [signals, setSignals] = useState<SpendingSignal[]>(mockSignals);
  const [linkedInstitutions, setLinkedInstitutions] = useState<LinkedInstitution[]>([]);

  useEffect(() => {
    if (!supabase) {
      setIsSessionLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setTransactions(mockTransactions);
      setSignals(mockSignals);
      setLinkedInstitutions([]);
      setLastInsightsAt(new Date().toISOString());
      setSyncMessage(
        isSupabaseConfigured
          ? initialSyncMessage
          : 'Mock mode is active. Add Supabase keys to unlock live Plaid sync, secure auth, and per-user isolation.',
      );
      return;
    }

    void refreshDashboardData();
  }, [session]);

  const refreshDashboardData = async ({
    preserveMessage = false,
  }: {
    preserveMessage?: boolean;
  } = {}) => {
    if (!session || !isSupabaseConfigured) {
      return;
    }

    try {
      const [recentTransactions, signalResponse, institutions] = await Promise.all([
        fetchRecentTransactions(),
        fetchCoachingSignals(),
        fetchLinkedInstitutions(),
      ]);

      setTransactions(recentTransactions);
      setSignals(signalResponse.signals);
      setLinkedInstitutions(institutions);
      setLastInsightsAt(signalResponse.generated_at);

      if (!preserveMessage) {
        if (institutions.length === 0) {
          setSyncMessage('No linked banks yet. Use Plaid Link to connect your first institution.');
        } else {
          setSyncMessage(
            `Connected ${institutions.length} institution${institutions.length === 1 ? '' : 's'}. Latest sync flagged ${signalResponse.summary.signalsFlagged} coaching signals.`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!preserveMessage) {
        setSyncMessage(`Live dashboard refresh is blocked: ${message}`);
      }
    }
  };

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshDashboardData({ preserveMessage: true });
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [session]);

  const handlePlaidSuccess = async ({
    accountsCount,
    institutionName,
    publicToken,
  }: {
    accountsCount: number;
    institutionName: string | null;
    linkSessionId: string | null;
    publicToken: string;
  }) => {
    try {
      setIsSyncing(true);
      setSyncMessage('Exchanging the Plaid public token on the server...');
      const exchange = await exchangePublicToken(publicToken);

      setSyncMessage('Public token exchanged. Syncing live transactions...');
      const syncResponse = await syncTransactions({
        itemId: exchange.item_id,
      });

      await refreshDashboardData({ preserveMessage: true });
      setLinkTokenPreview(null);
      setSyncMessage(
        `Connected ${exchange.institution_name ?? institutionName ?? 'your institution'}. Synced ${syncResponse.transactions_upserted} transactions and flagged ${syncResponse.signals_flagged} signals.`,
      );

      Alert.alert(
        'Bank connected',
        `Linked ${accountsCount} account${accountsCount === 1 ? '' : 's'} and synced ${syncResponse.transactions_upserted} transactions.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSyncMessage(`Plaid sync is blocked: ${message}`);
      Alert.alert('Plaid sync failed', message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshSync = async () => {
    if (!isSupabaseConfigured || !session) {
      Alert.alert('Supabase config missing', 'Add your project keys before refreshing live data.');
      return;
    }

    if (linkedInstitutions.length === 0) {
      Alert.alert('No linked banks', 'Connect a bank with Plaid before running a live sync.');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncMessage('Refreshing linked institutions from Plaid...');

      const results = await Promise.all(
        linkedInstitutions.map((institution) =>
          syncTransactions({
            itemId: institution.plaidItemId,
          }),
        ),
      );

      await refreshDashboardData({ preserveMessage: true });

      const totals = results.reduce(
        (accumulator, result) => ({
          transactions: accumulator.transactions + result.transactions_upserted,
          signals: accumulator.signals + result.signals_flagged,
        }),
        {
          transactions: 0,
          signals: 0,
        },
      );

      setSyncMessage(
        `Refresh complete across ${linkedInstitutions.length} institution${linkedInstitutions.length === 1 ? '' : 's'}. Upserted ${totals.transactions} transactions and flagged ${totals.signals} signals.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSyncMessage(`Refresh failed: ${message}`);
      Alert.alert('Refresh failed', message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Sign out failed', error.message);
    }
  };

  if (isSessionLoading) {
    return (
      <View style={styles.loadingShell}>
        <StatusBar style="light" />
        <ActivityIndicator color="#F97360" size="large" />
        <Text style={styles.loadingText}>Restoring your secure session...</Text>
      </View>
    );
  }

  if (isSupabaseConfigured && !session) {
    return (
      <View style={styles.appShell}>
        <StatusBar style="light" />
        <AuthScreen isConfigured={isSupabaseConfigured} />
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      <DashboardScreen
        functionsBaseUrl={appConfig.functionsBaseUrl}
        isConfigured={isSupabaseConfigured}
        isSyncing={isSyncing}
        lastInsightsAt={lastInsightsAt}
        linkTokenPreview={linkTokenPreview}
        linkedInstitutions={linkedInstitutions}
        onRefreshSync={handleRefreshSync}
        onSignOut={session ? handleSignOut : undefined}
        plaidAction={
          <PlaidLinkLauncher
            disabled={!session || isSyncing}
            onLinkTokenCreated={setLinkTokenPreview}
            onStatusChange={setSyncMessage}
            onSuccess={handlePlaidSuccess}
          />
        }
        signals={signals}
        syncMessage={syncMessage}
        transactions={transactions}
        userEmail={session?.user.email ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#081226',
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#081226',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#B9C5DB',
    fontSize: 15,
    marginTop: 14,
  },
});
