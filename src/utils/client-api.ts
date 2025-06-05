/**
 * Client-Side API Utility
 * 
 * Simplified API client for frontend components to avoid server-side dependencies.
 */

'use client';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Simple client-side rate limiter
 */
class SimpleRateLimiter {
  private lastRequest = 0;
  private minInterval: number;

  constructor(requestsPerMinute: number = 2) {
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

/**
 * Secure form submission with CSRF protection
 */
export async function submitFormSecurely<T>(data: any): Promise<APIResponse<T>> {
  try {
    // First, get CSRF token
    const tokenResponse = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });

    let csrfToken = '';
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      csrfToken = tokenData.token;
    }

    // Submit the form with CSRF token
    const response = await fetch('/api/waitwhile/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Submission failed',
        message: result.message,
      };
    }

    return {
      success: true,
      data: result.data || result,
      message: result.message,
    };
  } catch (error) {
    console.error('Form submission failed:', error);
    return {
      success: false,
      error: 'Network error',
      message: 'Please check your connection and try again',
    };
  }
}

// Export rate limiter for form submissions
export const formSubmissionLimiter = new SimpleRateLimiter(2); 