# UK Small Business HRM

A simple **mobile** HR and payroll app for small UK businesses, built for iOS and
Android. It stores employee records on the device, calculates pay from an hourly
rate, works out PAYE tax, National Insurance, pension and student loan deductions,
shows what the company owes HMRC, and lets an admin update tax/NI rates when they
change.

> **Status:** working Android MVP. Core employee records, payroll runs, payslips,
> HMRC liability reports, effective-dated rates and holiday tracking are
> implemented and tested on a physical tablet. Payslips can be printed or saved
> as PDF through Android's print dialog. Biometrics, CSV export and encrypted
> backup are **not** implemented yet.
>
> **Important:** this is a payroll *calculator*, not HMRC-recognised payroll software.
> It does not submit RTI (FPS/EPS) to HMRC. Figures must be checked before paying
> staff or filing. See [Compliance](#compliance-and-safety).

---

## 1. Scope

### In scope (MVP)

- Single **admin** protected by a device PIN and biometric unlock (Face ID /
  fingerprint). No server or cloud account required.
- **Employee records**: personal details, NI number, tax code, NI category, pay
  frequency, hourly rate, pension status, student loan plan, holiday entitlement.
- **Payroll runs** for weekly or monthly pay periods:
  - enter hours worked per employee (plus optional bonus/overtime)
  - calculate gross pay, PAYE, employee NI, employer NI, pension, student loan
  - calculate net pay and employer costs
  - produce a payslip per employee
- **HMRC liability report** per period: PAYE + employee NI + employer NI +
  student loan, less Employment Allowance where applicable.
- **Rates admin panel**: effective-dated tax bands, NI thresholds/rates, pension
  thresholds, student loan thresholds, statutory holiday rate.
- **Holiday balance** tracking for hourly staff (accrued vs booked vs taken vs
  remaining), with leave booked by date range.
- **Audit trail** of rate changes and finalised payroll runs.

### Out of scope (for now)

- RTI/FPS/EPS submission to HMRC, P45/P60/P11D generation.
- Employee self-service login.
- Benefits in kind, salary sacrifice, directors' NI annual earnings period.
- Scottish/Welsh income tax (data model will allow it; MVP calculates
  England/Wales/NI bands).
- Multi-company / multi-employer.
- Bank payments, timesheet imports, rota, leave approval workflow.

---

## 2. Tech stack

Bare **React Native** with the Community CLI — **no Expo**.

| Layer | Choice | Why |
|---|---|---|
| App framework | **React Native (bare CLI) + TypeScript** | Native iOS/Android app with full control over native modules |
| Bundler | **Metro** | React Native's default bundler |
| Navigation | **React Navigation** (native stack + bottom tabs) | Standard RN navigation |
| Database | **SQLite via `@op-engineering/op-sqlite`** with a typed repository layer and plain SQL | On-device SQL without an ORM/codegen step; easy to inspect and migrate |
| Styling | **Custom React Native components + theme** | Small, consistent UI without a component-library dependency |
| Auth / lock | **PIN hashed with PBKDF2-SHA256 (`@noble/hashes`)** | Pure-JS, Metro-safe hashing; no Node `crypto` dependency |
| Money maths | **integer pence + decimal.js** | Avoid floating-point errors in payroll |
| Files | *planned:* `react-native-fs` + `react-native-share` | CSV export and encrypted backup/restore |
| PDF / print | **Android `PrintManager` + off-screen `WebView`** (small app-local native module) | Uses the system print dialog, which also saves A4 PDFs; no extra dependency |
| Tests | **Jest + React Native Testing Library** | Payroll-engine unit tests and component tests |
| Build | **Gradle (Android) / Xcode (iOS)** | Standard native builds, no Expo/EAS |

Scaffold with the Community CLI:

```bash
npx @react-native-community/cli init HrmApp
cd HrmApp
npx react-native start          # Metro
npx react-native run-android    # or: npx react-native run-ios
```

Android needs Android Studio + SDK; iOS builds need macOS + Xcode. Metro is
configured through `metro.config.js` (extend it only when adding asset/SVG support).

### 2.1 Mobile architecture

```
┌─────────────────────────────────────────────┐
│  React Native app (iOS / Android)           │
│                                             │
│  Screens (React Navigation)                 │
│        │                                    │
│  Repositories (plain SQL + op-sqlite)       │
│        │                                    │
│  Payroll engine (pure TypeScript)           │
│        │                                    │
│  On-device SQLite  ──►  encrypted backup    │
└─────────────────────────────────────────────┘
```

- **Offline-first.** Everything works with no signal. No login server, no monthly
  hosting.
- **Layered.** Screens never do payroll maths directly; they call repositories,
  which call the pure engine. The engine stays testable and reusable if a backend
  is added later.
- **Single-device risk.** Data lives on one phone. Ship **encrypted backup +
  restore** (export to Files/iCloud/Google Drive) before real payroll use.
- **Phase 2 (optional).** Add a sync backend (API + Postgres); the same engine can
  run server-side for multiple devices and web access.
- **App lock.** PIN hashed with PBKDF2-SHA256 (1,000 salted iterations — pure-JS
  hashing on older Android hardware is slow) and stored in the app's private
  SQLite database; auto-lock after 5 minutes in the background. Biometrics are
  planned but not enabled yet.
- **Encryption.** Enable **SQLCipher** on the op-sqlite database so the whole DB is
  encrypted at rest. Encrypt NI numbers at field level with AES-256-GCM
  (`react-native-quick-crypto`), key held in Keychain/Keystore.
- **Notifications.** Local notifications for payday and "new tax year — review
  rates" (`@notifee/react-native`).

---

## 3. Data model

All data lives in the **on-device SQLite** database. Money is stored as **integer
pence**; rates are stored as decimal strings (e.g. `"0.08"`) to avoid float drift.

### `admin_profile` (single local admin)
| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| name | string | |
| email | string? | optional, for backup/contact |
| pin_hash | string | PBKDF2-SHA256 hash of the device PIN |
| biometric_enabled | boolean | Face ID / fingerprint unlock |
| created_at | datetime | |

### `employees`
| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| first_name, last_name | string | |
| email, phone | string? | |
| address_line1/2, city, postcode | string? | |
| date_of_birth | date? | |
| ni_number | string? | encrypted at rest where possible |
| start_date | date | |
| end_date | date? | |
| job_title | string? | |
| department | string? | |
| **hourly_rate_pence** | integer | the hourly salary column |
| pay_frequency | enum | `WEEKLY`, `MONTHLY` |
| tax_code | string | e.g. `1257L`, `BR`, `D0`, `0T` |
| tax_basis | enum | `CUMULATIVE`, `WEEK1_MONTH1` |
| ni_category | string | `A`, `B`, `C`, `H`, `J`, `M`, `Z` |
| region | enum | `ENGLAND_WALES_NI`, `SCOTLAND` |
| student_loan_plan | enum? | `PLAN_1`, `PLAN_2`, `PLAN_4`, `PLAN_5`, `POSTGRAD` |
| pension_enrolled | boolean | |
| pension_employee_pct | decimal | default 5% |
| pension_employer_pct | decimal | default 3% |
| pension_scheme_type | enum | `NET_PAY`, `RELIEF_AT_SOURCE` |
| holiday_entitlement_days | decimal? | default 28 pro-rata |
| holiday_accrual_method | enum | `PERCENT_12_07` |
| is_director | boolean | reserved; not used in MVP NI |
| active | boolean | |

### `rate_sets`
Effective-dated bundle of every rate the engine needs. Payroll runs **snapshot**
the rate set they used, so history never changes when rates are edited.

| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| name | string | e.g. "2026/27" |
| effective_from | date | 6 April |
| effective_to | date? | null = current |
| status | enum | `DRAFT`, `ACTIVE`, `ARCHIVED` |
| created_at, created_by | | audit |

Child tables (all keyed to `rate_set_id`):

- `tax_bands` — `region`, `band_order`, `lower_pence`, `upper_pence`, `rate`
- `personal_allowance` — `amount_pence`, `taper_threshold_pence`, `taper_rate`
- `ni_thresholds` — `category`, `primary_threshold`, `upper_earnings_limit`,
  `secondary_threshold`, `employee_main_rate`, `employee_upper_rate`,
  `employer_rate`
- `pension_rules` — `qualifying_lower_pence`, `qualifying_upper_pence`,
  `min_employee_pct`, `min_employer_pct`, `min_total_pct`
- `student_loan_rules` — `plan`, `annual_threshold_pence`, `rate`
- `statutory_rates` — `holiday_accrual_pct` (12.07%), `employment_allowance_pence`

### `payroll_runs`
| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| period_start, period_end | date | |
| pay_date | date | |
| frequency | enum | must match employees included |
| rate_set_id | string | snapshot reference |
| status | enum | `DRAFT`, `FINALISED` |
| tax_year | string | e.g. `2026/27` |
| created_by, finalised_at | | |

### `payslips`
| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| payroll_run_id, employee_id | string | |
| hours_worked | decimal | |
| hourly_rate_pence | integer | copied from employee at run time |
| bonus_pence | integer | optional |
| gross_pay_pence | integer | |
| taxable_pay_pence | integer | gross minus net-pay pension |
| paye_pence | integer | |
| employee_ni_pence | integer | |
| employer_ni_pence | integer | |
| pension_employee_pence | integer | |
| pension_employer_pence | integer | |
| student_loan_pence | integer | |
| holiday_pay_pence | integer | if paid in this period |
| net_pay_pence | integer | |
| tax_code_used, ni_category_used | string | snapshot |
| calc_breakdown_json | JSON | band-by-band audit detail |
| ytd_json | JSON | year-to-date totals at this run |

### `holiday_ledger`
| Column | Type | Notes |
|---|---|---|
| id | string | cuid |
| employee_id | string | |
| entry_date | date | |
| type | enum | `ACCRUAL`, `TAKEN`, `PAID`, `ADJUSTMENT` |
| hours | decimal | |
| note | string? | |
| payslip_id | string? | link when paid |

### `audit_log`
`id`, `actor_user_id`, `action`, `entity`, `entity_id`, `before_json`,
`after_json`, `created_at`.

---

## 4. Payroll engine

Pure TypeScript module (`src/payroll/`) with no UI or database dependencies so it
can be unit-tested exhaustively. Every function takes a rate set as an argument.

Order of operations for one payslip:

1. Gross pay from hours, holiday hours and bonus.
2. Pension on qualifying earnings (calculated from gross).
3. Taxable pay = gross − employee pension (net-pay scheme only).
4. PAYE on taxable pay.
5. Employee and employer NI on gross.
6. Student loan on gross.
7. Net pay = gross − PAYE − employee NI − employee pension − student loan.
8. Employer cost = gross + employer NI + employer pension.

### 4.1 Gross pay

```
gross = (hours_worked × hourly_rate) + bonus + holiday_pay_paid
```

- Money rounded to the nearest penny at each published step.
- Overtime is treated as extra hours at the employee's rate for MVP.

### 4.2 PAYE income tax

Cumulative basis (normal case):

1. `taxable_pay_to_date = YTD taxable pay + this period's taxable pay`
2. `allowance_to_date = annual allowance × periods_elapsed / periods_in_year`
3. `taxable_to_date = max(0, taxable_pay_to_date − allowance_to_date)`
4. Apply bands to `taxable_to_date` → `tax_due_to_date`
5. `paye_this_period = tax_due_to_date − YTD tax paid`

`WEEK1_MONTH1` codes tax each period in isolation (no YTD). `BR` = 20% flat,
`D0` = 40% flat, `0T` = no allowance. K-codes are supported.

Personal allowance taper: for adjusted net income above £100,000, allowance reduces
by £1 for every £2 above the threshold.

**Scotland:** the engine accepts a region and a band table, so Scottish bands can be
added by data alone. MVP ships England/Wales/NI bands and flags Scottish employees
as "not yet supported" rather than silently using the wrong rates.

### 4.3 National Insurance (Class 1)

Calculated **per pay period**, independently — never cumulative.

Employee (category A):
```
main = 8% × earnings between primary threshold and upper earnings limit
upper = 2% × earnings above upper earnings limit
```
Employer:
```
15% × earnings above secondary threshold
```
Per-period thresholds are the annual figures divided by the number of pay periods,
using HMRC's published per-period tables to avoid rounding drift.

Category B/C/H/J/M/Z rate variants live in `ni_thresholds`; MVP can start with A and
add others as data. Directors (annual earnings period) are out of scope.

Employment Allowance (up to £10,500/year) is applied at the **run** level against
employer NI, not on individual payslips, and only if the company is eligible (not a
single-director company). The remaining allowance is tracked across finalised runs
for the tax year and is stored once per run, so multi-employee runs do not multiply it.

### 4.4 Pension (auto-enrolment)

- Qualifying earnings between the lower and upper pension thresholds.
- Employee minimum 5%, employer minimum 3% (8% total) on qualifying earnings.
- `NET_PAY`: employee contribution deducted before tax → reduces taxable pay, and
  reduces NI only if salary sacrifice (not modelled).
- `RELIEF_AT_SOURCE`: deduction taken from net pay; provider claims basic-rate relief.
- Employees outside qualifying earnings or not enrolled → zero.

### 4.5 Student loans

Per pay period, like NI:
```
deduction = rate × max(0, earnings − period_threshold)
```
Thresholds are annual figures split by pay frequency. Plans: 1, 2, 4, 5, Postgrad.
Postgraduate loans stack on top of an undergraduate plan.

### 4.6 Holiday pay

Hourly staff accrue **12.07%** of hours worked (5.6 weeks ÷ 46.4 working weeks).

- Each payroll run adds an `ACCRUAL` entry to `holiday_ledger`.
- Leave is booked by date range (`BOOKED`), deducting the balance immediately.
  Weekends are not counted; hours = working days × hours per day.
- When payroll pays holiday hours, booked entries are converted to `PAID` first,
  so the same leave is never deducted twice. Any unbooked hours become `TAKEN`.
- Balance = accrued − booked − paid/taken. Displayed on the employee page and
  payroll run.
- Unpaid bookings can be cancelled, returning the hours to the balance.
- Rolled-up holiday pay is configurable but off by default (rules differ for
  irregular-hours workers).

### 4.7 Net pay and employer cost

```
net_pay = gross
        − PAYE
        − employee NI
        − employee pension (net-pay schemes reduce taxable pay first)
        − student loan

employer_cost = gross
              + employer NI
              + employer pension
```

### 4.8 Rounding rules

- Store pence; round half-up at each published step.
- NI and student loans use per-period threshold tables, not annual/12, to match
  HMRC.
- Never recalculate a finalised payslip from live rates — always use its snapshot.

---

## 5. Rates admin panel

The requirement "what if the rate changes?" is handled by **versioned, effective-dated
rate sets**.

- Admin sees the active rate set and can **clone** it into a new draft.
- Edit tax bands, NI thresholds, pension thresholds, student loan thresholds,
  employment allowance, holiday percentage.
- **Validation before activation:**
  - bands contiguous and ascending, no gaps/overlaps
  - NI thresholds ordered (primary < upper, secondary valid)
  - percentages within sane bounds
  - effective date does not overlap another active set
- **Preview impact:** show what a sample £12/hr and £20/hr employee would pay
  under the draft vs current rates.
- **Activate** sets `effective_from`; the engine picks the rate set matching the pay
  date.
- A rate set referenced by a finalised run can never be edited — only archived.
- Every change writes to `audit_log` with before/after values.

Defaults shipped for the current tax year (2026/27, frozen thresholds):

| Item | Value |
|---|---|
| Personal allowance | £12,570 |
| Basic rate | 20% to £50,270 |
| Higher rate | 40% to £125,140 |
| Additional rate | 45% above |
| NI employee | 8% / 2% above £50,270 |
| NI employer | 15% above £5,000 |
| Employment Allowance | £10,500 |
| Pension qualifying earnings | £6,240 – £50,270 |
| Student loan Plan 1 / 2 / 4 / 5 / PG | £26,065 / £28,470 / £32,745 / £25,000 / £21,000 |
| Holiday accrual | 12.07% |

> These are seeded values, editable in the admin panel. Always confirm against
> gov.uk before a live run.

---

## 6. Screens

Navigation: **bottom tabs** (Dashboard, Employees, Payroll, Reports, Settings) with
stack screens for employee detail, the payroll wizard, payslips, rates admin and the
holiday ledger.

1. **App unlock** — device PIN, with Face ID / fingerprint when enabled.
2. **Dashboard** — headcount, next pay date, current rate set, holiday balances
   needing attention, last run's HMRC liability.
3. **Employees**
   - list with search/filter, hourly rate, tax code, NI category, status
   - detail/edit form grouped into Personal, Employment, Payroll, Pension, Holiday
   - hourly rate is required and must be above £0.00; new employees default to
     Week 1 / Month 1 until a P45 or previous pay details are available
   - hourly rate field with effective-date history (rate changes are audited)
4. **Payroll runs**
   - list of draft/finalised runs
   - new run wizard: pick period + frequency → enter hours/bonus/holiday taken per
     employee → live preview → finalise
   - run detail: per-employee breakdown, totals, employer cost
   - void a mistaken run: removes the run, its payslips and the holiday hours it
     added, and records the void in the audit log
   - payslip view + print / save as PDF
5. **HMRC liability** — per run: PAYE, employee NI, employer NI, student loans,
   employment allowance, total due, payment reference and due date (22nd by
   electronic payment).
6. **Holiday** — book leave by date range, per-employee balances and ledger,
   cancel unpaid bookings, manual adjustment.
7. **Rates admin** — active set, draft editor, validation, preview, activation
   history.
8. **Settings** — company name, PAYE reference, accounts office reference, pay
   frequencies, employment allowance eligibility.

---

## 7. Worked examples (step by step)

All figures below use the seeded 2026/27 rates. Per-period thresholds are the
annual figures divided by the number of pay periods and rounded to the nearest
pound, which gives the weekly values used here.

### 7.1 Weekly, cumulative tax, with pension

Employee: £15.00/hour, 40 hours, weekly pay (week 1 of 52), tax code `1257L`
(cumulative), NI category A, England, pension 5% employee / 3% employer,
no student loan.

**1. Gross pay**
```
basic   = 40 × £15.00                            = £600.00
bonus   = £0.00
holiday = £0.00
gross   = £600.00
```

**2. Pension** — qualifying earnings between £120.00 and £967.00 per week
```
qualifying    = £600.00 − £120.00                = £480.00
employee 5%   = £480.00 × 5%                     = £24.00
employer 3%   = £480.00 × 3%                     = £14.40
```

**3. Taxable pay** — net-pay pension reduces taxable pay
```
taxable = £600.00 − £24.00                       = £576.00
```

**4. PAYE** — cumulative, so the allowance is pro-rated to the week
```
allowance to date = £12,570 × 1/52               = £241.73
taxable to date   = £576.00 − £241.73            = £334.27
tax               = £334.27 × 20%                = £66.85
```

**5. National Insurance** — per week, category A
```
primary threshold (PT)   = £12,570 ÷ 52          = £242.00
upper earnings limit     = £50,270 ÷ 52          = £967.00
secondary threshold (ST) = £5,000 ÷ 52           = £96.00

employee main  = (£600.00 − £242.00) × 8%        = £28.64
employee upper = £0.00                           = £0.00
employer       = (£600.00 − £96.00) × 15%        = £75.60
```

**6. Net pay and employer cost**
```
net           = £600.00 − £66.85 − £28.64 − £24.00 = £480.51
employer cost = £600.00 + £75.60 + £14.40          = £690.00
```

**7. Holiday accrual**
```
accrued = 40h × 12.07% = 4.83h
```

### 7.2 Weekly, Week 1 / Month 1, with bonus

Employee: £12.00/hour, 30 hours, £15.00 bonus, weekly pay (week 30 of 52),
tax code `1257L` on a Week 1 / Month 1 basis, NI category A, no pension or
student loan.

```
gross           = 30 × £12.00 + £15.00           = £375.00
taxable         = £375.00
allowance       = £12,570 ÷ 52                   = £241.73
taxable         = £375.00 − £241.73              = £133.27
PAYE            = £133.27 × 20%                  = £26.65
employee NI     = (£375.00 − £242.00) × 8%       = £10.64
employer NI     = (£375.00 − £96.00) × 15%       = £41.85
net             = £375.00 − £26.65 − £10.64      = £337.71
employer cost   = £375.00 + £41.85               = £416.85
holiday accrued = 30h × 12.07%                   = 3.62h
```

Week 1 / Month 1 applies the allowance and bands to this period alone
(`annual ÷ periods`) with no year-to-date figures, so the result does not depend
on earlier pay in the tax year. A bonus is taxable and NIable but does not
accrue holiday — only hours worked do.

### 7.3 Student loan, if present

Plan 2, weekly, gross £600.00:
```
threshold = £28,470 ÷ 52                         = £547.50
deduction = (£600.00 − £547.50) × 9%             = £4.73
```

The student loan deduction is taken after tax and NI, and does not reduce
taxable pay. Postgraduate loans stack on top of Plan 1/2/4/5.

### 7.4 Rounding

- Each step is rounded to the nearest penny, half-up.
- NI and student loan thresholds are rounded to whole pounds per period, not
  annual ÷ periods to the penny, to match HMRC tables.
- These figures match the automated payroll engine tests (`src/payroll/__tests__`).

---

## 8. Milestones

| # | Deliverable | Done when |
|---|---|---|
| 0 | Plan (this document) | README agreed |
| 1 | Scaffold + app lock + SQLite schema | `npx react-native run-android`/`run-ios` opens the app; admin can set a PIN and unlock |
| 2 | Employee CRUD | create/edit/list employees incl. hourly rate |
| 3 | Rates admin + seed data | clone/edit/validate/activate a rate set, audited |
| 4 | Payroll engine + tests | Jest tests pass for PAYE, NI, pension, student loan, holiday |
| 5 | Payroll run UI + payslips | enter hours, preview, finalise, print or save payslip PDF |
| 6 | HMRC liability + holiday ledger | report totals reconcile to payslips |
| 7 | CSV export, encrypted backup/restore, polish | usable end-to-end demo with restorable data |

---

## 9. Compliance and safety

- **Not certified payroll software.** No RTI submission. Output is an estimate.
- Payroll records must be kept **3 years** after the tax year they relate to;
  pension records longer. Add export/backup before any real use.
- Employee data is personal data under **UK GDPR** — encrypt the database
  (SQLCipher) and NI numbers, lock the app, log admin actions, support
  deletion/export requests.
- **Device loss is the main risk.** Require an encrypted backup before first real
  use, document how to restore on a new phone, and keep the PIN separate from the
  backup file.
- Check **National Minimum Wage** against the configured hourly rate before
  finalising a run (warning, not a hard block).
- Tax/NI rules change at Budgets. The rates panel exists precisely so the app does
  not hard-code them; still verify against gov.uk each April.
- Take professional advice before using output for real payments or HMRC filings.

---

## 10. Open questions

1. **Platform:** iOS, Android, or both at launch? (iOS builds need a Mac + Xcode.)
2. **Distribution:** direct Android APK / internal testing first, or Play Store and
   App Store from day one?
3. Should payroll runs support **both** weekly and monthly in the same company, or
   one frequency per company?
4. Do you need **payslip PDF** or is the on-screen payslip plus CSV enough for MVP?
5. Is **Scottish income tax** needed at launch?
6. Do you want **holiday pay rolled up** into hourly pay, or paid only when leave
   is taken?
7. Do you want **cloud sync** later (multiple devices / web), or is single-device
   with backup enough?
