"use client";

import React, { Suspense, useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  OrbitControls, 
  Environment, 
  Float, 
  useTexture, 
  Decal,
  PresentationControls
} from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "./store/useStore";
import StudioDock from "./StudioDock";
import { motion } from "framer-motion";

type MaterialType = 'acrylic' | 'chrome' | 'clay' | 'neon';
type LightType = 'studio' | 'sunset' | 'cyberpunk';

// ── 3D Object Component ──
function MockupObject({ imageUrl, materialType }: { imageUrl: string; materialType: MaterialType }) {
  const texture = useTexture(imageUrl);
  const meshRef = useRef<THREE.Mesh>(null);

  const img = texture.image as any;
  const aspect = img.width / img.height;
  const width = aspect > 1 ? 4 : 4 * aspect;
  const height = aspect > 1 ? 4 / aspect : 4;
  const depth = 0.4;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  const materialProps = useMemo(() => {
    switch (materialType) {
      case 'acrylic':
        return { transmission: 1, thickness: 1.5, roughness: 0.05, ior: 1.5, iridescence: 1, iridescenceIOR: 1.3, clearcoat: 1, color: "#ffffff" };
      case 'chrome':
        return { metalness: 1, roughness: 0.1, color: "#eeeeee", clearcoat: 1 };
      case 'clay':
        return { metalness: 0, roughness: 0.9, color: "#e0e0e0", clearcoat: 0 };
      case 'neon':
        return { metalness: 0.2, roughness: 0.1, color: "#ff00ff", emissive: "#ff00ff", emissiveIntensity: 0.5, clearcoat: 1 };
      default: return {};
    }
  }, [materialType]);

  return (
    <PresentationControls global rotation={[0, 0, 0]} polar={[-0.4, 0.2]} azimuth={[-0.4, 0.4]}>
      <Float rotationIntensity={0.4} floatIntensity={0}>
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshPhysicalMaterial {...materialProps} />
          
          {(materialType === 'acrylic' || materialType === 'neon') && (
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[width * 0.95, height * 0.95]} />
              <meshBasicMaterial map={texture} />
            </mesh>
          )}

          {(materialType === 'chrome' || materialType === 'clay') && (
            <Decal position={[0, 0, depth / 2]} rotation={[0, 0, 0]} scale={[width * 0.9, height * 0.9, 1]}>
              <meshPhysicalMaterial map={texture} polygonOffset polygonOffsetFactor={-1} roughness={materialType === 'clay' ? 0.8 : 0.2} metalness={0.1} />
            </Decal>
          )}
        </mesh>
      </Float>
    </PresentationControls>
  );
}

// ── Main Scene Content ──
function SceneContent({ imageUrl, materialType, lightType }: { imageUrl: string | null; materialType: MaterialType; lightType: LightType }) {
  return (
    <>
      {lightType === 'sunset' ? (
        <>
          <Environment preset="sunset" />
          <spotLight position={[5, 2, 5]} angle={0.2} penumbra={1} intensity={2} color="#ff7e67" />
          <ambientLight intensity={0.2} />
        </>
      ) : lightType === 'cyberpunk' ? (
        <>
          <Environment preset="night" />
          <spotLight position={[-5, 5, 5]} angle={0.5} penumbra={1} intensity={5} color="#ff00ff" />
          <spotLight position={[5, -5, -5]} angle={0.5} penumbra={1} intensity={5} color="#00ffff" />
          <ambientLight intensity={0.1} />
        </>
      ) : (
        <>
          <Environment preset="studio" />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <ambientLight intensity={0.5} />
        </>
      )}
      
      {imageUrl && (
        <Suspense fallback={null}>
          <MockupObject imageUrl={imageUrl} materialType={materialType} />
        </Suspense>
      )}
      <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={12} />
    </>
  );
}

// ── Exported Component ──
export default function MockupStudioScene() {
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const [materialType, setMaterialType] = useState<MaterialType>('acrylic');
  const [lightType, setLightType] = useState<LightType>('studio');

  const handleDownload = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'material-lab-snapshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="relative w-full h-full bg-[#050505] overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="absolute inset-0">
        <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 0, 7], fov: 45 }} shadows>
          <SceneContent imageUrl={uploadedImage} materialType={materialType} lightType={lightType} />
        </Canvas>
      </div>

      {/* ── Badge ── */}
      <div className="absolute top-20 left-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#A855F7]" />
          <p className="text-[9px] font-bold tracking-widest uppercase text-purple-500">Material Engine</p>
        </div>
        <p className="text-[11px] text-zinc-400" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>Premium Finishes & Mockups</p>
      </div>

      {/* ── UI Panels ── */}
      <div className="absolute top-20 right-6 z-20 flex flex-col gap-6">
        {/* Material Switcher */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1 text-right">Finishes</p>
          {(['acrylic', 'chrome', 'clay', 'neon'] as MaterialType[]).map((type) => (
            <button key={type} onClick={() => setMaterialType(type)} className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all border ${materialType === type ? 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-black/40 border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5'} backdrop-blur-md`}>
              {type}
            </button>
          ))}
        </div>

        {/* Lighting Switcher */}
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-1 text-right">Lighting</p>
          {(['studio', 'sunset', 'cyberpunk'] as LightType[]).map((type) => (
            <button key={type} onClick={() => setLightType(type)} className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all border ${lightType === type ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-black/40 border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5'} backdrop-blur-md`}>
              {type}
            </button>
          ))}
        </div>
        
        {/* Export Button */}
        {uploadedImage && (
          <button onClick={handleDownload} className="mt-4 px-4 py-3 rounded-xl text-xs font-bold tracking-wide uppercase bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors">
            📸 Snapshot
          </button>
        )}
      </div>

      {!uploadedImage && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-2xl border border-purple-500/30 flex items-center justify-center mb-6 bg-purple-500/10"><span className="text-3xl">✨</span></div>
          <p className="text-sm font-bold text-zinc-400 tracking-widest uppercase">Upload a Design</p>
        </div>
      )}
      <StudioDock />
    </div>
  );
}
