import type { Scalar } from '@op-engineering/op-sqlite';
import type {
  AdminProfile,
  Employee,
  EmployeeDraft,
  HmrcSummary,
  HolidayEntry,
  NiCategory,
  PayFrequency,
  PayrollRun,
  PayrollRunWithTotals,
  Payslip,
  PayslipWithRun,
  RateSet,
  Rates,
  RunStatus,
  RunTotals,
  TaxBasis,
  PensionScheme,
  Region,
  StudentLoanPlan,
  RateSetStatus,
} from '../types';
import { getDb, logAudit, makeId } from './database';
import { buildHmrcSummary } from './hmrcSummary';
import type { HmrcTotalsInput } from './hmrcSummary';

const text = (value: Scalar | undefined): string =>
  value === null || value === undefined ? '' : String(value);
const number = (value: Scalar | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);
const flag = (value: Scalar | undefined): boolean => Number(value) === 1;

type Row = Record<string, Scalar>;

function rowToEmployee(row: Row): Employee {
  return {
    id: text(row.id),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    email: text(row.email),
    phone: text(row.phone),
    address: text(row.address),
    city: text(row.city),
    postcode: text(row.postcode),
    dateOfBirth: text(row.date_of_birth),
    niNumber: text(row.ni_number),
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    jobTitle: text(row.job_title),
    department: text(row.department),
    hourlyRatePence: number(row.hourly_rate_pence),
    payFrequency: text(row.pay_frequency) as PayFrequency,
    taxCode: text(row.tax_code),
    taxBasis: text(row.tax_basis) as TaxBasis,
    niCategory: text(row.ni_category) as NiCategory,
    region: text(row.region) as Region,
    studentLoanPlan: text(row.student_loan_plan) as StudentLoanPlan,
    pensionEnrolled: flag(row.pension_enrolled),
    pensionEmployeePct: number(row.pension_employee_pct),
    pensionEmployerPct: number(row.pension_employer_pct),
    pensionScheme: text(row.pension_scheme) as PensionScheme,
    holidayEntitlementDays: number(row.holiday_entitlement_days),
    active: flag(row.active),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function rowToRateSet(row: Row): RateSet {
  return {
    id: text(row.id),
    name: text(row.name),
    effectiveFrom: text(row.effective_from),
    effectiveTo: row.effective_to === null ? null : text(row.effective_to),
    status: text(row.status) as RateSetStatus,
    data: JSON.parse(text(row.data_json)) as Rates,
    createdAt: text(row.created_at),
  };
}

function rowToPayrollRun(row: Row): PayrollRun {
  return {
    id: text(row.id),
    periodStart: text(row.period_start),
    periodEnd: text(row.period_end),
    payDate: text(row.pay_date),
    frequency: text(row.frequency) as PayFrequency,
    rateSetId: text(row.rate_set_id),
    status: text(row.status) as RunStatus,
    taxYear: text(row.tax_year),
    employmentAllowancePence: number(row.employment_allowance_pence),
    createdAt: text(row.created_at),
    finalisedAt: row.finalised_at === null ? null : text(row.finalised_at),
  };
}

function rowToPayslip(row: Row): Payslip {
  return {
    id: text(row.id),
    payrollRunId: text(row.payroll_run_id),
    employeeId: text(row.employee_id),
    hoursWorked: number(row.hours_worked),
    hourlyRatePence: number(row.hourly_rate_pence),
    bonusPence: number(row.bonus_pence),
    holidayHours: number(row.holiday_hours),
    holidayPayPence: number(row.holiday_pay_pence),
    grossPayPence: number(row.gross_pay_pence),
    taxablePayPence: number(row.taxable_pay_pence),
    payePence: number(row.paye_pence),
    employeeNiPence: number(row.employee_ni_pence),
    employerNiPence: number(row.employer_ni_pence),
    employeePensionPence: number(row.employee_pension_pence),
    employerPensionPence: number(row.employer_pension_pence),
    studentLoanPence: number(row.student_loan_pence),
    netPayPence: number(row.net_pay_pence),
    employerCostPence: number(row.employer_cost_pence),
    qualifyingEarningsPence: number(row.qualifying_earnings_pence),
    holidayAccruedHours: number(row.holiday_accrued_hours),
    taxCodeUsed: text(row.tax_code_used),
    niCategoryUsed: text(row.ni_category_used) as NiCategory,
    breakdownJson: text(row.breakdown_json),
    createdAt: text(row.created_at),
  };
}

function rowToHolidayEntry(row: Row): HolidayEntry {
  return {
    id: text(row.id),
    employeeId: text(row.employee_id),
    entryDate: text(row.entry_date),
    type: text(row.type) as HolidayEntry['type'],
    hours: number(row.hours),
    note: text(row.note),
    payslipId: row.payslip_id === null ? null : text(row.payslip_id),
    createdAt: text(row.created_at),
  };
}

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const db = getDb();
  const result = await db.execute(
    'SELECT name, pin_hash, biometric_enabled, created_at FROM admin_profile WHERE id = 1',
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    name: text(row.name),
    pinHash: text(row.pin_hash),
    biometricEnabled: flag(row.biometric_enabled),
    createdAt: text(row.created_at),
  };
}

export async function createAdminProfile(
  name: string,
  pinHash: string,
): Promise<void> {
  const db = getDb();
  await db.execute(
    `INSERT INTO admin_profile
      (id, name, pin_hash, biometric_enabled, created_at)
     VALUES (1, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       pin_hash = excluded.pin_hash`,
    [name, pinHash, new Date().toISOString()],
  );
  await logAudit('setup', 'admin_profile', '1', { name });
}

export async function setAdminPin(pinHash: string): Promise<void> {
  const db = getDb();
  await db.execute('UPDATE admin_profile SET pin_hash = ? WHERE id = 1', [
    pinHash,
  ]);
  await logAudit('update', 'admin_profile', '1', { field: 'pin' });
}

export async function listEmployees(search = ''): Promise<Employee[]> {
  const db = getDb();
  const trimmed = search.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    const result = await db.execute(
      `SELECT * FROM employees
       WHERE first_name LIKE ? OR last_name LIKE ? OR job_title LIKE ?
       ORDER BY active DESC, first_name COLLATE NOCASE, last_name COLLATE NOCASE`,
      [like, like, like],
    );
    return result.rows.map(rowToEmployee);
  }
  const result = await db.execute(
    `SELECT * FROM employees
     ORDER BY active DESC, first_name COLLATE NOCASE, last_name COLLATE NOCASE`,
  );
  return result.rows.map(rowToEmployee);
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM employees WHERE id = ?', [id]);
  const row = result.rows[0];
  return row ? rowToEmployee(row) : null;
}

