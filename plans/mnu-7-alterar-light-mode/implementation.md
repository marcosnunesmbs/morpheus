# Alterar Light Mode para Tons de Azul

## Goal
Substituir todas as cores verdes em light mode por uma paleta profissional de tons de azul, mantendo o tema Matrix verde intacto no dark mode.

## Prerequisites
Make sure that the use is currently on the `mnu-7-alterar-light-mode` branch before beginning implementation.
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Definir paleta Azure e estilos base
- [x] Atualize o Tailwind config com a nova paleta azure.
- [x] Copy and paste code below into `src/ui/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        azure: {
          bg: '#F0F4F8',
          surface: '#FFFFFF',
          primary: '#0066CC',
          secondary: '#4A90E2',
          accent: '#2196F3',
          border: '#B3D4FC',
          hover: '#E3F2FD',
          active: '#BBDEFB',
          text: {
            primary: '#1A1A1A',
            secondary: '#5C6B7D',
            muted: '#8899A8',
          },
        },
        matrix: {
          bg: '#000000',
          base: '#0D0208',
          primary: '#003B00',
          secondary: '#008F11', // Darker Green
          highlight: '#00FF41', // Bright Green
          text: '#008F11',
        },
        zinc: {
           950: '#0c0c0c', 
        }
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

- [x] Atualize os estilos base do light mode e scrollbar.
- [x] Copy and paste code below into `src/ui/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-azure-bg text-azure-text-primary font-mono dark:bg-black dark:text-matrix-secondary transition-colors duration-300;
  }
  
  /* Custom Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    @apply bg-azure-bg dark:bg-black; 
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-azure-border dark:bg-matrix-primary; 
  }
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-azure-secondary dark:bg-matrix-secondary; 
  }
}
```

##### Step 1 Verification Checklist
- [ ] No build errors
- [ ] Classes `azure-*` aparecem no DevTools e podem ser usadas
- [ ] Scrollbar em light mode usa tons de azul

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 2: Atualizar layout principal e navegação
- [x] Substitua as cores verdes em light mode e aplique a paleta azure no layout.
- [x] Copy and paste code below into `src/ui/src/components/Layout.tsx`:

```tsx
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
```

##### Step 2 Verification Checklist
- [ ] No build errors
- [ ] Título MORPHEUS aparece em azul no light mode
- [ ] Navegação ativa mostra fundo azul claro em light mode
- [ ] Hover nos links da sidebar usa azul claro

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 3: Atualizar páginas principais
- [ ] Atualize a página Dashboard para usar azure em light mode.
- [ ] Copy and paste code below into `src/ui/src/pages/Dashboard.tsx`:

```tsx
import { useStatus } from '@/lib/api';
import { Activity, Cpu, Clock, Brain, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '../components/dashboard/StatCard';
import { UsageStatsWidget } from '../components/dashboard/UsageStatsWidget';

export function Dashboard() {
  const { data: status } = useStatus();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight mb-2">SYSTEM STATUS</h2>
        <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">Overview of the Morpheus agent runtime.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Agent Status" 
          value={status?.status.toUpperCase() || 'CONNECTING...'} 
          icon={Activity}
          subValue={status ? `PID: ${status.pid}` : ''}
        />
        <StatCard 
          title="Uptime" 
          value={status ? `${Math.floor(status.uptimeSeconds / 60)}m` : '-'} 
          icon={Clock}
          subValue={status ? `${status.uptimeSeconds.toFixed(0)} seconds` : ''}
        />
        <StatCard 
          title="Version" 
          value={status?.projectVersion || '-'} 
          icon={Cpu}
          subValue={`Node ${status?.nodeVersion || '-'}`}
        />
        <StatCard 
          title="Provider" 
          value={status?.llmProvider?.toUpperCase() || '-'} 
          icon={Brain}
          subValue="LLM Inference Engine"
        />
        <StatCard 
          title="Model" 
          value={status?.llmModel || '-'} 
          icon={Box}
          subValue="Active Model"
        />
        <UsageStatsWidget />
      </div>
    </motion.div>
  );
}
```

- [ ] Atualize a página UsageStats para usar azure em light mode.
- [ ] Copy and paste code below into `src/ui/src/pages/UsageStats.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Database, MessageSquare } from 'lucide-react';
import { statsService } from '../services/stats';
import type { ProviderModelUsageStats } from '../services/stats';
// @ts-ignore
import type { UsageStats } from '../../../../specs/016-ui-config-stats/contracts/api-stats';

export function UsageStats() {
  const [globalStats, setGlobalStats] = useState<UsageStats | null>(null);
  const [groupedStats, setGroupedStats] = useState<ProviderModelUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [global, grouped] = await Promise.all([
          statsService.fetchUsageStats(),
          statsService.fetchGroupedUsageStats()
        ]);
        setGlobalStats(global);
        setGroupedStats(grouped);
      } catch (err) {
        setError('Failed to load usage statistics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-azure-accent dark:text-matrix-highlight font-mono animate-pulse">
        LOADING_DATA_STREAM...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-500 font-mono rounded">
        ERROR_ACCESSING_DATABASE: {error}
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="flex items-center justify-between border-b border-azure-border dark:border-matrix-primary pb-4">
        <div>
          <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight font-mono flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            USAGE_ANALYTICS
          </h2>
          <p className="text-azure-text-muted dark:text-matrix-secondary mt-1 font-mono text-sm">
            Resource consumption tracking and metrics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div variants={item} className="p-6 bg-azure-surface dark:bg-black/40 border border-azure-border dark:border-matrix-primary rounded-lg shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2 text-azure-text-muted dark:text-matrix-secondary">
            <MessageSquare className="w-5 h-5" />
            <h3 className="font-mono text-sm font-bold uppercase">Total Input Tokens</h3>
          </div>
          <p className="text-3xl font-bold text-azure-text-primary dark:text-matrix-highlight font-mono">
            {globalStats?.totalInputTokens.toLocaleString() ?? 0}
          </p>
        </motion.div>

        <motion.div variants={item} className="p-6 bg-azure-surface dark:bg-black/40 border border-azure-border dark:border-matrix-primary rounded-lg shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2 text-azure-text-muted dark:text-matrix-secondary">
            <Database className="w-5 h-5" />
            <h3 className="font-mono text-sm font-bold uppercase">Total Output Tokens</h3>
          </div>
          <p className="text-3xl font-bold text-azure-text-primary dark:text-matrix-highlight font-mono">
            {globalStats?.totalOutputTokens.toLocaleString() ?? 0}
          </p>
        </motion.div>
      </div>

      <motion.div variants={item} className="bg-azure-surface dark:bg-black/40 border border-azure-border dark:border-matrix-primary rounded-lg overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-azure-border dark:border-matrix-primary bg-azure-bg dark:bg-zinc-900/50">
          <h3 className="text-lg font-bold text-azure-text-primary dark:text-matrix-highlight font-mono uppercase">
            Usage Breakdown by Model
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-sm">
            <thead className="bg-azure-bg dark:bg-zinc-900/50 text-azure-text-secondary dark:text-matrix-secondary border-b border-azure-border dark:border-matrix-primary">
              <tr>
                <th className="p-4">Provider</th>
                <th className="p-4">Model</th>
                <th className="p-4 text-right">Messages</th>
                <th className="p-4 text-right">Input Tokens</th>
                <th className="p-4 text-right">Output Tokens</th>
                <th className="p-4 text-right">Total Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-azure-border dark:divide-matrix-primary/30">
              {groupedStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-azure-text-muted dark:text-matrix-secondary italic">
                    NO_DATA_AVAILABLE
                  </td>
                </tr>
              ) : (
                groupedStats.map((stat, idx) => (
                  <tr key={`${stat.provider}-${stat.model}-${idx}`} className="hover:bg-azure-hover dark:hover:bg-matrix-primary/10 transition-colors">
                    <td className="p-4 font-bold text-azure-text-primary dark:text-matrix-highlight">{stat.provider}</td>
                    <td className="p-4 text-azure-text-secondary dark:text-matrix-secondary">{stat.model}</td>
                    <td className="p-4 text-right text-azure-text-primary dark:text-gray-300">{stat.messageCount.toLocaleString()}</td>
                    <td className="p-4 text-right text-azure-text-primary dark:text-gray-300">{stat.totalInputTokens.toLocaleString()}</td>
                    <td className="p-4 text-right text-azure-text-primary dark:text-gray-300">{stat.totalOutputTokens.toLocaleString()}</td>
                    <td className="p-4 text-right font-bold text-azure-text-primary dark:text-matrix-highlight">{stat.totalTokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] Atualize a página Config para usar azure em light mode.
- [ ] Copy and paste code below into `src/ui/src/pages/Config.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useConfig, saveConfig } from '@/lib/api';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function Config() {
  const { data: config, mutate } = useConfig();
  const [jsonStr, setJsonStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setJsonStr(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);
      const parsed = JSON.parse(jsonStr);
      await saveConfig(parsed);
      await mutate();
      setSuccess('Configuration saved successfully');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <motion.div 
      className="h-full flex flex-col space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
       <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">CONFIGURATION</h2>
            <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">Edit agent settings (JSON).</p>
         </div>
         <button 
           onClick={handleSave}
           className="bg-azure-primary hover:bg-azure-secondary text-white dark:bg-matrix-primary dark:hover:bg-matrix-secondary dark:text-matrix-highlight px-4 py-2 rounded flex items-center gap-2 font-bold transition-colors"
         >
           <Save className="w-5 h-5" />
           SAVE CHANGES
         </button>
       </div>

       {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-500 p-3 rounded flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
       )}

       {success && (
        <div className="bg-azure-hover border border-azure-border text-azure-primary dark:bg-matrix-primary/20 dark:border-matrix-secondary dark:text-matrix-highlight p-3 rounded flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
       )}

       <div className="flex-1 bg-azure-surface dark:bg-zinc-950 border border-azure-border dark:border-matrix-primary rounded p-0 overflow-hidden">
         <textarea
           value={jsonStr}
           onChange={(e) => setJsonStr(e.target.value)}
           className="w-full h-full bg-azure-surface dark:bg-zinc-950 text-azure-text-primary dark:text-matrix-highlight font-mono p-4 outline-none resize-none"
           spellCheck={false}
         />
       </div>
    </motion.div>
  );
}
```

- [ ] Atualize a página Logs para usar azure em light mode.
- [ ] Copy and paste code below into `src/ui/src/pages/Logs.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useLogs, useLogContent } from '@/lib/api';
import { FileText, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function Logs() {
  const { data: files } = useLogs();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { data: content, mutate } = useLogContent(selectedFile);

  useEffect(() => {
    if (!selectedFile && files && files.length > 0) {
      setSelectedFile(files[0].name);
    }
  }, [files, selectedFile]);

  return (
    <motion.div 
      className="h-full flex flex-col space-y-4"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">SYSTEM LOGS</h2>
        <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">View runtime logs.</p>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden border border-azure-border dark:border-matrix-primary rounded bg-azure-surface dark:bg-zinc-950 p-4">
        {/* File List */}
        <div className="w-64 flex flex-col gap-2 border-r border-azure-border dark:border-matrix-primary pr-4 overflow-y-auto shrink-0">
          <h3 className="font-bold text-azure-text-secondary dark:text-matrix-secondary mb-2 sticky top-0 bg-azure-surface dark:bg-zinc-950">LOG FILES</h3>
          {files?.map(f => (
            <button
              key={f.name}
              onClick={() => setSelectedFile(f.name)}
              className={`text-left px-3 py-2 rounded text-sm truncate flex items-center gap-2 group transition-colors ${
                selectedFile === f.name 
                ? 'bg-azure-active text-azure-primary dark:bg-matrix-primary dark:text-matrix-highlight' 
                : 'text-azure-text-secondary dark:text-matrix-secondary hover:bg-azure-hover dark:hover:bg-zinc-900 group-hover:text-azure-primary dark:group-hover:text-matrix-highlight'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate font-bold">{f.name}</span>
                <span className="text-xs opacity-70">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content Viewer */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-azure-bg dark:bg-black border border-azure-border dark:border-matrix-primary/50 rounded">
          <div className="flex justify-between items-center p-2 bg-azure-hover dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary/50">
            <span className="text-azure-text-primary dark:text-matrix-highlight font-bold font-mono text-sm">{selectedFile}</span>
            <button onClick={() => mutate()} className="text-azure-text-secondary dark:text-matrix-secondary hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-azure-text-primary dark:text-white">
            {content ? content.lines.join('\n') : 'Select a log file to view content...'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

##### Step 3 Verification Checklist
- [ ] No build errors
- [ ] Dashboard mostra títulos e textos em azul no light mode
- [ ] UsageStats tem cards, tabela e hover em azul no light mode
- [ ] Config mostra botão e sucesso em azul no light mode
- [ ] Logs usa fundo e bordas azuis no light mode
- [ ] Dark mode permanece com tema Matrix verde

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 4: Atualizar componentes reutilizáveis
- [ ] Atualize o componente StatCard para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/dashboard/StatCard.tsx`:

```tsx
import { motion } from 'framer-motion';

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export const StatCard = ({ title, value, icon: Icon, subValue }: any) => (
  <motion.div 
    variants={item}
    className="border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-950/50 p-6 rounded relative overflow-hidden group hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
  >
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-azure-text-secondary dark:text-matrix-secondary text-sm font-bold uppercase">{title}</h3>
      <Icon className="w-6 h-6 text-azure-primary dark:text-matrix-primary group-hover:text-azure-accent dark:group-hover:text-matrix-highlight transition-colors" />
    </div>
    <div className="text-3xl font-bold text-azure-text-primary dark:text-matrix-highlight mb-1 font-mono tracking-tighter truncate">{value}</div>
    {subValue && <div className="text-xs text-azure-text-muted dark:text-matrix-secondary opacity-70 font-mono">{subValue}</div>}
  </motion.div>
);
```

- [ ] Atualize o componente Section para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/forms/Section.tsx`:

```tsx
import { type ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <div className="border border-azure-border dark:border-matrix-primary rounded-lg p-6 bg-azure-surface dark:bg-matrix-base/50">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-azure-text-primary dark:text-matrix-highlight">{title}</h3>
        {description && (
          <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
```

- [ ] Atualize o componente TextInput para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/forms/TextInput.tsx`:

```tsx
import { type InputHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export function TextInput({ label, error, helperText, className, ...props }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-azure-text-secondary dark:text-matrix-highlight/80">
        {label}
      </label>
      <input
        className={twMerge(
          "bg-azure-surface dark:bg-matrix-base border border-azure-border dark:border-matrix-primary text-azure-text-primary dark:text-matrix-highlight placeholder-azure-text-muted dark:placeholder-matrix-secondary/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:border-azure-primary dark:focus:border-matrix-highlight transition-colors",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {helperText && !error && (
        <p className="text-xs text-azure-text-muted dark:text-matrix-secondary">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
```

- [ ] Atualize o componente SelectInput para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/forms/SelectInput.tsx`:

```tsx
import { type SelectHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string | number }[];
  error?: string;
  helperText?: string;
}

export function SelectInput({ label, options, error, helperText, className, ...props }: SelectInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-azure-text-secondary dark:text-matrix-highlight/80">
        {label}
      </label>
      <select
        className={twMerge(
          "bg-azure-surface dark:bg-matrix-base border border-azure-border dark:border-matrix-primary text-azure-text-primary dark:text-matrix-highlight rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:border-azure-primary dark:focus:border-matrix-highlight transition-colors appearance-none",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-azure-surface dark:bg-matrix-base">
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && !error && (
        <p className="text-xs text-azure-text-muted dark:text-matrix-secondary">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
```

- [ ] Atualize o componente NumberInput para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/forms/NumberInput.tsx`:

```tsx
import { type InputHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export function NumberInput({ label, error, helperText, className, ...props }: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-azure-text-secondary dark:text-matrix-highlight/80">
        {label}
      </label>
      <input
        type="number"
        className={twMerge(
          "bg-azure-surface dark:bg-matrix-base border border-azure-border dark:border-matrix-primary text-azure-text-primary dark:text-matrix-highlight placeholder-azure-text-muted dark:placeholder-matrix-secondary/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:border-azure-primary dark:focus:border-matrix-highlight transition-colors",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {helperText && !error && (
        <p className="text-xs text-azure-text-muted dark:text-matrix-secondary">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
```

- [ ] Atualize o componente Switch para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/forms/Switch.tsx`:

```tsx
import { twMerge } from 'tailwind-merge';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helperText?: string;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, helperText, disabled }: SwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={twMerge("text-sm font-medium text-azure-text-secondary dark:text-matrix-highlight/80", disabled && "opacity-50")}>{label}</span>
        {helperText && <span className="text-xs text-azure-text-muted dark:text-matrix-secondary">{helperText}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={twMerge(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-highlight focus:ring-offset-2 focus:ring-offset-azure-bg dark:focus:ring-offset-black",
          checked ? "bg-azure-primary dark:bg-matrix-highlight" : "bg-azure-border dark:bg-matrix-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={twMerge(
            "inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] Atualize o Footer para light mode.
- [ ] Copy and paste code below into `src/ui/src/components/Footer.tsx`:

```tsx
import { useStatus } from '@/lib/api';

export function Footer() {
  const { data: status } = useStatus();

  return (
    <footer className="h-8 bg-azure-surface dark:bg-zinc-950 border-t border-azure-border dark:border-matrix-primary flex items-center px-4 text-xs justify-between select-none z-10 shrink-0 text-azure-text-secondary dark:text-matrix-secondary">
      <div className="flex gap-4">
        <span className={status ? 'text-azure-primary dark:text-matrix-highlight' : 'text-red-500'}>
           ● {status?.status.toUpperCase() || 'OFFLINE'}
        </span>
        <span>PID: {status?.pid || '-'}</span>
        <span>UPTIME: {status ? Math.floor(status.uptimeSeconds / 60) + 'm' : '-'}</span>
      </div>
      <div className="flex gap-4 opacity-70">
        <span>v{status?.projectVersion || '0.0.0'}</span>
        <span>{status?.agentName || 'Morpheus'}</span>
      </div>
    </footer>
  );
}
```

##### Step 4 Verification Checklist
- [ ] No build errors
- [ ] Cards e formulários usam azul no light mode
- [ ] Footer em light mode tem fundo branco e bordas azuis
- [ ] Dark mode permanece verde Matrix

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 5: Redesenhar Login Page
- [ ] Atualize a página Login para respeitar light/dark mode com azul no light mode.
- [ ] Copy and paste code below into `src/ui/src/pages/Login.tsx`:

```tsx
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
    <div className="flex items-center justify-center min-h-screen bg-azure-bg text-azure-primary font-mono dark:bg-black dark:text-matrix-highlight">
      <div className="max-w-md w-full p-8 border border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-black/60 shadow-[0_0_15px_rgba(0,102,204,0.25)] dark:shadow-[0_0_15px_rgba(34,197,94,0.3)]">
        <h1 className="text-2xl font-bold mb-6 text-center tracking-widest uppercase">
          &gt; The Architect Login
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-azure-text-secondary dark:text-matrix-secondary opacity-70">ACCESS_PASS:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-azure-surface dark:bg-black border border-azure-border dark:border-matrix-primary p-2 text-azure-text-primary dark:text-matrix-highlight focus:outline-none focus:border-azure-primary dark:focus:border-matrix-highlight placeholder-azure-text-muted dark:placeholder-matrix-secondary/50"
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
            className="w-full bg-azure-primary hover:bg-azure-secondary text-white dark:bg-matrix-primary dark:hover:bg-matrix-secondary dark:text-matrix-highlight font-bold py-2 transition-colors duration-200 uppercase tracking-wider"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-8 text-[10px] text-azure-text-muted dark:text-matrix-secondary opacity-70 text-center uppercase">
          Morpheus OS v0.1.5 | Unauthorized access is logged.
        </div>
      </div>
    </div>
  );
};
```

##### Step 5 Verification Checklist
- [ ] No build errors
- [ ] Login em light mode usa fundo azul claro e botão azul
- [ ] Login em dark mode mantém estilo Matrix verde

#### Step 5 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 6: Testes finais e acessibilidade
- [ ] Executar a UI e alternar entre light/dark mode em todas as páginas
- [ ] Verificar contraste com Lighthouse (Acessibilidade >= 95)
- [ ] Validar responsividade em 375px, 768px e 1024px
- [ ] Confirmar que nenhum componente ficou verde no light mode

##### Step 6 Verification Checklist
- [ ] No build errors
- [ ] Todos os textos em light mode seguem a paleta azure
- [ ] Dark mode permanece Matrix verde sem regressões

#### Step 6 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
