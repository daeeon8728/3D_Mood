"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useAnimation, type Transition, type Variants } from "framer-motion";

// ─── Spark particle ───────────────────────────────────────────────────────────
const generateSparks = (count: number) =>
  Array.from({ length: count }).map((_, i) => ({
    id: i,
    xOffset: (Math.random() - 0.5) * 50,
    yDrop: 80 + Math.random() * 140,
    delay: Math.random() * 1.5,
    duration: 0.5 + Math.random() * 0.7,
    size: Math.random() * 3 + 1.5,
  }));

function Spark({ xOffset, yDrop, delay, duration, size }: any) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: "#fff",
        boxShadow: "0 0 6px 2px #FF4500",
        mixBlendMode: "screen",
        // Spawn at the tail of the 'e' in "Welcome"
        left: "calc(50% + 228px)",
        top:  "calc(50% - 18px)",
        zIndex: 3,
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x: [0, xOffset * 0.4, xOffset],
        y: [0, yDrop * 0.3, yDrop],
        opacity: [0, 1, 0],
        scale:   [0, 1.2, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 2 + 0.5,
        ease: "easeIn",
      }}
    />
  );
}

// ─── SVG Wire Layer (z:1, behind text) ───────────────────────────────────────
function WireLayer() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Subtle highlight on top edge of tube to fake 3D roundness */}
        <linearGradient id="wire-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#888" stopOpacity="1" />
          <stop offset="40%"  stopColor="#333" stopOpacity="1" />
          <stop offset="100%" stopColor="#111" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* === Wire 1: from 'W' left-edge → upper-left ceiling === */}
      {/* Shadow / thickness pass */}
      <path
        d="M 500 420  Q 380 300  280 80"
        stroke="#111" strokeWidth="8" fill="none" strokeLinecap="round"
      />
      {/* Main tube */}
      <path
        d="M 500 420  Q 380 300  280 80"
        stroke="url(#wire-grad-1)" strokeWidth="5" fill="none" strokeLinecap="round"
      />
      {/* Top highlight shine */}
      <path
        d="M 500 420  Q 380 300  280 80"
        stroke="#aaaaaa" strokeWidth="1.2" fill="none" strokeLinecap="round"
        strokeDasharray="4 8" opacity="0.5"
      />

      {/* === Wire 2: from 'e' right-edge → lower-right floor === */}
      <path
        d="M 940 470  Q 1060 620  1180 900"
        stroke="#111" strokeWidth="8" fill="none" strokeLinecap="round"
      />
      <path
        d="M 940 470  Q 1060 620  1180 900"
        stroke="url(#wire-grad-1)" strokeWidth="5" fill="none" strokeLinecap="round"
      />
      <path
        d="M 940 470  Q 1060 620  1180 900"
        stroke="#aaaaaa" strokeWidth="1.2" fill="none" strokeLinecap="round"
        strokeDasharray="4 8" opacity="0.5"
      />

      {/* === Metal Clips at connection points === */}
      {/* Clip at W (500, 420) */}
      <g transform="translate(500, 420) rotate(-20)">
        <rect x="-7" y="-10" width="14" height="20" rx="3" fill="#c0c0c0" stroke="#555" strokeWidth="1" />
        <rect x="-4" y="-4"  width="8"  height="8"  rx="1" fill="#444"    stroke="#333" strokeWidth="0.5" />
        <circle cx="0" cy="-6" r="1.5" fill="#888" />
        <circle cx="0" cy=" 6" r="1.5" fill="#888" />
      </g>
      {/* Clip at e (940, 470) */}
      <g transform="translate(940, 470) rotate(18)">
        <rect x="-7" y="-10" width="14" height="20" rx="3" fill="#c0c0c0" stroke="#555" strokeWidth="1" />
        <rect x="-4" y="-4"  width="8"  height="8"  rx="1" fill="#444"    stroke="#333" strokeWidth="0.5" />
        <circle cx="0" cy="-6" r="1.5" fill="#888" />
        <circle cx="0" cy=" 6" r="1.5" fill="#888" />
      </g>
    </svg>
  );
}

// ─── Mechanical Lever ─────────────────────────────────────────────────────────
const SLOT_H   = 200; // total slot travel in px
const SNAP_AT  = SLOT_H * 0.8; // 80% threshold

interface LeverProps {
  onSnap: () => void;
}

