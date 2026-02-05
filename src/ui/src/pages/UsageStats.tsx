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
          <p className="text-3xl font-bold text-azure-primary dark:text-matrix-highlight font-mono">
            {globalStats?.totalInputTokens.toLocaleString() ?? 0}
          </p>
        </motion.div>

        <motion.div variants={item} className="p-6 bg-azure-surface dark:bg-black/40 border border-azure-border dark:border-matrix-primary rounded-lg shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2 text-azure-text-muted dark:text-matrix-secondary">
            <Database className="w-5 h-5" />
            <h3 className="font-mono text-sm font-bold uppercase">Total Output Tokens</h3>
          </div>
          <p className="text-3xl font-bold text-azure-primary dark:text-matrix-highlight font-mono">
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
