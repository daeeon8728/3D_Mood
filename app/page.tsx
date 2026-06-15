"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Production v7  (Spline Edition)
//  Spline 3D · Supabase · Glassmorphism · Framer Motion
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, Component,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Spline from "@splinetool/react-spline";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://ychptrhmedfjzairkzwh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sh92dIOhgb0wew25kly21w_xSLYWdko";
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Spline scene ─────────────────────────────────────────────────────────────
const SPLINE_SCENE = "https://prod.spline.design/6Wq1Q7YAnsnasGyT/scene.splinecode";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LightingState {
  intensity: number;
  color: string;
  autoRotate: boolean;
}
interface MoodPreset {
  id: string; label: string; emoji: string; description: string;
  lighting: LightingState; gradientFrom: string; gradientTo: string; accentColor: string;
}
interface GuestbookEntry {
  id?: number; name: string; content: string; color: string;
  created_at?: string; optimistic?: boolean;
}
interface CriticEntry {
  id?: number; name: string; x_coord: number; y_coord: number;
  category: string; comment: string; rating: number; created_at?: string;
}
interface PopoverState {
  visible: boolean; x: number; y: number; canvasX: number; canvasY: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "dawn",      label: "#Dawn",      emoji: "🌅", description: "Warm golden hour",
    lighting: { intensity: 75, color: "#FFB347", autoRotate: false },
    gradientFrom: "#FF6B35", gradientTo: "#FFB347", accentColor: "#FFB347",
  },
  {
    id: "cyberpunk", label: "#Cyberpunk", emoji: "⚡", description: "Neon dystopian glow",
    lighting: { intensity: 90, color: "#FF2079", autoRotate: true },
    gradientFrom: "#FF2079", gradientTo: "#00D4FF", accentColor: "#FF2079",
  },
  {
    id: "minimal",   label: "#Minimal",   emoji: "◻",  description: "Pure white gallery",
    lighting: { intensity: 55, color: "#F0F0F0", autoRotate: false },
    gradientFrom: "#E8E8E8", gradientTo: "#FFFFFF", accentColor: "#CCCCCC",
  },
  {
    id: "retrocity", label: "#RetroCity", emoji: "🌆", description: "80s sunset cityscape",
    lighting: { intensity: 82, color: "#A855F7", autoRotate: true },
    gradientFrom: "#7C3AED", gradientTo: "#F59E0B", accentColor: "#A855F7",
  },
];
const COLOR_SWATCHES   = ["#FFFFFF","#FFB347","#FF2079","#00D4FF","#A855F7","#4ADE80","#F59E0B","#FB923C"];
const GUESTBOOK_COLORS = ["#FEF3C7","#FCE7F3","#EDE9FE","#D1FAE5","#DBEAFE","#FEE2E2","#F3F4F6","#FFF7ED"];
const CRITIC_CATEGORIES= ["Lighting","Composition","Color Theory","Form & Shape","Texture","Mood","Technical"];

// ─── Motion Variants ──────────────────────────────────────────────────────────
const springFast = { type: "spring" as const, stiffness: 500, damping: 35 };
const drawerVariants = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 35 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22,1,0.36,1] as [number,number,number,number] },
  }),
};
const popoverVariants = {
  hidden:  { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1,  y: 0, transition: { type:"spring", stiffness:500, damping:30 } },
  exit:    { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function CriticModeSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button id="critic-mode-switch" onClick={onToggle} aria-label="Toggle Critic Mode"
      className="flex items-center gap-2 group">
      <span className="text-xs font-semibold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">
        Critic
      </span>
      <div className={`relative w-11 h-6 rounded-full border transition-colors duration-300 ${enabled ? "bg-white border-white" : "bg-zinc-800 border-zinc-700"}`}>
        <motion.div
          className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full ${enabled ? "bg-black" : "bg-zinc-500"}`}
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }} />
      </div>
    </button>
  );
}

function HamburgerButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button id="hamburger-btn" onClick={onClick} aria-label={isOpen ? "Close" : "Open"}
      className="w-10 h-10 flex items-center justify-center">
      <div className="w-6 h-6 relative flex flex-col justify-center items-center">
        <motion.span className="absolute h-[1.5px] w-6 bg-white origin-center"
          animate={isOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -5 }} transition={springFast as any} />
        <motion.span className="absolute h-[1.5px] w-6 bg-white"
          animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.2 }} />
        <motion.span className="absolute h-[1.5px] w-6 bg-white origin-center"
          animate={isOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 5 }} transition={springFast as any} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NAVIGATION DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function NavigationDrawer({ isOpen, activeSection, onScrollTo, onClose }:
  { isOpen: boolean; activeSection: string; onScrollTo: (id: string) => void; onClose: () => void }) {
  const navItems = [
    { id: "studio",    label: "3D Studio",      icon: "✦", desc: "Interactive Spline scene" },
    { id: "mood",      label: "Mood & Lighting", icon: "◎", desc: "Color & atmosphere" },
    { id: "guestbook", label: "Guestbook",       icon: "✉", desc: "Community notes" },
    { id: "feedback",  label: "Feedback",        icon: "◈", desc: "Critic dashboard" },
  ];
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="backdrop" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <motion.aside key="drawer" className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col overflow-y-auto"
            style={{ background:"#fff" }} variants={drawerVariants as any} initial="hidden" animate="visible" exit="exit">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-zinc-100">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Navigation</p>
                <p className="text-xl font-bold text-black mt-0.5">3D Mood</p>
              </div>
              <button id="drawer-close-btn" onClick={onClose}
                className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <span className="text-black text-xl leading-none">×</span>
              </button>
            </div>
            <div className="px-6 py-6 border-b border-zinc-100">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="font-bold text-sm text-black mb-1">Free Mode Active</p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Explore the 3D scene, set the mood, leave notes, and critique designs — no sign-in needed.
                </p>
              </div>
            </div>
            <nav className="px-6 py-6 flex-1">
              <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 mb-3">Spaces</p>
              <div className="space-y-1">
                {navItems.map(({ id, label, icon, desc }) => (
                  <motion.button key={id} id={`nav-${id}`}
                    onClick={() => { onScrollTo(id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${activeSection===id?"bg-black text-white":"text-zinc-700 hover:bg-zinc-50"}`}
                    whileHover={{ x:4 }} whileTap={{ scale:0.98 }}
                    transition={{ type:"spring", stiffness:600, damping:40 }}>
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{label}</p>
                      <p className="text-xs mt-0.5 text-zinc-400">{desc}</p>
                    </div>
                    {activeSection===id && <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />}
                  </motion.button>
                ))}
              </div>
            </nav>
            <div className="px-6 py-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-300 text-center">© 2026 3D Mood · Powered by Spline</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SPLINE HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────
