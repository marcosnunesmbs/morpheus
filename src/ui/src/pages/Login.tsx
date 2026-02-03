import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setError('');
    
    // Test the password by making a dummy call (e.g. to config)
    // We already have httpClient that handles 401
    // But here we want to stay on the page if it fails
    
    fetch('/api/config', {
      headers: {
        'x-architect-pass': password
      }
    })
    .then(async res => {
      if (res.ok) {
        localStorage.setItem('morpheus.auth.token', password);
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError('Invalid architect password');
      }
    })
    .catch(() => {
      setError('Connection failed');
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-azure-bg dark:bg-black text-azure-primary dark:text-green-500 font-mono">
      <div className="max-w-md w-full p-8 border border-azure-primary dark:border-green-500 shadow-xl dark:shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-white dark:bg-black rounded-lg dark:rounded-none">
        <h1 className="text-2xl font-bold mb-6 text-center tracking-widest uppercase text-azure-primary dark:text-green-500">
          &gt; The Architect Login
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 opacity-70 text-azure-text-secondary dark:text-green-500">ACCESS_PASS:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-azure-bg dark:bg-black border border-azure-border dark:border-green-800 p-2 focus:outline-none focus:border-azure-primary dark:focus:border-green-500 text-azure-text-primary dark:text-green-500 placeholder-azure-text-secondary/50 dark:placeholder-green-900 rounded dark:rounded-none"
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm animate-pulse">
              [!] ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-azure-primary hover:bg-azure-active dark:bg-green-900 dark:hover:bg-green-700 text-white dark:text-black font-bold py-2 transition-colors duration-200 uppercase tracking-wider rounded dark:rounded-none"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-8 text-[10px] opacity-30 text-center uppercase text-azure-text-secondary dark:text-green-500">
          Morpheus OS v0.1.5 | Unauthorized access is logged.
        </div>
      </div>
    </div>
  );
};
