import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import {
  archiveEmployee,
  getEmployee,
  saveEmployee,
} from '../db/repositories';
import { poundsFromPence, parsePounds, roundPence } from '../payroll/money';
import {
  NI_CATEGORIES,
  PAY_FREQUENCIES,
  PENSION_SCHEMES,
  STUDENT_LOAN_PLANS,
  TAX_BASES,
} from '../types';
import type {
  EmployeeDraft,
  NiCategory,
  PayFrequency,
  PensionScheme,
  Region,
  StudentLoanPlan,
  TaxBasis,
} from '../types';
import type { RootStackParamList } from '../navigation/types';
import {
  AppButton,
  Card,
  LoadingState,
  ScrollScreen,
  SectionTitle,
  Segmented,
  TextField,
  ToggleRow,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';
import { todayIso } from '../utils/dates';
import { validateEmployeeForm } from '../utils/employeeValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeForm'>;

function emptyDraft(): EmployeeDraft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postcode: '',
    dateOfBirth: '',
    niNumber: '',
    startDate: todayIso(),
    endDate: '',
    jobTitle: '',
    department: '',
    hourlyRatePence: 0,
    payFrequency: 'MONTHLY',
    taxCode: '1257L',
    taxBasis: 'WEEK1_MONTH1',
    niCategory: 'A',
    region: 'ENGLAND_WALES_NI',
    studentLoanPlan: 'NONE',
    pensionEnrolled: false,
    pensionEmployeePct: 0.05,
    pensionEmployerPct: 0.03,
    pensionScheme: 'NET_PAY',
    holidayEntitlementDays: 28,
    active: true,
  };
}

