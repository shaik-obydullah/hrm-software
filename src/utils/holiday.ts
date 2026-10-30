import { roundHours } from '../payroll/money';
import { isValidIsoDate } from './dates';

export interface HolidayBookingInput {
  startDate: string;
  endDate: string;
  hoursPerDay: string;
}

export interface HolidayBookingResult {
  errors: Record<string, string>;
  workingDays: number;
  hours: number;
}

const DAY_MS = 86_400_000;

/** Parses a YYYY-MM-DD string at midday UTC so daylight saving cannot shift the day. */
function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/**
 * Counts Monday–Friday days between two dates, inclusive. Weekend-only ranges
 * return 0 so the caller can reject them.
 */
export function countWorkingDays(startIso: string, endIso: string): number {
  const start = parseDay(startIso);
  const end = parseDay(endIso);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }
  let days = 0;
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days += 1;
    }
  }
  return days;
}

/**
 * Validates a leave booking and works out the hours it uses. Weekends are not
 * counted; bank holidays are treated as normal working days.
 */
export function validateHolidayBooking(
  input: HolidayBookingInput,
): HolidayBookingResult {
  const errors: Record<string, string> = {};
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim() || startDate;
  const hoursPerDay = Number(input.hoursPerDay);

  if (!isValidIsoDate(startDate)) {
    errors.startDate = 'Use YYYY-MM-DD.';
  }
  if (!isValidIsoDate(endDate)) {
    errors.endDate = 'Use YYYY-MM-DD.';
  } else if (!errors.startDate && endDate < startDate) {
    errors.endDate = 'End date must be on or after the start date.';
  }
  if (
    input.hoursPerDay.trim() === '' ||
    !Number.isFinite(hoursPerDay) ||
    hoursPerDay <= 0 ||
    hoursPerDay > 24
  ) {
    errors.hoursPerDay = 'Enter hours between 0 and 24.';
  }

  const workingDays =
    Object.keys(errors).length === 0 ? countWorkingDays(startDate, endDate) : 0;
  if (Object.keys(errors).length === 0 && workingDays === 0) {
    errors.endDate = 'Those dates contain no Monday–Friday working days.';
  }

  return {
    errors,
    workingDays,
    hours: roundHours(workingDays * (Number.isFinite(hoursPerDay) ? hoursPerDay : 0)),
  };
}
