"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
  PresentationControls,
  useTexture,
} from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { useAppStore } from "./store/useStore";
import { useAudioReact } from "./hooks/useAudioReact";

extend({ RoundedBoxGeometry });

const DEFAULT_COLORS = ["#ffffff", "#ff2079", "#00d4ff", "#a855f7", "#4ade80"];

function useOptimizedArtworkTexture(imageUrl, shape) {
  const texture = useTexture(imageUrl);
  const { gl } = useThree();

  useEffect(() => {
    if (!texture) return;

    // Keep uploaded artwork crisp instead of letting WebGL smear it across UVs.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());

    // Complex geometry needs more repeats so the image does not stretch into one blurry band.
    if (shape === "torusknot") texture.repeat.set(3.2, 1.6);
    else if (shape === "sphere") texture.repeat.set(1.2, 1.2);
    else texture.repeat.set(1, 1);

    texture.offset.set(0, 0);
    texture.needsUpdate = true;
  }, [gl, shape, texture]);

  return texture;
}

function GalleryObject({ imageUrl, shape, mood, keyIntensity, audioDataRef }) {
  const meshRef = useRef(null);
  const texture = useOptimizedArtworkTexture(imageUrl, shape);

  useFrame((state) => {
    if (!meshRef.current) return;
    const baseRotationSpeed = (mood.rotationSpeed || 0.2) * 0.004;
    
    let audioScale = 1;
    let extraRotation = 0;
    if (audioDataRef?.current) {
      const audio = audioDataRef.current;
      audioScale = 1 + audio.bass * 0.15;
      extraRotation = audio.mid * 0.01;
    }

    meshRef.current.rotation.y += baseRotationSpeed + extraRotation;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.045;
    
    // Smooth scaling for audio react
    meshRef.current.scale.lerp(new THREE.Vector3(audioScale, audioScale, audioScale), 0.2);
  });

  const geometry = useMemo(() => {
    if (shape === "sphere") return <sphereGeometry args={[1.55, 96, 96]} />;
    if (shape === "box") return <boxGeometry args={[2.35, 2.35, 0.55, 12, 12, 4]} />;
    if (shape === "torusknot") return <torusKnotGeometry args={[1.05, 0.32, 280, 32]} />;
    return null;
  }, [shape]);

  // Procedural Phone Mockup
  if (shape === "phone") {
    return (
      <PresentationControls global polar={[-0.45, 0.35]} azimuth={[-0.6, 0.6]} snap>
        <Float speed={1.2} rotationIntensity={0.28} floatIntensity={0.16}>
          <group ref={meshRef}>
            {/* Phone Body */}
            <mesh castShadow receiveShadow>
              {/* @ts-ignore */}
              <roundedBoxGeometry args={[2.0, 4.0, 0.2, 8, 0.15]} />
              <meshPhysicalMaterial color="#111" roughness={0.4} metalness={0.8} />
            </mesh>
            {/* Phone Screen */}
            <mesh position={[0, 0, 0.101]}>
              <planeGeometry args={[1.85, 3.85]} />
              <meshBasicMaterial map={texture} />
            </mesh>
            <pointLight position={[0, 1.2, 2.2]} intensity={keyIntensity / 110} color={mood.keyLightColor} distance={7} />
          </group>
        </Float>
      </PresentationControls>
    );
  }

  // Procedural Poster Mockup
  if (shape === "poster") {
    return (
      <PresentationControls global polar={[-0.45, 0.35]} azimuth={[-0.6, 0.6]} snap>
        <Float speed={1.2} rotationIntensity={0.28} floatIntensity={0.16}>
          <group ref={meshRef}>
            {/* Frame */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[3.2, 4.2, 0.1]} />
              <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Canvas inside frame */}
            <mesh position={[0, 0, 0.051]}>
              <planeGeometry args={[3.0, 4.0]} />
              <meshStandardMaterial map={texture} roughness={0.8} metalness={0} />
            </mesh>
            <pointLight position={[0, 1.2, 2.2]} intensity={keyIntensity / 110} color={mood.keyLightColor} distance={7} />
          </group>
        </Float>
      </PresentationControls>
    );
  }

  // Default geometries (sphere, box, knot)
  return (
    <PresentationControls global polar={[-0.45, 0.35]} azimuth={[-0.6, 0.6]} snap>
      <Float speed={1.2} rotationIntensity={0.28} floatIntensity={0.16}>
        <mesh ref={meshRef} castShadow receiveShadow>
          {geometry}
          <meshPhysicalMaterial
            map={texture}
            color="#ffffff"
            roughness={0.1}
            metalness={0.04}
            clearcoat={1.0}
            clearcoatRoughness={0.08}
            envMapIntensity={1.35}
            reflectivity={0.7}
            iridescence={0.22}
            iridescenceIOR={1.28}
          />
        </mesh>

        <pointLight
          position={[0, 1.2, 2.2]}
          intensity={keyIntensity / 110}
          color={mood.keyLightColor}
          distance={7}
        />
      </Float>
    </PresentationControls>
  );
}

