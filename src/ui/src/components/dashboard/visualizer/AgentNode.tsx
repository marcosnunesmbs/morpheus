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
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3());
  const actRef = useRef({ intensity: 0 });

  const hexColor = AGENT_COLORS[agentKey.toLowerCase()] || '#a1a1aa';
  const brightHex = useMemo(() => {
    const c = new THREE.Color(hexColor);
    c.multiplyScalar(1.4);
    return '#' + c.getHexString();
  }, [hexColor]);

  // Dim version for idle surface
  const dimHex = useMemo(() => {
    const c = new THREE.Color(hexColor);
    c.multiplyScalar(0.3);
    return '#' + c.getHexString();
  }, [hexColor]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const act = actRef.current;

    // Smooth intensity ramp
    const target = isActive ? 1 : 0;
    const spd = isActive ? 8 : 2;
    act.intensity += (target - act.intensity) * delta * spd;

    const pulse = Math.sin(t * 6) * 0.5 + 0.5;

    // Orbital position
    const angle = t * orbitSpeed + orbitPhase;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = z * Math.sin(orbitTiltX) + x * Math.sin(orbitTiltZ);
    const adjustedZ = z * Math.cos(orbitTiltX);
    const adjustedX = x * Math.cos(orbitTiltZ);
    positionRef.current.set(adjustedX, y, adjustedZ);

    // Core sphere: position + breathe
    if (coreRef.current) {
      coreRef.current.position.copy(positionRef.current);
      const s = 1.0 + act.intensity * (0.4 + pulse * 0.2);
      coreRef.current.scale.setScalar(s);
    }

    // Core material emissive
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 0.4 + act.intensity * (1.5 + pulse * 1.0);
    }

    // Inner icosahedron: spins, faster when active
    if (innerRef.current) {
      innerRef.current.position.copy(positionRef.current);
      const spinSpeed = 0.4 + act.intensity * 2.0;
      innerRef.current.rotation.x += delta * spinSpeed;
      innerRef.current.rotation.y += delta * spinSpeed * 1.2;
    }

    // Wireframe shell: follows position, expands on activity
    if (shellRef.current) {
      shellRef.current.position.copy(positionRef.current);
      const shellScale = 1.0 + act.intensity * 0.3;
      shellRef.current.scale.setScalar(shellScale);
      shellRef.current.rotation.y = t * 0.3;
      shellRef.current.rotation.x = t * 0.2;
    }

    // Glow halo
    if (glowRef.current) {
      glowRef.current.position.copy(positionRef.current);
      const glowScale = 2.0 + act.intensity * (1.5 + pulse * 0.8);
      glowRef.current.scale.setScalar(glowScale);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + act.intensity * 0.18;
    }
  });

  return (
    <group>
      {/* Glow halo */}
      <Sphere ref={glowRef} args={[0.28, 16, 16]}>
        <meshBasicMaterial
          color={hexColor}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </Sphere>

      {/* Inner spinning icosahedron — the "brain" */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial
          color={hexColor}
          emissive={hexColor}
          emissiveIntensity={0.8}
          wireframe
        />
      </mesh>

      {/* Core sphere — translucent, glowing */}
      <Sphere ref={coreRef} args={[0.28, 32, 32]}>
        <meshStandardMaterial
          ref={coreMaterialRef}
          color={dimHex}
          emissive={hexColor}
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.7}
        />
      </Sphere>

      {/* Wireframe shell */}
      <Sphere ref={shellRef} args={[0.34, 12, 12]}>
        <meshBasicMaterial
          color={hexColor}
          wireframe
          transparent
          opacity={isActive ? 0.5 : 0.2}
        />
      </Sphere>

      {/* Label */}
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
      groupRef.current.position.set(adjustedX, y + 0.6, adjustedZ);
    }
  });

  return (
    <group ref={groupRef}>
      <Html center transform sprite zIndexRange={[10, 0]}>
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
