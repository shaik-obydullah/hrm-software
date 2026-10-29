import type { Employee, PayFrequency } from '../types';

/**
 * Employees who should appear in a pay run for the given period.
 *
 * Archived staff are skipped, as are staff whose employment starts after the
 * period ends or ends before the period starts.
 */
export function filterEmployeesForPayRun(
  employees: Employee[],
  frequency: PayFrequency,
  periodStart: string,
  periodEnd: string,
): Employee[] {
  return employees.filter((employee) => {
    if (!employee.active || employee.payFrequency !== frequency) {
      return false;
    }
    if (employee.startDate && employee.startDate > periodEnd) {
      return false;
    }
    if (employee.endDate && employee.endDate < periodStart) {
      return false;
    }
    return true;
  });
}