function SplineHero({ lighting, onLightingChange, criticMode, onCanvasClick }:
  { lighting: LightingState; onLightingChange: (l: LightingState) => void;
    criticMode: boolean; onCanvasClick: (x: number, y: number, cx: number, cy: number) => void }) {

  const containerRef = useRef<HTMLDivElement>(null);
  const splineAppRef = useRef<any>(null);
  const [isLoaded,    setIsLoaded]    = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // SSR guard
  useEffect(() => { setMounted(true); }, []);

  // ── Spline onLoad: cache the app reference ────────────────────────────────
  const handleSplineLoad = useCallback((app: any) => {
    splineAppRef.current = app;
    setIsLoaded(true);

    // Attempt to set initial variables (scene-specific names)
    try {
      app.setVariable?.("Intensity",   lighting.intensity / 100);
      app.setVariable?.("LightColor",  lighting.color);
      app.setVariable?.("AutoRotate",  lighting.autoRotate);
    } catch (_) { /* scene may not expose these variables — visual CSS fallback covers it */ }
  }, []);

  // ── Sync lighting state → Spline API + CSS ─────────────────────────────────
  useEffect(() => {
    const app = splineAppRef.current;
    if (!app) return;
    try {
      // Try common Spline variable names — if the scene doesn't have them it's a no-op
      app.setVariable?.("Intensity",   lighting.intensity / 100);
      app.setVariable?.("LightColor",  lighting.color);
      app.setVariable?.("AutoRotate",  lighting.autoRotate);

      // Try to find light objects by common names and set their properties
      const lightObj = app.findObjectByName?.("DirectionalLight")
                    ?? app.findObjectByName?.("SpotLight")
                    ?? app.findObjectByName?.("PointLight")
                    ?? app.findObjectByName?.("Light");
      if (lightObj) {
        if (lightObj.intensity  !== undefined) lightObj.intensity  = lighting.intensity / 100 * 2;
        if (lightObj.color?.set) lightObj.color.set(lighting.color);
      }
    } catch (_) { /* silently ignore — CSS overlay provides visual feedback */ }
  }, [lighting]);

  // ── Auto-rotate: CSS animation fallback ───────────────────────────────────
  // (Spline handles it natively if onLoad worked; CSS is the visual safety net)
  const rotateStyle = lighting.autoRotate
    ? { animation: "splineRotate 12s linear infinite" } : {};

  // ── Critic click capture ───────────────────────────────────────────────────
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!criticMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left)  / rect.width)  * 100);
    const y = Math.round(((e.clientY - rect.top)   / rect.height) * 100);
    onCanvasClick(x, y, e.clientX, e.clientY);
  };

  // Derived CSS values from lighting state
  const brightness  = (0.4 + (lighting.intensity / 100) * 1.0).toFixed(2); // 0.4 → 1.4
  const overlayHex  = lighting.color;
  const overlayAlpha= Math.round((lighting.intensity / 100) * 0.18 * 255).toString(16).padStart(2,"0");
  const glowHex     = lighting.color;
  const glowAlpha   = Math.round((lighting.intensity / 100) * 0.7 * 255).toString(16).padStart(2,"0");

  const toolBtnCls = (active: boolean, ac: string) =>
    `px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${active ? ac : "bg-white/5 text-zinc-500 hover:bg-white/12 hover:text-white border-white/10"}`;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#030303]">
      {/* ── CSS keyframe for auto-rotate fallback ── */}
      <style>{`
        @keyframes splineRotate { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
      `}</style>

      {/* ── Color/brightness overlay (lighting simulation) ── */}
      <div className="absolute inset-0 pointer-events-none z-10 transition-all duration-700"
        style={{
          background: `${overlayHex}${overlayAlpha}`,
          filter:      `brightness(${brightness})`,
          mixBlendMode:"screen",
        }} />

      {/* ── Edge glow wings ── */}
      <div className="absolute inset-0 pointer-events-none z-[11] transition-all duration-700" style={{
        background: `radial-gradient(ellipse 110% 90% at 50% 0%, ${glowHex}${glowAlpha} 0%, ${glowHex}22 35%, transparent 68%)`,
      }} />
      <div className="absolute top-0 left-0 h-full w-[45%] pointer-events-none z-[11]" style={{
        background: `radial-gradient(ellipse 100% 80% at 0% 45%, ${glowHex}${Math.round(parseInt(glowAlpha,16)*0.45).toString(16).padStart(2,"0")} 0%, transparent 70%)`,
      }} />
      <div className="absolute top-0 right-0 h-full w-[45%] pointer-events-none z-[11]" style={{
        background: `radial-gradient(ellipse 100% 80% at 100% 45%, ${glowHex}${Math.round(parseInt(glowAlpha,16)*0.45).toString(16).padStart(2,"0")} 0%, transparent 70%)`,
      }} />

      {/* ── Spline viewer ── */}
      <div ref={containerRef}
        className="absolute inset-0 z-0 transition-all duration-1000"
        style={{ filter: `brightness(${brightness})` }}>
        {mounted && (
          <Spline
            scene={SPLINE_SCENE}
            onLoad={handleSplineLoad}
            style={{ width:"100%", height:"100%", display:"block" }}
          />
        )}
        {/* Loading skeleton */}
        <AnimatePresence>
          {(!isLoaded || !mounted) && (
            <motion.div key="loading" className="absolute inset-0 flex flex-col items-center justify-center bg-[#030303] z-20"
              initial={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.8 }}>
              <motion.div className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center mb-6"
                style={{ background: `${glowHex}18` }}
                animate={{ scale:[1,1.08,1], opacity:[0.5,1,0.5] }}
                transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}>
                <span className="text-xl">✦</span>
              </motion.div>
              <p className="text-sm font-semibold text-white/50 tracking-widest uppercase">Loading 3D Scene…</p>
              <div className="mt-4 w-32 h-px bg-white/5 overflow-hidden rounded-full">
                <motion.div className="h-full rounded-full"
                  style={{ background:`linear-gradient(90deg, ${glowHex}40, ${glowHex})` }}
                  animate={{ x:["-100%","100%"] }} transition={{ duration:1.4, repeat:Infinity, ease:"easeInOut" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Critic mode — transparent click capture overlay ── */}
      {criticMode && (
        <div className="absolute inset-0 z-20 cursor-crosshair" onClick={handleOverlayClick}>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/35 backdrop-blur-md pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] font-bold text-red-400 tracking-wider">CRITIC MODE — Click anywhere to annotate</span>
          </div>
        </div>
      )}

      {/* ── Right panel: mood presets + controls ── */}
      <div className="absolute top-20 right-5 z-30 w-[220px] flex flex-col gap-3 pointer-events-auto">
        {/* Mood presets */}
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.4, duration:0.6, ease:[0.22,1,0.36,1] }}
          className="rounded-2xl overflow-hidden border border-white/[0.07]"
          style={{ background:"rgba(8,8,8,0.72)", backdropFilter:"blur(24px)" }}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Mood Presets</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MOOD_PRESETS.map((p) => (
                <motion.button key={p.id} id={`preset-${p.id}`}
                  onClick={() => { setActivePreset(p.id); onLightingChange(p.lighting); }}
                  className="relative flex flex-col items-start px-2.5 py-2 rounded-xl transition-all border text-left"
                  style={{
                    background: activePreset===p.id ? `linear-gradient(135deg,${p.gradientFrom}22,${p.gradientTo}14)` : "rgba(255,255,255,0.02)",
                    borderColor: activePreset===p.id ? p.accentColor+"45" : "rgba(255,255,255,0.05)",
                    boxShadow:   activePreset===p.id ? `0 0 18px ${p.accentColor}18` : "none",
                  }}
                  whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}>
                  <span className="text-lg leading-tight">{p.emoji}</span>
                  <span className="text-[9px] font-bold mt-1 leading-none" style={{ color:activePreset===p.id?p.accentColor:"#aaa" }}>
                    {p.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 h-px bg-white/[0.05]" />

          {/* Spotlight color */}
          <div className="px-4 pb-3">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Light Color</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button key={c} onClick={() => onLightingChange({ ...lighting, color:c })}
                  className="w-6 h-6 rounded-lg transition-all hover:scale-110 flex-shrink-0"
                  style={{ background:c, boxShadow:lighting.color===c?`0 0 0 2px rgba(255,255,255,0.9), 0 0 12px ${c}80`:`0 0 0 1px rgba(255,255,255,0.08)`, transform:lighting.color===c?"scale(1.18)":"scale(1)" }} />
              ))}
            </div>
          </div>

          <div className="mx-4 my-2 h-px bg-white/[0.05]" />

          {/* Intensity slider */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Intensity</p>
              <span className="text-[9px] font-mono" style={{ color:lighting.color }}>{lighting.intensity}%</span>
            </div>
            <input type="range" min={10} max={100} value={lighting.intensity}
              onChange={(e) => onLightingChange({ ...lighting, intensity:parseInt(e.target.value) })}
              className="w-full h-1 accent-white cursor-pointer" />
            <div className="h-1 rounded-full bg-white/[0.04] mt-2 overflow-hidden">
              <motion.div className="h-full rounded-full"
                animate={{ width:`${((lighting.intensity-10)/90)*100}%` }}
                style={{ background:`linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
            </div>
          </div>

          <div className="mx-4 mb-2 h-px bg-white/[0.05]" />

          {/* Auto-rotate toggle */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Auto Rotate</p>
            <button onClick={() => onLightingChange({ ...lighting, autoRotate:!lighting.autoRotate })}
              className={`relative w-10 h-5 rounded-full border transition-colors duration-300 ${lighting.autoRotate?"bg-white border-white":"bg-zinc-800 border-zinc-700"}`}>
              <motion.div className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full ${lighting.autoRotate?"bg-black":"bg-zinc-500"}`}
                animate={{ x: lighting.autoRotate ? 20 : 0 }}
                transition={{ type:"spring", stiffness:600, damping:35 }} />
            </button>
          </div>
        </motion.div>

        {/* Status badge */}
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.6 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06]"
          style={{ background:"rgba(8,8,8,0.65)", backdropFilter:"blur(16px)" }}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLoaded?"bg-emerald-400 animate-pulse":"bg-yellow-500 animate-ping"}`} />
          <span className="text-[9px] font-semibold text-zinc-500">{isLoaded?"Scene loaded · Spline":"Loading scene…"}</span>
        </motion.div>
      </div>

      {/* ── Bottom scroll hint ── */}
      <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none"
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.8 }}>
        <span className="text-[10px] text-white/20 tracking-widest uppercase font-semibold">Scroll</span>
        <motion.div animate={{ y:[0,6,0] }} transition={{ duration:1.8, repeat:Infinity, ease:"easeInOut" }}
          className="w-[1px] h-8 rounded-full"
          style={{ background:`linear-gradient(to bottom, ${glowHex}50, transparent)` }} />
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-[12]"
        style={{ background:"linear-gradient(to bottom, transparent, #000)" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOOD SECTION (scrolled)
// ─────────────────────────────────────────────────────────────────────────────
function MoodSection({ lighting, onChange, sectionRef }:
  { lighting: LightingState; onChange: (l: LightingState) => void; sectionRef: React.RefObject<HTMLElement | null> }) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const update = (key: keyof LightingState, value: any) => onChange({ ...lighting, [key]: value });

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="mood" className="relative bg-black py-24 px-6 lg:px-16">
      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none" style={{ background:"linear-gradient(to bottom, #000, transparent)" }} />
      <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }} variants={fadeUp as any} custom={0}
        className="max-w-6xl mx-auto mb-16">
        <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 02</p>
        <h2 className="text-4xl lg:text-5xl font-bold text-white">Set the Mood</h2>
        <p className="text-zinc-500 mt-3 text-lg">Shape the atmosphere of your 3D scene.</p>
      </motion.div>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Mood presets grid */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-6">Mood Presets</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {MOOD_PRESETS.map((preset, i) => {
              const isActive = activePreset === preset.id;
              return (
                <motion.button key={preset.id} id={`mood-${preset.id}`}
                  initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-50px" }}
                  variants={fadeUp as any} custom={i}
                  onClick={() => { setActivePreset(preset.id); onChange(preset.lighting); }}
                  className="relative rounded-2xl p-5 text-left border transition-all duration-300 overflow-hidden"
                  style={{ background:isActive?`linear-gradient(135deg,${preset.gradientFrom}25,${preset.gradientTo}15)`:"rgba(255,255,255,0.02)", borderColor:isActive?preset.accentColor+"50":"rgba(255,255,255,0.05)", boxShadow:isActive?`0 0 30px ${preset.accentColor}18`:"none" }}
                  whileHover={{ scale:1.02, y:-3 }} whileTap={{ scale:0.98 }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background:`linear-gradient(90deg,${preset.gradientFrom},${preset.gradientTo})`, opacity:isActive?1:0.3 }} />
                  <span className="text-3xl block mb-3">{preset.emoji}</span>
                  <p className="font-bold text-sm" style={{ color:isActive?preset.accentColor:"#fff" }}>{preset.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{preset.description}</p>
                  {isActive && (
                    <motion.div initial={{ opacity:0, scale:0 }} animate={{ opacity:1, scale:1 }}
                      className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:preset.accentColor+"25", color:preset.accentColor }}>ACTIVE</motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Color + Intensity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={0}>
            <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-5">Light Color</p>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <motion.button key={c} onClick={() => update("color", c)}
                  className="relative rounded-2xl transition-all duration-200"
                  style={{ width:"52px", height:"52px", background:c, boxShadow:lighting.color===c?`0 0 20px ${c}80, 0 0 0 3px rgba(255,255,255,0.9)`:`0 0 0 1px rgba(255,255,255,0.06)`, transform:lighting.color===c?"scale(1.15)":"scale(1)" }}
                  whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}>
                  {lighting.color===c && (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                      className="absolute inset-0 rounded-2xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full"
                        style={{ background:c==="#FFFFFF"||c==="#F0F0F0"?"#000":"#fff" }} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={1}
            className="p-6 rounded-2xl border border-white/[0.05]" style={{ background:"rgba(255,255,255,0.02)" }}>
            <div className="flex justify-between mb-4">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Intensity</label>
              <span className="text-xs font-mono" style={{ color:lighting.color }}>{lighting.intensity}%</span>
            </div>
            <input type="range" min={10} max={100} value={lighting.intensity}
              onChange={(e) => update("intensity", parseInt(e.target.value))} className="w-full mb-3" />
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full"
                animate={{ width:`${((lighting.intensity-10)/90)*100}%` }}
                style={{ background:`linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
            </div>
            <div className="flex items-center justify-between mt-5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Auto Rotate</label>
              <button onClick={() => update("autoRotate", !lighting.autoRotate)}
                className={`relative w-11 h-6 rounded-full border transition-colors duration-300 ${lighting.autoRotate?"bg-white border-white":"bg-zinc-800 border-zinc-700"}`}>
                <motion.div className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full ${lighting.autoRotate?"bg-black":"bg-zinc-500"}`}
                  animate={{ x: lighting.autoRotate ? 20 : 0 }}
                  transition={{ type:"spring", stiffness:600, damping:35 }} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background:"linear-gradient(to bottom, transparent, #030303)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GUESTBOOK  — select * · order by id (no created_at assumed)
// ─────────────────────────────────────────────────────────────────────────────
function GuestbookSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [entries,    setEntries]    = useState<GuestbookEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState({ name:"", content:"", color:GUESTBOOK_COLORS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [fetchErr,   setFetchErr]   = useState<string | null>(null);

  // ── READ: 마운트 즉시 전체 fetch ──────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setFetchErr(null);
    try {
      const { data, error } = await supabase
        .from("guestbook")
        .select("*")
        .order("id", { ascending: false })  // created_at 컬럼 없으므로 id 사용
        .limit(100);
      if (error) throw new Error(error.message);
      setEntries((data as GuestbookEntry[]) ?? []);
    } catch (err: any) {
      console.error("[Guestbook] fetch:", err);
      setFetchErr(err?.message ?? "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    // Realtime: INSERT 이벤트 수신
    const ch = supabase.channel("guestbook-rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"guestbook" }, (payload) => {
        setEntries((prev) => {
          // optimistic 항목 교체
          if (prev.some(e => e.optimistic)) return prev.map(e => e.optimistic ? (payload.new as GuestbookEntry) : e);
          // 중복 방지
          if (prev.some(e => e.id === (payload.new as any).id)) return prev;
          return [payload.new as GuestbookEntry, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchEntries]);

  // ── WRITE ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setSubmitting(true); setError(null);

    // Optimistic UI
    const optimistic: GuestbookEntry = {
      id: Date.now(), name: form.name.trim(), content: form.content.trim(),
      color: form.color, optimistic: true,
    };
    setEntries(prev => [optimistic, ...prev]);
    const snap = { ...form };
    setForm({ name:"", content:"", color:GUESTBOOK_COLORS[0] });

    try {
      // id, created_at 절대 포함하지 않음 (Supabase 자동 생성)
      const { error: dbErr } = await supabase
        .from("guestbook")
        .insert({ name: snap.name.trim(), content: snap.content.trim(), color: snap.color });
      if (dbErr) throw new Error(dbErr.message);
      setEntries(prev => prev.map(e => e.optimistic ? { ...e, optimistic:false } : e));
    } catch (err: any) {
      setError(err?.message ?? "Save failed. Please retry.");
      setEntries(prev => prev.filter(e => !e.optimistic));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="guestbook"
      className="relative py-24 px-6 lg:px-16" style={{ background:"#030303" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }}
          variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 03</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">Guestbook</h2>
          <p className="text-zinc-500 mt-3 text-lg">Notes from 3D designers worldwide.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
          {/* Notes grid */}
          <div>
            {fetchErr && (
              <div className="mb-4 px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-xl text-sm text-red-400 flex items-center justify-between">
                <span>⚠ {fetchErr}</span>
                <button onClick={fetchEntries} className="ml-4 text-xs underline hover:no-underline shrink-0">Retry</button>
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length:6 }).map((_,i) => (
                  <div key={i} className="aspect-square rounded-2xl animate-pulse"
                    style={{ background:GUESTBOOK_COLORS[i%8]+"30" }} />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-6xl mb-4">✉</p>
                <p className="text-zinc-400 font-semibold">No notes yet</p>
                <p className="text-zinc-600 text-sm mt-1">Be the first to leave a message</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <AnimatePresence>
                  {entries.map((entry, i) => (
                    <motion.div key={entry.id ?? i}
                      initial={{ opacity:0, scale:0.8, rotate:-2 }}
                      animate={{ opacity:1, scale:1, rotate:0 }}
                      transition={{ type:"spring", stiffness:350, damping:28, delay:Math.min(i*0.04,0.25) }}
                      className="rounded-2xl p-4 flex flex-col justify-between min-h-[140px] relative overflow-hidden"
                      style={{ background: entry.color }}
                      whileHover={{ scale:1.03, rotate:0.5, y:-2 }}>
                      {entry.optimistic && (
                        <div className="absolute inset-0 bg-white/40 flex items-center justify-center rounded-2xl">
                          <span className="w-5 h-5 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <p className="text-zinc-800 text-sm leading-relaxed font-medium line-clamp-4">{entry.content}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs font-bold text-zinc-600">{entry.name}</p>
                        {entry.created_at && (
                          <p className="text-[10px] text-zinc-500">
                            {new Date(entry.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Submit form */}
          <motion.form onSubmit={handleSubmit}
            initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={1}
            className="rounded-2xl p-6 space-y-4 sticky top-24"
            style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <h3 className="font-bold text-white mb-0.5">Leave a note</h3>
              <p className="text-xs text-zinc-500">Your message to the world</p>
            </div>
            {error && (
              <div className="px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
            )}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Name</label>
              <input type="text" value={form.name} maxLength={50} placeholder="Your nickname"
                onChange={(e) => setForm({...form, name:e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Message</label>
              <textarea value={form.content} maxLength={280} rows={4} placeholder="Leave a thoughtful note..."
                onChange={(e) => setForm({...form, content:e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Note Color</label>
              <div className="flex gap-2 flex-wrap">
                {GUESTBOOK_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({...form, color:c})}
                    className="w-7 h-7 rounded-lg transition-all hover:scale-110"
                    style={{ background:c, boxShadow:form.color===c?"0 0 0 2px #fff":"none" }} />
                ))}
              </div>
            </div>
            <motion.button type="submit"
              disabled={submitting||!form.name.trim()||!form.content.trim()}
              className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}>
              {submitting ? "Posting…" : "Post Note ✉"}
            </motion.button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEEDBACK DASHBOARD  — select * · order by id
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [critics, setCritics] = useState<CriticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchCritics = useCallback(async () => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from("critics")
        .select("*")
        .order("id", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      setCritics((data as CriticEntry[]) ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCritics();
    const ch = supabase.channel("critics-rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"critics" }, (payload) => {
        setCritics(prev => {
          if (prev.some(c => c.id === (payload.new as any).id)) return prev;
          return [payload.new as CriticEntry, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCritics]);

  const avgRating = critics.length > 0
    ? (critics.reduce((a,c) => a+c.rating,0)/critics.length).toFixed(1) : "—";
  const topCat = Object.entries(critics.reduce((acc:Record<string,number>,c) => {
    acc[c.category]=(acc[c.category]||0)+1; return acc;
  },{})).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—";

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="feedback"
      className="relative py-24 px-6 lg:px-16 pb-32" style={{ background:"#050505" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }}
          variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 04</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">Feedback Dashboard</h2>
          <p className="text-zinc-500 mt-3 text-lg">Critic annotations from the 3D studio canvas.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label:"Total Reviews", value:critics.length.toString(), icon:"◈", color:"#A855F7" },
            { label:"Avg Rating",    value:avgRating,                 icon:"★", color:"#FBBF24" },
            { label:"Top Category",  value:topCat,                    icon:"▲", color:"#4ADE80" },
            { label:"Realtime",      value:"Live",                    icon:"◉", color:"#FB923C" },
          ].map((s,i) => (
            <motion.div key={s.label} initial="hidden" whileInView="visible" viewport={{ once:true }}
              variants={fadeUp as any} custom={i}
              className="rounded-2xl p-5 border border-white/[0.04]" style={{ background:"rgba(255,255,255,0.02)" }}>
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className="text-3xl font-bold font-mono" style={{ color:s.color }}>{s.value}</p>
              <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }}
          variants={fadeUp as any} custom={0}
          className="rounded-2xl overflow-hidden border border-white/[0.05]" style={{ background:"rgba(255,255,255,0.015)" }}>
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Design Evaluations</h3>
            <button onClick={fetchCritics}
              className="text-xs text-zinc-600 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">↻ Refresh</button>
          </div>
          {error && <div className="px-6 py-4 text-sm text-red-400 bg-red-900/10">{error}</div>}
          {loading
            ? <div className="px-6 py-16 text-center text-zinc-700 text-sm">Loading…</div>
            : critics.length === 0
              ? <div className="px-6 py-20 text-center"><p className="text-4xl mb-3">◈</p><p className="text-zinc-500 text-sm font-medium">No evaluations yet</p></div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        {["ID","Name","Pos","Category","Comment","Rating"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {critics.map(c => (
                          <motion.tr key={c.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                            className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                            <td className="px-5 py-3 text-zinc-700 font-mono text-xs">#{c.id}</td>
                            <td className="px-5 py-3 text-white font-bold text-xs">{c.name||"Anon"}</td>
                            <td className="px-5 py-3 text-zinc-500 font-mono text-xs">({c.x_coord},{c.y_coord})</td>
                            <td className="px-5 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-zinc-300">{c.category}</span></td>
                            <td className="px-5 py-3 text-zinc-300 text-xs max-w-[200px] truncate">{c.comment}</td>
                            <td className="px-5 py-3 text-xs">
                              <span className="text-yellow-400">{"★".repeat(c.rating)}</span>
                              <span className="text-zinc-800">{"★".repeat(5-c.rating)}</span>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )
          }
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRITIC POPOVER
// ─────────────────────────────────────────────────────────────────────────────
function CriticPopover({ popover, onClose, onSubmit }:
  { popover: PopoverState; onClose: () => void; onSubmit: (d: Omit<CriticEntry,"id"|"created_at">) => Promise<void> }) {
  const [form,  setForm]  = useState({ name:"", category:CRITIC_CATEGORIES[0], comment:"", rating:3 });
  const [sub,   setSub]   = useState(false);
  const [hover, setHover] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()||!form.comment.trim()) return;
    setSub(true);
    try {
      await onSubmit({ name:form.name.trim(), x_coord:popover.canvasX, y_coord:popover.canvasY, category:form.category, comment:form.comment.trim(), rating:form.rating });
      setForm({ name:"", category:CRITIC_CATEGORIES[0], comment:"", rating:3 });
      onClose();
    } catch {} finally { setSub(false); }
  };

  const left = typeof window!=="undefined" ? Math.min(popover.x, window.innerWidth-295)  : popover.x;
  const top  = typeof window!=="undefined" ? Math.min(popover.y, window.innerHeight-440) : popover.y;

  return (
    <motion.div key="critic-popover" variants={popoverVariants as any} initial="hidden" animate="visible" exit="exit"
      className="fixed z-50 w-72 rounded-2xl overflow-hidden shadow-2xl"
      style={{ left, top, background:"rgba(8,8,8,0.97)", border:"1px solid rgba(255,255,255,0.1)", backdropFilter:"blur(24px)" }}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <p className="text-xs font-bold text-white">Critic Review</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono">{popover.canvasX}%, {popover.canvasY}%</span>
            <button type="button" onClick={onClose} className="text-zinc-600 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label:"Nickname", type:"text", key:"name",    placeholder:"Your name",        max:30 },
            { label:"Comment",  type:"area", key:"comment", placeholder:"Share thoughts…",  max:300 },
          ].map(({ label, type, key, placeholder, max }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">{label}</label>
              {type==="area"
                ? <textarea value={(form as any)[key]} rows={3} maxLength={max} placeholder={placeholder}
                    onChange={(e) => setForm({...form,[key]:e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                    style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }} />
                : <input type="text" value={(form as any)[key]} maxLength={max} placeholder={placeholder}
                    onChange={(e) => setForm({...form,[key]:e.target.value})}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20"
                    style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }} />
              }
            </div>
          ))}
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Category</label>
            <select value={form.category} onChange={(e) => setForm({...form,category:e.target.value})}
              className="w-full px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {CRITIC_CATEGORIES.map(c => <option key={c} value={c} style={{ background:"#0a0a0a" }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Rating</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(star => (
                <button key={star} type="button"
                  onClick={() => setForm({...form,rating:star})}
                  onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
                  className="text-2xl leading-none transition-transform hover:scale-125"
                  style={{ color:star<=(hover||form.rating)?"#FBBF24":"#27272a" }}>★</button>
              ))}
            </div>
          </div>
          <motion.button type="submit"
            disabled={sub||!form.name.trim()||!form.comment.trim()}
            className="w-full py-2.5 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}>
            {sub ? "Submitting…" : "Submit Review"}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT APPLICATION
// ─────────────────────────────────────────────────────────────────────────────
export default function ThreeDMoodApp() {
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [criticMode,    setCriticMode]    = useState(false);
  const [activeSection, setActiveSection] = useState("studio");
  const [lighting,      setLighting]      = useState<LightingState>({
    intensity: 70, color: "#FFFFFF", autoRotate: false,
  });
  const [popover, setPopover] = useState<PopoverState>({ visible:false, x:0, y:0, canvasX:0, canvasY:0 });

  const studioRef    = useRef<HTMLElement | null>(null);
  const moodRef      = useRef<HTMLElement | null>(null);
  const guestbookRef = useRef<HTMLElement | null>(null);
  const feedbackRef  = useRef<HTMLElement | null>(null);

  // Intersection observer for active section
  useEffect(() => {
    const refs = [
      { id:"studio",    ref:studioRef },
      { id:"mood",      ref:moodRef },
      { id:"guestbook", ref:guestbookRef },
      { id:"feedback",  ref:feedbackRef },
    ];
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          const f = refs.find(r => r.ref.current === e.target);
          if (f) setActiveSection(f.id);
        }
      }),
      { rootMargin:"-40% 0px -40% 0px", threshold:0 }
    );
    refs.forEach(({ ref }) => { if (ref.current) observer.observe(ref.current); });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const map: Record<string,React.RefObject<HTMLElement|null>> = {
      studio:studioRef, mood:moodRef, guestbook:guestbookRef, feedback:feedbackRef,
    };
    map[id]?.current?.scrollIntoView({ behavior:"smooth", block:"start" });
  };

  const handleCriticSubmit = async (data: Omit<CriticEntry,"id"|"created_at">) => {
    // id, created_at 제외 — Supabase 자동 생성
    const { error } = await supabase.from("critics").insert({
      name:     data.name,
      x_coord:  data.x_coord,
      y_coord:  data.y_coord,
      category: data.category,
      comment:  data.comment,
      rating:   data.rating,
    });
    if (error) throw new Error(error.message);
  };

  const navLabels: Record<string,string> = {
    studio:"3D Studio", mood:"Mood", guestbook:"Guestbook", feedback:"Feedback",
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      {/* ── Fixed Header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-6 lg:px-10"
        style={{ background:"rgba(0,0,0,0.78)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        <motion.button onClick={() => scrollToSection("studio")}
          initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
          className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black text-xs font-black">3D</span>
          </div>
          <span className="font-bold tracking-tight text-white text-lg">3D Mood</span>
          <span className="hidden sm:block text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">for designers</span>
        </motion.button>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}
          className="hidden lg:flex items-center gap-2">
          {["studio","mood","guestbook","feedback"].map(id => (
            <button key={id} onClick={() => scrollToSection(id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 group"
              style={{ background:activeSection===id?"rgba(255,255,255,0.08)":"transparent" }}>
              <span className="rounded-full transition-all duration-300"
                style={{ width:activeSection===id?"6px":"4px", height:activeSection===id?"6px":"4px", background:activeSection===id?"#fff":"rgba(255,255,255,0.2)" }} />
              <span className={`text-[10px] font-semibold transition-all duration-300 ${activeSection===id?"text-white opacity-100":"text-zinc-600 opacity-0 group-hover:opacity-100"}`}>
                {navLabels[id]}
              </span>
            </button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
          className="flex items-center gap-3">
          <CriticModeSwitch enabled={criticMode}
            onToggle={() => { setCriticMode(!criticMode); if (!criticMode) scrollToSection("studio"); }} />
          <HamburgerButton isOpen={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)} />
        </motion.div>
      </header>

      <NavigationDrawer isOpen={drawerOpen} activeSection={activeSection}
        onScrollTo={scrollToSection} onClose={() => setDrawerOpen(false)} />

      {/* ── 3D Studio (Spline) ── */}
      <section ref={studioRef} id="studio" className="relative" style={{ height:"100vh" }}>
        <div className="sticky top-16 w-full" style={{ height:"calc(100vh - 64px)" }}>
          <SplineHero
            lighting={lighting}
            onLightingChange={setLighting}
            criticMode={criticMode}
            onCanvasClick={(x,y,cx,cy) => {
              if (criticMode) setPopover({ visible:true, x:cx+12, y:cy-20, canvasX:x, canvasY:y });
            }}
          />
        </div>
      </section>

      <MoodSection      lighting={lighting} onChange={setLighting} sectionRef={moodRef} />
      <GuestbookSection sectionRef={guestbookRef} />
      <FeedbackSection  sectionRef={feedbackRef} />

      <AnimatePresence>
        {popover.visible && (
          <CriticPopover key="popover" popover={popover}
            onClose={() => setPopover(p => ({...p, visible:false}))}
            onSubmit={handleCriticSubmit} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/[0.03] px-6 lg:px-10 py-8" style={{ background:"#050505" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-[9px] font-black">3D</span>
            </div>
            <span>© 2026 3D Mood · Free Mode</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Spline Powered
            </span>
            <span className="text-zinc-800">·</span>
            <span>Built for 3D designers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
