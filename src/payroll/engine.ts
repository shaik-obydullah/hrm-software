import Decimal from 'decimal.js';
import type {
  Employee,
  PayFrequency,
  Rates,
  TaxBand,
} from '../types';
import { D, roundHours, roundPence } from './money';

export interface YtdFigures {
  taxablePayPence: number;
  taxPaidPence: number;
}

export interface ParsedTaxCode {
  code: string;
  allowancePence: number;
  explicitAllowance: boolean;
  flatRate?: number;
  nonCumulative: boolean;
  warning?: string;
}

export interface PayrollCalculationInput {
  employee: Employee;
  rates: Rates;
  hoursWorked: number;
  bonusPence: number;
  holidayHours: number;
  periodNumber: number;
  totalPeriods: number;
  ytd: YtdFigures;
}

export interface PayslipCalculation {
  hoursWorked: number;
  hourlyRatePence: number;
  bonusPence: number;
  holidayHours: number;
  holidayPayPence: number;
  grossPayPence: number;
  taxablePayPence: number;
  payePence: number;
  employeeNiPence: number;
  employerNiPence: number;
  employeePensionPence: number;
  employerPensionPence: number;
  studentLoanPence: number;
  netPayPence: number;
  employerCostPence: number;
  qualifyingEarningsPence: number;
  holidayAccruedHours: number;
  taxCodeUsed: string;
  breakdown: Record<string, unknown>;
}

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function roundThreshold(annualPence: number, periods: number): number {
  return Math.round(annualPence / periods / 100) * 100;
}

