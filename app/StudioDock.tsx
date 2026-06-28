"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type HeroShape } from "./store/useStore";
import ImageUploader from "./ImageUploader";

const selectUploadedImage = (s: any) => s.uploadedImage;
const selectPalette       = (s: any) => s.palette;
const selectClearImage    = (s: any) => s.clearImage;
const selectHeroShape     = (s: any) => s.heroShape;
const selectSetHeroShape  = (s: any) => s.setHeroShape;
const selectKeyIntensity  = (s: any) => s.keyIntensity;
const selectSetKeyIntensity = (s: any) => s.setKeyIntensity;

export default function StudioDock() {
  const uploadedImage = useAppStore(selectUploadedImage);
  const palette       = useAppStore(selectPalette);
  const clearImage    = useAppStore(selectClearImage);
  const heroShape     = useAppStore(selectHeroShape);
  const setHeroShape  = useAppStore(selectSetHeroShape);
  const keyIntensity  = useAppStore(selectKeyIntensity);
  const setKeyIntensity = useAppStore(selectSetKeyIntensity);

  const shapes: { id: HeroShape; icon: string; label: string }[] = [
    { id: "torusknot", icon: "🥨", label: "Knot" },
    { id: "sphere",    icon: "🟡", label: "Sphere" },
    { id: "box",       icon: "🧊", label: "Box" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
    >
      <div
        className="flex items-center gap-4 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl"
        style={{
          background: "rgba(20, 20, 25, 0.65)",
          borderColor: palette?.dominant ? `${palette.dominant}40` : "rgba(255,255,255,0.08)",
          boxShadow: palette?.dominant ? `0 8px 32px ${palette.dominant}30` : "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* ── 이미지 업로드 / 썸네일 섹션 ── */}
        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
          <AnimatePresence mode="popLayout">
            {uploadedImage ? (
              <motion.div
                key="thumbnail"
                initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                className="relative group"
              >
                <div
                  className="w-10 h-10 rounded-full overflow-hidden border-2 shadow-inner transition-colors duration-300"
                  style={{ borderColor: palette?.dominant || "white" }}
                >
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                </div>
                {/* 닫기 버튼 (Hover) */}
                <motion.button
                  onClick={clearImage}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-800 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity border border-zinc-600 shadow-md"
                >
                  ✕
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ImageUploader />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 도형 전환 섹션 ── */}
        <div className="flex items-center gap-1 pr-4 border-r border-white/10">
          {shapes.map((shape) => {
            const isActive = heroShape === shape.id;
            return (
              <motion.button
                key={shape.id}
                onClick={() => setHeroShape(shape.id)}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-2 rounded-xl text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                  isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="text-base leading-none">{shape.icon}</span>
                {isActive && (
                  <motion.div
                    layoutId="shape-active-bg"
                    className="absolute inset-0 bg-white/10 rounded-xl"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── 조명 제어 섹션 ── */}
        <div className="flex flex-col gap-1.5 min-w-[120px] px-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            <span>Light</span>
            <span style={{ color: palette?.dominant || "#fff" }}>{Math.round(keyIntensity)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="600"
            step="1"
            value={keyIntensity}
            onChange={(e) => setKeyIntensity(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{
              accentColor: palette?.dominant || "#a855f7",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
