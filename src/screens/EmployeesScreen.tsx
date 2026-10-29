import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listEmployees } from '../db/repositories';
import { formatMoney } from '../payroll/money';
import type { Employee } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  AppButton,
  Badge,
  Card,
  EmptyState,
  LoadingState,
  ScrollScreen,
  TextField,
} from '../ui/components';
import { colors, spacing } from '../ui/theme';

type Nav = NavigationProp<RootStackParamList & TabParamList>;

export function EmployeesScreen() {
  const navigation = useNavigation<Nav>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      setEmployees(await listEmployees(term));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return (
    <ScrollScreen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Employees</Text>
          <Text style={styles.subtitle}>
            {employees.length} {employees.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
        <AppButton
          title="+ Add"
          onPress={() => navigation.navigate('EmployeeForm')}
          style={styles.addButton}
        />
      </View>

      <TextField
        label="Search"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          load(value);
        }}
        placeholder="Name or job title"
        autoCorrect={false}
      />

      {loading ? (
        <LoadingState label="Loading employees…" />
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'No matching employees' : 'No employees yet'}
            body={
              search
                ? 'Try a different name or clear the search.'
                : 'Add your first hourly employee to start running payroll.'
            }
          />
          {!search ? (
            <AppButton
              title="Add employee"
              onPress={() => navigation.navigate('EmployeeForm')}
            />
          ) : null}
        </Card>
      ) : (
        employees.map((employee) => (
          <Pressable
            key={employee.id}
            onPress={() =>
              navigation.navigate('EmployeeDetail', {
                employeeId: employee.id,
              })
            }
            style={({ pressed }) => [
              styles.employeeCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {employee.firstName.charAt(0)}
                {employee.lastName.charAt(0)}
              </Text>
            </View>
            <View style={styles.employeeCopy}>
              <Text style={styles.employeeName}>
                {employee.firstName} {employee.lastName}
              </Text>
              <Text style={styles.employeeMeta}>
                {employee.jobTitle || 'No job title'} ·{' '}
                {employee.payFrequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}
              </Text>
              <View style={styles.badges}>
                <Badge
                  label={`${formatMoney(employee.hourlyRatePence)}/hr`}
                  tone={employee.hourlyRatePence <= 0 ? 'danger' : 'teal'}
                />
                <Badge label={employee.taxCode || '1257L'} />
                {!employee.active ? <Badge label="Archived" tone="warning" /> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
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
  addButton: {
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    paddingVertical: 10,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E4F2F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealDark,
    fontWeight: '800',
    fontSize: 15,
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
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  chevron: {
    fontSize: 26,
    color: colors.muted,
  },
});
