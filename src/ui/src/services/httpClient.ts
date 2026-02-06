import { AUTH_HEADER } from '../../../types/auth';

const API_BASE = '/api';

export class HttpClient {
  private static instance: HttpClient;

  private constructor() {}

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private getHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const token = localStorage.getItem('morpheus.auth.token');
    const authHeaders: Record<string, string> = { ...headers };
    
    if (token) {
      authHeaders[AUTH_HEADER] = token;
    }
    
    return authHeaders;
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      localStorage.removeItem('morpheus.auth.token');
      // Redirect to login if not already there
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        const e = new Error(error.error || `HTTP error! status: ${response.status}`);
        // @ts-ignore
        e.details = error.details;
        throw e;
    }

    return response.json();
  }

  public async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  public async post<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  public async put<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  public async patch<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  public async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
}

export const httpClient = HttpClient.getInstance();
