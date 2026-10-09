import {
  ApiBoundaryError,
  parseApiError,
  parseApiErrorText,
} from '@/lib/apiError';

describe('API error contract', () => {
  it('parses the stable nested boundary shape', () => {
    expect(
      parseApiError(
        {
          error: {
            code: 'rate_limited',
            message: 'Try later',
            retry_after: 30,
          },
        },
        'Fallback'
      )
    ).toEqual({
      code: 'rate_limited',
      message: 'Try later',
      retryAfterSeconds: 30,
    });
  });

  it('keeps rolling-deployment compatibility with string errors', () => {
    expect(
      parseApiErrorText('{"error":"Legacy failure"}', 'Fallback')
    ).toEqual({ code: 'internal_error', message: 'Legacy failure' });
  });

  it('preserves machine-readable codes on thrown boundary errors', () => {
    const error = new ApiBoundaryError(
      { code: 'invalid_transition', message: 'Already completed' },
      409
    );

    expect(error.message).toBe('Already completed');
    expect(error.code).toBe('invalid_transition');
    expect(error.status).toBe(409);
  });
});
