import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocationDetails from '@/features/location-details/LocationDetails';
import type { LocationInfo } from '@/lib';

const mockInvoke = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    functions: {
      invoke: mockInvoke,
    },
    rpc: mockRpc,
  }),
}));

const massageOnlyLocation: LocationInfo = {
  gate: 'M1',
  landmark: 'Test landmark',
  airportCode: 'TST',
  imageUrl: '/images/stores/test.webp',
  customLocation: 'Located near the test landmark.',
  customHours: '8am - 6pm',
  displayName: 'Massage Studio',
  intakeCategory: 'massage_only',
};

describe('LocationDetails massage-only intake', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockRpc.mockReset();
    window.scrollTo = jest.fn();
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    window.cancelAnimationFrame = jest.fn();
  });

  it('shows massage choices without chiropractor or Priority Pass options', () => {
    render(
      <LocationDetails
        locationInfo={massageOnlyLocation}
        airportCode="TST"
        locationCode="massage-studio"
      />
    );

    expect(screen.queryByText('Priority Pass / Lounge Key')).toBeNull();
    expect(screen.queryByText('Chiropractor')).toBeNull();
    expect(screen.queryByText(/Priority Pass or Lounge Key member/i)).toBeNull();
    expect(screen.getByText('15 Minutes')).toBeTruthy();
    expect(screen.getByText('20 Minutes')).toBeTruthy();
    expect(screen.getByText('30 Minutes')).toBeTruthy();
    expect(screen.getByText(/I consent to bodywork services/i)).toBeTruthy();
  });

  it('submits massage-only visits as paying bodywork with a massage service label', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      data: {
        queueEntryId: 'entry-1',
        publicToken: 'token-1',
        queueId: 'queue-1',
        status: 'waiting',
        createdAt: '2026-04-28T12:00:00.000Z',
        queuePosition: 1,
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ queue_entry_id: 'entry-1' }], error: null });

    render(
      <LocationDetails
        locationInfo={massageOnlyLocation}
        airportCode="TST"
        locationCode="massage-studio"
      />
    );

    await user.click(screen.getByText('20 Minutes'));
    await user.type(screen.getByPlaceholderText('Full name'), 'Massage Guest');
    await user.type(screen.getByPlaceholderText('Phone number'), '6125551212');
    await user.type(screen.getByPlaceholderText('Email address'), 'guest@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'queue_join',
      {
        body: expect.objectContaining({
          airportCode: 'TST',
          locationCode: 'massage-studio',
          customerType: 'paying',
          serviceLabel: 'Massage: 20 minutes',
          consentKey: 'queue_join_consent_bodywork',
        }),
      }
    ));
  });
});