export async function saveEmployee(
  draft: EmployeeDraft,
  id?: string,
): Promise<string> {
  if (!Number.isFinite(draft.hourlyRatePence) || draft.hourlyRatePence <= 0) {
    throw new Error('Enter an hourly rate greater than £0.00.');
  }
  const db = getDb();
  const employeeId = id ?? makeId('emp');
  const now = new Date().toISOString();
  const existing = id ? await getEmployee(id) : null;
  const createdAt = existing?.createdAt ?? now;

  await db.execute(
    `INSERT INTO employees (
      id, first_name, last_name, email, phone, address, city, postcode,
      date_of_birth, ni_number, start_date, end_date, job_title, department,
      hourly_rate_pence, pay_frequency, tax_code, tax_basis, ni_category,
      region, student_loan_plan, pension_enrolled, pension_employee_pct,
      pension_employer_pct, pension_scheme, holiday_entitlement_days, active,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      phone = excluded.phone,
      address = excluded.address,
      city = excluded.city,
      postcode = excluded.postcode,
      date_of_birth = excluded.date_of_birth,
      ni_number = excluded.ni_number,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      job_title = excluded.job_title,
      department = excluded.department,
      hourly_rate_pence = excluded.hourly_rate_pence,
      pay_frequency = excluded.pay_frequency,
      tax_code = excluded.tax_code,
      tax_basis = excluded.tax_basis,
      ni_category = excluded.ni_category,
      region = excluded.region,
      student_loan_plan = excluded.student_loan_plan,
      pension_enrolled = excluded.pension_enrolled,
      pension_employee_pct = excluded.pension_employee_pct,
      pension_employer_pct = excluded.pension_employer_pct,
      pension_scheme = excluded.pension_scheme,
      holiday_entitlement_days = excluded.holiday_entitlement_days,
      active = excluded.active,
      updated_at = excluded.updated_at`,
    [
      employeeId,
      draft.firstName,
      draft.lastName,
      draft.email,
      draft.phone,
      draft.address,
      draft.city,
      draft.postcode,
      draft.dateOfBirth,
      draft.niNumber,
      draft.startDate,
      draft.endDate,
      draft.jobTitle,
      draft.department,
      draft.hourlyRatePence,
      draft.payFrequency,
      draft.taxCode,
      draft.taxBasis,
      draft.niCategory,
      draft.region,
      draft.studentLoanPlan,
      draft.pensionEnrolled ? 1 : 0,
      draft.pensionEmployeePct,
      draft.pensionEmployerPct,
      draft.pensionScheme,
      draft.holidayEntitlementDays,
      draft.active ? 1 : 0,
      createdAt,
      now,
    ],
  );

  await logAudit(id ? 'update' : 'create', 'employee', employeeId, {
    name: `${draft.firstName} ${draft.lastName}`,
  });
  return employeeId;
}

