import { Capacitor } from '@capacitor/core';

export const getApiBaseUrl = (): string => {
  // 1. Check custom runtime API configuration (stored in localStorage)
  const customUrl = localStorage.getItem('mycockpit_api_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }

  // 2. Check build-time environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }

  // 3. When running in native mobile application (Capacitor Android / iOS)
  if (Capacitor.isNativePlatform()) {
    // Production / Staging API endpoint accessible over the internet
    return 'https://akiradigital.com/backend/api';
  }

  // 4. Default web browser relative proxy route
  return '/api';
};

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('mycockpit_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Standardize URL
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const base = getApiBaseUrl();
    let url = `${base}${cleanEndpoint}`;

    try {
      let response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      });

      // If proxied fails with 404 in direct preview mode, fall back to direct Apache URL
      if (!response.ok && response.status === 404 && base === '/api') {
        const directUrl = `http://localhost/mycockpit/backend/api/index.php${cleanEndpoint}`;
        const directResp = await fetch(directUrl, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...(options.headers || {})
          }
        });
        if (directResp.ok || directResp.status < 500) {
          response = directResp;
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data.data !== undefined ? data.data : data;
    } catch (err: any) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  }

  // HTTP Helpers
  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
