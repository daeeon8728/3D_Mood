"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Production v3
//  For 3D graphic designers · Full Supabase backend · WebGL studio
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo, Suspense,
  DragEvent, ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── 3D ENGINE ────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import {
  useGLTF, OrbitControls, Environment, SoftShadows, ContactShadows,
} from "@react-three/drei";
import { OBJLoader } from "three-stdlib";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL     = "https://ychptrhmedfjzairkzwh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sh92dIOhgb0wew25kly21w_xSLYWdko";
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────
type LightDir   = "top" | "front" | "back" | "left" | "right";
type CamPreset  = "perspective" | "front" | "side" | "top";

interface LightingState {
  intensity: number; color: string; angle: number; direction: LightDir;
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
    id: "dawn",   label: "#Dawn",      emoji: "🌅", description: "Warm golden hour",
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
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 35 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] },
  }),
};
const popoverVariants = {
  hidden:  { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { type: "spring", stiffness: 500, damping: 30 } },
  exit:    { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  SMALL UI COMPONENTS
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
          transition={{ type: "spring", stiffness: 600, damping: 35 }} />
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
  isOpen: boolean; activeSection: string;
  onScrollTo: (id: string) => void; onClose: () => void;
}
function NavigationDrawer({ isOpen, activeSection, onScrollTo, onClose }: DrawerProps) {
  const navItems = [
    { id: "studio",    label: "3D Studio",        icon: "✦", desc: "Gallery & artwork" },
    { id: "lighting",  label: "Mood & Lighting",   icon: "◎", desc: "Color & atmosphere" },
    { id: "guestbook", label: "Guestbook",         icon: "✉", desc: "Community notes" },
    { id: "feedback",  label: "Feedback",          icon: "◈", desc: "Critic dashboard" },
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
                  Browse the gallery, control lighting, write guestbook entries, and leave design critiques without signing in.
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
                      <p className="text-xs mt-0.5 text-zinc-400">{desc}</p>
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

// ── Default Sculpture: shown when no file is loaded ───────────────────────────
function DefaultSculpture() {
  const groupRef  = useRef<THREE.Group>(null!);
  const ring1Ref  = useRef<THREE.Mesh>(null!);
  const ring2Ref  = useRef<THREE.Mesh>(null!);
  const ring3Ref  = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.25;
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * 0.8;
    if (ring2Ref.current) ring2Ref.current.rotation.x += delta * 0.6;
    if (ring3Ref.current) ring3Ref.current.rotation.y += delta * 1.0;
  });

  return (
    <group ref={groupRef}>
      {/* Core torus knot */}
      <mesh castShadow receiveShadow>
        <torusKnotGeometry args={[0.9, 0.3, 256, 24, 2, 3]} />
        <meshStandardMaterial
          color="#c0c0c0" metalness={0.85} roughness={0.1} envMapIntensity={1.8}
        />
      </mesh>

      {/* Orbital ring 1 */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.8, 0.04, 16, 128]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.05} />
      </mesh>

      {/* Orbital ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow>
        <torusGeometry args={[2.1, 0.025, 16, 128]} />
        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.05} />
      </mesh>

      {/* Orbital ring 3 */}
      <mesh ref={ring3Ref} rotation={[0, Math.PI / 3, Math.PI / 6]} castShadow>
        <torusGeometry args={[2.4, 0.018, 16, 128]} />
        <meshStandardMaterial color="#555" metalness={0.9} roughness={0.08} />
      </mesh>

      {/* Floating spheres at cardinal points */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i}
            position={[Math.cos(angle) * 1.8, Math.sin(angle) * 0.4, Math.sin(angle) * 1.8]}
            castShadow>
            <sphereGeometry args={[0.08, 32, 32]} />
            <meshStandardMaterial color="#fff" metalness={1} roughness={0} envMapIntensity={2} />
          </mesh>
        );
      })}

      {/* Pedestal */}
      <mesh position={[0, -1.6, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 1.1, 0.18, 64]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -1.72, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.08, 64]} />
        <meshStandardMaterial color="#111" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ── GLTF model: clone in useMemo so first frame is always correct ─────────────
