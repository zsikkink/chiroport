/**
 * Form Details Validation Schema
 * 
 * Zod schema for validating the wizard form details step
 */

import { z } from 'zod';
import { validatePhoneNumber } from './phone';
import { validateBirthday } from './date';
import { VALIDATION_MESSAGES } from '@/constants/treatments';

export const detailsSchema = z.object({
  name: z.string().min(1, VALIDATION_MESSAGES.NAME_REQUIRED),
  phone: z.string().min(1, VALIDATION_MESSAGES.PHONE_REQUIRED).refine(validatePhoneNumber, VALIDATION_MESSAGES.PHONE_INVALID),
  email: z.string().email(VALIDATION_MESSAGES.EMAIL_INVALID),
  birthday: z.string().min(1, VALIDATION_MESSAGES.BIRTHDAY_REQUIRED).refine(validateBirthday, VALIDATION_MESSAGES.BIRTHDAY_INVALID),
  discomfort: z.array(z.string()).min(1, VALIDATION_MESSAGES.DISCOMFORT_REQUIRED),
  additionalInfo: z.string().optional(),
  consent: z.boolean().refine(val => val === true, VALIDATION_MESSAGES.CONSENT_REQUIRED)
}); 