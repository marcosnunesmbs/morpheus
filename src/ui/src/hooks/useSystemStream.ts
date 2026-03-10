import { useState, useEffect, useCallback, useRef } from 'react';

export interface SystemActivityEvent {
  type: 'activity_start' | 'activity_end' | 'message' | 'connected';
  agent?: string;
  source?: string;
  message?: string;
  level?: string;
  timestamp: number;
  success?: boolean;
}

export interface FeedEntry {
  id: number;
  agent?: string;
  source?: string;
  message: string;
  level?: string;
  timestamp: number;
}

// Map display source names to agentKey used in SubagentRegistry
const SOURCE_TO_AGENT: Record<string, string> = {
  oracle: 'oracle',
  apoc: 'apoc',
  neo: 'neo',
  trinity: 'trinit',
  trinit: 'trinit',
  link: 'link',
  smith: 'smith',
  sati: 'sati',
  chronos: 'chronos',
  smithregistry: 'smith',
  smithdelegatetool: 'smith',
  smithdelegator: 'smith',
  smithconnection: 'smith',
  telephonist: 'telephonist',
};

/** Resolve agent key from either `agent` or `source` field */
function resolveAgent(event: SystemActivityEvent): string | undefined {
  if (event.agent) {
    const key = event.agent.toLowerCase();
    return SOURCE_TO_AGENT[key] || key;
  }
  if (event.source) {
    const key = event.source.toLowerCase();
    return SOURCE_TO_AGENT[key] || key;
  }
  return undefined;
}

let feedIdCounter = 0;

const FEED_TTL_MS = 5000;
const MAX_FEED = 12;

export function useSystemStream() {
  const [activeEvents, setActiveEvents] = useState<SystemActivityEvent[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const addTimedEvent = useCallback((event: SystemActivityEvent, durationMs: number) => {
    setActiveEvents(prev => [...prev.slice(-6), event]);

    const timer = setTimeout(() => {
      setActiveEvents(prev => prev.filter(e => e !== event));
      timersRef.current.delete(timer);
    }, durationMs);
    timersRef.current.add(timer);
  }, []);

  const addFeedEntry = useCallback((event: SystemActivityEvent) => {
    if (!event.message) return;
    const id = ++feedIdCounter;
    const entry: FeedEntry = {
      id,
      agent: event.agent,
      source: event.source,
      message: event.message,
      level: event.level,
      timestamp: event.timestamp || Date.now(),
    };

    setFeed(prev => [...prev.slice(-(MAX_FEED - 1)), entry]);

    // Auto-remove after TTL
    const timer = setTimeout(() => {
      setFeed(prev => prev.filter(e => e.id !== id));
      timersRef.current.delete(timer);
    }, FEED_TTL_MS);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('morpheus.auth.token');
    const url = `/api/display/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed: SystemActivityEvent = JSON.parse(event.data);
        parsed.agent = resolveAgent(parsed);

        switch (parsed.type) {
          case 'connected':
            setIsConnected(true);
            break;

          case 'activity_start':
            setActiveEvents(prev => {
              const filtered = prev.filter(e => !(e.type === 'activity_start' && e.agent === parsed.agent));
              return [...filtered, parsed];
            });
            addFeedEntry(parsed);
            break;

          case 'activity_end':
            setActiveEvents(prev => prev.filter(e => e.type !== 'activity_start'));
            break;

          case 'message':
            addTimedEvent(parsed, 3500);
            addFeedEntry(parsed);
            break;
        }
      } catch (err) {
        console.error('Error parsing SSE', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [addTimedEvent, addFeedEntry]);

  return { activeEvents, feed, isConnected };
}
