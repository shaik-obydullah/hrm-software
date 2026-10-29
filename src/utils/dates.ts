import { format, parseISO } from 'date-fns';
import type { PayFrequency } from '../types';

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function displayDate(iso: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

export function displayDateShort(iso: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return format(parseISO(iso), 'd MMM');
  } catch {
    return iso;
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function payPeriodFor(
  payDate: string,
  frequency: PayFrequency,
): { start: string; end: string } {
  const date = new Date(`${payDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { start: payDate, end: payDate };
  }
  if (frequency === 'MONTHLY') {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
