import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addHolidayAdjustment,
  getEmployee,
  getEmployeePayslips,
  getHolidayBalance,
  getHolidayEntries,
} from '../db/repositories';
import { formatHours, formatMoney } from '../payroll/money';
import type {
  Employee,
  HolidayEntry,
  PayslipWithRun,
} from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  AppButton,
  Badge,
  Card,
  KeyValue,
  LoadingState,
  ScrollScreen,
  SectionTitle,
  TextField,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { displayDate } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeDetail'>;
type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function EmployeeDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { employeeId } = route.params;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<HolidayEntry[]>([]);
  const [payslips, setPayslips] = useState<PayslipWithRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustHours, setAdjustHours] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [record, holidayBalance, holidayEntries, slips] =
        await Promise.all([
          getEmployee(employeeId),
          getHolidayBalance(employeeId),
          getHolidayEntries(employeeId),
          getEmployeePayslips(employeeId),
        ]);
      setEmployee(record);
      setBalance(holidayBalance);
      setEntries(holidayEntries);
      setPayslips(slips);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveAdjustment = async () => {
    const hours = Number(adjustHours);
    if (!Number.isFinite(hours) || hours === 0) {
      return;
    }
    setSavingAdjustment(true);
    try {
      await addHolidayAdjustment(employeeId, hours, adjustNote.trim());
      setAdjustHours('');
      setAdjustNote('');
      await load();
    } finally {
      setSavingAdjustment(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading employee…" />;
  }

  if (!employee) {
    return (
      <ScrollScreen>
        <Card>
          <Text style={styles.missing}>Employee not found.</Text>
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen>
      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {employee.firstName.charAt(0)}
              {employee.lastName.charAt(0)}
            </Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>
              {employee.firstName} {employee.lastName}
            </Text>
            <Text style={styles.role}>
              {employee.jobTitle || 'No job title'}
              {employee.department ? ` · ${employee.department}` : ''}
            </Text>
            <View style={styles.badges}>
              <Badge
                label={employee.active ? 'Active' : 'Archived'}
                tone={employee.active ? 'success' : 'warning'}
              />
              <Badge
                label={employee.payFrequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                tone="teal"
              />
            </View>
          </View>
        </View>
        <AppButton
          title="Edit employee"
          variant="secondary"
          onPress={() =>
            navigation.navigate('EmployeeForm', { employeeId })
          }
          style={styles.editButton}
        />
      </Card>

      <SectionTitle>Pay</SectionTitle>
      <Card>
        <KeyValue
          label="Hourly rate"
          value={`${formatMoney(employee.hourlyRatePence)} per hour`}
        />
        <KeyValue label="Tax code" value={employee.taxCode || '1257L'} />
        <KeyValue
          label="Tax basis"
          value={employee.taxBasis === 'CUMULATIVE' ? 'Cumulative' : 'Week 1 / Month 1'}
        />
        <KeyValue label="NI category" value={employee.niCategory} />
        <KeyValue
          label="Student loan"
          value={
            employee.studentLoanPlan === 'NONE'
              ? 'None'
              : employee.studentLoanPlan.replace('_', ' ')
          }
        />
        <KeyValue
          label="Pension"
          value={
            employee.pensionEnrolled
              ? `${employee.pensionEmployeePct * 100}% employee / ${
                  employee.pensionEmployerPct * 100
                }% employer`
              : 'Not enrolled'
          }
        />
      </Card>

      <SectionTitle>Holiday</SectionTitle>
      <Card>
        <View style={styles.holidayHeader}>
          <View>
            <Text style={styles.holidayLabel}>Remaining balance</Text>
            <Text style={styles.holidayValue}>{formatHours(balance)}</Text>
          </View>
          <Badge
            label={`${employee.holidayEntitlementDays} days/year`}
            tone="teal"
          />
        </View>
        <Text style={styles.hint}>
          Accrual is 12.07% of hours worked. Taken holiday reduces the balance.
        </Text>

        <View style={styles.adjustBox}>
          <TextField
            label="Adjustment (hours)"
            value={adjustHours}
            onChangeText={setAdjustHours}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 7.5 or -3"
          />
          <TextField
            label="Note"
            value={adjustNote}
            onChangeText={setAdjustNote}
            placeholder="e.g. booked leave"
          />
          <AppButton
            title="Add adjustment"
            variant="secondary"
            onPress={saveAdjustment}
            loading={savingAdjustment}
            disabled={!adjustHours}
          />
        </View>

        {entries.slice(0, 8).map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryTitle}>
                {entry.type === 'TAKEN' || entry.type === 'PAID'
                  ? 'Holiday taken'
                  : entry.type === 'ACCRUAL'
                    ? 'Accrued'
                    : 'Adjustment'}
              </Text>
              <Text style={styles.entryMeta}>
                {displayDate(entry.entryDate)}
                {entry.note ? ` · ${entry.note}` : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.entryHours,
                (entry.type === 'TAKEN' || entry.type === 'PAID') &&
                  styles.entryHoursNegative,
              ]}
            >
              {entry.type === 'TAKEN' || entry.type === 'PAID' ? '−' : '+'}
              {formatHours(Math.abs(entry.hours))}
            </Text>
          </View>
        ))}
        {entries.length === 0 ? (
          <Text style={styles.hint}>No holiday movements yet.</Text>
        ) : null}
      </Card>

      <SectionTitle>Payslip history</SectionTitle>
      <Card>
        {payslips.length === 0 ? (
          <Text style={styles.hint}>No payslips yet.</Text>
        ) : (
          payslips.map((slip) => (
            <Pressable
              key={slip.id}
              onPress={() => navigation.navigate('Payslip', { payslipId: slip.id })}
              style={({ pressed }) => [
                styles.slipRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.entryCopy}>
                <Text style={styles.entryTitle}>
                  {displayDate(slip.payDate)}
                </Text>
                <Text style={styles.entryMeta}>
                  {slip.periodStart} → {slip.periodEnd}
                </Text>
              </View>
              <View style={styles.slipAmounts}>
                <Text style={styles.slipNet}>
                  {formatMoney(slip.netPayPence)}
                </Text>
                <Text style={styles.slipGross}>
                  gross {formatMoney(slip.grossPayPence)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </Card>

      <SectionTitle>Personal</SectionTitle>
      <Card>
        <KeyValue label="NI number" value={employee.niNumber || '—'} />
        <KeyValue label="Date of birth" value={displayDate(employee.dateOfBirth)} />
        <KeyValue label="Email" value={employee.email || '—'} />
        <KeyValue label="Phone" value={employee.phone || '—'} />
        <KeyValue
          label="Address"
          value={
            [employee.address, employee.city, employee.postcode]
              .filter(Boolean)
              .join(', ') || '—'
          }
        />
        <KeyValue label="Start date" value={displayDate(employee.startDate)} />
        {employee.endDate ? (
          <KeyValue label="End date" value={displayDate(employee.endDate)} />
        ) : null}
      </Card>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E4F2F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.tealDark,
  },
  profileCopy: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  role: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  editButton: {
    marginTop: spacing.lg,
  },
  holidayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holidayLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  holidayValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.teal,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  adjustBox: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  entryCopy: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  entryMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  entryHours: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  entryHoursNegative: {
    color: colors.danger,
  },
  slipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  slipAmounts: {
    alignItems: 'flex-end',
  },
  slipNet: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  slipGross: {
    fontSize: 11,
    color: colors.muted,
  },
  chevron: {
    fontSize: 22,
    color: colors.muted,
  },
  missing: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
