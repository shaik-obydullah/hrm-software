import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import {
  AppButton,
  Card,
  ScrollScreen,
  SectionTitle,
  TextField,
  ToggleRow,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';

type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { settings, saveSettings, changePin, lock, adminName } = useApp();
  const [companyName, setCompanyName] = useState(settings.company_name ?? '');
  const [payeRef, setPayeRef] = useState(settings.paye_reference ?? '');
  const [accountsRef, setAccountsRef] = useState(
    settings.accounts_office_reference ?? '',
  );
  const [allowance, setAllowance] = useState(
    settings.employment_allowance_eligible === 'true',
  );
  const [saving, setSaving] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changing, setChanging] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({
        company_name: companyName.trim() || 'My Company',
        paye_reference: payeRef.trim(),
        accounts_office_reference: accountsRef.trim(),
        employment_allowance_eligible: allowance ? 'true' : 'false',
      });
      Alert.alert('Saved', 'Employer settings updated.');
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePin = async () => {
    if (!/^\d{4,6}$/.test(nextPin)) {
      Alert.alert('Check the PIN', 'Choose a PIN of 4 to 6 digits.');
      return;
    }
    if (nextPin !== confirmPin) {
      Alert.alert('Check the PIN', 'The new PINs do not match.');
      return;
    }
    setChanging(true);
    try {
      const ok = await changePin(currentPin, nextPin);
      if (!ok) {
        Alert.alert('Incorrect PIN', 'Your current PIN is not correct.');
        return;
      }
      setCurrentPin('');
      setNextPin('');
      setConfirmPin('');
      Alert.alert('PIN updated', 'Use the new PIN next time you unlock.');
    } finally {
      setChanging(false);
    }
  };

  return (
    <ScrollScreen>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Signed in as {adminName || 'Admin'}</Text>

      <SectionTitle>Employer</SectionTitle>
      <Card>
        <TextField
          label="Company name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="My Company"
        />
        <TextField
          label="PAYE reference"
          value={payeRef}
          onChangeText={setPayeRef}
          placeholder="123/AB45678"
          autoCapitalize="characters"
        />
        <TextField
          label="Accounts Office reference"
          value={accountsRef}
          onChangeText={setAccountsRef}
          placeholder="123PA00012345"
          autoCapitalize="characters"
        />
        <ToggleRow
          label="Eligible for Employment Allowance"
          hint="Applied against employer NI once per tax year."
          value={allowance}
          onValueChange={setAllowance}
        />
        <AppButton title="Save employer settings" onPress={save} loading={saving} />
      </Card>

      <SectionTitle>Payroll rates</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Tax, NI, pension and student loan rates are effective-dated. Each
          payroll run stores the rate set it used.
        </Text>
        <AppButton
          title="Manage tax & NI rates"
          variant="secondary"
          onPress={() => navigation.navigate('Rates')}
          style={styles.button}
        />
      </Card>

      <SectionTitle>Security</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Change the admin PIN. Biometric unlock is not enabled in this build.
        </Text>
        <TextField
          label="Current PIN"
          value={currentPin}
          onChangeText={(value) => setCurrentPin(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        <TextField
          label="New PIN"
          value={nextPin}
          onChangeText={(value) => setNextPin(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        <TextField
          label="Confirm new PIN"
          value={confirmPin}
          onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        <AppButton
          title="Update PIN"
          variant="secondary"
          onPress={updatePin}
          loading={changing}
          disabled={!currentPin || !nextPin || !confirmPin}
        />
        <AppButton
          title="Lock now"
          variant="ghost"
          onPress={lock}
          style={styles.button}
        />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <Text style={styles.body}>
          HRM Software 0.0.1 · offline UK small-business payroll.
        </Text>
        <Text style={styles.small}>
          This app calculates PAYE, NI, pension, student loan and holiday
          figures on the device. It does not submit RTI to HMRC and is not a
          substitute for professional payroll advice.
        </Text>
        <Text style={styles.small}>
          Data is stored only on this device. There is currently no backup or
          export, so do not use live payroll without an independent record.
        </Text>
      </Card>

      <View style={styles.footerSpace} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  small: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.md,
  },
  footerSpace: {
    height: spacing.xl,
  },
});
