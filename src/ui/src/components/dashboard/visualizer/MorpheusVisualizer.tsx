import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { OracleNode } from './OracleNode';
import { AgentNode } from './AgentNode';
import { useSystemStream } from '../../../hooks/useSystemStream';
import useSWR from 'swr';
import clsx from 'clsx';
import { SynapseLink } from './SynapseLink';
import { httpClient } from '../../../services/httpClient';

const fetcher = (url: string) => httpClient.get(url).then(res => res as any);

interface MorpheusVisualizerProps {
  className?: string;
}

// Each agent gets a unique tilted orbit so they don't all share one flat ring
const ORBIT_CONFIGS = [
  { radius: 3.5, speed: 0.35, tiltX: 0.3,  tiltZ: 0.0,  phase: 0 },
  { radius: 4.0, speed: 0.28, tiltX: -0.2, tiltZ: 0.4,  phase: Math.PI * 0.4 },
  { radius: 4.5, speed: 0.22, tiltX: 0.5,  tiltZ: -0.3, phase: Math.PI * 0.8 },
  { radius: 3.8, speed: 0.32, tiltX: -0.4, tiltZ: 0.2,  phase: Math.PI * 1.2 },
  { radius: 4.2, speed: 0.25, tiltX: 0.1,  tiltZ: -0.5, phase: Math.PI * 1.6 },
  { radius: 3.6, speed: 0.30, tiltX: -0.3, tiltZ: 0.3,  phase: Math.PI * 0.2 },
  { radius: 4.4, speed: 0.20, tiltX: 0.4,  tiltZ: 0.1,  phase: Math.PI * 1.0 },
];

export function MorpheusVisualizer({ className }: MorpheusVisualizerProps) {
  const { activeEvents, isConnected } = useSystemStream();

  const { data: agentsMap } = useSWR<Record<string, any>>('/agents/metadata', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000
  });

  const isOracleActive = activeEvents.length > 0;

  const agents = agentsMap
    ? Object.keys(agentsMap).map(key => ({
        key,
        label: agentsMap[key].label || key.toUpperCase(),
        emoji: agentsMap[key].emoji
      }))
    : [
        { key: 'apoc', label: 'Apoc', emoji: '🛠️' },
        { key: 'neo', label: 'Neo', emoji: '🔌' },
        { key: 'trinit', label: 'Trinity', emoji: '🗄️' },
        { key: 'smith', label: 'Smith', emoji: '⚡' },
        { key: 'link', label: 'Link', emoji: '🔗' }
      ];

  return (
    <div className={clsx("relative w-full h-full bg-black overflow-hidden rounded-xl border border-matrix-primary", className)}>
      {!isConnected && (
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10 px-2 py-1 bg-red-900/50 rounded-md text-red-200 text-xs border border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Stream Disconnected
        </div>
      )}

      {isConnected && (
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10 px-2 py-1 bg-green-900/20 rounded-md text-green-400 text-xs border border-green-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
          {activeEvents.length > 0 && <span className="ml-1 px-1 bg-white/10 rounded">{activeEvents.length}</span>}
        </div>
      )}

      <Canvas
        camera={{ position: [0, 5, 12], fov: 50 }}
        frameloop="always"
      >
        <color attach="background" args={['#030308']} />

        <ambientLight intensity={0.3} />
        <pointLight position={[0, 8, 0]} intensity={1.0} color="#6366f1" />
        <pointLight position={[0, -5, 0]} intensity={0.5} color="#0ea5e9" />

        <Stars radius={120} depth={60} count={4000} factor={5} saturation={0.2} fade speed={0.8} />

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
          const activeEvent = activeEvents.find((e: any) => {
            return e.agent?.toLowerCase() === agent.key.toLowerCase() ||
                   (agent.key === 'trinit' && e.agent === 'trinity');
          });

          const isActive = !!activeEvent;
          const orbit = ORBIT_CONFIGS[index % ORBIT_CONFIGS.length];

          return (
            <group key={agent.key}>
              <AgentNode
                name={agent.label}
                agentKey={agent.key}
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
                agentKey={agent.key}
                isActive={isActive}
              />
            </group>
          );
        })}

      </Canvas>
    </div>
  );
}
