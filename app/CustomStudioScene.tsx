/* eslint-disable */
"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CustomStudioScene v2 — High-End R3F Atelier
//
//  조명 설계: 삼각 조명 시스템 (Triangle Lighting)
//    ① Key SpotLight  : 상단 고강도 키라이트 (castShadow, ACES)
//    ② Fill PointLight: Zustand 무드 색상 → maath.easing.dampC 보간
//    ③ Rim PointLight : Zustand 림 색상 → maath.easing.dampC 보간
//    ④ Ambient         : 극소값 (드라마틱 대비 유지)
//
//  재질: MeshTransmissionMaterial (glass) / MeshPhysicalMaterial (metal, chrome)
//  그림자: ContactShadows (drei, 소프트 바닥 그림자)
//  색조정: ACESFilmicToneMapping + toneMappingExposure
//
//  Leva 연결 패턴:
//    Intensity/Material → useControls() → prop으로 Canvas에 주입 → 즉각 반영
//    무드 색상           → Zustand selector → useFrame + maath.easing → 보간
//
//  성능:
//    - React.memo on MoodSelectorPanel, StudioBadge
//    - Zustand selector 패턴 (구독 슬라이스만 리렌더)
//    - dpr={[1, 1.5]} GPU 상한 제어
//    - Canvas를 DOM상 먼저 배치 → UI 오버레이가 z-index 없이도 위에 렌더
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { useAppStore, type R3FMoodPreset } from "./store/useStore";

// ── Zustand Selectors (외부 정의 → 매 렌더마다 새 함수 객체 방지) ──────────
const selectMoodId  = (s: any): string          => s.currentMoodId;
const selectPresets = (s: any): R3FMoodPreset[] => s.moodPresets;
const selectSetMood = (s: any)                  => s.setMood;

// ─────────────────────────────────────────────────────────────────────────────
//  Scene Background — 무드 변경 시 배경색 부드럽게 보간
// ─────────────────────────────────────────────────────────────────────────────
function SceneBackground() {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const { scene }     = useThree();

  // 초기 배경색 설정 (마운트 한 번만)
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
//  Studio Lights — 삼각 조명 (Triangle Lighting)
//  Key intensity → Leva prop 직접 바인딩 (즉각 반영)
//  Fill/Rim 색상 → Zustand + maath.easing.dampC (프레임 드랍 없는 보간)
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

  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);

  useFrame((_, delta) => {
    const p = moodPresets.find((x) => x.id === currentMoodId) ?? moodPresets[0];
    // 색상만 Zustand에서 보간 — intensity는 Leva에서 즉각 반영
    if (fillRef.current) easing.dampC(fillRef.current.color, p.keyLightColor, 0.18, delta);
    if (rimRef.current)  easing.dampC(rimRef.current.color,  p.rimLightColor, 0.18, delta);
  });

  return (
    <>
      {/* ① Key Light: 상단 스팟 — 스튜디오 메인 조명, 고강도, 그림자 생성 */}
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
      {/* ② Fill Light: 무드 색상 좌측 필라이트 */}
      <pointLight
        ref={fillRef}
        position={[-5, 4, 3]}
        intensity={fillIntensity}
        color="#ff2079"
        distance={24}
        decay={2}
      />
      {/* ③ Rim Light: 보색 역광 — 오브젝트 테두리 강조 */}
      <pointLight
        ref={rimRef}
        position={[5, -2, -6]}
        intensity={rimIntensity}
        color="#00d4ff"
        distance={22}
        decay={2}
      />
      {/* ④ Ambient: 극소값 (드라마틱 대비 유지용 베이스) */}
      <ambientLight intensity={0.05} color="#8899ff" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hero Object — TorusKnot + Premium Material
//  materialMode: 'metal' | 'glass' | 'chrome'
//  Glass: MeshTransmissionMaterial (drei) — 굴절, 색수차, 반사
//  Metal: meshPhysicalMaterial — clearcoat, iridescence
//  Chrome: meshPhysicalMaterial — 미러 크롬
// ─────────────────────────────────────────────────────────────────────────────
function HeroObject({
  rotationSpeed,
  materialMode,
  envMapIntensity,
}: {
  rotationSpeed: number;
  materialMode: string;
  envMapIntensity: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * rotationSpeed * 0.55;
    // 부드러운 사인파 진동 (X축)
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.1} floatIntensity={0.35}>
      <group ref={groupRef}>
        <mesh castShadow receiveShadow>
          <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />

          {/* ── GLASS: 굴절 유리 ── */}
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
              anisotropy={0.4}
              distortion={0.55}
              distortionScale={0.55}
              temporalDistortion={0.12}
              envMapIntensity={envMapIntensity}
              color="#ffffff"
              attenuationDistance={4}
              attenuationColor="#b8d4ff"
            />
          )}

          {/* ── METAL: 고광택 금속 (iridescence, clearcoat) ── */}
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
              reflectivity={1}
            />
          )}

          {/* ── CHROME: 미러 크롬 ── */}
          {materialMode === "chrome" && (
            <meshPhysicalMaterial
              color="#c8d4e8"
              metalness={1.0}
              roughness={0.0}
              envMapIntensity={envMapIntensity * 1.6}
              reflectivity={1}
              clearcoat={1.0}
              clearcoatRoughness={0.0}
            />
          )}
        </mesh>

        {/* 와이어프레임 셸 — 구조적 깊이감 */}
        <mesh>
          <torusKnotGeometry args={[1.048, 0.305, 128, 32, 2, 3]} />
          <meshBasicMaterial color="#ffffff" wireframe opacity={0.022} transparent />
        </mesh>
      </group>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Canvas Inner Scene
