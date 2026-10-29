import type { Employee } from '../../types';
import { DEFAULT_RATES } from '../defaultRates';
import {
  calculatePayslip,
  getTaxPeriod,
  getTaxYear,
  parseTaxCode,
} from '../engine';

const baseEmployee: Employee = {
  id: 'emp-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: '',
  phone: '',
  address: '',
  city: '',
  postcode: '',
  dateOfBirth: '',
  niNumber: '',
  startDate: '2026-04-06',
  endDate: '',
  jobTitle: 'Engineer',
  department: '',
  hourlyRatePence: 1500,
  payFrequency: 'WEEKLY',
  taxCode: '1257L',
  taxBasis: 'CUMULATIVE',
  niCategory: 'A',
  region: 'ENGLAND_WALES_NI',
  studentLoanPlan: 'NONE',
  pensionEnrolled: false,
  pensionEmployeePct: 0.05,
  pensionEmployerPct: 0.03,
  pensionScheme: 'NET_PAY',
  holidayEntitlementDays: 28,
  active: true,
  createdAt: '2026-04-06T00:00:00.000Z',
  updatedAt: '2026-04-06T00:00:00.000Z',
};

function calculate(
  overrides: Partial<Employee> = {},
  input: Partial<Parameters<typeof calculatePayslip>[0]> = {},
) {
  return calculatePayslip({
    employee: { ...baseEmployee, ...overrides },
    rates: DEFAULT_RATES,
    hoursWorked: 40,
    bonusPence: 0,
    holidayHours: 0,
    periodNumber: 1,
    totalPeriods: 52,
    ytd: { taxablePayPence: 0, taxPaidPence: 0 },
    ...input,
  });
}

describe('payroll engine', () => {
  it('calculates a basic weekly payslip', () => {
    const result = calculate();
    expect(result.grossPayPence).toBe(60_000);
    expect(result.payePence).toBe(7_165);
    expect(result.employeeNiPence).toBe(2_864);
    expect(result.employerNiPence).toBe(7_560);
    expect(result.netPayPence).toBe(49_971);
    expect(result.employerCostPence).toBe(67_560);
  });

  it('calculates a monthly payslip with per-period thresholds', () => {
    const result = calculate(
      { payFrequency: 'MONTHLY', hourlyRatePence: 1_875 },
      { totalPeriods: 12, hoursWorked: 160 },
    );
    expect(result.grossPayPence).toBe(300_000);
    expect(result.payePence).toBe(39_050);
    expect(result.employeeNiPence).toBe(15_616);
    expect(result.employerNiPence).toBe(38_745);
    expect(result.netPayPence).toBe(245_334);
  });

  it('deducts net-pay pension before tax but not before NI', () => {
    const result = calculate({ pensionEnrolled: true });
    expect(result.qualifyingEarningsPence).toBe(48_000);
    expect(result.employeePensionPence).toBe(2_400);
    expect(result.employerPensionPence).toBe(1_440);
    expect(result.taxablePayPence).toBe(57_600);
    expect(result.payePence).toBe(6_685);
    expect(result.employeeNiPence).toBe(2_864);
    expect(result.netPayPence).toBe(48_051);
    expect(result.employerCostPence).toBe(69_000);
  });

  it('deducts student loan per pay period', () => {
    const result = calculate(
      {
        payFrequency: 'MONTHLY',
        hourlyRatePence: 1_875,
        studentLoanPlan: 'PLAN_2',
      },
      { totalPeriods: 12, hoursWorked: 160 },
    );
    expect(result.studentLoanPence).toBe(5_643);
  });

  it('uses year-to-date figures for cumulative tax', () => {
    const result = calculate(
      { payFrequency: 'MONTHLY', hourlyRatePence: 1_875 },
      {
        totalPeriods: 12,
        periodNumber: 2,
        hoursWorked: 160,
        ytd: { taxablePayPence: 300_000, taxPaidPence: 39_050 },
      },
    );
    expect(result.payePence).toBe(39_050);
  });

  it('accrues holiday at 12.07% of hours worked', () => {
    const result = calculate();
    expect(result.holidayAccruedHours).toBe(4.828);
  });

  it('parses standard, flat-rate and K tax codes', () => {
    expect(parseTaxCode('1257L', DEFAULT_RATES).allowancePence).toBe(1_257_000);
    expect(parseTaxCode('BR', DEFAULT_RATES).flatRate).toBe(0.2);
    expect(parseTaxCode('D0', DEFAULT_RATES).flatRate).toBe(0.4);
    expect(parseTaxCode('K475', DEFAULT_RATES).allowancePence).toBe(-475_000);
    expect(parseTaxCode('1257L W1', DEFAULT_RATES).nonCumulative).toBe(true);
  });

  it('maps dates to the correct tax periods', () => {
    expect(getTaxYear('2026-04-05')).toBe('2025/26');
    expect(getTaxYear('2026-04-06')).toBe('2026/27');
    expect(getTaxPeriod('2026-04-06', 'MONTHLY')).toMatchObject({
      periodNumber: 1,
      totalPeriods: 12,
    });
    expect(getTaxPeriod('2026-05-05', 'MONTHLY').periodNumber).toBe(1);
    expect(getTaxPeriod('2026-05-06', 'MONTHLY').periodNumber).toBe(2);
    expect(getTaxPeriod('2026-04-13', 'WEEKLY').periodNumber).toBe(2);
  });
});
