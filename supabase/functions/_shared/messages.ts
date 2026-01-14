export const MESSAGE_TYPES = {
  CONFIRM: 'confirm',
  NEXT: 'next',
  SERVING: 'serving',
  CANCEL_ACK: 'cancel_ack',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export function buildPayingConfirmation(params: {
  name: string;
  locationDisplayName: string;
  queuePosition: number | null;
}) {
  const peopleAhead = Math.max((params.queuePosition ?? 1) - 1, 0);
  const verb = peopleAhead === 1 ? 'is' : 'are';
  const noun = peopleAhead === 1 ? 'person' : 'people';

  return [
    `Hi ${params.name}! You've joined the queue at The Chiroport at ${params.locationDisplayName}.`,
    '',
    `There ${verb} ${peopleAhead} ${noun} ahead of you. We will text you when you are next.`,
    '',
    'Change in plans? Text CANCEL to exit the queue. You may reply here to communicate with our staff.',
    '',
    'Wait times may vary.',
  ].join('\n');
}

export function buildPriorityPassConfirmation(params: {
  name: string;
  locationDisplayName: string;
}) {
  return [
    `Hi ${params.name}! You've joined the queue at The Chiroport at ${params.locationDisplayName}.`,
    '',
    "We'll text you when it's your turn to be served.",
    '',
    'Please confirm that The Chiroport is included in your membership benefits.',
    '',
    'Change in plans? Reply here to reach our staff, or text CANCEL to exit the queue.',
    '',
    'Wait times may vary.',
  ].join('\n');
}

export function buildCancelAck(params?: { name?: string | null }) {
  const rawName = params?.name?.trim();
  const name = rawName ? `, ${rawName}` : '';
  return `You've removed yourself from The Chiroport queue${name}. Thanks for letting us know.`;
}

export function buildServingNotification() {
  return "It's your turn! Please come back to The Chiroport - we're all ready for you!";
}
