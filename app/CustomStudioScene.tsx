/* eslint-disable */
"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CustomStudioScene — 디자이너의 작업실 (R3F 직접 구현)
//  역할: Spline '쇼룸'과 달리 실시간 조명 테스트, 무드 믹싱이 가능한 '아틀리에'
//
//  성능 설계:
//  - Zustand selector 패턴: 구독 슬라이스 변경 시에만 리렌더
//  - React.memo on MoodSelectorPanel: mood 외 변화에 무반응
//  - useFrame 내 maath.easing.dampC: rAF 내 색상 보간 → JS 스레드 부하 최소
//  - dpr={[1, 1.5]}: 고DPI 디바이스 GPU 상한 제어
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Grid } from "@react-three/drei";
import * as THREE from "three";
import { easing } from "maath";
import { useControls, Leva } from "leva";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type R3FMoodPreset } from "./store/useStore";

// ── Zustand Selectors (컴포넌트 외부 정의 → 매 렌더마다 새 함수 생성 방지) ──
const selectMoodId     = (s: any): string            => s.currentMoodId;
const selectPresets    = (s: any): R3FMoodPreset[]   => s.moodPresets;
const selectSetMood    = (s: any)                    => s.setMood;

// ─────────────────────────────────────────────────────────────────────────────
//  Scene Background — 무드에 따라 배경색을 부드럽게 보간
// ─────────────────────────────────────────────────────────────────────────────
function SceneBackground() {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const { scene }     = useThree();

  useMemo(() => {
    scene.background = new THREE.Color("#020008");
  }, [scene]);

  useFrame((_, delta) => {
    const preset = moodPresets.find((p) => p.id === currentMoodId) ?? moodPresets[0];
    if (scene.background instanceof THREE.Color) {
      // maath.easing.dampC: 지수 평활화로 배경색 보간 (lambda 낮을수록 부드러움)
      easing.dampC(scene.background, preset.bgColor, 0.06, delta);
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scene Lighting — 3개 광원을 무드에 따라 프레임 드랍 없이 보간
// ─────────────────────────────────────────────────────────────────────────────
function SceneLighting({ intensityMultiplier }: { intensityMultiplier: number }) {
  const ambientRef  = useRef<THREE.AmbientLight>(null);
  const keyRef      = useRef<THREE.PointLight>(null);
  const rimRef      = useRef<THREE.PointLight>(null);

  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);

  useFrame((_, delta) => {
    const preset = moodPresets.find((p) => p.id === currentMoodId) ?? moodPresets[0];
    if (!ambientRef.current || !keyRef.current || !rimRef.current) return;

    // Color: maath.easing.dampC(THREE.Color, targetHex, lambda, delta)
    easing.dampC(ambientRef.current.color, preset.ambientColor,  0.18, delta);
    easing.dampC(keyRef.current.color,     preset.keyLightColor, 0.18, delta);
    easing.dampC(rimRef.current.color,     preset.rimLightColor, 0.18, delta);

    // Intensity: maath.easing.damp(object, key, target, lambda, delta)
    easing.damp(
      ambientRef.current,
      "intensity",
      preset.ambientIntensity * intensityMultiplier,
      0.18,
      delta,
    );
  });

  return (
    <>
      {/* Ambient: 전체 기저 조명 */}
      <ambientLight ref={ambientRef} color="#ff2079" intensity={0.8} />
      {/* Key Light: 메인 방향 조명 */}
      <pointLight ref={keyRef} color="#ff2079" position={[5, 6, 4]} intensity={2.5} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      {/* Rim Light: 역광, 오브젝트 테두리 강조 */}
      <pointLight ref={rimRef} color="#00d4ff" position={[-5, -3, -5]} intensity={1.5} />
      {/* Fill Light: 그림자 보정 */}
      <pointLight color="#ffffff" position={[0, 10, 0]} intensity={0.2} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hero Object — TorusKnot (metallic) + 와이어프레임 셸
// ─────────────────────────────────────────────────────────────────────────────
function HeroObject({ rotationSpeed }: { rotationSpeed: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // Y축 지속 회전 (rotationSpeed = Zustand 무드 기본값 + Leva 오버라이드)
    groupRef.current.rotation.y += delta * rotationSpeed * 0.55;
    // 사인파 X 진동 — 부드러운 '숨쉬기' 효과
    groupRef.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.22) * 0.14;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.45}>
      <group ref={groupRef}>
        {/* ── 메인 TorusKnot ── */}
        <mesh castShadow receiveShadow>
          <torusKnotGeometry args={[1, 0.3, 256, 32, 2, 3]} />
          <meshStandardMaterial
            color="#f0f0f0"
            metalness={0.97}
            roughness={0.03}
            envMapIntensity={2.8}
          />
        </mesh>
        {/* ── 와이어프레임 셸 — 깊이감 추가 ── */}
        <mesh>
          <torusKnotGeometry args={[1.045, 0.31, 128, 32, 2, 3]} />
          <meshBasicMaterial color="#ffffff" wireframe opacity={0.04} transparent />
        </mesh>
      </group>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Canvas 내부 씬 컨텐츠 — Canvas 외부에서 prop으로 주입
// ─────────────────────────────────────────────────────────────────────────────
function StudioCanvasContent({
  intensityMultiplier,
  rotationSpeed,
}: {
  intensityMultiplier: number;
  rotationSpeed: number;
}) {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const preset        = moodPresets.find((p) => p.id === currentMoodId) ?? moodPresets[0];

  return (
    <>
      <SceneBackground />
      <SceneLighting intensityMultiplier={intensityMultiplier} />
      <HeroObject rotationSpeed={rotationSpeed} />

      {/* ── 바닥 그리드 ── */}
      <Grid
        renderOrder={-1}
        position={[0, -2.6, 0]}
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.45}
        sectionSize={3}
        sectionThickness={1.2}
        sectionColor={"#1c1c1c"}
        cellColor={"#0d0d0d"}
        fadeDistance={24}
        fadeStrength={2.8}
      />

      {/* ── 카메라 컨트롤 ── */}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={14}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />

      {/* ── IBL 환경맵 ── */}
      <Environment preset="city" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MoodSelectorPanel — React.memo로 감싸 mood 외 상태 변화 시 리렌더 방지
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
      className="absolute bottom-10 left-6 z-20 flex flex-col gap-1"
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
//  Studio Info Badge — React.memo (정적 UI, 리렌더 불필요)
// ─────────────────────────────────────────────────────────────────────────────
const StudioBadge = React.memo(function StudioBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-20 left-6 z-20"
    >
      <div className="flex items-center gap-2 mb-1">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500">
          Custom R3F Studio
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
//  - useControls는 반드시 Canvas 외부에서 호출 (R3F 규칙)
//  - Leva 패널은 fixed 오버레이로 렌더 (CustomStudioScene 마운트 시에만 표시)
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomStudioScene() {
  const currentMoodId = useAppStore(selectMoodId);
  const moodPresets   = useAppStore(selectPresets);
  const preset        = moodPresets.find((p) => p.id === currentMoodId) ?? moodPresets[0];

  // ── Leva — Studio Mixer (Canvas 외부) ──────────────────────────────────
  // Intensity Multiplier: Zustand 무드 강도에 곱해지는 배율
  // Rotation Speed: 기본값은 Zustand 프리셋값으로 초기화
  const { intensityMultiplier, rotationSpeed } = useControls("Studio Mixer ✦", {
    intensityMultiplier: {
      value: 1.0,
      min: 0,
      max: 3,
      step: 0.01,
      label: "Intensity ×",
    },
    rotationSpeed: {
      value: preset.rotationSpeed,
      min: 0,
      max: 3,
      step: 0.01,
      label: "Rotation Speed",
    },
  });

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* ── Leva 패널 — 다크 테마 커스터마이징 ── */}
      <Leva
        collapsed={false}
        theme={{
          colors: {
            elevation1: "rgba(8,8,8,0.96)",
            elevation2: "rgba(14,14,14,0.96)",
            elevation3: "rgba(22,22,22,0.96)",
            accent1: "#a855f7",
            accent2: "#9333ea",
            accent3: "#7c3aed",
            highlight1: "#ffffff",
            highlight2: "#aaaaaa",
            highlight3: "#666666",
            vivid1: "#ff2079",
          },
          sizes: {
            rootWidth: "220px",
            controlWidth: "120px",
          },
          fontSizes: {
            root: "11px",
          },
        }}
      />

      {/* ── UI 오버레이 ── */}
      <StudioBadge />
      <MoodSelectorPanel />

      {/* ── R3F Canvas ── */}
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.5, 6.5], fov: 50 }}
        gl={{ antialias: true, toneMappingExposure: 1.1 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <StudioCanvasContent
            intensityMultiplier={intensityMultiplier}
            rotationSpeed={rotationSpeed}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