export async function archiveEmployee(id: string): Promise<void> {
  const db = getDb();
  await db.execute(
    'UPDATE employees SET active = 0, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
  await logAudit('archive', 'employee', id);
}

export async function getActiveRateSet(
  payDate: string,
): Promise<RateSet | null> {
  const db = getDb();
  let result = await db.execute(
    `SELECT * FROM rate_sets
     WHERE status = 'ACTIVE' AND effective_from <= ?
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY effective_from DESC LIMIT 1`,
    [payDate, payDate],
  );
  if (!result.rows[0]) {
    result = await db.execute(
      `SELECT * FROM rate_sets WHERE status = 'ACTIVE'
       ORDER BY effective_from DESC LIMIT 1`,
    );
  }
  if (!result.rows[0]) {
    result = await db.execute(
      'SELECT * FROM rate_sets ORDER BY effective_from DESC LIMIT 1',
    );
  }
  const row = result.rows[0];
  return row ? rowToRateSet(row) : null;
}

export async function listRateSets(): Promise<RateSet[]> {
  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM rate_sets ORDER BY effective_from DESC',
  );
  return result.rows.map(rowToRateSet);
}

function previousDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function saveRateSet(
  name: string,
  effectiveFrom: string,
  data: Rates,
): Promise<string> {
  const db = getDb();
  const id = makeId('rate');
  const now = new Date().toISOString();
  const archivedOn = previousDay(effectiveFrom);

  await db.transaction(async (tx) => {
    const active = await tx.execute(
      "SELECT id FROM rate_sets WHERE status = 'ACTIVE'",
    );
    for (const row of active.rows) {
      await tx.execute(
        `UPDATE rate_sets SET status = 'ARCHIVED', effective_to = ?
         WHERE id = ?`,
        [archivedOn, text(row.id)],
      );
    }
    await tx.execute(
      `INSERT INTO rate_sets
        (id, name, effective_from, effective_to, status, data_json, created_at)
       VALUES (?, ?, ?, NULL, 'ACTIVE', ?, ?)`,
      [id, name, effectiveFrom, JSON.stringify(data), now],
    );
  });

  await logAudit('create', 'rate_set', id, { name, effectiveFrom });
  return id;
}

export interface NewPayslip {
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
}

export interface NewHolidayEntry {
  employeeId: string;
  entryDate: string;
  type: HolidayEntry['type'];
  hours: number;
  note?: string;
}

export interface NewPayrollRun {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: PayFrequency;
  rateSetId: string;
  taxYear: string;
  employmentAllowancePence: number;
  payslips: NewPayslip[];
  holiday: NewHolidayEntry[];
}

