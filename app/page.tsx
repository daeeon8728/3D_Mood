"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Free Mode Version
//  Single-page scroll: Hero Canvas → Mood/Lighting → Guestbook → Feedback
//  WebGL 3D Integration via React Three Fiber
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
  DragEvent, ChangeEvent, Suspense,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── 3D ENGINE IMPORTS ────────────────────────────────────────────────────────
import * as THREE from "three";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";
import { OBJLoader } from "three-stdlib";

// ─── Supabase — hardcoded per spec (publishable anon key, safe for frontend) ──
const SUPABASE_URL = "https://ychptrhmedfjzairkzwh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sh92dIOhgb0wew25kly21w_xSLYWdko";
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────
type LightDir = "top" | "front" | "back" | "left" | "right";

interface LightingState {
  intensity: number;
  color: string;
  angle: number;
  direction: LightDir;
}
interface MoodPreset {
  id: string; label: string; emoji: string; description: string;
  lighting: LightingState;
  gradientFrom: string; gradientTo: string; accentColor: string;
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
    id: "dawn", label: "#Dawn", emoji: "🌅", description: "Warm golden hour",
    lighting: { intensity: 75, color: "#FFB347", angle: 35, direction: "top" },
    gradientFrom: "#FF6B35", gradientTo: "#FFB347", accentColor: "#FFB347",
  },
  {
    id: "cyberpunk", label: "#Cyberpunk", emoji: "⚡", description: "Neon dystopian glow",
    lighting: { intensity: 90, color: "#FF2079", angle: 20, direction: "front" },
    gradientFrom: "#FF2079", gradientTo: "#00D4FF", accentColor: "#FF2079",
  },
  {
    id: "minimal", label: "#Minimal", emoji: "◻", description: "Pure white gallery",
    lighting: { intensity: 60, color: "#F0F0F0", angle: 90, direction: "top" },
    gradientFrom: "#E8E8E8", gradientTo: "#FFFFFF", accentColor: "#CCCCCC",
  },
  {
    id: "retrocity", label: "#RetroCity", emoji: "🌆", description: "80s sunset cityscape",
    lighting: { intensity: 80, color: "#A855F7", angle: 45, direction: "back" },
    gradientFrom: "#7C3AED", gradientTo: "#F59E0B", accentColor: "#A855F7",
  },
];

const COLOR_SWATCHES = [
  "#FFFFFF", "#FFB347", "#FF2079", "#00D4FF",
  "#A855F7", "#4ADE80", "#F59E0B", "#FB923C",
];
const GUESTBOOK_COLORS = [
  "#FEF3C7", "#FCE7F3", "#EDE9FE", "#D1FAE5",
  "#DBEAFE", "#FEE2E2", "#F3F4F6", "#FFF7ED",
];
const CRITIC_CATEGORIES = [
  "Lighting", "Composition", "Color Theory",
  "Form & Shape", "Texture", "Mood", "Technical",
];

