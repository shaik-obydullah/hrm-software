import { buildPayslipHtml } from '../payslipHtml';

const base = {
  companyName: 'My Company',
  taxYear: '2026/27',
  employeeName: 'Jhon Doe',
  niNumber: 'QQ123456C',
  taxCode: '1257L',
  niCategory: 'A',
  payDate: '5 Nov 2026',
  period: '2 Nov 2026 → 8 Nov 2026',
  taxPeriod: '31 of 52',
  basicLabel: 'Basic pay (7.5h × £12.00)',
  basicPence: 9000,
  holidayHours: 0,
  holidayPence: 0,
  bonusPence: 0,
  grossPence: 9000,
  payePence: 0,
  employeeNiPence: 0,
  employeePensionPence: 0,
  studentLoanPence: 0,
  totalDeductionsPence: 0,
  netPence: 9000,
  employerNiPence: 0,
  employerPensionPence: 0,
  employerCostPence: 9000,
  holidayAccruedHours: 0.9,
  generatedOn: '30 Oct 2026',
};

describe('buildPayslipHtml', () => {
  it('includes the key pay figures', () => {
    const html = buildPayslipHtml(base);
    expect(html).toContain('Jhon Doe');
    expect(html).toContain('£90.00');
    expect(html).toContain('1257L');
    expect(html).toContain('2 Nov 2026 → 8 Nov 2026');
    expect(html).toContain('2026/27');
  });

  it('adds holiday and bonus rows only when they exist', () => {
    expect(buildPayslipHtml(base)).not.toContain('Holiday pay');
    const withExtras = buildPayslipHtml({
      ...base,
      holidayHours: 7.5,
      holidayPence: 9000,
      bonusPence: 5000,
      grossPence: 23000,
      netPence: 23000,
      employerCostPence: 23000,
    });
    expect(withExtras).toContain('Holiday pay (7.5h)');
    expect(withExtras).toContain('Bonus / overtime');
  });

  it('escapes user-supplied text', () => {
    const html = buildPayslipHtml({
      ...base,
      companyName: 'Smith & Sons <Ltd>',
      employeeName: 'A "quote" O\'Brien',
    });
    expect(html).toContain('Smith &amp; Sons &lt;Ltd&gt;');
    expect(html).toContain('A &quot;quote&quot; O&#39;Brien');
    expect(html).not.toContain('<Ltd>');
  });

  it('shows the tax code warning when present', () => {
    const html = buildPayslipHtml({
      ...base,
      warning: 'Tax code 1257L is on a week 1 basis.',
    });
    expect(html).toContain('week 1 basis');
  });
});
