import 'react-native-url-polyfill/auto';

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { appConfig, isSupabaseConfigured } from './src/config/env';
import { mockSignals, mockTransactions } from './src/data/mock';
import { createLinkToken } from './src/lib/plaid';
import { DashboardScreen } from './src/screens/DashboardScreen';

const initialSyncMessage = isSupabaseConfigured
  ? 'Supabase keys detected. Generate a Plaid link token to start live bank syncing.'
  : 'Add the values from .env.example to enable Supabase auth, Plaid sync, and edge functions.';

export default function App() {
  const [syncMessage, setSyncMessage] = useState(initialSyncMessage);
  const [linkTokenPreview, setLinkTokenPreview] = useState<string | null>(null);

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

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      <DashboardScreen
        functionsBaseUrl={appConfig.functionsBaseUrl}
        isConfigured={isSupabaseConfigured}
        linkTokenPreview={linkTokenPreview}
        onConnectPlaid={handlePlaidConnect}
        signals={mockSignals}
        syncMessage={syncMessage}
        transactions={mockTransactions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#081226',
  },
});
