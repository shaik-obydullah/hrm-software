import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  createPayrollRun,
  getActiveRateSet,
  getEmploymentAllowanceUsed,
  getPayrollRun,
  getPayslips,
  getYtd,
  listEmployees,
} from '../db/repositories';
import type { NewHolidayEntry, NewPayslip } from '../db/repositories';
import {
  calculatePayslip,
  getTaxPeriod,
  getTaxYear,
} from '../payroll/engine';
import { formatHours, formatMoney, parsePounds, roundPence } from '../payroll/money';
import type {
  Employee,
  PayFrequency,
  PayrollRunWithTotals,
  Payslip,
  RateSet,
} from '../types';
import { PAY_FREQUENCIES } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppContext';
import {
  AppButton,
  Badge,
  Card,
  KeyValue,
  LoadingState,
  ScrollScreen,
  SectionTitle,
  Segmented,
  TextField,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { displayDate, payPeriodFor, todayIso } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollRun'>;
type YtdMap = Record<string, { taxablePayPence: number; taxPaidPence: number }>;

interface PreviewLine {
  employee: Employee;
  hours: number;
  bonusPence: number;
  holidayHours: number;
  grossPence: number;
  netPence: number;
  payePence: number;
  employeeNiPence: number;
  employerNiPence: number;
  pensionPence: number;
  studentLoanPence: number;
}

export function PayrollRunScreen({ navigation, route }: Props) {
  const runId = route.params?.runId;
  const { settings } = useApp();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PayrollRunWithTotals | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const [frequency, setFrequency] = useState<PayFrequency>('MONTHLY');
  const [payDate, setPayDate] = useState(todayIso());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rateSet, setRateSet] = useState<RateSet | null>(null);
  const [ytd, setYtd] = useState<YtdMap>({});
  const [allowanceUsed, setAllowanceUsed] = useState(0);
  const [hours, setHours] = useState<Record<string, string>>({});
  const [bonus, setBonus] = useState<Record<string, string>>({});
  const [holiday, setHoliday] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const allEmployees = await listEmployees();
      setEmployees(allEmployees);
      if (runId) {
        const [run, slips] = await Promise.all([
          getPayrollRun(runId),
          getPayslips(runId),
        ]);
        setExisting(run);
        setPayslips(slips);
      }
      setLoading(false);
    })();
  }, [runId]);

  const loadRunContext = useCallback(
    async (nextFrequency: PayFrequency, nextPayDate: string) => {
      const taxYear = getTaxYear(nextPayDate);
      const activeRateSet = await getActiveRateSet(nextPayDate);
      const used = await getEmploymentAllowanceUsed(taxYear, nextPayDate);
      setRateSet(activeRateSet);
      setAllowanceUsed(used);
      if (!activeRateSet) {
        return;
      }
      const relevant = employees.filter(
        (employee) => employee.payFrequency === nextFrequency,
      );
      const entries = await Promise.all(
        relevant.map(async (employee) => {
          const figures = await getYtd(employee.id, taxYear, nextPayDate);
          return [employee.id, figures] as const;
        }),
      );
      setYtd(Object.fromEntries(entries));
    },
    [employees],
  );

  useEffect(() => {
    if (!runId) {
      loadRunContext(frequency, payDate);
    }
  }, [runId, frequency, payDate, loadRunContext]);

  const period = payPeriodFor(payDate, frequency);
  const taxYear = getTaxYear(payDate);
  const eligibleForAllowance =
    settings.employment_allowance_eligible === 'true';

  const relevantEmployees = useMemo(
    () => employees.filter((employee) => employee.payFrequency === frequency),
    [employees, frequency],
  );

  const preview = useMemo<PreviewLine[]>(() => {
    if (!rateSet) {
      return [];
    }
    const taxPeriod = getTaxPeriod(payDate, frequency);
    const lines: PreviewLine[] = [];
    for (const employee of relevantEmployees) {
      const worked = Number(hours[employee.id] ?? '');
      const bonusPounds = parsePounds(bonus[employee.id] ?? '') ?? 0;
      const holidayHours = Number(holiday[employee.id] ?? '');
      const safeHours = Number.isFinite(worked) ? worked : 0;
      const safeHoliday = Number.isFinite(holidayHours) ? holidayHours : 0;
      if (safeHours <= 0 && bonusPounds <= 0 && safeHoliday <= 0) {
        continue;
      }
      const calculation = calculatePayslip({
        employee,
        rates: rateSet.data,
        hoursWorked: safeHours,
        bonusPence: roundPence(bonusPounds * 100),
        holidayHours: safeHoliday,
        periodNumber: taxPeriod.periodNumber,
        totalPeriods: taxPeriod.totalPeriods,
        ytd: ytd[employee.id] ?? { taxablePayPence: 0, taxPaidPence: 0 },
      });
      lines.push({
        employee,
        hours: safeHours,
        bonusPence: roundPence(bonusPounds * 100),
        holidayHours: safeHoliday,
        grossPence: calculation.grossPayPence,
        netPence: calculation.netPayPence,
        payePence: calculation.payePence,
        employeeNiPence: calculation.employeeNiPence,
        employerNiPence: calculation.employerNiPence,
        pensionPence: calculation.employeePensionPence,
        studentLoanPence: calculation.studentLoanPence,
      });
    }
    return lines;
  }, [rateSet, relevantEmployees, hours, bonus, holiday, payDate, frequency, ytd]);

  const previewTotals = useMemo(() => {
    const gross = preview.reduce((sum, line) => sum + line.grossPence, 0);
    const net = preview.reduce((sum, line) => sum + line.netPence, 0);
    const paye = preview.reduce((sum, line) => sum + line.payePence, 0);
    const employeeNi = preview.reduce(
      (sum, line) => sum + line.employeeNiPence,
      0,
    );
    const employerNi = preview.reduce(
      (sum, line) => sum + line.employerNiPence,
      0,
    );
    const studentLoan = preview.reduce(
      (sum, line) => sum + line.studentLoanPence,
      0,
    );
    const allowance = rateSet && eligibleForAllowance
      ? Math.min(
          Math.max(
            0,
            rateSet.data.ni.employmentAllowancePence - allowanceUsed,
          ),
          employerNi,
        )
      : 0;
    return {
      gross,
      net,
      paye,
      employeeNi,
      employerNi,
      studentLoan,
      allowance,
      hmrcDue: paye + employeeNi + employerNi + studentLoan - allowance,
    };
  }, [preview, rateSet, eligibleForAllowance, allowanceUsed]);

  const finalise = async () => {
    if (!rateSet) {
      Alert.alert('No rates', 'No active tax rate set was found.');
      return;
    }
    if (preview.length === 0) {
      Alert.alert(
        'Nothing to pay',
        'Enter hours, holiday hours or a bonus for at least one employee.',
      );
      return;
    }
    setSaving(true);
    try {
      const taxPeriod = getTaxPeriod(payDate, frequency);
      const holidayEntries: NewHolidayEntry[] = [];
      const lines: NewPayslip[] = [];
      for (const line of preview) {
        const calculation = calculatePayslip({
          employee: line.employee,
          rates: rateSet.data,
          hoursWorked: line.hours,
          bonusPence: line.bonusPence,
          holidayHours: line.holidayHours,
          periodNumber: taxPeriod.periodNumber,
          totalPeriods: taxPeriod.totalPeriods,
          ytd: ytd[line.employee.id] ?? {
            taxablePayPence: 0,
            taxPaidPence: 0,
          },
        });
        lines.push({
          employeeId: line.employee.id,
          hoursWorked: calculation.hoursWorked,
          hourlyRatePence: calculation.hourlyRatePence,
          bonusPence: calculation.bonusPence,
          holidayHours: calculation.holidayHours,
          holidayPayPence: calculation.holidayPayPence,
          grossPayPence: calculation.grossPayPence,
          taxablePayPence: calculation.taxablePayPence,
          payePence: calculation.payePence,
          employeeNiPence: calculation.employeeNiPence,
          employerNiPence: calculation.employerNiPence,
          employeePensionPence: calculation.employeePensionPence,
          employerPensionPence: calculation.employerPensionPence,
          studentLoanPence: calculation.studentLoanPence,
          netPayPence: calculation.netPayPence,
          employerCostPence: calculation.employerCostPence,
          qualifyingEarningsPence: calculation.qualifyingEarningsPence,
          holidayAccruedHours: calculation.holidayAccruedHours,
          taxCodeUsed: calculation.taxCodeUsed,
          niCategoryUsed: line.employee.niCategory,
          breakdownJson: JSON.stringify(calculation.breakdown),
        });
        if (calculation.holidayAccruedHours > 0) {
          holidayEntries.push({
            employeeId: line.employee.id,
            entryDate: period.end,
            type: 'ACCRUAL' as const,
            hours: calculation.holidayAccruedHours,
            note: 'Accrued from hours worked',
          });
        }
        if (calculation.holidayHours > 0) {
          holidayEntries.push({
            employeeId: line.employee.id,
            entryDate: period.start,
            type: 'TAKEN' as const,
            hours: calculation.holidayHours,
            note: 'Holiday paid in this run',
          });
        }
      }

      const newRunId = await createPayrollRun({
        periodStart: period.start,
        periodEnd: period.end,
        payDate,
        frequency,
        rateSetId: rateSet.id,
        taxYear,
        employmentAllowancePence: previewTotals.allowance,
        payslips: lines,
        holiday: holidayEntries,
      });
      navigation.replace('PayrollRun', { runId: newRunId });
    } catch (err) {
      Alert.alert(
        'Payroll failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading payroll…" />;
  }

  if (existing) {
    const hmrcDue =
      existing.totals.payePence +
      existing.totals.employeeNiPence +
      existing.totals.employerNiPence +
      existing.totals.studentLoanPence -
      existing.totals.employmentAllowancePence;
    return (
      <ScrollScreen>
        <Card>
          <View style={styles.runTitleRow}>
            <View style={styles.runTitleCopy}>
              <Text style={styles.runTitle}>
                {displayDate(existing.payDate)}
              </Text>
              <Text style={styles.runSubtitle}>
                {existing.periodStart} → {existing.periodEnd} ·{' '}
                {existing.taxYear}
              </Text>
            </View>
            <Badge
              label={existing.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}
              tone="teal"
            />
          </View>
          <View style={styles.divider} />
          <KeyValue
            label="Employees paid"
            value={String(existing.totals.employeeCount)}
          />
          <KeyValue
            label="Gross pay"
            value={formatMoney(existing.totals.grossPayPence)}
          />
          <KeyValue
            label="Net pay"
            value={formatMoney(existing.totals.netPayPence)}
            strong
          />
          <KeyValue
            label="Employer cost"
            value={formatMoney(existing.totals.employerCostPence)}
          />
        </Card>

        <SectionTitle>HMRC liability</SectionTitle>
        <Card>
          <KeyValue label="PAYE" value={formatMoney(existing.totals.payePence)} />
          <KeyValue
            label="Employee NI"
            value={formatMoney(existing.totals.employeeNiPence)}
          />
          <KeyValue
            label="Employer NI"
            value={formatMoney(existing.totals.employerNiPence)}
          />
          <KeyValue
            label="Student loans"
            value={formatMoney(existing.totals.studentLoanPence)}
          />
          <KeyValue
            label="Employment Allowance"
            value={`−${formatMoney(existing.totals.employmentAllowancePence)}`}
          />
          <View style={styles.divider} />
          <KeyValue
            label="Total due"
            value={formatMoney(hmrcDue)}
            strong
          />
        </Card>

        <SectionTitle>Payslips</SectionTitle>
        {payslips.map((slip) => {
          const employee = employees.find(
            (item) => item.id === slip.employeeId,
          );
          return (
            <Card key={slip.id}>
              <View style={styles.slipRow}>
                <View style={styles.slipCopy}>
                  <Text style={styles.slipName}>
                    {employee
                      ? `${employee.firstName} ${employee.lastName}`
                      : 'Employee'}
                  </Text>
                  <Text style={styles.slipMeta}>
                    {formatHours(slip.hoursWorked)} at{' '}
                    {formatMoney(slip.hourlyRatePence)}/hr
                  </Text>
                </View>
                <Text style={styles.slipNet}>
                  {formatMoney(slip.netPayPence)}
                </Text>
              </View>
              <View style={styles.slipTotals}>
                <Text style={styles.slipTotalText}>
                  Gross {formatMoney(slip.grossPayPence)}
                </Text>
                <Text style={styles.slipTotalText}>
                  PAYE {formatMoney(slip.payePence)}
                </Text>
                <Text style={styles.slipTotalText}>
                  NI {formatMoney(slip.employeeNiPence)}
                </Text>
              </View>
              <AppButton
                title="View payslip"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('Payslip', { payslipId: slip.id })
                }
                style={styles.slipButton}
              />
            </Card>
          );
        })}
        {payslips.length === 0 ? (
          <Card>
            <Text style={styles.hint}>No payslips stored for this run.</Text>
          </Card>
        ) : null}
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen>
      <Card>
        <TextField
          label="Pay date"
          value={payDate}
          onChangeText={setPayDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          hint={`Tax year ${taxYear} · period ${period.start} → ${period.end}`}
        />
        <Text style={styles.fieldLabel}>Pay frequency</Text>
        <Segmented<PayFrequency>
          options={PAY_FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
        />
        {!rateSet ? (
          <Text style={styles.error}>
            No active rate set found. Add rates in Settings before running
            payroll.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Using {rateSet.name} (from {displayDate(rateSet.effectiveFrom)}).
            {eligibleForAllowance
              ? ` Employment Allowance remaining: ${formatMoney(
                  Math.max(
                    0,
                    rateSet.data.ni.employmentAllowancePence - allowanceUsed,
                  ),
                )}.`
              : ' Employment Allowance is off in Settings.'}
          </Text>
        )}
      </Card>

      <SectionTitle>Hours & pay</SectionTitle>
      {relevantEmployees.length === 0 ? (
        <Card>
          <Text style={styles.hint}>
            No active {frequency === 'WEEKLY' ? 'weekly' : 'monthly'} employees.
            Add employees with this pay frequency first.
          </Text>
        </Card>
      ) : (
        relevantEmployees.map((employee) => {
          const line = preview.find(
            (item) => item.employee.id === employee.id,
          );
          return (
            <Card key={employee.id}>
              <View style={styles.employeeHeader}>
                <View style={styles.employeeCopy}>
                  <Text style={styles.employeeName}>
                    {employee.firstName} {employee.lastName}
                  </Text>
                  <Text style={styles.employeeMeta}>
                    {formatMoney(employee.hourlyRatePence)}/hr ·{' '}
                    {employee.taxCode || '1257L'} · NI {employee.niCategory}
                  </Text>
                </View>
                {line ? (
                  <Text style={styles.lineNet}>
                    {formatMoney(line.netPence)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.inputRow}>
                <TextField
                  label="Hours"
                  value={hours[employee.id] ?? ''}
                  onChangeText={(value) =>
                    setHours((current) => ({ ...current, [employee.id]: value }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={styles.inputThird}
                />
                <TextField
                  label="Holiday hrs"
                  value={holiday[employee.id] ?? ''}
                  onChangeText={(value) =>
                    setHoliday((current) => ({
                      ...current,
                      [employee.id]: value,
                    }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={styles.inputThird}
                />
                <TextField
                  label="Bonus (£)"
                  value={bonus[employee.id] ?? ''}
                  onChangeText={(value) =>
                    setBonus((current) => ({ ...current, [employee.id]: value }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  containerStyle={styles.inputThird}
                />
              </View>
              {line ? (
                <Text style={styles.lineBreakdown}>
                  Gross {formatMoney(line.grossPence)} · PAYE{' '}
                  {formatMoney(line.payePence)} · NI{' '}
                  {formatMoney(line.employeeNiPence)} · pension{' '}
                  {formatMoney(line.pensionPence)}
                  {line.studentLoanPence > 0
                    ? ` · student loan ${formatMoney(line.studentLoanPence)}`
                    : ''}
                </Text>
              ) : null}
            </Card>
          );
        })
      )}

      <SectionTitle>Run summary</SectionTitle>
      <Card>
        <KeyValue
          label="Employees included"
          value={String(preview.length)}
        />
        <KeyValue label="Gross pay" value={formatMoney(previewTotals.gross)} />
        <KeyValue label="Net pay" value={formatMoney(previewTotals.net)} />
        <KeyValue label="PAYE" value={formatMoney(previewTotals.paye)} />
        <KeyValue
          label="Employee NI"
          value={formatMoney(previewTotals.employeeNi)}
        />
        <KeyValue
          label="Employer NI"
          value={formatMoney(previewTotals.employerNi)}
        />
        <KeyValue
          label="Student loans"
          value={formatMoney(previewTotals.studentLoan)}
        />
        <KeyValue
          label="Employment Allowance"
          value={`−${formatMoney(previewTotals.allowance)}`}
        />
        <View style={styles.divider} />
        <KeyValue
          label="Due to HMRC"
          value={formatMoney(previewTotals.hmrcDue)}
          strong
        />
        <AppButton
          title="Finalise payroll"
          onPress={finalise}
          loading={saving}
          disabled={!rateSet || preview.length === 0}
          style={styles.finalise}
        />
        <Text style={styles.hint}>
          Finalising stores payslips and holiday accrual. It cannot be undone.
        </Text>
      </Card>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  runTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  runTitleCopy: {
    flex: 1,
  },
  runTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  runSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  slipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slipCopy: {
    flex: 1,
  },
  slipName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  slipMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  slipNet: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  slipTotals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  slipTotalText: {
    fontSize: 11,
    color: colors.muted,
  },
  slipButton: {
    marginTop: spacing.md,
    minHeight: 42,
    paddingVertical: 10,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  employeeCopy: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  employeeMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  lineNet: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.teal,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inputThird: {
    flex: 1,
  },
  lineBreakdown: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 17,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  finalise: {
    marginTop: spacing.md,
  },
});
