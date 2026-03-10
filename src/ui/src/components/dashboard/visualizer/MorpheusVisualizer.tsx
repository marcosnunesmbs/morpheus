import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
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

// ─── Rocket Animation ──────────────────────────────────────────────────────────

function RocketAnimation() {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number>(Date.now());

  useFrame(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds since mount
    
    // Rocket flies upward from center
    if (groupRef.current) {
      groupRef.current.position.y = elapsed * 4 - 1; // Start at y=-1, move up
      groupRef.current.position.x = Math.sin(elapsed * 3) * 0.2;
      groupRef.current.rotation.z = Math.sin(elapsed * 2) * 0.1; // Slight tilt
    }
  });

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      {/* Rocket body */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.4, 8]} />
        <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={0.8} />
      </mesh>
      
      {/* Rocket fins */}
      <mesh position={[0.12, -0.15, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff6b35" />
      </mesh>
      <mesh position={[-0.12, -0.15, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff6b35" />
      </mesh>
      <mesh position={[0, -0.15, 0.12]}>
        <boxGeometry args={[0.02, 0.08, 0.15]} />
        <meshStandardMaterial color="#ff6b35" />
      </mesh>
      <mesh position={[0, -0.15, -0.12]}>
        <boxGeometry args={[0.02, 0.08, 0.15]} />
        <meshStandardMaterial color="#ff6b35" />
      </mesh>

      {/* Flame */}
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.06, 0.15, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.32, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.04, 0.1, 8]} />
        <meshBasicMaterial color="#ff4500" transparent opacity={1} />
      </mesh>
    </group>
  );
}

export function MorpheusVisualizer({ className }: MorpheusVisualizerProps) {
  const { activeEvents, feed, isConnected } = useSystemStream();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRocket, setShowRocket] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for message_sent events to trigger rocket animation
  useEffect(() => {
    const handleMessageSent = () => {
      setShowRocket(true);
      setTimeout(() => setShowRocket(false), 1500);
    };

    window.addEventListener('morpheus:message_sent', handleMessageSent);
    return () => {
      window.removeEventListener('morpheus:message_sent', handleMessageSent);
    };
  }, []);

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

        {/* Rocket animation when message is sent */}
        {showRocket && <RocketAnimation />}

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
// Matrix-style: green code falling from top, longer duration

const MATRIX_GREEN = '#00ff41';
const MATRIX_DIM = '#00aa2a';

function ActivityFeed({ feed }: { feed: FeedEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top for new entries (Matrix style: falls from top)
  useEffect(() => {
    if (listRef.current && feed.length > 0) {
      listRef.current.scrollTop = 0;
    }
  }, [feed.length]);

  return (
    <div
      ref={listRef}
      className="absolute top-3 left-3 z-10 max-h-56 w-80 overflow-hidden pointer-events-none"
      style={{
        fontFamily: 'monospace',
      }}
    >
      {/* Matrix-style header - always visible, blinking */}
      <div 
        className="text-[10px] mb-2 flex items-center gap-1"
        style={{ color: MATRIX_GREEN }}
      >
        <span className="animate-pulse">{'>'}</span>
        <span>SYSTEM_EVENTS</span>
        <span className="animate-pulse">_</span>
      </div>
      
      {/* Feed entries - newest at top (falls down like code) */}
      <div className="flex flex-col gap-0">
        {feed.length === 0 ? (
          // Empty state - show waiting message
          <div 
            className="text-[10px] animate-pulse"
            style={{ color: MATRIX_DIM }}
          >
            {'// waiting for events...'}
          </div>
        ) : (
          feed.map((entry) => (
            <FeedRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const [opacity, setOpacity] = useState(0);
  const [slideIn, setSlideIn] = useState(false);
  const color = AGENT_COLORS[entry.agent || ''] || MATRIX_GREEN;
  const label = entry.source || entry.agent || 'system';

  // Fade in + slide from top
  useEffect(() => {
    requestAnimationFrame(() => {
      setSlideIn(true);
      setOpacity(1);
    });
  }, []);

  // Fade out before removal - longer duration (10s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0);
      setSlideIn(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex items-start gap-2 text-[11px] leading-tight transition-all duration-500"
      style={{ 
        opacity,
        transform: slideIn ? 'translateY(0)' : 'translateY(-10px)',
        color: MATRIX_GREEN,
      }}
    >
      <span
        className="shrink-0 font-bold uppercase tracking-wider"
        style={{ 
          color,
          textShadow: `0 0 5px ${color}`,
        }}
      >
        [{label}]
      </span>
      <span 
        className="truncate"
        style={{
          color: entry.type === 'message_sent' ? '#fff' : MATRIX_DIM,
          textShadow: entry.type === 'message_sent' ? '0 0 8px #fff' : 'none',
        }}
      >
        {entry.message}
      </span>
      {/* Matrix-style cursor */}
      <span className="animate-pulse" style={{ color: MATRIX_GREEN }}>_</span>
    </div>
  );
}
