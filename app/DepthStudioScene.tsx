"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Text3D, Center } from "@react-three/drei";

function PlaceholderContent() {
  return (
    <>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Center>
          <Text3D
            font="/fonts/Inter_Bold.json"
            size={0.8}
            height={0.2}
            curveSegments={12}
            bevelEnabled
            bevelThickness={0.05}
            bevelSize={0.02}
            bevelOffset={0}
            bevelSegments={5}
          >
            AI Depth Parallax
            <meshStandardMaterial color="#4ADE80" metalness={0.8} roughness={0.2} />
          </Text3D>
        </Center>
      </Float>
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Environment preset="city" />
      <OrbitControls autoRotate autoRotateSpeed={0.5} enablePan={false} />
    </>
  );
}

export default function DepthStudioScene() {
  return (
    <div className="relative w-full h-full bg-black overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <Suspense fallback={null}>
            <PlaceholderContent />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute top-20 left-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ADE80]" />
          <p className="text-[9px] font-bold tracking-widest uppercase text-emerald-500">
            Depth Engine
          </p>
        </div>
        <p className="text-[11px] text-zinc-400" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          Interactive Parallax Lab (Coming Soon)
        </p>
      </div>
    </div>
  );
}