export async function createPayrollRun(input: NewPayrollRun): Promise<string> {
  const db = getDb();
  const runId = makeId('run');
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO payroll_runs
        (id, period_start, period_end, pay_date, frequency, rate_set_id,
         status, tax_year, employment_allowance_pence, created_at, finalised_at)
       VALUES (?, ?, ?, ?, ?, ?, 'FINALISED', ?, ?, ?, ?)`,
      [
        runId,
        input.periodStart,
        input.periodEnd,
        input.payDate,
        input.frequency,
        input.rateSetId,
        input.taxYear,
        input.employmentAllowancePence,
        now,
        now,
      ],
    );

    const payslipIds = new Map<string, string>();
    for (const payslip of input.payslips) {
      const payslipId = makeId('slip');
      payslipIds.set(payslip.employeeId, payslipId);
      await tx.execute(
        `INSERT INTO payslips (
          id, payroll_run_id, employee_id, hours_worked, hourly_rate_pence,
          bonus_pence, holiday_hours, holiday_pay_pence, gross_pay_pence,
          taxable_pay_pence, paye_pence, employee_ni_pence, employer_ni_pence,
          employee_pension_pence, employer_pension_pence, student_loan_pence,
          net_pay_pence, employer_cost_pence, qualifying_earnings_pence,
          holiday_accrued_hours, tax_code_used, ni_category_used,
          breakdown_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payslipId,
          runId,
          payslip.employeeId,
          payslip.hoursWorked,
          payslip.hourlyRatePence,
          payslip.bonusPence,
          payslip.holidayHours,
          payslip.holidayPayPence,
          payslip.grossPayPence,
          payslip.taxablePayPence,
          payslip.payePence,
          payslip.employeeNiPence,
          payslip.employerNiPence,
          payslip.employeePensionPence,
          payslip.employerPensionPence,
          payslip.studentLoanPence,
          payslip.netPayPence,
          payslip.employerCostPence,
          payslip.qualifyingEarningsPence,
          payslip.holidayAccruedHours,
          payslip.taxCodeUsed,
          payslip.niCategoryUsed,
          payslip.breakdownJson,
          now,
        ],
      );
    }

    for (const entry of input.holiday) {
      await tx.execute(
        `INSERT INTO holiday_ledger
          (id, employee_id, entry_date, type, hours, note, payslip_id,
           payroll_run_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          makeId('hol'),
          entry.employeeId,
          entry.entryDate,
          entry.type,
          entry.hours,
          entry.note ?? '',
          entry.type === 'TAKEN' || entry.type === 'PAID'
            ? payslipIds.get(entry.employeeId) ?? null
            : null,
          runId,
          now,
        ],
      );
    }
  });

  await logAudit('finalise', 'payroll_run', runId, {
    payDate: input.payDate,
    employees: input.payslips.length,
  });
  return runId;
}

/**
 * Removes a finalised run and everything it created: payslips, holiday
 * accrual/taken entries, and the run row itself. Used to undo a mistake such
 * as a run with a £0 hourly rate. The audit log keeps a summary of what was
 * removed.
 */
export async function voidPayrollRun(runId: string): Promise<void> {
  const db = getDb();
  const runResult = await db.execute(
    'SELECT * FROM payroll_runs WHERE id = ?',
    [runId],
  );
  const runRow = runResult.rows[0];
  if (!runRow) {
    throw new Error('Payroll run not found.');
  }
  const slipsResult = await db.execute(
    'SELECT * FROM payslips WHERE payroll_run_id = ?',
    [runId],
  );
  const slips = slipsResult.rows;
  const sum = (column: string) =>
    slips.reduce((total, row) => total + number(row[column]), 0);

  await db.transaction(async (tx) => {
    // Holiday taken/paid rows are linked to their payslip.
    await tx.execute(
      `DELETE FROM holiday_ledger
       WHERE payslip_id IN (SELECT id FROM payslips WHERE payroll_run_id = ?)`,
      [runId],
    );
    // Holiday accrual rows created by this run.
    await tx.execute(
      'DELETE FROM holiday_ledger WHERE payroll_run_id = ?',
      [runId],
    );
    // Runs created before payroll_run_id was stored: match the accrual rows by
    // employee, period end and the exact hours recorded on the payslip.
    for (const slip of slips) {
      await tx.execute(
        `DELETE FROM holiday_ledger
         WHERE payroll_run_id IS NULL AND employee_id = ? AND type = 'ACCRUAL'
           AND entry_date = ? AND ABS(hours - ?) < 0.0001`,
        [
          text(slip.employee_id),
          text(runRow.period_end),
          number(slip.holiday_accrued_hours),
        ],
      );
    }
    await tx.execute('DELETE FROM payslips WHERE payroll_run_id = ?', [runId]);
    await tx.execute('DELETE FROM payroll_runs WHERE id = ?', [runId]);
  });

  await logAudit('void', 'payroll_run', runId, {
    payDate: text(runRow.pay_date),
    periodStart: text(runRow.period_start),
    periodEnd: text(runRow.period_end),
    employees: slips.length,
    grossPayPence: sum('gross_pay_pence'),
    payePence: sum('paye_pence'),
    netPayPence: sum('net_pay_pence'),
  });
}

export async function listPayrollRuns(): Promise<PayrollRunWithTotals[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT r.*,
      COUNT(p.id) AS employee_count,
      COALESCE(SUM(p.gross_pay_pence), 0) AS total_gross,
      COALESCE(SUM(p.paye_pence), 0) AS total_paye,
      COALESCE(SUM(p.employee_ni_pence), 0) AS total_employee_ni,
      COALESCE(SUM(p.employer_ni_pence), 0) AS total_employer_ni,
      COALESCE(SUM(p.employee_pension_pence), 0) AS total_employee_pension,
      COALESCE(SUM(p.employer_pension_pence), 0) AS total_employer_pension,
      COALESCE(SUM(p.student_loan_pence), 0) AS total_student_loan,
      COALESCE(SUM(p.net_pay_pence), 0) AS total_net,
      COALESCE(SUM(p.employer_cost_pence), 0) AS total_employer_cost
    FROM payroll_runs r
    LEFT JOIN payslips p ON p.payroll_run_id = r.id
    GROUP BY r.id
    ORDER BY r.pay_date DESC, r.created_at DESC`,
  );
  return result.rows.map((row) => ({
    ...rowToPayrollRun(row),
    totals: {
      employeeCount: number(row.employee_count),
      grossPayPence: number(row.total_gross),
      payePence: number(row.total_paye),
      employeeNiPence: number(row.total_employee_ni),
      employerNiPence: number(row.total_employer_ni),
      employeePensionPence: number(row.total_employee_pension),
      employerPensionPence: number(row.total_employer_pension),
      studentLoanPence: number(row.total_student_loan),
      netPayPence: number(row.total_net),
      employerCostPence: number(row.total_employer_cost),
      employmentAllowancePence: number(row.employment_allowance_pence),
    },
  }));
}

