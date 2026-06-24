"use client";

// ── Example images bundled with the app ──
const EXAMPLE_IMAGES = [
  {
    id: "concrete",
    label: "Concrete",
    src: "/example-concrete.jpg",
    emoji: "🪨",
  },
];

import React, { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import { OrbitControls, shaderMaterial, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "./store/useStore";
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
  // Fragment Shader — purely texture-driven, no env reflections
  `
    uniform sampler2D uTexture;
    uniform sampler2D uDepthMap;
    uniform vec2 uMouse;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      float depth = texture2D(uDepthMap, vUv).r;
      vec2 parallax = uMouse * uIntensity * (depth - 0.5);
      vec4 color = texture2D(uTexture, vUv + parallax);
      gl_FragColor = color;
    }
  `
);

extend({ ParallaxMaterial });

// ── Black background scene setup ──
function SceneBackground() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color("#0f0f0f");
  }, [scene]);
  return null;
}

// ── Canvas ref forwarder for export ──
function CanvasCapture({ onReady }: { onReady: (gl: THREE.WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { onReady(gl); }, [gl, onReady]);
  return null;
}

// ── Image with Parallax Mesh ──
function ParallaxImage({ imageUrl, depthData, intensity }: { imageUrl: string; depthData: any; intensity: number }) {
  const texture = useTexture(imageUrl);
  const matRef = useRef<any>(null);

  // Convert raw depth data into a Three.js DataTexture
  const depthTexture = useMemo(() => {
    if (!depthData) return null;
    const tex = new THREE.DataTexture(
      new Uint8Array(depthData.data),
      depthData.width,
      depthData.height,
      depthData.channels === 1 ? THREE.RedFormat : THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  }, [depthData]);

  const img = texture.image as any;
  const aspect = img.width / img.height;
  const width = aspect > 1 ? 5 : 5 * aspect;
  const height = aspect > 1 ? 5 / aspect : 5;

  useFrame((state) => {
    if (matRef.current) {
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
        // No-reflection fallback: meshStandardMaterial with envMapIntensity=0
        <meshStandardMaterial
          map={texture}
          metalness={0}
          roughness={0.5}
          envMapIntensity={0}
          transparent
        />
      )}
    </mesh>
  );
}

// ── Main Scene Content — no Environment preset, clean canvas lighting ──
function SceneContent({
  imageUrl,
  depthData,
  intensity,
  onGl,
}: {
  imageUrl: string | null;
  depthData: any;
  intensity: number;
  onGl: (gl: THREE.WebGLRenderer) => void;
}) {
  return (
    <>
      <SceneBackground />
      <CanvasCapture onReady={onGl} />

      {/* Pure lighting — no environment map reflections */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-4, -3, 3]} intensity={0.4} color="#aaccff" />

      {imageUrl ? (
        <Suspense fallback={null}>
          <ParallaxImage imageUrl={imageUrl} depthData={depthData} intensity={intensity} />
        </Suspense>
      ) : null}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2 + 0.1}
        minPolarAngle={Math.PI / 2 - 0.1}
        maxAzimuthAngle={0.3}
        minAzimuthAngle={-0.3}
      />
    </>
  );
}

// ── Fallback depth map (luminance + center-bias) ──
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
  return { data: depth.buffer, width, height, channels: 1, fallback: true };
};

