import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Terminal,
  Settings,
  Activity,
  LayoutDashboard,
  Sun,
  Moon,
  LogOut,
  BarChart3,
  RotateCcw,
  Puzzle,
  MessageSquare,
} from 'lucide-react';
import { Footer } from './Footer';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { MobileHeader } from './MobileHeader';
import { RestartConfirmationModal } from './RestartConfirmationModal';
import { httpClient } from '../services/httpClient';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to Matrix / Dark
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const { logout } = useAuth();

  const handleRestart = async () => {
    try {
      await httpClient.post('/restart', {});
      // Mostrar mensagem de sucesso ou redirecionar após restart
      alert('Restart initiated successfully. The agent will restart shortly.');
    } catch (error) {
      console.error('Failed to restart:', error);
      alert('Failed to restart the agent. Please try again.');
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Fecha o sidebar quando a rota muda em dispositivos móveis
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: Settings, label: 'Zaion', path: '/zaion' },
    { icon: Puzzle, label: 'MCP Servers', path: '/mcp-servers' },
    { icon: BarChart3, label: 'Usage Stats', path: '/stats' },
    { icon: Activity, label: 'Sati Memories', path: '/sati-memories' },
  ];

  const mobileNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: Settings, label: 'Zaion', path: '/zaion' },
    { icon: Puzzle, label: 'MCP Servers', path: '/mcp-servers' },
    { icon: BarChart3, label: 'Usage Stats', path: '/stats' },
    { icon: Activity, label: 'Sati Memories', path: '/sati-memories' },
  ];

  return (
    <div className="flex flex-col h-screen bg-azure-bg dark:bg-black text-azure-text-primary dark:text-matrix-secondary font-mono overflow-hidden transition-colors duration-300">
      {/* Mobile Header */}
      <MobileHeader
        onMenuClick={() => setIsSidebarOpen(true)}
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
      />

      <div className="flex flex-1 overflow-hidden pt-16 lg:pt-0">
        {' '}
        {/* Espaço para o header móvel */}
        {/* Sidebar */}
        {/* Desktop Sidebar - Always visible on lg and above */}
        <div className="hidden lg:flex w-64 border-r border-azure-border dark:border-matrix-primary/30 bg-azure-surface dark:bg-black flex-col shrink-0 transition-colors duration-300">
          <div className="p-4 border-b border-azure-border dark:border-matrix-primary/30 flex justify-between items-center">
            <h1 className="text-xl font-bold text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
              <Activity className="w-6 h-6" />
              MORPHEUS
            </h1>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-1 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-muted dark:text-matrix-secondary transition-colors"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
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
            <Link
              key="/logs"
              to="/logs"
              className={`flex items-center gap-3 px-4 py-3 rounded transition-colors ${
                location.pathname === '/logs'
                  ? 'bg-azure-active text-azure-primary dark:bg-matrix-primary dark:text-matrix-highlight'
                  : 'hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary'
              }`}
            >
              <Terminal className="w-5 h-5" />
              <span>Logs</span>
            </Link>
          </nav>

          {/* Restart Button */}
          <div className="p-2">
            <button
              onClick={() => setIsRestartModalOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Restart</span>
            </button>
          </div>

          {/* Logout Button */}
          <div className="p-2">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-secondary hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        {/* Mobile Sidebar - Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

              <motion.div
                className="absolute left-0 top-0 bottom-0 w-64 bg-azure-surface dark:bg-black flex flex-col shadow-xl"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-azure-border dark:border-matrix-primary/30 flex justify-between items-center">
                  <h1 className="text-xl font-bold text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    MORPHEUS
                  </h1>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-muted dark:text-matrix-secondary transition-colors"
                    aria-label="Fechar menu"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {mobileNavItems.map((item) => {
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
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  {/* Item "Logs" escondido em dispositivos móveis */}
                  <Link
                    to="/logs"
                    className="flex items-center gap-3 px-4 py-3 rounded transition-colors hidden lg:flex hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <Terminal className="w-5 h-5" />
                    <span>Logs</span>
                  </Link>
                </nav>

                {/* Restart Button */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsRestartModalOpen(true);
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-secondary dark:text-matrix-secondary transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Restart</span>
                  </button>
                </div>

                {/* Logout Button */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      logout();
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded w-full text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-azure-text-secondary dark:text-matrix-secondary hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Main Content */}
        <main className={`flex-1 p-4 md:p-8 relative flex flex-col ${location.pathname === '/chat' ? 'overflow-hidden' : 'overflow-auto'}`}>
          <div className={`w-full mx-auto flex-1 ${location.pathname === '/chat' ? 'h-full' : 'max-w-6xl'}`}>{children}</div>

          {/* Scanline effect overlay (only in dark mode) */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,0,0.03),rgba(0,255,0,0.01))] bg-[length:100%_2px,3px_100%] opacity-0 dark:opacity-20 transition-opacity duration-300" />
        </main>
      </div>

      <Footer />

      {/* Restart Confirmation Modal */}
      <RestartConfirmationModal
        isOpen={isRestartModalOpen}
        onClose={() => setIsRestartModalOpen(false)}
        onConfirm={handleRestart}
      />
    </div>
  );
}
