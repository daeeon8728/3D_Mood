"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// ─── 1. Custom Cursor ────────────────────────────────────────────────────────
export function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('input')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, [cursorX, cursorY]);

  return (
    <>
      {/* Outer Glow */}
      <motion.div
        className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999]"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: "-50%",
          translateY: "-50%",
          mixBlendMode: "difference",
          backgroundColor: isHovering ? "white" : "transparent",
          border: isHovering ? "none" : "1.5px solid white",
          scale: isHovering ? 1.5 : 1,
          transition: "scale 0.2s ease, background-color 0.2s ease",
        }}
      />
      {/* Inner Dot */}
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-white rounded-full pointer-events-none z-[9999]"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          mixBlendMode: "difference",
          opacity: isHovering ? 0 : 1,
        }}
      />
    </>
  );
}

// ─── 2. Film Noise ───────────────────────────────────────────────────────────
export function FilmNoise() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998] opacity-[0.03] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

// ─── 3. Magnetic Button ──────────────────────────────────────────────────────
export function MagneticButton({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    // Strength of magnetism
    x.set(distanceX * 0.2);
    y.set(distanceY * 0.2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: xSpring, y: ySpring }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// ─── 4. 3D Parallax Tilt Card ────────────────────────────────────────────────
export function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7.5deg", "-7.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7.5deg", "7.5deg"]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        ...style
      }}
      className={className}
    >
      <div style={{ transform: "translateZ(30px)" }}>
        {children}
      </div>
    </motion.div>
  );
}

// ─── 5. Kinetic Typography ───────────────────────────────────────────────────
export function KineticLoading({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute inset-0 pointer-events-none z-[50] flex items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ x: "-100%", skewX: "20deg" }}
        animate={{ x: isVisible ? "0%" : "100%", skewX: isVisible ? "0deg" : "-20deg" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute w-full h-full flex items-center justify-center mix-blend-overlay"
      >
        <h1 className="text-[15vw] font-black text-white whitespace-nowrap tracking-tighter" style={{ lineHeight: 0.8 }}>
          3D MOOD
        </h1>
      </motion.div>
    </motion.div>
  );
}

// ─── 6. Docent Panel / Color Palette ─────────────────────────────────────────
export function DocentPanel({ preset, onCopy }: { preset: any; onCopy: (hex: string) => void }) {
  if (!preset) return null;
  const colors = [preset.gradientFrom, preset.gradientTo, preset.accentColor];

  return (
    <TiltCard className="fixed bottom-8 left-8 z-[40] w-72 p-6 rounded-3xl border border-white/[0.08]" style={{ background: "rgba(10,10,10,0.6)", backdropFilter: "blur(24px)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
      {/* Serif Typography for Artistic Vibe */}
      <div className="mb-6 font-serif">
        <h2 className="text-2xl font-light tracking-wide text-white mb-2" style={{ textShadow: `0 0 20px ${preset.accentColor}80` }}>
          {preset.label.replace('#', '')}
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed italic">
          "{preset.description}"
        </p>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent mb-5" />

      {/* Color Palette Display */}
      <div>
        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Dominant Colors</p>
        <div className="flex gap-2">
          {colors.map((hex, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCopy(hex)}
              className="group relative w-10 h-10 rounded-xl cursor-pointer shadow-lg"
              style={{ backgroundColor: hex, border: `1px solid ${hex}40` }}
            >
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-white text-black text-[9px] font-mono font-bold rounded shadow-xl pointer-events-none">
                {hex.toUpperCase()}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}
