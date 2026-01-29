import { useStatus } from '@/lib/api';
import { Activity, Cpu, Clock, Brain, Box } from 'lucide-react';

export function Dashboard() {
  const { data: status } = useStatus();

  const StatCard = ({ title, value, icon: Icon, subValue }: any) => (
    <div className="border border-matrix-primary bg-zinc-950/50 p-6 rounded relative overflow-hidden group hover:border-matrix-highlight transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-matrix-secondary text-sm font-bold uppercase">{title}</h3>
        <Icon className="w-6 h-6 text-matrix-primary group-hover:text-matrix-highlight transition-colors" />
      </div>
      <div className="text-3xl font-bold text-matrix-highlight mb-1 font-mono tracking-tighter truncate">{value}</div>
      {subValue && <div className="text-xs text-matrix-secondary opacity-70 font-mono">{subValue}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-matrix-highlight mb-2">SYSTEM STATUS</h2>
        <p className="text-matrix-secondary opacity-80">Overview of the Morpheus agent runtime.</p>
      </div>

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
      </div>
    </div>
  );
}
