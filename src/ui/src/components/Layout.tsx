import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Terminal, Settings, Activity, LayoutDashboard, Sun, Moon, LogOut, BarChart3 } from 'lucide-react';
import { Footer } from './Footer';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
    } else {
      setIsDark(true); // Default to Matrix / Dark
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Settings, label: 'Configuration', path: '/config' },
    { icon: BarChart3, label: 'Usage Stats', path: '/stats' },
    { icon: Terminal, label: 'Logs', path: '/logs' },
  ];

  return (
    <div className="flex flex-col h-screen bg-azure-bg dark:bg-black text-azure-text-primary dark:text-matrix-secondary font-mono overflow-hidden transition-colors duration-300">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <motion.div 
          className="w-64 border-r border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-950 flex flex-col shrink-0 transition-colors duration-300"
          initial={{ x: -64, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.9, type: 'spring' }}
        >
          <div className="p-4 border-b border-azure-border dark:border-matrix-primary flex justify-between items-center">
            <h1 className="text-xl font-bold text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
              <Activity className="w-6 h-6" />
              MORPHEUS
            </h1>
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-1 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-muted dark:text-matrix-secondary transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                    isActive 
                      ? 'bg-azure-active text-azure-primary dark:bg-matrix-primary dark:text-matrix-highlight' 
                      : 'hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Logout Button */}
          <div className="p-4 border-t border-azure-border dark:border-matrix-primary">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-secondary hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8 relative flex flex-col">
          <div className="max-w-6xl w-full mx-auto flex-1">
            {children}
          </div>
          
          {/* Scanline effect overlay (only in dark mode) */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,0,0.03),rgba(0,255,0,0.01))] bg-[length:100%_2px,3px_100%] opacity-0 dark:opacity-20 transition-opacity duration-300" />
        </main>
      </div>

      <Footer />
    </div>
  );
}
