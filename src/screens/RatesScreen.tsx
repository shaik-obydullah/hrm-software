import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { getActiveRateSet, saveRateSet } from '../db/repositories';
import { poundsFromPence, roundPence } from '../payroll/money';
import type { Rates } from '../types';
import type { RootStackParamList } from '../navigation/types';
import {
  AppButton,
  Card,
  LoadingState,
  ScrollScreen,
  SectionTitle,
  TextField,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { isValidIsoDate, todayIso } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'Rates'>;

interface FormState {
  name: string;
  taxYear: string;
  effectiveFrom: string;
  personalAllowance: string;
  taperThreshold: string;
  taperRate: string;
  basicLimit: string;
  basicRate: string;
  higherLimit: string;
  higherRate: string;
  additionalRate: string;
  niPt: string;
  niUel: string;
  niSt: string;
  niEa: string;
  niEmployeeMain: string;
  niEmployeeUpper: string;
  niEmployer: string;
  pensionLower: string;
  pensionUpper: string;
  pensionMinEmployee: string;
  pensionMinEmployer: string;
  holidayPct: string;
  slPlan1Threshold: string;
  slPlan1Rate: string;
  slPlan2Threshold: string;
  slPlan2Rate: string;
  slPlan4Threshold: string;
  slPlan4Rate: string;
  slPlan5Threshold: string;
  slPlan5Rate: string;
  slPostgradThreshold: string;
  slPostgradRate: string;
}

function moneyField(pence: number): string {
  return String(poundsFromPence(pence));
}

function pctField(rate: number): string {
  return String(rate * 100);
}

function toForm(rates: Rates, name: string, effectiveFrom: string): FormState {
  const basic = rates.bands[0] ?? { upToPence: 0, rate: 0.2 };
  const higher = rates.bands[1] ?? { upToPence: 0, rate: 0.4 };
  const additional = rates.bands[2] ?? { upToPence: null, rate: 0.45 };
  const categoryA = rates.ni.categories.A;
  return {
    name,
    taxYear: rates.taxYear,
    effectiveFrom,
    personalAllowance: moneyField(rates.personalAllowancePence),
    taperThreshold: moneyField(rates.allowanceTaperThresholdPence),
    taperRate: pctField(rates.allowanceTaperRate),
    basicLimit: moneyField(basic.upToPence ?? 0),
    basicRate: pctField(basic.rate),
    higherLimit: moneyField(higher.upToPence ?? 0),
    higherRate: pctField(higher.rate),
    additionalRate: pctField(additional.rate),
    niPt: moneyField(rates.ni.primaryThresholdPence),
    niUel: moneyField(rates.ni.upperEarningsLimitPence),
    niSt: moneyField(rates.ni.secondaryThresholdPence),
    niEa: moneyField(rates.ni.employmentAllowancePence),
    niEmployeeMain: pctField(categoryA.employeeMain),
    niEmployeeUpper: pctField(categoryA.employeeUpper),
    niEmployer: pctField(categoryA.employer),
    pensionLower: moneyField(rates.pension.lowerPence),
    pensionUpper: moneyField(rates.pension.upperPence),
    pensionMinEmployee: pctField(rates.pension.minEmployeePct),
    pensionMinEmployer: pctField(rates.pension.minEmployerPct),
    holidayPct: pctField(rates.holidayAccrualPct),
    slPlan1Threshold: moneyField(rates.studentLoans.PLAN_1.thresholdPence),
    slPlan1Rate: pctField(rates.studentLoans.PLAN_1.rate),
    slPlan2Threshold: moneyField(rates.studentLoans.PLAN_2.thresholdPence),
    slPlan2Rate: pctField(rates.studentLoans.PLAN_2.rate),
    slPlan4Threshold: moneyField(rates.studentLoans.PLAN_4.thresholdPence),
    slPlan4Rate: pctField(rates.studentLoans.PLAN_4.rate),
    slPlan5Threshold: moneyField(rates.studentLoans.PLAN_5.thresholdPence),
    slPlan5Rate: pctField(rates.studentLoans.PLAN_5.rate),
    slPostgradThreshold: moneyField(
      rates.studentLoans.POSTGRAD.thresholdPence,
    ),
    slPostgradRate: pctField(rates.studentLoans.POSTGRAD.rate),
  };
}

function num(value: string): number | null {
  const cleaned = value.replace(/[£,%\s,]/g, '');
  if (cleaned === '') {
    return 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RatesScreen({ navigation }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const active = await getActiveRateSet(todayIso());
      if (active) {
        setOriginal(active.data);
        setForm(toForm(active.data, active.name, todayIso()));
      }
      setLoading(false);
    })();
  }, []);

  const set = (key: keyof FormState, value: string) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const buildRates = (): Rates | null => {
    if (!form || !original) {
      return null;
    }
    const values: Record<string, number | null> = {
      personalAllowance: num(form.personalAllowance),
      taperThreshold: num(form.taperThreshold),
      taperRate: num(form.taperRate),
      basicLimit: num(form.basicLimit),
      basicRate: num(form.basicRate),
      higherLimit: num(form.higherLimit),
      higherRate: num(form.higherRate),
      additionalRate: num(form.additionalRate),
      niPt: num(form.niPt),
      niUel: num(form.niUel),
      niSt: num(form.niSt),
      niEa: num(form.niEa),
      niEmployeeMain: num(form.niEmployeeMain),
      niEmployeeUpper: num(form.niEmployeeUpper),
      niEmployer: num(form.niEmployer),
      pensionLower: num(form.pensionLower),
      pensionUpper: num(form.pensionUpper),
      pensionMinEmployee: num(form.pensionMinEmployee),
      pensionMinEmployer: num(form.pensionMinEmployer),
      holidayPct: num(form.holidayPct),
      slPlan1Threshold: num(form.slPlan1Threshold),
      slPlan1Rate: num(form.slPlan1Rate),
      slPlan2Threshold: num(form.slPlan2Threshold),
      slPlan2Rate: num(form.slPlan2Rate),
      slPlan4Threshold: num(form.slPlan4Threshold),
      slPlan4Rate: num(form.slPlan4Rate),
      slPlan5Threshold: num(form.slPlan5Threshold),
      slPlan5Rate: num(form.slPlan5Rate),
      slPostgradThreshold: num(form.slPostgradThreshold),
      slPostgradRate: num(form.slPostgradRate),
    };
    const invalid = Object.entries(values).find(
      ([, value]) => value === null || value < 0,
    );
    if (invalid) {
      Alert.alert('Check the rates', 'Every rate must be a positive number.');
      return null;
    }
    if (!form.name.trim() || !form.taxYear.trim()) {
      Alert.alert('Check the rates', 'Name and tax year are required.');
      return null;
    }
    if (!isValidIsoDate(form.effectiveFrom)) {
      Alert.alert('Check the date', 'Effective from must be YYYY-MM-DD.');
      return null;
    }

    const categoryRates = { ...original.ni.categories };
    categoryRates.A = {
      employeeMain: (values.niEmployeeMain as number) / 100,
      employeeUpper: (values.niEmployeeUpper as number) / 100,
      employer: (values.niEmployer as number) / 100,
    };

    return {
      ...original,
      taxYear: form.taxYear.trim(),
      personalAllowancePence: roundPence((values.personalAllowance as number) * 100),
      allowanceTaperThresholdPence: roundPence(
        (values.taperThreshold as number) * 100,
      ),
      allowanceTaperRate: (values.taperRate as number) / 100,
      bands: [
        {
          upToPence: roundPence((values.basicLimit as number) * 100),
          rate: (values.basicRate as number) / 100,
        },
        {
          upToPence: roundPence((values.higherLimit as number) * 100),
          rate: (values.higherRate as number) / 100,
        },
        {
          upToPence: null,
          rate: (values.additionalRate as number) / 100,
        },
      ],
      ni: {
        ...original.ni,
        primaryThresholdPence: roundPence((values.niPt as number) * 100),
        upperEarningsLimitPence: roundPence((values.niUel as number) * 100),
        secondaryThresholdPence: roundPence((values.niSt as number) * 100),
        employmentAllowancePence: roundPence((values.niEa as number) * 100),
        categories: categoryRates,
      },
      pension: {
        lowerPence: roundPence((values.pensionLower as number) * 100),
        upperPence: roundPence((values.pensionUpper as number) * 100),
        minEmployeePct: (values.pensionMinEmployee as number) / 100,
        minEmployerPct: (values.pensionMinEmployer as number) / 100,
      },
      holidayAccrualPct: (values.holidayPct as number) / 100,
      studentLoans: {
        PLAN_1: {
          thresholdPence: roundPence((values.slPlan1Threshold as number) * 100),
          rate: (values.slPlan1Rate as number) / 100,
        },
        PLAN_2: {
          thresholdPence: roundPence((values.slPlan2Threshold as number) * 100),
          rate: (values.slPlan2Rate as number) / 100,
        },
        PLAN_4: {
          thresholdPence: roundPence((values.slPlan4Threshold as number) * 100),
          rate: (values.slPlan4Rate as number) / 100,
        },
        PLAN_5: {
          thresholdPence: roundPence((values.slPlan5Threshold as number) * 100),
          rate: (values.slPlan5Rate as number) / 100,
        },
        POSTGRAD: {
          thresholdPence: roundPence(
            (values.slPostgradThreshold as number) * 100,
          ),
          rate: (values.slPostgradRate as number) / 100,
        },
      },
    };
  };

  const save = async () => {
    const rates = buildRates();
    if (!rates || !form) {
      return;
    }
    setSaving(true);
    try {
      await saveRateSet(form.name.trim(), form.effectiveFrom, rates);
      Alert.alert(
        'Rates saved',
        'A new active rate set was created. Past payroll runs keep the rates they used.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert(
        'Could not save rates',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading rates…" />;
  }

  if (!form) {
    return (
      <ScrollScreen>
        <Card>
          <Text style={styles.hint}>
            No rate set found. Reinstall the app to seed the default rates.
          </Text>
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen>
      <Card>
        <Text style={styles.notice}>
          Saving creates a new effective-dated rate set and archives the current
          one. Always check the figures against gov.uk before using them.
        </Text>
        <TextField
          label="Rate set name"
          value={form.name}
          onChangeText={(value) => set('name', value)}
        />
        <TextField
          label="Tax year"
          value={form.taxYear}
          onChangeText={(value) => set('taxYear', value)}
          placeholder="2026/27"
        />
        <TextField
          label="Effective from"
          value={form.effectiveFrom}
          onChangeText={(value) => set('effectiveFrom', value)}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
      </Card>

      <SectionTitle>Income tax</SectionTitle>
      <Card>
        <TextField
          label="Personal allowance (£)"
          value={form.personalAllowance}
          onChangeText={(value) => set('personalAllowance', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label="Allowance taper threshold (£)"
          value={form.taperThreshold}
          onChangeText={(value) => set('taperThreshold', value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label="Allowance taper rate (%)"
          value={form.taperRate}
          onChangeText={(value) => set('taperRate', value)}
          keyboardType="decimal-pad"
        />
        <View style={styles.pairRow}>
          <TextField
            label="Basic band up to (£)"
            value={form.basicLimit}
            onChangeText={(value) => set('basicLimit', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Basic rate (%)"
            value={form.basicRate}
            onChangeText={(value) => set('basicRate', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <View style={styles.pairRow}>
          <TextField
            label="Higher band up to (£)"
            value={form.higherLimit}
            onChangeText={(value) => set('higherLimit', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Higher rate (%)"
            value={form.higherRate}
            onChangeText={(value) => set('higherRate', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <TextField
          label="Additional rate (%)"
          value={form.additionalRate}
          onChangeText={(value) => set('additionalRate', value)}
          keyboardType="decimal-pad"
        />
      </Card>

      <SectionTitle>National Insurance</SectionTitle>
      <Card>
        <View style={styles.pairRow}>
          <TextField
            label="Primary threshold (£)"
            value={form.niPt}
            onChangeText={(value) => set('niPt', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Upper earnings limit (£)"
            value={form.niUel}
            onChangeText={(value) => set('niUel', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <View style={styles.pairRow}>
          <TextField
            label="Secondary threshold (£)"
            value={form.niSt}
            onChangeText={(value) => set('niSt', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Employment Allowance (£)"
            value={form.niEa}
            onChangeText={(value) => set('niEa', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <Text style={styles.subheading}>Category A rates</Text>
        <View style={styles.pairRow}>
          <TextField
            label="Employee main (%)"
            value={form.niEmployeeMain}
            onChangeText={(value) => set('niEmployeeMain', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Employee upper (%)"
            value={form.niEmployeeUpper}
            onChangeText={(value) => set('niEmployeeUpper', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <TextField
          label="Employer (%)"
          value={form.niEmployer}
          onChangeText={(value) => set('niEmployer', value)}
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>
          Other NI categories keep their existing rates. Edit them in the
          database only if you know the statutory figures.
        </Text>
      </Card>

      <SectionTitle>Pension</SectionTitle>
      <Card>
        <View style={styles.pairRow}>
          <TextField
            label="Lower qualifying (£)"
            value={form.pensionLower}
            onChangeText={(value) => set('pensionLower', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Upper qualifying (£)"
            value={form.pensionUpper}
            onChangeText={(value) => set('pensionUpper', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
        <View style={styles.pairRow}>
          <TextField
            label="Min employee (%)"
            value={form.pensionMinEmployee}
            onChangeText={(value) => set('pensionMinEmployee', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
          <TextField
            label="Min employer (%)"
            value={form.pensionMinEmployer}
            onChangeText={(value) => set('pensionMinEmployer', value)}
            keyboardType="decimal-pad"
            containerStyle={styles.pair}
          />
        </View>
      </Card>

      <SectionTitle>Student loans</SectionTitle>
      <Card>
        <StudentLoanFields
          label="Plan 1"
          threshold={form.slPlan1Threshold}
          rate={form.slPlan1Rate}
          onThreshold={(value) => set('slPlan1Threshold', value)}
          onRate={(value) => set('slPlan1Rate', value)}
        />
        <StudentLoanFields
          label="Plan 2"
          threshold={form.slPlan2Threshold}
          rate={form.slPlan2Rate}
          onThreshold={(value) => set('slPlan2Threshold', value)}
          onRate={(value) => set('slPlan2Rate', value)}
        />
        <StudentLoanFields
          label="Plan 4"
          threshold={form.slPlan4Threshold}
          rate={form.slPlan4Rate}
          onThreshold={(value) => set('slPlan4Threshold', value)}
          onRate={(value) => set('slPlan4Rate', value)}
        />
        <StudentLoanFields
          label="Plan 5"
          threshold={form.slPlan5Threshold}
          rate={form.slPlan5Rate}
          onThreshold={(value) => set('slPlan5Threshold', value)}
          onRate={(value) => set('slPlan5Rate', value)}
        />
        <StudentLoanFields
          label="Postgraduate"
          threshold={form.slPostgradThreshold}
          rate={form.slPostgradRate}
          onThreshold={(value) => set('slPostgradThreshold', value)}
          onRate={(value) => set('slPostgradRate', value)}
        />
      </Card>

      <SectionTitle>Holiday</SectionTitle>
      <Card>
        <TextField
          label="Accrual rate (% of hours worked)"
          value={form.holidayPct}
          onChangeText={(value) => set('holidayPct', value)}
          keyboardType="decimal-pad"
        />
      </Card>

      <AppButton title="Save as new rate set" onPress={save} loading={saving} />
    </ScrollScreen>
  );
}

function StudentLoanFields({
  label,
  threshold,
  rate,
  onThreshold,
  onRate,
}: {
  label: string;
  threshold: string;
  rate: string;
  onThreshold: (value: string) => void;
  onRate: (value: string) => void;
}) {
  return (
    <View>
      <Text style={styles.subheading}>{label}</Text>
      <View style={styles.pairRow}>
        <TextField
          label="Annual threshold (£)"
          value={threshold}
          onChangeText={onThreshold}
          keyboardType="decimal-pad"
          containerStyle={styles.pair}
        />
        <TextField
          label="Rate (%)"
          value={rate}
          onChangeText={onRate}
          keyboardType="decimal-pad"
          containerStyle={styles.pair}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    padding: spacing.md,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  subheading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  pairRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pair: {
    flex: 1,
  },
});