function MechanicalLever({ onSnap }: LeverProps) {
  const leverY      = useMotionValue(0);
  const [snapped, setSnapped] = useState(false);
  const controls    = useAnimation();
  const hasFired    = useRef(false);

  const handleDragEnd = useCallback(async () => {
    if (hasFired.current) return;
    const y = leverY.get();
    if (y >= SNAP_AT) {
      hasFired.current = true;
      setSnapped(true);
      // Spring-snap to bottom
      controls.start({
        y: SLOT_H,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      });
      onSnap();
    } else {
      // Bounce back to top
      controls.start({
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
      });
    }
  }, [leverY, controls, onSnap]);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: 60, height: SLOT_H + 60 }}
    >
      {/* Labels */}
      <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase mb-1">OFF</span>

      {/* Slot groove */}
      <div
        className="relative flex justify-center"
        style={{
          width: 16,
          height: SLOT_H,
          background: "linear-gradient(90deg, #1a1a1a 0%, #2d2d2d 30%, #1a1a1a 100%)",
          borderRadius: 8,
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.9), inset 0 0 0 1px #444",
        }}
      >
        {/* Inner slot rail */}
        <div
          className="absolute top-2 bottom-2 w-[3px] rounded-full"
          style={{ background: "linear-gradient(180deg, #555 0%, #222 100%)" }}
        />

        {/* Lever handle */}
        <motion.div
          drag={snapped ? false : "y"}
          dragConstraints={{ top: 0, bottom: SLOT_H }}
          dragElastic={0.05}
          dragMomentum={false}
          style={{ y: leverY, x: 0, position: "absolute", top: 0, zIndex: 10, touchAction: "none" }}
          animate={controls}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.05 }}
        >
          {/* Handle body */}
          <div
            className="relative cursor-grab active:cursor-grabbing select-none"
            style={{
              width: 40,
              height: 40,
              marginLeft: -12,
              borderRadius: 8,
              background: snapped
                ? "linear-gradient(135deg, #d4af37 0%, #8B6914 60%, #c9a227 100%)"
                : "linear-gradient(135deg, #d0d0d0 0%, #808080 60%, #b0b0b0 100%)",
              boxShadow: snapped
                ? "0 4px 16px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4)"
                : "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
              border: "1px solid #555",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Grip ridges */}
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 6, right: 6,
                  top: 8 + i * 9,
                  height: 2,
                  borderRadius: 1,
                  background: "rgba(0,0,0,0.25)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase mt-1">ON</span>

      {/* Indicator LED */}
      <motion.div
        className="mt-3 rounded-full"
        style={{ width: 8, height: 8 }}
        animate={snapped
          ? { backgroundColor: ["#00ff88", "#00cc66", "#00ff88"], boxShadow: ["0 0 6px #00ff88", "0 0 12px #00ff88", "0 0 6px #00ff88"] }
          : { backgroundColor: "#1a1a1a", boxShadow: "none" }
        }
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NeonSign({ onExplore }: { onExplore?: () => void }) {
  const containerRef            = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isPowered, setIsPowered]   = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isShaking, setIsShaking]    = useState(false);
  const sparks = useMemo(() => generateSparks(18), []);

  // Mouse-follow flashlight
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - left) / width) * 100,
      y: ((e.clientY - top)  / height) * 100,
    });
  };

  // Lever snap event
  const handleSnap = useCallback(() => {
    // Screen shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);

    // Power on neon after 50ms (snap feel first)
    setTimeout(() => setIsPowered(true), 50);
  }, []);

  // Click to exit after powered
  const handleClick = () => {
    if (!isPowered || isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => onExplore?.(), 1100);
  };

  // Pre-calculate flicker keyframes (irregular "ziiing")
  const { opacities, times } = useMemo(() => {
    // 20 steps over 0.8s for rapid flicker, then stable
    const flickerSteps = 20;
    const op: number[] = [];
    const tm: number[] = [];
    for (let i = 0; i <= flickerSteps; i++) {
      const p = i / flickerSteps;
      tm.push(p);
      if (i < flickerSteps * 0.7) {
        op.push(Math.random() > 0.45 ? 1 : 0.04);
      } else {
        op.push(1);
      }
    }
    op[op.length - 1] = 1;
    return { opacities: op, times: tm };
  }, []);

  // Neon text shadow with 3D depth illusion
  const stableGlow = `
    0 0 5px #fff,
    0 0 10px #fff,
    0 0 20px #ff00de,
    0 0 40px #ff00de,
    0 0 80px #ff00de,
    2px 2px 0px rgba(0,0,0,0.5)
  `;

  const flickerShadow = opacities.map(o => {
    if (o < 1) {
      const jx = (Math.random() - 0.5) * 10;
      const jy = (Math.random() - 0.5) * 10;
      return `${jx}px ${jy}px 8px rgba(255,0,222,0.6), 2px 2px 0px rgba(0,0,0,0.5)`;
    }
    return stableGlow;
  });

  const exitTransition: Transition = { duration: 1.0, ease: "easeOut" as const };
  const exitVariant: Variants = {
    exit: {
      opacity: 0,
      scale: 1.04,
      filter: "blur(18px)",
      transition: exitTransition,
    },
  };

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          exit="exit"
          variants={exitVariant}
          // Screen shake when lever snaps
          animate={isShaking ? {
            x: [0, -4, 4, -3, 3, -1, 1, 0],
            y: [0, -2, 2, -1, 1, 0],
            transition: { duration: 0.3, ease: "linear" },
          } : {}}
          className="fixed inset-0 z-[100] overflow-hidden bg-[#050505]"
          style={{ cursor: isPowered ? "pointer" : "default" }}
          onClick={handleClick}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');
          ` }} />

          {/* ── Layer 0: Concrete Texture ──────────────────────────── */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              backgroundColor: isPowered ? "rgba(40,15,28,0.45)" : "rgba(8,8,8,0.92)",
              filter: isPowered ? "contrast(120%) brightness(85%)" : "contrast(115%) brightness(78%)",
            }}
            transition={{ duration: 0.6 }}
            style={{
              backgroundImage: "url('/콘크리트_텍스처.jpg')",
              backgroundBlendMode: "overlay",
              backgroundSize: "cover",
              backgroundPosition: "center",
              zIndex: 0,
            }}
          />

          {/* Mouse flashlight overlay */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: `radial-gradient(circle 280px at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.07), transparent)`,
              zIndex: 0,
            }}
          />

          {/* ── Layer 0.5: Wall Bloom (synchronized with power) ─────── */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] pointer-events-none blur-[90px]"
            animate={{
              opacity: isPowered ? 1 : 0,
              scale:   isPowered ? 1  : 0.6,
            }}
            transition={{ duration: 0.5 }}
            style={{
              background: "radial-gradient(ellipse at center, rgba(255,0,222,0.28) 0%, rgba(0,200,255,0.08) 55%, transparent 72%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />
          {/* Floor light spill */}
          <motion.div
            className="absolute left-1/2 pointer-events-none blur-[70px] w-[1100px] h-[280px]"
            style={{ top: "60%", transform: "translateX(-50%)", zIndex: 0, mixBlendMode: "screen" }}
            animate={{ opacity: isPowered ? 0.7 : 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div
              className="w-full h-full"
              style={{
                background: "radial-gradient(ellipse at top, rgba(255,0,222,0.14) 0%, transparent 70%)",
              }}
            />
          </motion.div>

          {/* ── Layer 1: SVG Wire (z:1, behind text) ─────────────────── */}
          <WireLayer />

          {/* ── Layer 2: Neon Text (z:2) ──────────────────────────────── */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 2 }}
          >
            {/* White Core — always rendered, opacity driven by power */}
            <motion.h1
              className="font-normal select-none"
              style={{
                fontFamily: "'Pinyon Script', cursive",
                fontSize: "clamp(5rem, 11vw, 11rem)",
                lineHeight: 1.2,
                transform: "rotate(-4deg)",
                color: "#fff",
              }}
              animate={isPowered ? {
                opacity: opacities,
                textShadow: flickerShadow,
              } : {
                opacity: 0,
                textShadow: "none",
              }}
              transition={isPowered ? {
                duration: 0.8,
                times,
                ease: "linear",
              } : { duration: 0.1 }}
            >
              Welcome
            </motion.h1>
          </div>

          {/* ── Layer 3: Spark Particles (z:3) ───────────────────────── */}
          <AnimatePresence>
            {isPowered && (
              <motion.div
                key="sparks"
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 3 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5 }}
              >
                {sparks.map(s => <Spark key={s.id} {...s} />)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Mechanical Lever (top-right, on-screen) ──────────────── */}
          <div
            className="absolute right-16 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
            style={{ zIndex: 10 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel housing */}
            <div
              className="p-4 rounded-2xl flex flex-col items-center gap-1"
              style={{
                background: "linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 100%)",
                border: "1px solid #444",
                boxShadow: "0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Panel label */}
              <p className="text-[8px] font-bold tracking-[0.3em] text-zinc-600 uppercase mb-2">
                POWER
              </p>
              <MechanicalLever onSnap={handleSnap} />
            </div>
          </div>

          {/* ── Pre-power hint ────────────────────────────────────────── */}
          <AnimatePresence>
            {!isPowered && (
              <motion.p
                key="hint"
                className="absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-600 text-[10px] uppercase tracking-[0.4em] font-light z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
              >
                Pull the lever to power on
              </motion.p>
            )}
          </AnimatePresence>

          {/* ── Post-power hint ───────────────────────────────────────── */}
          <AnimatePresence>
            {isPowered && (
              <motion.p
                key="enter-hint"
                className="absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px] uppercase tracking-[0.4em] font-light z-10 mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
              >
                Click anywhere to enter
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
