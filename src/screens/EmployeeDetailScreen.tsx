import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addHolidayAdjustment,
  bookHoliday,
  cancelHolidayBooking,
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
import { displayDate, todayIso } from '../utils/dates';
import { validateHolidayBooking } from '../utils/holiday';

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
  const [bookingStart, setBookingStart] = useState(todayIso());
  const [bookingEnd, setBookingEnd] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('7.5');
  const [bookingNote, setBookingNote] = useState('');
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>(
    {},
  );
  const [savingBooking, setSavingBooking] = useState(false);

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

  const booking = useMemo(
    () =>
      validateHolidayBooking({
        startDate: bookingStart,
        endDate: bookingEnd,
        hoursPerDay,
      }),
    [bookingStart, bookingEnd, hoursPerDay],
  );

  const saveBooking = async () => {
    const result = validateHolidayBooking({
      startDate: bookingStart,
      endDate: bookingEnd,
      hoursPerDay,
    });
    setBookingErrors(result.errors);
    if (Object.keys(result.errors).length > 0) {
      return;
    }
    const start = bookingStart.trim();
    const end = bookingEnd.trim() || start;
    const range =
      start === end
        ? displayDate(start)
        : `${displayDate(start)} → ${displayDate(end)}`;
    setSavingBooking(true);
    try {
      await bookHoliday({
        employeeId,
        startDate: start,
        endDate: end,
        hours: result.hours,
        note: bookingNote.trim() ? `${range} · ${bookingNote.trim()}` : range,
      });
      setBookingEnd('');
      setBookingNote('');
      setBookingErrors({});
      await load();
    } catch (err) {
      Alert.alert(
        'Could not book holiday',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSavingBooking(false);
    }
  };

  const cancelBooking = (entry: HolidayEntry) => {
    Alert.alert(
      'Cancel booking?',
      `Remove the ${formatHours(entry.hours)} booking starting ${displayDate(
        entry.entryDate,
      )}? The hours go back into the balance.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelHolidayBooking(entry.id);
              await load();
            } catch (err) {
              Alert.alert(
                'Could not cancel booking',
                err instanceof Error ? err.message : String(err),
              );
            }
          },
        },
      ],
    );
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
            <Text
              style={[
                styles.holidayValue,
                balance < 0 && styles.entryHoursNegative,
              ]}
            >
              {formatHours(balance)}
            </Text>
          </View>
          <Badge
            label={`${employee.holidayEntitlementDays} days/year`}
            tone="teal"
          />
        </View>
        <Text style={styles.hint}>
          Accrual is 12.07% of hours worked. Booked and paid holiday reduces the
          balance.
        </Text>

        <View style={styles.adjustBox}>
          <Text style={styles.fieldLabel}>Book leave</Text>
          <TextField
            label="Start date"
            value={bookingStart}
            onChangeText={setBookingStart}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            error={bookingErrors.startDate}
          />
          <TextField
            label="End date (optional)"
            value={bookingEnd}
            onChangeText={setBookingEnd}
            placeholder="Same day"
            keyboardType="numbers-and-punctuation"
            hint="Weekends are not counted. Leave blank for a single day."
            error={bookingErrors.endDate}
          />
          <TextField
            label="Hours per day"
            value={hoursPerDay}
            onChangeText={setHoursPerDay}
            placeholder="7.5"
            keyboardType="decimal-pad"
            error={bookingErrors.hoursPerDay}
          />
          <TextField
            label="Note (optional)"
            value={bookingNote}
            onChangeText={setBookingNote}
            placeholder="e.g. family holiday"
          />
          {Object.keys(booking.errors).length === 0 ? (
            <Text style={styles.bookingSummary}>
              {booking.workingDays}{' '}
              {booking.workingDays === 1 ? 'working day' : 'working days'} ·{' '}
              {formatHours(booking.hours)} will be deducted
            </Text>
          ) : null}
          <AppButton
            title="Book holiday"
            onPress={saveBooking}
            loading={savingBooking}
            disabled={!bookingStart}
          />
        </View>

        <View style={styles.adjustBox}>
          <Text style={styles.fieldLabel}>Manual adjustment</Text>
          <TextField
            label="Adjustment (hours)"
            value={adjustHours}
            onChangeText={setAdjustHours}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 7.5 or -3"
            hint="For carry-over or corrections, not for leave."
          />
          <TextField
            label="Note"
            value={adjustNote}
            onChangeText={setAdjustNote}
            placeholder="e.g. carry-over from last year"
          />
          <AppButton
            title="Add adjustment"
            variant="secondary"
            onPress={saveAdjustment}
            loading={savingAdjustment}
            disabled={!adjustHours}
          />
        </View>

        {entries.slice(0, 12).map((entry) => {
          const deducted =
            entry.type === 'BOOKED' ||
            entry.type === 'TAKEN' ||
            entry.type === 'PAID';
          return (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryCopy}>
                <Text style={styles.entryTitle}>
                  {entry.type === 'BOOKED'
                    ? 'Holiday booked'
                    : entry.type === 'TAKEN'
                      ? 'Holiday taken'
                      : entry.type === 'PAID'
                        ? 'Holiday paid'
                        : entry.type === 'ACCRUAL'
                          ? 'Accrued'
                          : 'Adjustment'}
                </Text>
                <Text style={styles.entryMeta}>
                  {entry.type === 'BOOKED'
                    ? entry.note
                    : `${displayDate(entry.entryDate)}${
                        entry.note ? ` · ${entry.note}` : ''
                      }`}
                </Text>
                {entry.type === 'BOOKED' ? (
                  <Pressable onPress={() => cancelBooking(entry)}>
                    <Text style={styles.cancelLink}>Cancel booking</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text
                style={[
                  styles.entryHours,
                  deducted && styles.entryHoursNegative,
                ]}
              >
                {deducted ? '−' : '+'}
                {formatHours(Math.abs(entry.hours))}
              </Text>
            </View>
          );
        })}
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bookingSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.tealDark,
    marginTop: spacing.sm,
  },
  cancelLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    marginTop: 4,
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
