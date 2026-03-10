import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { OracleNode } from './OracleNode';
import { AgentNode } from './AgentNode';
import { useSystemStream } from '../../../hooks/useSystemStream';
import type { FeedEntry } from '../../../hooks/useSystemStream';
import useSWR from 'swr';
import clsx from 'clsx';
import { SynapseLink } from './SynapseLink';
import { httpClient } from '../../../services/httpClient';
import { Maximize2, Minimize2 } from 'lucide-react';

interface AgentMeta {
  agentKey: string;
  label: string;
  emoji: string;
}

const fetcher = (url: string) => httpClient.get(url).then(res => res as any);

interface MorpheusVisualizerProps {
  className?: string;
}

const SKIP_AGENTS = new Set(['oracle']);

const FALLBACK_AGENTS: AgentMeta[] = [
  { agentKey: 'apoc', label: 'Apoc', emoji: '🧑‍🔬' },
  { agentKey: 'neo', label: 'Neo', emoji: '🥷' },
  { agentKey: 'trinit', label: 'Trinity', emoji: '👩‍💻' },
  { agentKey: 'smith', label: 'Smith', emoji: '🕶️' },
  { agentKey: 'link', label: 'Link', emoji: '🕵️‍♂️' },
  { agentKey: 'sati', label: 'Sati', emoji: '🧠' },
  { agentKey: 'chronos', label: 'Chronos', emoji: '⏰' },
  { agentKey: 'telephonist', label: 'Telephonist', emoji: '📞' },
];

const AGENT_COLORS: Record<string, string> = {
  oracle: '#00ff41',
  apoc: '#60a5fa',
  neo: '#e879f9',
  trinit: '#34d399',
  trinity: '#34d399',
  link: '#facc15',
  smith: '#a1a1aa',
  sati: '#fb7185',
  chronos: '#fb923c',
  telephonist: '#c084fc',
};

function generateOrbits(count: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const frac = i / Math.max(count - 1, 1);
    return {
      radius: 4.5 + frac * 2.5,
      speed: 0.35 - frac * 0.15,
      tiltX: Math.sin(i * golden) * 0.5,
      tiltZ: Math.cos(i * golden * 1.3) * 0.5,
      phase: i * golden,
    };
  });
}

export function MorpheusVisualizer({ className }: MorpheusVisualizerProps) {
  const { activeEvents, feed, isConnected } = useSystemStream();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useSWR<{ agents: AgentMeta[] }>('/agents/metadata', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000
  });

  const isOracleActive = activeEvents.length > 0;

  const agents: AgentMeta[] = useMemo(() => {
    const list = data?.agents?.length
      ? data.agents
          .filter(a => !SKIP_AGENTS.has(a.agentKey))
          .map(a => ({ agentKey: a.agentKey, label: a.label || a.agentKey, emoji: a.emoji }))
      : FALLBACK_AGENTS;
    const seen = new Set<string>();
    return list.filter(a => {
      if (seen.has(a.agentKey)) return false;
      seen.add(a.agentKey);
      return true;
    });
  }, [data]);

  const orbits = useMemo(() => generateOrbits(agents.length), [agents.length]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Sync isFullscreen state from the browser fullscreen API
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full h-full overflow-hidden rounded-xl",
        className
      )}
    >
      {/* Top-right controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {!isConnected && (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-900/50 rounded-md text-red-200 text-xs border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Disconnected
          </div>
        )}
        {isConnected && (
          <div className="flex items-center gap-2 px-2 py-1 bg-green-900/20 rounded-md text-green-400 text-xs border border-green-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
            {activeEvents.length > 0 && <span className="ml-1 px-1 bg-white/10 rounded">{activeEvents.length}</span>}
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors border border-white/10"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Activity feed timeline — bottom-left */}
      <ActivityFeed feed={feed} />

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 12], fov: 50 }}
        frameloop="always"
      >
        <color attach="background" args={['#060612']} />
        <ambientLight intensity={0.3} />
        <Stars radius={120} depth={60} count={4000} factor={5} saturation={0.2} fade speed={0.8} />
        <pointLight position={[0, 8, 0]} intensity={1.0} color="#6366f1" />
        <pointLight position={[0, -5, 0]} intensity={0.5} color="#0ea5e9" />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={5}
          maxDistance={25}
          autoRotate
          autoRotateSpeed={isOracleActive ? 1.2 : 0.3}
        />

        <OracleNode isActive={isOracleActive} activeCount={activeEvents.length} />

        {agents.map((agent, index) => {
          const activeEvent = activeEvents.find((e: any) => e.agent === agent.agentKey);
          const isActive = !!activeEvent;
          const orbit = orbits[index];

          return (
            <group key={agent.agentKey}>
              <AgentNode
                name={agent.label}
                agentKey={agent.agentKey}
                isActive={isActive}
                message={activeEvent?.message}
                orbitRadius={orbit.radius}
                orbitSpeed={orbit.speed}
                orbitTiltX={orbit.tiltX}
                orbitTiltZ={orbit.tiltZ}
                orbitPhase={orbit.phase}
              />
              <SynapseLink
                orbitRadius={orbit.radius}
                orbitSpeed={orbit.speed}
                orbitTiltX={orbit.tiltX}
                orbitTiltZ={orbit.tiltZ}
                orbitPhase={orbit.phase}
                agentKey={agent.agentKey}
                isActive={isActive}
              />
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}

// ─── Activity Feed ──────────────────────────────────────────────────────────

function ActivityFeed({ feed }: { feed: FeedEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [feed.length]);

  if (feed.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-3 left-3 z-10 max-h-48 w-72 overflow-hidden pointer-events-none flex flex-col justify-end gap-0.5"
    >
      {feed.map((entry) => (
        <FeedRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const [opacity, setOpacity] = useState(0);
  const color = AGENT_COLORS[entry.agent || ''] || '#888';
  const label = entry.source || entry.agent || 'system';

  // Fade in on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
  }, []);

  // Fade out before removal (starts at 4s, removed at 5s)
  useEffect(() => {
    const timer = setTimeout(() => setOpacity(0), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex items-start gap-1.5 text-[10px] leading-tight transition-opacity duration-700"
      style={{ opacity }}
    >
      <span
        className="shrink-0 font-bold uppercase tracking-wide"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-white/70 truncate">
        {entry.message}
      </span>
    </div>
  );
}
