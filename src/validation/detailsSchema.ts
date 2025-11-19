/**
 * Form Details Validation Schema
 * 
 * Zod schema for validating the wizard form details step
 */

import { z } from 'zod';
import { validatePhoneNumber } from './phone';
import { VALIDATION_MESSAGES } from '@/constants/treatments';

export const detailsSchema = z.object({
  name: z.string().min(1, VALIDATION_MESSAGES.NAME_REQUIRED),
  phone: z.string().min(1, VALIDATION_MESSAGES.PHONE_REQUIRED).refine(validatePhoneNumber, VALIDATION_MESSAGES.PHONE_INVALID),
  email: z.string().email(VALIDATION_MESSAGES.EMAIL_INVALID).optional(),
  consent: z.boolean().refine(val => val === true, VALIDATION_MESSAGES.CONSENT_REQUIRED)
}); 
