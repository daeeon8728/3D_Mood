"use client";

import React, { useState, useMemo, useRef } from "react";
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
    color: "#FF4500", 
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

// Layer 1: Background Wires (Light grey 3D tube shape + metal clips)
function BackgroundWires() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 1 }}>
      <svg style={{ width: 0, height: 0, overflow: 'visible', filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.8))' }}>
        {/* 3D Tube effect using a thick base and thin inner highlight */}
        <g strokeLinecap="round">
          {/* Wire 1: From W top-left up to the ceiling */}
          <path d="M -230 -20 Q -280 -200 -200 -600" stroke="#888" strokeWidth="6" fill="none" />
          <path d="M -230 -20 Q -280 -200 -200 -600" stroke="#d4d4d4" strokeWidth="2" fill="none" transform="translate(-1, -1)" />
          
          {/* Wire 2: From e bottom-right down to the floor */}
          <path d="M 225 -15 Q 260 200 150 600" stroke="#888" strokeWidth="6" fill="none" />
          <path d="M 225 -15 Q 260 200 150 600" stroke="#d4d4d4" strokeWidth="2" fill="none" transform="translate(-1, -1)" />
        </g>
        
        {/* Silver Metal Clips */}
        <g fill="#e0e0e0" stroke="#444" strokeWidth="1" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
          {/* Clip at W (-230, -20) */}
          <rect x="-236" y="-26" width="12" height="16" rx="3" transform="rotate(-15, -230, -20)" />
          <circle cx="-230" cy="-24" r="2" fill="#222" />
          <circle cx="-230" cy="-16" r="2" fill="#222" />

          {/* Clip at e (225, -15) */}
          <rect x="219" y="-23" width="12" height="16" rx="3" transform="rotate(15, 225, -15)" />
          <circle cx="225" cy="-21" r="2" fill="#222" />
          <circle cx="225" cy="-13" r="2" fill="#222" />
        </g>
      </svg>
    </div>
  );
}

export default function NeonSign({ onExplore }: { onExplore?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMousePos({ x, y });
  };

  const handleClick = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      onExplore?.();
    }, 1200);
  };

  // Pre-calculate irregular "ziiing" flicker opacities
  const { opacities, times } = useMemo(() => {
    const steps = 30; // 3 seconds total => 0.1s intervals!
    const op = [];
    const tm = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      tm.push(progress);
      
      // Irregular flickering "ziiing" for the first 80% of the timeline
      if (i < steps * 0.8) {
         op.push(Math.random() > 0.4 ? 1 : 0.05);
      } else {
         op.push(1); // Solid on at the end
      }
    }
    op[op.length - 1] = 1;
    tm[tm.length - 1] = 1;
    return { opacities: op, times: tm };
  }, []);

  const erraticGlow: Variants = {
    initial: { opacity: 0.05, textShadow: "none" },
    animate: {
      opacity: opacities,
      textShadow: opacities.map((o) => {
        // When flickering/off, text shadow jitters severely to simulate electrical glitch
        if (o !== 1) {
          const jitterX = (Math.random() - 0.5) * 15;
          const jitterY = (Math.random() - 0.5) * 15;
          return `${jitterX}px ${jitterY}px 5px rgba(255,42,133,0.5)`;
        }
        // Stable neon glow when fully ON
        return `
          0 0 10px #ff2a85,
          0 0 20px #ff2a85,
          0 0 40px #ff2a85,
          0 0 80px #ff2a85,
          0 0 120px #ff2a85
        `;
      }),
      transition: { duration: 3, times: times, ease: "linear" },
    },
    exit: { opacity: 0, scale: 1.05, filter: "blur(20px)", transition: { duration: 1.0, ease: "easeOut" } }
  };

  const erraticCore: Variants = {
    initial: { opacity: 0.05, color: "#111" },
    animate: {
      opacity: opacities,
      color: opacities.map((o) => (o === 1 ? "#fff" : "#111")),
      transition: { duration: 3, times: times, ease: "linear" },
    },
    exit: { opacity: 0, scale: 1.05, transition: { duration: 1.0, ease: "easeOut" } }
  };

  const sparks = useMemo(() => generateSparks(20), []);

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-[#050505]"
        >
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');
          `}} />

          {/* Layer 0: Concrete Texture Interacting with Neon */}
          <motion.div 
            className="absolute inset-0 pointer-events-none"
            animate={{ 
              backgroundColor: opacities.map(o => o === 1 ? 'rgba(50,20,30,0.4)' : 'rgba(10,10,10,0.9)'),
              filter: opacities.map(o => o === 1 ? 'contrast(120%) brightness(85%)' : 'contrast(120%) brightness(80%)')
            }}
            transition={{ duration: 3, times: times, ease: "linear" }}
            style={{
              backgroundImage: `url('/콘크리트_텍스처.jpg')`,
              backgroundBlendMode: 'overlay',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              zIndex: 0,
            }}
          />

          {/* Mouse Highlight (Flashlight effect over concrete) */}
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: `radial-gradient(circle 300px at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.08), transparent)`,
              zIndex: 0,
            }}
          />

          {/* Light Spill (Wall Bloom spreading across the concrete) */}
          <motion.div
            animate={{ opacity: opacities }}
            transition={{ duration: 3, times: times, ease: "linear" }}
            className="absolute left-1/2 top-[55%] -translate-x-1/2 w-[1200px] h-[300px] pointer-events-none blur-[80px]"
            style={{
              background: "radial-gradient(ellipse at top, rgba(255,42,133,0.2) 0%, rgba(0,212,255,0.05) 50%, transparent 70%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          {/* Layer 1: Background Wiring */}
          <BackgroundWires />

          {/* Sparks Layer */}
          <motion.div
             animate={{ opacity: opacities }}
             transition={{ duration: 3, times: times, ease: "linear" }}
             className="absolute inset-0 pointer-events-none z-[5]"
          >
            {sparks.map((spark) => (
              <Spark key={spark.id} {...spark} />
            ))}
          </motion.div>

          {/* Layer 2/3: Neon Sign Container */}
          <div className="relative flex flex-col items-center" style={{ width: 800, height: 400 }}>
            
            {/* Layer 2: White Core */}
            <motion.div
              variants={erraticCore}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 2 }}
            >
              <h1 
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)"
                }}
              >
                Welcome
              </h1>
            </motion.div>

            {/* Layer 3: Outer Glow */}
            <motion.div
              variants={erraticGlow}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 3, mixBlendMode: "screen" }}
            >
              <h1 
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-transparent mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)"
                }}
              >
                Welcome
              </h1>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 3.5 }}
            className="absolute bottom-12 text-zinc-500 tracking-[0.4em] text-xs font-light z-10 uppercase font-sans mix-blend-screen"
          >
            Click Anywhere to Enter
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
