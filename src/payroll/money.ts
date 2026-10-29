import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const D = (value: Decimal.Value): Decimal => new Decimal(value);

export function roundPence(value: Decimal.Value): number {
  return D(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function roundPoundsToPence(pounds: number): number {
  return roundPence(D(pounds).times(100));
}

export function roundHours(value: Decimal.Value): number {
  return D(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

export function poundsFromPence(pence: number): number {
  return D(pence).div(100).toNumber();
}

export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '');
  if (cleaned === '') {
    return 0;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function formatMoney(pence: number, options?: { pence?: boolean }): string {
  const showPence = options?.pence !== false;
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(Math.round(pence));
  const whole = Math.floor(abs / 100);
  const pennies = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return showPence
    ? `${sign}£${grouped}.${String(pennies).padStart(2, '0')}`
    : `${sign}£${grouped}`;
}

export function formatPct(value: number): string {
  return `${D(value).times(100).toDecimalPlaces(2).toString()}%`;
}

export function formatHours(value: number): string {
  return `${D(value).toDecimalPlaces(2).toString()}h`;
}
