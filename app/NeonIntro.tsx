"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

export default function NeonIntro({ onExplore }: { onExplore: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  
  // Track mouse for subtle shadow shift
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
    // Wait for the exit animation to complete before unmounting/transitioning
    setTimeout(() => {
      onExplore();
    }, 1200);
  };

  // Shadow calculations based on mouse (subtle movement)
  const shadowX = (mousePos.x - 0.5) * 15;
  const shadowY = (mousePos.y - 0.5) * 15;
  
  // The core neon shadow CSS
  // Using multiple layers for glow. White core, strong pink outer glow.
  const neonShadowPink = `
    0 0 4px #fff,
    0 0 10px #fff,
    ${shadowX}px ${shadowY}px 20px #ff2a85,
    ${shadowX * 1.5}px ${shadowY * 1.5}px 40px #ff2a85,
    ${shadowX * 2}px ${shadowY * 2}px 80px #ff2a85,
    ${shadowX * 2.5}px ${shadowY * 2.5}px 120px #ff2a85
  `;

  const neonShadowBlue = `
    0 0 2px #fff,
    0 0 5px #fff,
    ${shadowX * 0.5}px ${shadowY * 0.5}px 10px #00d4ff,
    ${shadowX}px ${shadowY}px 20px #00d4ff,
    ${shadowX * 1.5}px ${shadowY * 1.5}px 40px #00d4ff
  `;

  // Initial striking flicker animation for the entire text block
  const strikeFlicker: Variants = {
    initial: { opacity: 0, textShadow: "none", color: "#333" },
    animate: {
      opacity: [0, 1, 0, 1, 0.4, 1, 1],
      color: ["#333", "#fff", "#333", "#fff", "#eee", "#fff", "#fff"],
      textShadow: [
        "none",
        neonShadowPink,
        "none",
        neonShadowPink,
        "none",
        neonShadowPink,
        neonShadowPink
      ],
      transition: {
        duration: 1.5,
        times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
        ease: "linear",
      }
    },
    exit: { 
      opacity: 0,
      scale: 1.05,
      filter: "blur(15px)",
      transition: { duration: 1.0, ease: "easeInOut" } 
    }
  };

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
            // Dark concrete vibe
            backgroundColor: "#0a0a0a",
            backgroundImage: `radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000000 100%)`,
          }}
        >
          {/* Concrete Texture Overlay via SVG Noise */}
          <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}></div>

          <motion.div
            variants={strikeFlicker}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-10 flex flex-col items-center"
            style={{ mixBlendMode: "screen" }}
          >
            {/* Continuous subtle idle flicker */}
            <motion.div
              animate={{
                opacity: [1, 0.85, 1, 0.9, 1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear"
              }}
              className="flex flex-col items-center"
            >
              <h1 
                className="text-6xl md:text-8xl lg:text-9xl font-black text-white tracking-widest uppercase mb-4"
                style={{
                  textShadow: neonShadowPink,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                WELCOME
              </h1>
              
              <p
                className="text-lg md:text-2xl text-white font-light tracking-[0.4em] uppercase"
                style={{
                  textShadow: neonShadowBlue,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                made by daeeon
              </p>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 2 }}
            className="absolute bottom-12 text-zinc-500 tracking-[0.3em] text-xs md:text-sm font-light z-10"
          >
            CLICK ANYWHERE TO ENTER
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
