import { BadRequestException } from '@nestjs/common';
import {
  validateLoanDates,
  validateLoanReturnReport,
  validateLoanTimeRange,
} from './loans.service';

describe('validateLoanDates', () => {
  it('rejects article loans that end after the start day', () => {
    expect(() =>
      validateLoanDates('2026-05-04', '2026-05-05'),
    ).toThrow(BadRequestException);
  });

  it('accepts article loans that start and end the same day', () => {
    expect(() => validateLoanDates('2026-05-04', '2026-05-04')).not.toThrow();
  });

  it('rejects due dates before the start date', () => {
    expect(() =>
      validateLoanDates('2026-05-04', '2026-05-03'),
    ).toThrow(BadRequestException);
  });
});

describe('validateLoanReturnReport', () => {
  it('accepts a normal return without note', () => {
    expect(validateLoanReturnReport({ condition: 'OK' })).toEqual({
      returnCondition: 'OK',
      returnNote: undefined,
    });
  });

  it('requires a note when the return has an issue', () => {
    expect(() =>
      validateLoanReturnReport({ condition: 'ISSUE', note: 'x' }),
    ).toThrow(BadRequestException);
  });
});

describe('validateLoanTimeRange', () => {
  it('rejects article loans longer than four hours', () => {
    expect(() => validateLoanTimeRange('08:00', '12:30')).toThrow(
      BadRequestException,
    );
  });

  it('accepts a short same-day institutional loan', () => {
    expect(validateLoanTimeRange('08:00', '10:00')).toEqual({
      startMin: 480,
      endMin: 600,
    });
  });

  it('rejects ranges without a valid end after start', () => {
    expect(() => validateLoanTimeRange('10:00', '10:00')).toThrow(
      BadRequestException,
    );
  });
});
