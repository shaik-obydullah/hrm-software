import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { AppButton } from '../ui/components';
import { PinDots, PinPad } from '../ui/PinPad';
import { colors, spacing } from '../ui/theme';

export function LockScreen() {
  const { unlock, adminName } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await unlock(value);
      if (!ok) {
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  const onChange = (value: string) => {
    setPin(value);
    setError('');
    if (value.length === 6) {
      submit(value);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>HRM</Text>
        </View>
        <Text style={styles.title}>HRM Software</Text>
        <Text style={styles.subtitle}>
          Welcome back{adminName ? `, ${adminName}` : ''}
        </Text>
      </View>

      <PinDots length={pin.length} error={Boolean(error)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PinPad value={pin} onChange={onChange} />

      <AppButton
        title="Unlock"
        onPress={() => submit(pin)}
        disabled={pin.length < 4}
        loading={busy}
        style={styles.unlock}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logo: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  unlock: {
    marginTop: spacing.xl,
  },
});