function GLTFModel({
  url, wireframe, metalness, roughness,
}: { url: string; wireframe: boolean; metalness: number; roughness: number }) {
  const { scene } = useGLTF(url);

  // Deep-clone + normalize (center + 2-unit scale) in useMemo
  const normalized = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = 2.0 / maxDim;
      cloned.scale.setScalar(s);
      cloned.position.set(-center.x * s, -center.y * s, -center.z * s);
    }

    // Clone materials for independent control
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => {
          const c = m.clone() as THREE.MeshStandardMaterial;
          if (c.isMeshStandardMaterial) c.envMapIntensity = 1.0;
          return c;
        });
      } else {
        const c = (mesh.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
        if (c.isMeshStandardMaterial) c.envMapIntensity = 1.0;
        mesh.material = c;
      }
    });
    return cloned;
  }, [scene]);

  // Update material props when sliders change
  useEffect(() => {
    normalized.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial) {
          std.metalness  = metalness;
          std.roughness  = roughness;
          std.wireframe  = wireframe;
          std.needsUpdate = true;
        } else {
          (m as any).wireframe = wireframe;
        }
      });
    });
  }, [normalized, wireframe, metalness, roughness]);

  return <primitive object={normalized} />;
}

// ── OBJ model: same pattern ───────────────────────────────────────────────────
function OBJModel({
  url, wireframe, metalness, roughness,
}: { url: string; wireframe: boolean; metalness: number; roughness: number }) {
  const obj = useLoader(OBJLoader, url);

  const normalized = useMemo(() => {
    const cloned = obj.clone(true);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = 2.0 / maxDim;
      cloned.scale.setScalar(s);
      cloned.position.set(-center.x * s, -center.y * s, -center.z * s);
    }

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc, metalness, roughness, envMapIntensity: 1.0,
    });
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material      = baseMat.clone();
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
    });
    return cloned;
  }, [obj]);

  useEffect(() => {
    normalized.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const std = mesh.material as THREE.MeshStandardMaterial;
      std.metalness  = metalness;
      std.roughness  = roughness;
      std.wireframe  = wireframe;
      std.needsUpdate = true;
    });
  }, [normalized, wireframe, metalness, roughness]);

  return <primitive object={normalized} />;
}

function ModelMesh({ url, ext, wireframe, metalness, roughness }: {
  url: string; ext: string; wireframe: boolean; metalness: number; roughness: number;
}) {
  if (ext === "obj") return <OBJModel url={url} wireframe={wireframe} metalness={metalness} roughness={roughness} />;
  return <GLTFModel url={url} wireframe={wireframe} metalness={metalness} roughness={roughness} />;
}

// ── Zoom along camera direction ───────────────────────────────────────────────
function ZoomRig({ mult }: { mult: number }) {
  const BASE   = 3.5;
  const target = BASE * mult;
  const { camera } = useThree();
  useFrame(() => {
    const cur = camera.position.length();
    if (Math.abs(cur - target) < 0.005) return;
    camera.position.multiplyScalar(
      THREE.MathUtils.lerp(cur, target, 0.1) / cur
    );
  });
  return null;
}

// ── Camera preset snap ────────────────────────────────────────────────────────
function CameraPresetRig({ preset }: { preset: CamPreset }) {
  const { camera } = useThree();
  const prev = useRef<CamPreset>("perspective");
  useEffect(() => {
    if (prev.current === preset) return;
    prev.current = preset;
    const d = Math.max(camera.position.length(), 2);
    if      (preset === "front") camera.position.set(0,   0,  d);
    else if (preset === "side")  camera.position.set(d,   0,  0);
    else if (preset === "top")   camera.position.set(0,   d,  0.001);
    else                         camera.position.set(d * 0.65, d * 0.38, d);
    camera.lookAt(0, 0, 0);
  }, [preset, camera]);
  return null;
}

