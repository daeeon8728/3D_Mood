"use client";

import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

// Helper to generate spark data
const generateSparks = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    xOffset: (Math.random() - 0.5) * 40, 
    yDrop: 100 + Math.random() * 150, 
    delay: Math.random() * 2,
    duration: 0.6 + Math.random() * 0.8,
    size: Math.random() * 3 + 2,
    color: "#FF4500", // Fixed purely to striking orange/red
  }));
};

function Spark({ xOffset, yDrop, delay, duration, size, color }: any) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "#fff",
        boxShadow: `0 0 6px 2px ${color}`,
        mixBlendMode: "screen",
        left: "calc(50% + 225px)",
        top: "calc(50% - 15px)",
        zIndex: 5, 
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x: [0, xOffset * 0.5, xOffset],
        y: [0, yDrop * 0.2, yDrop], 
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 1.5 + 0.5,
        ease: "easeIn",
      }}
    />
  );
}

// Draw wires with faint blue emissive outline instead of shadow
function BackgroundWires() {
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none" 
      style={{ zIndex: 1, opacity: 0.9 }}
      preserveAspectRatio="none"
    >
      {/* Base Wire (Dark core for silhouette) */}
      <g stroke="#050505" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M 30% -10% Q 35% 30% 45% 48%" />
        <path d="M 45% 48% Q 50% 55% 55% 52%" strokeWidth="4" />
        <path d="M 55% 52% Q 58% 65% 55% 62%" strokeWidth="3" />
        <path d="M 55% 62% Q 65% 70% 80% 110%" strokeWidth="5" />
      </g>
      {/* Emissive surface on the wire (no drop shadow) */}
      <g stroke="#1A1A3F" strokeWidth="6" fill="none" strokeLinecap="round" style={{ opacity: 0.1 }}>
        <path d="M 30% -10% Q 35% 30% 45% 48%" />
        <path d="M 45% 48% Q 50% 55% 55% 52%" strokeWidth="4" />
        <path d="M 55% 52% Q 58% 65% 55% 62%" strokeWidth="3" />
        <path d="M 55% 62% Q 65% 70% 80% 110%" strokeWidth="5" />
      </g>
    </svg>
  );
}

export default function NeonIntro({ onExplore }: { onExplore: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;
    setMousePos({ x, y });
  };

  const handleClick = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      onExplore();
    }, 1200);
  };

  const offsetX = (mousePos.x - 0.5) * 30;
  const offsetY = (mousePos.y - 0.5) * 30;

  // Blue sub-text shadow
  const neonShadowBlue = `
    0 0 1px #fff,
    0 0 3px #fff,
    0 0 8px #00d4ff,
    0 0 15px #00d4ff,
    0 0 30px #00d4ff,
    ${offsetX * 0.5}px ${offsetY * 0.5}px 60px #00d4ff
  `;

  const { opacities, times } = useMemo(() => {
    const steps = 30;
    const op = [];
    const tm = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const timeProg = Math.pow(progress, 3);
      tm.push(timeProg);
      let val = i % 2 === 0 ? 0.05 : 1;
      if (progress > 0.8 && Math.random() > 0.5) val = 1;
      op.push(val);
    }
    op[op.length - 1] = 1;
    tm[tm.length - 1] = 1;
    return { opacities: op, times: tm };
  }, []);

  const erraticFlicker: Variants = {
    initial: { opacity: 0.05, textShadow: "none", color: "#111" },
    animate: {
      opacity: opacities,
      color: opacities.map((o) => (o === 1 ? "#fff" : "#111")),
      // Include random voltage jitter directly into the textShadow
      textShadow: opacities.map((o) => {
        const jitterX = (Math.random() - 0.5) * 8;
        const jitterY = (Math.random() - 0.5) * 8;
        if (o !== 1) {
          // When flickering/off, keep a faint, jittery pink outline to show unstable voltage
          return `${jitterX}px ${jitterY}px 5px rgba(255,42,133,0.5)`;
        }
        return `
          0 0 2px #fff,
          0 0 4px #fff,
          ${jitterX}px ${jitterY}px 10px #ff2a85,
          ${jitterX * 1.5}px ${jitterY * 1.5}px 20px #ff2a85,
          ${jitterX * 2}px ${jitterY * 2}px 40px #ff2a85,
          ${offsetX + jitterX}px ${offsetY + jitterY}px 80px #ff2a85,
          ${(offsetX + jitterX) * 1.5}px ${(offsetY + jitterY) * 1.5}px 120px #ff2a85
        `;
      }),
      transition: {
        duration: 3,
        times: times,
        ease: "linear",
      },
    },
    exit: { 
      opacity: 0,
      scale: 1.05,
      filter: "blur(20px)",
      transition: { duration: 1.0, ease: "easeOut" } 
    }
  };

  const sparks = useMemo(() => generateSparks(20), []);

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          exit="exit"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
          style={{
            backgroundColor: "#050505",
            backgroundImage: `radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000000 100%)`,
          }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
          `}} />

          {/* Layer 0: Wall Light Map (Glow under the concrete texture) */}
          <motion.div
            animate={{ opacity: opacities }}
            transition={{ duration: 3, times: times, ease: "linear" }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none blur-[80px]"
            style={{
              background: "radial-gradient(ellipse at center, rgba(255,42,133,0.3) 0%, rgba(0,212,255,0.1) 50%, transparent 70%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          {/* Layer 1: Concrete Texture (Overlays on top of the light map) */}
          <div className="absolute inset-0 opacity-[0.3] pointer-events-none mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            zIndex: 1,
          }}></div>

          {/* Layer 1: Background Wiring */}
          <BackgroundWires />

          {/* Wrapper to sync sparks with flicker opacity */}
          <motion.div
             animate={{ opacity: opacities }}
             transition={{ duration: 3, times: times, ease: "linear" }}
             className="absolute inset-0 pointer-events-none z-[5]"
          >
            {/* Layer 3: Particles (Orange/Red Sparks falling from the 'e' tail) */}
            {sparks.map((spark) => (
              <Spark key={spark.id} {...spark} />
            ))}
          </motion.div>

          {/* Layer 2: Neon Sign Text */}
          <motion.div
            variants={erraticFlicker}
            initial="initial"
            animate="animate"
            className="relative z-[2] flex flex-col items-center"
            style={{ mixBlendMode: "screen" }}
          >
            <motion.div
              animate={{ opacity: [1, 0.7, 1, 0.4, 1, 0.9, 1, 1, 1] }}
              transition={{
                delay: 3,
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.5, 0.6, 0.8, 1]
              }}
              className="flex flex-col items-center relative"
            >
              <h1 
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-white mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)"
                }}
              >
                Welcome
              </h1>
              
              <p
                className="text-2xl md:text-4xl text-white font-bold"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  textShadow: neonShadowBlue,
                  transform: "rotate(-4deg) translateX(30px)"
                }}
              >
                made by daeeon
              </p>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 3.5 }}
            className="absolute bottom-12 text-zinc-600 tracking-[0.4em] text-xs font-light z-10 uppercase font-sans"
          >
            Click Anywhere to Enter
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
