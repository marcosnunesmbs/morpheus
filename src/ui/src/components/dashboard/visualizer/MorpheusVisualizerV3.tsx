import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useSystemStream, type SystemActivityEvent } from '@/hooks/useSystemStream';
import { httpClient } from '@/services/httpClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  apoc: '#60a5fa',
  neo: '#e879f9',
  trinit: '#34d399',
  link: '#facc15',
  smith: '#a1a1aa',
  sati: '#fb7185',
  chronos: '#fb923c',
  telephonist: '#c084fc',
  oracle: '#00ff41',
};

const MATRIX_GREEN = '#00ff41';

interface AgentMeta {
  key: string;
  label: string;
  emoji: string;
}

const AGENT_DEFAULTS: AgentMeta[] = [
  { key: 'apoc',        label: 'Apoc',        emoji: '🧑‍🔬' },
  { key: 'neo',         label: 'Neo',         emoji: '🥷'   },
  { key: 'trinit',      label: 'Trinity',     emoji: '👩‍💻' },
  { key: 'smith',       label: 'Smith',       emoji: '🕶️'  },
  { key: 'link',        label: 'Link',        emoji: '🕵️'  },
  { key: 'sati',        label: 'Sati',        emoji: '🧠'   },
  { key: 'chronos',     label: 'Chronos',     emoji: '⏰'   },
  { key: 'telephonist', label: 'Phone',       emoji: '📞'   },
];

