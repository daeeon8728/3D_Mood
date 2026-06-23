"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useAnimation, type Transition, type Variants } from "framer-motion";

// ─── Audio Synthesis (Web Audio API) ──────────────────────────────────────────
let audioCtx: AudioContext | null = null;
const initAudio = () => {
  if (typeof window !== "undefined" && !audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

const playSnapSound = () => {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  
  // High click
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(1200, t);
  osc1.frequency.exponentialRampToValueAtTime(100, t + 0.05);
  gain1.gain.setValueAtTime(1, t);
  gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(t);
  osc1.stop(t + 0.1);

  // Low thud
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(150, t);
  osc2.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  gain2.gain.setValueAtTime(1, t);
  gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t);
  osc2.stop(t + 0.15);
};

const startBuzzSound = () => {
  if (!audioCtx) return null;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, t);
  
  // 120Hz hum harmonic
  const lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 120;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 20;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start(t);

  filter.type = "lowpass";
  filter.frequency.value = 800;

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.03, t + 0.1); // subtle buzz volume

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);

  return {
    stop: () => {
      const stopT = audioCtx!.currentTime;
      gain.gain.linearRampToValueAtTime(0, stopT + 0.1);
      osc.stop(stopT + 0.1);
      lfo.stop(stopT + 0.1);
    }
  };
};

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
      transition={{ duration, delay, repeat: Infinity, repeatDelay: Math.random() * 2 + 0.5, ease: "easeIn" }}
    />
  );
}

// ─── Mechanical Lever ─────────────────────────────────────────────────────────
const SLOT_H      = 133;
const HANDLE_SIZE = 27;
const MAX_TRAVEL  = SLOT_H - HANDLE_SIZE;
const SNAP_AT     = MAX_TRAVEL * 0.8;

interface LeverProps {
  onSnap: () => void;
}

