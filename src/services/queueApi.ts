/**
 * Queue API Service
 * 
 * Handles all queue-related API operations with rate limiting
 */

import { submitWaitwhileForm } from '@/utils/api-client';
import { SubmissionResponse, Treatment, WizardState } from '@/types/wizard';

export interface JoinQueuePayload {
  details: WizardState['details'];
  selectedTreatment: Treatment | null;
  spinalAdjustment: boolean | null;
  locationId: string;
}

export async function joinQueue(payload: JoinQueuePayload) {
  // Prepare form data for API
  const formData = {
    name: payload.details.name,
    phone: payload.details.phone,
    consent: payload.details.consent,
    selectedTreatment: payload.selectedTreatment,
    spinalAdjustment: payload.spinalAdjustment,
    locationId: payload.locationId,
    ...(payload.details.email ? { email: payload.details.email } : {}),
  };

  // Submit using secure API client with automatic CSRF handling
  const result = await submitWaitwhileForm<SubmissionResponse>(formData);

  if (!result.success) {
    throw new Error(result.error || result.message || 'Submission failed');
  }

  return result.data as SubmissionResponse;
} 
