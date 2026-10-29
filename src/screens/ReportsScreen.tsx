import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getHmrcSummary, listPayrollRuns } from '../db/repositories';
import { getTaxYear } from '../payroll/engine';
import { formatMoney } from '../payroll/money';
import type { HmrcSummary, PayrollRunWithTotals } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  Badge,
  Card,
  EmptyState,
  KeyValue,
  LoadingState,
  ScrollScreen,
  SectionTitle,
  Segmented,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { displayDate, todayIso } from '../utils/dates';

type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function ReportsScreen() {
  const navigation = useNavigation<Nav>();
  const currentTaxYear = getTaxYear(todayIso());
  const [taxYear, setTaxYear] = useState(currentTaxYear);
  const [runs, setRuns] = useState<PayrollRunWithTotals[]>([]);
  const [summary, setSummary] = useState<HmrcSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allRuns = await listPayrollRuns();
      setRuns(allRuns);
      setSummary(await getHmrcSummary(taxYear));
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const years = useMemo(() => {
    const found = new Set<string>([currentTaxYear, taxYear]);
    runs.forEach((run) => found.add(run.taxYear));
    return Array.from(found).sort().reverse();
  }, [runs, currentTaxYear, taxYear]);

  const yearRuns = runs.filter((run) => run.taxYear === taxYear);

  return (
    <ScrollScreen>
      <Text style={styles.title}>HMRC reports</Text>
      <Text style={styles.subtitle}>
        Liabilities from finalised payroll runs, by tax year.
      </Text>

      <View style={styles.yearRow}>
        <Segmented<string>
          options={years.map((year) => ({ value: year, label: year }))}
          value={taxYear}
          onChange={setTaxYear}
        />
      </View>

      {loading ? (
        <LoadingState label="Building report…" />
      ) : (
        <>
          <Card>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{taxYear} liability</Text>
              <Badge
                label={`${summary?.runCount ?? 0} ${
                  summary?.runCount === 1 ? 'run' : 'runs'
                }`}
                tone="teal"
              />
            </View>
            <KeyValue
              label="PAYE income tax"
              value={formatMoney(summary?.payePence ?? 0)}
            />
            <KeyValue
              label="Employee NI"
              value={formatMoney(summary?.employeeNiPence ?? 0)}
            />
            <KeyValue
              label="Employer NI"
              value={formatMoney(summary?.employerNiPence ?? 0)}
            />
            <KeyValue
              label="Student loans"
              value={formatMoney(summary?.studentLoanPence ?? 0)}
            />
            <KeyValue
              label="Employment Allowance"
              value={`−${formatMoney(summary?.employmentAllowancePence ?? 0)}`}
            />
            <View style={styles.divider} />
            <KeyValue
              label="Total due to HMRC"
              value={formatMoney(summary?.totalDuePence ?? 0)}
              strong
            />
          </Card>

          <SectionTitle>Employer totals</SectionTitle>
          <Card>
            <KeyValue
              label="Gross pay"
              value={formatMoney(summary?.grossPayPence ?? 0)}
            />
            <KeyValue
              label="Employer pension"
              value={formatMoney(summary?.employerPensionPence ?? 0)}
            />
            <KeyValue
              label="Employees paid"
              value={String(summary?.employeeCount ?? 0)}
            />
          </Card>

          <SectionTitle>Runs in {taxYear}</SectionTitle>
          {yearRuns.length === 0 ? (
            <Card>
              <EmptyState
                title="No runs in this tax year"
                body="Finalised payroll runs will appear here with their HMRC liability."
              />
            </Card>
          ) : (
            yearRuns.map((run) => {
              const due =
                run.totals.payePence +
                run.totals.employeeNiPence +
                run.totals.employerNiPence +
                run.totals.studentLoanPence -
                run.totals.employmentAllowancePence;
              return (
                <Pressable
                  key={run.id}
                  onPress={() =>
                    navigation.navigate('PayrollRun', { runId: run.id })
                  }
                  style={({ pressed }) => [
                    styles.runRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.runCopy}>
                    <Text style={styles.runDate}>
                      {displayDate(run.payDate)}
                    </Text>
                    <Text style={styles.runMeta}>
                      {run.periodStart} → {run.periodEnd} ·{' '}
                      {run.totals.employeeCount} staff
                    </Text>
                  </View>
                  <View style={styles.runAmounts}>
                    <Text style={styles.runDue}>{formatMoney(due)}</Text>
                    <Text style={styles.runDueLabel}>HMRC</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })
          )}

          <Text style={styles.note}>
            Employment Allowance is applied to employer NI in the run it was
            claimed. This report is a calculator output, not an RTI submission.
          </Text>
        </>
      )}
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
  yearRow: {
    marginBottom: spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
  runCopy: {
    flex: 1,
  },
  runDate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  runMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  runAmounts: {
    alignItems: 'flex-end',
  },
  runDue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  runDueLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  chevron: {
    fontSize: 22,
    color: colors.muted,
  },
  note: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 17,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