// ── Photorealistic mood lighting (fixed for 2-unit models) ───────────────────
function MoodLight({ lighting }: { lighting: LightingState }) {
  const { intensity, color, angle, direction } = lighting;

  const pos: [number, number, number] =
    direction === "top"   ? [0.2,  6,  0.2] :
    direction === "front" ? [0,    3,  6  ] :
    direction === "back"  ? [0,    3, -6  ] :
    direction === "left"  ? [-6,   3,  0  ] :
                            [6,    3,  0  ];

  const mainInt = (intensity / 100) * 14;
  const fillInt = (intensity / 100) * 2.5;
  const rimInt  = (intensity / 100) * 1.5;

  return (
    <>
      <hemisphereLight color="#c8d8ff" groundColor="#0d0510" intensity={0.4} />

      <spotLight
        position={pos}
        target-position={[0, 0, 0]}
        angle={(Math.min(angle, 65) * Math.PI) / 180}
        penumbra={0.75}
        color={color}
        intensity={mainInt}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00003}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        decay={2}
        distance={28}
      />

      <directionalLight
        position={[-pos[0] * 0.5, pos[1] * 0.4, -pos[2] * 0.5]}
        color={color} intensity={fillInt}
      />
      <directionalLight
        position={[pos[0] * 0.1, 1.5, -6]}
        color="#a0c0ff" intensity={rimInt}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO CANVAS
// ─────────────────────────────────────────────────────────────────────────────
interface HeroCanvasProps {
  lighting:        LightingState;
  criticMode:      boolean;
  onCanvasClick:   (x: number, y: number, clientX: number, clientY: number) => void;
  fileUrl:         string | null;
  fileExt:         string | null;
  fileName:        string | null;
  onFileUpload:    (file: File) => void;
}

function HeroCanvas({
  lighting, criticMode, onCanvasClick,
  fileUrl, fileExt, fileName, onFileUpload,
}: HeroCanvasProps) {
  const [isDragOver,  setIsDragOver]  = useState(false);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viewport controls
  const [zoomMult,    setZoomMult]    = useState(1);
  const [wireframe,   setWireframe]   = useState(false);
  const [autoRotate,  setAutoRotate]  = useState(false);
  const [camPreset,   setCamPreset]   = useState<CamPreset>("perspective");
  // Material controls
  const [metalness,   setMetalness]   = useState(0.5);
  const [roughness,   setRoughness]   = useState(0.45);
  const isDraggingZoom = useRef(false);

  // Reset controls on new file
  useEffect(() => {
    setZoomMult(1);
    setWireframe(false);
    setAutoRotate(false);
    setCamPreset("perspective");
    setMetalness(0.5);
    setRoughness(0.45);
  }, [fileUrl]);

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
    if (!criticMode) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left)  / rect.width)  * 100);
    const y = Math.round(((e.clientY - rect.top)    / rect.height) * 100);
    onCanvasClick(x, y, e.clientX, e.clientY);
  };
  const handleZoomDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingZoom.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setZoomMult(0.4 + relY * 2.1);
  };

  const { color: sColor, intensity, angle } = lighting;
  const sOpacity = intensity / 100;

  return (
    <div
      ref={canvasRef}
      onClick={handleClick}
      className={`relative w-full h-full overflow-hidden ${criticMode ? "cursor-crosshair" : "cursor-default"}`}
      style={{ background: "#040404" }}>

      {/* Scanline texture overlay */}
      <div className="absolute inset-0 pointer-events-none z-[2]"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)" }} />

      {/* Critic badge */}
      {criticMode && (
        <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] font-bold text-red-400 tracking-wider">CRITIC MODE — Click to annotate</span>
        </div>
      )}

      {/* ── WebGL Canvas ── */}
      <div className="absolute inset-0 z-10">
        <Canvas
          shadows="soft"
          camera={{ position: [0, 0.5, 3.5], fov: 42 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
          }}>
          <SoftShadows size={12} samples={16} focus={0.85} />
          <Environment preset="warehouse" environmentIntensity={0.4} />
          <MoodLight lighting={lighting} />
          <ZoomRig mult={zoomMult} />
          <CameraPresetRig preset={camPreset} />

          {fileUrl ? (
            <Suspense fallback={null}>
              <ModelMesh
                url={fileUrl} ext={fileExt!}
                wireframe={wireframe} metalness={metalness} roughness={roughness}
              />
              <ContactShadows
                position={[0, -1.02, 0]} opacity={0.55}
                scale={8} blur={2} far={2} color={sColor}
              />
            </Suspense>
          ) : (
            <>
              <DefaultSculpture />
              <ContactShadows
                position={[0, -1.8, 0]} opacity={0.4}
                scale={10} blur={2.5} far={3} color="#888"
              />
            </>
          )}

          <OrbitControls
            target={[0, 0, 0]}
            enableZoom={false}
            enablePan={false}
            minPolarAngle={0.05}
            maxPolarAngle={Math.PI * 0.55}
            rotateSpeed={0.5}
            dampingFactor={0.07}
            enableDamping
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
            makeDefault
          />
        </Canvas>
      </div>

      {/* ── Upload drop zone (no file loaded) ── */}
      {!fileUrl && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-auto">
          <motion.div key="dropzone"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={`w-64 h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-300 ${
              isDragOver ? "border-white/50 scale-105" : "border-white/15 hover:border-white/30"}`}
            style={{
              background: isDragOver ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
              boxShadow: isDragOver ? `0 0 40px ${sColor}20` : "none",
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.01 }}>
            <motion.div animate={{ y: isDragOver ? -8 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center mb-3"
                style={{ background: `${sColor}10` }}>
                <svg className="w-5 h-5" style={{ color: sColor, opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/60 mb-1">
                {isDragOver ? "Drop here" : "+ Upload 3D File"}
              </p>
              <p className="text-xs text-white/25">.gltf · .glb · .obj</p>
            </motion.div>
            <input ref={fileInputRef} type="file" accept=".gltf,.glb,.obj"
              className="hidden" onChange={handleFileChange} onClick={(e) => e.stopPropagation()} />
          </motion.div>
          {/* Pedestal graphic */}
          <div className="relative" style={{
            width: "260px", height: "18px",
            background: "linear-gradient(180deg, #2e2e2e 0%, #161616 60%, #0c0c0c 100%)",
            borderRadius: "6px 6px 0 0",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 -4px 30px ${sColor}12`,
          }}>
            <div className="absolute inset-0 rounded-t-md opacity-50"
              style={{ background: `linear-gradient(180deg, ${sColor}12 0%, transparent 100%)` }} />
          </div>
          <div style={{ width: "280px", height: "8px", background: "linear-gradient(180deg, #0e0e0e 0%, #060606 100%)", borderRadius: "0 0 3px 3px" }} />
        </div>
      )}

      {/* ── Loaded model controls overlay ── */}
      <AnimatePresence>
        {fileUrl && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute z-30 pointer-events-none" style={{ inset: 0 }}>

            {/* File badge */}
            <div className="absolute top-24 left-6 px-4 py-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 pointer-events-auto">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Active Model</p>
              <p className="text-sm font-mono text-white truncate max-w-[200px]">{fileName}</p>
            </div>

            {/* ── Designer toolbar (bottom) ── */}
            <div className="absolute bottom-8 left-6 flex items-center gap-2 pointer-events-auto flex-wrap">
              {/* Camera presets */}
              {(["perspective", "front", "side", "top"] as CamPreset[]).map((p) => (
                <button key={p}
                  onClick={() => { setCamPreset(p); setAutoRotate(false); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border backdrop-blur-md ${
                    camPreset === p
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white border-white/10"
                  }`}>
                  {p === "perspective" ? "3D" : p}
                </button>
              ))}

              <div className="w-px h-6 bg-white/10 mx-1" />

              {/* Wireframe */}
              <button onClick={() => setWireframe(w => !w)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border backdrop-blur-md ${
                  wireframe
                    ? "bg-cyan-400/20 text-cyan-300 border-cyan-400/40"
                    : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white border-white/10"
                }`}>
                Wire
              </button>

              {/* Auto-Rotate */}
              <button onClick={() => setAutoRotate(r => !r)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border backdrop-blur-md flex items-center gap-1.5 ${
                  autoRotate
                    ? "bg-violet-400/20 text-violet-300 border-violet-400/40"
                    : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white border-white/10"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${autoRotate ? "bg-violet-400 animate-ping" : "bg-zinc-600"}`} />
                Rotate
              </button>
            </div>

            {/* ── Material sliders (bottom center) ── */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-auto
              px-5 py-3 rounded-2xl backdrop-blur-md border border-white/10"
              style={{ background: "rgba(0,0,0,0.55)", minWidth: "220px" }}>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center mb-0.5">Material</p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 w-16 text-right">Metal</span>
                <input type="range" min={0} max={100} value={Math.round(metalness * 100)}
                  onChange={(e) => setMetalness(parseInt(e.target.value) / 100)}
                  className="flex-1 h-1 accent-white cursor-pointer" />
                <span className="text-[10px] font-mono text-zinc-400 w-8">{Math.round(metalness * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 w-16 text-right">Rough</span>
                <input type="range" min={0} max={100} value={Math.round(roughness * 100)}
                  onChange={(e) => setRoughness(parseInt(e.target.value) / 100)}
                  className="flex-1 h-1 accent-white cursor-pointer" />
                <span className="text-[10px] font-mono text-zinc-400 w-8">{Math.round(roughness * 100)}%</span>
              </div>
            </div>

            {/* ── Custom Zoom Slider (right side) ── */}
            <div className="absolute top-1/2 -translate-y-1/2 right-6 h-64 w-12 flex flex-col items-center pointer-events-auto select-none">
              <span className="text-[10px] font-bold text-zinc-500 mb-2 tracking-widest">IN</span>
              <div className="relative w-full flex-1 flex justify-center cursor-ns-resize"
                onMouseDown={(e) => { e.preventDefault(); isDraggingZoom.current = true; handleZoomDrag(e); }}
                onMouseMove={handleZoomDrag}
                onMouseUp={() => isDraggingZoom.current = false}
                onMouseLeave={() => isDraggingZoom.current = false}>
                <svg viewBox="0 0 24 200" preserveAspectRatio="none"
                  className="absolute inset-0 w-6 h-full m-auto" style={{ opacity: 0.15 }}>
                  <polygon points="0,0 24,0 12,200" fill="white" />
                </svg>
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.6)] pointer-events-none"
                  animate={{ top: `${((zoomMult - 0.4) / 2.1) * 100}%`, translateY: "-50%" }}
                  transition={{ type: "spring", stiffness: 600, damping: 45 }} />
              </div>
              <span className="text-[10px] font-bold text-zinc-500 mt-2 tracking-widest">OUT</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty-state spotlight glow */}
      {!fileUrl && (
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

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-20"
        style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />

      {/* Scroll indicator */}
      <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
        <span className="text-[10px] text-white/30 tracking-widest uppercase font-semibold">Scroll</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="w-[1px] h-8 rounded-full"
          style={{ background: `linear-gradient(to bottom, ${sColor}60, transparent)` }} />
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

        {/* Mood Presets */}
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
                    boxShadow:   isActive ? `0 0 30px ${preset.accentColor}15` : "none",
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
                      style={{ background: preset.accentColor + "25", color: preset.accentColor }}>
                      ACTIVE
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Color + Direction */}
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
                      <div className="w-3 h-3 rounded-full"
                        style={{ background: c === "#FFFFFF" || c === "#F0F0F0" ? "#000" : "#fff" }} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

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

        {/* Sliders */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={0}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-white/[0.05]"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Intensity</label>
              <span className="text-xs font-mono" style={{ color: lighting.color }}>{lighting.intensity}%</span>
            </div>
            <input type="range" min={10} max={100} value={lighting.intensity}
              onChange={(e) => update("intensity", parseInt(e.target.value))} />
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
            <input type="range" min={5} max={90} value={lighting.angle}
              onChange={(e) => update("angle", parseInt(e.target.value))} />
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full" animate={{ width: `${(lighting.angle / 90) * 100}%` }}
                style={{ background: `linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #030303)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GUESTBOOK SECTION
// ─────────────────────────────────────────────────────────────────────────────
function GuestbookSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [entries,    setEntries]    = useState<GuestbookEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState({ name: "", content: "", color: GUESTBOOK_COLORS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("guestbook")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setEntries((data as GuestbookEntry[]) ?? []);
    } catch (err: any) {
      console.error("[Guestbook] fetch:", err?.message ?? err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    // Real-time inserts from other clients
    const channel = supabase.channel("guestbook-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guestbook" }, (payload) => {
        setEntries((prev) => {
          const hasOpt = prev.some((e) => e.optimistic);
          if (hasOpt) return prev.map((e) => e.optimistic ? (payload.new as GuestbookEntry) : e);
          return [payload.new as GuestbookEntry, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setSubmitting(true);
    setError(null);

    const optimistic: GuestbookEntry = {
      ...form, id: Date.now(),
      created_at: new Date().toISOString(), optimistic: true,
    };
    setEntries((prev) => [optimistic, ...prev]);
    const snapshot = { ...form };
    setForm({ name: "", content: "", color: GUESTBOOK_COLORS[0] });

    try {
      const { error: dbErr } = await supabase
        .from("guestbook")
        .insert({ name: snapshot.name.trim(), content: snapshot.content.trim(), color: snapshot.color });
      if (dbErr) throw dbErr;
      setEntries((prev) => prev.map((e) => e.optimistic ? { ...e, optimistic: false } : e));
    } catch (err: any) {
      setError(err?.message ?? "Failed to post. Please try again.");
      setEntries((prev) => prev.filter((e) => !e.optimistic));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="guestbook"
      className="relative py-24 px-6 lg:px-16" style={{ background: "#030303" }}>
      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #030303, transparent)" }} />
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 03</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white"
            style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>
            Guestbook
          </h2>
          <p className="text-zinc-500 mt-3 text-lg">Notes from 3D designers worldwide.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
          <div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl animate-pulse"
                    style={{ background: GUESTBOOK_COLORS[i % 8] + "30" }} />
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
                    <motion.div key={entry.id}
                      initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28, delay: Math.min(i * 0.05, 0.3) }}
                      className="rounded-2xl p-4 flex flex-col justify-between min-h-[140px] relative overflow-hidden"
                      style={{ background: entry.color }}
                      whileHover={{ scale: 1.03, rotate: 0.5, y: -2 }}>
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
                            {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <motion.form onSubmit={handleSubmit}
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={1}
            className="rounded-2xl p-6 space-y-4 sticky top-24"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <h3 className="font-bold text-white mb-0.5"
                style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>Leave a note</h3>
              <p className="text-xs text-zinc-500">Your message to the world</p>
            </div>
            {error && (
              <div className="px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-400">
                {error}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Name</label>
              <input type="text" value={form.name} maxLength={50} placeholder="Your nickname"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Message</label>
              <textarea value={form.content} maxLength={280} rows={4} placeholder="Leave a thoughtful note..."
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Note Color</label>
              <div className="flex gap-2 flex-wrap">
                {GUESTBOOK_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-lg transition-all hover:scale-110"
                    style={{ background: c, boxShadow: form.color === c ? "0 0 0 2px #fff" : "none" }} />
                ))}
              </div>
            </div>
            <motion.button type="submit" disabled={submitting || !form.name.trim() || !form.content.trim()}
              className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {submitting ? "Posting…" : "Post Note ✉"}
            </motion.button>
          </motion.form>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #050505)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEEDBACK DASHBOARD SECTION
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [critics, setCritics] = useState<CriticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchCritics = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("critics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setCritics((data as CriticEntry[]) ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCritics();
    const channel = supabase.channel("critics-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "critics" }, (payload) => {
        setCritics((prev) => [payload.new as CriticEntry, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCritics]);

  const avgRating = critics.length > 0
    ? (critics.reduce((a, c) => a + c.rating, 0) / critics.length).toFixed(1) : "—";
  const topCat = Object.entries(
    critics.reduce((acc: Record<string, number>, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1; return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const stats = [
    { label: "Total Reviews", value: critics.length.toString(), icon: "◈", color: "#A855F7" },
    { label: "Avg Rating",    value: avgRating,                  icon: "★", color: "#FBBF24" },
    { label: "Top Category",  value: topCat,                     icon: "▲", color: "#4ADE80" },
    { label: "Realtime",      value: "Live",                     icon: "◉", color: "#FB923C" },
  ];

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="feedback"
      className="relative py-24 px-6 lg:px-16 pb-32" style={{ background: "#050505" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 04</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white"
            style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>
            Feedback Dashboard
          </h2>
          <p className="text-zinc-500 mt-3 text-lg">Critic annotations from the 3D studio canvas.</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div key={s.label}
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp as any} custom={i}
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
            <button onClick={fetchCritics}
              className="text-xs text-zinc-600 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">
              ↻ Refresh
            </button>
          </div>
          {error && <div className="px-6 py-4 text-sm text-red-400 bg-red-900/10">{error}</div>}
          {loading ? (
            <div className="px-6 py-16 text-center text-zinc-700 text-sm">Loading…</div>
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
                    {["ID", "Name", "Pos", "Category", "Comment", "Rating", "Date"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {critics.map((c) => (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-zinc-700 font-mono text-xs">#{c.id}</td>
                        <td className="px-5 py-3 text-white font-bold text-xs">{c.name || "Anon"}</td>
                        <td className="px-5 py-3 text-zinc-500 font-mono text-xs">({c.x_coord},{c.y_coord})</td>
                        <td className="px-5 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-zinc-300">
                            {c.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-zinc-300 text-xs max-w-[220px] truncate">{c.comment}</td>
                        <td className="px-5 py-3 text-xs">
                          <span className="text-yellow-400">{"★".repeat(c.rating)}</span>
                          <span className="text-zinc-800">{"★".repeat(5 - c.rating)}</span>
                        </td>
                        <td className="px-5 py-3 text-zinc-700 text-xs whitespace-nowrap">
                          {new Date(c.created_at!).toLocaleDateString()}
                        </td>
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
  popover: PopoverState;
  onClose: () => void;
  onSubmit: (data: Omit<CriticEntry, "id" | "created_at">) => Promise<void>;
}
function CriticPopover({ popover, onClose, onSubmit }: CriticPopoverProps) {
  const [form,       setForm]       = useState({ name: "", category: CRITIC_CATEGORIES[0], comment: "", rating: 3 });
  const [submitting, setSubmitting] = useState(false);
  const [hover,      setHover]      = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.comment.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name:     form.name.trim(),
        x_coord:  popover.canvasX,
        y_coord:  popover.canvasY,
        category: form.category,
        comment:  form.comment.trim(),
        rating:   form.rating,
      });
      setForm({ name: "", category: CRITIC_CATEGORIES[0], comment: "", rating: 3 });
      onClose();
    } catch (err: any) {
      console.error("[CriticPopover]", err?.message ?? err);
    } finally {
      setSubmitting(false);
    }
  };

  const left = typeof window !== "undefined" ? Math.min(popover.x, window.innerWidth  - 290) : popover.x;
  const top  = typeof window !== "undefined" ? Math.min(popover.y, window.innerHeight - 420) : popover.y;

  return (
    <motion.div key="critic-popover"
      variants={popoverVariants as any} initial="hidden" animate="visible" exit="exit"
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
            <input type="text" value={form.name} maxLength={30} placeholder="Your name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            <textarea value={form.comment} rows={3} maxLength={300} placeholder="Share your evaluation..."
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button"
                  onClick={() => setForm({ ...form, rating: star })}
                  onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
                  className="text-2xl leading-none transition-transform hover:scale-125"
                  style={{ color: star <= (hover || form.rating) ? "#FBBF24" : "#27272a" }}>
                  ★
                </button>
              ))}
            </div>
          </div>
          <motion.button type="submit"
            disabled={submitting || !form.name.trim() || !form.comment.trim()}
            className="w-full py-2.5 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {submitting ? "Submitting…" : "Submit Review"}
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
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [criticMode,     setCriticMode]     = useState(false);
  const [activeSection,  setActiveSection]  = useState("studio");
  const [fileUrl,        setFileUrl]        = useState<string | null>(null);
  const [fileExt,        setFileExt]        = useState<string | null>(null);
  const [fileName,       setFileName]       = useState<string | null>(null);
  const [lighting,       setLighting]       = useState<LightingState>({
    intensity: 70, color: "#FFFFFF", angle: 60, direction: "top",
  });
  const [popover, setPopover] = useState<PopoverState>({
    visible: false, x: 0, y: 0, canvasX: 0, canvasY: 0,
  });

  const studioRef    = useRef<HTMLElement | null>(null);
  const lightingRef  = useRef<HTMLElement | null>(null);
  const guestbookRef = useRef<HTMLElement | null>(null);
  const feedbackRef  = useRef<HTMLElement | null>(null);

  // Section intersection observer
  useEffect(() => {
    const refs = [
      { id: "studio",    ref: studioRef },
      { id: "lighting",  ref: lightingRef },
      { id: "guestbook", ref: guestbookRef },
      { id: "feedback",  ref: feedbackRef },
    ];
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const found = refs.find((r) => r.ref.current === entry.target);
          if (found) setActiveSection(found.id);
        }
      }),
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );
    refs.forEach(({ ref }) => { if (ref.current) observer.observe(ref.current); });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
      studio: studioRef, lighting: lightingRef,
      guestbook: guestbookRef, feedback: feedbackRef,
    };
    refMap[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCanvasClick = (x: number, y: number, clientX: number, clientY: number) => {
    if (!criticMode) return;
    setPopover({ visible: true, x: clientX + 12, y: clientY - 20, canvasX: x, canvasY: y });
  };

  const handleCriticSubmit = async (data: Omit<CriticEntry, "id" | "created_at">) => {
    try {
      const { error } = await supabase.from("critics").insert({
        name:     data.name,
        x_coord:  data.x_coord,
        y_coord:  data.y_coord,
        category: data.category,
        comment:  data.comment,
        rating:   data.rating,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("[Critics] insert:", err?.message ?? err);
      throw err; // re-throw so CriticPopover can handle
    }
  };

  const handleFileUpload = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["gltf", "glb", "obj"].includes(ext)) {
      alert("Only .gltf, .glb, and .obj files are supported.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setFileExt(ext);
    setFileName(file.name);
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      {/* ── Fixed Header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-6 lg:px-10"
        style={{
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
        <motion.button onClick={() => scrollToSection("studio")}
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-black text-xs font-black">3D</span>
          </div>
          <span className="font-bold tracking-tight text-white text-lg"
            style={{ fontFamily: "var(--font-space-grotesk, sans-serif)" }}>3D Mood</span>
          <span className="hidden sm:block text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">
            for designers
          </span>
        </motion.button>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="hidden lg:flex items-center gap-2">
          {["studio", "lighting", "guestbook", "feedback"].map((id) => (
            <button key={id} onClick={() => scrollToSection(id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 group"
              style={{ background: activeSection === id ? "rgba(255,255,255,0.08)" : "transparent" }}>
              <span className="rounded-full transition-all duration-300 flex-shrink-0"
                style={{
                  width:  activeSection === id ? "6px" : "4px",
                  height: activeSection === id ? "6px" : "4px",
                  background: activeSection === id ? "#fff" : "rgba(255,255,255,0.2)",
                }} />
              <span className={`text-[10px] font-semibold transition-all duration-300 ${
                activeSection === id ? "text-white opacity-100" : "text-zinc-600 opacity-0 group-hover:opacity-100"
              }`}>
                {id === "studio" ? "3D Studio" : id === "lighting" ? "Mood" : id === "guestbook" ? "Guestbook" : "Feedback"}
              </span>
            </button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3">
          <CriticModeSwitch
            enabled={criticMode}
            onToggle={() => { setCriticMode(!criticMode); if (!criticMode) scrollToSection("studio"); }}
          />
          <HamburgerButton isOpen={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)} />
        </motion.div>
      </header>

      <NavigationDrawer
        isOpen={drawerOpen} activeSection={activeSection}
        onScrollTo={scrollToSection} onClose={() => setDrawerOpen(false)}
      />

      {/* ── Hero 3D Studio ── */}
      <section ref={studioRef} id="studio" className="relative" style={{ height: "100vh" }}>
        <div className="sticky top-16 w-full" style={{ height: "calc(100vh - 64px)" }}>
          <HeroCanvas
            lighting={lighting} criticMode={criticMode}
            onCanvasClick={handleCanvasClick}
            fileUrl={fileUrl} fileExt={fileExt} fileName={fileName}
            onFileUpload={handleFileUpload}
          />
        </div>
      </section>

      <LightingSection  lighting={lighting} onChange={setLighting} sectionRef={lightingRef} />
      <GuestbookSection sectionRef={guestbookRef} />
      <FeedbackSection  sectionRef={feedbackRef} />

      {/* Critic Popover */}
      <AnimatePresence>
        {popover.visible && (
          <CriticPopover
            key="popover"
            popover={popover}
            onClose={() => setPopover((p) => ({ ...p, visible: false }))}
            onSubmit={handleCriticSubmit}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/[0.03] px-6 lg:px-10 py-8" style={{ background: "#050505" }}>
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
              WebGL Powered
            </span>
            <span className="text-zinc-800">·</span>
            <span>Built for 3D designers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
