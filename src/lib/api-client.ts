/**
 * Unified API client used across client and server environments.
 * Handles JSON parsing, optional rate limiting, and provides
 * convenience helpers for common application flows.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

export interface RateLimiter {
  throttle(): Promise<void>;
}

export interface ApiClientOptions {
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  includeCredentials?: RequestCredentials;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  throttle?: RateLimiter;
  headers?: Record<string, string>;
}

class ApiClient {
  private readonly fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private readonly credentials: RequestCredentials;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions = {}) {
    const providedFetch = options.fetchImpl ?? fetch;
    if (typeof window !== 'undefined' && providedFetch === window.fetch) {
      this.fetchImpl = providedFetch.bind(window);
    } else {
      this.fetchImpl = providedFetch;
    }
    this.credentials = options.includeCredentials ?? 'include';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.defaultHeaders,
    };
  }

  private async parseJson<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json') && response.status !== 204) {
      return null;
    }

    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  private normalizeHeaders(
    base: Record<string, string>,
    override?: HeadersInit
  ): Record<string, string> {
    if (!override) {
      return { ...base };
    }

    if (Array.isArray(override)) {
      return override.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, { ...base });
    }

    if (override instanceof Headers) {
      const entries: Record<string, string> = { ...base };
      override.forEach((value, key) => {
        entries[key] = value;
      });
      return entries;
    }

    return { ...base, ...override };
  }

  private async request<T>(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      if (options.throttle) {
        await options.throttle.throttle();
      }

      let headers = this.normalizeHeaders(this.defaultHeaders, init.headers);
      if (options.headers) {
        headers = { ...headers, ...options.headers };
      }

      const response = await this.fetchImpl(url, {
        ...init,
        headers,
        credentials: this.credentials,
      });

      const payload = await this.parseJson<ApiResponse<T>>(response);

      if (!response.ok) {
        const errorResponse: ApiResponse<T> = {
          success: false,
          status: response.status,
        };

        errorResponse.error =
          payload?.error || response.statusText || 'Request failed';

        if (payload?.message) {
          errorResponse.message = payload.message;
        }

        return errorResponse;
      }

      const dataSource = payload?.data ?? payload;
      const successResponse: ApiResponse<T> = {
        success: true,
        status: response.status,
      };

      if (payload?.message) {
        successResponse.message = payload.message;
      }

      if (dataSource !== undefined && dataSource !== null) {
        successResponse.data = dataSource as T;
      }

      return successResponse;
    } catch (error) {
      console.error('API request failed:', error);
      const fallback: ApiResponse<T> = {
        success: false,
        error: 'Network error or server unavailable',
      };
      fallback.message = 'Please check your connection and try again';
      return fallback;
    }
  }

  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'GET' }, options);
  }

  async post<T>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const init: RequestInit = { method: 'POST' };
    if (data !== undefined) {
      init.body = JSON.stringify(data);
    }
    return this.request<T>(url, init, options);
  }

  async put<T>(
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const init: RequestInit = { method: 'PUT' };
    if (data !== undefined) {
      init.body = JSON.stringify(data);
    }
    return this.request<T>(url, init, options);
  }

  async delete<T>(
    url: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'DELETE' }, options);
  }
}

export class SimpleRateLimiter implements RateLimiter {
  private lastRequest = 0;
  private readonly minInterval: number;

  constructor(requestsPerMinute: number = 10) {
    this.minInterval = (60 * 1000) / requestsPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minInterval) {
      const waitTime = this.minInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequest = Date.now();
  }
}

export const apiClient = new ApiClient();

export { ApiClient };
