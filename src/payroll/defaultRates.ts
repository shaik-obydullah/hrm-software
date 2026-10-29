import type { Rates } from '../types';

/**
 * Seeded 2026/27 values. Every figure is editable in Settings → Tax & NI rates.
 * Always confirm against gov.uk before using the output for real payroll.
 */
export const DEFAULT_RATES: Rates = {
  taxYear: '2026/27',
  personalAllowancePence: 1_257_000,
  allowanceTaperThresholdPence: 10_000_000,
  allowanceTaperRate: 0.5,
  bands: [
    { upToPence: 3_770_000, rate: 0.2 },
    { upToPence: 11_257_000, rate: 0.4 },
    { upToPence: null, rate: 0.45 },
  ],
  ni: {
    primaryThresholdPence: 1_257_000,
    upperEarningsLimitPence: 5_027_000,
    secondaryThresholdPence: 500_000,
    employmentAllowancePence: 1_050_000,
    categories: {
      A: { employeeMain: 0.08, employeeUpper: 0.02, employer: 0.15 },
      B: { employeeMain: 0.0185, employeeUpper: 0.02, employer: 0.15 },
      C: { employeeMain: 0, employeeUpper: 0, employer: 0.15 },
      H: { employeeMain: 0.08, employeeUpper: 0.02, employer: 0 },
      J: { employeeMain: 0.02, employeeUpper: 0.02, employer: 0.15 },
      M: { employeeMain: 0.08, employeeUpper: 0.02, employer: 0 },
      Z: { employeeMain: 0.02, employeeUpper: 0.02, employer: 0 },
    },
  },
  pension: {
    lowerPence: 624_000,
    upperPence: 5_027_000,
    minEmployeePct: 0.05,
    minEmployerPct: 0.03,
  },
  studentLoans: {
    PLAN_1: { thresholdPence: 2_606_500, rate: 0.09 },
    PLAN_2: { thresholdPence: 2_847_000, rate: 0.09 },
    PLAN_4: { thresholdPence: 3_274_500, rate: 0.09 },
    PLAN_5: { thresholdPence: 2_500_000, rate: 0.09 },
    POSTGRAD: { thresholdPence: 2_100_000, rate: 0.06 },
  },
  holidayAccrualPct: 0.1207,
};

export const DEFAULT_RATE_SET_NAME = '2026/27 statutory rates';
export const DEFAULT_RATE_SET_EFFECTIVE_FROM = '2026-04-06';