//  Leva 값은 prop으로 수신 → 즉각 반영 (useFrame 보간 없이 직접 바인딩)
// ─────────────────────────────────────────────────────────────────────────────
function StudioCanvasContent({
  keyIntensity,
  fillIntensity,
  rimIntensity,
  rotationSpeed,
  materialMode,
  envMapIntensity,
  envPreset,
}: {
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  rotationSpeed: number;
  materialMode: string;
  envMapIntensity: number;
  envPreset: "city" | "studio" | "warehouse" | "dawn";
}) {
  return (
    <>
      <SceneBackground />

      <StudioLights
        keyIntensity={keyIntensity}
        fillIntensity={fillIntensity}
        rimIntensity={rimIntensity}
      />

      <HeroObject
        rotationSpeed={rotationSpeed}
        materialMode={materialMode}
        envMapIntensity={envMapIntensity}
      />

      {/* ContactShadows: 소프트 바닥 그림자 — 실제 그림자보다 부드럽고 미려 */}
      <ContactShadows
        position={[0, -2.5, 0]}
        scale={14}
        blur={3}
        opacity={0.72}
        color="#000018"
        frames={Infinity}
      />

      {/* 미묘한 바닥 그리드 */}
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

      {/* 카메라 컨트롤 */}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={14}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />

      {/* IBL 환경맵: 실제 반사 계산의 핵심 */}
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
//  Studio Badge (React.memo — 정적 UI)
// ─────────────────────────────────────────────────────────────────────────────
const StudioBadge = React.memo(function StudioBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-20 left-6 z-20 pointer-events-none"
    >
      <div className="flex items-center gap-2 mb-1">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">
          R3F Studio — High-End
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
//
//  구조 설계 원칙:
//  1. Canvas를 DOM 상 먼저 배치 (absolute inset-0)
//  2. UI 오버레이를 Canvas 이후 DOM에 배치 + z-20
//     → 별도 z-index 없이도 오버레이가 Canvas 위에 렌더됨
//  3. Leva는 body portal → 어떤 stacking context도 무관, 항상 최상위
//  4. isolation: isolate → 이 컨테이너의 stacking context 격리
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomStudioScene() {
  // ── Leva: Canvas 외부에서 선언 (R3F 규칙) ─────────────────────────────
  const {
    keyIntensity,
    fillIntensity,
    rimIntensity,
    rotationSpeed,
    materialMode,
    envMapIntensity,
    envPreset,
  } = useControls("Studio Mixer ✦", {
    // ── 조명 폴더 ──────────────────────────────────────────────────────
    Lighting: folder(
      {
        keyIntensity: {
          value: 120,
          min: 0,
          max: 600,
          step: 1,
          label: "☀ Key Light",
        },
        fillIntensity: {
          value: 38,
          min: 0,
          max: 250,
          step: 1,
          label: "◐ Fill Light",
        },
        rimIntensity: {
          value: 30,
          min: 0,
          max: 200,
          step: 1,
          label: "◑ Rim Light",
        },
      },
      { collapsed: false }
    ),
    // ── 재질 폴더 ──────────────────────────────────────────────────────
    Material: folder(
      {
        materialMode: {
          options: ["metal", "glass", "chrome"],
          label: "⬡ Surface",
        },
        envMapIntensity: {
          value: 2.8,
          min: 0,
          max: 6,
          step: 0.1,
          label: "Env Map ×",
        },
      },
      { collapsed: false }
    ),
    // ── 씬 폴더 ────────────────────────────────────────────────────────
    Scene: folder(
      {
        rotationSpeed: {
          value: 0.5,
          min: 0,
          max: 3,
          step: 0.01,
          label: "↻ Rotation",
        },
        envPreset: {
          options: {
            City: "city",
            Studio: "studio",
            Warehouse: "warehouse",
            Dawn: "dawn",
          },
          label: "Environment",
        },
      },
      { collapsed: true }
    ),
  });

  return (
    // isolation: isolate → 새 stacking context 생성, 내부 z-index 격리
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* ── Leva: body portal 렌더 → 항상 최상위 ── */}
      <Leva
        collapsed={false}
        theme={{
          colors: {
            elevation1: "rgba(5,5,8,0.97)",
            elevation2: "rgba(10,10,16,0.97)",
            elevation3: "rgba(18,18,26,0.97)",
            accent1: "#a855f7",
            accent2: "#9333ea",
            accent3: "#7c3aed",
            highlight1: "#ffffff",
            highlight2: "#aaaaaa",
            highlight3: "#555555",
            vivid1: "#ff2079",
          },
          sizes: {
            rootWidth: "245px",
            controlWidth: "130px",
          },
          fontSizes: { root: "11px" },
        }}
      />

      {/* ── R3F Canvas: DOM 상 먼저 배치 (z-index auto = 아래) ── */}
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
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── UI 오버레이: DOM 상 Canvas 뒤에 배치 + z-20 ── */}
      <StudioBadge />
      <MoodSelectorPanel />
    </div>
  );
}
