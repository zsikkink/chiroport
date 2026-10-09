import type { OutboxSendResult } from './outboxDelivery.ts';

export type StaffMessageHttpOutcome = {
  status: number;
  body: Record<string, unknown>;
};

export function mapStaffMessageOutcome(
  delivery: OutboxSendResult
): StaffMessageHttpOutcome {
  if (delivery.status === 'sent') {
    return { status: 200, body: { success: true, outcome: 'sent' } };
  }
  if (delivery.status === 'durably_queued') {
    return { status: 202, body: { success: true, outcome: 'queued' } };
  }
  if (delivery.status === 'opted_out') {
    return {
      status: 409,
      body: {
        error: {
          code: 'opted_out',
          message: 'This recipient has opted out of SMS.',
        },
        outcome: 'opted_out',
      },
    };
  }
  if (delivery.status === 'missing') {
    return {
      status: 500,
      body: {
        error: {
          code: 'internal_error',
          message: 'The expected durable message row is missing.',
        },
        outcome: 'missing',
      },
    };
  }

  return {
    status: delivery.status === 'permanent_failure' ? 500 : 503,
    body: {
      error: {
        code:
          delivery.status === 'permanent_failure'
            ? 'internal_error'
            : 'dependency_unavailable',
        message: delivery.error,
      },
      outcome: delivery.status,
    },
  };
}