function EmptyPedestal() {
  return (
    <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.08}>
      <mesh castShadow receiveShadow>
        <torusKnotGeometry args={[1.0, 0.3, 220, 28]} />
        <meshPhysicalMaterial
          color="#151515"
          roughness={0.18}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.12}
          envMapIntensity={1.1}
        />
      </mesh>
    </Float>
  );
}

function SceneLights({ mood, keyIntensity }) {
  return (
    <>
      <color attach="background" args={[mood.bgColor || "#030303"]} />
      <Environment preset="studio" background={false} />
      <ambientLight color={mood.ambientColor} intensity={mood.ambientIntensity ?? 0.55} />
      <spotLight
        position={[3.8, 5.2, 4.4]}
        angle={0.34}
        penumbra={0.85}
        intensity={keyIntensity / 80}
        color={mood.keyLightColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-3.2, 1.8, -2.8]} intensity={1.5} color={mood.rimLightColor} />
      <ContactShadows
        position={[0, -1.72, 0]}
        opacity={0.58}
        scale={8}
        blur={2.4}
        far={4.5}
        resolution={1024}
        color="#000000"
      />
    </>
  );
}

function ArtworkStage({ imageUrl, shape, mood, keyIntensity }) {
  const { getAudioData } = useAudioReact();
  const audioDataRef = useRef({ bass: 0, mid: 0, treble: 0 });

  useFrame(() => {
    audioDataRef.current = getAudioData();
  });

  return (
    <>
      <SceneLights mood={mood} keyIntensity={keyIntensity} />
      <group position={[0, 0.1, 0]}>
        {imageUrl ? (
          <Suspense fallback={<EmptyPedestal />}>
            <GalleryObject
              imageUrl={imageUrl}
              shape={shape}
              mood={mood}
              keyIntensity={keyIntensity}
              audioDataRef={audioDataRef}
            />
          </Suspense>
        ) : (
          <EmptyPedestal />
        )}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={8}
        target={[0, 0, 0]}
        makeDefault
      />
    </>
  );
}

async function readPalette(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 48;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map();
  let brightness = 0;
  let samples = 0;

  for (let i = 0; i < pixels.length; i += 16) {
    const alpha = pixels[i + 3];
    if (alpha < 16) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = [
      Math.round(r / 32) * 32,
      Math.round(g / 32) * 32,
      Math.round(b / 32) * 32,
    ].join(",");

    buckets.set(key, (buckets.get(key) || 0) + 1);
    brightness += (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    samples += 1;
  }

  const colors = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split(",").map(Number);
      return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
    });

  bitmap.close?.();

  return {
    colors: colors.length ? colors : DEFAULT_COLORS,
    dominant: colors[0] || "#ffffff",
    brightness: samples ? brightness / samples : 0.5,
  };
}

