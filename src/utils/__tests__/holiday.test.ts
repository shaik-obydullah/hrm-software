import { countWorkingDays, validateHolidayBooking } from '../holiday';

function booking(overrides: Partial<Parameters<typeof validateHolidayBooking>[0]> = {}) {
  return validateHolidayBooking({
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    hoursPerDay: '7.5',
    ...overrides,
  });
}

describe('countWorkingDays', () => {
  it('counts Monday to Friday inclusive', () => {
    expect(countWorkingDays('2026-11-02', '2026-11-06')).toBe(5);
  });

  it('counts a single weekday', () => {
    expect(countWorkingDays('2026-11-03', '2026-11-03')).toBe(1);
  });

  it('skips weekends', () => {
    expect(countWorkingDays('2026-10-31', '2026-11-01')).toBe(0);
    expect(countWorkingDays('2026-11-06', '2026-11-09')).toBe(2);
  });

  it('counts a full week as five days', () => {
    expect(countWorkingDays('2026-11-02', '2026-11-08')).toBe(5);
  });

  it('spans month and year boundaries', () => {
    expect(countWorkingDays('2026-12-28', '2027-01-01')).toBe(5);
  });

  it('returns zero for reversed dates', () => {
    expect(countWorkingDays('2026-11-06', '2026-11-02')).toBe(0);
  });
});

describe('validateHolidayBooking', () => {
  it('calculates hours from working days', () => {
    const result = booking();
    expect(result.errors).toEqual({});
    expect(result.workingDays).toBe(5);
    expect(result.hours).toBe(37.5);
  });

  it('treats a blank end date as a single day', () => {
    const result = booking({ endDate: '' });
    expect(result.workingDays).toBe(1);
    expect(result.hours).toBe(7.5);
  });

  it('requires a valid start date', () => {
    expect(booking({ startDate: '' }).errors.startDate).toBeDefined();
    expect(booking({ startDate: '02/11/2026' }).errors.startDate).toBeDefined();
  });

  it('rejects an end date before the start date', () => {
    expect(booking({ endDate: '2026-10-30' }).errors.endDate).toBeDefined();
  });

  it('rejects ranges with no working days', () => {
    const result = booking({ startDate: '2026-10-31', endDate: '2026-11-01' });
    expect(result.errors.endDate).toBeDefined();
    expect(result.workingDays).toBe(0);
  });

  it('rejects invalid hours per day', () => {
    expect(booking({ hoursPerDay: '' }).errors.hoursPerDay).toBeDefined();
    expect(booking({ hoursPerDay: '0' }).errors.hoursPerDay).toBeDefined();
    expect(booking({ hoursPerDay: '-7.5' }).errors.hoursPerDay).toBeDefined();
    expect(booking({ hoursPerDay: '25' }).errors.hoursPerDay).toBeDefined();
  });

  it('accepts a half day', () => {
    const result = booking({ startDate: '2026-11-03', endDate: '', hoursPerDay: '3.75' });
    expect(result.errors).toEqual({});
    expect(result.hours).toBe(3.75);
  });
});
