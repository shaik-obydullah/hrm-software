import { open, type DB } from '@op-engineering/op-sqlite';
import {
  DEFAULT_RATES,
  DEFAULT_RATE_SET_EFFECTIVE_FROM,
  DEFAULT_RATE_SET_NAME,
} from '../payroll/defaultRates';

let database: DB | null = null;
let initialised = false;

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getDb(): DB {
  if (!database) {
    database = open({ name: 'hrm-software.db' });
  }
  return database;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    biometric_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    postcode TEXT NOT NULL DEFAULT '',
    date_of_birth TEXT NOT NULL DEFAULT '',
    ni_number TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    hourly_rate_pence INTEGER NOT NULL DEFAULT 0,
    pay_frequency TEXT NOT NULL DEFAULT 'MONTHLY',
    tax_code TEXT NOT NULL DEFAULT '1257L',
    tax_basis TEXT NOT NULL DEFAULT 'CUMULATIVE',
    ni_category TEXT NOT NULL DEFAULT 'A',
    region TEXT NOT NULL DEFAULT 'ENGLAND_WALES_NI',
    student_loan_plan TEXT NOT NULL DEFAULT 'NONE',
    pension_enrolled INTEGER NOT NULL DEFAULT 0,
    pension_employee_pct REAL NOT NULL DEFAULT 0.05,
    pension_employer_pct REAL NOT NULL DEFAULT 0.03,
    pension_scheme TEXT NOT NULL DEFAULT 'NET_PAY',
    holiday_entitlement_days REAL NOT NULL DEFAULT 28,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_sets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    pay_date TEXT NOT NULL,
    frequency TEXT NOT NULL,
    rate_set_id TEXT NOT NULL,
    status TEXT NOT NULL,
    tax_year TEXT NOT NULL,
    employment_allowance_pence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    finalised_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY NOT NULL,
    payroll_run_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    hours_worked REAL NOT NULL DEFAULT 0,
    hourly_rate_pence INTEGER NOT NULL DEFAULT 0,
    bonus_pence INTEGER NOT NULL DEFAULT 0,
    holiday_hours REAL NOT NULL DEFAULT 0,
    holiday_pay_pence INTEGER NOT NULL DEFAULT 0,
    gross_pay_pence INTEGER NOT NULL DEFAULT 0,
    taxable_pay_pence INTEGER NOT NULL DEFAULT 0,
    paye_pence INTEGER NOT NULL DEFAULT 0,
    employee_ni_pence INTEGER NOT NULL DEFAULT 0,
    employer_ni_pence INTEGER NOT NULL DEFAULT 0,
    employee_pension_pence INTEGER NOT NULL DEFAULT 0,
    employer_pension_pence INTEGER NOT NULL DEFAULT 0,
    student_loan_pence INTEGER NOT NULL DEFAULT 0,
    net_pay_pence INTEGER NOT NULL DEFAULT 0,
    employer_cost_pence INTEGER NOT NULL DEFAULT 0,
    qualifying_earnings_pence INTEGER NOT NULL DEFAULT 0,
    holiday_accrued_hours REAL NOT NULL DEFAULT 0,
    tax_code_used TEXT NOT NULL DEFAULT '',
    ni_category_used TEXT NOT NULL DEFAULT 'A',
    breakdown_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS holiday_ledger (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    type TEXT NOT NULL,
    hours REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    payslip_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    actor TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active)`,
  `CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(payroll_run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_taxyear ON payroll_runs(tax_year)`,
  `CREATE INDEX IF NOT EXISTS idx_holiday_employee ON holiday_ledger(employee_id)`,
];

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: 'My Company',
  paye_reference: '',
  accounts_office_reference: '',
  employment_allowance_eligible: 'false',
};

async function seed(): Promise<void> {
  const db = getDb();
  const rateCount = await db.execute('SELECT COUNT(*) AS count FROM rate_sets');
  if (Number(rateCount.rows[0]?.count ?? 0) === 0) {
    await db.execute(
      `INSERT INTO rate_sets
        (id, name, effective_from, effective_to, status, data_json, created_at)
       VALUES (?, ?, ?, NULL, 'ACTIVE', ?, ?)`,
      [
        makeId('rate'),
        DEFAULT_RATE_SET_NAME,
        DEFAULT_RATE_SET_EFFECTIVE_FROM,
        JSON.stringify(DEFAULT_RATES),
        new Date().toISOString(),
      ],
    );
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.execute(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
    );
  }
}

export async function initDatabase(): Promise<void> {
  if (initialised) {
    return;
  }
  const db = getDb();
  await db.execute('PRAGMA journal_mode = WAL');
  await db.execute('PRAGMA foreign_keys = ON');
  for (const statement of SCHEMA) {
    await db.execute(statement);
  }
  await seed();
  initialised = true;
}

export async function getSetting(
  key: string,
  fallback = '',
): Promise<string> {
  const db = getDb();
  const result = await db.execute('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  return result.rows[0]?.value === undefined
    ? fallback
    : String(result.rows[0].value);
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getSettings(): Promise<Record<string, string>> {
  const db = getDb();
  const result = await db.execute('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[String(row.key)] = String(row.value);
  }
  return settings;
}

export async function logAudit(
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const db = getDb();
  await db.execute(
    `INSERT INTO audit_log
      (id, actor, action, entity, entity_id, details_json, created_at)
     VALUES (?, 'admin', ?, ?, ?, ?, ?)`,
    [
      makeId('audit'),
      action,
      entity,
      entityId,
      JSON.stringify(details),
      new Date().toISOString(),
    ],
  );
}
