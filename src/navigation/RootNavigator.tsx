import {
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { EmployeeDetailScreen } from '../screens/EmployeeDetailScreen';
import { EmployeeFormScreen } from '../screens/EmployeeFormScreen';
import { LockScreen } from '../screens/LockScreen';
import { PayrollRunScreen } from '../screens/PayrollRunScreen';
import { PayslipScreen } from '../screens/PayslipScreen';
import { RatesScreen } from '../screens/RatesScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { useApp } from '../state/AppContext';
import { LoadingState } from '../ui/components';
import { colors } from '../ui/theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.teal,
    background: colors.background,
    card: colors.white,
    text: colors.text,
    border: colors.border,
    notification: colors.teal,
  },
};

export function RootNavigator() {
  const { status } = useApp();

  if (status === 'loading') {
    return <LoadingState label="Starting HRM Software…" />;
  }
  if (status === 'setup') {
    return <SetupScreen />;
  }
  if (status === 'locked') {
    return <LockScreen />;
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.teal,
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '700',
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EmployeeForm"
          component={EmployeeFormScreen}
          options={({ route }) => ({
            title: route.params?.employeeId ? 'Edit employee' : 'Add employee',
          })}
        />
        <Stack.Screen
          name="EmployeeDetail"
          component={EmployeeDetailScreen}
          options={{ title: 'Employee' }}
        />
        <Stack.Screen
          name="PayrollRun"
          component={PayrollRunScreen}
          options={({ route }) => ({
            title: route.params?.runId ? 'Payroll run' : 'New payroll run',
          })}
        />
        <Stack.Screen
          name="Payslip"
          component={PayslipScreen}
          options={{ title: 'Payslip' }}
        />
        <Stack.Screen
          name="Rates"
          component={RatesScreen}
          options={{ title: 'Tax & NI rates' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
