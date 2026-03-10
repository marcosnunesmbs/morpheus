import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

interface OracleNodeProps {
  isActive: boolean;
}

export function OracleNode({ isActive }: OracleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
      
      // Rotation
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
    }

    if (materialRef.current) {
      // Pulse emission based on activity
      const targetEmissive = isActive ? 0.8 : 0.2;
      materialRef.current.emissiveIntensity += (targetEmissive - materialRef.current.emissiveIntensity) * 0.1;
    }
  });

  return (
    <group>
      {/* Central Core */}
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <meshStandardMaterial 
          ref={materialRef}
          color="#ffffff" 
          emissive="#ffffff"
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={1}
          wireframe={false}
        />
      </Sphere>

      {/* Wireframe outer shell for "matrix" effect */}
      <Sphere args={[1.1, 16, 16]}>
        <meshBasicMaterial 
          color={isActive ? "#3b82f6" : "#444444"} 
          wireframe={true} 
          transparent={true} 
          opacity={0.3} 
        />
      </Sphere>

      <Html position={[0, -1.8, 0]} center transform sprite zIndexRange={[100, 0]}>
        <div className={`text-xs font-bold tracking-widest uppercase ${isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-gray-500'}`}>
          Oracle
        </div>
      </Html>
    </group>
  );
}
