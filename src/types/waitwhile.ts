/**
 * Waitwhile API TypeScript Definitions
 * 
 * These types define the structure of data exchanged with the Waitwhile API.
 * Based on Waitwhile API v2 documentation.
 */

// Base API response structure
export interface WaitwhileApiResponse<T = unknown> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Error response structure
export interface WaitwhileApiError {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

// Customer data structure for Waitwhile
export interface WaitwhileCustomer {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// Visit/booking data structure
export interface WaitwhileVisit {
  id?: string;
  customerId: string;
  locationId: string;
  resourceId?: string;
  serviceName?: string;
  serviceId?: string;
  status?: 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled' | 'no_show';
  waitTime?: number;
  estimatedWaitTime?: number;
  queuePosition?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// Location data structure (for reference)
export interface WaitwhileLocation {
  id: string;
  name: string;
  timezone: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  settings?: Record<string, unknown>;
}

// Service data structure
export interface WaitwhileService {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  price?: number;
  metadata?: Record<string, unknown>;
}

// Request payload for creating a customer
export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // dateOfBirth?: string; // Not supported by Waitwhile API
  notes?: string;
  metadata?: {
    source?: string;
    treatment?: string;
    discomfort?: string; // Changed from array to string
    spinalAdjustment?: string; // Changed from boolean to string
    birthday?: string; // Store birthday in metadata instead
    additionalInfo?: string;
  };
}

// Request payload for creating a visit/booking
export interface CreateVisitRequest {
  customerId: string;
  locationId: string;
  serviceName?: string;
  // serviceId?: string; // Not allowed by Waitwhile API in visit creation
  notes?: string;
  metadata?: Record<string, unknown>;
}

// Combined request for customer + visit creation
export interface CustomerVisitRequest {
  customer: CreateCustomerRequest;
  visit: Omit<CreateVisitRequest, 'customerId'>;
}

// Response types
export type CreateCustomerResponse = WaitwhileApiResponse<WaitwhileCustomer>;
export type CreateVisitResponse = WaitwhileApiResponse<WaitwhileVisit>;
export type GetCustomerResponse = WaitwhileApiResponse<WaitwhileCustomer>;
export type GetVisitResponse = WaitwhileApiResponse<WaitwhileVisit>;

// API client configuration
export interface WaitwhileClientConfig {
  apiKey: string;
  apiUrl: string;
  timeout?: number;
}

// Internal types for form submission
export interface FormSubmissionData {
  name: string;
  phone: string;
  email?: string | undefined;
  consent: boolean;
  selectedTreatment: {
    title: string;
    price: string;
    time: string;
    description: string;
  } | null;
  spinalAdjustment: boolean | null;
  locationId: string;
  serviceId?: string; // Optional - Waitwhile service ID for visit creation
} 
