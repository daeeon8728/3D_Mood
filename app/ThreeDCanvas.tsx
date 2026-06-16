/* eslint-disable */
"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  ThreeDCanvas.tsx
//  Fully independent 3D intro layer.
//  No 2D HTML elements. Everything is a Three.js mesh / material / primitive.
//  Sequence: flicker → idle (mouse tilt + sparkles) → explosion → fade out
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Text3D,
  Center,
  MeshTransmissionMaterial,
  Sparkles,
  PresentationControls,
} from "@react-three/drei";

const FONT_URL =
  "https://threejs.org/examples/fonts/helvetiker_bold.typeface.json";

// ─── Per-letter physics atom ──────────────────────────────────────────────────
function CinematicLetter({
  char,
  index,
  totalLetters,
  phase,
  flickerOn,
}: {
  char: string;
  index: number;
  totalLetters: number;
  phase: "idle" | "exploding";
  flickerOn: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Stable random physics vectors per letter
  const vel = useMemo(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 38,
        (Math.random() + 0.25) * 28,   // bias upward so letters burst outward
        (Math.random() - 0.5) * 42
      ),
    []
  );
  const rotSpd = useMemo(
    () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
    []
  );

  useFrame((_s, dt) => {
    if (phase === "exploding" && meshRef.current) {
      meshRef.current.position.addScaledVector(vel, dt);
      meshRef.current.rotation.x += rotSpd.x * dt;
      meshRef.current.rotation.y += rotSpd.y * dt;
      meshRef.current.rotation.z += rotSpd.z * dt;
    }
  });

  const offsetX = (index - (totalLetters - 1) / 2) * 2.55;

  return (
    <group position={[offsetX, 0, 0]} visible={flickerOn}>
      <Text3D
        ref={meshRef as any}
        font={FONT_URL}
        size={2.0}
        height={0.9}
        curveSegments={32}
        bevelEnabled
        bevelThickness={0.08}
        bevelSize={0.05}
        bevelOffset={0}
        bevelSegments={14}
        castShadow
        receiveShadow
      >
        {char}
        {/* Frosted glass — physically-based refraction */}
        <MeshTransmissionMaterial
          background={new THREE.Color("#000000")}
          transmission={0.85}
          roughness={0.15}
          thickness={0.55}
          chromaticAberration={0.07}
          ior={1.65}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          envMapIntensity={1.8}
        />
      </Text3D>
    </group>
  );
}

// ─── Explore button — pure 3-D mesh ─────────────────────────────────────────
function ExploreBtn({
  onExploreClick,
}: {
  onExploreClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const target = -4.6 + Math.sin(Date.now() * 0.0018) * 0.2;
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        target,
        0.06
      );
      const ts = hovered ? 1.1 : 1.0;
      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, ts, 0.1)
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, -4.6, 0]}>
      {/* Capsule body */}
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={() => {
          document.body.style.cursor = "default";
          onExploreClick();
        }}
      >
        <capsuleGeometry args={[0.62, 3.5, 16, 32]} />
        <MeshTransmissionMaterial
          transmission={0.9}
          roughness={0.1}
          thickness={0.35}
          clearcoat={1}
          chromaticAberration={0.04}
        />
      </mesh>

      {/* Wireframe glow rim */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.645, 3.52, 16, 32]} />
        <meshBasicMaterial
          color={hovered ? "#ff2a85" : "#4a90e2"}
          wireframe
          transparent
          opacity={hovered ? 0.6 : 0.2}
        />
      </mesh>

      {/* EXPLORE label — 3D text, NOT HTML */}
      <group position={[0, 0, 0.65]}>
        <Center>
          <Text3D font={FONT_URL} size={0.3} height={0.07} curveSegments={24}>
            EXPLORE
            <meshStandardMaterial
              color={hovered ? "#ffffff" : "#cccccc"}
              emissive={hovered ? "#ff2a85" : "#4a90e2"}
              emissiveIntensity={hovered ? 2.0 : 1.0}
            />
          </Text3D>
        </Center>
      </group>
    </group>
  );
}

