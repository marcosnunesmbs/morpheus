import { useStatus } from '@/lib/api';
import { Activity, Cpu, Clock, Brain, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '../components/dashboard/StatCard';
import { UsageStatsWidget } from '../components/dashboard/UsageStatsWidget';
import { formatUptime } from '@/lib/formatUptime';

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
          value={status ? formatUptime(status.uptimeSeconds) : '-'} 
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
