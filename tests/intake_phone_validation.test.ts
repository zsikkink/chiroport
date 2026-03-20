import { detailsSchemaFactory } from '@/schemas/intake';

describe('intake phone validation', () => {
  const schema = detailsSchemaFactory({ requireEmail: true });

  it('accepts a valid US phone number entered as 10 digits', () => {
    const result = schema.safeParse({
      name: 'Test User',
      phone: '6125551212',
      email: 'test@example.com',
      consent: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a number that Twilio would reject as invalid', () => {
    const result = schema.safeParse({
      name: 'Test User',
      phone: '+17896889026',
      email: 'test@example.com',
      consent: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toContain('Enter a valid phone number');
    }
  });
});