// ─── Full scene (runs inside <Canvas>) ───────────────────────────────────────
function Scene({
  phase,
  flickerOn,
  showExplore,
  onExploreClick,
}: {
  phase: "idle" | "exploding";
  flickerOn: boolean;
  showExplore: boolean;
  onExploreClick: () => void;
}) {
  const letters = "WELCOME".split("");
  const scaleRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (scaleRef.current && phase === "idle") {
      const t = hovered ? 1.06 : 1.0;
      scaleRef.current.scale.setScalar(
        THREE.MathUtils.lerp(scaleRef.current.scale.x, t, 0.08)
      );
    }
  });

  return (
    <>
      {/* ── Background */}
      <color attach="background" args={["#000000"]} />

      {/* ── Environment map (city reflections on glass) */}
      <Environment preset="city" />

      {/* ── Lighting: SIDE & LOW-ANGLE ONLY — no top-down lights */}
      {/* Left flank — warm magenta */}
      <pointLight position={[-15, 1, 5]} intensity={700} color="#ff2a85" />
      {/* Right flank — electric blue */}
      <pointLight position={[15, 1, 5]}  intensity={600} color="#4a90e2" />
      {/* Front-left key at ≈15° above horizontal */}
      <directionalLight
        position={[-12, 3, 9]}
        intensity={2.2}
        color="#e8eeff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {/* Subtle ground bounce */}
      <pointLight position={[0, -7, 3]} intensity={250} color="#4a90e2" />

      {/* ── Shadow-catcher floor (invisible plane that only receives shadows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <shadowMaterial transparent opacity={0.5} />
      </mesh>

      {/* ── Sparkle particles */}
      <Sparkles
        count={80}
        size={3.8}
        speed={0.38}
        opacity={0.95}
        scale={20}
        color="#ffffff"
      />

      {/* ── WELCOME letters inside PresentationControls for mouse tilt */}
      <PresentationControls
        global
        polar={[-0.13, 0.13]}
        azimuth={[-0.28, 0.28]}
        snap
      >
        <group
          ref={scaleRef}
          position={[0, 1.3, 0]}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {letters.map((ch, i) => (
            <CinematicLetter
              key={i}
              char={ch}
              index={i}
              totalLetters={letters.length}
              phase={phase}
              flickerOn={flickerOn}
            />
          ))}
        </group>
      </PresentationControls>

      {/* ── Explore button — visible only after flicker ends, not during explosion */}
      {showExplore && phase === "idle" && (
        <ExploreBtn onExploreClick={onExploreClick} />
      )}
    </>
  );
}

// ─── Public component — drop this into page.tsx ──────────────────────────────
export default function ThreeDCanvas({
  onExplore,
}: {
  onExplore: () => void;
}) {
  const [flickerOn, setFlickerOn]     = useState(false);
  const [phase, setPhase]             = useState<"idle" | "exploding">("idle");
  const [showExplore, setShowExplore] = useState(false);
  const [fadeOut, setFadeOut]         = useState(false);

  // ── 1. Exponential flicker: 3 s, accelerating toggle, then stays ON
  useEffect(() => {
    let id: NodeJS.Timeout;
    const start    = Date.now();
    const DURATION = 3000;

    const tick = () => {
      const elapsed  = Date.now() - start;
      if (elapsed >= DURATION) {
        setFlickerOn(true);
        setShowExplore(true);
        return;
      }
      const progress = elapsed / DURATION;
      // interval: 450 ms → 22 ms (quadratic ease)
      const interval = THREE.MathUtils.lerp(450, 22, progress * progress);
      setFlickerOn((p) => !p);
      id = setTimeout(tick, interval);
    };

    id = setTimeout(tick, 450);
    return () => clearTimeout(id);
  }, []);

  // ── 2. Explosion sequence
  const handleExploreClick = () => {
    setPhase("exploding");
    setTimeout(() => setFadeOut(true), 850);
    setTimeout(() => onExplore(),     1450);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      style={{ background: "#000" }}
      exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <Canvas camera={{ position: [0, 0, 20], fov: 44 }} dpr={[1, 2]} shadows>
        <Scene
          phase={phase}
          flickerOn={flickerOn}
          showExplore={showExplore}
          onExploreClick={handleExploreClick}
        />
      </Canvas>

      {/* ── Cinematic black-out overlay */}
      <AnimatePresence>
        {fadeOut && (
          <motion.div
            className="absolute inset-0 bg-black z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
