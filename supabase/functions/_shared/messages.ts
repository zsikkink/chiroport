export const MESSAGE_TYPES = {
  CONFIRM: 'confirm',
  NEXT: 'next',
  SERVING: 'serving',
  CANCEL_ACK: 'cancel_ack',
  CANCEL_REASON_PROMPT: 'cancel_reason_prompt',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const AUTOMATED_SMS_PREFIX = 'Chiroport Msg: ';

function isManualStaffMessageType(messageType?: string | null) {
  return messageType?.startsWith('staff_') ?? false;
}

export function buildFinalOutboundSmsBody(params: {
  body: string;
  messageType?: string | null;
}) {
  if (isManualStaffMessageType(params.messageType)) {
    return params.body;
  }

  if (params.body.startsWith(AUTOMATED_SMS_PREFIX)) {
    return params.body;
  }

  return `${AUTOMATED_SMS_PREFIX}${params.body}`;
}
