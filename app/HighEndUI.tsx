"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";

// ─── 1. Custom Cursor ────────────────────────────────────────────────────────
export function CustomCursor() {
  const cursorX = useMotionValue(-200);
  const cursorY = useMotionValue(-200);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  // Premium physics: swift but buttery smooth damping
  const springConfig = { damping: 28, stiffness: 300, mass: 0.2 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Only enable custom cursor on non-touch devices
    if (window.matchMedia("(pointer: fine)").matches) {
      setIsMobile(false);
    }

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      const target = e.target as HTMLElement;
      setIsHovering(
        !!(target.closest("button") || target.closest("a") || target.closest("input") || target.closest("[data-magnetic]"))
      );
    };

    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, [cursorX, cursorY]);

  if (isMobile) return null;

  return (
    <>
      <style>{`* { cursor: none !important; }`}</style>
      
      {/* Premium Glass Ring */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[9999] flex items-center justify-center overflow-hidden"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: "-50%",
          translateY: "-50%",
          width: isHovering ? 56 : 36,
          height: isHovering ? 56 : 36,
          backgroundColor: isHovering ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)",
          border: isHovering ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: isHovering 
            ? "0 10px 40px rgba(0, 0, 0, 0.12), inset 0 0 20px rgba(255, 255, 255, 0.15)" 
            : "0 4px 16px rgba(0, 0, 0, 0.08), inset 0 0 10px rgba(255, 255, 255, 0.05)",
          transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), height 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease, border 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {/* Subtle inner accent on hover */}
        <AnimatePresence>
          {isHovering && (
            <motion.div
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Crisp Center Dot */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[10000]"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          width: isHovering ? 0 : 5,
          height: isHovering ? 0 : 5,
          backgroundColor: "#ffffff",
          boxShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
          transition: "width 0.2s ease, height 0.2s ease",
        }}
      />
    </>
  );
}



// ─── 3. Magnetic Wrapper ─────────────────────────────────────────────────────
// Use as a <div> wrapper — does NOT add its own click handler
export function MagneticButton({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { damping: 12, stiffness: 120, mass: 0.1 });
  const ySpring = useSpring(y, { damping: 12, stiffness: 120, mass: 0.1 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.25);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.25);
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      data-magnetic
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: xSpring, y: ySpring, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── 4. 3D Parallax Tilt Card ────────────────────────────────────────────────
export function TiltCard({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 250, damping: 28 });
  const mouseYSpring = useSpring(y, { stiffness: 250, damping: 28 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);
  const glareOpacity = useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.15]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000, ...style }}
      className={className}
    >
      {/* Hologram Glare effect */}
      <motion.div
        className="absolute inset-0 rounded-3xl pointer-events-none z-10"
        style={{
          opacity: glareOpacity,
          background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, transparent 60%)",
        }}
      />
      <div style={{ transform: "translateZ(20px)" }}>
        {children}
      </div>
    </motion.div>
  );
}

// ─── 5. Kinetic Typography ───────────────────────────────────────────────────
export function KineticLoading({ isVisible }: { isVisible: boolean }) {
  const lines = ["3D", "MOOD"];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="kinetic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 pointer-events-none z-[50] flex flex-col items-center justify-center overflow-hidden"
        >
          {lines.map((line, i) => (
            <div key={line} className="overflow-hidden">
              <motion.div
                initial={{ y: "110%", skewY: 8 }}
                animate={{ y: "0%", skewY: 0 }}
                exit={{ y: "-110%", skewY: -8 }}
                transition={{
                  duration: 0.9,
                  delay: i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <h1
                  className="text-[18vw] font-black text-white tracking-tighter leading-none mix-blend-overlay select-none"
                  style={{ lineHeight: 0.85 }}
                >
                  {line}
                </h1>
              </motion.div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── 6. Docent Panel + Color Palette ─────────────────────────────────────────
export function DocentPanel({ preset, onCopy }: { preset: any; onCopy: (hex: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(hex);
    onCopy(hex);
    setTimeout(() => setCopied(null), 1800);
  };

  if (!preset) return null;

  // Deduplicate colors
  const colors = [...new Set([preset.gradientFrom, preset.gradientTo, preset.accentColor])] as string[];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={preset.id}
        initial={{ opacity: 0, x: -24, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -24, scale: 0.96 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-6 lg:bottom-16 left-[260px] z-[40] w-64 pointer-events-auto"
      >
        <TiltCard
          className="relative w-full p-5 rounded-3xl border border-white/[0.08] overflow-hidden"
          style={{ background: "rgba(8,8,8,0.72)", backdropFilter: "blur(28px)", boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${preset.accentColor}18` }}
        >
          {/* Subtle gradient line at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-3xl"
            style={{ background: `linear-gradient(90deg, ${preset.gradientFrom}, ${preset.gradientTo})` }}
          />

          {/* Heading */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{preset.emoji}</span>
              <h2
                className="text-lg font-light tracking-wider text-white"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif", textShadow: `0 0 24px ${preset.accentColor}60` }}
              >
                {preset.label.replace('#', '')}
              </h2>
            </div>
            <p
              className="text-[11px] text-zinc-400 leading-relaxed"
              style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}
            >
              &ldquo;{preset.description}&rdquo;
            </p>
          </div>

          <div className="h-px w-full mb-4" style={{ background: `linear-gradient(90deg, ${preset.accentColor}30, transparent)` }} />

          {/* Color palette */}
          <div>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3">Color Palette</p>
            <div className="flex gap-2">
              {colors.map((hex) => (
                <motion.button
                  key={hex}
                  whileHover={{ y: -5, scale: 1.1 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleCopy(hex)}
                  className="group relative flex-1 h-9 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: hex,
                    boxShadow: copied === hex ? `0 0 16px ${hex}90` : `0 4px 12px ${hex}40`,
                    border: `1px solid ${hex}60`,
                  }}
                >
                  {/* Hex tooltip */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 bg-white text-black text-[9px] font-mono font-bold rounded-lg shadow-2xl pointer-events-none">
                    {copied === hex ? "Copied! ✓" : hex.toUpperCase()}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </TiltCard>
      </motion.div>
    </AnimatePresence>
  );
}
