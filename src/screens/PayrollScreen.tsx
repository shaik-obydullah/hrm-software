import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listPayrollRuns } from '../db/repositories';
import { formatMoney } from '../payroll/money';
import type { PayrollRunWithTotals } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  AppButton,
  Badge,
  Card,
  EmptyState,
  LoadingState,
  ScrollScreen,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { displayDate } from '../utils/dates';

type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function PayrollScreen() {
  const navigation = useNavigation<Nav>();
  const [runs, setRuns] = useState<PayrollRunWithTotals[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRuns(await listPayrollRuns());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollScreen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Payroll</Text>
          <Text style={styles.subtitle}>
            {runs.length} finalised {runs.length === 1 ? 'run' : 'runs'}
          </Text>
        </View>
        <AppButton
          title="+ New run"
          onPress={() => navigation.navigate('PayrollRun')}
          style={styles.newButton}
        />
      </View>

      {loading ? (
        <LoadingState label="Loading payroll runs…" />
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            title="No payroll runs yet"
            body="Add employees, then start a weekly or monthly run. Every run stores the rates and tax figures used."
          />
          <AppButton
            title="Start first payroll run"
            onPress={() => navigation.navigate('PayrollRun')}
          />
        </Card>
      ) : (
        runs.map((run) => (
          <Pressable
            key={run.id}
            onPress={() =>
              navigation.navigate('PayrollRun', { runId: run.id })
            }
            style={({ pressed }) => [styles.runCard, pressed && styles.pressed]}
          >
            <View style={styles.runHeader}>
              <View style={styles.runCopy}>
                <Text style={styles.runDate}>
                  Pay date {displayDate(run.payDate)}
                </Text>
                <Text style={styles.runMeta}>
                  {run.periodStart} → {run.periodEnd} · {run.taxYear}
                </Text>
              </View>
              <Badge
                label={run.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                tone="teal"
              />
            </View>
            <View style={styles.runAmounts}>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>Gross</Text>
                <Text style={styles.amountValue}>
                  {formatMoney(run.totals.grossPayPence)}
                </Text>
              </View>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>Net pay</Text>
                <Text style={styles.amountValue}>
                  {formatMoney(run.totals.netPayPence)}
                </Text>
              </View>
              <View style={styles.amountCell}>
                <Text style={styles.amountLabel}>HMRC</Text>
                <Text style={styles.amountValue}>
                  {formatMoney(
                    run.totals.payePence +
                      run.totals.employeeNiPence +
                      run.totals.employerNiPence +
                      run.totals.studentLoanPence -
                      run.totals.employmentAllowancePence,
                  )}
                </Text>
              </View>
            </View>
            <Text style={styles.runFooter}>
              {run.totals.employeeCount}{' '}
              {run.totals.employeeCount === 1 ? 'employee' : 'employees'} ·
              employer cost {formatMoney(run.totals.employerCostPence)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  newButton: {
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    paddingVertical: 10,
  },
  runCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  runCopy: {
    flex: 1,
  },
  runDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  runMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  runAmounts: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  amountCell: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  runFooter: {
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
