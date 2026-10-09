import {
  initialRealtimeRecoveryState,
  transitionRealtimeRecovery,
} from '@/app/employee/[location]/hooks/realtimeRecovery';
import {
  reconcileInboundRows,
  reconcileRealtimeDelete,
  upsertRealtimeChatMessage,
} from '@/app/employee/[location]/hooks/realtimeReconciliation';

describe('realtime recovery', () => {
  it('closes the snapshot-to-subscription gap on initial subscription', () => {
    const result = transitionRealtimeRecovery(
      initialRealtimeRecoveryState,
      'SUBSCRIBED'
    );

    expect(result.shouldRefresh).toBe(true);
    expect(result.state).toEqual({ hasSubscribed: true, needsRefresh: false });
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])(
    'requires authoritative reconciliation after %s and resubscription',
    (disconnectStatus) => {
      const subscribed = transitionRealtimeRecovery(
        initialRealtimeRecoveryState,
        'SUBSCRIBED'
      );
      const disconnected = transitionRealtimeRecovery(
        subscribed.state,
        disconnectStatus
      );
      const reconnected = transitionRealtimeRecovery(
        disconnected.state,
        'SUBSCRIBED'
      );

      expect(disconnected.shouldRefresh).toBe(false);
      expect(reconnected.shouldRefresh).toBe(true);
      expect(reconnected.state.needsRefresh).toBe(false);
    }
  );

  it('ignores duplicate and out-of-order inbound updates', () => {
    const rows = [
      {
        queue_entry_id: 'entry-1',
        last_inbound_at: '2026-08-27T12:00:00.000Z',
        last_inbound_body: 'newest',
      },
    ];

    const duplicate = reconcileInboundRows(rows, {
      entryId: 'entry-1',
      body: 'duplicate',
      receivedAt: '2026-08-27T12:00:00.000Z',
    });
    const older = reconcileInboundRows(rows, {
      entryId: 'entry-1',
      body: 'older',
      receivedAt: '2026-08-27T11:59:00.000Z',
    });

    expect(duplicate.rows).toBe(rows);
    expect(older.rows).toBe(rows);
    expect(duplicate.updatedEntryIds).toEqual(new Set());
  });

  it('deduplicates chat events by durable message id and preserves chronology', () => {
    const first = upsertRealtimeChatMessage([], {
      id: 'message-1',
      direction: 'out',
      body: 'Queued',
      at: '2026-08-27T12:01:00.000Z',
      status: 'queued',
    });
    const updated = upsertRealtimeChatMessage(first, {
      id: 'message-1',
      direction: 'out',
      body: 'Queued',
      at: '2026-08-27T12:01:00.000Z',
      status: 'sent',
    });
    const withEarlier = upsertRealtimeChatMessage(updated, {
      id: 'message-0',
      direction: 'in',
      body: 'Earlier',
      at: '2026-08-27T12:00:00.000Z',
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]?.status).toBe('sent');
    expect(withEarlier.map((message) => message.id)).toEqual([
      'message-0',
      'message-1',
    ]);
  });

  it('removes a deleted entry from every reconciled queue list', () => {
    const entry = { queue_entry_id: 'entry-1' };
    const other = { queue_entry_id: 'entry-2' };
    const reconciled = reconcileRealtimeDelete(
      {
        waiting: [entry, other] as never,
        serving: [entry] as never,
        history: [entry] as never,
      },
      'entry-1'
    );

    expect(reconciled.waiting).toEqual([other]);
    expect(reconciled.serving).toEqual([]);
    expect(reconciled.history).toEqual([]);
  });
});
