import { z } from 'zod';

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
      .refine((phone) => {
        if (!phone) return false;
        if (phone.startsWith('+')) {
          return /^\+\d{7,15}$/.test(phone.replace(/[^\d+]/g, ''));
        }
        const digitsOnly = phone.replace(/\D/g, '');
        return digitsOnly.length === 10;
      }, 'Invalid phone number'),
    email: requireEmail ? z.string().email('Invalid email') : z.string().optional(),
    consent: z.boolean().refine((val) => val === true, 'You must consent to treatment to proceed'),
  });

export const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email').optional(),
  consent: z.boolean().refine((val) => val === true, 'Consent to treatment is required'),
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
