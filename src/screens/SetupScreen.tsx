import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { AppButton, Card, TextField } from '../ui/components';
import { colors, spacing } from '../ui/theme';

export function SetupScreen() {
  const { setup, error: initError } = useApp();
  const [name, setName] = useState('Admin');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Choose a PIN of 4 to 6 digits.');
      return;
    }
    if (pin !== confirm) {
      setError('The two PINs do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setup(name, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>HRM</Text>
        </View>
        <Text style={styles.title}>Set up HRM Software</Text>
        <Text style={styles.subtitle}>
          One admin account protects all employee and payroll data on this
          device.
        </Text>

        <Card style={styles.card}>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sam Taylor"
            autoCapitalize="words"
          />
          <TextField
            label="Choose a PIN"
            value={pin}
            onChangeText={(value) => {
              setPin(value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="4–6 digits"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          <TextField
            label="Confirm PIN"
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="Re-enter PIN"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          {error || initError ? (
            <Text style={styles.error}>{error || initError}</Text>
          ) : null}
          <AppButton
            title="Create admin account"
            onPress={submit}
            loading={busy}
            disabled={!name.trim() || pin.length < 4 || confirm.length < 4}
          />
        </Card>

        <Text style={styles.note}>
          There is no password reset server. If you forget the PIN, the only
          recovery is to clear the app data, which deletes all records. Keep a
          backup before using live payroll.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: {
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
