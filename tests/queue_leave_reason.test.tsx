import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessStep } from '@/features/location-details/components/steps';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ rpc: mockRpc }),
}));

const visit = {
  queueEntryId: 'entry-1',
  publicToken: 'public-token-1',
};

describe('customer queue departure', () => {
  beforeEach(() => mockRpc.mockReset());

  it('requires a reason before leaving and records a Priority Pass decline', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: [{ out_status: 'cancelled' }], error: null });
    render(<SuccessStep submissionSuccess={visit} isPriorityPass />);

    await user.click(screen.getByRole('button', { name: 'Leave queue' }));
    const confirm = screen.getByRole('button', { name: 'Confirm leaving queue' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Why are you leaving the queue?' }),
      'priority_pass_declined'
    );
    await user.click(confirm);

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('cancel_visit_with_reason', {
      p_public_token: 'public-token-1',
      p_departure_reason: 'priority_pass_declined',
    }));
    expect(await screen.findByText('You left the queue.')).toBeTruthy();
  });

  it('does not offer a Priority Pass decline for paying visits', async () => {
    const user = userEvent.setup();
    render(<SuccessStep submissionSuccess={visit} isPriorityPass={false} />);
    await user.click(screen.getByRole('button', { name: 'Leave queue' }));
    expect(screen.queryByRole('option', { name: 'Priority Pass was declined' })).toBeNull();
  });
});