export function EmployeeFormScreen({ navigation, route }: Props) {
  const employeeId = route.params?.employeeId;
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft);
  const [hourlyRate, setHourlyRate] = useState('');
  const [employeePct, setEmployeePct] = useState('5');
  const [employerPct, setEmployerPct] = useState('3');
  const [holidayDays, setHolidayDays] = useState('28');
  const [loading, setLoading] = useState(Boolean(employeeId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!employeeId) {
      return;
    }
    (async () => {
      const employee = await getEmployee(employeeId);
      if (employee) {
        setDraft(employee);
        setHourlyRate(String(poundsFromPence(employee.hourlyRatePence)));
        setEmployeePct(String(employee.pensionEmployeePct * 100));
        setEmployerPct(String(employee.pensionEmployerPct * 100));
        setHolidayDays(String(employee.holidayEntitlementDays));
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const set = <K extends keyof EmployeeDraft>(
    key: K,
    value: EmployeeDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const next = validateEmployeeForm({
      firstName: draft.firstName,
      lastName: draft.lastName,
      hourlyRate,
      startDate: draft.startDate,
      endDate: draft.endDate,
      dateOfBirth: draft.dateOfBirth,
      employeePct,
      employerPct,
      holidayDays,
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }
    setSaving(true);
    try {
      const rate = parsePounds(hourlyRate) ?? 0;
      await saveEmployee(
        {
          ...draft,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          hourlyRatePence: roundPence(rate * 100),
          pensionEmployeePct: Number(employeePct) / 100,
          pensionEmployerPct: Number(employerPct) / 100,
          holidayEntitlementDays: Number(holidayDays),
        },
        employeeId,
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = () => {
    if (!employeeId) {
      return;
    }
    Alert.alert(
      'Archive employee?',
      'They will be excluded from future payroll runs. Past payslips are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveEmployee(employeeId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return <LoadingState label="Loading employee…" />;
  }

  return (
    <ScrollScreen>
      <SectionTitle>Personal details</SectionTitle>
      <Card>
        <TextField
          label="First name"
          value={draft.firstName}
          onChangeText={(value) => set('firstName', value)}
          error={errors.firstName}
          autoCapitalize="words"
        />
        <TextField
          label="Last name"
          value={draft.lastName}
          onChangeText={(value) => set('lastName', value)}
          error={errors.lastName}
          autoCapitalize="words"
        />
        <TextField
          label="Date of birth"
          value={draft.dateOfBirth}
          onChangeText={(value) => set('dateOfBirth', value)}
          placeholder="YYYY-MM-DD"
          error={errors.dateOfBirth}
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="National Insurance number"
          value={draft.niNumber}
          onChangeText={(value) => set('niNumber', value.toUpperCase())}
          placeholder="QQ123456C"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TextField
          label="Email"
          value={draft.email}
          onChangeText={(value) => set('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Phone"
          value={draft.phone}
          onChangeText={(value) => set('phone', value)}
          keyboardType="phone-pad"
        />
        <TextField
          label="Address"
          value={draft.address}
          onChangeText={(value) => set('address', value)}
          multiline
        />
        <TextField
          label="City"
          value={draft.city}
          onChangeText={(value) => set('city', value)}
        />
        <TextField
          label="Postcode"
          value={draft.postcode}
          onChangeText={(value) => set('postcode', value.toUpperCase())}
          autoCapitalize="characters"
        />
      </Card>

      <SectionTitle>Employment & pay</SectionTitle>
      <Card>
        <TextField
          label="Job title"
          value={draft.jobTitle}
          onChangeText={(value) => set('jobTitle', value)}
        />
        <TextField
          label="Hourly rate (£)"
          value={hourlyRate}
          onChangeText={setHourlyRate}
          placeholder="12.50"
          keyboardType="decimal-pad"
          hint="Required. Used for hours worked and holiday pay."
          error={errors.hourlyRate}
        />
        <TextField
          label="Department"
          value={draft.department}
          onChangeText={(value) => set('department', value)}
        />
        <TextField
          label="Start date"
          value={draft.startDate}
          onChangeText={(value) => set('startDate', value)}
          placeholder="YYYY-MM-DD"
          error={errors.startDate}
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="End date (optional)"
          value={draft.endDate}
          onChangeText={(value) => set('endDate', value)}
          placeholder="YYYY-MM-DD"
          error={errors.endDate}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.fieldLabel}>Pay frequency</Text>
        <Segmented<PayFrequency>
          options={PAY_FREQUENCIES}
          value={draft.payFrequency}
          onChange={(value) => set('payFrequency', value)}
        />
        <ToggleRow
          label="Active employee"
          hint="Archived staff are skipped by payroll runs."
          value={draft.active}
          onValueChange={(value) => set('active', value)}
        />
      </Card>

      <SectionTitle>Tax & National Insurance</SectionTitle>
      <Card>
        <TextField
          label="Tax code"
          value={draft.taxCode}
          onChangeText={(value) => set('taxCode', value.toUpperCase())}
          placeholder="1257L"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Text style={styles.fieldLabel}>Tax basis</Text>
        <Segmented<TaxBasis>
          options={TAX_BASES}
          value={draft.taxBasis}
          onChange={(value) => set('taxBasis', value)}
        />
        <Text style={styles.hint}>
          Use Week 1 / Month 1 for new starters until you have their P45 or
          previous pay details. Cumulative uses year-to-date pay.
        </Text>
        <Text style={styles.fieldLabel}>NI category</Text>
        <Segmented<NiCategory>
          options={NI_CATEGORIES}
          value={draft.niCategory}
          onChange={(value) => set('niCategory', value)}
        />
        <Text style={styles.fieldLabel}>Student loan plan</Text>
        <Segmented<StudentLoanPlan>
          options={STUDENT_LOAN_PLANS}
          value={draft.studentLoanPlan}
          onChange={(value) => set('studentLoanPlan', value)}
        />
        <Text style={styles.fieldLabel}>Region</Text>
        <Segmented<Region>
          options={[
            { value: 'ENGLAND_WALES_NI', label: 'England / Wales / NI' },
            { value: 'SCOTLAND', label: 'Scotland' },
          ]}
          value={draft.region}
          onChange={(value) => set('region', value)}
        />
        <Text style={styles.hint}>
          Scotland uses the same bands in this version. Check the rates in
          Settings before running Scottish payroll.
        </Text>
      </Card>

      <SectionTitle>Pension</SectionTitle>
      <Card>
        <ToggleRow
          label="Enrolled in workplace pension"
          hint="Deductions use qualifying earnings between the pension thresholds."
          value={draft.pensionEnrolled}
          onValueChange={(value) => set('pensionEnrolled', value)}
        />
        <TextField
          label="Employee contribution (%)"
          value={employeePct}
          onChangeText={setEmployeePct}
          keyboardType="decimal-pad"
          error={errors.employeePct}
        />
        <TextField
          label="Employer contribution (%)"
          value={employerPct}
          onChangeText={setEmployerPct}
          keyboardType="decimal-pad"
          error={errors.employerPct}
        />
        <Text style={styles.fieldLabel}>Pension scheme</Text>
        <Segmented<PensionScheme>
          options={PENSION_SCHEMES}
          value={draft.pensionScheme}
          onChange={(value) => set('pensionScheme', value)}
        />
      </Card>

      <SectionTitle>Holiday</SectionTitle>
      <Card>
        <TextField
          label="Annual entitlement (days)"
          value={holidayDays}
          onChangeText={setHolidayDays}
          keyboardType="decimal-pad"
          hint="Holiday pay accrues at 12.07% of hours worked."
          error={errors.holidayDays}
        />
      </Card>

      <AppButton
        title={employeeId ? 'Save changes' : 'Add employee'}
        onPress={submit}
        loading={saving}
      />
      {employeeId ? (
        <AppButton
          title="Archive employee"
          variant="ghost"
          onPress={confirmArchive}
          style={styles.archive}
        />
      ) : null}
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
    marginTop: 6,
  },
  archive: {
    marginTop: spacing.sm,
  },
});
