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
    <div className="flex items-center justify-center min-h-screen bg-black text-green-500 font-mono">
      <div className="max-w-md w-full p-8 border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
        <h1 className="text-2xl font-bold mb-6 text-center tracking-widest uppercase">
          &gt; The Architect Login
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 opacity-70">ACCESS_PASS:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-green-800 p-2 focus:outline-none focus:border-green-500 placeholder-green-900"
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
            className="w-full bg-green-900 hover:bg-green-700 text-black font-bold py-2 transition-colors duration-200 uppercase tracking-wider"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-8 text-[10px] opacity-30 text-center uppercase">
          Morpheus OS v0.1.5 | Unauthorized access is logged.
        </div>
      </div>
    </div>
  );
};
