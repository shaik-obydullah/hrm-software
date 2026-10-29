import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  Payroll: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  EmployeeForm: { employeeId?: string } | undefined;
  EmployeeDetail: { employeeId: string };
  PayrollRun: { runId?: string } | undefined;
  Payslip: { payslipId: string };
  Rates: undefined;
};
