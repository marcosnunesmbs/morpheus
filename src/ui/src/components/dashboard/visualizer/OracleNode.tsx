import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html, Ring } from '@react-three/drei';
import * as THREE from 'three';

interface OracleNodeProps {
  isActive: boolean;
  activeCount: number;
}

// Matrix green palette
const ORACLE_CORE = '#b6ffc0';    // light mint (surface)
const ORACLE_GLOW = '#00ff41';    // classic matrix green
const ORACLE_DIM = '#0a5c1a';     // deep forest (idle emissive)
const ORACLE_BRIGHT = '#7dffaa';  // bright mint (active emissive)

export function OracleNode({ isActive, activeCount }: OracleNodeProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const activityRef = useRef({ wasActive: false, shockwave: 0, intensity: 0 });

  const idleColor = useMemo(() => new THREE.Color(ORACLE_DIM), []);
  const activeColor = useMemo(() => new THREE.Color(ORACLE_BRIGHT), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const act = activityRef.current;

    // Shockwave on activity start
    if (isActive && !act.wasActive) {
      act.shockwave = 1.0;
    }
    act.wasActive = isActive;
    act.shockwave = Math.max(0, act.shockwave - delta * 1.5);

    // Smooth intensity
    const targetIntensity = isActive ? 0.6 + activeCount * 0.15 : 0;
    act.intensity += (targetIntensity - act.intensity) * delta * 3;

    // Core float + breathe
    if (coreRef.current) {
      coreRef.current.position.y = Math.sin(t * 0.8) * 0.15;
      const breathe = 1.0 + Math.sin(t * 1.5) * 0.03 + act.intensity * 0.15;
      coreRef.current.scale.setScalar(breathe);
    }

    // Core glow — lerps from dim to bright
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 0.4 + act.intensity * 1.5 + act.shockwave * 2.5;
      coreMaterialRef.current.emissive.lerpColors(idleColor, activeColor, act.intensity);
    }

    // Inner icosahedron spins faster with activity
    if (innerRef.current) {
      const spinSpeed = 0.3 + act.intensity * 2.5;
      innerRef.current.rotation.x += delta * spinSpeed;
      innerRef.current.rotation.y += delta * spinSpeed * 1.3;
      innerRef.current.rotation.z += delta * spinSpeed * 0.7;
    }

    // Wireframe shell — shockwave expansion
    if (shellRef.current) {
      const shellScale = 1.15 + act.shockwave * 0.6 + Math.sin(t * 2) * 0.02;
      shellRef.current.scale.setScalar(shellScale);
      shellRef.current.rotation.y = t * 0.2;
      shellRef.current.rotation.x = t * 0.15;
    }

    // Rings
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.6;
      ring1Ref.current.rotation.z = t * 0.3;
      ring1Ref.current.scale.setScalar(1.0 + act.shockwave * 0.5);
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = t * 0.5;
      ring2Ref.current.rotation.x = Math.PI / 3 + t * 0.2;
      ring2Ref.current.scale.setScalar(1.0 + act.shockwave * 0.3);
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = t * 0.4;
      ring3Ref.current.rotation.y = Math.PI / 5 + t * 0.35;
      ring3Ref.current.scale.setScalar(1.0 + act.shockwave * 0.4);
    }
  });

  const ringColor = isActive ? ORACLE_BRIGHT : ORACLE_GLOW;
  const ringOpacity = isActive ? 0.8 : 0.5;

  return (
    <group>
      {/* Inner spinning icosahedron */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color={ORACLE_GLOW}
          emissive={ORACLE_GLOW}
          emissiveIntensity={0.8}
          wireframe
        />
      </mesh>

      {/* Core sphere */}
      <Sphere ref={coreRef} args={[0.8, 64, 64]}>
        <meshStandardMaterial
          ref={coreMaterialRef}
          color={ORACLE_CORE}
          emissive={ORACLE_GLOW}
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.9}
        />
      </Sphere>

      {/* Wireframe shell */}
      <Sphere ref={shellRef} args={[1.0, 20, 20]}>
        <meshBasicMaterial
          color={isActive ? ORACLE_GLOW : ORACLE_DIM}
          wireframe
          transparent
          opacity={isActive ? 0.4 : 0.15}
        />
      </Sphere>

      {/* Three orbital rings */}
      <mesh ref={ring1Ref}>
        <Ring args={[1.4, 1.45, 64]}>
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} side={THREE.DoubleSide} />
        </Ring>
      </mesh>

      <mesh ref={ring2Ref}>
        <Ring args={[1.6, 1.64, 64]}>
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity * 0.7} side={THREE.DoubleSide} />
        </Ring>
      </mesh>

      <mesh ref={ring3Ref}>
        <Ring args={[1.8, 1.83, 64]}>
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity * 0.5} side={THREE.DoubleSide} />
        </Ring>
      </mesh>

      {/* Label */}
      <Html position={[0, -2.0, 0]} center transform sprite zIndexRange={[10, 0]}>
        <div
          className="text-[11px] font-bold tracking-[0.25em] uppercase transition-all duration-500"
          style={{
            color: isActive ? ORACLE_BRIGHT : ORACLE_GLOW,
            textShadow: isActive
              ? `0 0 10px ${ORACLE_GLOW}, 0 0 20px ${ORACLE_GLOW}`
              : `0 0 4px ${ORACLE_DIM}`,
          }}
        >
          Oracle
        </div>
      </Html>
    </group>
  );
}
