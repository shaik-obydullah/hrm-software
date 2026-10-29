import type { Employee } from '../../types';
import { filterEmployeesForPayRun } from '../employees';

const baseEmployee: Employee = {
  id: 'emp-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: '',
  phone: '',
  address: '',
  city: '',
  postcode: '',
  dateOfBirth: '',
  niNumber: '',
  startDate: '2026-04-06',
  endDate: '',
  jobTitle: 'Engineer',
  department: '',
  hourlyRatePence: 1500,
  payFrequency: 'WEEKLY',
  taxCode: '1257L',
  taxBasis: 'WEEK1_MONTH1',
  niCategory: 'A',
  region: 'ENGLAND_WALES_NI',
  studentLoanPlan: 'NONE',
  pensionEnrolled: false,
  pensionEmployeePct: 0.05,
  pensionEmployerPct: 0.03,
  pensionScheme: 'NET_PAY',
  holidayEntitlementDays: 28,
  active: true,
  createdAt: '2026-04-06T00:00:00.000Z',
  updatedAt: '2026-04-06T00:00:00.000Z',
};

describe('filterEmployeesForPayRun', () => {
  it('includes active employees on the right frequency', () => {
    const result = filterEmployeesForPayRun(
      [baseEmployee],
      'WEEKLY',
      '2026-11-02',
      '2026-11-08',
    );
    expect(result).toHaveLength(1);
  });

  it('skips archived employees', () => {
    const result = filterEmployeesForPayRun(
      [{ ...baseEmployee, active: false }],
      'WEEKLY',
      '2026-11-02',
      '2026-11-08',
    );
    expect(result).toHaveLength(0);
  });

  it('skips the wrong pay frequency', () => {
    const result = filterEmployeesForPayRun(
      [baseEmployee],
      'MONTHLY',
      '2026-11-01',
      '2026-11-30',
    );
    expect(result).toHaveLength(0);
  });

  it('skips employees who start after the period ends', () => {
    const result = filterEmployeesForPayRun(
      [{ ...baseEmployee, startDate: '2026-11-09' }],
      'WEEKLY',
      '2026-11-02',
      '2026-11-08',
    );
    expect(result).toHaveLength(0);
  });

  it('skips employees whose employment ended before the period', () => {
    const result = filterEmployeesForPayRun(
      [{ ...baseEmployee, endDate: '2026-11-01' }],
      'WEEKLY',
      '2026-11-02',
      '2026-11-08',
    );
    expect(result).toHaveLength(0);
  });

  it('includes employees who start or leave during the period', () => {
    const result = filterEmployeesForPayRun(
      [
        { ...baseEmployee, id: 'start', startDate: '2026-11-08' },
        { ...baseEmployee, id: 'leave', endDate: '2026-11-02' },
      ],
      'WEEKLY',
      '2026-11-02',
      '2026-11-08',
    );
    expect(result.map((employee) => employee.id)).toEqual(['start', 'leave']);
  });
});
