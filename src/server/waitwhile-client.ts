import 'server-only';

/**
 * Waitwhile API Client
 * 
 * This module provides a centralized client for interacting with the Waitwhile API.
 * It handles authentication, request/response transformation, and error handling.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { config, debugLog, logError } from '@/server';
import {
  WaitwhileApiError,
  WaitwhileVisit,
  FormSubmissionData,
  WaitwhileClientConfig
} from '@/types/waitwhile';

/**
 * Waitwhile Visit Creation Request (correct structure)
 */
interface CreateWaitwhileVisitRequest {
  locationId: string;
  name: string;
  phone: string;
  email: string;
  state: "WAITING";
  serviceIds: string[];
  dataFields: Array<{
    id: string;
    values: string[];
  }>;
}

/**
 * Waitwhile API Client Class
 */
export class WaitwhileClient {
  private client: AxiosInstance;
  private config: WaitwhileClientConfig;

  constructor(clientConfig?: Partial<WaitwhileClientConfig>) {
    // Validate configuration
    if (!config.api.waitwhile.apiKey) {
      throw new Error('Waitwhile API key is required');
    }

    this.config = {
      apiKey: config.api.waitwhile.apiKey,
      apiUrl: config.api.waitwhile.url,
      timeout: 10000, // 10 seconds
      ...clientConfig
    };

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout || 10000, // Ensure timeout is never undefined
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        debugLog('Waitwhile API Request:', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logError(error, 'Waitwhile API Request Error');
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        debugLog('Waitwhile API Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error: AxiosError) => {
        const errorInfo = {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        };
        logError(error, 'Waitwhile API Response Error');
        debugLog('Waitwhile API Error Details:', errorInfo);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Transform axios error to standardized format
   */
  private transformError(error: AxiosError): WaitwhileApiError {
    const response = error.response;
    
    if (response?.data && typeof response.data === 'object' && 'error' in response.data) {
      return response.data as WaitwhileApiError;
    }

    return {
      error: {
        message: error.message || 'Unknown error occurred',
        code: response?.status?.toString() || 'NETWORK_ERROR',
        details: response?.data
      }
    };
  }

  /**
   * Create a visit with embedded customer data (correct Waitwhile API structure)
   */
  async createVisit(visitData: CreateWaitwhileVisitRequest): Promise<WaitwhileVisit> {
    try {
      const response: AxiosResponse<WaitwhileVisit> = 
        await this.client.post('/visits', visitData);
      
      return response.data;
    } catch (error) {
      logError(error as Error, 'Failed to create visit');
      throw error;
    }
  }

  /**
   * Get visit by ID
   */
  async getVisit(visitId: string): Promise<WaitwhileVisit> {
    try {
      const response: AxiosResponse<WaitwhileVisit> = 
        await this.client.get(`/visits/${visitId}`);
      
      return response.data;
    } catch (error) {
      logError(error as Error, `Failed to get visit ${visitId}`);
      throw error;
    }
  }

  /**
   * Transform form submission data to correct Waitwhile visit format
   */
  transformFormData(formData: FormSubmissionData, fieldIds: {
    ailment: string;
    dateOfBirth: string;
    notes: string;
    consent: string;
  }): CreateWaitwhileVisitRequest {
    // Format phone number (ensure it starts with +1 for US numbers)
    let phone = formData.phone.replace(/\D/g, '');
    if (phone.length === 10 && !phone.startsWith('1')) {
      phone = '1' + phone;
    }
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    // Determine service ID based on user's journey
    let serviceId: string;

    if (formData.selectedTreatment) {
      // Non-member: Use the service ID for their selected treatment
      const serviceMapping: Record<string, string> = {
        'Body on the Go': 'IhqDpECD89j2e7pmHCEW',
        'Total Wellness': '11AxkuHmsd0tClHLitZ7',
        'Sciatica & Lower Back Targeted Therapy': 'QhSWYhwLpnoEFHJZkGQf',
        'Neck & Upper Back Targeted Therapy': '59q5NJG9miDfAgdtn8nK',
        'Trigger Point Muscle Therapy & Stretch': 'hD5KfCW1maA1Vx0za0fv',
        'Chiro Massage': 'ts1phHc92ktj04d0Gpve',
        'Chiro Massage Mini': 'J8qHXtrsRC2aNPA04YDc',
        'Undecided': 'FtfCqXMwnkqdft5aL0ZX',
        '15 Minutes': 'cyIjtFCpILcnJAD7c3Mo',
        '20 Minutes': 'KCoFYD7S99YjNaCjzFxV',
        '30 Minutes': 'ZBy2A2vgIAGUksm12RSQ',
      };
      
      serviceId = serviceMapping[formData.selectedTreatment.title] || 'FtfCqXMwnkqdft5aL0ZX';
    } else {
      // Member: Use appropriate member service
      if (formData.spinalAdjustment === true) {
        serviceId = 'DoCvBDfuyv3HjlCra5Jc'; // Members with $29 spinal adjustment
      } else {
        serviceId = 'mZChb5bacT7AeVU7E3Rz'; // Members without spinal adjustment
      }
    }

    // Build dataFields array using location-specific field IDs
    const dataFields: Array<{ id: string; values: string[] }> = [];

    dataFields.push({
      id: fieldIds.consent,
      values: [formData.consent ? 'Yes' : 'No']
    });

    const visitPayload: CreateWaitwhileVisitRequest = {
      locationId: formData.locationId,
      name: formData.name,
      phone: phone,
      email: formData.email.trim().toLowerCase(),
      state: "WAITING",
      serviceIds: [serviceId],
      dataFields: dataFields
    };

    return visitPayload;
  }
}

// Create singleton instance
export const waitwhileClient = new WaitwhileClient();

// Export convenience functions
export const createVisit = async (data: FormSubmissionData) => {
  // Dynamic import to avoid circular dependencies
  const { getLocationDataByWaitwhileId } = await import('@/lib');
  
  // Get location-specific data field IDs
  const locationData = getLocationDataByWaitwhileId(data.locationId);
  if (!locationData) {
    throw new Error(`Location data not found for location ID: ${data.locationId}`);
  }
  
  // Check if field IDs are still placeholders
  const hasPlaceholderIds = Object.values(locationData.dataFieldIds).some(id => 
    id.includes('_FIELD_ID_NEEDED') || id === ''
  );
  
  if (hasPlaceholderIds) {
    throw new Error(`Data field IDs not configured for location ${data.locationId}. Please contact support.`);
  }
  
  const transformedData = waitwhileClient.transformFormData(data, locationData.dataFieldIds);
  return waitwhileClient.createVisit(transformedData);
};

export const getVisit = (visitId: string) => waitwhileClient.getVisit(visitId); 
