"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const neonTextShadow = `
  0 0 10px #ff2a85,
  0 0 20px #ff2a85,
  0 0 40px #ff2a85,
  0 0 80px #ff2a85,
  0 0 120px #ff2a85
`;

const subtextShadow = `
  0 0 8px #00d4ff,
  0 0 15px #00d4ff,
  0 0 30px #00d4ff,
  0 0 60px #00d4ff
`;

const coreVariants: Variants = {
  dark: {
    opacity: 0,
    color: "#111",
    filter: "blur(2px)",
  },
  lit: {
    opacity: [0, 0.08, 0, 0.28, 0.05, 1],
    color: ["#111", "#fff", "#111", "#fff", "#161616", "#fff"],
    filter: ["blur(2px)", "blur(1px)", "blur(2px)", "blur(0.5px)", "blur(1px)", "blur(0px)"],
    transition: {
      delay: 0.25,
      duration: 1.65,
      times: [0, 0.08, 0.16, 0.26, 0.36, 1],
      ease: "easeIn",
    },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    transition: { duration: 1, ease: "easeOut" },
  },
};

const glowVariants: Variants = {
  dark: {
    opacity: 0,
    textShadow: "none",
  },
  lit: {
    opacity: [0, 0.2, 0, 0.45, 0.1, 1],
    textShadow: [
      "none",
      "0 0 12px rgba(255,42,133,0.7)",
      "none",
      "0 0 28px rgba(255,42,133,0.9)",
      "0 0 5px rgba(255,42,133,0.4)",
      neonTextShadow,
    ],
    transition: {
      delay: 0.25,
      duration: 1.8,
      times: [0, 0.08, 0.16, 0.26, 0.36, 1],
      ease: "easeIn",
    },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    filter: "blur(20px)",
    transition: { duration: 1, ease: "easeOut" },
  },
};

const subtextVariants: Variants = {
  dark: {
    opacity: 0,
    textShadow: "none",
  },
  lit: {
    opacity: [0, 0.15, 0, 0.35, 0.08, 1],
    textShadow: ["none", subtextShadow, "none", subtextShadow, "none", subtextShadow],
    transition: {
      delay: 0.35,
      duration: 1.7,
      times: [0, 0.08, 0.16, 0.26, 0.36, 1],
      ease: "easeIn",
    },
  },
};

export default function NeonIntro({ onExplore }: { onExplore: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleSwitchClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isVisible || isGlitching || isFadingOut) return;

    setIsGlitching(true);
    window.setTimeout(() => {
      setIsVisible(true);
      setIsGlitching(false);
    }, 300);
  };

  const handleEnter = () => {
    if (!isVisible || isFadingOut) return;
    setIsFadingOut(true);
    window.setTimeout(() => {
      onExplore();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          onClick={handleEnter}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(18px)", transition: { duration: 1, ease: "easeOut" } }}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#050505] ${isVisible ? "cursor-pointer" : "cursor-default"}`}
        >
          <style dangerouslySetInnerHTML={{__html: `
            @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Dancing+Script:wght@400;700&display=swap');
          `}} />

          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              backgroundColor: isVisible ? "rgba(50,20,30,0.4)" : "rgba(4,4,4,0.96)",
              filter: isVisible ? "contrast(125%) brightness(88%)" : "contrast(130%) brightness(42%)",
            }}
            transition={{ duration: 1.8, ease: "easeIn" }}
            style={{
              backgroundImage: "url('/%EC%BD%98%ED%81%AC%EB%A6%AC%ED%8A%B8_%ED%85%8D%EC%8A%A4%EC%B2%98.jpg')",
              backgroundBlendMode: "overlay",
              backgroundSize: "cover",
              backgroundPosition: "center",
              zIndex: 0,
            }}
          />

          <motion.div
            className="absolute left-1/2 top-1/2 h-[430px] w-[860px] -translate-x-1/2 -translate-y-1/2 pointer-events-none blur-[90px]"
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ delay: 0.25, duration: 1.8, ease: "easeIn" }}
            style={{
              background: "radial-gradient(ellipse at center, rgba(255,42,133,0.32) 0%, rgba(0,212,255,0.11) 48%, transparent 72%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="absolute left-1/2 top-[56%] h-[320px] w-[1200px] -translate-x-1/2 pointer-events-none blur-[76px]"
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ delay: 0.35, duration: 2, ease: "easeIn" }}
            style={{
              background: "radial-gradient(ellipse at top, rgba(255,42,133,0.16) 0%, rgba(0,212,255,0.06) 52%, transparent 72%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={isGlitching ? { opacity: [0, 0.22, 0, 0.18, 0, 0.14, 0] } : { opacity: 0 }}
            transition={{ duration: 0.3, times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1], ease: "linear" }}
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(255,42,133,0.22), transparent 38%)",
              zIndex: 1,
              mixBlendMode: "screen",
            }}
          />

          <motion.button
            type="button"
            aria-label="Turn on neon sign"
            onClick={handleSwitchClick}
            className="absolute right-[14vw] top-[28vh] z-10 h-16 w-11 rounded-md border border-white/10 bg-zinc-950/80 p-1 shadow-2xl"
            animate={{
              boxShadow: [
                "0 0 10px rgba(0,212,255,0.2), 0 0 22px rgba(255,42,133,0.1)",
                "0 0 16px rgba(0,212,255,0.38), 0 0 34px rgba(255,42,133,0.2)",
                "0 0 10px rgba(0,212,255,0.2), 0 0 22px rgba(255,42,133,0.1)",
              ],
            }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.span
              className="block h-full w-full rounded bg-zinc-800"
              animate={{
                y: isVisible ? 7 : -7,
                backgroundColor: isVisible ? "#f8f8f8" : "#27272a",
                boxShadow: isVisible
                  ? "inset 0 8px 14px rgba(0,0,0,0.18), 0 0 16px rgba(255,255,255,0.45)"
                  : "inset 0 -8px 14px rgba(0,0,0,0.65), 0 0 10px rgba(0,212,255,0.28)",
              }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
            />
          </motion.button>

          <div className="relative flex flex-col items-center" style={{ width: 800, height: 400, zIndex: 2 }}>
            <motion.div
              variants={coreVariants}
              initial="dark"
              animate={isVisible ? "lit" : "dark"}
              exit="exit"
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 2 }}
            >
              <h1
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)",
                }}
              >
                Welcome
              </h1>

              <p
                className="text-2xl md:text-4xl font-bold"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  transform: "rotate(-4deg) translateX(30px)",
                }}
              >
                made by daeeon
              </p>
            </motion.div>

            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ zIndex: 3, mixBlendMode: "screen" }}
            >
              <motion.h1
                variants={glowVariants}
                initial="dark"
                animate={isVisible ? "lit" : "dark"}
                exit="exit"
                className="text-7xl md:text-9xl lg:text-[11rem] font-normal text-transparent mb-2"
                style={{
                  fontFamily: "'Pinyon Script', cursive",
                  lineHeight: "1.2",
                  transform: "rotate(-4deg)",
                }}
              >
                Welcome
              </motion.h1>

              <motion.p
                variants={subtextVariants}
                initial="dark"
                animate={isVisible ? "lit" : "dark"}
                className="text-2xl md:text-4xl text-transparent font-bold"
                style={{
                  fontFamily: "'Dancing Script', cursive",
                  transform: "rotate(-4deg) translateX(30px)",
                }}
              >
                made by daeeon
              </motion.p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? [0, 0.5, 0] : 0 }}
            transition={{ duration: 3, repeat: Infinity, delay: 2.2 }}
            className="absolute bottom-12 z-10 text-xs font-light uppercase tracking-[0.4em] text-zinc-400 mix-blend-screen"
          >
            Click Anywhere to Enter
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