const SHAPE_OPTIONS = [
  { id: "sphere",    label: "Sphere",    icon: "●" },
  { id: "box",       label: "Box",       icon: "■" },
  { id: "torusknot", label: "Knot",      icon: "✦" },
  { id: "phone",     label: "Phone",     icon: "📱" },
  { id: "poster",    label: "Poster",    icon: "🖼" },
];

function StudioDock({ onCapture, onRecord, isRecording }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [copiedColor, setCopiedColor] = useState(null);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const palette = useAppStore((s) => s.palette);
  const clearImage = useAppStore((s) => s.clearImage);
  const setUploadedImage = useAppStore((s) => s.setUploadedImage);
  const applyPaletteToMood = useAppStore((s) => s.applyPaletteToMood);
  const currentMoodId = useAppStore((s) => s.currentMoodId);
  const moodPresets = useAppStore((s) => s.moodPresets);
  const setMood = useAppStore((s) => s.setMood);
  const heroShape = useAppStore((s) => s.heroShape);
  const setHeroShape = useAppStore((s) => s.setHeroShape);
  const audioReact = useAppStore((s) => s.audioReact);
  const setAudioReact = useAppStore((s) => s.setAudioReact);

  const colors = palette?.colors?.length ? palette.colors : DEFAULT_COLORS;

  const processFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const previousImage = useAppStore.getState().uploadedImage;
    if (previousImage?.startsWith("blob:")) URL.revokeObjectURL(previousImage);
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    const nextPalette = await readPalette(file);
    if (nextPalette) applyPaletteToMood(nextPalette);
  };

  const handleFile = async (event) => {
    await processFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    await processFile(file);
  };

  const copyColor = (hex) => {
    navigator.clipboard?.writeText(hex).then(() => {
      setCopiedColor(hex);
      setTimeout(() => setCopiedColor(null), 1500);
    }).catch(() => {});
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-6 left-1/2 z-30 w-[min(960px,calc(100vw-32px))] -translate-x-1/2"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay hint */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/10 flex items-center justify-center pointer-events-none"
          >
            <p className="text-sm font-bold text-emerald-400 tracking-widest uppercase">Drop image here</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-2xl"
        style={{
          background: "rgba(12, 12, 16, 0.68)",
          borderColor: palette?.dominant ? `${palette.dominant}55` : "rgba(255,255,255,0.12)",
          boxShadow: palette?.dominant
            ? `0 18px 60px rgba(0,0,0,0.45), 0 0 44px ${palette.dominant}22`
            : "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Upload + Thumbnail */}
        <div className="flex items-center gap-3">
          <label
            className="h-11 rounded-xl border border-white/10 bg-white/10 px-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/15 flex items-center gap-2 cursor-pointer"
          >
            <span>🖼️</span> Upload
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
          </label>

          <AnimatePresence mode="popLayout">
            {uploadedImage && (
              <motion.div
                key="thumb"
                initial={{ opacity: 0, x: 18, scale: 0.88, filter: "blur(8px)" }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 12, scale: 0.9, filter: "blur(8px)" }}
                className="group relative h-12 w-12 overflow-hidden rounded-xl border border-white/15"
              >
                <img src={uploadedImage} alt="Uploaded artwork" className="h-full w-full object-cover" />
                <button type="button" onClick={clearImage}
                  className="absolute inset-0 bg-black/55 text-[10px] font-bold uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shape Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-600 mr-1">Shape</span>
          {SHAPE_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              onClick={() => setHeroShape(s.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                heroShape === s.id
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{s.icon}</span>
              <span className="text-[10px] uppercase tracking-widest">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Mood Presets */}
        <div className="flex items-center gap-1.5">
          {moodPresets.slice(0, 5).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setMood(preset.id)}
              className={`rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                currentMoodId === preset.id
                  ? "border-white/30 bg-white text-black"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {preset.label.replace("#", "")}
            </button>
          ))}
          
          <button
            type="button"
            title="Audio React Mode"
            onClick={() => setAudioReact(!audioReact)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ml-2 ${
              audioReact
                ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>🎤</span>
            <span>{audioReact ? "Beat ON" : "Beat OFF"}</span>
          </button>
        </div>

        {/* Palette + Capture */}
        <div className="flex items-center gap-2">
          {colors.slice(0, 5).map((hex) => (
            <div key={hex} className="relative">
              <button
                type="button"
                title={`Copy ${hex}`}
                onClick={() => copyColor(hex)}
                className="h-8 w-8 rounded-lg border border-white/20 shadow-lg transition hover:-translate-y-0.5 relative overflow-hidden"
                style={{ backgroundColor: hex }}
              >
                {copiedColor === hex && (
                  <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px] font-bold text-white tracking-widest">
                    COPIED
                  </span>
                )}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onCapture}
            className="ml-1 h-11 rounded-xl border border-emerald-400/35 bg-emerald-400/15 px-4 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400/25"
          >
            ⬇ PNG
          </button>
          <button
            type="button"
            onClick={onRecord}
            className={`h-11 rounded-xl border px-4 text-xs font-bold uppercase tracking-widest transition flex items-center gap-2 ${
              isRecording
                ? "border-red-400/50 bg-red-400/20 text-red-300 animate-pulse"
                : "border-purple-400/35 bg-purple-400/15 text-purple-200 hover:bg-purple-400/25"
            }`}
          >
            {isRecording ? <><span className="w-2 h-2 rounded-full bg-red-400" /> REC</> : "🎥 WEBM"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CustomStudioScene() {
  const canvasWrapRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const heroShape = useAppStore((s) => s.heroShape);
  const keyIntensity = useAppStore((s) => s.keyIntensity);
  const currentMoodId = useAppStore((s) => s.currentMoodId);
  const moodPresets = useAppStore((s) => s.moodPresets);

  const mood = useMemo(
    () => moodPresets.find((preset) => preset.id === currentMoodId) || moodPresets[0],
    [currentMoodId, moodPresets],
  );

  const handleCapture = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "3d-mood-gallery-capture.png";
    link.href = canvas.toDataURL("image/png", 1);
    link.click();
  };

  const handleRecord = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;

    if (isRecording) return;
    setIsRecording(true);
    recordedChunksRef.current = [];

    const stream = canvas.captureStream(60); // 60 FPS
    
    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm; codecs=vp8' };
    }
    
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '3d-mood-gallery-record.webm';
      link.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };

    mediaRecorder.start();
    
    // Stop recording after 4 seconds
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, 4000);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ isolation: "isolate" }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${mood.keyLightColor}22, transparent 34%),
                       radial-gradient(circle at 20% 72%, ${mood.rimLightColor}18, transparent 34%),
                       linear-gradient(180deg, ${mood.bgColor}, #020202)`,
        }}
      />

      <div ref={canvasWrapRef} className="absolute inset-0">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0.55, 5.6], fov: 42 }}
          gl={{
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            // ACES + SRGB preserves designer artwork contrast while keeping gallery highlights cinematic.
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <ArtworkStage
            imageUrl={uploadedImage}
            shape={heroShape}
            mood={mood}
            keyIntensity={keyIntensity}
          />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute left-6 top-20 z-20">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
            Custom Gallery
          </p>
        </div>
        <p className="max-w-[220px] text-xs leading-relaxed text-zinc-500">
          Sharp artwork texture, studio reflections, and contact-grounded presentation.
        </p>
      </div>

      {!uploadedImage && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
            Upload artwork
          </p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">
            The scene will map your image as a crisp glossy texture on the selected gallery object.
          </p>
        </div>
      )}

      {isRecording && (
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-red-200 uppercase tracking-widest">Recording...</span>
        </div>
      )}

      <StudioDock onCapture={handleCapture} onRecord={handleRecord} isRecording={isRecording} />
    </div>
  );
}
