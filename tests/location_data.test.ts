import { findConcourse, getLocationRoute } from '@/lib';

describe('location data', () => {
  it('keeps MSP Concourse C on standard intake without the massage category', () => {
    const concourse = findConcourse('minneapolis', 'concourse-c');

    expect(concourse?.name).toBe('concourse-c');
    expect(concourse?.slug).toBe('concourse-c');
    expect(concourse?.locationInfo.intakeCategory).toBe('standard');
    expect(getLocationRoute('minneapolis', 'concourse-c')).toBe(
      '/locations/minneapolis/concourse-c'
    );
  });

  it('keeps MSP Massage Lounge on C as massage-only intake', () => {
    const concourse = findConcourse('minneapolis', 'massage-lounge-on-c');

    expect(concourse?.name).toBe('massage-lounge-on-c');
    expect(concourse?.slug).toBe('massage-lounge-on-c');
    expect(concourse?.locationInfo.intakeCategory).toBe('massage_only');
    expect(getLocationRoute('minneapolis', 'massage-lounge-on-c')).toBe(
      '/locations/minneapolis/massage-lounge-on-c'
    );
  });

  it('renames MSP Concourse F while keeping the same URL and massage-only intake', () => {
    const concourse = findConcourse('minneapolis', 'concourse-f');

    expect(concourse?.name).toBe('concourse-f');
    expect(concourse?.slug).toBe('concourse-f');
    expect(concourse?.displayName).toBe('Massage Lounge on F');
    expect(concourse?.locationInfo.displayName).toBe('Massage Lounge on F');
    expect(concourse?.locationInfo.intakeCategory).toBe('massage_only');
    expect(getLocationRoute('minneapolis', 'concourse-f')).toBe(
      '/locations/minneapolis/concourse-f'
    );
  });
});
