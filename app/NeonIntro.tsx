"use client";

import React, { useState, useMemo } from "react";
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

// Layer 1: Background Wires physically connected to text endpoints
function BackgroundWires() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 1 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="-400 -300 800 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0"
        style={{
          overflow: "visible",
          filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.65))",
        }}
      >
        <g fill="none" strokeLinecap="round">
          <path
            d="M -230 -34 C -305 -95 -330 -190 -285 -330 C -260 -410 -225 -500 -250 -650"
            stroke="#2a2a2a"
            strokeWidth="7"
          />
          <path
            d="M 210 -20 C 290 -75 350 -130 430 -155 C 540 -190 650 -175 820 -245"
            stroke="#2a2a2a"
            strokeWidth="7"
          />
          <path
            d="M -230 -34 C -305 -95 -330 -190 -285 -330 C -260 -410 -225 -500 -250 -650"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            transform="translate(-1 -1)"
          />
          <path
            d="M 210 -20 C 290 -75 350 -130 430 -155 C 540 -190 650 -175 820 -245"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            transform="translate(-1 -1)"
          />
        </g>
      </svg>

      <div
        className="absolute"
        style={{
          left: "calc(50% - 230px)",
          top: "calc(50% - 34px)",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #f1f1f1 0%, #9a9a9a 38%, #4b4b4b 100%)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.45)",
        }}
      />

      <div
        className="absolute"
        style={{
          left: "calc(50% + 210px)",
          top: "calc(50% - 20px)",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #f1f1f1 0%, #9a9a9a 38%, #4b4b4b 100%)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.45)",
        }}
      />
    </div>
  );
}

export default function NeonIntro({ onExplore }: { onExplore: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleClick = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      onExplore();
    }, 1200);
  };

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

  const erraticGlow: Variants = {
    initial: { opacity: 0.05, textShadow: "none" },
    animate: {
      opacity: opacities,
      textShadow: opacities.map((o) => {
        const jitterX = (Math.random() - 0.5) * 8;
        const jitterY = (Math.random() - 0.5) * 8;
        if (o !== 1) {
          return `${jitterX}px ${jitterY}px 5px rgba(255,42,133,0.5)`;
        }
        return `
          0 0 10px #ff2a85,
          ${jitterX * 1.5}px ${jitterY * 1.5}px 20px #ff2a85,
          ${jitterX * 2}px ${jitterY * 2}px 40px #ff2a85,
          ${jitterX}px ${jitterY}px 80px #ff2a85,
          ${jitterX * 1.5}px ${jitterY * 1.5}px 120px #ff2a85
        `;
      }),
      transition: { duration: 3, times: times, ease: "linear" },
    },
    exit: { opacity: 0, scale: 1.05, filter: "blur(20px)", transition: { duration: 1.0, ease: "easeOut" } }
  };

  const subtextGlow = `
    0 0 8px #00d4ff,
    0 0 15px #00d4ff,
    0 0 30px #00d4ff,
    0 0 60px #00d4ff
  `;

  const erraticSubtextGlow: Variants = {
    initial: { opacity: 0.05, textShadow: "none" },
    animate: {
      opacity: opacities,
      textShadow: opacities.map((o) => (o === 1 ? subtextGlow : "none")),
      transition: { duration: 3, times: times, ease: "linear" },
    },
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
        <motion.div
          onClick={handleClick}
          exit="exit"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-[#050505]"
        >
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
            @keyframes glitch-y {
              0% { transform: translateY(0px); }
              20% { transform: translateY(-1px); }
              40% { transform: translateY(1px); }
              60% { transform: translateY(-0.5px); }
              80% { transform: translateY(0.5px); }
              100% { transform: translateY(0px); }
            }
            .glitch-y-anim {
              animation: glitch-y 0.1s infinite linear;
            }
          `}} />

          {/* Layer 0: Concrete Texture Interacting with Neon (Brighten 5% when on) */}
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

          {/* Layer 0.5: Wall Light Map */}
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

          {/* Layer 0.6: Floor / Wall Light Spill (Elongated glow below the text) */}
          <motion.div
            animate={{ opacity: opacities }}
            transition={{ duration: 3, times: times, ease: "linear" }}
            className="absolute left-1/2 top-[55%] -translate-x-1/2 w-[1200px] h-[300px] pointer-events-none blur-[70px]"
            style={{
              background: "radial-gradient(ellipse at top, rgba(255,42,133,0.15) 0%, rgba(0,212,255,0.05) 50%, transparent 70%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          {/* Layer 1: Background Wiring */}
          <BackgroundWires />

          {/* Sparks Wrapper */}
          <motion.div
             animate={{ opacity: opacities }}
             transition={{ duration: 3, times: times, ease: "linear" }}
             className="absolute inset-0 pointer-events-none z-[5]"
          >
            {sparks.map((spark) => (
              <Spark key={spark.id} {...spark} />
            ))}
          </motion.div>

          {/* Layer 2: Neon Sign Container */}
          <div className="relative flex flex-col items-center" style={{ width: 800, height: 400 }}>
            
            {/* Layer 2.1: White Core */}
            <motion.div
              variants={erraticCore}
              initial="initial"
              animate="animate"
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
              
              <p
                className="text-2xl md:text-4xl font-bold"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  transform: "rotate(-4deg) translateX(30px)"
                }}
              >
                made by daeeon
              </p>
            </motion.div>

            {/* Layer 2.2: Outer Glow */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 3, mixBlendMode: "screen" }}
            >
              <motion.h1 
                variants={erraticGlow}
                initial="initial"
                animate="animate"
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-transparent mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)"
                }}
              >
                Welcome
              </motion.h1>
              
              <motion.p
                variants={erraticSubtextGlow}
                initial="initial"
                animate="animate"
                className="text-2xl md:text-4xl text-transparent font-bold"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  transform: "rotate(-4deg) translateX(30px)"
                }}
              >
                made by daeeon
              </motion.p>
            </motion.div>

          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 3.5 }}
            className="absolute bottom-12 text-zinc-400 tracking-[0.4em] text-xs font-light z-10 uppercase font-sans mix-blend-screen"
          >
            Click Anywhere to Enter
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
