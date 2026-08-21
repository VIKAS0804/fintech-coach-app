import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { usePlaidLink, type PlaidLinkOptionsWithLinkToken } from 'react-plaid-link';

import { createLinkToken } from '../lib/plaid';
import type { PlaidLinkLauncherProps } from './PlaidLinkLauncher.types';

export function PlaidLinkLauncher({
  disabled,
  onLinkTokenCreated,
  onStatusChange,
  onSuccess,
}: PlaidLinkLauncherProps) {
  const [token, setToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  const redirectUri =
    typeof window !== 'undefined' && window.location.href.includes('oauth_state_id')
      ? window.location.href
      : undefined;

  const config = useMemo<PlaidLinkOptionsWithLinkToken>(
    () => ({
      token,
      receivedRedirectUri: redirectUri,
      onSuccess: async (publicToken, metadata) => {
        if (!publicToken) {
          onStatusChange?.('Plaid returned an empty public token.');
          return;
        }

        await onSuccess({
          publicToken,
          institutionName: metadata.institution?.name ?? null,
          linkSessionId: metadata.link_session_id ?? null,
          accountsCount: metadata.accounts.length,
        });
      },
      onExit: (error) => {
        const errorMessage = error?.display_message ?? error?.error_message;
        onStatusChange?.(
          errorMessage
            ? `Plaid Link closed: ${errorMessage}`
            : 'Plaid Link closed before bank linking completed.',
        );
      },
      onEvent: (eventName) => {
        if (eventName === 'OPEN') {
          onStatusChange?.('Plaid Link is open in the browser.');
        }
      },
      onLoad: () => {
        onStatusChange?.('Plaid Link finished loading.');
      },
    }),
    [onStatusChange, onSuccess, redirectUri, token],
  );

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (shouldOpen && ready) {
      open();
      setShouldOpen(false);
      setIsPreparing(false);
    }
  }, [open, ready, shouldOpen]);

  const handlePress = async () => {
    if (disabled || isPreparing) {
      return;
    }

    setIsPreparing(true);
    onStatusChange?.('Creating a fresh Plaid Link token...');

    try {
      const tokenResponse = await createLinkToken('web');
      setToken(tokenResponse.link_token);
      onLinkTokenCreated?.(tokenResponse.link_token);
      setShouldOpen(true);
      onStatusChange?.('Loading Plaid Link in the browser...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected Plaid Link error.';
      onStatusChange?.(`Plaid Link failed: ${message}`);
      setIsPreparing(false);
    }
  };

  return (
    <Pressable
      disabled={disabled || isPreparing}
      onPress={handlePress}
      style={[styles.button, disabled || isPreparing ? styles.buttonDisabled : null]}
    >
      {isPreparing ? (
        <ActivityIndicator color="#081226" />
      ) : (
        <Text style={styles.buttonText}>Connect bank with Plaid</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F97360',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#081226',
    fontSize: 14,
    fontWeight: '900',
  },
});
