import { formatHours, formatMoney } from '../payroll/money';

export interface PayslipPrintData {
  companyName: string;
  taxYear: string;
  employeeName: string;
  niNumber: string;
  taxCode: string;
  niCategory: string;
  payDate: string;
  period: string;
  taxPeriod?: string;
  basicLabel: string;
  basicPence: number;
  holidayHours: number;
  holidayPence: number;
  bonusPence: number;
  grossPence: number;
  payePence: number;
  employeeNiPence: number;
  employeePensionPence: number;
  studentLoanPence: number;
  totalDeductionsPence: number;
  netPence: number;
  employerNiPence: number;
  employerPensionPence: number;
  employerCostPence: number;
  holidayAccruedHours: number;
  warning?: string;
  generatedOn: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string, strong = false): string {
  return `<tr${strong ? ' class="strong"' : ''}><td>${escapeHtml(
    label,
  )}</td><td class="amount">${escapeHtml(value)}</td></tr>`;
}

/**
 * Builds a self-contained A4 payslip. Kept free of React so it can be tested
 * and printed by the native module without a rendered screen.
 */
export function buildPayslipHtml(data: PayslipPrintData): string {
  const earnings = [
    row(data.basicLabel, formatMoney(data.basicPence)),
    data.holidayPence > 0
      ? row(
          `Holiday pay (${formatHours(data.holidayHours)})`,
          formatMoney(data.holidayPence),
        )
      : '',
    data.bonusPence > 0
      ? row('Bonus / overtime', formatMoney(data.bonusPence))
      : '',
    row('Gross pay', formatMoney(data.grossPence), true),
  ].join('');

  const deductions = [
    row('PAYE income tax', formatMoney(data.payePence)),
    row('Employee NI', formatMoney(data.employeeNiPence)),
    data.employeePensionPence > 0
      ? row('Pension (employee)', formatMoney(data.employeePensionPence))
      : '',
    data.studentLoanPence > 0
      ? row('Student loan', formatMoney(data.studentLoanPence))
      : '',
    row('Total deductions', formatMoney(data.totalDeductionsPence), true),
    row('Net pay', formatMoney(data.netPence), true),
  ].join('');

  const details = [
    row('NI number', data.niNumber || '—'),
    row('Tax code', data.taxCode),
    row('NI category', data.niCategory),
    row('Pay date', data.payDate),
    row('Pay period', data.period),
    data.taxPeriod ? row('Tax period', data.taxPeriod) : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Payslip ${escapeHtml(data.employeeName)} ${escapeHtml(data.payDate)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1f2933;
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #0f766e;
    padding-bottom: 10px;
  }
  .company { font-size: 18px; font-weight: 800; margin: 0; }
  .title {
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #52606d;
    margin: 3px 0 0;
    font-weight: 700;
  }
  .tax-year { font-size: 12px; font-weight: 700; color: #0f766e; }
  .employee { font-size: 15px; font-weight: 700; margin: 16px 0 2px; }
  .section { margin-top: 16px; }
  .section h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #52606d;
    margin: 0 0 6px;
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px solid #e4e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td.amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.strong td { font-weight: 700; }
  .note {
    margin-top: 18px;
    padding: 8px 10px;
    border: 1px solid #f0b429;
    background: #fffaeb;
    color: #8d2b0b;
    border-radius: 4px;
    font-size: 11px;
  }
  .footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e4e7eb;
    font-size: 10px;
    color: #7b8794;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <p class="company">${escapeHtml(data.companyName || 'My Company')}</p>
      <p class="title">Payslip</p>
    </div>
    <div class="tax-year">${escapeHtml(data.taxYear)}</div>
  </div>

  <p class="employee">${escapeHtml(data.employeeName)}</p>

  <div class="section">
    <h2>Employee details</h2>
    <table>${details}</table>
  </div>

  <div class="section">
    <h2>Earnings</h2>
    <table>${earnings}</table>
  </div>

  <div class="section">
    <h2>Deductions</h2>
    <table>${deductions}</table>
  </div>

  <div class="section">
    <h2>Employer costs (not deducted from pay)</h2>
    <table>
      ${row('Employer NI', formatMoney(data.employerNiPence))}
      ${row('Employer pension', formatMoney(data.employerPensionPence))}
      ${row('Total employer cost', formatMoney(data.employerCostPence))}
      ${row(
        'Holiday accrued this period',
        formatHours(data.holidayAccruedHours),
      )}
    </table>
  </div>

  ${data.warning ? `<div class="note">${escapeHtml(data.warning)}</div>` : ''}

  <div class="footer">
    Generated on ${escapeHtml(data.generatedOn)} by HRM Software.<br />
    Calculated locally; this is not an HMRC-recognised payroll submission.
  </div>
</body>
</html>`;
}
