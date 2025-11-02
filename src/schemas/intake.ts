import { z } from 'zod';

export const detailsSchemaFactory = ({
  requireDiscomfort,
  requireEmail,
  requireBirthday,
}: {
  requireDiscomfort: boolean;
  requireEmail: boolean;
  requireBirthday: boolean;
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
    birthday: requireBirthday
      ? z
          .string()
          .min(1, 'Birthday is required')
          .refine((date) => {
            const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
            if (!dateRegex.test(date)) return false;
            const [month, day, year] = date.split('/').map(Number);
            if (!month || !day || !year) return false;
            const dateObj = new Date(year, month - 1, day);
            return (
              dateObj.getFullYear() === year &&
              dateObj.getMonth() === month - 1 &&
              dateObj.getDate() === day &&
              year >= 1900 &&
              year <= new Date().getFullYear()
            );
          }, 'Invalid date format (MM/DD/YYYY)')
      : z.string().optional(),
    discomfort: requireDiscomfort
      ? z.array(z.string()).min(1, 'Please select at least one option')
      : z.array(z.string()),
    additionalInfo: z.string().optional(),
    consent: z.boolean().refine((val) => val === true, 'You must consent to treatment to proceed'),
  });

export const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email').optional(),
  birthday: z.string().min(1, 'Birthday is required').optional(),
  discomfort: z.array(z.string()),
  additionalInfo: z.string().optional(),
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
