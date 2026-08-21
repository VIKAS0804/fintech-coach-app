import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  isConfigured: boolean;
}

export function AuthScreen({ isConfigured }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    isConfigured
      ? 'Sign in to unlock secure Plaid + Supabase actions.'
      : 'Add your Supabase environment keys first, then come back here to sign in.',
  );

  const handleSubmit = async () => {
    if (!supabase) {
      setStatusMessage('Supabase is not configured yet.');
      return;
    }

    if (!email || !password) {
      setStatusMessage('Enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(mode === 'sign-in' ? 'Signing you in...' : 'Creating your account...');

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setStatusMessage('Signed in. Loading your coaching workspace...');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setStatusMessage(
          'Account created. Check your inbox if email confirmation is enabled in Supabase Auth.',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected auth error.';
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.card}>
        <Text style={styles.kicker}>SECURE SIGN IN</Text>
        <Text style={styles.title}>Connect your coaching data to your account.</Text>
        <Text style={styles.subtitle}>
          This app uses Supabase Auth so every Plaid item, account, transaction, and coaching
          signal stays isolated per user.
        </Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#7B8DAF"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#7B8DAF"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('sign-in')}
            style={[styles.modeChip, mode === 'sign-in' ? styles.modeChipActive : null]}
          >
            <Text
              style={[styles.modeChipText, mode === 'sign-in' ? styles.modeChipTextActive : null]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('sign-up')}
            style={[styles.modeChip, mode === 'sign-up' ? styles.modeChipActive : null]}
          >
            <Text
              style={[styles.modeChipText, mode === 'sign-up' ? styles.modeChipTextActive : null]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <Pressable
          disabled={!isConfigured || isSubmitting}
          onPress={handleSubmit}
          style={[styles.primaryButton, !isConfigured || isSubmitting ? styles.primaryButtonMuted : null]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#081226" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'sign-in' ? 'Sign in securely' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.statusMessage}>{statusMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#081226',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  orbOne: {
    position: 'absolute',
    top: 80,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#13366E',
    opacity: 0.9,
  },
  orbTwo: {
    position: 'absolute',
    bottom: 40,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0C7C93',
    opacity: 0.35,
  },
  card: {
    backgroundColor: '#0B162B',
    borderColor: '#1D3155',
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
  },
  kicker: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    color: '#B9C5DB',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#132342',
    borderColor: '#27406B',
    borderWidth: 1,
    borderRadius: 16,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  modeChip: {
    borderColor: '#29406B',
    borderWidth: 1,
    borderRadius: 999,
    marginRight: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modeChipActive: {
    backgroundColor: '#F97360',
    borderColor: '#F97360',
  },
  modeChipText: {
    color: '#B9C5DB',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#081226',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F97360',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonMuted: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#081226',
    fontSize: 14,
    fontWeight: '900',
  },
  statusMessage: {
    color: '#8CA0C1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
});
