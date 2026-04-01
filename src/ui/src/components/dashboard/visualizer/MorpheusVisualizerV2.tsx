import { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import useSWR from 'swr';
import { httpClient } from '../../../services/httpClient';
import { useSystemStream } from '../../../hooks/useSystemStream';
import clsx from 'clsx';
import { Maximize2, Minimize2 } from 'lucide-react';

interface AgentMeta {
  agentKey: string;
  label: string;
  emoji: string;
}

const fetcher = (url: string) => httpClient.get(url).then(res => res as any);

const AGENT_COLORS: Record<string, string> = {
  oracle: '#ffdd44',
  apoc: '#ff5533',
  neo: '#00ff41',
  trinit: '#55aaff',
  trinity: '#55aaff',
  link: '#00ffbb',
  smith: '#a1a1aa',
  sati: '#dd55ff',
  chronos: '#ff8800',
  telephonist: '#c084fc',
};

// ─── Shared Geometries ───────────────────────────────────────────────────────
const boxG = new THREE.BoxGeometry(1, 1, 1);
const sphereG = new THREE.SphereGeometry(1, 12, 12);
const planeG = new THREE.PlaneGeometry(1, 1);

// ─── Shared Materials ────────────────────────────────────────────────────────
const rackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x001100, emissiveIntensity: 0.2 });
const deskMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.2, emissive: 0x050505 }); 
const monMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });

// ─── Matrix Rain Texture ─────────────────────────────────────────────────────

function useMatrixRainTexture(color: string) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    return c;
  }, []);
  const ctx = useMemo(() => canvas.getContext('2d'), [canvas]);
  const columns = useMemo(() => Array(20).fill(0), []);
  const chars = "ZION0101MORPHEUSΩΣΔΞ";
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  useFrame(() => {
    if (!ctx) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = '10px monospace';
    columns.forEach((y, i) => {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * 7, y);
      if (y > 128 && Math.random() > 0.975) columns[i] = 0;
      else columns[i] = y + 7;
    });
    texture.needsUpdate = true;
  });
  return texture;
}

// ─── Server Rack Component ───────────────────────────────────────────────────

