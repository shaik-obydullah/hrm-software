/**
 * @format
 */

import { formatMoney, parsePounds, roundPence } from '../src/payroll/money';
import { getTaxYear } from '../src/payroll/engine';

test('formats and parses money safely', () => {
  expect(formatMoney(123_456)).toBe('£1,234.56');
  expect(formatMoney(-500, { pence: false })).toBe('-£5');
  expect(parsePounds('£1,234.56')).toBe(1234.56);
  expect(parsePounds('')).toBe(0);
  expect(roundPence(12.345 * 100)).toBe(1235);
});

test('maps pay dates to the UK tax year', () => {
  expect(getTaxYear('2026-04-05')).toBe('2025/26');
  expect(getTaxYear('2026-04-06')).toBe('2026/27');
});
