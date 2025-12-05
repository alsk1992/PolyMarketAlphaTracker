import { API_URL } from './privy';

class ApiClient {
  constructor() {
    this.token = null;
    this.baseUrl = API_URL;
  }

  setToken(token) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // For cookies (refresh token)
    });

    // Handle token refresh on 401
    if (response.status === 401 && this.token) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token}`;
        return fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    }

    return response;
  }

  async get(endpoint) {
    const response = await this.request(endpoint);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw { status: response.status, ...error };
    }
    return response.json();
  }

  async post(endpoint, data) {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw { status: response.status, ...error };
    }
    return response.json();
  }

  async patch(endpoint, data) {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw { status: response.status, ...error };
    }
    return response.json();
  }

  async delete(endpoint) {
    const response = await this.request(endpoint, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw { status: response.status, ...error };
    }
    return response.json();
  }

  async refreshToken() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        return true;
      }
    } catch {
      // Refresh failed
    }
    this.token = null;
    return false;
  }
}

export const api = new ApiClient();
