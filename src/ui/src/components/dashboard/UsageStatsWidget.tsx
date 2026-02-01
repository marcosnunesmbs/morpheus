import useSWR from 'swr';
import { statsService } from '../../services/stats';
import { StatCard } from './StatCard';
import { ArrowDown, ArrowUp } from 'lucide-react';

export function UsageStatsWidget() {
  const { data: stats } = useSWR('/api/stats/usage', statsService.fetchUsageStats, { refreshInterval: 5000 });

  return (
    <>
      <StatCard 
        title="Total Input" 
        value={stats ? stats.totalInputTokens.toLocaleString() : '-'} 
        icon={ArrowDown}
        subValue="Tokens processed"
      />
      <StatCard 
        title="Total Output" 
        value={stats ? stats.totalOutputTokens.toLocaleString() : '-'} 
        icon={ArrowUp}
        subValue="Tokens generated"
      />
    </>
  );
}
