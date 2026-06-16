"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

// Helper to generate spark data so it's stable across renders
const generateSparks = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 400, // spread X
    y: (Math.random() - 0.5) * 300, // spread Y
    delay: Math.random() * 3,
    duration: 0.8 + Math.random() * 1.5,
    size: Math.random() * 3 + 1,
    color: Math.random() > 0.5 ? "#ff2a85" : "#00d4ff",
  }));
};

function Spark({ x, y, delay, duration, size, color }: any) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "#fff",
        boxShadow: `0 0 6px 2px ${color}`,
        mixBlendMode: "screen",
        left: "50%",
        top: "50%",
        zIndex: 5,
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
      animate={{
        x: [0, x * 0.5, x],
        y: [0, y * 0.5 - 50, y - 20], // subtle arc upwards
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 3 + 1,
        ease: "easeOut",
      }}
    />
  );
}

export default function NeonIntro({ onExplore }: { onExplore: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  
  // Track mouse for subtle shadow shift (Layer 3: Ambient spread)
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

  // Shadow calculations based on mouse (parallax effect on ambient glow)
  const offsetX = (mousePos.x - 0.5) * 30;
  const offsetY = (mousePos.y - 0.5) * 30;
  
  const neonShadowPink = `
    0 0 2px #fff,
    0 0 4px #fff,
    0 0 10px #ff2a85,
    0 0 20px #ff2a85,
    0 0 40px #ff2a85,
    ${offsetX}px ${offsetY}px 80px #ff2a85,
    ${offsetX * 1.5}px ${offsetY * 1.5}px 120px #ff2a85
  `;

  const neonShadowBlue = `
    0 0 1px #fff,
    0 0 3px #fff,
    0 0 8px #00d4ff,
    0 0 15px #00d4ff,
    0 0 30px #00d4ff,
    ${offsetX * 0.5}px ${offsetY * 0.5}px 60px #00d4ff
  `;

  // Pre-calculate an exponentially accelerating 3-second flicker
  const { opacities, times } = useMemo(() => {
    const steps = 30;
    const op = [];
    const tm = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      // Exponential curve: time intervals get much shorter at the end
      const timeProg = Math.pow(progress, 3);
      tm.push(timeProg);
      // Toggle between OFF (0.1) and ON (1). Towards the end, randomly skip some OFFs for natural glitch
      let val = i % 2 === 0 ? 0.1 : 1;
      if (progress > 0.8 && Math.random() > 0.5) val = 1;
      op.push(val);
    }
    op[op.length - 1] = 1; // force ON at end
    tm[tm.length - 1] = 1;
    return { opacities: op, times: tm };
  }, []);

  const erraticFlicker: Variants = {
    initial: { opacity: 0.1, textShadow: "none", color: "#222" },
    animate: {
      opacity: opacities,
      color: opacities.map((o) => (o === 1 ? "#fff" : "#222")),
      textShadow: opacities.map((o) => (o === 1 ? neonShadowPink : "none")),
      transition: {
        duration: 3, // Total 3 seconds
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

  const sparks = useMemo(() => generateSparks(25), []);

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
            backgroundImage: `radial-gradient(circle at 50% 50%, #151515 0%, #000000 100%)`,
          }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
          `}} />

          <div className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}></div>

          <motion.div
            variants={erraticFlicker}
            initial="initial"
            animate="animate"
            className="relative z-10 flex flex-col items-center"
            style={{ mixBlendMode: "screen" }}
          >
            {/* Sparks erupting from the center */}
            <div className="absolute inset-0 pointer-events-none">
              {sparks.map((spark) => (
                <Spark key={spark.id} {...spark} />
              ))}
            </div>

            {/* Continuous idle flicker (starts after the 3s initial animation) */}
            <motion.div
              animate={{ opacity: [1, 0.7, 1, 0.4, 1, 0.9, 1, 1, 1] }}
              transition={{
                delay: 3, // wait for 3s initial sequence
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.5, 0.6, 0.8, 1]
              }}
              className="flex flex-col items-center relative z-10"
            >
              <h1 
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-white mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  textShadow: neonShadowPink,
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
