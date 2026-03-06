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

  public async delete<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return this.handleResponse(response);
  }

  public async uploadFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(), // No Content-Type - browser sets it with boundary
      body: formData,
    });
    return this.handleResponse(response);
  }

  public uploadFileWithProgress<T>(
    path: string,
    file: File,
    onProgress: (percent: number) => void,
    fieldName = 'file'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append(fieldName, file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          localStorage.removeItem('morpheus.auth.token');
          if (!window.location.pathname.endsWith('/login')) {
            window.location.href = '/login';
          }
          reject(new Error('Unauthorized'));
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data as T);
          } else {
            const e = new Error(data.error || `HTTP error! status: ${xhr.status}`);
            // @ts-ignore
            e.details = data.details;
            reject(e);
          }
        } catch {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));

      xhr.open('POST', `${API_BASE}${path}`);
      const headers = this.getHeaders();
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.send(formData);
    });
  }
}

export const httpClient = HttpClient.getInstance();
