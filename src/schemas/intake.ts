import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function isValidIntakePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    return parsed?.isValid() ?? false;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  const parsed = parsePhoneNumberFromString(digitsOnly, 'US');
  return parsed?.isValid() ?? false;
}

export const detailsSchemaFactory = ({
  requireEmail,
}: {
  requireEmail: boolean;
}) =>
  z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z
      .string()
      .min(1, 'Phone is required')
      .refine((phone) => isValidIntakePhone(phone), 'Enter a valid phone number'),
    email: requireEmail ? z.string().email('Invalid email') : z.string().optional(),
    consent: z.boolean().refine(
      (val) => val === true,
      'You must agree to the Privacy Policy and Terms & Conditions to proceed'
    ),
  });

export const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email'),
  consent: z.boolean().refine(
    (val) => val === true,
    'You must agree to the Privacy Policy and Terms & Conditions to proceed'
  ),
  selectedTreatment: z
    .object({
      title: z.string(),
      price: z.string(),
      time: z.string(),
      description: z.string(),
    })
    .nullable(),
  spinalAdjustment: z.boolean().nullable(),
  locationId: z.string().min(1, 'Location ID is required'),
});

export type SubmissionSchema = z.infer<typeof submissionSchema>;
