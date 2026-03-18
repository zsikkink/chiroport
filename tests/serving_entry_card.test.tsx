import { render, screen } from '@testing-library/react';
import { ServingEntryCard } from '@/app/employee/[location]/components/QueueEntryCards';
import type { ServingRow, WithEntryId } from '@/app/employee/[location]/types';

describe('ServingEntryCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the authoritative serving-start time while an entry is serving', () => {
    jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('3:14 PM');

    const entry: WithEntryId<ServingRow> = {
      queue_entry_id: 'entry-1',
      queue_id: 'queue-1',
      location_id: 'location-1',
      location_display_name: 'Concourse A',
      location_timezone: 'America/New_York',
      customer_id: 'customer-1',
      full_name: 'Test Customer',
      phone_e164: '+15555550123',
      email: 'test@example.com',
      customer_type: 'paying',
      service_label: 'Massage: 20 minutes',
      status: 'serving',
      created_at: '2026-03-16T14:58:00.000Z',
      served_at: '2026-03-16T15:14:00.000Z',
      updated_at: '2026-03-16T15:14:00.000Z',
      sort_key: 10,
      confirm_sms_status: 'sent',
      next_sms_status: 'sent',
      serving_sms_status: 'sent',
      last_inbound_body: null,
      last_inbound_at: null,
    };

    render(
      <ServingEntryCard
        entry={entry}
        isCompleteBusy={false}
        isReturnBusy={false}
        isCancelBusy={false}
        isDeleteBusy={false}
        hasUnread={false}
        onDragStart={() => undefined}
        onContextMenu={() => undefined}
        onAdvance={() => undefined}
        onOpenChat={() => undefined}
        menuOpen={false}
        canMove={false}
        onCloseMenu={() => undefined}
        onMove={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(screen.getByText('Serving since 3:14 PM')).toBeTruthy();
  });

  it('shows an explicit fallback when the serving-start time is unavailable', () => {
    const entry: WithEntryId<ServingRow> = {
      queue_entry_id: 'entry-1',
      queue_id: 'queue-1',
      location_id: 'location-1',
      location_display_name: 'Concourse A',
      location_timezone: 'America/New_York',
      customer_id: 'customer-1',
      full_name: 'Test Customer',
      phone_e164: '+15555550123',
      email: 'test@example.com',
      customer_type: 'paying',
      service_label: 'Massage: 20 minutes',
      status: 'serving',
      created_at: '2026-03-16T14:58:00.000Z',
      served_at: null,
      updated_at: '2026-03-16T15:14:00.000Z',
      sort_key: 10,
      confirm_sms_status: 'sent',
      next_sms_status: 'sent',
      serving_sms_status: 'sent',
      last_inbound_body: null,
      last_inbound_at: null,
    };

    render(
      <ServingEntryCard
        entry={entry}
        isCompleteBusy={false}
        isReturnBusy={false}
        isCancelBusy={false}
        isDeleteBusy={false}
        hasUnread={false}
        onDragStart={() => undefined}
        onContextMenu={() => undefined}
        onAdvance={() => undefined}
        onOpenChat={() => undefined}
        menuOpen={false}
        canMove={false}
        onCloseMenu={() => undefined}
        onMove={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(screen.getByText('Serving start unavailable')).toBeTruthy();
  });
});
