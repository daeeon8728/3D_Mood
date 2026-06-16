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

// Generate White Noise Buffer for Spray
let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = () => {
  if (!audioCtx) return null;
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = audioCtx.sampleRate * 2; // 2 sec loop
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
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
export default function NeonSign({ onExplore }: { onExplore?: () => void }) {
  const containerRef            = useRef<HTMLDivElement>(null);
  const canvasRef               = useRef<HTMLCanvasElement>(null);
  
  const [mousePos, setMousePos]       = useState({ x: 50, y: 50 });
  const [isPowered, setIsPowered]     = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isShaking, setIsShaking]     = useState(false);
  const [isSprayingMode, setIsSprayingMode] = useState(false);
  
  const sparks = useMemo(() => generateSparks(18), []);
  const buzzAudio = useRef<{stop: ()=>void} | null>(null);

  // --- Graffiti Canvas Logic ---
  const isDrawing = useRef(false);
  const lastPos = useRef<{x: number, y: number, time: number} | null>(null);
  const spraySrc = useRef<AudioBufferSourceNode | null>(null);
  const sprayGain = useRef<GainNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const stopSprayAudio = useCallback(() => {
    if (spraySrc.current && sprayGain.current && audioCtx) {
      const t = audioCtx.currentTime;
      sprayGain.current.gain.linearRampToValueAtTime(0, t + 0.1);
      spraySrc.current.stop(t + 0.1);
      spraySrc.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isSprayingMode || isPowered) return;
    isDrawing.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY, time: e.timeStamp };

    initAudio();
    if (audioCtx) {
      const buf = getNoiseBuffer();
      if (buf) {
        spraySrc.current = audioCtx.createBufferSource();
        spraySrc.current.buffer = buf;
        spraySrc.current.loop = true;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 3000;
        filter.Q.value = 1.0;

        sprayGain.current = audioCtx.createGain();
        sprayGain.current.gain.value = 0; // Will be modulated by speed
        
        spraySrc.current.connect(filter);
        filter.connect(sprayGain.current);
        sprayGain.current.connect(audioCtx.destination);
        spraySrc.current.start();
      }
    }
  }, [isSprayingMode, isPowered]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Flashlight logic
    if (containerRef.current) {
      const { left, top, width, height } = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - left) / width) * 100,
        y: ((e.clientY - top)  / height) * 100,
      });
    }

    if (!isDrawing.current || !isSprayingMode || !canvasRef.current || isPowered) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx || !lastPos.current) return;

    const currentPos = { x: e.clientX, y: e.clientY, time: e.timeStamp };
    const dx = currentPos.x - lastPos.current.x;
    const dy = currentPos.y - lastPos.current.y;
    const dt = currentPos.time - lastPos.current.time;
    
    if (dt === 0) return;
    
    const speed = Math.sqrt(dx*dx + dy*dy) / dt; // pixels per ms
    
    // User requested: "흔들수록 진하게 나오고 안흔들면 연하게"
    // Higher speed -> higher opacity. Map speed 0~3 to opacity 0.05~0.8
    const targetOpacity = Math.min(0.9, Math.max(0.02, speed * 0.4));
    
    // Update audio volume based on speed (more shake = louder spray)
    if (sprayGain.current && audioCtx) {
      sprayGain.current.gain.setTargetAtTime(targetOpacity * 0.5, audioCtx.currentTime, 0.05);
    }

    // Draw spray (scattered points or radial gradient)
    const radius = 25 + Math.random() * 15;
    const grad = ctx.createRadialGradient(currentPos.x, currentPos.y, 0, currentPos.x, currentPos.y, radius);
    grad.addColorStop(0, `rgba(255, 0, 100, ${targetOpacity})`);
    grad.addColorStop(0.5, `rgba(255, 0, 100, ${targetOpacity * 0.3})`);
    grad.addColorStop(1, 'rgba(255, 0, 100, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(currentPos.x, currentPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    lastPos.current = currentPos;
  }, [isSprayingMode, isPowered]);

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
    stopSprayAudio();
  }, [stopSprayAudio]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopSprayAudio();
      if (buzzAudio.current) buzzAudio.current.stop();
    };
  }, [stopSprayAudio]);

  // Lever snap event
  const handleSnap = useCallback(() => {
    if (isSprayingMode) {
      setIsSprayingMode(false); // disable spray when powering on
    }
    // Screen shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300);

    // Power on neon after 300ms
    setTimeout(() => {
      setIsPowered(true);
      buzzAudio.current = startBuzzSound();
    }, 300);
  }, [isSprayingMode]);

  // Click to exit after powered
  const handleClick = () => {
    if (!isPowered || isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => onExplore?.(), 1100);
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          exit="exit"
          variants={exitVariant}
          animate={isShaking ? {
            x: [0, -4, 4, -3, 3, -1, 1, 0],
            y: [0, -2, 2, -1, 1, 0],
            transition: { duration: 0.3, ease: "linear" },
          } : {}}
          className="fixed inset-0 z-[100] overflow-hidden bg-[#050505]"
          style={{ 
            cursor: isPowered ? "pointer" : isSprayingMode ? "crosshair" : "default",
            touchAction: "none" // Prevent scrolling while drawing
          }}
          onClick={handleClick}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&family=Black+Ops+One&display=swap');
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

          {/* ── Layer 1: Graffiti Canvas ──────────────────────────── */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1, opacity: isPowered ? 0.6 : 1, transition: "opacity 0.6s" }}
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
          
          {/* Left Panel: Drawing Stencil */}
          <div className="absolute left-10 md:left-24 top-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 10 }}>
             <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isPowered ? 0 : 0.6, x: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="select-none"
                style={{
                  fontFamily: "'Black Ops One', system-ui",
                  fontSize: "clamp(2rem, 5vw, 4rem)",
                  color: "transparent",
                  WebkitTextStroke: "2px #fff",
                  transform: "rotate(-9deg)",
                }}
             >
                drawing!
             </motion.div>
          </div>

          {/* Center Panel: Explore Lever */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
            style={{ zIndex: 10, marginTop: "180px" }} // Pushed down slightly to not overlap neon
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()} // Prevent spray when interacting with lever
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
                EXPLORE
              </p>
              <MechanicalLever onSnap={handleSnap} />
            </div>
          </div>

          {/* Right Panel: Spray Can */}
          <div
            className="absolute right-10 md:right-24 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
            style={{ zIndex: 10 }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()} // Prevent drawing on the can itself
          >
             <motion.button
                type="button"
                className="relative cursor-pointer focus:outline-none flex flex-col items-center justify-center"
                onClick={() => {
                   initAudio(); // Required on first user interaction
                   setIsSprayingMode(!isSprayingMode);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{ opacity: isPowered ? 0 : 1 }}
                style={{ pointerEvents: isPowered ? "none" : "auto" }}
             >
                {/* Simple SVG Spray Can icon */}
                <svg width="64" height="120" viewBox="0 0 64 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                   {/* Cap/Nozzle */}
                   <path d="M 24 10 L 40 10 L 40 20 L 24 20 Z" fill="#666" />
                   <path d="M 30 5 L 34 5 L 34 10 L 30 10 Z" fill="#ddd" />
                   <circle cx="28" cy="15" r="2" fill="#222" />
                   
                   {/* Can Body */}
                   <rect x="12" y="20" width="40" height="90" rx="6" fill="url(#canGrad)" stroke="#333" strokeWidth="2" />
                   <rect x="12" y="30" width="40" height="40" fill="#E83E8C" opacity="0.8" />
                   
                   <defs>
                      <linearGradient id="canGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="#888" />
                         <stop offset="50%" stopColor="#ccc" />
                         <stop offset="100%" stopColor="#555" />
                      </linearGradient>
                   </defs>
                </svg>
                
                {/* Label text */}
                <div className="mt-4 flex flex-col items-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest text-center">
                   <span>on the wall</span>
                   <span>(shake it)</span>
                </div>
                
                {/* Active Indicator Glow */}
                <AnimatePresence>
                   {isSprayingMode && (
                      <motion.div
                         className="absolute inset-0 rounded-full"
                         initial={{ opacity: 0, boxShadow: "0 0 0px #E83E8C" }}
                         animate={{ opacity: 1, boxShadow: "0 0 30px #E83E8C" }}
                         exit={{ opacity: 0 }}
                         style={{ zIndex: -1, top: 10, bottom: 20 }}
                      />
                   )}
                </AnimatePresence>
             </motion.button>
          </div>

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
