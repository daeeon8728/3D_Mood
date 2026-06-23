/* eslint-disable */
"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CustomStudioScene v3 — Image-to-3D Sync Studio
//
//  핵심 기능:
//  ① TexturedHeroMesh  : useLoader(TextureLoader, imageUrl) → meshPhysicalMaterial.map
//                        → Suspense fallback: PlainHeroMesh (재질 전환 중 빈화면 방지)
//  ② DynamicLights     : Zustand 팔레트 색상 → maath.easing.dampC 부드러운 보간
//  ③ DynamicShadows    : palette.brightness → ContactShadows opacity 동적 조절
//  ④ DynamicEnvLight   : palette.brightness → scene.environmentIntensity 동적 조절
//  ⑤ ImageUploader UI  : 우측 하단 패널 (드랍존 + 팔레트 스와치)
//  ⑥ Image thumbnail   : 우측 상단 Leva 패널 옆 48px 썸네일
//
//  Leva 테마: 라이트/미니멀 (elevation1: white계열)
//  성능: React.memo, Zustand selector, dpr=[1,1.5], ACESFilmic ToneMapping
// ─────────────────────────────────────────────────────────────────────────────

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
import { useControls, Leva, folder } from "leva";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type R3FMoodPreset, type Palette } from "./store/useStore";
import ImageUploader from "./ImageUploader";

// ── Zustand Selectors ─────────────────────────────────────────────────────
const selectMoodId    = (s: any): string             => s.currentMoodId;
const selectPresets   = (s: any): R3FMoodPreset[]    => s.moodPresets;
const selectSetMood   = (s: any)                     => s.setMood;
const selectImageUrl  = (s: any): string | null      => s.uploadedImage;
const selectPalette   = (s: any): Palette | null     => s.palette;

