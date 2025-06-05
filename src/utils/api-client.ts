/**
 * API Client Utility
 * 
 * Provides secure API communication with automatic CSRF token handling
 * and proper error handling for the frontend components.
 */

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class APIClient {
  private csrfToken: string | null = null;
  private csrfPromise: Promise<void> | null = null;

  /**
   * Fetch CSRF token from the server
   */
  private async fetchCSRFToken(): Promise<void> {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.token;
      } else {
        console.warn('Failed to fetch CSRF token');
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
    }
  }

  /**
   * Ensure CSRF token is available before making requests
   */
  private async ensureCSRFToken(): Promise<void> {
    if (this.csrfToken) {
      return;
    }

    if (!this.csrfPromise) {
      this.csrfPromise = this.fetchCSRFToken();
    }

    await this.csrfPromise;
    this.csrfPromise = null;
  }

  /**
   * Make a secure API request with CSRF protection
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      // For state-changing operations, ensure CSRF token is available
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
        await this.ensureCSRFToken();
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // Additional CSRF protection
        ...options.headers,
      };

      // Add CSRF token for state-changing operations
      if (this.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for CSRF validation
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle CSRF token expiry
        if (response.status === 403 && data.error?.includes('CSRF')) {
          this.csrfToken = null; // Clear expired token
          console.warn('CSRF token expired, will fetch new one on next request');
        }

        return {
          success: false,
          error: data.error || 'Request failed',
          message: data.message,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error or server unavailable',
        message: 'Please check your connection and try again',
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>(url, { method: 'DELETE' });
  }

  /**
   * Clear cached CSRF token (useful for logout or token refresh)
   */
  clearCSRFToken(): void {
    this.csrfToken = null;
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Convenience functions for common operations
export async function submitForm<T>(data: any): Promise<APIResponse<T>> {
  return apiClient.post<T>('/api/waitwhile/submit', data);
}

export async function getVisitStatus<T>(visitId: string): Promise<APIResponse<T>> {
  return apiClient.get<T>(`/api/waitwhile/visit/${visitId}`);
}

// Rate limiting helper for client-side
export class ClientRateLimiter {
  private lastRequest = 0;
  private minInterval: number;

  constructor(requestsPerMinute: number = 10) {
    this.minInterval = (60 * 1000) / requestsPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequest = Date.now();
  }
}

// Export rate limiter for form submissions
export const formSubmissionLimiter = new ClientRateLimiter(2); // 2 submissions per minute 