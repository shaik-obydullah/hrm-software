import { buildHmrcSummary } from '../hmrcSummary';

const totals = {
  payePence: 100_000,
  employeeNiPence: 20_000,
  employerNiPence: 30_000,
  studentLoanPence: 5_000,
  employerPensionPence: 10_000,
  grossPayPence: 500_000,
  employeeCount: 2,
  runCount: 1,
};

describe('buildHmrcSummary', () => {
  it('subtracts the run-level Employment Allowance once', () => {
    const summary = buildHmrcSummary('2026/27', totals, 10_500);
    expect(summary.employmentAllowancePence).toBe(10_500);
    expect(summary.totalDuePence).toBe(100_000 + 20_000 + 30_000 + 5_000 - 10_500);
  });

  it('does not multiply the allowance by the number of employees', () => {
    const summary = buildHmrcSummary('2026/27', totals, 10_500);
    expect(summary.totalDuePence).not.toBe(
      100_000 + 20_000 + 30_000 + 5_000 - 10_500 * totals.employeeCount,
    );
  });
});
