export type RealtimeRecoveryState = {
  hasSubscribed: boolean;
  needsRefresh: boolean;
};

export const initialRealtimeRecoveryState: RealtimeRecoveryState = {
  hasSubscribed: false,
  needsRefresh: false,
};

export function transitionRealtimeRecovery(
  state: RealtimeRecoveryState,
  status: string
): { state: RealtimeRecoveryState; shouldRefresh: boolean } {
  if (status === 'SUBSCRIBED') {
    return {
      state: { hasSubscribed: true, needsRefresh: false },
      shouldRefresh: state.hasSubscribed && state.needsRefresh,
    };
  }

  if (
    state.hasSubscribed &&
    (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
  ) {
    return {
      state: { ...state, needsRefresh: true },
      shouldRefresh: false,
    };
  }

  return { state, shouldRefresh: false };
}
