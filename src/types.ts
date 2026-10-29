export type PayFrequency = 'WEEKLY' | 'MONTHLY';
export type TaxBasis = 'CUMULATIVE' | 'WEEK1_MONTH1';
export type StudentLoanPlan =
  | 'NONE'
  | 'PLAN_1'
  | 'PLAN_2'
  | 'PLAN_4'
  | 'PLAN_5'
  | 'POSTGRAD';
export type PensionScheme = 'NET_PAY' | 'RELIEF_AT_SOURCE';
export type NiCategory = 'A' | 'B' | 'C' | 'H' | 'J' | 'M' | 'Z';
export type Region = 'ENGLAND_WALES_NI' | 'SCOTLAND';
export type RunStatus = 'DRAFT' | 'FINALISED';
export type RateSetStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  dateOfBirth: string;
  niNumber: string;
  startDate: string;
  endDate: string;
  jobTitle: string;
  department: string;
  hourlyRatePence: number;
  payFrequency: PayFrequency;
  taxCode: string;
  taxBasis: TaxBasis;
  niCategory: NiCategory;
  region: Region;
  studentLoanPlan: StudentLoanPlan;
  pensionEnrolled: boolean;
  pensionEmployeePct: number;
  pensionEmployerPct: number;
  pensionScheme: PensionScheme;
  holidayEntitlementDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeDraft = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

export interface TaxBand {
  /** Upper limit of taxable income in pence; null for the final band. */
  upToPence: number | null;
  rate: number;
}

export interface NiCategoryRates {
  employeeMain: number;
  employeeUpper: number;
  employer: number;
}

export interface Rates {
  taxYear: string;
  personalAllowancePence: number;
  allowanceTaperThresholdPence: number;
  allowanceTaperRate: number;
  bands: TaxBand[];
  ni: {
    primaryThresholdPence: number;
    upperEarningsLimitPence: number;
    secondaryThresholdPence: number;
    employmentAllowancePence: number;
    categories: Record<NiCategory, NiCategoryRates>;
  };
  pension: {
    lowerPence: number;
    upperPence: number;
    minEmployeePct: number;
    minEmployerPct: number;
  };
  studentLoans: Record<
    Exclude<StudentLoanPlan, 'NONE'>,
    { thresholdPence: number; rate: number }
  >;
  holidayAccrualPct: number;
}

export interface RateSet {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: RateSetStatus;
  data: Rates;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: PayFrequency;
  rateSetId: string;
  status: RunStatus;
  taxYear: string;
  employmentAllowancePence: number;
  createdAt: string;
  finalisedAt: string | null;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
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
  niCategoryUsed: NiCategory;
  breakdownJson: string;
  createdAt: string;
}

export interface AdminProfile {
  name: string;
  pinHash: string;
  biometricEnabled: boolean;
  createdAt: string;
}

export interface PayslipWithRun extends Payslip {
  payDate: string;
  periodStart: string;
  periodEnd: string;
  taxYear: string;
  runStatus: RunStatus;
}

export interface HmrcSummary {
  taxYear: string;
  payePence: number;
  employeeNiPence: number;
  employerNiPence: number;
  studentLoanPence: number;
  employmentAllowancePence: number;
  totalDuePence: number;
  employerPensionPence: number;
  grossPayPence: number;
  employeeCount: number;
  runCount: number;
}

export interface RunTotals {
  employeeCount: number;
  grossPayPence: number;
  payePence: number;
  employeeNiPence: number;
  employerNiPence: number;
  employeePensionPence: number;
  employerPensionPence: number;
  studentLoanPence: number;
  netPayPence: number;
  employerCostPence: number;
  employmentAllowancePence: number;
}

export interface PayrollRunWithTotals extends PayrollRun {
  totals: RunTotals;
}

export interface HolidayEntry {
  id: string;
  employeeId: string;
  entryDate: string;
  type: 'ACCRUAL' | 'TAKEN' | 'PAID' | 'ADJUSTMENT';
  hours: number;
  note: string;
  payslipId: string | null;
  createdAt: string;
}

export const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
];

export const TAX_BASES: { value: TaxBasis; label: string }[] = [
  { value: 'CUMULATIVE', label: 'Cumulative' },
  { value: 'WEEK1_MONTH1', label: 'Week 1 / Month 1' },
];

export const NI_CATEGORIES: { value: NiCategory; label: string }[] = [
  { value: 'A', label: 'A — standard' },
  { value: 'B', label: 'B — married women' },
  { value: 'C', label: 'C — state pension age' },
  { value: 'H', label: 'H — apprentice' },
  { value: 'J', label: 'J — deferment' },
  { value: 'M', label: 'M — under 21' },
  { value: 'Z', label: 'Z — under 21 deferment' },
];

export const STUDENT_LOAN_PLANS: { value: StudentLoanPlan; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'PLAN_1', label: 'Plan 1' },
  { value: 'PLAN_2', label: 'Plan 2' },
  { value: 'PLAN_4', label: 'Plan 4 (Scotland)' },
  { value: 'PLAN_5', label: 'Plan 5' },
  { value: 'POSTGRAD', label: 'Postgraduate' },
];

export const PENSION_SCHEMES: { value: PensionScheme; label: string }[] = [
  { value: 'NET_PAY', label: 'Net pay' },
  { value: 'RELIEF_AT_SOURCE', label: 'Relief at source' },
];