async function getRunTotals(runId: string): Promise<RunTotals> {
  const db = getDb();
  const result = await db.execute(
    `SELECT
      COUNT(id) AS employee_count,
      COALESCE(SUM(gross_pay_pence), 0) AS gross,
      COALESCE(SUM(paye_pence), 0) AS paye,
      COALESCE(SUM(employee_ni_pence), 0) AS employee_ni,
      COALESCE(SUM(employer_ni_pence), 0) AS employer_ni,
      COALESCE(SUM(employee_pension_pence), 0) AS employee_pension,
      COALESCE(SUM(employer_pension_pence), 0) AS employer_pension,
      COALESCE(SUM(student_loan_pence), 0) AS student_loan,
      COALESCE(SUM(net_pay_pence), 0) AS net,
      COALESCE(SUM(employer_cost_pence), 0) AS employer_cost
    FROM payslips WHERE payroll_run_id = ?`,
    [runId],
  );
  const row = result.rows[0] ?? {};
  const run = await db.execute(
    'SELECT employment_allowance_pence FROM payroll_runs WHERE id = ?',
    [runId],
  );
  return {
    employeeCount: number(row.employee_count),
    grossPayPence: number(row.gross),
    payePence: number(row.paye),
    employeeNiPence: number(row.employee_ni),
    employerNiPence: number(row.employer_ni),
    employeePensionPence: number(row.employee_pension),
    employerPensionPence: number(row.employer_pension),
    studentLoanPence: number(row.student_loan),
    netPayPence: number(row.net),
    employerCostPence: number(row.employer_cost),
    employmentAllowancePence: number(
      run.rows[0]?.employment_allowance_pence,
    ),
  };
}

export async function getPayrollRun(
  id: string,
): Promise<PayrollRunWithTotals | null> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM payroll_runs WHERE id = ?', [
    id,
  ]);
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { ...rowToPayrollRun(row), totals: await getRunTotals(id) };
}

export async function getPayslips(runId: string): Promise<Payslip[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM payslips WHERE payroll_run_id = ?
     ORDER BY created_at ASC`,
    [runId],
  );
  return result.rows.map(rowToPayslip);
}

export async function getPayslip(id: string): Promise<Payslip | null> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM payslips WHERE id = ?', [id]);
  const row = result.rows[0];
  return row ? rowToPayslip(row) : null;
}

export async function getYtd(
  employeeId: string,
  taxYear: string,
  beforePayDate: string,
): Promise<{ taxablePayPence: number; taxPaidPence: number }> {
  const db = getDb();
  const result = await db.execute(
    `SELECT
      COALESCE(SUM(p.taxable_pay_pence), 0) AS taxable,
      COALESCE(SUM(p.paye_pence), 0) AS tax
     FROM payslips p
     JOIN payroll_runs r ON r.id = p.payroll_run_id
     WHERE p.employee_id = ? AND r.tax_year = ?
       AND r.status = 'FINALISED' AND r.pay_date <= ?`,
    [employeeId, taxYear, beforePayDate],
  );
  return {
    taxablePayPence: number(result.rows[0]?.taxable),
    taxPaidPence: number(result.rows[0]?.tax),
  };
}

export async function getEmploymentAllowanceUsed(
  taxYear: string,
  beforePayDate: string,
): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    `SELECT COALESCE(SUM(employment_allowance_pence), 0) AS used
     FROM payroll_runs
     WHERE tax_year = ? AND status = 'FINALISED' AND pay_date <= ?`,
    [taxYear, beforePayDate],
  );
  return number(result.rows[0]?.used);
}

export async function getHolidayBalance(employeeId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    `SELECT COALESCE(SUM(
      CASE WHEN type IN ('TAKEN', 'PAID') THEN -hours ELSE hours END
    ), 0) AS balance
    FROM holiday_ledger WHERE employee_id = ?`,
    [employeeId],
  );
  return number(result.rows[0]?.balance);
}

export async function getHolidayEntries(
  employeeId: string,
): Promise<HolidayEntry[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM holiday_ledger WHERE employee_id = ?
     ORDER BY entry_date DESC, created_at DESC`,
    [employeeId],
  );
  return result.rows.map(rowToHolidayEntry);
}

