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
function ParallaxImage({ imageUrl, depthData, intensity }: { imageUrl: string; depthData: any; intensity: number }) {
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
      matRef.current.uIntensity = intensity;
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
          uIntensity={intensity}
          transparent
        />
      ) : (
        <meshBasicMaterial map={texture} transparent />
      )}
    </mesh>
  );
}

// ── Main Scene Content ──
function SceneContent({ imageUrl, depthData, intensity }: { imageUrl: string | null; depthData: any; intensity: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <Environment preset="city" />
      {imageUrl ? (
        <Suspense fallback={null}>
          <ParallaxImage imageUrl={imageUrl} depthData={depthData} intensity={intensity} />
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
const loadBrowserImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the uploaded image."));
    image.src = src;
  });

const createFallbackDepthMap = async (imageUrl: string) => {
  const image = await loadBrowserImage(imageUrl);
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available for depth fallback.");

  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const depth = new Uint8Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  const maxDistance = Math.hypot(cx, cy) || 1;

  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 1) {
    const x = j % width;
    const y = Math.floor(j / width);
    const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    const alpha = pixels[i + 3] / 255;
    const centerBias = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / maxDistance);
    const value = luminance * 0.68 + centerBias * 82;
    depth[j] = Math.max(0, Math.min(255, Math.round(value * alpha)));
  }

  return {
    data: depth.buffer,
    width,
    height,
    channels: 1,
    fallback: true,
  };
};

export default function DepthStudioScene() {
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  
  const [depthData, setDepthData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadItem, setDownloadItem] = useState<string>("");
  const [intensity, setIntensity] = useState<number>(0.06);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pipelineRef = useRef<any>(null); // Cache the pipeline after first load

  // Run depth estimation directly (no Web Worker — avoids Turbopack bundling issues)
  const runDepthAI = async (imageUrl: string) => {
    try {
      setIsProcessing(true);
      setDepthData(null);
      setErrorMsg(null);
      setDownloadProgress(0);

      // First time: load the transformers library + model
      if (!pipelineRef.current) {
        setLoadingMsg("INITIALIZING LOCAL AI...");

        // Dynamically import to avoid SSR issues
        const transformers = await import('@xenova/transformers');
        const env = transformers.env;
        const pipeline = transformers.pipeline;

        if (env) {
          // Force 100% local execution
          env.allowLocalModels = true;
          env.allowRemoteModels = false;
          env.localModelPath = '/model/'; // Points to /public/model/
          env.useBrowserCache = false; // Disable indexDB cache since files are local
          if (env.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.wasmPaths = '/onnx/'; // Points to /public/onnx/
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.proxy = false;
          }
        }

        pipelineRef.current = await pipeline(
          'depth-estimation',
          'Xenova/depth-anything-small-hf',
          {
            progress_callback: (x: any) => {
              if (x?.status === 'progress' && typeof x.progress === 'number') {
                setDownloadProgress(Math.round(x.progress));
              }
              if (x?.file) setDownloadItem(x.file);
            },
          }
        );
      }

      setLoadingMsg("ESTIMATING DEPTH...");

      const output = await pipelineRef.current(imageUrl);
      console.log("Pipeline output:", output);
      
      const depthImage = output?.depth;
      if (!depthImage || !depthImage.data) {
        throw new Error("Invalid output from AI model: " + JSON.stringify(output));
      }

      setDepthData({
        data: depthImage.data.slice(0).buffer,
        width: depthImage.width,
        height: depthImage.height,
        channels: depthImage.channels,
      });
      setIsProcessing(false);
    } catch (err: any) {
      console.warn('[DepthAI] Falling back to browser depth map:', err);
      try {
        setLoadingMsg("BUILDING DEPTH MAP...");
        const fallbackDepth = await createFallbackDepthMap(imageUrl);
        setDepthData(fallbackDepth);
        setErrorMsg(null);
      } catch (fallbackErr: any) {
        console.error('[DepthAI]', err);
        console.error('[DepthFallback]', fallbackErr);
        setErrorMsg(fallbackErr?.message || err?.message || String(err));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Trigger when image changes
  useEffect(() => {
    if (uploadedImage) {
      runDepthAI(uploadedImage);
    } else {
      setDepthData(null);
      setIsProcessing(false);
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImage]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
          <SceneContent imageUrl={uploadedImage} depthData={depthData} intensity={intensity} />
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

      {/* ── Error Overlay ── */}
      {errorMsg && !isProcessing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none">
          <div className="w-16 h-16 rounded-2xl border border-red-500/30 flex items-center justify-center mb-6 bg-red-500/10">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-sm font-bold text-red-400 tracking-widest uppercase mb-3">AI Error</p>
          <p className="text-[10px] font-mono text-zinc-400 text-center max-w-[280px] bg-zinc-900/80 rounded-xl p-3 leading-relaxed">{errorMsg}</p>
          <button
            className="mt-4 pointer-events-auto px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-white/10 transition-colors"
            onClick={() => { setErrorMsg(null); useAppStore.setState({ uploadedImage: null }); }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Help Text if empty ── */}
      {!uploadedImage && !isProcessing && !errorMsg && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 bg-emerald-500/10">
            <span className="text-3xl">🕳</span>
          </div>
          <p className="text-sm font-bold text-zinc-400 tracking-widest uppercase">Upload an Image</p>
          <p className="text-xs text-zinc-600 mt-2">to generate a 3D Depth Map</p>
        </div>
      )}

      {/* ── Dedicated Depth AI UI ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
        
        {/* Upload Button */}
        <label className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/5 group">
          <span className="text-xl group-hover:scale-110 transition-transform">🖼️</span>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const previousImage = useAppStore.getState().uploadedImage;
                if (previousImage?.startsWith('blob:')) {
                  URL.revokeObjectURL(previousImage);
                }
                const imageUrl = URL.createObjectURL(file);
                useAppStore.setState({ uploadedImage: imageUrl });
              }
              e.target.value = "";
            }} 
          />
        </label>

        {/* Separator */}
        <div className="w-[1px] h-8 bg-white/10 mx-4" />

        {/* AI Depth Controls (only show if image uploaded) */}
        <div className={`flex items-center gap-6 px-2 transition-opacity duration-500 ${uploadedImage ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center w-32">
              <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">Parallax</span>
              <span className="text-[9px] font-mono text-emerald-400">{(intensity * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" min="0" max="0.1" step="0.01" value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-32 h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500" 
            />
          </div>
        </div>

        {/* Export Button */}
        <div className="w-[1px] h-8 bg-white/10 mx-4" />
        <button 
          className={`flex items-center justify-center px-4 h-12 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all border ${
            uploadedImage && depthData
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30' 
              : 'bg-black/40 border-white/5 text-zinc-600 pointer-events-none'
          }`}
          onClick={() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
              const link = document.createElement('a');
              link.download = 'depth-parallax-export.png';
              link.href = canvas.toDataURL();
              link.click();
            }
          }}
        >
          Snapshot
        </button>
      </div>

    </div>
  );
}
