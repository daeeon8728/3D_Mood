/* eslint-disable */
"use client";

import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Float,
  Grid,
  ContactShadows,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type R3FMoodPreset, type Palette, type HeroShape } from "./store/useStore";
import StudioDock from "./StudioDock";

// ── Zustand Selectors ─────────────────────────────────────────────────────
const selectMoodId    = (s: any): string             => s.currentMoodId;
const selectPresets   = (s: any): R3FMoodPreset[]    => s.moodPresets;
const selectSetMood   = (s: any)                     => s.setMood;
const selectImageUrl  = (s: any): string | null      => s.uploadedImage;
const selectPalette   = (s: any): Palette | null     => s.palette;
const selectHeroShape = (s: any): HeroShape          => s.heroShape;
const selectKeyInt    = (s: any): number             => s.keyIntensity;

// ─────────────────────────────────────────────────────────────────────────────
//  Scene Background
// ─────────────────────────────────────────────────────────────────────────────
function SceneBackground() {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const { scene }     = useThree();

  useMemo(() => {
    scene.background = new THREE.Color("#010008");
  }, [scene]);

  useFrame((_, delta) => {
    const p = moodPresets.find((x) => x.id === currentMoodId) ?? moodPresets[0];
    if (scene.background instanceof THREE.Color) {
      easing.dampC(scene.background, p.bgColor, 0.06, delta);
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dynamic Environment Intensity
// ─────────────────────────────────────────────────────────────────────────────
function DynamicEnvIntensity() {
  const { scene } = useThree();

  useFrame(() => {
    const palette = useAppStore.getState().palette;
    const target  = palette
      ? 0.5 + palette.brightness * 1.4
      : 1.0;
    scene.environmentIntensity = THREE.MathUtils.lerp(
      scene.environmentIntensity ?? 1.0,
      target,
      0.04,
    );
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Studio Lights
// ─────────────────────────────────────────────────────────────────────────────
function StudioLights({ keyIntensity }: { keyIntensity: number }) {
  const fillRef = useRef<THREE.PointLight>(null);
  const rimRef  = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const state  = useAppStore.getState();
    const preset = state.moodPresets.find((x) => x.id === state.currentMoodId) ?? state.moodPresets[0];
    if (fillRef.current) easing.dampC(fillRef.current.color, preset.keyLightColor, 0.18, delta);
    if (rimRef.current)  easing.dampC(rimRef.current.color,  preset.rimLightColor, 0.18, delta);
  });

  // 하드코딩된 fill/rim intensity (Leva 제거됨)
  const fillIntensity = 38;
  const rimIntensity = 30;

  return (
    <>
      <spotLight
        position={[0, 9, 5]}
        angle={Math.PI / 7}
        penumbra={0.65}
        intensity={keyIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-radius={8}
        color="#fffdf0"
      />
      <pointLight ref={fillRef} position={[-5, 4, 3]} intensity={fillIntensity} color="#ff2079" distance={24} decay={2} />
      <pointLight ref={rimRef}  position={[5, -2, -6]} intensity={rimIntensity} color="#00d4ff" distance={22} decay={2} />
      <ambientLight intensity={0.05} color="#8899ff" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Geometry Switcher
// ─────────────────────────────────────────────────────────────────────────────
function ShapeGeometry({ shape }: { shape: HeroShape }) {
  switch (shape) {
    case "torusknot":
      return <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />;
    case "sphere":
      return <sphereGeometry args={[1.2, 64, 64]} />;
    case "box":
      return <boxGeometry args={[1.8, 1.8, 1.8]} />;
    default:
      return <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PlainHeroMesh
// ─────────────────────────────────────────────────────────────────────────────
function PlainHeroMesh({ shape }: { shape: HeroShape }) {
  return (
    <mesh castShadow receiveShadow>
      <ShapeGeometry shape={shape} />
      <MeshTransmissionMaterial
        backside
        samples={16}
        resolution={512}
        transmission={1}
        roughness={0.04}
        thickness={0.55}
        ior={1.52}
        chromaticAberration={0.45}
        anisotropy={0.35}
        distortion={0.5}
        distortionScale={0.5}
        temporalDistortion={0.12}
        envMapIntensity={2.8}
        color="#ffffff"
        attenuationDistance={4}
        attenuationColor="#b8d4ff"
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TexturedHeroMesh
// ─────────────────────────────────────────────────────────────────────────────
function TexturedHeroMesh({ imageUrl, shape }: { imageUrl: string; shape: HeroShape }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl);

  useMemo(() => {
    texture.colorSpace  = THREE.SRGBColorSpace;
    texture.wrapS       = THREE.RepeatWrapping;
    texture.wrapT       = THREE.RepeatWrapping;
    // 갤러리 액자처럼 매핑하기 위해 반복 및 오프셋 조정 가능 (추가 최적화)
    texture.repeat.set(2, 1);
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh castShadow receiveShadow>
      <ShapeGeometry shape={shape} />
      <meshPhysicalMaterial
        map={texture}
        metalness={0.75}
        roughness={0.18}
        envMapIntensity={2.8}
        clearcoat={0.85}
        clearcoatRoughness={0.12}
        iridescence={0.2}
        iridescenceIOR={1.3}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeroObject
// ─────────────────────────────────────────────────────────────────────────────
function HeroObject({
  imageUrl,
  shape,
}: {
  imageUrl: string | null;
  shape: HeroShape;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationSpeed = 0.5;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * rotationSpeed * 0.55;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.1} floatIntensity={0.35}>
      <group ref={groupRef}>
        {imageUrl ? (
          <Suspense fallback={<PlainHeroMesh shape={shape} />}>
            <TexturedHeroMesh imageUrl={imageUrl} shape={shape} />
          </Suspense>
        ) : (
          <PlainHeroMesh shape={shape} />
        )}

        <mesh>
          <ShapeGeometry shape={shape} />
          <meshBasicMaterial color="#ffffff" wireframe opacity={0.022} transparent />
        </mesh>
      </group>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamicContactShadows
// ─────────────────────────────────────────────────────────────────────────────
function DynamicContactShadows() {
  const brightness = useAppStore((s) => s.palette?.brightness ?? 0.5);
  const opacity    = 0.28 + (1 - brightness) * 0.55;

  return (
    <ContactShadows
      position={[0, -2.5, 0]}
      scale={14}
      blur={3}
      opacity={opacity}
      color="#000018"
      frames={Infinity}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Canvas Inner Scene
// ─────────────────────────────────────────────────────────────────────────────
function StudioCanvasContent({
  keyIntensity,
  shape,
  imageUrl,
}: {
  keyIntensity: number;
  shape: HeroShape;
  imageUrl: string | null;
}) {
  return (
    <>
      <SceneBackground />
      <DynamicEnvIntensity />
      <StudioLights keyIntensity={keyIntensity} />
      <HeroObject imageUrl={imageUrl} shape={shape} />
      <DynamicContactShadows />
      <Grid
        renderOrder={-1}
        position={[0, -2.51, 0]}
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.28}
        sectionSize={3}
        sectionThickness={0.75}
        sectionColor={"#0e0e1a"}
        cellColor={"#080810"}
        fadeDistance={22}
        fadeStrength={3.5}
      />
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={14}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />
      <Environment preset="city" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mood Selector Panel
// ─────────────────────────────────────────────────────────────────────────────
const MoodSelectorPanel = React.memo(function MoodSelectorPanel() {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const setMood       = useAppStore(selectSetMood);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-10 left-6 z-20 flex flex-col gap-1 pointer-events-auto"
    >
      <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-600 mb-2">
        Mood Engine
      </p>
      {moodPresets.map((preset: R3FMoodPreset) => {
        const isActive = currentMoodId === preset.id;
        return (
          <motion.button
            key={preset.id}
            onClick={() => setMood(preset.id)}
            whileHover={{ x: 4, transition: { type: "spring", stiffness: 600, damping: 40 } }}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all border ${
              isActive
                ? "border-white/15 bg-white/[0.07]"
                : "border-transparent hover:bg-white/[0.04]"
            }`}
          >
            <span className="text-base leading-none flex-shrink-0">{preset.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold leading-none ${isActive ? "text-white" : "text-zinc-500"}`}>
                {preset.label}
              </p>
              <p className="text-[10px] text-zinc-700 mt-0.5 leading-none">{preset.description}</p>
            </div>
            <AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="mood-indicator-r3f"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] flex-shrink-0"
                />
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Studio Badge
// ─────────────────────────────────────────────────────────────────────────────
const StudioBadge = React.memo(function StudioBadge() {
  const palette = useAppStore(selectPalette);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-20 left-6 z-20 pointer-events-none"
    >
      <div className="flex items-center gap-2 mb-1">
        <motion.span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: palette?.dominant ?? "#a855f7" }}
          animate={{
            opacity: [1, 0.4, 1],
            boxShadow: palette?.dominant
              ? [`0 0 6px ${palette.dominant}`, `0 0 2px ${palette.dominant}`, `0 0 6px ${palette.dominant}`]
              : ["0 0 6px #a855f7", "0 0 2px #a855f7", "0 0 6px #a855f7"],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">
          R3F Studio · Image Sync
        </p>
      </div>
      <p
        className="text-[11px] text-zinc-700"
        style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
      >
        작업실 — Designer&apos;s Atelier
      </p>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Main Export
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomStudioScene() {
  const imageUrl     = useAppStore(selectImageUrl);
  const heroShape    = useAppStore(selectHeroShape);
  const keyIntensity = useAppStore(selectKeyInt);

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* ── R3F Canvas ── */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.5, 6.5], fov: 50 }}
          gl={{
            antialias: true,
            toneMappingExposure: 1.6,
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <StudioCanvasContent
              keyIntensity={keyIntensity}
              shape={heroShape}
              imageUrl={imageUrl}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── UI 오버레이 ── */}
      <StudioBadge />
      <MoodSelectorPanel />

      {/* 하단 통합 도구 바 (StudioDock) */}
      <StudioDock />
    </div>
  );
}
