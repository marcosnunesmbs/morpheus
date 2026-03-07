import useSWR from 'swr';
import { httpClient } from './httpClient';

export interface AgentDisplayMeta {
  agentKey: string;
  auditAgent: string;
  label: string;
  delegateToolName: string;
  emoji: string;
  color: string;
  description: string;
  colorClass: string;
  bgClass: string;
  badgeClass: string;
}

interface AgentsResponse {
  agents: AgentDisplayMeta[];
}

const FALLBACK_META: AgentDisplayMeta = {
  agentKey: 'unknown', auditAgent: 'unknown', label: 'Unknown',
  delegateToolName: '', emoji: '🤖', color: 'gray',
  description: '',
  colorClass: 'text-gray-500 dark:text-gray-400',
  bgClass: 'bg-gray-50 dark:bg-zinc-900',
  badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export function useAgentMetadata() {
  const { data } = useSWR<AgentsResponse>(
    '/api/agents/metadata',
    (url: string) => httpClient.get<AgentsResponse>(url.replace('/api', '')),
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const agents = data?.agents ?? [];

  return {
    agents,
    getByKey(key: string): AgentDisplayMeta {
      return agents.find(a => a.agentKey === key || a.auditAgent === key) ?? { ...FALLBACK_META, agentKey: key, label: key };
    },
    getByToolName(toolName: string): AgentDisplayMeta {
      return agents.find(a => a.delegateToolName === toolName) ?? { ...FALLBACK_META, delegateToolName: toolName, label: toolName };
    },
    getEmoji(key: string): string {
      return agents.find(a => a.agentKey === key || a.auditAgent === key)?.emoji ?? '🤖';
    },
    getBadgeClass(key: string): string {
      return agents.find(a => a.agentKey === key || a.auditAgent === key)?.badgeClass ?? FALLBACK_META.badgeClass;
    },
    getSubagents(): AgentDisplayMeta[] {
      return agents.filter(a => a.delegateToolName !== '');
    },
  };
}
