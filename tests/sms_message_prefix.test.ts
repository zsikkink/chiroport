import {
  AUTOMATED_SMS_PREFIX,
  buildCancelAck,
  buildFinalOutboundSmsBody,
  buildPayingConfirmation,
  buildPriorityPassConfirmation,
  buildServingNotification,
} from '../supabase/functions/_shared/messages';

describe('automated SMS prefixing', () => {
  it('builds queue-join paying confirmations with the prefix already in the message body', () => {
    const body = buildPayingConfirmation({
      name: 'Robin',
      locationDisplayName: 'MSP Concourse C',
      queuePosition: 1,
    });

    expect(body.startsWith(AUTOMATED_SMS_PREFIX)).toBe(true);
    expect(body).toContain("You've joined the queue at The Chiroport at MSP Concourse C.");
  });

  it('builds queue-join non-paying confirmations with the prefix already in the message body', () => {
    const body = buildPriorityPassConfirmation({
      name: 'Robin',
      locationDisplayName: 'MSP Concourse C',
    });

    expect(body.startsWith(AUTOMATED_SMS_PREFIX)).toBe(true);
    expect(body).toContain("We'll text you when it's your turn to be served.");
  });

  it('builds automated cancel acknowledgements and serving notifications with the prefix', () => {
    expect(buildCancelAck().startsWith(AUTOMATED_SMS_PREFIX)).toBe(true);
    expect(buildServingNotification().startsWith(AUTOMATED_SMS_PREFIX)).toBe(true);
  });

  it('adds the Chiroport prefix to automated outbound messages that still reach the send boundary unprefixed', () => {
    expect(
      buildFinalOutboundSmsBody({
        body: "It's your turn! Please come back to The Chiroport.",
        messageType: 'serving',
      })
    ).toBe(`${AUTOMATED_SMS_PREFIX}It's your turn! Please come back to The Chiroport.`);
  });

  it('does not add the prefix twice when a message is already prefixed', () => {
    const body = `${AUTOMATED_SMS_PREFIX}You are next in line.`;

    expect(
      buildFinalOutboundSmsBody({
        body,
        messageType: 'next',
      })
    ).toBe(body);
  });

  it('does not alter manual staff-composed outbound messages', () => {
    const body = 'Please come back when you are nearby.';

    expect(
      buildFinalOutboundSmsBody({
        body,
        messageType: 'staff_1234',
      })
    ).toBe(body);
  });
});