// ─── Matrix Rain Canvas ───────────────────────────────────────────────────────

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FONT_SIZE = 13;
    const CHARS = 'MORPHEUS0101ΩΣΔΞζθλ∞∑∇∂∈∀∃⊕⊗10アイウエオカキクケコ';
    let drops: number[] = [];
    let cols = 0;
    let animId = 0;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      cols   = Math.floor(canvas.width / FONT_SIZE);
      drops  = Array.from({ length: cols }, () => Math.random() * -50);
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.045)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FONT_SIZE}px monospace`;

      for (let i = 0; i < cols; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        // Head char is bright, trailing chars dim
        const y = drops[i] * FONT_SIZE;
        ctx.fillStyle = drops[i] > 0 && y < canvas.height ? '#afffce' : MATRIX_GREEN;
        ctx.fillText(ch, i * FONT_SIZE, y);

        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

// ─── Oracle Core ──────────────────────────────────────────────────────────────

function OracleCore({ activeCount }: { activeCount: number }) {
  const knotRef  = useRef<THREE.Mesh>(null);
  const ringRef  = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.Mesh>(null);
  const intensity = useRef(0.5);

  useFrame((_, dt) => {
    const target = 0.5 + activeCount * 0.5;
    intensity.current += (target - intensity.current) * dt * 3;

    if (knotRef.current) {
      const mat = knotRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = intensity.current;
      knotRef.current.rotation.x += dt * (0.25 + activeCount * 0.15);
      knotRef.current.rotation.y += dt * (0.4  + activeCount * 0.1);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.6;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + intensity.current;
    }
    if (glowRef.current) {
      const s = 1.0 + Math.sin(Date.now() * 0.003) * 0.08;
      glowRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* Torus knot body */}
      <mesh ref={knotRef}>
        <torusKnotGeometry args={[0.65, 0.2, 128, 16]} />
        <meshStandardMaterial
          color={MATRIX_GREEN}
          emissive={MATRIX_GREEN}
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Outer glow ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.025, 8, 80]} />
        <meshStandardMaterial color={MATRIX_GREEN} emissive={MATRIX_GREEN} emissiveIntensity={2} />
      </mesh>

      {/* Soft glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.6, 16, 16]} />
        <meshStandardMaterial
          color={MATRIX_GREEN}
          emissive={MATRIX_GREEN}
          emissiveIntensity={0.05}
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      <Html center>
        <div style={{
          color: MATRIX_GREEN,
          fontFamily: 'monospace',
          fontSize: '9px',
          textAlign: 'center',
          marginTop: '72px',
          whiteSpace: 'nowrap',
          textShadow: `0 0 8px ${MATRIX_GREEN}`,
          letterSpacing: '0.15em',
          userSelect: 'none',
        }}>
          ORACLE
        </div>
      </Html>
    </group>
  );
}

// ─── Hex Agent Node ───────────────────────────────────────────────────────────

function HexNode({
  position,
  agentKey,
  label,
  emoji,
  isActive,
  activeMessage,
}: {
  position: [number, number, number];
  agentKey: string;
  label: string;
  emoji: string;
  isActive: boolean;
  activeMessage?: string;
}) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const haloRef  = useRef<THREE.Mesh>(null);
  const intensity = useRef(0.2);
  const rotSpeed  = useRef(0.3);
  const glitch    = useRef(0); // 0-1 glitch amount on activation edge

  const color    = AGENT_COLORS[agentKey] ?? MATRIX_GREEN;
  const colorObj = useMemo(() => new THREE.Color(color), [color]);
  const prevActive = useRef(false);

  useFrame((_, dt) => {
    if (!meshRef.current || !haloRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;

    // Detect rising edge → trigger glitch flash
    if (isActive && !prevActive.current) glitch.current = 1;
    prevActive.current = isActive;

    if (glitch.current > 0) {
      glitch.current = Math.max(0, glitch.current - dt * 4);
      mat.emissiveIntensity = 2 + Math.random() * 3 * glitch.current;
    } else {
      const target = isActive ? 1.8 : 0.2;
      intensity.current += (target - intensity.current) * dt * 4;
      mat.emissiveIntensity = intensity.current;
    }

    const targetSpeed = isActive ? 2.5 : 0.3;
    rotSpeed.current += (targetSpeed - rotSpeed.current) * dt * 3;
    meshRef.current.rotation.y += dt * rotSpeed.current;

    // Halo glow
    const haloMat = haloRef.current.material as THREE.MeshStandardMaterial;
    const haloTarget = isActive ? 0.12 : 0.0;
    haloMat.opacity += (haloTarget - haloMat.opacity) * dt * 5;
    const hs = 1.0 + (isActive ? 0.15 + Math.sin(Date.now() * 0.006) * 0.05 : 0);
    haloRef.current.scale.setScalar(hs);
  });

  return (
    <group position={position}>
      {/* Glow halo */}
      <mesh ref={haloRef}>
        <cylinderGeometry args={[0.65, 0.65, 0.05, 6]} />
        <meshStandardMaterial
          color={colorObj}
          emissive={colorObj}
          emissiveIntensity={3}
          transparent
          opacity={0}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Hex body */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.3, 0.3, 0.12, 6]} />
        <meshStandardMaterial
          color={colorObj}
          emissive={colorObj}
          emissiveIntensity={0.2}
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>

      {/* Thin wireframe outline */}
      <mesh>
        <cylinderGeometry args={[0.32, 0.32, 0.14, 6]} />
        <meshStandardMaterial
          color={colorObj}
          emissive={colorObj}
          emissiveIntensity={1}
          wireframe
          transparent
          opacity={isActive ? 0.7 : 0.2}
        />
      </mesh>

      <Html center>
        <div style={{
          color,
          fontFamily: 'monospace',
          fontSize: '9px',
          textAlign: 'center',
          marginTop: '28px',
          whiteSpace: 'nowrap',
          textShadow: `0 0 6px ${color}`,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          <div>{emoji} {label}</div>
          {isActive && activeMessage && (
            <div style={{ fontSize: '7px', maxWidth: '75px', opacity: 0.75, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeMessage.slice(0, 35)}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ─── Neural Link ──────────────────────────────────────────────────────────────

function NeuralLink({
  from,
  isActive,
  color,
}: {
  from: [number, number, number];
  isActive: boolean;
  color: string;
}) {
  const opacity = useRef(0.08);
  const ref = useRef<THREE.Object3D>(null);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const line = ref.current as any;
    const mat: THREE.LineBasicMaterial = line.material;
    const target = isActive ? 0.75 + Math.sin(Date.now() * 0.01) * 0.15 : 0.08;
    opacity.current += (target - opacity.current) * dt * 5;
    mat.opacity = opacity.current;
  });

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  return (
    <Line
      ref={ref as any}
      points={[from, [0, 0, 0]]}
      color={colorObj}
      lineWidth={isActive ? 1.5 : 0.8}
      transparent
      opacity={0.08}
      dashed={false}
    />
  );
}

// ─── Synaptic Pulse ───────────────────────────────────────────────────────────

function SynapticPulse({
  from,
  isActive,
  color,
}: {
  from: [number, number, number];
  isActive: boolean;
  color: string;
}) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const progress = useRef(Math.random()); // stagger start positions
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  const fromVec = useMemo(() => new THREE.Vector3(...from), [from]);
  const toVec   = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    if (!isActive) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    progress.current = (progress.current + dt * 0.65) % 1;

    const pos = fromVec.clone().lerp(toVec, progress.current);
    meshRef.current.position.copy(pos);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    // Fade: bright in middle, dim at edges
    const fade = Math.sin(progress.current * Math.PI);
    mat.opacity = fade * 0.95;
    mat.emissiveIntensity = 2 + fade * 4;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshStandardMaterial
        color={colorObj}
        emissive={colorObj}
        emissiveIntensity={4}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

// ─── 3D Scene ─────────────────────────────────────────────────────────────────

function Scene({
  agents,
  activeEvents,
}: {
  agents: AgentMeta[];
  activeEvents: SystemActivityEvent[];
}) {
  const activeStarts = activeEvents.filter(e => e.type === 'activity_start');
  const activeCount  = activeStarts.length;

  // Arrange agents in a tilted ring (like a halo around the Oracle)
  const positions = useMemo<[number, number, number][]>(() => {
    const n = agents.length || 1;
    return agents.map((_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rx = 4.8;
      const rz = 3.6; // ellipse depth
      return [
        Math.cos(angle) * rx,
        Math.sin(angle * 0.5) * 0.6, // subtle vertical wave
        Math.sin(angle) * rz,
      ];
    });
  }, [agents]);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 20, 40]} />
      <ambientLight intensity={0.08} color="#002200" />
      <pointLight position={[0, 0, 0]} intensity={3} color={MATRIX_GREEN} distance={22} />
      <Stars radius={90} depth={60} count={1800} factor={3} saturation={0} fade speed={0.5} />

      <OracleCore activeCount={activeCount} />

      {agents.map((agent, i) => {
        const pos     = positions[i];
        const evt     = activeStarts.find(e => e.agent === agent.key);
        const active  = !!evt;
        const agColor = AGENT_COLORS[agent.key] ?? MATRIX_GREEN;

        return (
          <group key={agent.key}>
            <NeuralLink from={pos} isActive={active} color={agColor} />
            <SynapticPulse from={pos} isActive={active} color={agColor} />
            <HexNode
              position={pos}
              agentKey={agent.key}
              label={agent.label}
              emoji={agent.emoji}
              isActive={active}
              activeMessage={evt?.message}
            />
          </group>
        );
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={6}
        maxDistance={22}
        autoRotate
        autoRotateSpeed={activeCount > 0 ? 0.6 : 0.25}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 1.7}
      />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function MorpheusVisualizerV3() {
  const { activeEvents, feed, isConnected } = useSystemStream();
  const [agents, setAgents]                 = useState<AgentMeta[]>(AGENT_DEFAULTS);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const containerRef                        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    httpClient
      .get('/agents/metadata')
      .then((data: any) => {
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setAgents(
            list.map((a: any) => ({
              key:   a.agentKey ?? a.key ?? '',
              label: a.label    ?? a.key ?? 'Agent',
              emoji: a.emoji    ?? '🤖',
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const activeCount = activeEvents.filter(e => e.type === 'activity_start').length;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>

      {/* Matrix rain layer */}
      <MatrixRain />

      {/* Three.js canvas layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Canvas camera={{ position: [0, 5, 14], fov: 58 }} dpr={[1, 1.5]}>
          <Scene agents={agents} activeEvents={activeEvents} />
        </Canvas>
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 10, left: 12, zIndex: 10,
        color: `${MATRIX_GREEN}99`, fontFamily: 'monospace', fontSize: '10px',
        letterSpacing: '0.2em', userSelect: 'none',
      }}>
        ◈ THE CONSTRUCT ◈
      </div>

      {/* Feed */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, zIndex: 10,
        fontFamily: 'monospace', fontSize: '9.5px', lineHeight: '1.55',
        maxWidth: '260px',
      }}>
        <div style={{ color: `${MATRIX_GREEN}55`, marginBottom: '3px' }}>&gt; SYNAPTIC_FEED _</div>
        {feed.slice(-7).map(entry => {
          const c = AGENT_COLORS[entry.agent ?? ''] ?? MATRIX_GREEN;
          return (
            <div key={entry.id} style={{ color: c, textShadow: `0 0 5px ${c}66`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ opacity: 0.6 }}>[{entry.agent ?? 'sys'}]</span>{' '}
              {entry.message?.slice(0, 48)}
            </div>
          );
        })}
      </div>

      {/* Status + controls */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {activeCount > 0 && (
          <div style={{
            background: `${MATRIX_GREEN}18`, border: `1px solid ${MATRIX_GREEN}55`,
            borderRadius: '4px', padding: '1px 6px',
            color: MATRIX_GREEN, fontFamily: 'monospace', fontSize: '9px',
            textShadow: `0 0 6px ${MATRIX_GREEN}`,
          }}>
            {activeCount} ACTIVE
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          color: isConnected ? MATRIX_GREEN : '#ef4444',
          fontFamily: 'monospace', fontSize: '9px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isConnected ? MATRIX_GREEN : '#ef4444',
            boxShadow: isConnected ? `0 0 6px ${MATRIX_GREEN}` : 'none',
          }} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
        <button
          onClick={toggleFullscreen}
          style={{ color: `${MATRIX_GREEN}77`, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = MATRIX_GREEN)}
          onMouseLeave={e => (e.currentTarget.style.color = `${MATRIX_GREEN}77`)}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

    </div>
  );
}
