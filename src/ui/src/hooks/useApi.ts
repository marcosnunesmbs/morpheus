import { useState, useCallback } from 'react';
import { httpClient } from '../services/httpClient';

interface ApiHook {
  get: <T = any>(endpoint: string) => Promise<T>;
  post: <T = any, D = any>(endpoint: string, data?: D) => Promise<T>;
  put: <T = any, D = any>(endpoint: string, data?: D) => Promise<T>;
  del: <T = any>(endpoint: string) => Promise<T>;
  loading: boolean;
  error: string | null;
}

export const useApi = (): ApiHook => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(<T,>(endpoint: string): Promise<T> => {
    setLoading(true);
    setError(null);

    return httpClient.get<T>(endpoint)
      .then(result => {
        return result;
      })
      .catch(err => {
        setError(err.message || 'An error occurred');
        throw err;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const post = useCallback(<T, D>(endpoint: string, data?: D): Promise<T> => {
    setLoading(true);
    setError(null);

    return httpClient.post<T>(endpoint, data)
      .then(result => {
        return result;
      })
      .catch(err => {
        setError(err.message || 'An error occurred');
        throw err;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const put = useCallback(<T, D>(endpoint: string, data?: D): Promise<T> => {
    setLoading(true);
    setError(null);

    return httpClient.post<T>(endpoint, data) // Using post since there's no put in httpClient
      .then(result => {
        return result;
      })
      .catch(err => {
        setError(err.message || 'An error occurred');
        throw err;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const del = useCallback(<T,>(endpoint: string): Promise<T> => {
    setLoading(true);
    setError(null);

    return httpClient.delete<T>(endpoint)
      .then(result => {
        return result;
      })
      .catch(err => {
        setError(err.message || 'An error occurred');
        throw err;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { get, post, put, del, loading, error };
};