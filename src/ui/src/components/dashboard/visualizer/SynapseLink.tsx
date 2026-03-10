import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SynapseLinkProps {
  orbitRadius: number;
  orbitSpeed: number;
  orbitTiltX: number;
  orbitTiltZ: number;
  orbitPhase: number;
  agentKey: string;
  isActive: boolean;
}

const AGENT_COLORS: Record<string, string> = {
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

const LINE_SEGMENTS = 24;

export function SynapseLink({
  orbitRadius, orbitSpeed, orbitTiltX, orbitTiltZ, orbitPhase, agentKey, isActive
}: SynapseLinkProps) {
  const lineRef = useRef<THREE.Line>(null);
  const colorHex = AGENT_COLORS[agentKey.toLowerCase()] || '#a1a1aa';
  const color = new THREE.Color(colorHex);

  const geometry = useRef(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: LINE_SEGMENTS + 1 }, () => new THREE.Vector3())
    )
  ).current;

  const material = useRef(
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
  ).current;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const angle = t * orbitSpeed + orbitPhase;

    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = z * Math.sin(orbitTiltX) + x * Math.sin(orbitTiltZ);
    const adjustedZ = z * Math.cos(orbitTiltX);
    const adjustedX = x * Math.cos(orbitTiltZ);

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const frac = i / LINE_SEGMENTS;
      const arcY = Math.sin(frac * Math.PI) * 0.3;
      positions.setXYZ(i, adjustedX * frac, y * frac + arcY, adjustedZ * frac);
    }
    positions.needsUpdate = true;

    // Brighter when active with pulse, still visible when idle
    const targetOpacity = isActive
      ? 0.7 + Math.sin(t * 6) * 0.25
      : 0.15;
    material.opacity += (targetOpacity - material.opacity) * 0.1;
  });

  return <line ref={lineRef} geometry={geometry} material={material} />;
}
