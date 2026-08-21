import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import {
  createPlaidLinkSession,
  type LinkEvent,
  type LinkExit,
  type LinkSuccess,
} from 'react-native-plaid-link-sdk';

import { createLinkToken } from '../lib/plaid';
import type { PlaidLinkLauncherProps } from './PlaidLinkLauncher.types';

export function PlaidLinkLauncher({
  disabled,
  onLinkTokenCreated,
  onStatusChange,
  onSuccess,
}: PlaidLinkLauncherProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handlePress = async () => {
    if (disabled || isOpening) {
      return;
    }

    setIsOpening(true);
    onStatusChange?.('Creating a fresh Plaid Link token...');

    try {
      const tokenResponse = await createLinkToken(Platform.OS === 'android' ? 'android' : 'ios');
      onLinkTokenCreated?.(tokenResponse.link_token);
      onStatusChange?.('Opening native Plaid Link...');

      const session = await createPlaidLinkSession({
        token: tokenResponse.link_token,
        onSuccess: async (payload: LinkSuccess) => {
          if (!payload.publicToken) {
            onStatusChange?.('Plaid returned an empty public token.');
            return;
          }

          await onSuccess({
            publicToken: payload.publicToken,
            institutionName: payload.metadata.institution?.name ?? null,
            linkSessionId: payload.metadata.linkSessionId ?? null,
            accountsCount: payload.metadata.accounts.length,
          });
        },
        onExit: (payload: LinkExit) => {
          const errorMessage = payload.error?.displayMessage ?? payload.error?.errorMessage;
          onStatusChange?.(
            errorMessage
              ? `Plaid Link closed: ${errorMessage}`
              : 'Plaid Link closed before bank linking completed.',
          );
        },
        onEvent: (event: LinkEvent) => {
          if (event.eventName === 'OPEN') {
            onStatusChange?.('Plaid Link is open. Finish the bank connection to continue.');
          }
        },
      });

      await session.open(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected Plaid Link error.';
      onStatusChange?.(`Plaid Link failed: ${message}`);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Pressable
      disabled={disabled || isOpening}
      onPress={handlePress}
      style={[styles.button, disabled || isOpening ? styles.buttonDisabled : null]}
    >
      {isOpening ? (
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
