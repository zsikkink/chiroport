export const MESSAGE_TYPES = {
  CONFIRM: 'confirm',
  NEXT: 'next',
  SERVING: 'serving',
  CANCEL_ACK: 'cancel_ack',
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

export function buildCancelAck() {
  return buildFinalOutboundSmsBody({
    body: "You've removed yourself from The Chiroport queue. Thanks for letting us know.",
    messageType: MESSAGE_TYPES.CANCEL_ACK,
  });
}

export function buildServingNotification() {
  return buildFinalOutboundSmsBody({
    body: "It's your turn! Please come back to The Chiroport - we're ready for you!",
    messageType: MESSAGE_TYPES.SERVING,
  });
}
