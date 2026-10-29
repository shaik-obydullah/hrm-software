import { validateEmployeeForm } from '../employeeValidation';

function validInput() {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    hourlyRate: '12.50',
    startDate: '2026-04-06',
    endDate: '',
    dateOfBirth: '',
    employeePct: '5',
    employerPct: '3',
    holidayDays: '28',
  };
}

describe('employee form validation', () => {
  it('accepts a valid employee', () => {
    expect(validateEmployeeForm(validInput())).toEqual({});
  });

  it('requires an hourly rate above zero', () => {
    expect(validateEmployeeForm({ ...validInput(), hourlyRate: '' })).toHaveProperty(
      'hourlyRate',
    );
    expect(validateEmployeeForm({ ...validInput(), hourlyRate: '0' })).toHaveProperty(
      'hourlyRate',
    );
    expect(validateEmployeeForm({ ...validInput(), hourlyRate: '0.00' })).toHaveProperty(
      'hourlyRate',
    );
    expect(validateEmployeeForm({ ...validInput(), hourlyRate: '-1' })).toHaveProperty(
      'hourlyRate',
    );
    expect(validateEmployeeForm({ ...validInput(), hourlyRate: 'abc' })).toHaveProperty(
      'hourlyRate',
    );
  });

  it('accepts a formatted hourly rate', () => {
    expect(
      validateEmployeeForm({ ...validInput(), hourlyRate: '£1,234.56' }),
    ).toEqual({});
  });

  it('validates names and dates', () => {
    const errors = validateEmployeeForm({
      ...validInput(),
      firstName: ' ',
      lastName: '',
      startDate: '06/04/2026',
    });
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.startDate).toBeDefined();
  });
});