function ServerRack({ position }: { position: [number, number, number] }) {
  const ledRefs = useRef<THREE.Mesh[]>([]);
  const leds = useMemo(() => Array.from({ length: 8 }, () => ({
    y: (Math.random() - 0.5) * 2.8,
    z: (Math.random() - 0.5) * 1.8,
    color: ['#00ff41', '#0088ff', '#ff4400', '#00ff41'][Math.floor(Math.random() * 4)],
    offset: Math.random() * Math.PI * 2,
    speed: 5 + Math.random() * 10
  })), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ledRefs.current.forEach((led, i) => {
      if (!led) return;
      const mat = led.material as THREE.MeshStandardMaterial;
      const blink = Math.sin(t * leds[i].speed + leds[i].offset);
      mat.emissiveIntensity = blink > 0.5 ? 2.5 : 0.1;
    });
  });

  return (
    <group position={position}>
      <mesh geometry={boxG} material={rackMat} position={[0, 1.6, 0]} scale={[0.8, 3.2, 2.4]} />
      <mesh position={[position[0] < 0 ? 0.41 : -0.41, 1.6, 0]} rotation={[0, position[0] < 0 ? -Math.PI / 2 : Math.PI / 2, 0]} geometry={planeG} material={faceMat} scale={[2.38, 3.18, 1]} />
      {leds.map((led, i) => (
        <mesh 
          key={i} 
          ref={el => ledRefs.current[i] = el!}
          position={[position[0] < 0 ? 0.42 : -0.42, 1.6 + led.y, led.z]} 
          rotation={[0, position[0] < 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <boxGeometry args={[0.05, 0.05, 0.01]} />
          <meshStandardMaterial emissive={led.color} emissiveIntensity={2} color="#000000" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Cables Component ────────────────────────────────────────────────────────

function CablesAndPulses({ workers, oraclePos }: { workers: { agent: AgentMeta, pos: [number, number, number] }[], oraclePos: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const cables = useMemo(() => {
    const s = new THREE.Vector3(oraclePos[0], oraclePos[1] + 1.19 + 0.34, oraclePos[2] - 0.198);
    return workers.map(w => {
      const e = new THREE.Vector3(w.pos[0], w.pos[1] + 1.19, w.pos[2] - 0.198);
      const ctrl = new THREE.Vector3((s.x + e.x) / 2, Math.max(s.y, e.y) + 2.5, (s.z + e.z) / 2);
      const curve = new THREE.QuadraticBezierCurve3(s, ctrl, e);
      return { points: curve.getPoints(25) };
    });
  }, [workers, oraclePos]);

  return (
    <group ref={groupRef}>
      {cables.map((c, i) => (
        <line key={i}>
          <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(c.points)} />
          <lineBasicMaterial attach="material" color="#00ff41" transparent opacity={0.05} />
        </line>
      ))}
    </group>
  );
}

// ─── Worker Station Component ────────────────────────────────────────────────

function WorkerNodeV2({ agent, position, isOracle, isActive }: { agent: AgentMeta, position: [number, number, number], isOracle?: boolean, isActive?: boolean }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const deskRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const color = AGENT_COLORS[agent.agentKey] || '#00ff41';
  const rainTexture = useMatrixRainTexture(color);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = isActive ? 6.0 + Math.sin(t * 20) * 2 : 1.0 + Math.sin(t * 1.5 + phase) * 0.4;
    }

    if (deskRef.current) {
      const mat = deskRef.current.material as THREE.MeshStandardMaterial;
      if (isActive) {
        mat.emissive.set(color);
        mat.emissiveIntensity = 0.5 + Math.sin(t * 10) * 0.3;
      } else {
        mat.emissive.set('#050505');
        mat.emissiveIntensity = 0.1;
      }
    }

    if (lightRef.current) {
      lightRef.current.intensity = isActive ? 5.0 + Math.sin(t * 15) * 2 : 0;
    }
  });

  return (
    <group position={position}>
      {isOracle && (
        <group position={[0, 0.17, 0]}>
          <mesh geometry={boxG} scale={[6, 0.34, 3.5]}><meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} /></mesh>
        </group>
      )}
      <group position={[0, isOracle ? 0.34 : 0, 0]}>
        <mesh ref={deskRef} geometry={boxG} material={deskMat.clone()} position={[0, 0.75, 0]} scale={[2.35, 0.05, 1.02]} />
        {[[-1.05, -0.46], [1.05, -0.46], [-1.05, 0.42], [1.05, 0.42]].map(([lx, lz], i) => (
          <mesh key={i} geometry={boxG} material={deskMat} position={[lx, 0.375, lz]} scale={[0.06, 0.75, 0.06]} />
        ))}
        <mesh geometry={boxG} material={monMat} position={[0, 1.19, -0.23]} scale={[1.08, 0.66, 0.06]} />
        <mesh ref={screenRef} position={[0, 1.19, -0.19]} geometry={boxG} scale={[0.98, 0.59, 0.01]}>
           <meshStandardMaterial color="#000000" emissive={color} emissiveIntensity={1.0} emissiveMap={rainTexture} map={rainTexture} />
        </mesh>

        <pointLight ref={lightRef} position={[0, 1.5, 0.2]} color={color} distance={5} />
        
        {/* Agent Name Label - Floating Higher */}
        <Html position={[0, 2.2, -0.2]} center transform sprite>
          <div className="pointer-events-none">
            <div 
              className="text-[9px] font-bold tracking-tight uppercase px-1.5 py-0.5 rounded transition-all duration-200"
              style={{ 
                backgroundColor: isActive ? color : 'rgba(0,0,0,0.8)',
                border: `1px solid ${isActive ? 'white' : 'rgba(255,255,255,0.3)'}`,
                boxShadow: isActive ? `0 0 20px ${color}` : 'none',
                color: isActive ? 'black' : 'white'
              }}
            >
              {agent.label}
            </div>
          </div>
        </Html>

        {/* Agent Emoji - Floating Higher in front of monitor */}
        <Html position={[0, 1.3, 0.4]} center transform sprite>
          <div className={`pointer-events-none transition-transform duration-200 ${isActive ? 'scale-150' : 'scale-100'}`}>
            <span className="text-[18px]" style={{ textShadow: isActive ? `0 0 15px ${color}` : '0 0 12px white' }}>{agent.emoji}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────────

export function MorpheusVisualizerV2({ className }: { className?: string }) {
  const { activeEvents, feed, isConnected } = useSystemStream();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data } = useSWR<{ agents: AgentMeta[] }>('/agents/metadata', fetcher);

  const agents = useMemo(() => data?.agents || [], [data]);
  const oracleAgent = useMemo(() => agents.find(a => a.agentKey === 'oracle') || { agentKey: 'oracle', label: 'Oracle', emoji: '🔮' }, [agents]);
  const workerAgents = useMemo(() => agents.filter(a => a.agentKey !== 'oracle'), [agents]);

  const slots: [number, number][] = [[-4.5, -4], [-1.5, -4], [1.5, -4], [4.5, -4], [-4.5, 0.5], [-1.5, 0.5], [1.5, 0.5], [4.5, 0.5]];
  const workersWithPos = useMemo(() => workerAgents.slice(0, 8).map((agent, i) => ({ agent, pos: [slots[i][0], 0, slots[i][1]] as [number, number, number] })), [workerAgents]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div ref={containerRef} className={clsx("relative w-full h-full overflow-hidden bg-[#000800]", className)}>
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/95 via-black/50 to-transparent z-10 flex items-center justify-between pointer-events-none">
        <div className="font-mono">
          <h3 className="text-[#00ff41] text-[12px] tracking-[6px] font-bold drop-shadow-[0_0_15px_#00ff41]">◈ ZION OPERATIONS CENTER ◈</h3>
          <div className="text-[#00aa00] text-[10px] uppercase font-bold tracking-widest">SYSTEM UPLINK: <span className="text-[#00ff41] animate-pulse">{isConnected ? 'CONNECTED' : 'OFFLINE'}</span></div>
        </div>
        <button onClick={toggleFullscreen} className="p-2 rounded bg-black/70 border border-[#00ff41]/50 text-[#00ff41] pointer-events-auto hover:bg-[#00ff41]/20 transition-all shadow-[0_0_10px_rgba(0,255,65,0.2)]">
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <div className="absolute top-16 left-4 z-10 font-mono text-[9px] text-[#00ff41] pointer-events-none max-h-40 overflow-hidden flex flex-col gap-1.5 opacity-100 drop-shadow-[0_0_3px_black]">
        {feed.slice(-8).map((entry) => (
          <div key={entry.id} className="flex gap-2 whitespace-nowrap bg-black/40 px-2 py-0.5 rounded border-l-2 border-[#00ff41]/30 backdrop-blur-sm animate-in fade-in slide-in-from-left-2">
            <span style={{ color: AGENT_COLORS[entry.agent || ''] || '#00ff41', fontWeight: 'bold' }}>{entry.source || entry.agent}:</span>
            <span className="text-[#00ff41] truncate max-w-[220px]">{entry.message}</span>
          </div>
        ))}
      </div>

      <Canvas camera={{ position: [0, 8, 8], fov: 45 }} shadows dpr={[1, 1.5]}>
        <color attach="background" args={['#000800']} />
        <fogExp2 attach="fog" args={['#000800', 0.012]} />
        <ambientLight intensity={1.5} color="#507050" />
        <directionalLight position={[0, 30, 0]} intensity={1.2} color="#ffffff" />
        <pointLight position={[0, 12, 12]} color="#ffffff" intensity={1.5} distance={40} />
        <pointLight position={[0, 10, -10]} color="#ffe066" intensity={2.5} distance={30} />
        <pointLight position={[-20, 8, 5]} color="#00ff41" intensity={1.2} distance={35} />
        <pointLight position={[20, 8, 5]} color="#00ff41" intensity={1.2} distance={35} />
        <OrbitControls target={[0, 1, -4]} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={45} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow scale={[32, 28, 1]}><planeGeometry /><meshLambertMaterial color="#002200" /></mesh>
        <gridHelper args={[32, 32, 0x00ff41, 0x003300]} position={[0, 0.01, 0]} />

        <WorkerNodeV2 agent={oracleAgent} position={[0, 0, -8]} isOracle isActive={activeEvents.some(e => e.agent === 'oracle')} />
        {workersWithPos.map(w => <WorkerNodeV2 key={w.agent.agentKey} agent={w.agent} position={w.pos} isActive={activeEvents.some(e => e.agent === w.agent.agentKey)} />)}
        <CablesAndPulses workers={workersWithPos} oraclePos={[0, 0, -8]} />
        <Stars radius={150} depth={50} count={3500} factor={6} fade speed={1} />
      </Canvas>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/60 to-transparent z-10 flex justify-between items-center font-mono text-[11px] text-[#00ff41]/80 pointer-events-none uppercase tracking-widest font-bold">
        <div className="flex gap-6">
          <span className="drop-shadow-[0_0_5px_#00ff41]">⟨ ORBIT: DRAG ⟩</span>
          <span className="drop-shadow-[0_0_5px_#00ff41]">⟨ ZOOM: SCROLL ⟩</span>
        </div>
        <div className="flex gap-6">
          <div className="text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]">CONNECTIONS: {activeEvents.length}</div>
          <div className="text-[#00ff41]">ORACLE: READY</div>
        </div>
      </div>
    </div>
  );
}