function MechanicalLever({ onSnap }: LeverProps) {
  const leverY      = useMotionValue(0);
  const [snapped, setSnapped] = useState(false);
  const controls    = useAnimation();
  const hasFired    = useRef(false);

  const handleDragEnd = useCallback(async () => {
    initAudio();
    if (hasFired.current) return;
    const y = leverY.get();
    if (y >= SNAP_AT) {
      hasFired.current = true;
      setSnapped(true);
      playSnapSound();
      controls.start({
        y: MAX_TRAVEL,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      });
      onSnap();
    } else {
      controls.start({
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
      });
    }
  }, [leverY, controls, onSnap]);

  return (
    <div className="relative flex flex-col items-center" style={{ width: 40, height: SLOT_H + 40 }}>
      <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase mb-1">OFF</span>
      <div
        className="relative flex justify-center"
        style={{
          width: 11,
          height: SLOT_H,
          background: "linear-gradient(90deg, #1a1a1a 0%, #2d2d2d 30%, #1a1a1a 100%)",
          borderRadius: 6,
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.9), inset 0 0 0 1px #444",
        }}
      >
        <div
          className="absolute top-2 bottom-2 rounded-full"
          style={{ width: 2, background: "linear-gradient(180deg, #555 0%, #222 100%)" }}
        />
        <motion.div
          drag={snapped ? false : "y"}
          dragConstraints={{ top: 0, bottom: MAX_TRAVEL }}
          dragElastic={0.05}
          dragMomentum={false}
          style={{ y: leverY, x: 0, position: "absolute", top: 0, left: "50%", translateX: "-50%", zIndex: 10, touchAction: "none", transform: "translateX(-50%)" }}
          animate={controls}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.05 }}
        >
          <div
            className="relative cursor-grab active:cursor-grabbing select-none"
            style={{
              width: 27, height: 27, borderRadius: 6,
              background: snapped
                ? "linear-gradient(135deg, #d4af37 0%, #8B6914 60%, #c9a227 100%)"
                : "linear-gradient(135deg, #d0d0d0 0%, #808080 60%, #b0b0b0 100%)",
              boxShadow: snapped
                ? "0 4px 16px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4)"
                : "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
              border: "1px solid #555",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {[0, 1].map(i => (
              <div key={i} style={{
                position: "absolute", left: 4, right: 4, top: 6 + i * 8, height: 1.5,
                borderRadius: 1, background: "rgba(0,0,0,0.25)", boxShadow: "0 1px 0 rgba(255,255,255,0.15)",
              }} />
            ))}
          </div>
        </motion.div>
      </div>
      <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase mt-1">ON</span>
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
export default function NeonSign({ onExplore }: { onExplore?: (remember: boolean) => void }) {
  const containerRef            = useRef<HTMLDivElement>(null);
  
  const [mousePos, setMousePos]       = useState({ x: 50, y: 50 });
  const [isPowered, setIsPowered]     = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isShaking, setIsShaking]     = useState(false);
  
  const sparks = useMemo(() => generateSparks(18), []);
  const buzzAudio = useRef<{stop: ()=>void} | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (buzzAudio.current) buzzAudio.current.stop();
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Flashlight logic
    if (containerRef.current) {
      const { left, top, width, height } = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - left) / width) * 100,
        y: ((e.clientY - top)  / height) * 100,
      });
    }
  }, []);

  // Lever snap event
  const handleSnap = useCallback(() => {
    // Screen shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);

    // Power on neon after 300ms
    setTimeout(() => {
      setIsPowered(true);
      buzzAudio.current = startBuzzSound();
    }, 300);
  }, []);

  // Click to exit after powered
  const handleClick = () => {
    if (!isPowered || isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => onExplore?.(true), 1100); // remember = true (clicked through naturally)
  };

  // Skip for next time
  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => onExplore?.(true), 700); // quicker fade for skip
  };

  // Pre-calculate flicker keyframes
  const { opacities, times } = useMemo(() => {
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
    exit: { opacity: 0, scale: 1.04, filter: "blur(18px)", transition: exitTransition },
  };

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          exit="exit"
          variants={exitVariant}
          animate={isShaking ? {
            x: [0, -4, 4, -3, 3, -1, 1, 0],
            y: [0, -2, 2, -1, 1, 0],
            transition: { duration: 0.3, ease: "linear" },
          } : {}}
          className="fixed inset-0 z-[100] overflow-hidden bg-[#050505]"
          style={{ 
            cursor: isPowered ? "pointer" : "default",
          }}
          onClick={handleClick}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
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

          {/* ── Layer 1.5: Wall Bloom ─────── */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] pointer-events-none blur-[90px]"
            animate={{ opacity: isPowered ? 1 : 0, scale: isPowered ? 1 : 0.6 }}
            transition={{ duration: 0.5 }}
            style={{ background: "radial-gradient(ellipse at center, rgba(255,0,222,0.28) 0%, rgba(0,200,255,0.08) 55%, transparent 72%)", zIndex: 1, mixBlendMode: "screen" }}
          />

          {/* ── Layer 2: Neon Text (z:2) ──────────────────────────────── */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
            <motion.h1
              className="font-normal select-none"
              style={{ fontFamily: "'Pinyon Script', cursive", fontSize: "clamp(5rem, 11vw, 11rem)", lineHeight: 1.2, transform: "rotate(-4deg)", color: "#fff", marginBottom: "0.25rem" }}
              animate={isPowered ? { opacity: opacities, textShadow: flickerShadow } : { opacity: 0, textShadow: "none" }}
              transition={isPowered ? { duration: 0.8, times, ease: "linear" } : { duration: 0.1 }}
            >
              Welcome
            </motion.h1>

            <motion.p
              className="font-bold select-none"
              style={{ fontFamily: "'Dancing Script', cursive", fontSize: "clamp(1.4rem, 3vw, 2.5rem)", color: "#fff", transform: "rotate(-4deg) translateX(30px)" }}
              animate={isPowered ? {
                opacity: opacities,
                textShadow: opacities.map(o => o >= 1
                  ? `0 0 5px #fff, 0 0 10px #fff, 0 0 20px #00d4ff, 0 0 40px #00d4ff, 0 0 80px #00d4ff, 2px 2px 0px rgba(0,0,0,0.5)`
                  : `${(Math.random()-0.5)*8}px ${(Math.random()-0.5)*8}px 6px rgba(0,212,255,0.5), 2px 2px 0px rgba(0,0,0,0.5)`
                ),
              } : { opacity: 0, textShadow: "none" }}
              transition={isPowered ? { duration: 0.8, times, ease: "linear" } : { duration: 0.1 }}
            >
              made by daeeon
            </motion.p>
          </div>

          {/* ── Layer 3: Spark Particles (z:3) ───────────────────────── */}
          <AnimatePresence>
            {isPowered && (
              <motion.div key="sparks" className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }}>
                {sparks.map(s => <Spark key={s.id} {...s} />)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── UI Layer (z:10) ─────────────────────────────────────────── */}
          
          {/* Right Panel: POWER Lever */}
          <div
            className="absolute right-16 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
            style={{ zIndex: 10 }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <div
              className="p-4 rounded-2xl flex flex-col items-center gap-1"
              style={{
                background: "linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 100%)",
                border: "1px solid #444",
                boxShadow: "0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
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

          {/* ── Post-power hint ─────────────────────────────────────────────────────── */}
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

          {/* ── Skip for next time button ────────────────────────────────── */}
          <AnimatePresence>
            {isPowered && (
              <motion.button
                key="skip-btn"
                onClick={handleSkip}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute bottom-5 right-6 z-20 text-[9px] text-zinc-600 hover:text-zinc-400 tracking-widest uppercase font-light transition-colors duration-200 cursor-pointer"
                style={{ letterSpacing: "0.18em" }}
              >
                Skip for next time
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
