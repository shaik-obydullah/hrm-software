import type { HmrcSummary } from '../types';

export interface HmrcTotalsInput {
  payePence: number;
  employeeNiPence: number;
  employerNiPence: number;
  studentLoanPence: number;
  employerPensionPence: number;
  grossPayPence: number;
  employeeCount: number;
  runCount: number;
}

/**
 * Combines payslip totals with the run-level Employment Allowance. The
 * allowance belongs to the payroll run, not to each payslip, so it must only
 * be subtracted once per run.
 */
export function buildHmrcSummary(
  taxYear: string,
  totals: HmrcTotalsInput,
  employmentAllowancePence: number,
): HmrcSummary {
  return {
    taxYear,
    ...totals,
    employmentAllowancePence,
    totalDuePence:
      totals.payePence +
      totals.employeeNiPence +
      totals.employerNiPence +
      totals.studentLoanPence -
      employmentAllowancePence,
  };
}
