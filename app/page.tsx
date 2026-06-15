"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Production v6
//  Professional 3D Design Studio · Supabase · WebGL
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo, Suspense, Component,
  DragEvent, ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import * as THREE from "three";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import {
  useGLTF, OrbitControls, Environment, SoftShadows, ContactShadows,
  Grid, GizmoHelper, GizmoViewport, Html, MeshReflectorMaterial,
} from "@react-three/drei";
import { OBJLoader } from "three-stdlib";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://ychptrhmedfjzairkzwh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sh92dIOhgb0wew25kly21w_xSLYWdko";
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────
type LightDir   = "top" | "front" | "back" | "left" | "right";
type CamPreset  = "perspective" | "front" | "side" | "top";
type EnvPreset  = "warehouse" | "studio" | "city" | "dawn" | "night" | "apartment";
type MatChannel = "full" | "albedo" | "roughness" | "metalness" | "normals";

interface LightingState {
  intensity: number; color: string; angle: number;
  direction: LightDir; posX: number; posY: number; posZ: number;
}
interface MoodPreset {
  id: string; label: string; emoji: string; description: string;
  lighting: LightingState; gradientFrom: string; gradientTo: string; accentColor: string;
}
// NOTE: guestbook table has columns: id, name, content, color (NO created_at)
interface GuestbookEntry {
  id?: number; name: string; content: string; color: string;
  created_at?: string; optimistic?: boolean;
}
// NOTE: critics table has columns: id, name, x_coord, y_coord, category, comment, rating
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
    lighting: { intensity: 75, color: "#FFB347", angle: 35, direction: "top",   posX: 3, posY: 8, posZ: 2 },
    gradientFrom: "#FF6B35", gradientTo: "#FFB347", accentColor: "#FFB347",
  },
  {
    id: "cyberpunk", label: "#Cyberpunk", emoji: "⚡", description: "Neon dystopian glow",
    lighting: { intensity: 90, color: "#FF2079", angle: 20, direction: "front", posX: 0, posY: 5, posZ: 10 },
    gradientFrom: "#FF2079", gradientTo: "#00D4FF", accentColor: "#FF2079",
  },
  {
    id: "minimal",   label: "#Minimal",   emoji: "◻",  description: "Pure white gallery",
    lighting: { intensity: 60, color: "#F0F0F0", angle: 90, direction: "top",   posX: 0, posY: 10, posZ: 0 },
    gradientFrom: "#E8E8E8", gradientTo: "#FFFFFF", accentColor: "#CCCCCC",
  },
  {
    id: "retrocity", label: "#RetroCity", emoji: "🌆", description: "80s sunset cityscape",
    lighting: { intensity: 80, color: "#A855F7", angle: 45, direction: "back",  posX: -3, posY: 6, posZ: -8 },
    gradientFrom: "#7C3AED", gradientTo: "#F59E0B", accentColor: "#A855F7",
  },
];
const COLOR_SWATCHES     = ["#FFFFFF","#FFB347","#FF2079","#00D4FF","#A855F7","#4ADE80","#F59E0B","#FB923C"];
const GUESTBOOK_COLORS   = ["#FEF3C7","#FCE7F3","#EDE9FE","#D1FAE5","#DBEAFE","#FEE2E2","#F3F4F6","#FFF7ED"];
const CRITIC_CATEGORIES  = ["Lighting","Composition","Color Theory","Form & Shape","Texture","Mood","Technical"];
const ENV_PRESETS: { id: EnvPreset; label: string; emoji: string }[] = [
  { id: "studio",    label: "Studio",   emoji: "💡" },
  { id: "warehouse", label: "Factory",  emoji: "🏭" },
  { id: "apartment", label: "Interior", emoji: "🪟" },
  { id: "city",      label: "City",     emoji: "🌆" },
  { id: "dawn",      label: "Dawn",     emoji: "🌅" },
  { id: "night",     label: "Night",    emoji: "🌙" },
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
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22,1,0.36,1] as [number,number,number,number] },
  }),
};
const popoverVariants = {
  hidden:  { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 500, damping: 30 } },
  exit:    { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function CriticModeSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button id="critic-mode-switch" onClick={onToggle} aria-label="Toggle Critic Mode"
      className="flex items-center gap-2 group">
      <span className="text-xs font-semibold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">Critic</span>
      <div className={`relative w-11 h-6 rounded-full border transition-colors duration-300 ${enabled ? "bg-white border-white" : "bg-zinc-800 border-zinc-700"}`}>
        <motion.div className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full ${enabled ? "bg-black" : "bg-zinc-500"}`}
          animate={{ x: enabled ? 20 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 35 }} />
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
//  NAV DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function NavigationDrawer({ isOpen, activeSection, onScrollTo, onClose }:
  { isOpen: boolean; activeSection: string; onScrollTo: (id: string) => void; onClose: () => void }) {
  const navItems = [
    { id: "studio",    label: "3D Studio",      icon: "✦", desc: "Gallery & artwork" },
    { id: "lighting",  label: "Mood & Lighting", icon: "◎", desc: "Color & atmosphere" },
    { id: "guestbook", label: "Guestbook",       icon: "✉", desc: "Community notes" },
    { id: "feedback",  label: "Feedback",        icon: "◈", desc: "Critic dashboard" },
  ];
  return (
    <>
      <AnimatePresence>
        {isOpen && <motion.div key="backdrop" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <motion.aside key="drawer" className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col overflow-y-auto"
            style={{ background: "#fff" }} variants={drawerVariants as any} initial="hidden" animate="visible" exit="exit">
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
                  Browse, control lighting, write notes, and leave design critiques without signing in.
                </p>
              </div>
            </div>
            <nav className="px-6 py-6 flex-1">
              <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 mb-3">Spaces</p>
              <div className="space-y-1">
                {navItems.map(({ id, label, icon, desc }) => (
                  <motion.button key={id} id={`nav-${id}`}
                    onClick={() => { onScrollTo(id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${activeSection === id ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
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
//  ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string; }
class ModelErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" };
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message ?? "Load error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div style={{
            color: "#f87171", fontSize: 12, textAlign: "center", maxWidth: 200,
            background: "rgba(0,0,0,0.8)", padding: "12px 16px", borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.3)", backdropFilter: "blur(8px)",
          }}>
            ⚠ Model load failed<br />
            <span style={{ color: "#a1a1aa", fontSize: 10 }}>{this.state.message}</span><br />
            <span style={{ color: "#71717a", fontSize: 10 }}>Try a .glb file for best results</span>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  3D SCENE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Default sculpture ──────────────────────────────────────────────────────────
function DefaultSculpture() {
  const groupRef = useRef<THREE.Group>(null!);
  const r1 = useRef<THREE.Mesh>(null!);
  const r2 = useRef<THREE.Mesh>(null!);
  const r3 = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => {
    if (groupRef.current) groupRef.current.rotation.y += d * 0.2;
    if (r1.current) r1.current.rotation.z += d * 0.65;
    if (r2.current) r2.current.rotation.x += d * 0.5;
    if (r3.current) r3.current.rotation.y += d * 0.85;
  });
  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow>
        <torusKnotGeometry args={[0.9, 0.3, 256, 24, 2, 3]} />
        <meshStandardMaterial color="#d0d0d8" metalness={0.9} roughness={0.08} envMapIntensity={2.2} />
      </mesh>
      <mesh ref={r1} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.8, 0.04, 16, 128]} />
        <meshStandardMaterial color="#888" metalness={0.95} roughness={0.04} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow>
        <torusGeometry args={[2.1, 0.025, 16, 128]} />
        <meshStandardMaterial color="#666" metalness={0.95} roughness={0.04} />
      </mesh>
      <mesh ref={r3} rotation={[0, Math.PI / 3, Math.PI / 6]} castShadow>
        <torusGeometry args={[2.4, 0.018, 16, 128]} />
        <meshStandardMaterial color="#555" metalness={0.9} roughness={0.07} />
      </mesh>
      {[0,1,2,3,4,5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a)*1.8, Math.sin(a)*0.4, Math.sin(a)*1.8]} castShadow>
            <sphereGeometry args={[0.08, 32, 32]} />
            <meshStandardMaterial color="#fff" metalness={1} roughness={0} envMapIntensity={2.5} />
          </mesh>
        );
      })}
      {/* Pedestal */}
      <mesh position={[0, -1.6, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 1.1, 0.2, 64]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -1.72, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.08, 64]} />
        <meshStandardMaterial color="#111" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── Normalize helper: called in useFrame on first render ──────────────────────
function useFrameNormalize(groupRef: React.RefObject<THREE.Group>, dep: any) {
  const fitted = useRef(false);
  useEffect(() => { fitted.current = false; }, [dep]);
  useFrame(() => {
    if (fitted.current || !groupRef.current) return;
    fitted.current = true;
    const box    = new THREE.Box3().setFromObject(groupRef.current);
    if (box.isEmpty()) return;
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 0) return;
    const s = 2.0 / maxDim;
    groupRef.current.scale.setScalar(s);
    groupRef.current.position.set(-center.x * s, -center.y * s, -center.z * s);
  });
}

// ── GLTF/GLB model ────────────────────────────────────────────────────────────
function GLTFModel({ url, wireframe, metalness, roughness, channel, flatShade, doubleSide }:
  { url: string; wireframe: boolean; metalness: number; roughness: number; channel: MatChannel; flatShade: boolean; doubleSide: boolean }) {
  const { scene } = useGLTF(url);
  const groupRef  = useRef<THREE.Group>(null!);

  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      const cloneMat = (m: THREE.Material) => {
        const cm = m.clone() as THREE.MeshStandardMaterial;
        if (cm.isMeshStandardMaterial) { cm.envMapIntensity = 1.5; }
        return cm;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(cloneMat)
        : cloneMat(mesh.material as THREE.Material);
    });
    return c;
  }, [scene]);

  useFrameNormalize(groupRef, clone);

  // Apply material overrides
  useEffect(() => {
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (channel === "normals") {
          // Apply normal visualization
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(() => new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }));
          } else {
            mesh.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
          }
          return;
        }
        const std = m as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial) { (m as any).wireframe = wireframe; return; }
        if (channel === "albedo")     { std.roughness = 1; std.metalness = 0; }
        else if (channel === "roughness") { std.color = new THREE.Color(std.roughness, std.roughness, std.roughness); }
        else if (channel === "metalness") { std.color = new THREE.Color(std.metalness, std.metalness, std.metalness); }
        else {
          std.metalness   = metalness;
          std.roughness   = roughness;
        }
        std.wireframe   = wireframe;
        std.flatShading = flatShade;
        std.side        = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
        std.needsUpdate = true;
      });
    });
  }, [clone, wireframe, metalness, roughness, channel, flatShade, doubleSide]);

  return <group ref={groupRef}><primitive object={clone} /></group>;
}

// ── OBJ model ─────────────────────────────────────────────────────────────────
function OBJModel({ url, wireframe, metalness, roughness, channel, flatShade, doubleSide }:
  { url: string; wireframe: boolean; metalness: number; roughness: number; channel: MatChannel; flatShade: boolean; doubleSide: boolean }) {
  const obj      = useLoader(OBJLoader, url);
  const groupRef = useRef<THREE.Group>(null!);

  const clone = useMemo(() => {
    const c   = obj.clone(true);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness, roughness, envMapIntensity: 1.5 });
    c.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material      = mat.clone();
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
    });
    return c;
  }, [obj]);

  useFrameNormalize(groupRef, clone);

  useEffect(() => {
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (channel === "normals") {
        mesh.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
        return;
      }
      const std = mesh.material as THREE.MeshStandardMaterial;
      std.metalness   = metalness;
      std.roughness   = roughness;
      std.wireframe   = wireframe;
      std.flatShading = flatShade;
      std.side        = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
      std.needsUpdate = true;
    });
  }, [clone, wireframe, metalness, roughness, channel, flatShade, doubleSide]);

  return <group ref={groupRef}><primitive object={clone} /></group>;
}

// ── Dynamic router ─────────────────────────────────────────────────────────────
function ModelMesh(props: {
  url: string; ext: string; wireframe: boolean;
  metalness: number; roughness: number; channel: MatChannel; flatShade: boolean; doubleSide: boolean;
}) {
  if (props.ext === "obj") return <OBJModel {...props} />;
  return <GLTFModel {...props} />;
}

// ── Zoom rig ──────────────────────────────────────────────────────────────────
function ZoomRig({ zoomLevel }: { zoomLevel: number }) {
  const MIN = 1.0, MAX = 12;
  const target = MAX - (MAX - MIN) * zoomLevel;
  const { camera } = useThree();
  useFrame(() => {
    const cur = camera.position.length();
    if (Math.abs(cur - target) < 0.005) return;
    camera.position.multiplyScalar(THREE.MathUtils.lerp(cur, target, 0.1) / cur);
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
    const d = Math.max(camera.position.length(), 3);
    if      (preset === "front") camera.position.set(0, 0,   d);
    else if (preset === "side")  camera.position.set(d, 0,   0);
    else if (preset === "top")   camera.position.set(0, d,   0.001);
    else                         camera.position.set(d * 0.65, d * 0.38, d);
    camera.lookAt(0, 0, 0);
  }, [preset, camera]);
  return null;
}

// ── Studio lighting ──────────────────────────────────────────────────────────
function MoodLight({ lighting, exposure }: { lighting: LightingState; exposure: number }) {
  const { intensity, color, angle, posX, posY, posZ } = lighting;
  const k  = (intensity / 100) * exposure;
  const mi = k * 20; const si = k * 7; const fi = k * 5; const ri = k * 2.5;
  const pos: [number, number, number] = [posX, posY, posZ];

  return (
    <>
      <hemisphereLight color="#d8e8ff" groundColor="#14091a" intensity={0.6 * exposure} />
      <spotLight position={pos} target-position={[0,0,0]}
        angle={(Math.min(angle,82)*Math.PI)/180} penumbra={0.9} color={color}
        intensity={mi} castShadow shadow-mapSize={[4096,4096]}
        shadow-bias={-0.00003} shadow-camera-near={0.1} shadow-camera-far={60}
        decay={1.0} distance={60} />
      <directionalLight position={[-20,8,6]}  color={color} intensity={si} />
      <directionalLight position={[ 20,8,6]}  color={color} intensity={si} />
      <directionalLight position={[-posX*0.7, Math.max(posY*0.3,1), -posZ*0.7]} color={color} intensity={fi} />
      <directionalLight position={[0,5,-18]}  color="#88aaff" intensity={ri} />
      <pointLight position={[-18,3,0]} color={color} intensity={k*3.5} distance={40} decay={1.5} />
      <pointLight position={[ 18,3,0]} color={color} intensity={k*3.5} distance={40} decay={1.5} />
    </>
  );
}

// ── Reflective floor ──────────────────────────────────────────────────────────
function ReflectiveFloor({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <MeshReflectorMaterial blur={[300, 50]} resolution={1024} mixBlur={1} mixStrength={60}
        roughness={0.9} depthScale={1.2} minDepthThreshold={0.4} maxDepthThreshold={1.4}
        color="#050505" metalness={0.8} mirror={0.5} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO CANVAS
// ─────────────────────────────────────────────────────────────────────────────
interface HeroCanvasProps {
  lighting: LightingState; onLightingChange: (l: LightingState) => void;
  criticMode: boolean; onCanvasClick: (x: number, y: number, cx: number, cy: number) => void;
  fileUrl: string | null; fileExt: string | null; fileName: string | null;
  onFileUpload: (file: File) => void;
}

function HeroCanvas({ lighting, onLightingChange, criticMode, onCanvasClick, fileUrl, fileExt, fileName, onFileUpload }: HeroCanvasProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trackRef     = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);

  // Viewport controls
  const [zoomLevel,  setZoomLevel]  = useState(0.5);
  const [wireframe,  setWireframe]  = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [camPreset,  setCamPreset]  = useState<CamPreset>("perspective");
  const [metalness,  setMetalness]  = useState(0.5);
  const [roughness,  setRoughness]  = useState(0.45);
  const [showGrid,   setShowGrid]   = useState(false);
  const [showAxes,   setShowAxes]   = useState(false);
  const [showFloor,  setShowFloor]  = useState(false);
  const [flatShade,  setFlatShade]  = useState(false);
  const [doubleSide, setDoubleSide] = useState(false);
  const [channel,    setChannel]    = useState<MatChannel>("full");
  const [envPreset,  setEnvPreset]  = useState<EnvPreset>("studio");
  const [exposure,   setExposure]   = useState(1.0);
  const [bgColor,    setBgColor]    = useState("#040404");

  useEffect(() => {
    setWireframe(false); setAutoRotate(false); setCamPreset("perspective");
    setMetalness(0.5); setRoughness(0.45); setZoomLevel(0.5); setChannel("full"); setFlatShade(false);
  }, [fileUrl]);

  // Zoom slider drag
  const computeZoom = (e: { clientY: number }) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    setZoomLevel(1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)));
  };
  const onMouseMove = useCallback((e: MouseEvent) => { if (isDragging.current) computeZoom(e); }, []);
  const onMouseUp   = useCallback(() => { isDragging.current = false; }, []);
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) onFileUpload(file);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) onFileUpload(file); e.target.value = "";
  };
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!criticMode) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width)  * 100);
    const y = Math.round(((e.clientY - rect.top)  / rect.height) * 100);
    onCanvasClick(x, y, e.clientX, e.clientY);
  };
  const handleScreenshot = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a"); a.href = url;
    a.download = `3d-mood-${Date.now()}.png`; a.click();
  };

  const { color: sColor, intensity } = lighting;
  const sOpacity = intensity / 100;

  const toolBtn = (active: boolean, ac: string) =>
    `px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border backdrop-blur-md whitespace-nowrap ${active ? ac : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white border-white/10"}`;

  const CHANNEL_OPTS: { key: MatChannel; label: string }[] = [
    { key: "full",      label: "Full"   },
    { key: "albedo",    label: "Color"  },
    { key: "roughness", label: "Rough"  },
    { key: "metalness", label: "Metal"  },
    { key: "normals",   label: "Normal" },
  ];

  return (
    <div ref={canvasRef} onClick={handleCanvasClick}
      className={`relative w-full h-full overflow-hidden ${criticMode ? "cursor-crosshair" : "cursor-default"}`}
      style={{ background: bgColor }}>

      {/* Critic badge */}
      {criticMode && (
        <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 backdrop-blur-sm pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] font-bold text-red-400 tracking-wider">CRITIC MODE — Click to annotate</span>
        </div>
      )}

      {/* WebGL Canvas */}
      <div className="absolute inset-0 z-10">
        <Canvas shadows="soft" camera={{ position: [0, 0.5, 4], fov: 45 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure, outputColorSpace: THREE.SRGBColorSpace, preserveDrawingBuffer: true }}>
          <SoftShadows size={14} samples={20} focus={0.85} />
          <Environment preset={envPreset} environmentIntensity={0.5 * exposure} />
          <MoodLight lighting={lighting} exposure={exposure} />
          <ZoomRig zoomLevel={zoomLevel} />
          <CameraPresetRig preset={camPreset} />

          {showGrid && (
            <Grid position={[0,-1.1,0]} args={[30,30]} cellSize={0.5} cellThickness={0.4}
              cellColor="#2a2a2a" sectionSize={2} sectionThickness={0.8} sectionColor="#333"
              fadeDistance={20} fadeStrength={1} infiniteGrid />
          )}
          {showAxes && (
            <GizmoHelper alignment="bottom-left" margin={[60,60]}>
              <GizmoViewport axisColors={["#ff4060","#80ff60","#4080ff"]} labelColor="white" />
            </GizmoHelper>
          )}
          <ReflectiveFloor visible={showFloor} />

          {fileUrl ? (
            <ModelErrorBoundary>
              <Suspense fallback={
                <Html center>
                  <div style={{ color: "#a1a1aa", fontSize: 12, background: "rgba(0,0,0,0.7)", padding: "8px 14px", borderRadius: 8 }}>
                    Loading 3D model…
                  </div>
                </Html>
              }>
                <ModelMesh url={fileUrl} ext={fileExt!} wireframe={wireframe}
                  metalness={metalness} roughness={roughness} channel={channel}
                  flatShade={flatShade} doubleSide={doubleSide} />
                <ContactShadows position={[0,-1.04,0]} opacity={0.65} scale={12} blur={3} far={2.5} color={sColor} />
              </Suspense>
            </ModelErrorBoundary>
          ) : (
            <>
              <DefaultSculpture />
              <ContactShadows position={[0,-1.8,0]} opacity={0.45} scale={14} blur={3.5} far={4} color="#888" />
            </>
          )}

          <OrbitControls target={[0,0,0]} enableZoom={false} enablePan={false}
            minPolarAngle={0.05} maxPolarAngle={Math.PI*0.55} rotateSpeed={0.5}
            dampingFactor={0.07} enableDamping autoRotate={autoRotate} autoRotateSpeed={1.5} makeDefault />
        </Canvas>
      </div>

      {/* Upload drop zone */}
      {!fileUrl && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-auto">
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
            className={`w-64 h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all duration-300 ${isDragOver ? "border-white/50 scale-105" : "border-white/15 hover:border-white/30"}`}
            style={{ background: isDragOver ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)", boxShadow: isDragOver ? `0 0 40px ${sColor}20` : "none" }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.01 }}>
            <motion.div animate={{ y: isDragOver ? -8 : 0 }} transition={{ type:"spring", stiffness:400, damping:20 }}
              className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center mb-3" style={{ background: `${sColor}10` }}>
                <svg className="w-5 h-5" style={{ color: sColor, opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/60 mb-1">{isDragOver ? "Drop here" : "+ Upload 3D File"}</p>
              <p className="text-xs text-white/25">.gltf · .glb · .obj</p>
            </motion.div>
            <input ref={fileInputRef} type="file" accept=".gltf,.glb,.obj" className="hidden"
              onChange={handleFileChange} onClick={(e) => e.stopPropagation()} />
          </motion.div>
          {/* Pedestal base */}
          <div style={{ width:"260px", height:"18px", background:"linear-gradient(180deg,#2e2e2e 0%,#161616 60%,#0c0c0c 100%)", borderRadius:"6px 6px 0 0", boxShadow:`0 -4px 30px ${sColor}15` }} />
          <div style={{ width:"280px", height:"8px", background:"linear-gradient(180deg,#0e0e0e 0%,#060606 100%)", borderRadius:"0 0 3px 3px" }} />
        </div>
      )}

      {/* Model loaded — controls overlay */}
      <AnimatePresence>
        {fileUrl && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="absolute z-30 pointer-events-none" style={{ inset:0 }}>

            {/* File badge + screenshot */}
            <div className="absolute top-20 left-4 flex flex-col gap-2 pointer-events-auto">
              <div className="px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Model</p>
                <p className="text-xs font-mono text-white truncate max-w-[160px]">{fileName}</p>
              </div>
              <button onClick={handleScreenshot}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-[10px] text-zinc-400 hover:text-white hover:bg-white/12 transition-all backdrop-blur-md">
                📸 Screenshot
              </button>
            </div>

            {/* Bottom-left: camera + view tools */}
            <div className="absolute bottom-6 left-4 flex flex-col gap-2 pointer-events-auto">
              {/* Camera presets */}
              <div className="flex gap-1">
                {(["perspective","front","side","top"] as CamPreset[]).map((p) => (
                  <button key={p} onClick={() => { setCamPreset(p); setAutoRotate(false); }}
                    className={toolBtn(camPreset===p, "bg-white text-black border-white")}>
                    {p === "perspective" ? "3D" : p}
                  </button>
                ))}
              </div>
              {/* View tools row 1 */}
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setWireframe(w=>!w)} className={toolBtn(wireframe, "bg-cyan-400/20 text-cyan-300 border-cyan-400/40")}>Wire</button>
                <button onClick={() => setAutoRotate(r=>!r)} className={toolBtn(autoRotate, "bg-violet-400/20 text-violet-300 border-violet-400/40")}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${autoRotate ? "bg-violet-400 animate-ping" : "bg-zinc-600"}`} />Rotate
                </button>
                <button onClick={() => setShowGrid(g=>!g)} className={toolBtn(showGrid, "bg-emerald-400/20 text-emerald-300 border-emerald-400/40")}>Grid</button>
                <button onClick={() => setShowAxes(a=>!a)} className={toolBtn(showAxes, "bg-orange-400/20 text-orange-300 border-orange-400/40")}>XYZ</button>
                <button onClick={() => setShowFloor(f=>!f)} className={toolBtn(showFloor, "bg-blue-400/20 text-blue-300 border-blue-400/40")}>Floor</button>
              </div>
              {/* View tools row 2 */}
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setFlatShade(f=>!f)} className={toolBtn(flatShade, "bg-pink-400/20 text-pink-300 border-pink-400/40")}>Flat</button>
                <button onClick={() => setDoubleSide(d=>!d)} className={toolBtn(doubleSide, "bg-yellow-400/20 text-yellow-300 border-yellow-400/40")}>2-Side</button>
                {["#040404","#1a1a2e","#ffffff","#f5f5f0"].map((c) => (
                  <button key={c} onClick={() => setBgColor(c)}
                    className="w-6 h-6 rounded-lg border transition-all"
                    style={{ background:c, borderColor:bgColor===c?"white":"rgba(255,255,255,0.1)", transform:bgColor===c?"scale(1.2)":"scale(1)" }} />
                ))}
              </div>
              {/* Channel isolation */}
              <div className="flex gap-1">
                {CHANNEL_OPTS.map(({ key, label }) => (
                  <button key={key} onClick={() => setChannel(key)}
                    className={toolBtn(channel===key, "bg-white/20 text-white border-white/30")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom center: material + spotlight sliders */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-auto px-5 py-3 rounded-2xl backdrop-blur-md border border-white/10"
              style={{ background:"rgba(0,0,0,0.68)", minWidth:"260px" }}>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center mb-1">Material & Light</p>
              {[
                { label: "Metalness", value: metalness,        set: setMetalness,                        max: 100, raw: false },
                { label: "Roughness", value: roughness,        set: setRoughness,                        max: 100, raw: false },
                { label: "Exposure",  value: exposure,         set: (v:number) => setExposure(v),        max: 2,   raw: true,  step: 0.05 },
                { label: "Light X",   value: lighting.posX,    set: (v:number) => onLightingChange({...lighting, posX: v}), max: 20, min: -20, raw: true, step: 1 },
                { label: "Light Y",   value: lighting.posY,    set: (v:number) => onLightingChange({...lighting, posY: v}), max: 20, min: 0,   raw: true, step: 1 },
                { label: "Light Z",   value: lighting.posZ,    set: (v:number) => onLightingChange({...lighting, posZ: v}), max: 20, min: -20, raw: true, step: 1 },
              ].map(({ label, value, set, max, min = 0, raw, step = 1 }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 w-16 text-right shrink-0">{label}</span>
                  <input type="range" min={min} max={max} step={raw ? step : 1}
                    value={raw ? value : Math.round(value * 100)}
                    onChange={(e) => set(raw ? parseFloat(e.target.value) : parseInt(e.target.value) / 100)}
                    className="flex-1 h-1 accent-white cursor-pointer" />
                  <span className="text-[9px] font-mono text-zinc-400 w-8 text-right shrink-0">
                    {raw ? (Number.isInteger(step) ? Math.round(value) : value.toFixed(1)) : `${Math.round(value*100)}%`}
                  </span>
                </div>
              ))}
            </div>

            {/* Right: env presets + zoom slider */}
            <div className="absolute top-20 right-4 flex flex-col items-center gap-2 pointer-events-auto">
              {/* Env presets */}
              <div className="flex flex-col gap-1 mb-2">
                {ENV_PRESETS.map((e) => (
                  <button key={e.id} onClick={() => setEnvPreset(e.id)} title={e.label}
                    className={`w-8 h-8 rounded-xl text-sm flex items-center justify-center transition-all border backdrop-blur-md ${envPreset===e.id ? "bg-white/18 border-white/35 scale-110" : "bg-white/4 border-white/8 hover:bg-white/12"}`}>
                    {e.emoji}
                  </button>
                ))}
              </div>

              {/* Triangle zoom slider */}
              <div className="flex flex-col items-center gap-1">
                {/* Zoom IN */}
                <button onClick={() => setZoomLevel(Math.min(1, zoomLevel + 0.15))}
                  className="w-8 h-7 flex items-center justify-center hover:opacity-100 opacity-55 transition-opacity">
                  <svg viewBox="0 0 24 20" className="w-5 h-4"><polygon points="12,2 22,18 2,18" fill="white" /></svg>
                </button>
                {/* Track */}
                <div ref={trackRef} className="relative w-5 cursor-ns-resize select-none" style={{ height: 110 }}
                  onMouseDown={(e) => { isDragging.current = true; computeZoom(e); }}>
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/15 rounded-full" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-px rounded-full"
                    style={{ height: `${zoomLevel*100}%`, background: "rgba(255,255,255,0.45)" }} />
                  <div className="absolute left-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] cursor-grab active:cursor-grabbing"
                    style={{ top: `${(1-zoomLevel)*100}%`, transform: "translate(-50%, -50%)" }} />
                </div>
                {/* Zoom OUT */}
                <button onClick={() => setZoomLevel(Math.max(0, zoomLevel - 0.15))}
                  className="w-8 h-7 flex items-center justify-center hover:opacity-100 opacity-55 transition-opacity">
                  <svg viewBox="0 0 24 20" className="w-5 h-4"><polygon points="12,18 22,2 2,2" fill="white" /></svg>
                </button>
                <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Zoom</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-width background glow */}
      <>
        <div className="absolute top-0 inset-x-0 pointer-events-none z-[1] transition-all duration-700"
          style={{ height:"90%", background:`radial-gradient(ellipse 120% 100% at 50% 0%, ${sColor}${Math.round(sOpacity*190).toString(16).padStart(2,"0")} 0%, ${sColor}28 30%, ${sColor}10 55%, transparent 75%)` }} />
        <div className="absolute top-0 left-0 pointer-events-none z-[1]"
          style={{ width:"45%", height:"100%", background:`radial-gradient(ellipse 100% 80% at 0% 40%, ${sColor}${Math.round(sOpacity*72).toString(16).padStart(2,"0")} 0%, transparent 70%)` }} />
        <div className="absolute top-0 right-0 pointer-events-none z-[1]"
          style={{ width:"45%", height:"100%", background:`radial-gradient(ellipse 100% 80% at 100% 40%, ${sColor}${Math.round(sOpacity*72).toString(16).padStart(2,"0")} 0%, transparent 70%)` }} />
      </>

      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-20"
        style={{ background:"linear-gradient(to bottom, transparent, #000)" }} />

      <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none"
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.5 }}>
        <span className="text-[10px] text-white/20 tracking-widest uppercase">Scroll</span>
        <motion.div animate={{ y:[0,6,0] }} transition={{ duration:1.8, repeat:Infinity, ease:"easeInOut" }}
          className="w-[1px] h-8 rounded-full" style={{ background:`linear-gradient(to bottom, ${sColor}45, transparent)` }} />
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOOD & LIGHTING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function LightingSection({ lighting, onChange, sectionRef }:
  { lighting: LightingState; onChange: (l: LightingState) => void; sectionRef: React.RefObject<HTMLElement | null> }) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const selectPreset = (p: MoodPreset) => { setActivePreset(p.id); onChange(p.lighting); };
  const update = (key: keyof LightingState, value: any) => onChange({ ...lighting, [key]: value });

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="lighting" className="relative bg-black py-24 px-6 lg:px-16">
      <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none" style={{ background:"linear-gradient(to bottom, #000, transparent)" }} />
      <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }} variants={fadeUp as any} custom={0} className="max-w-6xl mx-auto mb-16">
        <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 02</p>
        <h2 className="text-4xl lg:text-5xl font-bold text-white">Set the Mood</h2>
        <p className="text-zinc-500 mt-3 text-lg">Choose an atmosphere, sculpt your light.</p>
      </motion.div>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Presets */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-6">Mood Presets</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {MOOD_PRESETS.map((preset, i) => {
              const isActive = activePreset === preset.id;
              return (
                <motion.button key={preset.id} id={`preset-${preset.id}`}
                  initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-50px" }} variants={fadeUp as any} custom={i}
                  onClick={() => selectPreset(preset)}
                  className="relative rounded-2xl p-5 text-left border transition-all duration-300 overflow-hidden"
                  style={{ background:isActive?`linear-gradient(135deg,${preset.gradientFrom}25,${preset.gradientTo}15)`:"rgba(255,255,255,0.02)", borderColor:isActive?preset.accentColor+"50":"rgba(255,255,255,0.05)", boxShadow:isActive?`0 0 30px ${preset.accentColor}15`:"none" }}
                  whileHover={{ scale:1.02, y:-3 }} whileTap={{ scale:0.98 }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:`linear-gradient(90deg,${preset.gradientFrom},${preset.gradientTo})`, opacity:isActive?1:0.3 }} />
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

        {/* Color + Direction */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={0}>
            <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-5">Spotlight Color</p>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <motion.button key={c} onClick={() => update("color", c)}
                  className="relative rounded-2xl transition-all duration-200"
                  style={{ width:"52px", height:"52px", background:c, boxShadow:lighting.color===c?`0 0 20px ${c}80, 0 0 0 3px rgba(255,255,255,0.9)`:`0 0 0 1px rgba(255,255,255,0.06)`, transform:lighting.color===c?"scale(1.15)":"scale(1)" }}
                  whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}>
                  {lighting.color === c && (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute inset-0 rounded-2xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full" style={{ background:c==="#FFFFFF"||c==="#F0F0F0"?"#000":"#fff" }} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={1}>
            <p className="text-xs font-bold tracking-widest uppercase text-zinc-600 mb-5">Light Direction</p>
            <div className="flex bg-white/5 rounded-2xl p-1.5 border border-white/10">
              {(["top","front","back","left","right"] as LightDir[]).map((dir) => (
                <button key={dir} onClick={() => update("direction", dir)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${lighting.direction===dir?"bg-white text-black shadow-lg":"text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                  {dir}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Intensity + Angle sliders */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={0}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-white/[0.05]" style={{ background:"rgba(255,255,255,0.02)" }}>
          {[
            { key:"intensity" as const, label:"Intensity", min:10, max:100, unit:"%" },
            { key:"angle"     as const, label:"Angle",     min:5,  max:90,  unit:"°" },
          ].map(({ key, label, min, max, unit }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
                <span className="text-xs font-mono" style={{ color:lighting.color }}>{lighting[key]}{unit}</span>
              </div>
              <input type="range" min={min} max={max} value={lighting[key]}
                onChange={(e) => update(key, parseInt(e.target.value))} className="w-full" />
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div className="h-full rounded-full" animate={{ width:`${((lighting[key]-min)/(max-min))*100}%` }}
                  style={{ background:`linear-gradient(90deg, ${lighting.color}40, ${lighting.color})` }} />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background:"linear-gradient(to bottom, transparent, #030303)" }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GUESTBOOK  — order by id (no created_at column)
// ─────────────────────────────────────────────────────────────────────────────
function GuestbookSection({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [entries,    setEntries]    = useState<GuestbookEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState({ name:"", content:"", color:GUESTBOOK_COLORS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [fetchErr,   setFetchErr]   = useState<string | null>(null);

  // ── READ: mount 시 자동 fetch (id 기준 정렬 — created_at 없음) ──────────────
  const fetchEntries = useCallback(async () => {
    setFetchErr(null);
    try {
      const { data, error } = await supabase
        .from("guestbook")
        .select("*")               // fetch all available columns
        .order("id", { ascending: false })  // created_at 없으므로 id 사용
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
    const ch = supabase.channel("guestbook-rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"guestbook" }, (payload) => {
        setEntries((prev) => {
          if (prev.some(e => e.optimistic)) return prev.map(e => e.optimistic ? (payload.new as GuestbookEntry) : e);
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

    const optimistic: GuestbookEntry = {
      id: Date.now(), name: form.name.trim(), content: form.content.trim(),
      color: form.color, optimistic: true,
    };
    setEntries(prev => [optimistic, ...prev]);
    const snap = { ...form };
    setForm({ name:"", content:"", color:GUESTBOOK_COLORS[0] });

    try {
      // id & created_at are auto-generated — do NOT include them
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
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="guestbook" className="relative py-24 px-6 lg:px-16" style={{ background:"#030303" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }} variants={fadeUp as any} custom={0} className="mb-16">
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
                  <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background:GUESTBOOK_COLORS[i%8]+"30" }} />
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
                      style={{ background:entry.color }}
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
          {/* Form */}
          <motion.form onSubmit={handleSubmit}
            initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={1}
            className="rounded-2xl p-6 space-y-4 sticky top-24"
            style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <h3 className="font-bold text-white mb-0.5">Leave a note</h3>
              <p className="text-xs text-zinc-500">Your message to the world</p>
            </div>
            {error && <div className="px-3 py-2 bg-red-900/20 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>}
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
            <motion.button type="submit" disabled={submitting||!form.name.trim()||!form.content.trim()}
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
//  FEEDBACK DASHBOARD  — order by id
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
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="feedback" className="relative py-24 px-6 lg:px-16 pb-32" style={{ background:"#050505" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-100px" }} variants={fadeUp as any} custom={0} className="mb-16">
          <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-600 mb-2">Step 04</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">Feedback Dashboard</h2>
          <p className="text-zinc-500 mt-3 text-lg">Critic annotations from the 3D studio canvas.</p>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label:"Total Reviews", value:critics.length.toString(), icon:"◈", color:"#A855F7" },
            { label:"Avg Rating",    value:avgRating,                 icon:"★", color:"#FBBF24" },
            { label:"Top Category",  value:topCat,                    icon:"▲", color:"#4ADE80" },
            { label:"Realtime",      value:"Live",                    icon:"◉", color:"#FB923C" },
          ].map((s,i) => (
            <motion.div key={s.label} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={i}
              className="rounded-2xl p-5 border border-white/[0.04]" style={{ background:"rgba(255,255,255,0.02)" }}>
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className="text-3xl font-bold font-mono" style={{ color:s.color }}>{s.value}</p>
              <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp as any} custom={0}
          className="rounded-2xl overflow-hidden border border-white/[0.05]" style={{ background:"rgba(255,255,255,0.015)" }}>
          <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Design Evaluations</h3>
            <button onClick={fetchCritics} className="text-xs text-zinc-600 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">↻ Refresh</button>
          </div>
          {error && <div className="px-6 py-4 text-sm text-red-400 bg-red-900/10">{error}</div>}
          {loading ? <div className="px-6 py-16 text-center text-zinc-700 text-sm">Loading…</div>
          : critics.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <p className="text-4xl mb-3">◈</p>
              <p className="text-zinc-500 text-sm font-medium">No evaluations yet</p>
            </div>
          ) : (
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
          )}
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
  const [form, setForm]       = useState({ name:"", category:CRITIC_CATEGORIES[0], comment:"", rating:3 });
  const [sub,  setSub]        = useState(false);
  const [hover, setHover]     = useState(0);

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
  const top  = typeof window!=="undefined" ? Math.min(popover.y, window.innerHeight-430) : popover.y;

  return (
    <motion.div key="critic-popover" variants={popoverVariants as any} initial="hidden" animate="visible" exit="exit"
      className="fixed z-50 w-72 rounded-2xl overflow-hidden shadow-2xl"
      style={{ left, top, background:"rgba(10,10,10,0.97)", border:"1px solid rgba(255,255,255,0.1)", backdropFilter:"blur(20px)" }}>
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
              {type==="area" ? (
                <textarea value={(form as any)[key]} rows={3} maxLength={max} placeholder={placeholder}
                  onChange={(e) => setForm({...form,[key]:e.target.value})}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }} />
              ) : (
                <input type="text" value={(form as any)[key]} maxLength={max} placeholder={placeholder}
                  onChange={(e) => setForm({...form,[key]:e.target.value})}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/20"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }} />
              )}
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
                <button key={star} type="button" onClick={() => setForm({...form,rating:star})}
                  onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
                  className="text-2xl leading-none transition-transform hover:scale-125"
                  style={{ color:star<=(hover||form.rating)?"#FBBF24":"#27272a" }}>★</button>
              ))}
            </div>
          </div>
          <motion.button type="submit" disabled={sub||!form.name.trim()||!form.comment.trim()}
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
//  ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function ThreeDMoodApp() {
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [criticMode,    setCriticMode]    = useState(false);
  const [activeSection, setActiveSection] = useState("studio");
  const [fileUrl,       setFileUrl]       = useState<string | null>(null);
  const [fileExt,       setFileExt]       = useState<string | null>(null);
  const [fileName,      setFileName]      = useState<string | null>(null);
  const [lighting,      setLighting]      = useState<LightingState>({
    intensity: 70, color: "#FFFFFF", angle: 60, direction: "top", posX: 3, posY: 9, posZ: 3,
  });
  const [popover, setPopover] = useState<PopoverState>({ visible:false, x:0, y:0, canvasX:0, canvasY:0 });

  const studioRef    = useRef<HTMLElement | null>(null);
  const lightingRef  = useRef<HTMLElement | null>(null);
  const guestbookRef = useRef<HTMLElement | null>(null);
  const feedbackRef  = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const refs = [
      { id:"studio",    ref:studioRef },
      { id:"lighting",  ref:lightingRef },
      { id:"guestbook", ref:guestbookRef },
      { id:"feedback",  ref:feedbackRef },
    ];
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { const f = refs.find(r => r.ref.current===e.target); if (f) setActiveSection(f.id); } }),
      { rootMargin:"-40% 0px -40% 0px", threshold:0 }
    );
    refs.forEach(({ ref }) => { if (ref.current) observer.observe(ref.current); });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const map: Record<string,React.RefObject<HTMLElement|null>> = {
      studio:studioRef, lighting:lightingRef, guestbook:guestbookRef, feedback:feedbackRef,
    };
    map[id]?.current?.scrollIntoView({ behavior:"smooth", block:"start" });
  };

  const handleFileUpload = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["gltf","glb","obj"].includes(ext)) { alert("Only .gltf, .glb, and .obj files are supported."); return; }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(file));
    setFileExt(ext);
    setFileName(file.name);
  };

  const handleCriticSubmit = async (data: Omit<CriticEntry,"id"|"created_at">) => {
    // id & created_at are auto-generated — do NOT pass them
    const { error } = await supabase.from("critics").insert({
      name: data.name, x_coord: data.x_coord, y_coord: data.y_coord,
      category: data.category, comment: data.comment, rating: data.rating,
    });
    if (error) throw new Error(error.message);
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      {/* Fixed Header */}
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

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }} className="hidden lg:flex items-center gap-2">
          {["studio","lighting","guestbook","feedback"].map(id => (
            <button key={id} onClick={() => scrollToSection(id)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 group"
              style={{ background:activeSection===id?"rgba(255,255,255,0.08)":"transparent" }}>
              <span className="rounded-full transition-all duration-300"
                style={{ width:activeSection===id?"6px":"4px", height:activeSection===id?"6px":"4px", background:activeSection===id?"#fff":"rgba(255,255,255,0.2)" }} />
              <span className={`text-[10px] font-semibold transition-all duration-300 ${activeSection===id?"text-white opacity-100":"text-zinc-600 opacity-0 group-hover:opacity-100"}`}>
                {id==="studio"?"3D Studio":id==="lighting"?"Mood":id==="guestbook"?"Guestbook":"Feedback"}
              </span>
            </button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
          className="flex items-center gap-3">
          <CriticModeSwitch enabled={criticMode} onToggle={() => { setCriticMode(!criticMode); if (!criticMode) scrollToSection("studio"); }} />
          <HamburgerButton isOpen={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)} />
        </motion.div>
      </header>

      <NavigationDrawer isOpen={drawerOpen} activeSection={activeSection} onScrollTo={scrollToSection} onClose={() => setDrawerOpen(false)} />

      {/* 3D Studio */}
      <section ref={studioRef} id="studio" className="relative" style={{ height:"100vh" }}>
        <div className="sticky top-16 w-full" style={{ height:"calc(100vh - 64px)" }}>
          <HeroCanvas
            lighting={lighting} onLightingChange={setLighting}
            criticMode={criticMode}
            onCanvasClick={(x,y,cx,cy) => { if (criticMode) setPopover({ visible:true, x:cx+12, y:cy-20, canvasX:x, canvasY:y }); }}
            fileUrl={fileUrl} fileExt={fileExt} fileName={fileName}
            onFileUpload={handleFileUpload}
          />
        </div>
      </section>

      <LightingSection  lighting={lighting} onChange={setLighting} sectionRef={lightingRef} />
      <GuestbookSection sectionRef={guestbookRef} />
      <FeedbackSection  sectionRef={feedbackRef} />

      <AnimatePresence>
        {popover.visible && (
          <CriticPopover key="popover" popover={popover}
            onClose={() => setPopover(p => ({...p, visible:false}))}
            onSubmit={handleCriticSubmit} />
        )}
      </AnimatePresence>

      <footer className="border-t border-white/[0.03] px-6 lg:px-10 py-8" style={{ background:"#050505" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-[9px] font-black">3D</span>
            </div>
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
