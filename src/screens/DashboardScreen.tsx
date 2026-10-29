import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTaxYear } from '../payroll/engine';
import { formatMoney } from '../payroll/money';
import {
  getHmrcSummary,
  listEmployees,
  listPayrollRuns,
} from '../db/repositories';
import type { HmrcSummary, PayrollRunWithTotals } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import {
  AppButton,
  Card,
  LoadingState,
  Row,
  ScrollScreen,
  SectionTitle,
  StatCard,
} from '../ui/components';
import { colors, radius, spacing } from '../ui/theme';
import { displayDate, todayIso } from '../utils/dates';

type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { adminName, settings, lock } = useApp();
  const [loading, setLoading] = useState(true);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [runs, setRuns] = useState<PayrollRunWithTotals[]>([]);
  const [summary, setSummary] = useState<HmrcSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const employees = await listEmployees();
      const payrollRuns = await listPayrollRuns();
      const taxYear = getTaxYear(todayIso());
      setEmployeeCount(employees.length);
      setActiveCount(employees.filter((employee) => employee.active).length);
      setRuns(payrollRuns);
      setSummary(await getHmrcSummary(taxYear));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const lastRun = runs[0];
  const company = settings.company_name || 'My Company';

  return (
    <ScrollScreen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{company}</Text>
          <Text style={styles.title}>Hello, {adminName || 'Admin'}</Text>
          <Text style={styles.subtitle}>
            {displayDate(todayIso())} · {getTaxYear(todayIso())} tax year
          </Text>
        </View>
        <Pressable onPress={lock} style={styles.lockButton}>
          <Text style={styles.lockText}>Lock</Text>
        </Pressable>
      </View>

      <Row style={styles.stats}>
        <StatCard
          label="Active employees"
          value={String(activeCount)}
          hint={
            employeeCount > activeCount
              ? `${employeeCount - activeCount} archived`
              : 'On the payroll'
          }
        />
        <StatCard
          label="HMRC due YTD"
          value={formatMoney(summary?.totalDuePence ?? 0, { pence: false })}
          hint="PAYE + NI + student loans"
        />
      </Row>

      <Card>
        <Row style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Latest payroll</Text>
          {lastRun ? (
            <Text style={styles.cardMeta}>
              {lastRun.totals.employeeCount} staff
            </Text>
          ) : null}
        </Row>
        {lastRun ? (
          <>
            <Text style={styles.runDate}>
              Paid {displayDate(lastRun.payDate)} · {lastRun.taxYear}
            </Text>
            <View style={styles.totalsGrid}>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>Gross</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(lastRun.totals.grossPayPence)}
                </Text>
              </View>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>Net pay</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(lastRun.totals.netPayPence)}
                </Text>
              </View>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>PAYE</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(lastRun.totals.payePence)}
                </Text>
              </View>
              <View style={styles.totalCell}>
                <Text style={styles.totalLabel}>Employee NI</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(lastRun.totals.employeeNiPence)}
                </Text>
              </View>
            </View>
            <AppButton
              title="View run"
              variant="secondary"
              onPress={() =>
                navigation.navigate('PayrollRun', { runId: lastRun.id })
              }
              style={styles.cardButton}
            />
          </>
        ) : (
          <Text style={styles.emptyCopy}>
            No payroll has been run yet. Add employees, then start your first
            pay run.
          </Text>
        )}
      </Card>

      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.actions}>
        <ActionTile
          label="Run payroll"
          hint="Weekly or monthly"
          onPress={() => navigation.navigate('Payroll')}
        />
        <ActionTile
          label="Add employee"
          hint="Hourly staff"
          onPress={() => navigation.navigate('EmployeeForm')}
        />
        <ActionTile
          label="HMRC report"
          hint="Liability by tax year"
          onPress={() => navigation.navigate('Reports')}
        />
        <ActionTile
          label="Tax & NI rates"
          hint="Effective-dated"
          onPress={() => navigation.navigate('Rates')}
        />
      </View>

      {summary ? (
        <Card>
          <SectionTitle>{summary.taxYear} year to date</SectionTitle>
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>PAYE</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.payePence)}
            </Text>
          </Row>
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Employee NI</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.employeeNiPence)}
            </Text>
          </Row>
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Employer NI</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.employerNiPence)}
            </Text>
          </Row>
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Student loans</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(summary.studentLoanPence)}
            </Text>
          </Row>
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Employment Allowance</Text>
            <Text style={styles.summaryValue}>
              −{formatMoney(summary.employmentAllowancePence)}
            </Text>
          </Row>
          <View style={styles.summaryDivider} />
          <Row style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total due to HMRC</Text>
            <Text style={styles.summaryTotalValue}>
              {formatMoney(summary.totalDuePence)}
            </Text>
          </Row>
        </Card>
      ) : null}
    </ScrollScreen>
  );
}

function ActionTile({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.teal,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  lockButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  lockText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  stats: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  runDate: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  totalCell: {
    minWidth: '44%',
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardButton: {
    marginTop: spacing.md,
  },
  emptyCopy: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  action: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionHint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  summaryRow: {
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.teal,
  },
});
