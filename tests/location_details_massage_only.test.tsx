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

  it('starts with Massage and Priority Pass choices without chiropractor options', () => {
    render(
      <LocationDetails
        locationInfo={massageOnlyLocation}
        airportCode="TST"
        locationCode="massage-studio"
      />
    );

    expect(screen.getByRole('button', { name: /Priority Pass \/ Lounge Key/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Massage$/i })).toBeTruthy();
    expect(screen.queryByText('Chiropractor')).toBeNull();
    expect(screen.queryByText(/Priority Pass or Lounge Key member/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /15 minutes/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /20 minutes/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /30 minutes/i })).toBeNull();
    expect(
      screen.getByRole('checkbox', {
        name: /I agree to the Privacy Policy and Terms & Conditions/i,
      })
    ).toBeTruthy();
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

    await user.click(screen.getByRole('button', { name: /^Massage$/i }));
    await user.click(screen.getByRole('button', { name: /20 minutes/i }));
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

  it('submits massage-only Priority Pass visits without requiring duration selection', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      data: {
        queueEntryId: 'entry-2',
        publicToken: 'token-2',
        queueId: 'queue-2',
        status: 'waiting',
        createdAt: '2026-04-28T12:00:00.000Z',
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ queue_entry_id: 'entry-2' }], error: null });

    render(
      <LocationDetails
        locationInfo={massageOnlyLocation}
        airportCode="TST"
        locationCode="massage-studio"
      />
    );

    await user.click(screen.getByRole('button', { name: /Priority Pass \/ Lounge Key/i }));
    expect(screen.queryByRole('button', { name: /15 minutes/i })).toBeNull();

    await user.type(screen.getByPlaceholderText('Full name'), 'Priority Guest');
    await user.type(screen.getByPlaceholderText('Phone number'), '6125553434');
    await user.type(screen.getByPlaceholderText('Email address'), 'priority@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /join queue/i }));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'queue_join',
      {
        body: expect.objectContaining({
          airportCode: 'TST',
          locationCode: 'massage-studio',
          customerType: 'priority_pass',
          serviceLabel: 'Priority Pass',
          consentKey: 'queue_join_consent_bodywork',
        }),
      }
    ));
  });
});