export function getTaxYear(payDate: string): string {
  const date = utcDate(payDate);
  const year = date.getUTCFullYear();
  const april6 = Date.UTC(year, 3, 6);
  const startYear = date.getTime() >= april6 ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export function getTaxPeriod(
  payDate: string,
  frequency: PayFrequency,
): { periodNumber: number; totalPeriods: number; taxYear: string } {
  const date = utcDate(payDate);
  const year = date.getUTCFullYear();
  const april6 = Date.UTC(year, 3, 6);
  const startYear = date.getTime() >= april6 ? year : year - 1;
  const start = new Date(Date.UTC(startYear, 3, 6));
  const taxYear = `${startYear}/${String(startYear + 1).slice(-2)}`;

  if (frequency === 'WEEKLY') {
    const days = Math.floor(
      (date.getTime() - start.getTime()) / 86_400_000,
    );
    const periodNumber = Math.min(53, Math.max(1, Math.floor(days / 7) + 1));
    return { periodNumber, totalPeriods: 52, taxYear };
  }

  let periodNumber =
    (date.getUTCFullYear() - startYear) * 12 +
    (date.getUTCMonth() - 3) +
    1;
  if (date.getUTCDate() < 6) {
    periodNumber -= 1;
  }
  periodNumber = Math.min(12, Math.max(1, periodNumber));
  return { periodNumber, totalPeriods: 12, taxYear };
}

export function parseTaxCode(code: string, rates: Rates): ParsedTaxCode {
  const clean = code.replace(/\s+/g, '').toUpperCase();
  const nonCumulative = /(W1|M1|X)$/.test(clean);
  const base = clean.replace(/(W1|M1|X)$/, '');

  if (base === 'BR') {
    return {
      code: clean,
      allowancePence: 0,
      explicitAllowance: true,
      flatRate: 0.2,
      nonCumulative,
    };
  }
  if (base === 'D0') {
    return {
      code: clean,
      allowancePence: 0,
      explicitAllowance: true,
      flatRate: 0.4,
      nonCumulative,
    };
  }
  if (base === 'D1') {
    return {
      code: clean,
      allowancePence: 0,
      explicitAllowance: true,
      flatRate: 0.45,
      nonCumulative,
    };
  }
  if (base === 'NT') {
    return {
      code: clean,
      allowancePence: 0,
      explicitAllowance: true,
      flatRate: 0,
      nonCumulative,
    };
  }
  if (base === '0T') {
    return {
      code: clean,
      allowancePence: 0,
      explicitAllowance: true,
      nonCumulative,
    };
  }

  const kCode = base.match(/^K(\d+)$/);
  if (kCode) {
    return {
      code: clean,
      allowancePence: -Number(kCode[1]) * 10 * 100,
      explicitAllowance: true,
      nonCumulative,
    };
  }

  const standard = base.match(/^(\d+)([LMNT])$/);
  if (standard) {
    return {
      code: clean,
      allowancePence: Number(standard[1]) * 10 * 100,
      explicitAllowance: true,
      nonCumulative,
    };
  }

  return {
    code: clean,
    allowancePence: rates.personalAllowancePence,
    explicitAllowance: false,
    nonCumulative,
    warning: `Unrecognised tax code "${code}" — using the standard personal allowance.`,
  };
}

function taxOnBands(taxablePence: number, bands: TaxBand[]): number {
  let tax = D(0);
  let lower = D(0);
  const taxable = D(taxablePence);

  for (const band of bands) {
    if (taxable.lte(lower)) {
      break;
    }
    const upper = band.upToPence === null ? null : D(band.upToPence);
    const slice =
      upper === null ? taxable.minus(lower) : Decimal.min(taxable, upper).minus(lower);
    if (slice.gt(0)) {
      tax = tax.plus(slice.times(band.rate));
    }
    if (upper === null || taxable.lte(upper)) {
      break;
    }
    lower = upper;
  }

  return roundPence(tax);
}

function taperedAnnualAllowance(
  estimatedAnnualIncomePence: number,
  rates: Rates,
): number {
  const excess = Decimal.max(
    0,
    D(estimatedAnnualIncomePence).minus(rates.allowanceTaperThresholdPence),
  );
  const reduction = excess.times(rates.allowanceTaperRate);
  return roundPence(Decimal.max(0, D(rates.personalAllowancePence).minus(reduction)));
}

export interface PayeResult {
  payePence: number;
  allowanceToDatePence: number;
  taxableToDatePence: number;
  taxDueToDatePence: number;
  parsed: ParsedTaxCode;
}

export function calculatePaye(params: {
  rates: Rates;
  taxCode: string;
  taxBasis: Employee['taxBasis'];
  currentTaxablePence: number;
  ytd: YtdFigures;
  periodNumber: number;
  totalPeriods: number;
}): PayeResult {
  const {
    rates,
    taxCode,
    taxBasis,
    currentTaxablePence,
    ytd,
    periodNumber,
    totalPeriods,
  } = params;
  const parsed = parseTaxCode(taxCode, rates);
  const nonCumulative = taxBasis === 'WEEK1_MONTH1' || parsed.nonCumulative;

  if (parsed.flatRate !== undefined) {
    const payePence = roundPence(D(currentTaxablePence).times(parsed.flatRate));
    return {
      payePence,
      allowanceToDatePence: 0,
      taxableToDatePence: currentTaxablePence,
      taxDueToDatePence: payePence,
      parsed,
    };
  }

  if (nonCumulative) {
    const estimatedAnnualIncome = D(currentTaxablePence)
      .times(totalPeriods)
      .div(Math.max(1, periodNumber));
    const annualAllowance = parsed.explicitAllowance
      ? D(parsed.allowancePence)
      : D(taperedAnnualAllowance(roundPence(estimatedAnnualIncome), rates));
    const allowanceThisPeriod = annualAllowance.div(totalPeriods);
    const taxable = Decimal.max(0, D(currentTaxablePence).minus(allowanceThisPeriod));
    const periodBands = rates.bands.map((band) => ({
      upToPence:
        band.upToPence === null
          ? null
          : roundPence(D(band.upToPence).div(totalPeriods)),
      rate: band.rate,
    }));
    const payePence = taxOnBands(roundPence(taxable), periodBands);
    return {
      payePence,
      allowanceToDatePence: roundPence(allowanceThisPeriod),
      taxableToDatePence: roundPence(taxable),
      taxDueToDatePence: payePence,
      parsed,
    };
  }

  const taxableBeforeAllowance = D(ytd.taxablePayPence).plus(currentTaxablePence);
  const estimatedAnnualIncome = taxableBeforeAllowance
    .times(totalPeriods)
    .div(Math.max(1, periodNumber));
  const annualAllowance = parsed.explicitAllowance
    ? D(parsed.allowancePence)
    : D(taperedAnnualAllowance(roundPence(estimatedAnnualIncome), rates));
  const allowanceToDate = annualAllowance
    .times(periodNumber)
    .div(totalPeriods);
  const taxableToDate = Decimal.max(
    0,
    taxableBeforeAllowance.minus(allowanceToDate),
  );
  const taxDueToDate = taxOnBands(roundPence(taxableToDate), rates.bands);
  const payePence = taxDueToDate - ytd.taxPaidPence;

  return {
    payePence,
    allowanceToDatePence: roundPence(allowanceToDate),
    taxableToDatePence: roundPence(taxableToDate),
    taxDueToDatePence: taxDueToDate,
    parsed,
  };
}

export interface NiResult {
  employeePence: number;
  employerPence: number;
  primaryThresholdPence: number;
  upperEarningsLimitPence: number;
  secondaryThresholdPence: number;
}

export function calculateNi(params: {
  rates: Rates;
  niCategory: Employee['niCategory'];
  grossPence: number;
  totalPeriods: number;
}): NiResult {
  const { rates, niCategory, grossPence, totalPeriods } = params;
  const primaryThreshold = roundThreshold(
    rates.ni.primaryThresholdPence,
    totalPeriods,
  );
  const upperEarningsLimit = roundThreshold(
    rates.ni.upperEarningsLimitPence,
    totalPeriods,
  );
  const secondaryThreshold = roundThreshold(
    rates.ni.secondaryThresholdPence,
    totalPeriods,
  );
  const category = rates.ni.categories[niCategory] ?? rates.ni.categories.A;
  const gross = D(grossPence);

  const mainEarnings = Decimal.max(
    0,
    Decimal.min(gross, upperEarningsLimit).minus(primaryThreshold),
  );
  const upperEarnings = Decimal.max(0, gross.minus(upperEarningsLimit));
  const employeePence = roundPence(
    mainEarnings.times(category.employeeMain).plus(
      upperEarnings.times(category.employeeUpper),
    ),
  );
  const employerPence = roundPence(
    Decimal.max(0, gross.minus(secondaryThreshold)).times(category.employer),
  );

  return {
    employeePence,
    employerPence,
    primaryThresholdPence: primaryThreshold,
    upperEarningsLimitPence: upperEarningsLimit,
    secondaryThresholdPence: secondaryThreshold,
  };
}

export interface PensionResult {
  qualifyingEarningsPence: number;
  employeePence: number;
  employerPence: number;
  lowerThresholdPence: number;
  upperThresholdPence: number;
}

export function calculatePension(params: {
  rates: Rates;
  employee: Employee;
  grossPence: number;
  totalPeriods: number;
}): PensionResult {
  const { rates, employee, grossPence, totalPeriods } = params;
  const lower = roundThreshold(rates.pension.lowerPence, totalPeriods);
  const upper = roundThreshold(rates.pension.upperPence, totalPeriods);
  const qualifying = Decimal.max(
    0,
    Decimal.min(grossPence, upper).minus(lower),
  );
  const enrolled = employee.pensionEnrolled;
  const employeePence = enrolled
    ? roundPence(qualifying.times(employee.pensionEmployeePct))
    : 0;
  const employerPence = enrolled
    ? roundPence(qualifying.times(employee.pensionEmployerPct))
    : 0;

  return {
    qualifyingEarningsPence: roundPence(qualifying),
    employeePence,
    employerPence,
    lowerThresholdPence: lower,
    upperThresholdPence: upper,
  };
}

export interface StudentLoanResult {
  deductionPence: number;
  thresholdPence: number;
  rate: number;
}

export function calculateStudentLoan(params: {
  rates: Rates;
  plan: Employee['studentLoanPlan'];
  grossPence: number;
  totalPeriods: number;
}): StudentLoanResult {
  const { rates, plan, grossPence, totalPeriods } = params;
  if (plan === 'NONE') {
    return { deductionPence: 0, thresholdPence: 0, rate: 0 };
  }
  const rule = rates.studentLoans[plan];
  const threshold = roundThreshold(rule.thresholdPence, totalPeriods);
  const deduction = roundPence(
    Decimal.max(0, D(grossPence).minus(threshold)).times(rule.rate),
  );
  return { deductionPence: deduction, thresholdPence: threshold, rate: rule.rate };
}

export function calculatePayslip(
  input: PayrollCalculationInput,
): PayslipCalculation {
  const {
    employee,
    rates,
    hoursWorked,
    bonusPence,
    holidayHours,
    periodNumber,
    totalPeriods,
    ytd,
  } = input;

  const basePayPence = roundPence(D(hoursWorked).times(employee.hourlyRatePence));
  const holidayPayPence = roundPence(
    D(holidayHours).times(employee.hourlyRatePence),
  );
  const grossPayPence = basePayPence + bonusPence + holidayPayPence;

  const pension = calculatePension({
    rates,
    employee,
    grossPence: grossPayPence,
    totalPeriods,
  });
  const taxablePayPence =
    employee.pensionScheme === 'NET_PAY'
      ? Math.max(0, grossPayPence - pension.employeePence)
      : grossPayPence;

  const paye = calculatePaye({
    rates,
    taxCode: employee.taxCode,
    taxBasis: employee.taxBasis,
    currentTaxablePence: taxablePayPence,
    ytd,
    periodNumber,
    totalPeriods,
  });
  const ni = calculateNi({
    rates,
    niCategory: employee.niCategory,
    grossPence: grossPayPence,
    totalPeriods,
  });
  const studentLoan = calculateStudentLoan({
    rates,
    plan: employee.studentLoanPlan,
    grossPence: grossPayPence,
    totalPeriods,
  });

  const netPayPence =
    grossPayPence -
    paye.payePence -
    ni.employeePence -
    pension.employeePence -
    studentLoan.deductionPence;

  return {
    hoursWorked,
    hourlyRatePence: employee.hourlyRatePence,
    bonusPence,
    holidayHours,
    holidayPayPence,
    grossPayPence,
    taxablePayPence,
    payePence: paye.payePence,
    employeeNiPence: ni.employeePence,
    employerNiPence: ni.employerPence,
    employeePensionPence: pension.employeePence,
    employerPensionPence: pension.employerPence,
    studentLoanPence: studentLoan.deductionPence,
    netPayPence,
    employerCostPence:
      grossPayPence + ni.employerPence + pension.employerPence,
    qualifyingEarningsPence: pension.qualifyingEarningsPence,
    holidayAccruedHours: roundHours(
      D(hoursWorked).times(rates.holidayAccrualPct),
    ),
    taxCodeUsed: employee.taxCode,
    breakdown: {
      periodNumber,
      totalPeriods,
      basePayPence,
      ytdBefore: ytd,
      tax: {
        parsed: paye.parsed,
        allowanceToDatePence: paye.allowanceToDatePence,
        taxableToDatePence: paye.taxableToDatePence,
        taxDueToDatePence: paye.taxDueToDatePence,
        bands: rates.bands,
      },
      ni: {
        category: employee.niCategory,
        ...ni,
      },
      pension: {
        scheme: employee.pensionScheme,
        employeePct: employee.pensionEmployeePct,
        employerPct: employee.pensionEmployerPct,
        ...pension,
      },
      studentLoan: {
        plan: employee.studentLoanPlan,
        ...studentLoan,
      },
      holiday: {
        accrualPct: rates.holidayAccrualPct,
        accruedHours: roundHours(D(hoursWorked).times(rates.holidayAccrualPct)),
      },
    },
  };
}
