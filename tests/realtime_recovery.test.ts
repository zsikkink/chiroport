import {
  initialRealtimeRecoveryState,
  transitionRealtimeRecovery,
} from '@/app/employee/[location]/hooks/realtimeRecovery';

describe('realtime recovery', () => {
  it('does not refresh for the initial subscription', () => {
    const result = transitionRealtimeRecovery(
      initialRealtimeRecoveryState,
      'SUBSCRIBED'
    );

    expect(result.shouldRefresh).toBe(false);
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
});
