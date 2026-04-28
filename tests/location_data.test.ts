import { findConcourse, getLocationRoute } from '@/lib';

describe('location data', () => {
  it('keeps MSP Concourse F on the same URL while using massage-only intake', () => {
    const concourse = findConcourse('minneapolis', 'concourse-f');

    expect(concourse?.name).toBe('concourse-f');
    expect(concourse?.slug).toBe('concourse-f');
    expect(concourse?.locationInfo.intakeCategory).toBe('massage_only');
    expect(getLocationRoute('minneapolis', 'concourse-f')).toBe(
      '/locations/minneapolis/concourse-f'
    );
  });
});
