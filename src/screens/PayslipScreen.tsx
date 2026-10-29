import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getEmployee,
  getPayrollRun,
  getPayslip,
} from '../db/repositories';
import { formatHours, formatMoney } from '../payroll/money';
import type {
  Employee,
  PayrollRunWithTotals,
  Payslip,
} from '../types';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import {
  Card,
  KeyValue,
  LoadingState,
  ScrollScreen,
  SectionTitle,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { displayDate } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'Payslip'>;

interface Breakdown {
  periodNumber?: number;
  totalPeriods?: number;
  tax?: {
    parsed?: { code?: string; warning?: string };
  };
  ni?: { category?: string };
  holiday?: { accruedHours?: number };
}

export function PayslipScreen({ route }: Props) {
  const { payslipId } = route.params;
  const { settings } = useApp();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [run, setRun] = useState<PayrollRunWithTotals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const slip = await getPayslip(payslipId);
      if (slip) {
        setPayslip(slip);
        const [record, payrollRun] = await Promise.all([
          getEmployee(slip.employeeId),
          getPayrollRun(slip.payrollRunId),
        ]);
        setEmployee(record);
        setRun(payrollRun);
      }
      setLoading(false);
    })();
  }, [payslipId]);

  if (loading) {
    return <LoadingState label="Loading payslip…" />;
  }

  if (!payslip || !employee) {
    return (
      <ScrollScreen>
        <Card>
          <Text style={styles.missing}>Payslip not found.</Text>
        </Card>
      </ScrollScreen>
    );
  }

  let breakdown: Breakdown = {};
  try {
    breakdown = JSON.parse(payslip.breakdownJson) as Breakdown;
  } catch {
    breakdown = {};
  }

  const deductions =
    payslip.payePence +
    payslip.employeeNiPence +
    payslip.employeePensionPence +
    payslip.studentLoanPence;

  return (
    <ScrollScreen>
      <Card>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>
              {settings.company_name || 'My Company'}
            </Text>
            <Text style={styles.slipTitle}>Payslip</Text>
          </View>
          <Text style={styles.taxYear}>{run?.taxYear ?? ''}</Text>
        </View>
        <View style={styles.divider} />
        <KeyValue
          label="Employee"
          value={`${employee.firstName} ${employee.lastName}`}
        />
        <KeyValue label="NI number" value={employee.niNumber || '—'} />
        <KeyValue label="Tax code" value={payslip.taxCodeUsed} />
        <KeyValue label="NI category" value={payslip.niCategoryUsed} />
        <KeyValue
          label="Pay date"
          value={run ? displayDate(run.payDate) : '—'}
        />
        <KeyValue
          label="Pay period"
          value={
            run
              ? `${displayDate(run.periodStart)} → ${displayDate(run.periodEnd)}`
              : '—'
          }
        />
        {breakdown.periodNumber ? (
          <KeyValue
            label="Tax period"
            value={`${breakdown.periodNumber} of ${breakdown.totalPeriods}`}
          />
        ) : null}
      </Card>

      <SectionTitle>Earnings</SectionTitle>
      <Card>
        <KeyValue
          label={`Basic pay (${formatHours(payslip.hoursWorked)} × ${formatMoney(
            payslip.hourlyRatePence,
          )})`}
          value={formatMoney(
            payslip.grossPayPence -
              payslip.bonusPence -
              payslip.holidayPayPence,
          )}
        />
        {payslip.holidayPayPence > 0 ? (
          <KeyValue
            label={`Holiday pay (${formatHours(payslip.holidayHours)})`}
            value={formatMoney(payslip.holidayPayPence)}
          />
        ) : null}
        {payslip.bonusPence > 0 ? (
          <KeyValue
            label="Bonus / overtime"
            value={formatMoney(payslip.bonusPence)}
          />
        ) : null}
        <View style={styles.divider} />
        <KeyValue
          label="Gross pay"
          value={formatMoney(payslip.grossPayPence)}
          strong
        />
      </Card>

      <SectionTitle>Deductions</SectionTitle>
      <Card>
        <KeyValue label="PAYE income tax" value={formatMoney(payslip.payePence)} />
        <KeyValue
          label="Employee NI"
          value={formatMoney(payslip.employeeNiPence)}
        />
        {payslip.employeePensionPence > 0 ? (
          <KeyValue
            label="Pension (employee)"
            value={formatMoney(payslip.employeePensionPence)}
          />
        ) : null}
        {payslip.studentLoanPence > 0 ? (
          <KeyValue
            label="Student loan"
            value={formatMoney(payslip.studentLoanPence)}
          />
        ) : null}
        <View style={styles.divider} />
        <KeyValue
          label="Total deductions"
          value={formatMoney(deductions)}
          strong
        />
        <KeyValue
          label="Net pay"
          value={formatMoney(payslip.netPayPence)}
          strong
        />
      </Card>

      <SectionTitle>Employer costs</SectionTitle>
      <Card>
        <KeyValue
          label="Employer NI"
          value={formatMoney(payslip.employerNiPence)}
        />
        <KeyValue
          label="Employer pension"
          value={formatMoney(payslip.employerPensionPence)}
        />
        <KeyValue
          label="Total employer cost"
          value={formatMoney(payslip.employerCostPence)}
        />
        <KeyValue
          label="Holiday accrued this period"
          value={formatHours(
            breakdown.holiday?.accruedHours ??
              payslip.holidayAccruedHours,
          )}
        />
      </Card>

      {breakdown.tax?.parsed?.warning ? (
        <Card>
          <Text style={styles.warning}>{breakdown.tax.parsed.warning}</Text>
        </Card>
      ) : null}

      <Text style={styles.footer}>
        Calculated locally by HRM Software. This is not an HMRC-recognised
        payroll submission. Check figures before paying staff.
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  company: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  slipTitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  taxYear: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  missing: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  warning: {
    fontSize: 12,
    color: colors.warning,
    lineHeight: 18,
  },
  footer: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
