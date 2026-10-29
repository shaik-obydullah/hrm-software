import { parsePounds } from '../payroll/money';
import { isValidIsoDate } from './dates';

export interface EmployeeFormInput {
  firstName: string;
  lastName: string;
  hourlyRate: string;
  startDate: string;
  endDate: string;
  dateOfBirth: string;
  employeePct: string;
  employerPct: string;
  holidayDays: string;
}

/**
 * Validates the editable employee form fields. Kept separate from the screen so
 * the rules can be unit tested without mounting React Native components.
 */
export function validateEmployeeForm(
  input: EmployeeFormInput,
): Record<string, string> {
  const next: Record<string, string> = {};

  if (!input.firstName.trim()) {
    next.firstName = 'First name is required.';
  }
  if (!input.lastName.trim()) {
    next.lastName = 'Last name is required.';
  }

  const rate = parsePounds(input.hourlyRate);
  if (input.hourlyRate.trim() === '' || rate === null || rate <= 0) {
    next.hourlyRate = 'Enter an hourly rate greater than £0.00.';
  }

  if (input.startDate && !isValidIsoDate(input.startDate)) {
    next.startDate = 'Use YYYY-MM-DD.';
  }
  if (input.endDate && !isValidIsoDate(input.endDate)) {
    next.endDate = 'Use YYYY-MM-DD.';
  }
  if (input.dateOfBirth && !isValidIsoDate(input.dateOfBirth)) {
    next.dateOfBirth = 'Use YYYY-MM-DD.';
  }

  const employeePct = Number(input.employeePct);
  const employerPct = Number(input.employerPct);
  if (
    !Number.isFinite(employeePct) ||
    employeePct < 0 ||
    employeePct > 100
  ) {
    next.employeePct = 'Enter a percentage between 0 and 100.';
  }
  if (
    !Number.isFinite(employerPct) ||
    employerPct < 0 ||
    employerPct > 100
  ) {
    next.employerPct = 'Enter a percentage between 0 and 100.';
  }

  const holiday = Number(input.holidayDays);
  if (!Number.isFinite(holiday) || holiday < 0) {
    next.holidayDays = 'Enter a valid number of days.';
  }

  return next;
}
