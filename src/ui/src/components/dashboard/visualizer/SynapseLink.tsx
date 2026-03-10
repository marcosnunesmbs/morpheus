import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface SynapseLinkProps {
  startParam: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  agentKey: string;
  isActive: boolean;
}

// Subagents metadata colors
const AGENT_COLORS: Record<string, string> = {
  apoc: '#3b82f6',
  neo: '#c026d3',  
  trinit: '#10b981',
  trinity: '#10b981',
  link: '#eab308',
  smith: '#ef4444' 
};

export function SynapseLink({ orbitRadius, orbitSpeed, agentKey, isActive }: SynapseLinkProps) {
  const groupRef = useRef<THREE.Group>(null);
  const color = AGENT_COLORS[agentKey.toLowerCase()] || '#888888';

  useFrame((state) => {
    // Match the exact rotation of the AgentNode
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * orbitSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      <Line
        points={[[0, 0, 0], [orbitRadius, 0, 0]]}
        color={color}
        lineWidth={isActive ? 3 : 1}
        transparent={true}
        opacity={isActive ? 0.8 : 0.15}
      />
    </group>
  );
}
