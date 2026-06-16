/* eslint-disable */
"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  ThreeDCanvas.tsx  —  Cinematic Neon Intro
//
//  Stack:  React Three Fiber · Drei · Three.js · Framer Motion (fade only)
//  Sequence:
//    1. Neon sign flickers ON (useFrame — no framer-motion)
//    2. Mouse-driven tilt of the whole scene
//    3. Sparkles float around the letters
//    4. Click → per-letter explosion physics → black fade → main app
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrthographicCamera,
  Text3D,
  Center,
  MeshTransmissionMaterial,
  Sparkles,
} from "@react-three/drei";

// ── Font ─────────────────────────────────────────────────────────────────────
const FONT = "https://threejs.org/examples/fonts/helvetiker_bold.typeface.json";

// ─────────────────────────────────────────────────────────────────────────────
//  NeonLetter: one glyph — owns its flicker timer & explosion physics
// ─────────────────────────────────────────────────────────────────────────────
function NeonLetter({
  char,
  offsetX,
  neonColor,
  phase,
  size = 1.6,
  height = 0.45,
}: {
  char: string;
  offsetX: number;
  neonColor: string;
  phase: "idle" | "exploding";
  size?: number;
  height?: number;
}) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const matRef    = useRef<THREE.MeshPhysicalMaterial>(null);
  const ftimer    = useRef(0);          // flicker timer
  const stable    = useRef(false);      // true once the initial flicker-ON is done

  // ── Stable physics vectors (memo = computed once, never re-computed)
  const vel = useMemo(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 32,
        (Math.random() + 0.4) * 22,
        (Math.random() - 0.5) * 18
      ),
    []
  );
  const angVel = useMemo(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      ),
    []
  );

  // ── elapsed time ref for the opening flicker-on sequence
  const elapsed = useRef(0);

  useFrame((_state, dt) => {
    // ① Explosion physics — letters fly away
    if (phase === "exploding" && meshRef.current) {
      meshRef.current.position.addScaledVector(vel, dt);
      meshRef.current.rotation.x += angVel.x * dt;
      meshRef.current.rotation.y += angVel.y * dt;
      meshRef.current.rotation.z += angVel.z * dt;
      if (matRef.current) matRef.current.opacity = Math.max(0, matRef.current.opacity - dt * 1.8);
      return;
    }

    if (!matRef.current) return;

    // ② Opening flicker sequence: 3 s exponentially accelerating
    if (!stable.current) {
      elapsed.current += dt;
      const progress  = Math.min(elapsed.current / 3.0, 1.0);
      ftimer.current += dt;
      // interval shrinks: 0.45 s → 0.018 s
      const interval = 0.45 * Math.pow(0.04, progress);

      if (ftimer.current >= interval) {
        ftimer.current = 0;
        if (progress < 1.0) {
          // Toggle visible / invisible to simulate neon striking
          matRef.current.emissiveIntensity =
            matRef.current.emissiveIntensity > 0.2 ? 0.02 : 0.6 + Math.random() * 0.8;
        } else {
          // Fully ON — switch to idle flicker mode
          stable.current = true;
          matRef.current.emissiveIntensity = 1.0;
        }
      }
      return;
    }

    // ③ Idle flicker: subtle random noise like a real neon tube
    ftimer.current += dt;
    // Fire at random intervals roughly every 40–120 ms
    if (ftimer.current > 0.04 + Math.random() * 0.08) {
      ftimer.current = 0;
      const r = Math.random();
      if (r < 0.03) {
        // Rare full blackout — broken tube moment
        matRef.current.emissiveIntensity = 0.0;
      } else if (r < 0.12) {
        // Brief dim flicker
        matRef.current.emissiveIntensity = 0.25 + Math.random() * 0.35;
      } else {
        // Normal bright with slight noise
        matRef.current.emissiveIntensity = 0.8 + Math.random() * 0.6;
      }
    }
  });

  return (
    <group position={[offsetX, 0, 0]}>
      <Text3D
        ref={meshRef as any}
        font={FONT}
        size={size}
        height={height}
        curveSegments={32}
        bevelEnabled
        bevelThickness={0.05}
        bevelSize={0.035}
        bevelOffset={0}
        bevelSegments={12}
        castShadow
      >
        {char}
        <MeshTransmissionMaterial
          ref={matRef as any}
          background={new THREE.Color("#060606")}
          transmission={0.78}
          roughness={0.06}
          thickness={0.45}
          chromaticAberration={0.1}
          ior={1.75}
          clearcoat={1.0}
          clearcoatRoughness={0.02}
          emissive={neonColor}
          emissiveIntensity={0.02}   // starts dark; useFrame ramps it up
          transparent
          opacity={1}
          envMapIntensity={0.3}
        />
      </Text3D>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NeonSubtitle: single-mesh subtitle with its own idle flicker
// ─────────────────────────────────────────────────────────────────────────────
function NeonSubtitle({ phase }: { phase: "idle" | "exploding" }) {
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const ftimer = useRef(0);
  const stable = useRef(false);
  const elapsed = useRef(0);

  useFrame((_s, dt) => {
    if (!matRef.current) return;
    if (phase === "exploding") {
      matRef.current.opacity = Math.max(0, matRef.current.opacity - dt * 3);
      return;
    }

    if (!stable.current) {
      elapsed.current += dt;
      const progress = Math.min(elapsed.current / 3.0, 1.0);
      ftimer.current += dt;
      const interval = 0.5 * Math.pow(0.04, progress);
      if (ftimer.current >= interval) {
        ftimer.current = 0;
        if (progress < 1.0) {
          matRef.current.emissiveIntensity =
            matRef.current.emissiveIntensity > 0.2 ? 0.02 : 0.5 + Math.random() * 0.7;
        } else {
          stable.current = true;
          matRef.current.emissiveIntensity = 0.9;
        }
      }
      return;
    }

    ftimer.current += dt;
    if (ftimer.current > 0.05 + Math.random() * 0.1) {
      ftimer.current = 0;
      const r = Math.random();
      if (r < 0.03) matRef.current.emissiveIntensity = 0.0;
      else if (r < 0.1) matRef.current.emissiveIntensity = 0.2 + Math.random() * 0.3;
      else matRef.current.emissiveIntensity = 0.7 + Math.random() * 0.5;
    }
  });

  return (
    <Center position={[0, -2.2, 0]}>
      <Text3D
        font={FONT}
        size={0.52}
        height={0.16}
        curveSegments={24}
        bevelEnabled
        bevelThickness={0.02}
        bevelSize={0.012}
        bevelSegments={8}
      >
        made by daeeon
        <MeshTransmissionMaterial
          ref={matRef as any}
          background={new THREE.Color("#060606")}
          transmission={0.72}
          roughness={0.08}
          thickness={0.3}
          chromaticAberration={0.07}
          ior={1.65}
          clearcoat={1}
          clearcoatRoughness={0.03}
          emissive="#00d4ff"
          emissiveIntensity={0.02}
          transparent
          opacity={1}
          envMapIntensity={0.3}
        />
      </Text3D>
    </Center>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HintText: "CLICK TO ENTER" — purely 3D, no HTML
// ─────────────────────────────────────────────────────────────────────────────
function HintText({ phase }: { phase: "idle" | "exploding" }) {
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);
  const opTimer = useRef(0);

  useFrame((_s, dt) => {
    if (!matRef.current) return;
    opTimer.current += dt;
    // Pulse opacity slowly
    matRef.current.opacity = 0.2 + Math.abs(Math.sin(opTimer.current * 0.9)) * 0.25;
    if (phase === "exploding") matRef.current.opacity = 0;
  });

  return (
    <Center position={[0, -3.8, 0]}>
      <Text3D
        font={FONT}
        size={0.22}
        height={0.04}
        curveSegments={12}
      >
        CLICK TO ENTER
        <meshStandardMaterial
          ref={matRef as any}
          color="#ffffff"
          transparent
          opacity={0.2}
        />
      </Text3D>
    </Center>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scene: lights + all objects + mouse tilt
// ─────────────────────────────────────────────────────────────────────────────
function Scene({
  phase,
  onExplode,
}: {
  phase: "idle" | "exploding";
  onExplode: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  const WELCOME  = "WELCOME".split("");
  const SPACING  = 2.35;
  const halfSpan = ((WELCOME.length - 1) / 2) * SPACING;

  // ── Smooth mouse-driven tilt of the entire scene group
  useFrame(() => {
    if (!groupRef.current || phase === "exploding") return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      mouse.x * 0.28,
      0.04
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -mouse.y * 0.14,
      0.04
    );
  });

  return (
    <>
      {/* ── Background */}
      <color attach="background" args={["#060606"]} />

      {/* ── Lighting: side + low-angle spotlights ONLY (no top-down) */}

      {/* Pink spot — bottom-left, raking the geometry */}
      <spotLight
        position={[-10, -3, 8]}
        target-position={[0, 0, 0]}
        angle={0.4}
        penumbra={0.85}
        intensity={180}
        color="#ff2a85"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Cyan spot — bottom-right */}
      <spotLight
        position={[10, -3, 8]}
        target-position={[0, 0, 0]}
        angle={0.4}
        penumbra={0.85}
        intensity={150}
        color="#00d4ff"
        castShadow
      />
      {/* Very dim back rim — gives depth to bevel edges */}
      <pointLight position={[0, 4, -5]} intensity={25} color="#ffffff" />
      {/* Barely-visible fill to avoid total blackness in shadows */}
      <ambientLight intensity={0.04} />

      {/* ── Shadow catcher */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>

      {/* ── Sparkles (white dust + pink neon + cyan neon) */}
      <Sparkles count={80} size={4}   speed={0.45} opacity={0.9}  scale={[28, 10, 8]} color="#ffffff" />
      <Sparkles count={35} size={3.5} speed={0.3}  opacity={0.85} scale={[22,  7, 5]} color="#ff2a85" position={[0, 1.5, 0]} />
      <Sparkles count={25} size={3}   speed={0.3}  opacity={0.8}  scale={[18,  5, 4]} color="#00d4ff" position={[0, -2, 0]} />

      {/* ── Interactive group (tilt driven by mouse) */}
      <group ref={groupRef}>
        {/* WELCOME — per-letter for individual explosion */}
        <group position={[0, 1.6, 0]}>
          {WELCOME.map((ch, i) => (
            <NeonLetter
              key={i}
              char={ch}
              offsetX={(i - (WELCOME.length - 1) / 2) * SPACING}
              neonColor="#ff2a85"
              phase={phase}
              size={1.6}
              height={0.45}
            />
          ))}
        </group>

        {/* Subtitle */}
        <NeonSubtitle phase={phase} />

        {/* Hint */}
        <HintText phase={phase} />
      </group>

      {/* ── Invisible click-catcher plane (covers entire viewport) */}
      {phase === "idle" && (
        <mesh
          position={[0, 0, 2]}
          onClick={onExplode}
          onPointerOver={() => { document.body.style.cursor = "pointer"; }}
          onPointerOut={() =>  { document.body.style.cursor = "default"; }}
        >
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ThreeDCanvas — public component, drop into page.tsx
// ─────────────────────────────────────────────────────────────────────────────
export default function ThreeDCanvas({ onExplore }: { onExplore: () => void }) {
  const [phase,   setPhase]   = useState<"idle" | "exploding">("idle");
  const [fadeOut, setFadeOut] = useState(false);

  const handleExplode = () => {
    setPhase("exploding");
    // Start fade-to-black after letters have had time to scatter
    setTimeout(() => setFadeOut(true),  700);
    // Hand off to parent after fade completes
    setTimeout(() => onExplore(),       1350);
  };

  return (
    // Full-screen fixed layer — sits above the main app until onExplore is called
    <div className="fixed inset-0 z-[100]" style={{ background: "#060606" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
      >
        {/* Orthographic camera — flat front view like a product/art shot */}
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={60} near={0.1} far={100} />

        <Scene phase={phase} onExplode={handleExplode} />
      </Canvas>

      {/* ── Cinematic black-out overlay (framer-motion is fine for a 2D div overlay) */}
      <AnimatePresence>
        {fadeOut && (
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ zIndex: 200 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
