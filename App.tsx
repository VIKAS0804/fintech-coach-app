import 'react-native-url-polyfill/auto';

import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { appConfig, isSupabaseConfigured } from './src/config/env';
import { mockSignals, mockTransactions } from './src/data/mock';
import { createLinkToken } from './src/lib/plaid';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

const initialSyncMessage = isSupabaseConfigured
  ? 'Supabase keys detected. Generate a Plaid link token to start live bank syncing.'
  : 'Add the values from .env.example to enable Supabase auth, Plaid sync, and edge functions.';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);
  const [syncMessage, setSyncMessage] = useState(initialSyncMessage);
  const [linkTokenPreview, setLinkTokenPreview] = useState<string | null>(null);

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

  const handlePlaidConnect = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Supabase config missing',
        'Create a local .env file from .env.example and add your EXPO_PUBLIC_SUPABASE_URL plus EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
      return;
    }

    try {
      setSyncMessage('Requesting a fresh Plaid link token from the Supabase edge function...');
      const payload = await createLinkToken('ios');
      setLinkTokenPreview(payload.link_token);
      setSyncMessage(
        'Plaid link token ready. Wire it into the Plaid Link SDK on device to complete account linking.',
      );
      Alert.alert(
        'Plaid token ready',
        'The backend returned a live link token. Next step: launch Plaid Link and exchange the public token through the included edge functions.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLinkTokenPreview(null);
      setSyncMessage(`Plaid setup is blocked: ${message}`);
      Alert.alert('Plaid setup failed', message);
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
        linkTokenPreview={linkTokenPreview}
        onConnectPlaid={handlePlaidConnect}
        onSignOut={session ? handleSignOut : undefined}
        signals={mockSignals}
        syncMessage={syncMessage}
        transactions={mockTransactions}
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
