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
  0 0 8px #ffffff,
  0 0 15px #ffffff,
  0 0 30px #ffffff,
  0 0 60px rgba(255,255,255,0.85)
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
  const [isTransitioning, setIsTransitioning] = useState(false);
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
    if (!isVisible || isTransitioning || isFadingOut) return;
    setIsTransitioning(true);
    window.setTimeout(() => {
      setIsFadingOut(true);
      onExplore();
    }, 1650);
  };

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          onClick={handleEnter}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(18px)", transition: { duration: 1, ease: "easeOut" } }}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#050505] ${isVisible && !isTransitioning ? "cursor-pointer" : "cursor-default"}`}
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
              background: "radial-gradient(ellipse at center, rgba(255,42,133,0.32) 0%, rgba(255,255,255,0.12) 48%, transparent 72%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="absolute left-1/2 top-[56%] h-[320px] w-[1200px] -translate-x-1/2 pointer-events-none blur-[76px]"
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ delay: 0.35, duration: 2, ease: "easeIn" }}
            style={{
              background: "radial-gradient(ellipse at top, rgba(255,42,133,0.16) 0%, rgba(255,255,255,0.07) 52%, transparent 72%)",
              zIndex: 0,
              mixBlendMode: "screen",
            }}
          />

          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={isGlitching ? { opacity: [0, 0.22, 0, 0.18, 0, 0.14, 0] } : { opacity: 0 }}
            transition={{ duration: 0.3, times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1], ease: "linear" }}
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.24), transparent 38%)",
              zIndex: 1,
              mixBlendMode: "screen",
            }}
          />

          <motion.button
            type="button"
            aria-label="Turn on neon sign"
            onClick={handleSwitchClick}
            disabled={isVisible || isGlitching || isFadingOut}
            className="absolute right-[12vw] top-[28vh] z-10 h-[112px] w-[70px] cursor-pointer rounded-[12px] border border-white/[0.08] bg-[#151515] p-[10px] disabled:cursor-default"
            animate={{
              boxShadow: isVisible
                ? "inset 0 2px 8px rgba(0,0,0,0.82), inset 0 -1px 0 rgba(255,255,255,0.06)"
                : [
                    "0 0 18px rgba(185,150,255,0.4), inset 0 2px 8px rgba(0,0,0,0.82), inset 0 -1px 0 rgba(255,255,255,0.06)",
                    "0 0 30px rgba(185,150,255,0.7), inset 0 2px 8px rgba(0,0,0,0.82), inset 0 -1px 0 rgba(255,255,255,0.06)",
                    "0 0 18px rgba(185,150,255,0.4), inset 0 2px 8px rgba(0,0,0,0.82), inset 0 -1px 0 rgba(255,255,255,0.06)",
                  ],
            }}
            transition={{ duration: 3.2, repeat: isVisible ? 0 : Infinity, ease: "easeInOut" }}
            style={{
              backgroundImage: "url('/%EC%BD%98%ED%81%AC%EB%A6%AC%ED%8A%B8_%ED%85%8D%EC%8A%A4%EC%B2%98.jpg'), linear-gradient(145deg, #242424, #0f0f0f)",
              backgroundBlendMode: "overlay",
              backgroundSize: "cover",
            }}
          >
            <motion.span
              className="absolute left-1/2 top-[15px] z-[2] h-[58px] w-[22px] -translate-x-1/2 rounded-[7px] border border-white/20"
              animate={{
                y: isVisible ? 24 : 0,
                rotate: isVisible ? -13 : 13,
                scale: isGlitching ? [1, 0.94, 1.03, 0.98, 1] : 1,
                boxShadow: isVisible
                  ? "inset 5px 0 8px rgba(255,255,255,0.42), inset -7px 0 10px rgba(0,0,0,0.62), 0 3px 5px rgba(0,0,0,0.65)"
                  : "inset 5px 0 8px rgba(255,255,255,0.35), inset -7px 0 10px rgba(0,0,0,0.72), 0 5px 8px rgba(0,0,0,0.72)",
              }}
              transition={isGlitching ? { duration: 0.3, times: [0, 0.22, 0.45, 0.7, 1] } : { type: "spring", stiffness: 620, damping: 18 }}
              style={{
                background: "linear-gradient(90deg, #3a3a3a 0%, #b9b9b9 22%, #f4f4f4 45%, #7b7b7b 72%, #242424 100%)",
                transformOrigin: "50% 50%",
              }}
            />
            <span className="absolute left-1/2 top-1/2 z-[1] h-[82px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-black/70 bg-black/45 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9),inset_0_-1px_0_rgba(255,255,255,0.06)]" />
          </motion.button>

          <motion.div
            className="relative flex flex-col items-center"
            animate={{
              scale: isTransitioning ? [1, 1.012, 1.035] : 1,
              filter: isTransitioning ? ["blur(0px)", "blur(0px)", "blur(4px)"] : "blur(0px)",
            }}
            transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 800, height: 400, zIndex: 2 }}
          >
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
          </motion.div>

          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={isTransitioning ? { opacity: [0, 0.38, 0.08, 0.24] } : { opacity: 0 }}
            transition={{ duration: 1.35, times: [0, 0.22, 0.55, 1], ease: "easeInOut" }}
            style={{
              background: "radial-gradient(circle at center, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.16) 18%, rgba(255,42,133,0.08) 36%, transparent 62%)",
              mixBlendMode: "screen",
              zIndex: 20,
            }}
          />

          <motion.div
            className="absolute left-1/2 top-1/2 pointer-events-none h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
            animate={isTransitioning ? { scale: [0.2, 2.6, 8], opacity: [0, 0.58, 0] } : { scale: 0.2, opacity: 0 }}
            transition={{ duration: 1.25, times: [0, 0.32, 1], ease: [0.16, 1, 0.3, 1] }}
            style={{ boxShadow: "0 0 28px rgba(255,255,255,0.42), inset 0 0 18px rgba(255,255,255,0.22)", zIndex: 21 }}
          />

          <motion.div
            className="absolute inset-y-0 pointer-events-none w-[38vw]"
            animate={isTransitioning ? { x: ["-45vw", "110vw"], opacity: [0, 0.42, 0] } : { x: "-45vw", opacity: 0 }}
            transition={{ delay: 0.28, duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 18%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0.04) 82%, transparent 100%)",
              filter: "blur(10px)",
              mixBlendMode: "screen",
              zIndex: 22,
            }}
          />

          <motion.div
            className="absolute inset-0 pointer-events-none bg-white"
            animate={isTransitioning ? { opacity: [0, 0, 0.22, 0] } : { opacity: 0 }}
            transition={{ delay: 0.72, duration: 0.78, times: [0, 0.28, 0.72, 1], ease: "easeInOut" }}
            style={{ zIndex: 23 }}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible && !isTransitioning ? [0, 0.5, 0] : 0 }}
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
