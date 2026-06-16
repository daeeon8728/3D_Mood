"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

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
  
  // 3-Layer Text Shadow Strategy:
  // 1. Core (White, sharp)
  // 2. Main Glow (Color, medium blur)
  // 3. Ambient Spread (Color, huge blur, reacts to mouse)
  
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

  // Erratic flicker for the "faulty neon" look
  const erraticFlicker: Variants = {
    initial: { opacity: 0, textShadow: "none", color: "#222" },
    animate: {
      opacity: [0, 1, 0, 1, 0.2, 1, 0.8, 1, 1],
      color: ["#222", "#fff", "#222", "#fff", "#eee", "#fff", "#fff", "#fff", "#fff"],
      textShadow: [
        "none",
        neonShadowPink,
        "none",
        neonShadowPink,
        "none",
        neonShadowPink,
        neonShadowPink,
        neonShadowPink,
        neonShadowPink
      ],
      transition: {
        duration: 1.8,
        times: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.4, 0.5, 1],
        ease: "linear",
      }
    },
    exit: { 
      opacity: 0,
      scale: 1.05,
      filter: "blur(20px)",
      transition: { duration: 1.0, ease: "easeOut" } 
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
            // Very dark background to make neon pop
            backgroundColor: "#050505",
            backgroundImage: `radial-gradient(circle at 50% 50%, #151515 0%, #000000 100%)`,
          }}
        >
          {/* Inject elegant Google Fonts */}
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
          `}} />

          {/* Concrete Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}></div>

          <motion.div
            variants={erraticFlicker}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-10 flex flex-col items-center"
            // Screen blend mode ensures the light literally 'adds' to the background texture
            style={{ mixBlendMode: "screen" }}
          >
            {/* Continuous random flicker loop */}
            <motion.div
              animate={{
                opacity: [1, 0.7, 1, 0.4, 1, 0.9, 1, 1, 1],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
                times: [0, 0.1, 0.2, 0.25, 0.3, 0.5, 0.6, 0.8, 1]
              }}
              className="flex flex-col items-center"
            >
              <h1 
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-white mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  textShadow: neonShadowPink,
                  // Tweak line-height so cursive tails don't get clipped
                  lineHeight: "1.2",
                  // A slight rotation makes script fonts look more like mounted glass tubes
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
            transition={{ duration: 3, repeat: Infinity, delay: 2 }}
            className="absolute bottom-12 text-zinc-600 tracking-[0.4em] text-xs font-light z-10 uppercase font-sans"
          >
            Click Anywhere to Enter
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
