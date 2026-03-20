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

export function buildPayingConfirmation(params: {
  name: string;
  locationDisplayName: string;
  queuePosition: number | null;
}) {
  const peopleAhead = Math.max((params.queuePosition ?? 1) - 1, 0);
  const verb = peopleAhead === 1 ? 'is' : 'are';
  const noun = peopleAhead === 1 ? 'person' : 'people';

  return buildFinalOutboundSmsBody({
    body: [
    `Hi ${params.name}! You've joined the queue at The Chiroport at ${params.locationDisplayName}.`,
    '',
    `There ${verb} ${peopleAhead} ${noun} ahead of you. We will text you when you are next.`,
    '',
    'Change in plans? Text CANCEL to exit the queue. You may reply here to communicate with our staff.',
    '',
    'Wait times may vary.',
    ].join('\n'),
    messageType: MESSAGE_TYPES.CONFIRM,
  });
}

export function buildPriorityPassConfirmation(params: {
  name: string;
  locationDisplayName: string;
}) {
  return buildFinalOutboundSmsBody({
    body: [
    `Hi ${params.name}! You've joined the queue at The Chiroport at ${params.locationDisplayName}.`,
    '',
    "We'll text you when it's your turn to be served.",
    '',
    'We recommend that you confirm The Chiroport is an included benefit in your Priority Pass travel program.',
    '',
    'Change in plans? Reply here to reach our staff, or text CANCEL to exit the queue.',
    '',
    'Wait times may vary.',
    ].join('\n'),
    messageType: MESSAGE_TYPES.CONFIRM,
  });
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