// ─── Motion Variants ──────────────────────────────────────────────────────────
const springFast = { type: "spring" as const, stiffness: 500, damping: 35 };
const drawerVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 35 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};
const popoverVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 500, damping: 30 } },
  exit: { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function CriticModeSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button id="critic-mode-switch" onClick={onToggle} aria-label="Toggle Critic Mode"
      className="flex items-center gap-2 group">
      <span className="text-xs font-semibold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">
        Critic
      </span>
      <div className={`relative w-11 h-6 rounded-full border transition-colors duration-300 ${
        enabled ? "bg-white border-white" : "bg-zinc-800 border-zinc-700"}`}>
        <motion.div
          className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full ${enabled ? "bg-black" : "bg-zinc-500"}`}
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
        />
      </div>
    </button>
  );
}

function HamburgerButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button id="hamburger-btn" onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      className="w-10 h-10 flex items-center justify-center">
      <div className="w-6 h-6 relative flex flex-col justify-center items-center">
        <motion.span className="absolute h-[1.5px] w-6 bg-white origin-center"
          animate={isOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -5 }}
          transition={springFast as any} />
        <motion.span className="absolute h-[1.5px] w-6 bg-white"
          animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.2 }} />
        <motion.span className="absolute h-[1.5px] w-6 bg-white origin-center"
          animate={isOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 5 }}
          transition={springFast as any} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NAVIGATION DRAWER
// ─────────────────────────────────────────────────────────────────────────────
interface DrawerProps {
  isOpen: boolean;
  activeSection: string;
  onScrollTo: (id: string) => void;
  onClose: () => void;
}
function NavigationDrawer({ isOpen, activeSection, onScrollTo, onClose }: DrawerProps) {
  const navItems = [
    { id: "studio", label: "3D Studio", icon: "✦", desc: "Gallery & artwork" },
    { id: "lighting", label: "Mood & Lighting", icon: "◎", desc: "Color & atmosphere" },
    { id: "guestbook", label: "Guestbook", icon: "✉", desc: "Community notes" },
    { id: "feedback", label: "Feedback", icon: "◈", desc: "Critic dashboard" },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="backdrop" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside key="drawer"
            className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col overflow-y-auto"
            style={{ background: "#FFFFFF", color: "#000000" }}
            variants={drawerVariants as any} initial="hidden" animate="visible" exit="exit">

            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-zinc-100">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Navigation</p>
                <p className="text-xl font-bold text-black mt-0.5" style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>3D Mood</p>
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
                   You can browse the gallery, control the lighting, write guestbook entries, and leave design critics without signing in.
                 </p>
               </div>
            </div>

            <nav className="px-6 py-6 flex-1">
              <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 mb-3">Spaces</p>
              <div className="space-y-1">
                {navItems.map(({ id, label, icon, desc }) => (
                  <motion.button key={id} id={`nav-${id}`}
                    onClick={() => { onScrollTo(id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${
                      activeSection === id ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
                    whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 600, damping: 40 }}>
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{label}</p>
                      <p className={`text-xs mt-0.5 ${activeSection === id ? "text-zinc-400" : "text-zinc-400"}`}>{desc}</p>
                    </div>
                    {activeSection === id && <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />}
                  </motion.button>
                ))}
              </div>
            </nav>

            <div className="px-6 py-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-300 text-center">© 2026 3D Mood · For 3D Designers</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  3D WEBGL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Smooth camera distance control (zoom by moving camera closer/further)
function CameraRig({ distance }: { distance: number }) {
  const { camera } = useThree();
  useFrame(() => {
    // Keep camera direction but interpolate distance from origin
    const dir = camera.position.clone().normalize();
    const target = dir.multiplyScalar(distance);
    camera.position.lerp(target, 0.08);
  });
  return null;
}

// GLTF Loader with auto-centering
function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  
  // Auto-center and scale the model to fit a 2-unit bounding box
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    
    // Center the model at origin
    scene.position.sub(center);
    
    // Scale so largest dimension = 2 units
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) scene.scale.setScalar(2 / maxDim);
    
    // Ensure it sits on the ground plane (y=0)
    const newBox = new THREE.Box3().setFromObject(scene);
    scene.position.y -= newBox.min.y;
  }, [scene]);
  
  return <primitive object={scene} castShadow receiveShadow />;
}

// OBJ Loader with auto-centering
function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    
    obj.position.sub(center);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) obj.scale.setScalar(2 / maxDim);
    
    const newBox = new THREE.Box3().setFromObject(obj);
    obj.position.y -= newBox.min.y;
  }, [obj]);
  
  // Apply a nice PBR default material to OBJ files (which have no materials by default)
  useEffect(() => {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.4,
          metalness: 0.1,
        });
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
  }, [obj]);
  
  return <primitive object={obj} />;
}

// Wrapper that picks the right loader
function ModelLoader({ url, ext }: { url: string; ext: string }) {
  if (ext === "obj") {
    return <OBJModel url={url} />;
  }
  return <GLTFModel url={url} />;
}

// Directional Mood Light that points at the world origin from correct direction
function MoodLight({ lighting }: { lighting: LightingState }) {
  const { intensity, color, angle, direction } = lighting;
  const lightRef = useRef<THREE.SpotLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);
  
  const d = 8;
  const pos: [number, number, number] =
    direction === "top"   ? [0,  d,  0.001] :
    direction === "front" ? [0,  d * 0.5,  d] :
    direction === "back"  ? [0,  d * 0.5, -d] :
    direction === "left"  ? [-d, d * 0.5,  0] :
                            [d,  d * 0.5,  0];
  
  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);
  
  return (
    <>
      {/* Subtle warm fill from opposite side */}
      <hemisphereLight color="#ffffff" groundColor="#221133" intensity={0.4} />
      
      {/* Main mood spotlight */}
      <spotLight
        ref={lightRef}
        position={pos}
        angle={(Math.min(angle, 75) * Math.PI) / 180}
        penumbra={0.6}
        color={color}
        intensity={(intensity / 100) * 120}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        decay={1.5}
        distance={d * 4}
      />
      {/* Target sits at model center */}
      <object3D ref={targetRef} position={[0, 1, 0]} />
      
      {/* Secondary fill light from opposite direction to prevent total darkness */}
      <directionalLight
        position={[-pos[0] * 0.4, pos[1] * 0.4, -pos[2] * 0.4]}
        intensity={(intensity / 100) * 8}
        color={color}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO CANVAS — Full Screen (100vh)
// ─────────────────────────────────────────────────────────────────────────────
interface HeroCanvasProps {
  lighting: LightingState;
  criticMode: boolean;
  onCanvasClick: (x: number, y: number, clientX: number, clientY: number) => void;
  fileUrl: string | null;
  fileExt: string | null;
  fileName: string | null;
  onFileUpload: (file: File) => void;
}
function HeroCanvas({ lighting, criticMode, onCanvasClick, fileUrl, fileExt, fileName, onFileUpload }: HeroCanvasProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom = camera distance. Default 5 units, range 1.5 (close) to 10 (far)
  const [camDistance, setCamDistance] = useState(5);
  const isDraggingZoom = useRef(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
  };
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!criticMode || !fileUrl) return; // Only allow critic clicks if model is loaded (or empty canvas)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onCanvasClick(x, y, e.clientX, e.clientY);
  };

  const handleZoomDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingZoom.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    // Top = closest (1.5), Bottom = furthest (10)
    const newDist = 1.5 + relativeY * 8.5;
    setCamDistance(newDist);
  };

  const { color: sColor, intensity, angle } = lighting;
  const sOpacity = intensity / 100;

  return (
    <div ref={canvasRef} onClick={handleClick}
      className={`relative w-full h-full overflow-hidden gallery-grid ${criticMode ? "cursor-crosshair" : "cursor-default"}`}
      style={{ background: "#040404" }}>

      {/* Critic badge */}
      {criticMode && (
        <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] font-bold text-red-400 tracking-wider">CRITIC MODE — Click to annotate</span>
        </div>
      )}

      {/* ── WebGL 3D Canvas ── */}
      <div className="absolute inset-0 z-10">
        {fileUrl ? (
          <Canvas
            shadows
            camera={{ position: [0, 2, 5], fov: 40 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          >
            {/* Smooth zoom via camera distance */}
            <CameraRig distance={camDistance} />
            
            {/* HDR Environment — makes PBR materials look realistic */}
            <Environment preset="studio" environmentIntensity={0.6} />
            
            {/* All directional mood lighting */}
            <MoodLight lighting={lighting} />
            
            <Suspense fallback={null}>
              <ModelLoader url={fileUrl} ext={fileExt!} />
              
              {/* Soft ground shadow */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.25} color={sColor} />
              </mesh>
            </Suspense>

            {/* Full orbit: drag to rotate, scroll blocked (we use custom slider) */}
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={0.1}
              maxPolarAngle={Math.PI / 2}
              makeDefault
            />
          </Canvas>
        ) : (
          /* Empty state visual effects (CSS only) */
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-all duration-700"
              style={{
                width: `${Math.round(40 + (angle / 90) * 60)}%`, height: "75%",
                background: `radial-gradient(ellipse 100% 100% at 50% 0%, ${sColor}${Math.round(sOpacity * 220).toString(16).padStart(2, "0")} 0%, ${sColor}20 40%, transparent 70%)`,
                filter: "blur(1px)", animation: "spotlightPulse 3s ease-in-out infinite",
              }} />
            <div className="absolute inset-0 pointer-events-none z-[5]"
              style={{ background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${sColor}08 0%, transparent 70%)` }} />
          </>
        )}
      </div>

      {/* ── Pedestal & Drop Zone (Only show if no file uploaded) ── */}
      {!fileUrl && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-auto">
          <div className="mb-1">
            <motion.div key="dropzone"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className={`w-72 h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-300 ${
                isDragOver ? "border-white/50 scale-105" : "border-white/15 hover:border-white/30"}`}
              style={{
                background: isDragOver ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                boxShadow: isDragOver ? `0 0 40px ${sColor}20` : "none",
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              whileHover={{ scale: 1.01 }}>
              
              {isDragOver && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-2xl border border-white/20" />
              )}
              
              <motion.div animate={{ y: isDragOver ? -8 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center mb-4"
                  style={{ background: `${sColor}10` }}>
                  <svg className="w-6 h-6" style={{ color: sColor, opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white/60 mb-1">
                  {isDragOver ? "Drop your 3D file here" : "+ Upload 3D Artwork"}
                </p>
                <p className="text-xs text-white/25">.gltf · .obj · .glb</p>
              </motion.div>
              <input ref={fileInputRef} type="file" accept=".gltf,.obj,.glb"
                className="hidden" onChange={handleFileChange} onClick={(e) => e.stopPropagation()} />
            </motion.div>
          </div>
          
          {/* Pedestal Base Graphics */}
          <div className="relative" style={{ width: "280px", height: "20px",
            background: "linear-gradient(180deg, #2e2e2e 0%, #161616 60%, #0c0c0c 100%)",
            borderRadius: "6px 6px 0 0", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 -4px 30px ${sColor}12` }}>
            <div className="absolute inset-0 rounded-t-md opacity-50"
              style={{ background: `linear-gradient(180deg, ${sColor}12 0%, transparent 100%)` }} />
            <div className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${sColor}35, transparent)` }} />
          </div>
          <div style={{ width: "300px", height: "10px", background: "linear-gradient(180deg, #0e0e0e 0%, #060606 100%)", borderRadius: "0 0 3px 3px" }} />
        </div>
      )}

      {/* ── Custom UI Controls (Only visible when model is loaded) ── */}
      <AnimatePresence>
        {fileUrl && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute z-30 pointer-events-none" style={{ inset: 0 }}>
            
            {/* File info badge */}
            <div className="absolute top-24 left-6 px-4 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 pointer-events-auto">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Active Model</p>
              <p className="text-sm font-mono text-white truncate max-w-[200px]">{fileName}</p>
            </div>

            {/* Interaction hint */}
            <div className="absolute bottom-20 left-6 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full border border-white/[0.06] pointer-events-none">
              <p className="text-[10px] text-zinc-500 font-medium">Drag to rotate · Scroll below to adjust lighting</p>
            </div>

            {/* Custom Reverse Triangle Zoom Slider (Right side) */}
            <div className="absolute top-1/2 -translate-y-1/2 right-6 h-64 w-12 flex flex-col items-center pointer-events-auto select-none">
              <span className="text-[10px] font-bold text-zinc-500 mb-2 tracking-widest">IN</span>
              
              {/* Slider Track */}
              <div
                className="relative w-full flex-1 flex justify-center cursor-ns-resize group"
                onMouseDown={(e) => { e.preventDefault(); isDraggingZoom.current = true; handleZoomDrag(e); }}
                onMouseMove={handleZoomDrag}
                onMouseUp={() => isDraggingZoom.current = false}
                onMouseLeave={() => isDraggingZoom.current = false}
              >
                {/* SVG Triangle: wide top = zoom in (close), narrow bottom = zoom out (far) */}
                <svg viewBox="0 0 24 200" preserveAspectRatio="none"
                  className="absolute inset-0 w-6 h-full m-auto transition-colors duration-200"
                  style={{ opacity: isDraggingZoom.current ? 0.4 : 0.15 }}>
                  <polygon points="0,0 24,0 12,200" fill="white" />
                </svg>
                
                {/* Thumb — position maps distance: 1.5 (top=0%) → 10 (bottom=100%) */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.6)] pointer-events-none"
                  animate={{ top: `${((camDistance - 1.5) / 8.5) * 100}%`, translateY: "-50%" }}
                  transition={{ type: "spring", stiffness: 600, damping: 45 }}
                />
              </div>
              
              <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-widest">OUT</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background gradients and scanlines */}
      <div className="absolute inset-0 pointer-events-none z-[2]"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-20"
        style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
        <span className="text-[10px] text-white/30 tracking-widest uppercase font-semibold">Scroll</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="w-[1px] h-8 rounded-full" style={{ background: `linear-gradient(to bottom, ${sColor}60, transparent)` }} />
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOOD & LIGHTING SECTION
// ─────────────────────────────────────────────────────────────────────────────
interface LightingSectionProps {
  lighting: LightingState;
  onChange: (l: LightingState) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}
function LightingSection({ lighting, onChange, sectionRef }: LightingSectionProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const selectPreset = (preset: MoodPreset) => {
    setActivePreset(preset.id);
    onChange(preset.lighting);
  };
  const update = (key: keyof LightingState, value: any) =>
    onChange({ ...lighting, [key]: value });

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="lighting"
      className="relative bg-black py-24 px-6 lg:px-16">

      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #000, transparent)" }} />

      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
        variants={fadeUp as any} custom={0} className="max-w-6xl mx-auto mb-16">
        <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 02</p>
        <h2 className="text-4xl lg:text-5xl font-bold text-white"
          style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>
          Set the Mood
        </h2>
        <p className="text-zinc-500 mt-3 text-lg">Choose an atmosphere, sculpt your light.</p>
      </motion.div>

      <div className="max-w-6xl mx-auto space-y-12">

        {/* ── Mood Presets ── */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-6">Mood Presets</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {MOOD_PRESETS.map((preset, i) => {
              const isActive = activePreset === preset.id;
              return (
                <motion.button key={preset.id} id={`preset-${preset.id}`}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                  variants={fadeUp as any} custom={i}
                  onClick={() => selectPreset(preset)}
                  className="relative rounded-2xl p-5 text-left border transition-all duration-300 overflow-hidden group"
                  style={{
                    background: isActive ? `linear-gradient(135deg, ${preset.gradientFrom}25, ${preset.gradientTo}15)` : "rgba(255,255,255,0.02)",
                    borderColor: isActive ? preset.accentColor + "50" : "rgba(255,255,255,0.05)",
                    boxShadow: isActive ? `0 0 30px ${preset.accentColor}15` : "none",
                  }}
                  whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, ${preset.gradientFrom}, ${preset.gradientTo})`, opacity: isActive ? 1 : 0.3 }} />
                  <span className="text-3xl block mb-3">{preset.emoji}</span>
                  <p className="font-bold text-sm" style={{ color: isActive ? preset.accentColor : "#fff" }}>{preset.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{preset.description}</p>
                  {isActive && (
                    <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: preset.accentColor + "25", color: preset.accentColor }}>ACTIVE</motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Color Swatches & Direction ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={0}>
            <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-5">Spotlight Color</p>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <motion.button key={c} onClick={() => update("color", c)}
                  className="relative rounded-2xl transition-all duration-200"
                  style={{
                    width: "52px", height: "52px", background: c,
                    boxShadow: lighting.color === c ? `0 0 20px ${c}80, 0 0 0 3px rgba(255,255,255,0.9)` : `0 0 0 1px rgba(255,255,255,0.06)`,
                    transform: lighting.color === c ? "scale(1.15)" : "scale(1)",
                  }}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  {lighting.color === c && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="absolute inset-0 rounded-2xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full" style={{ background: c === "#FFFFFF" || c === "#F0F0F0" ? "#000" : "#fff" }} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* New Direction Selector */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={1}>
            <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-5">Light Direction</p>
            <div className="flex bg-white/5 rounded-2xl p-1.5 border border-white/10">
              {(["top", "front", "back", "left", "right"] as LightDir[]).map((dir) => (
                <button key={dir} onClick={() => update("direction", dir)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                    lighting.direction === dir ? "bg-white text-black shadow-lg" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}>
                  {dir}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Sliders ── */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={0}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-white/[0.05]"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Intensity</label>
              <span className="text-xs font-mono" style={{ color: lighting.color }}>{lighting.intensity}%</span>
            </div>
            <input type="range" min={10} max={100} value={lighting.intensity} onChange={(e) => update("intensity", parseInt(e.target.value))} />
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full" animate={{ width: `${lighting.intensity}%` }}
                style={{ background: `linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Spotlight Angle</label>
              <span className="text-xs font-mono" style={{ color: lighting.color }}>{lighting.angle}°</span>
            </div>
            <input type="range" min={5} max={90} value={lighting.angle} onChange={(e) => update("angle", parseInt(e.target.value))} />
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full" animate={{ width: `${(lighting.angle / 90) * 100}%` }}
                style={{ background: `linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #030303)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GUESTBOOK SECTION
// ─────────────────────────────────────────────────────────────────────────────
function GuestbookSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", content: "", color: GUESTBOOK_COLORS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase.from("guestbook").select("*").order("created_at", { ascending: false }).limit(50);
    if (!error && data) setEntries(data as GuestbookEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
    const channel = supabase.channel("guestbook-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guestbook" }, (payload) => {
        setEntries((prev) => {
          const hasOpt = prev.some((e) => e.optimistic);
          if (hasOpt) return prev.map((e) => e.optimistic ? { ...(payload.new as GuestbookEntry) } : e);
          return [payload.new as GuestbookEntry, ...prev];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setSubmitting(true); setError(null);
    const optimistic: GuestbookEntry = { ...form, id: Date.now(), created_at: new Date().toISOString(), optimistic: true };
    setEntries((prev) => [optimistic, ...prev]);
    setForm({ name: "", content: "", color: GUESTBOOK_COLORS[0] });
    
    const { error: dbErr } = await supabase.from("guestbook").insert({ name: form.name.trim(), content: form.content.trim(), color: form.color });
    if (dbErr) { setError(dbErr.message); setEntries((prev) => prev.filter((e) => !e.optimistic)); }
    setSubmitting(false);
  };

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="guestbook" className="relative py-24 px-6 lg:px-16" style={{ background: "#030303" }}>
      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, #030303, transparent)" }} />
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 03</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white" style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>Guestbook</h2>
          <p className="text-zinc-500 mt-3 text-lg">Notes from 3D designers worldwide.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
          <div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background: GUESTBOOK_COLORS[i % 8] + "30" }} />)}
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
                    <motion.div key={entry.id} initial={{ opacity: 0, scale: 0.8, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28, delay: Math.min(i * 0.05, 0.3) }}
                      className="rounded-2xl p-4 flex flex-col justify-between min-h-[140px] relative overflow-hidden" style={{ background: entry.color }}
                      whileHover={{ scale: 1.03, rotate: 0.5, y: -2 }}>
                      {entry.optimistic && <div className="absolute inset-0 bg-white/40 flex items-center justify-center rounded-2xl"><span className="w-5 h-5 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" /></div>}
                      <p className="text-zinc-800 text-sm leading-relaxed font-medium line-clamp-4">{entry.content}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs font-bold text-zinc-600">{entry.name}</p>
                        {entry.created_at && <p className="text-[10px] text-zinc-500">{new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <motion.form onSubmit={handleSubmit} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={1}
            className="rounded-2xl p-6 space-y-4 sticky top-24" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <h3 className="font-bold text-white mb-0.5" style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>Leave a note</h3>
              <p className="text-xs text-zinc-500">Your message to the world</p>
            </div>
            {error && <div className="px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Name</label>
              <input type="text" value={form.name} maxLength={50} placeholder="Your nickname" onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Message</label>
              <textarea value={form.content} maxLength={280} rows={4} placeholder="Leave a thoughtful note..." onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Note Color</label>
              <div className="flex gap-2 flex-wrap">
                {GUESTBOOK_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className="w-7 h-7 rounded-lg transition-all hover:scale-110" style={{ background: c, boxShadow: form.color === c ? "0 0 0 2px #fff" : "none" }} />
                ))}
              </div>
            </div>
            <motion.button type="submit" disabled={submitting || !form.name.trim() || !form.content.trim()}
              className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {submitting ? "Posting..." : "Post Note ✉"}
            </motion.button>
          </motion.form>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #050505)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEEDBACK DASHBOARD SECTION
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [critics, setCritics] = useState<CriticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCritics = useCallback(async () => {
    const { data, error } = await supabase.from("critics").select("*").order("created_at", { ascending: false }).limit(100);
    if (!error && data) setCritics(data as CriticEntry[]);
    else if (error) setError(error.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCritics();
    const channel = supabase.channel("critics-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "critics" }, (payload) => {
        setCritics((prev) => [payload.new as CriticEntry, ...prev]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCritics]);

  const avgRating = critics.length > 0 ? (critics.reduce((a, c) => a + c.rating, 0) / critics.length).toFixed(1) : "—";
  const topCat = Object.entries(critics.reduce((acc: Record<string, number>, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const stats = [
    { label: "Total Reviews", value: critics.length.toString(), icon: "◈", color: "#A855F7" },
    { label: "Avg Rating", value: avgRating, icon: "★", color: "#FBBF24" },
    { label: "Top Category", value: topCat, icon: "▲", color: "#4ADE80" },
    { label: "Realtime", value: "Live", icon: "◉", color: "#FB923C" },
  ];

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="feedback" className="relative py-24 px-6 lg:px-16 pb-32" style={{ background: "#050505" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 04</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white" style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>Feedback Dashboard</h2>
          <p className="text-zinc-500 mt-3 text-lg">Critic annotations from the 3D studio canvas.</p>
        </motion.div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={i}
              className="rounded-2xl p-5 border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className="text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={0}
          className="rounded-2xl overflow-hidden border border-white/[0.05]" style={{ background: "rgba(255,255,255,0.015)" }}>
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Design Evaluations</h3>
            <button onClick={fetchCritics} className="text-xs text-zinc-600 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">↻ Refresh</button>
          </div>
          {error && <div className="px-6 py-4 text-sm text-red-400 bg-red-900/10">{error}</div>}
          {loading ? (
            <div className="px-6 py-16 text-center text-zinc-700 text-sm">Loading...</div>
          ) : critics.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <p className="text-4xl mb-3">◈</p>
              <p className="text-zinc-500 text-sm font-medium">No evaluations yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["ID", "Name", "Pos", "Category", "Comment", "Rating", "Date"].map((h) => <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {critics.map((c) => (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-zinc-700 font-mono text-xs">#{c.id}</td>
                        <td className="px-5 py-3 text-white font-bold text-xs">{c.name || "Anon"}</td>
                        <td className="px-5 py-3 text-zinc-500 font-mono text-xs">({c.x_coord},{c.y_coord})</td>
                        <td className="px-5 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-zinc-300">{c.category}</span></td>
                        <td className="px-5 py-3 text-zinc-300 text-xs max-w-[220px] truncate">{c.comment}</td>
                        <td className="px-5 py-3 text-xs"><span className="text-yellow-400">{"★".repeat(c.rating)}</span><span className="text-zinc-800">{"★".repeat(5 - c.rating)}</span></td>
                        <td className="px-5 py-3 text-zinc-700 text-xs whitespace-nowrap">{new Date(c.created_at!).toLocaleDateString()}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRITIC POPOVER
// ─────────────────────────────────────────────────────────────────────────────
interface CriticPopoverProps {
  popover: PopoverState; onClose: () => void;
  onSubmit: (data: Omit<CriticEntry, "id" | "created_at">) => Promise<void>;
}
function CriticPopover({ popover, onClose, onSubmit }: CriticPopoverProps) {
  const [form, setForm] = useState({ name: "", category: CRITIC_CATEGORIES[0], comment: "", rating: 3 });
  const [submitting, setSubmitting] = useState(false);
  const [hover, setHover] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.comment.trim()) return;
    setSubmitting(true);
    await onSubmit({ name: form.name.trim(), x_coord: popover.canvasX, y_coord: popover.canvasY, category: form.category, comment: form.comment.trim(), rating: form.rating });
    setForm({ name: "", category: CRITIC_CATEGORIES[0], comment: "", rating: 3 });
    setSubmitting(false);
    onClose();
  };

  const left = typeof window !== "undefined" ? Math.min(popover.x, window.innerWidth - 290) : popover.x;
  const top = typeof window !== "undefined" ? Math.min(popover.y, window.innerHeight - 420) : popover.y;

  return (
    <motion.div key="critic-popover" variants={popoverVariants as any} initial="hidden" animate="visible" exit="exit"
      className="fixed z-50 w-72 rounded-2xl overflow-hidden shadow-2xl"
      style={{ left, top, background: "rgba(10,10,10,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
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
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Nickname</label>
            <input type="text" value={form.name} maxLength={30} placeholder="Your name" onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {CRITIC_CATEGORIES.map((c) => <option key={c} value={c} style={{ background: "#0a0a0a" }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Comment</label>
            <textarea value={form.comment} rows={3} maxLength={300} placeholder="Share your evaluation..." onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setForm({ ...form, rating: star })}
                  onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
                  className="text-2xl leading-none transition-transform hover:scale-125"
                  style={{ color: star <= (hover || form.rating) ? "#FBBF24" : "#27272a" }}>★</button>
              ))}
            </div>
          </div>
          <motion.button type="submit" disabled={submitting || !form.name.trim() || !form.comment.trim()}
            className="w-full py-2.5 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {submitting ? "Submitting..." : "Submit Review"}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [criticMode, setCriticMode] = useState(false);
  const [activeSection, setActiveSection] = useState("studio");
  
  // File state for 3D model
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileExt, setFileExt] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [lighting, setLighting] = useState<LightingState>({ intensity: 70, color: "#FFFFFF", angle: 60, direction: "top" });
  const [popover, setPopover] = useState<PopoverState>({ visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0 });

  const studioRef = useRef<HTMLElement | null>(null);
  const lightingRef = useRef<HTMLElement | null>(null);
  const guestbookRef = useRef<HTMLElement | null>(null);
  const feedbackRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const refs = [{ id: "studio", ref: studioRef }, { id: "lighting", ref: lightingRef }, { id: "guestbook", ref: guestbookRef }, { id: "feedback", ref: feedbackRef }];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const found = refs.find((r) => r.ref.current === entry.target);
            if (found) setActiveSection(found.id);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );
    refs.forEach(({ ref }) => { if (ref.current) observer.observe(ref.current); });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = { studio: studioRef, lighting: lightingRef, guestbook: guestbookRef, feedback: feedbackRef };
    refMap[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCanvasClick = (x: number, y: number, clientX: number, clientY: number) => {
    if (!criticMode) return;
    setPopover({ visible: true, x: clientX + 12, y: clientY - 20, canvasX: x, canvasY: y });
  };

  const handleCriticSubmit = async (data: Omit<CriticEntry, "id" | "created_at">) => {
    const { error } = await supabase.from("critics").insert(data);
    if (error) console.error("Critic insert:", error.message);
  };
  
  const handleFileUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['gltf', 'glb', 'obj'].includes(ext)) {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setFileExt(ext);
      setFileName(file.name);
    } else {
      alert("Only .gltf, .glb, and .obj files are supported.");
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-6 lg:px-10"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <motion.button onClick={() => scrollToSection("studio")} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0"><span className="text-black text-xs font-black">3D</span></div>
          <span className="font-bold tracking-tight text-white text-lg" style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>3D Mood</span>
          <span className="hidden sm:block text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">for designers</span>
        </motion.button>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="hidden lg:flex items-center gap-2">
          {["studio", "lighting", "guestbook", "feedback"].map((id) => (
            <button key={id} onClick={() => scrollToSection(id)} className="flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 group"
              style={{ background: activeSection === id ? "rgba(255,255,255,0.08)" : "transparent" }}>
              <span className="rounded-full transition-all duration-300 flex-shrink-0"
                style={{ width: activeSection === id ? "6px" : "4px", height: activeSection === id ? "6px" : "4px", background: activeSection === id ? "#fff" : "rgba(255,255,255,0.2)" }} />
              <span className={`text-[10px] font-semibold transition-all duration-300 ${activeSection === id ? "text-white opacity-100" : "text-zinc-600 opacity-0 group-hover:opacity-100"}`}>
                {id === "studio" ? "3D Studio" : id === "lighting" ? "Mood" : id === "guestbook" ? "Guestbook" : "Feedback"}
              </span>
            </button>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex items-center gap-3">
          <CriticModeSwitch enabled={criticMode} onToggle={() => { setCriticMode(!criticMode); if (!criticMode) scrollToSection("studio"); }} />
          <HamburgerButton isOpen={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)} />
        </motion.div>
      </header>

      <NavigationDrawer isOpen={drawerOpen} activeSection={activeSection} onScrollTo={scrollToSection} onClose={() => setDrawerOpen(false)} />

      <section ref={studioRef} id="studio" className="relative" style={{ height: "100vh" }}>
        <div className="sticky top-16 w-full" style={{ height: "calc(100vh - 64px)" }}>
          <HeroCanvas lighting={lighting} criticMode={criticMode} onCanvasClick={handleCanvasClick}
            fileUrl={fileUrl} fileExt={fileExt} fileName={fileName} onFileUpload={handleFileUpload} />
        </div>
      </section>

      <LightingSection lighting={lighting} onChange={setLighting} sectionRef={lightingRef} />
      <GuestbookSection sectionRef={guestbookRef} />
      <FeedbackSection sectionRef={feedbackRef} />

      <AnimatePresence>
        {popover.visible && <CriticPopover key="popover" popover={popover} onClose={() => setPopover((p) => ({ ...p, visible: false }))} onSubmit={handleCriticSubmit} />}
      </AnimatePresence>

      <footer className="border-t border-white/[0.03] px-6 lg:px-10 py-8" style={{ background: "#050505" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center"><span className="text-black text-[9px] font-black">3D</span></div>
            <span>© 2026 3D Mood · Free Mode</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />WebGL Powered</span>
            <span className="text-zinc-800">·</span>
            <span>Built for 3D designers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
