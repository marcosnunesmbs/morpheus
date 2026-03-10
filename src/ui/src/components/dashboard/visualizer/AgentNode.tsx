import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

// Subagents metadata extracted from /api/agents/metadata map to colors
const AGENT_COLORS: Record<string, string> = {
  apoc: '#3b82f6',     // blue
  neo: '#c026d3',      // fuchsia
  trinit: '#10b981',   // emerald
  trinity: '#10b981',
  link: '#eab308',     // yellow
  smith: '#ef4444'     // red
};

interface AgentNodeProps {
  name: string;
  agentKey: string;
  isActive: boolean;
  message?: string;
  orbitRadius: number;
  orbitSpeed: number;
}

export function AgentNode({ name, agentKey, isActive, message, orbitRadius, orbitSpeed }: AgentNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const baseColor = AGENT_COLORS[agentKey.toLowerCase()] || '#888888';

  // The group handles the rotation around the center (Oracle)
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * orbitSpeed;
    }
    
    // Scale pulsation if active
    if (meshRef.current) {
      const targetScale = isActive ? 1.5 + Math.sin(state.clock.elapsedTime * 10) * 0.2 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }

    // Material emissive intensity if active
    if (materialRef.current) {
      const targetEmissive = isActive ? 0.8 : 0.0;
      materialRef.current.emissiveIntensity += (targetEmissive - materialRef.current.emissiveIntensity) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <group position={[orbitRadius, 0, 0]}>
        <Sphere ref={meshRef} args={[0.3, 32, 32]}>
          <meshStandardMaterial 
            ref={materialRef}
            color={baseColor} 
            emissive={baseColor}
            emissiveIntensity={0}
            roughness={0.2}
            metalness={0.8}
            transparent={true}
            opacity={0.9}
          />
        </Sphere>
        
        {isActive && message && (
          <Html position={[0, -0.6, 0]} center transform sprite zIndexRange={[100, 0]}>
            <div className="bg-black/80 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full border border-white/20 whitespace-nowrap">
              <span className="animate-pulse mr-1">⚡</span> {message}
            </div>
          </Html>
        )}
        
        {/* Sub-label always visible but subtle */}
        <Html position={[0, 0.5, 0]} center transform sprite>
          <div className={`text-[10px] font-bold tracking-wider uppercase opacity-50 ${isActive ? 'text-white drop-shadow-md opacity-100' : 'text-gray-400'}`}>
            {name}
          </div>
        </Html>
      </group>
    </group>
  );
}
