import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

// Vivid, saturated colors — no opacity, full presence
const AGENT_COLORS: Record<string, string> = {
  apoc: '#60a5fa',        // bright blue
  neo: '#e879f9',         // vivid fuchsia
  trinit: '#34d399',      // bright emerald
  trinity: '#34d399',
  link: '#facc15',        // vivid yellow
  smith: '#a1a1aa',       // silver/gray
  sati: '#fb7185',        // rose
  chronos: '#fb923c',     // orange
  telephonist: '#c084fc', // violet
};

interface AgentNodeProps {
  name: string;
  agentKey: string;
  isActive: boolean;
  message?: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTiltX: number;
  orbitTiltZ: number;
  orbitPhase: number;
}

export function AgentNode({
  name, agentKey, isActive, message,
  orbitRadius, orbitSpeed, orbitTiltX, orbitTiltZ, orbitPhase
}: AgentNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3());
  const actRef = useRef({ intensity: 0 });

  const hexColor = AGENT_COLORS[agentKey.toLowerCase()] || '#a1a1aa';
  const brightHex = useMemo(() => {
    const c = new THREE.Color(hexColor);
    c.multiplyScalar(1.4); // push brighter for active state
    return '#' + c.getHexString();
  }, [hexColor]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const act = actRef.current;

    // Smooth intensity ramp — fast attack, slower decay
    const target = isActive ? 1 : 0;
    const speed = isActive ? 8 : 2;
    act.intensity += (target - act.intensity) * delta * speed;

    // Pulse when active (0..1 sine wave)
    const pulse = Math.sin(t * 6) * 0.5 + 0.5;

    // Orbital position
    const angle = t * orbitSpeed + orbitPhase;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = z * Math.sin(orbitTiltX) + x * Math.sin(orbitTiltZ);
    const adjustedZ = z * Math.cos(orbitTiltX);
    const adjustedX = x * Math.cos(orbitTiltZ);
    positionRef.current.set(adjustedX, y, adjustedZ);

    // Sphere: scale pulses when active
    if (meshRef.current) {
      meshRef.current.position.copy(positionRef.current);
      const s = 1.0 + act.intensity * (0.5 + pulse * 0.3);
      meshRef.current.scale.setScalar(s);
    }

    // Material: emissive cranks up when active
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.3 + act.intensity * (1.5 + pulse * 1.0);
    }

    // Glow halo: expands and brightens when active
    if (glowRef.current) {
      glowRef.current.position.copy(positionRef.current);
      const glowScale = 2.0 + act.intensity * (1.5 + pulse * 0.8);
      glowRef.current.scale.setScalar(glowScale);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + act.intensity * 0.2;
    }
  });

  return (
    <group>
      {/* Glow halo — soft bloom around the agent */}
      <Sphere ref={glowRef} args={[0.28, 16, 16]}>
        <meshBasicMaterial
          color={hexColor}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </Sphere>

      {/* Agent sphere — solid, no transparency */}
      <Sphere ref={meshRef} args={[0.28, 32, 32]}>
        <meshStandardMaterial
          ref={materialRef}
          color={hexColor}
          emissive={hexColor}
          emissiveIntensity={0.3}
          roughness={0.1}
          metalness={0.9}
        />
      </Sphere>

      {/* Label tracks the sphere */}
      <AgentLabel
        name={name}
        isActive={isActive}
        message={message}
        hexColor={hexColor}
        brightHex={brightHex}
        orbitRadius={orbitRadius}
        orbitSpeed={orbitSpeed}
        orbitTiltX={orbitTiltX}
        orbitTiltZ={orbitTiltZ}
        orbitPhase={orbitPhase}
      />
    </group>
  );
}

function AgentLabel({
  name, isActive, message, hexColor, brightHex,
  orbitRadius, orbitSpeed, orbitTiltX, orbitTiltZ, orbitPhase
}: {
  name: string; isActive: boolean; message?: string;
  hexColor: string; brightHex: string;
  orbitRadius: number; orbitSpeed: number;
  orbitTiltX: number; orbitTiltZ: number; orbitPhase: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const angle = t * orbitSpeed + orbitPhase;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = z * Math.sin(orbitTiltX) + x * Math.sin(orbitTiltZ);
    const adjustedZ = z * Math.cos(orbitTiltX);
    const adjustedX = x * Math.cos(orbitTiltZ);

    if (groupRef.current) {
      groupRef.current.position.set(adjustedX, y + 0.55, adjustedZ);
    }
  });

  return (
    <group ref={groupRef}>
      <Html center transform sprite zIndexRange={[100, 0]}>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none">
          <div
            className="text-[11px] font-bold tracking-wider uppercase transition-all duration-200"
            style={{
              color: isActive ? brightHex : hexColor,
              textShadow: isActive ? `0 0 12px ${hexColor}, 0 0 24px ${hexColor}` : 'none',
            }}
          >
            {name}
          </div>
          {isActive && message && (
            <div
              className="text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap max-w-[180px] truncate border"
              style={{
                background: `${hexColor}30`,
                borderColor: `${hexColor}60`,
              }}
            >
              <span className="animate-pulse mr-1">⚡</span>{message}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