// ─────────────────────────────────────────────────────────────────────────────
//  Scene Background — 무드/팔레트에 따라 배경색 보간
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
//  Dynamic Environment Intensity — 이미지 밝기에 따라 IBL 강도 조절
//  밝은 이미지 → 강한 환경 반사 / 어두운 이미지 → 극적인 대비
// ─────────────────────────────────────────────────────────────────────────────
function DynamicEnvIntensity() {
  const { scene } = useThree();

  useFrame(() => {
    const palette = useAppStore.getState().palette;
    const target  = palette
      ? 0.5 + palette.brightness * 1.4   // 밝은 이미지: 최대 1.9
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
//  Studio Lights — 삼각 조명 (Triangle Lighting)
//  Fill/Rim 색상: Zustand 무드 프리셋(팔레트 기반) → maath.easing.dampC
// ─────────────────────────────────────────────────────────────────────────────
function StudioLights({
  keyIntensity,
  fillIntensity,
  rimIntensity,
}: {
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
}) {
  const fillRef = useRef<THREE.PointLight>(null);
  const rimRef  = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const state  = useAppStore.getState();
    const preset = state.moodPresets.find((x) => x.id === state.currentMoodId) ?? state.moodPresets[0];
    if (fillRef.current) easing.dampC(fillRef.current.color, preset.keyLightColor, 0.18, delta);
    if (rimRef.current)  easing.dampC(rimRef.current.color,  preset.rimLightColor, 0.18, delta);
  });

  return (
    <>
      {/* ① Key: 상단 스팟 — 메인 스튜디오 조명 */}
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
      {/* ② Fill: 무드 색상 */}
      <pointLight ref={fillRef} position={[-5, 4, 3]} intensity={fillIntensity} color="#ff2079" distance={24} decay={2} />
      {/* ③ Rim: 역광 */}
      <pointLight ref={rimRef}  position={[5, -2, -6]} intensity={rimIntensity} color="#00d4ff" distance={22} decay={2} />
      {/* ④ Ambient: 드라마틱 대비를 위한 극소 베이스 */}
      <ambientLight intensity={0.05} color="#8899ff" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PlainHeroMesh — 이미지 없을 때 또는 TexturedHeroMesh 로딩 중 fallback
// ─────────────────────────────────────────────────────────────────────────────
function PlainHeroMesh({
  materialMode,
  envMapIntensity,
}: {
  materialMode: string;
  envMapIntensity: number;
}) {
  return (
    <mesh castShadow receiveShadow>
      <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />

      {materialMode === "glass" && (
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
          envMapIntensity={envMapIntensity}
          color="#ffffff"
          attenuationDistance={4}
          attenuationColor="#b8d4ff"
        />
      )}
      {materialMode === "metal" && (
        <meshPhysicalMaterial
          color="#dde4ee"
          metalness={0.98}
          roughness={0.03}
          envMapIntensity={envMapIntensity}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          iridescence={0.5}
          iridescenceIOR={1.5}
          iridescenceThicknessRange={[100, 400]}
        />
      )}
      {materialMode === "chrome" && (
        <meshPhysicalMaterial
          color="#c8d4e8"
          metalness={1.0}
          roughness={0.0}
          envMapIntensity={envMapIntensity * 1.6}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
        />
      )}
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TexturedHeroMesh — 업로드 이미지를 3D 표면에 실시간 매핑
//  useLoader: Suspense 기반 — 로딩 중 PlainHeroMesh가 fallback으로 표시됨
// ─────────────────────────────────────────────────────────────────────────────
function TexturedHeroMesh({ imageUrl, envMapIntensity }: { imageUrl: string; envMapIntensity: number }) {
  // useLoader: R3F 내장, Suspense 트리거, URL 키 기반 캐시
  const texture = useLoader(THREE.TextureLoader, imageUrl);

  // 텍스처 설정: 한 번만 실행 (texture 인스턴스 변경 시)
  useMemo(() => {
    texture.colorSpace  = THREE.SRGBColorSpace;
    texture.wrapS       = THREE.RepeatWrapping;
    texture.wrapT       = THREE.RepeatWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh castShadow receiveShadow>
      <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />
      {/* meshPhysicalMaterial: 텍스처 + 금속감 + 클리어코트 */}
      <meshPhysicalMaterial
        map={texture}
        metalness={0.75}
        roughness={0.18}
        envMapIntensity={envMapIntensity}
        clearcoat={0.85}
        clearcoatRoughness={0.12}
        iridescence={0.2}
        iridescenceIOR={1.3}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeroObject — 이미지 유무에 따라 TexturedHeroMesh or PlainHeroMesh
//  Float + Group: 회전 로직을 공유 (텍스처 전환과 무관하게 계속 회전)
// ─────────────────────────────────────────────────────────────────────────────
function HeroObject({
  imageUrl,
  rotationSpeed,
  materialMode,
  envMapIntensity,
}: {
  imageUrl: string | null;
  rotationSpeed: number;
  materialMode: string;
  envMapIntensity: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * rotationSpeed * 0.55;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.1} floatIntensity={0.35}>
      <group ref={groupRef}>
        {/* 이미지가 있으면 텍스처 메시, 없으면 재질 메시 */}
        {imageUrl ? (
          // Suspense: useLoader가 로딩 중일 때 PlainHeroMesh 표시
          <Suspense fallback={<PlainHeroMesh materialMode={materialMode} envMapIntensity={envMapIntensity} />}>
            <TexturedHeroMesh imageUrl={imageUrl} envMapIntensity={envMapIntensity} />
          </Suspense>
        ) : (
          <PlainHeroMesh materialMode={materialMode} envMapIntensity={envMapIntensity} />
        )}

        {/* 와이어프레임 셸 (항상 표시 — 구조적 깊이감) */}
        <mesh>
          <torusKnotGeometry args={[1.048, 0.305, 128, 32, 2, 3]} />
          <meshBasicMaterial color="#ffffff" wireframe opacity={0.022} transparent />
        </mesh>
      </group>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DynamicContactShadows
//  이미지 밝기(palette.brightness) → 그림자 불투명도 역비례
//  어두운 이미지 → 짙은 그림자 / 밝은 이미지 → 옅은 그림자
// ─────────────────────────────────────────────────────────────────────────────
function DynamicContactShadows() {
  // selector: brightness 값만 구독
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
//  Canvas Inner Scene — 모든 R3F 컨텐츠를 묶음
// ─────────────────────────────────────────────────────────────────────────────
function StudioCanvasContent({
  keyIntensity,
  fillIntensity,
  rimIntensity,
  rotationSpeed,
  materialMode,
  envMapIntensity,
  envPreset,
  imageUrl,
}: {
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  rotationSpeed: number;
  materialMode: string;
  envMapIntensity: number;
  envPreset: "city" | "studio" | "warehouse" | "dawn";
  imageUrl: string | null;
}) {
  return (
    <>
      <SceneBackground />
      <DynamicEnvIntensity />
      <StudioLights
        keyIntensity={keyIntensity}
        fillIntensity={fillIntensity}
        rimIntensity={rimIntensity}
      />
      <HeroObject
        imageUrl={imageUrl}
        rotationSpeed={rotationSpeed}
        materialMode={materialMode}
        envMapIntensity={envMapIntensity}
      />
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
      <Environment preset={envPreset} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mood Selector Panel (React.memo)
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
//  Studio Badge (React.memo)
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
//  Image Thumbnail (우측 상단 — Leva 패널 옆)
// ─────────────────────────────────────────────────────────────────────────────
const ImageThumbnail = React.memo(function ImageThumbnail() {
  const uploadedImage = useAppStore(selectImageUrl);
  const palette       = useAppStore(selectPalette);

  return (
    <AnimatePresence>
      {uploadedImage && (
        <motion.div
          key="thumb"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 40 }}
          className="absolute z-30 overflow-hidden rounded-xl border shadow-2xl pointer-events-none"
          style={{
            top: "80px",
            right: "258px",      // Leva 패널(245px) 왼쪽
            width: "52px",
            height: "52px",
            borderColor: palette?.dominant ?? "rgba(255,255,255,0.2)",
            boxShadow: palette?.dominant
              ? `0 0 12px ${palette.dominant}60`
              : "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <img
            src={uploadedImage}
            alt="Uploaded"
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Main Export
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomStudioScene() {
  const imageUrl = useAppStore(selectImageUrl);

  // ── Leva Controls (Canvas 외부 선언 — R3F 규칙) ──────────────────────
  const {
    keyIntensity,
    fillIntensity,
    rimIntensity,
    rotationSpeed,
    materialMode,
    envMapIntensity,
    envPreset,
  } = useControls("Studio Mixer ✦", {
    Lighting: folder(
      {
        keyIntensity:  { value: 120, min: 0, max: 600, step: 1,   label: "☀ Key"  },
        fillIntensity: { value: 38,  min: 0, max: 250, step: 1,   label: "◐ Fill" },
        rimIntensity:  { value: 30,  min: 0, max: 200, step: 1,   label: "◑ Rim"  },
      },
      { collapsed: false },
    ),
    Material: folder(
      {
        materialMode:    { options: ["metal", "glass", "chrome"], label: "⬡ Surface" },
        envMapIntensity: { value: 2.8, min: 0, max: 6, step: 0.1, label: "Env Map ×" },
      },
      { collapsed: false },
    ),
    Scene: folder(
      {
        rotationSpeed: { value: 0.5, min: 0, max: 3, step: 0.01, label: "↻ Rotation" },
        envPreset: {
          options: { City: "city", Studio: "studio", Warehouse: "warehouse", Dawn: "dawn" },
          label: "Environment",
        },
      },
      { collapsed: true },
    ),
  });

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* ── Leva: 라이트/미니멀 테마 ── */}
      <Leva
        collapsed={false}
        theme={{
          colors: {
            elevation1: "rgba(252,252,255,0.97)",
            elevation2: "rgba(244,244,250,0.97)",
            elevation3: "rgba(234,234,246,0.97)",
            accent1: "#1a1a2e",
            accent2: "#2d2d4e",
            accent3: "#5a5a8a",
            highlight1: "#111111",
            highlight2: "#444444",
            highlight3: "#888888",
            vivid1: "#7c3aed",
          },
          sizes: {
            rootWidth: "245px",
            controlWidth: "130px",
          },
          fontSizes: { root: "11px" },
        }}
      />

      {/* ── R3F Canvas (DOM 먼저 배치 → UI 오버레이가 위에 렌더됨) ── */}
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
              fillIntensity={fillIntensity}
              rimIntensity={rimIntensity}
              rotationSpeed={rotationSpeed}
              materialMode={materialMode}
              envMapIntensity={envMapIntensity}
              envPreset={envPreset as "city" | "studio" | "warehouse" | "dawn"}
              imageUrl={imageUrl}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── UI 오버레이 (DOM 후배치 + z-index) ── */}
      <StudioBadge />
      <MoodSelectorPanel />

      {/* 이미지 썸네일 (Leva 패널 옆, 우측 상단) */}
      <ImageThumbnail />

      {/* ImageUploader 패널 (우측 하단) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-10 right-5 z-20 w-52 pointer-events-auto"
      >
        <ImageUploader />
      </motion.div>
    </div>
  );
}
