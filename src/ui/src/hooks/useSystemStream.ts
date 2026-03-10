import { useState, useEffect } from 'react';

export interface SystemActivityEvent {
  type: 'activity_start' | 'activity_end' | 'message' | 'connected';
  agent?: string;
  source?: string;
  message?: string;
  level?: string;
  timestamp: number;
  success?: boolean;
}

export function useSystemStream() {
  const [activeEvents, setActiveEvents] = useState<SystemActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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
        
        switch (parsed.type) {
          case 'connected':
            setIsConnected(true);
            break;
            
          case 'activity_start':
            // Add or update active agent activity
            setActiveEvents(prev => {
              const filtered = prev.filter(e => e.agent !== parsed.agent);
              return [...filtered, parsed];
            });
            break;
            
          case 'activity_end':
            // An activity ended, we can safely remove the event that was keeping that agent "busy" 
            // In a more complex scenario we might match by ID, but since there's usually 1 spinner at a time:
            setActiveEvents([]);
            break;
            
          case 'message':
            // For now, purely for 3D flash effects, we'll keep the message for 2 seconds
            // so the 3D canvas can react to it, then fade it out.
            setActiveEvents(prev => [...prev.slice(-4), parsed]); // keep last 5 max
            
            setTimeout(() => {
              setActiveEvents(prev => prev.filter(e => e !== parsed));
            }, 3000);
            break;
        }
      } catch (err) {
        console.error('Error parsing SSE', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects by default
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { activeEvents, isConnected };
}