// ── Thumbnail strip item ──
function ThumbItem({
  url,
  active,
  onClick,
  onRemove,
}: {
  url: string;
  active: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.75 }}
      className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
        active ? "border-emerald-400 shadow-[0_0_12px_#4ADE8080]" : "border-white/10 hover:border-white/30"
      }`}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500/80 text-white text-[9px] flex items-center justify-center transition-colors z-10"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        ×
      </button>
    </motion.div>
  );
}

// ── Main exported component ──
export default function DepthStudioScene() {
  const uploadedImage = useAppStore((s) => s.uploadedImage);

  const [gallery, setGallery] = useState<string[]>([]); // Thumbnail list (data URLs)
  const [depthData, setDepthData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadItem, setDownloadItem] = useState<string>("");
  const [intensity, setIntensity] = useState<number>(0.06);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pipelineRef = useRef<any>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  const handleGl = useCallback((gl: THREE.WebGLRenderer) => {
    glRef.current = gl;
  }, []);

  // ── Add image to gallery and set as active ──
  const activateImage = (dataUrl: string) => {
    setGallery((prev) => {
      if (prev.includes(dataUrl)) return prev;
      return [...prev, dataUrl];
    });
    useAppStore.setState({ uploadedImage: dataUrl });
  };

  const removeFromGallery = (url: string) => {
    setGallery((prev) => prev.filter((u) => u !== url));
    if (uploadedImage === url) {
      useAppStore.setState({ uploadedImage: null });
    }
  };

  // ── Run depth estimation (local model, no Worker) ──
  const runDepthAI = async (imageUrl: string) => {
    try {
      setIsProcessing(true);
      setDepthData(null);
      setErrorMsg(null);
      setDownloadProgress(0);

      if (!pipelineRef.current) {
        setLoadingMsg("INITIALIZING LOCAL AI...");
        const transformers = await import("@xenova/transformers");
        const env = transformers.env;
        const pipeline = transformers.pipeline;

        if (env) {
          env.allowLocalModels = true;
          env.allowRemoteModels = false;
          env.localModelPath = "/model/";
          env.useBrowserCache = false;
          if (env.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.wasmPaths = "/onnx/";
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.proxy = false;
          }
        }

        pipelineRef.current = await pipeline(
          "depth-estimation",
          "Xenova/depth-anything-small-hf",
          {
            progress_callback: (x: any) => {
              if (x?.status === "progress" && typeof x.progress === "number") {
                setDownloadProgress(Math.round(x.progress));
              }
              if (x?.file) setDownloadItem(x.file);
            },
          }
        );
      }

      setLoadingMsg("ESTIMATING DEPTH...");
      const output = await pipelineRef.current(imageUrl);
      const depthImage = output?.depth;
      if (!depthImage || !depthImage.data) {
        throw new Error("Invalid output from AI model.");
      }

      setDepthData({
        data: depthImage.data.slice(0).buffer,
        width: depthImage.width,
        height: depthImage.height,
        channels: depthImage.channels,
      });
      setIsProcessing(false);
    } catch (err: any) {
      console.warn("[DepthAI] Falling back to browser depth map:", err);
      try {
        setLoadingMsg("BUILDING DEPTH MAP...");
        const fallback = await createFallbackDepthMap(imageUrl);
        setDepthData(fallback);
        setErrorMsg(null);
      } catch (fbErr: any) {
        setErrorMsg(fbErr?.message || err?.message || String(err));
      } finally {
        setIsProcessing(false);
      }
    }
  };

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

  // ── PNG export via gl.domElement.toDataURL ──
  const handleExport = () => {
    if (!glRef.current) return;
    const link = document.createElement("a");
    link.download = `moodboard-${Date.now()}.png`;
    link.href = glRef.current.domElement.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="relative w-full h-full bg-[#0f0f0f] overflow-hidden" style={{ isolation: "isolate" }}>
      {/* ── 3D Canvas ── */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 2]}
        >
          <SceneContent
            imageUrl={uploadedImage}
            depthData={depthData}
            intensity={intensity}
            onGl={handleGl}
          />
        </Canvas>
      </div>

      {/* ── Badge ── */}
      <div className="absolute top-20 left-6 z-20 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ADE80]" />
          <p className="text-[9px] font-bold tracking-widest uppercase text-emerald-500">Depth Engine</p>
        </div>
        <p className="text-[11px] text-zinc-400" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          AI Parallax Space
        </p>
      </div>

      {/* ── Loading Overlay ── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none"
          >
            <div className="w-16 h-16 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 bg-emerald-500/10">
              <motion.span className="text-3xl" animate={{ rotateY: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                🕳
              </motion.span>
            </div>
            <p className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-4">{loadingMsg}</p>
            <div className="w-64 max-w-[80vw] bg-zinc-900 rounded-full h-1.5 mb-2 overflow-hidden border border-white/5 shadow-inner">
              <motion.div
                className="bg-emerald-500 h-full shadow-[0_0_10px_#10b981]"
                initial={{ width: 0 }}
                animate={{ width: `${downloadProgress}%` }}
                transition={{ ease: "linear", duration: 0.2 }}
              />
            </div>
            <div className="flex justify-between w-64 text-[10px] text-zinc-500 font-mono">
              <span className="truncate pr-4">{downloadItem || "Loading..."}</span>
              <span>{downloadProgress}%</span>
            </div>
            <p className="text-[10px] text-zinc-400 text-center max-w-[250px] mt-8 leading-relaxed">
              First-time use loads a 27MB local AI model.<br />100% private — no data leaves your device.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error Overlay (non-blocking) ── */}
      {errorMsg && !isProcessing && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-red-950/90 border border-red-500/40 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-lg">⚠️</span>
          <p className="text-[11px] font-mono text-red-300 max-w-[260px] truncate">{errorMsg}</p>
          <button
            className="ml-2 text-xs text-red-400 hover:text-white transition-colors"
            onClick={() => { setErrorMsg(null); useAppStore.setState({ uploadedImage: null }); }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!uploadedImage && !isProcessing && !errorMsg && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 bg-emerald-500/10">
            <span className="text-3xl">🕳</span>
          </div>
          <p className="text-sm font-bold text-zinc-400 tracking-widest uppercase">Upload an Image</p>
          <p className="text-xs text-zinc-600 mt-2">to generate a live 3D depth parallax</p>
        </div>
      )}

      {/* ── Bottom Control Dock ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">

        {/* ── Example Images Row ── */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-600 mr-1">Try example</span>
          {EXAMPLE_IMAGES.map((ex) => (
            <div key={ex.id} className="flex items-center gap-1">
              {/* Preview + load into canvas */}
              <button
                title={`Use ${ex.label} as sample image`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-[10px] font-medium transition-all"
                onClick={async () => {
                  const res = await fetch(ex.src);
                  const blob = await res.blob();
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    activateImage(dataUrl);
                  };
                  reader.readAsDataURL(blob);
                }}
              >
                <span>{ex.emoji}</span>
                <span>{ex.label}</span>
              </button>
              {/* Download original */}
              <a
                href={ex.src}
                download={`${ex.label.toLowerCase()}-texture.jpg`}
                title={`Download ${ex.label} texture`}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-zinc-500 hover:text-emerald-400 text-[11px] transition-all"
              >
                ⬇
              </a>
            </div>
          ))}
        </div>

        {/* ── Thumbnail Gallery Strip ── */}
        {gallery.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-xl max-w-[80vw] overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <AnimatePresence>
              {gallery.map((url) => (
                <ThumbItem
                  key={url}
                  url={url}
                  active={uploadedImage === url}
                  onClick={() => useAppStore.setState({ uploadedImage: url })}
                  onRemove={() => removeFromGallery(url)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Main Controls Row ── */}
        <div className="flex items-center bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl gap-1">

          {/* Upload Button */}
          <label
            id="depth-upload-btn"
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/5 group"
            title="Upload image"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">🖼️</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    activateImage(dataUrl);
                  };
                  reader.readAsDataURL(file);
                }
                e.target.value = "";
              }}
            />
          </label>

          <div className="w-[1px] h-8 bg-white/10 mx-2" />

          {/* Parallax Intensity Slider */}
          <div
            className={`flex items-center gap-4 px-2 transition-opacity duration-500 ${
              uploadedImage ? "opacity-100" : "opacity-30 pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center w-32">
                <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">Parallax</span>
                <span className="text-[9px] font-mono text-emerald-400">{(intensity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="0" max="0.1" step="0.005" value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                className="w-32 h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500"
              />
            </div>
          </div>

          <div className="w-[1px] h-8 bg-white/10 mx-2" />

          {/* Export / Download Moodboard */}
          <button
            id="depth-export-btn"
            title="Download moodboard as PNG"
            className={`flex items-center gap-2 px-4 h-12 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all border ${
              uploadedImage
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                : "bg-black/40 border-white/5 text-zinc-600 pointer-events-none"
            }`}
            onClick={handleExport}
          >
            <span>⬇</span> Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}
