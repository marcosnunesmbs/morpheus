import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('morpheus.auth.token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('morpheus.auth.token'));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (password: string) => {
    localStorage.setItem('morpheus.auth.token', password);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('morpheus.auth.token');
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return { isAuthenticated, login, logout };
};
