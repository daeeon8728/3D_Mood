"use client";

import React, { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, Environment, shaderMaterial, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "./store/useStore";
import StudioDock from "./StudioDock";
import { motion, AnimatePresence } from "framer-motion";

// ── Custom Parallax Shader Material ──
const ParallaxMaterial = shaderMaterial(
  {
    uTexture: null,
    uDepthMap: null,
    uMouse: new THREE.Vector2(0, 0),
    uIntensity: 0.08,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform sampler2D uTexture;
    uniform sampler2D uDepthMap;
    uniform vec2 uMouse;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      // Read depth from the red channel
      float depth = texture2D(uDepthMap, vUv).r;
      
      // Calculate UV offset based on mouse position and depth value
      // The subtraction centers the depth effect around 0.5
      vec2 parallax = uMouse * uIntensity * (depth - 0.5);
      
      // Sample the original texture with the new offset UVs
      vec4 color = texture2D(uTexture, vUv + parallax);
      
      gl_FragColor = color;
    }
  `
);

extend({ ParallaxMaterial });

// ── Image with Parallax Mesh ──
function ParallaxImage({ imageUrl, depthData }: { imageUrl: string; depthData: any }) {
  const texture = useTexture(imageUrl);
  const matRef = useRef<any>(null);

  // Convert raw worker data into a Three.js DataTexture
  const depthTexture = useMemo(() => {
    if (!depthData) return null;
    const tex = new THREE.DataTexture(
      new Uint8Array(depthData.data),
      depthData.width,
      depthData.height,
      depthData.channels === 1 ? THREE.RedFormat : THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    tex.flipY = true; // Match standard texture flipping
    tex.needsUpdate = true;
    return tex;
  }, [depthData]);

  // Handle aspect ratio
  const img = texture.image as any;
  const aspect = img.width / img.height;
  const width = aspect > 1 ? 5 : 5 * aspect;
  const height = aspect > 1 ? 5 / aspect : 5;

  useFrame((state) => {
    if (matRef.current) {
      // Smoothly interpolate mouse position for a buttery parallax effect
      matRef.current.uMouse.x = THREE.MathUtils.lerp(matRef.current.uMouse.x, state.mouse.x, 0.05);
      matRef.current.uMouse.y = THREE.MathUtils.lerp(matRef.current.uMouse.y, state.mouse.y, 0.05);
    }
  });

  return (
    <mesh>
      <planeGeometry args={[width, height, 64, 64]} />
      {depthTexture ? (
        // @ts-ignore
        <parallaxMaterial
          ref={matRef}
          uTexture={texture}
          uDepthMap={depthTexture}
          uIntensity={0.06}
          transparent
        />
      ) : (
        <meshBasicMaterial map={texture} transparent />
      )}
    </mesh>
  );
}

// ── Main Scene Content ──
function SceneContent({ imageUrl, depthData }: { imageUrl: string | null; depthData: any }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <Environment preset="city" />
      {imageUrl ? (
        <Suspense fallback={null}>
          <ParallaxImage imageUrl={imageUrl} depthData={depthData} />
        </Suspense>
      ) : null}
      
      {/* Subtle background grid to give spatial context */}
      <gridHelper args={[20, 20, "#111", "#050505"]} position={[0, -3, 0]} />
      
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2 + 0.1}
        minPolarAngle={Math.PI / 2 - 0.1}
        maxAzimuthAngle={0.2}
        minAzimuthAngle={-0.2}
      />
    </>
  );
}

// ── Exported Component ──
export default function DepthStudioScene() {
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  
  const [depthData, setDepthData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadItem, setDownloadItem] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL("./workers/depthWorker.ts", import.meta.url));
    workerRef.current.onmessage = (e) => {
      const { status, message, data, width, height, channels } = e.data;
      if (status === "loading" || status === "processing") {
        setIsProcessing(true);
        if (message) setLoadingMsg(message);
      } else if (status === "progress" && data) {
        if (data.status === 'progress' && typeof data.progress === 'number') {
          setDownloadProgress(Math.round(data.progress));
          if (data.file) setDownloadItem(data.file);
        }
      } else if (status === "complete") {
        setDepthData({ data, width, height, channels });
        setIsProcessing(false);
      } else if (status === "error") {
        console.error("Depth AI Error:", message);
        setIsProcessing(false);
        setLoadingMsg("Error generating depth map.");
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Trigger Worker when image changes
  useEffect(() => {
    if (uploadedImage && workerRef.current) {
      setDepthData(null);
      setIsProcessing(true);
      setDownloadProgress(0);
      setLoadingMsg("INITIALIZING AI MODEL...");
      workerRef.current.postMessage({ imageUrl: uploadedImage });
    } else {
      setDepthData(null);
      setIsProcessing(false);
    }
  }, [uploadedImage]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          <SceneContent imageUrl={uploadedImage} depthData={depthData} />
        </Canvas>
      </div>

      {/* ── Badge ── */}
      <div className="absolute top-20 left-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ADE80]" />
          <p className="text-[9px] font-bold tracking-widest uppercase text-emerald-500">
            Depth Engine
          </p>
        </div>
        <p className="text-[11px] text-zinc-400" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          AI Parallax Space
        </p>
      </div>

      {/* ── Loading Overlay ── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none"
          >
            <div className="w-16 h-16 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 bg-emerald-500/10">
              <motion.span
                className="text-3xl"
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                🕳
              </motion.span>
            </div>
            <p className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-4">
              {loadingMsg}
            </p>
            
            {/* Progress Bar */}
            <div className="w-64 max-w-[80vw] bg-zinc-900 rounded-full h-1.5 mb-2 overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                className="bg-emerald-500 h-full shadow-[0_0_10px_#10b981]"
                initial={{ width: 0 }}
                animate={{ width: `${downloadProgress}%` }}
                transition={{ ease: "linear", duration: 0.2 }}
              />
            </div>
            
            <div className="flex justify-between w-64 text-[10px] text-zinc-500 font-mono">
              <span className="truncate pr-4">{downloadItem || "Downloading Model..."}</span>
              <span>{downloadProgress}%</span>
            </div>

            <p className="text-[10px] text-zinc-400 text-center max-w-[250px] mt-8 leading-relaxed">
              First-time generation requires downloading a 40MB AI model.<br/>This ensures 100% private, free, and infinite usage.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Help Text if empty ── */}
      {!uploadedImage && !isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm font-bold text-zinc-500 tracking-widest uppercase">Upload an image below</p>
          <p className="text-xs text-zinc-600 mt-2">to experience AI Depth Parallax</p>
        </div>
      )}

      {/* ── Integrated Studio Dock ── */}
      <StudioDock />
    </div>
  );
}