export async function addHolidayAdjustment(
  employeeId: string,
  hours: number,
  note: string,
): Promise<void> {
  const db = getDb();
  await db.execute(
    `INSERT INTO holiday_ledger
      (id, employee_id, entry_date, type, hours, note, payslip_id, created_at)
     VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, NULL, ?)`,
    [
      makeId('hol'),
      employeeId,
      new Date().toISOString().slice(0, 10),
      hours,
      note,
      new Date().toISOString(),
    ],
  );
  await logAudit('adjust', 'holiday_ledger', employeeId, { hours, note });
}

export async function getEmployeePayslips(
  employeeId: string,
): Promise<PayslipWithRun[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT p.*, r.pay_date, r.period_start, r.period_end, r.tax_year,
       r.status AS run_status
     FROM payslips p
     JOIN payroll_runs r ON r.id = p.payroll_run_id
     WHERE p.employee_id = ?
     ORDER BY r.pay_date DESC, p.created_at DESC`,
    [employeeId],
  );
  return result.rows.map((row) => ({
    ...rowToPayslip(row),
    payDate: text(row.pay_date),
    periodStart: text(row.period_start),
    periodEnd: text(row.period_end),
    taxYear: text(row.tax_year),
    runStatus: text(row.run_status) as RunStatus,
  }));
}

export async function getHmrcSummary(taxYear: string): Promise<HmrcSummary> {
  const db = getDb();
  const result = await db.execute(
    `SELECT
      COALESCE(SUM(p.paye_pence), 0) AS paye,
      COALESCE(SUM(p.employee_ni_pence), 0) AS employee_ni,
      COALESCE(SUM(p.employer_ni_pence), 0) AS employer_ni,
      COALESCE(SUM(p.student_loan_pence), 0) AS student_loan,
      COALESCE(SUM(p.employer_pension_pence), 0) AS employer_pension,
      COALESCE(SUM(p.gross_pay_pence), 0) AS gross,
      (
        SELECT COALESCE(SUM(r2.employment_allowance_pence), 0)
        FROM payroll_runs r2
        WHERE r2.tax_year = ? AND r2.status = 'FINALISED'
      ) AS employment_allowance,
      COUNT(DISTINCT p.employee_id) AS employee_count,
      COUNT(DISTINCT r.id) AS run_count
    FROM payroll_runs r
    LEFT JOIN payslips p ON p.payroll_run_id = r.id
    WHERE r.tax_year = ? AND r.status = 'FINALISED'`,
    [taxYear, taxYear],
  );
  const row = result.rows[0] ?? {};
  const totals: HmrcTotalsInput = {
    payePence: number(row.paye),
    employeeNiPence: number(row.employee_ni),
    employerNiPence: number(row.employer_ni),
    studentLoanPence: number(row.student_loan),
    employerPensionPence: number(row.employer_pension),
    grossPayPence: number(row.gross),
    employeeCount: number(row.employee_count),
    runCount: number(row.run_count),
  };
  return buildHmrcSummary(
    taxYear,
    totals,
    number(row.employment_allowance),
  );
}

export async function listTaxYears(): Promise<string[]> {
  const db = getDb();
  const result = await db.execute(
    'SELECT DISTINCT tax_year FROM payroll_runs ORDER BY tax_year DESC',
  );
  return result.rows.map((row) => text(row.tax_year));
}

export async function getLastPayslipForEmployee(
  employeeId: string,
): Promise<Payslip | null> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM payslips WHERE employee_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [employeeId],
  );
  const row = result.rows[0];
  return row ? rowToPayslip(row) : null;
}
