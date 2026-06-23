"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  ImageUploader — Image-to-3D 동기화 시스템
//
//  플로우:
//    1. 드래그드랍 / 클릭 → 파일 선택
//    2. Object URL 생성 → Zustand setUploadedImage()
//    3. <img> 로드 후 ColorThief 실행 (dynamic import, SSR 안전)
//    4. 추출된 팔레트 → applyPaletteToMood() 호출
//    5. Zustand가 'custom-upload' 무드를 생성 → 3D 씬 조명 자동 전환
//
//  UX:
//    - 드래그 오버 시 보라색 테두리 하이라이트
//    - 업로드 후 드롭존에 썸네일 반투명 배경으로 표시
//    - 팔레트 스와치 애니메이션 (hover: 스케일 업)
//    - 이미지 지우기 버튼 (clearImage)
// ─────────────────────────────────────────────────────────────────────────────

// colorthief 타입 선언 (@types 없음)
declare module "colorthief" {
  export default class ColorThief {
    getColor(img: HTMLImageElement, quality?: number): [number, number, number];
    getPalette(
      img: HTMLImageElement,
      colorCount?: number,
      quality?: number,
    ): Array<[number, number, number]>;
  }
}

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "./store/useStore";
import type { Palette } from "./store/useStore";

// ── Helpers ───────────────────────────────────────────────────────────────
const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const calcBrightness = (colors: Array<[number, number, number]>): number => {
  const sum = colors.reduce(
    (acc, [r, g, b]) => acc + (r * 0.299 + g * 0.587 + b * 0.114) / 255,
    0,
  );
  return sum / colors.length;
};

// ── Zustand Selectors ─────────────────────────────────────────────────────
const selectUploadedImage    = (s: any): string | null  => s.uploadedImage;
const selectPalette          = (s: any): Palette | null => s.palette;
const selectSetUploadedImage = (s: any)                 => s.setUploadedImage;
const selectApplyPalette     = (s: any)                 => s.applyPaletteToMood;
const selectClearImage       = (s: any)                 => s.clearImage;

// ─────────────────────────────────────────────────────────────────────────────
export default function ImageUploader() {
  const [isDragging,   setIsDragging]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedImage      = useAppStore(selectUploadedImage);
  const palette            = useAppStore(selectPalette);
  const setUploadedImage   = useAppStore(selectSetUploadedImage);
  const applyPaletteToMood = useAppStore(selectApplyPalette);
  const clearImage         = useAppStore(selectClearImage);

  // ── 파일 처리 핵심 함수 ─────────────────────────────────────────────
  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setIsProcessing(true);

      try {
        // 이전 blob URL 해제 (메모리 누수 방지)
        if (uploadedImage?.startsWith("blob:")) URL.revokeObjectURL(uploadedImage);

        // 새 Object URL 생성 → Zustand 저장 (3D 씬에서 useLoader로 읽힘)
        const url = URL.createObjectURL(file);
        setUploadedImage(url);

        // ColorThief는 Canvas API 사용 → 브라우저 전용 → dynamic import
        const img = new Image();
        img.src = url;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { default: ColorThief } = (await import("colorthief")) as any;
        const ct = new ColorThief();

        // quality=5: 품질/속도 균형 (1=최고품질, 10=최고속도)
        const rawPalette = ct.getPalette(img, 5, 5) as Array<[number, number, number]>;
        const dominant   = ct.getColor(img, 5)       as [number, number, number];

        const palette: Palette = {
          colors:     rawPalette.map(rgbToHex),
          dominant:   rgbToHex(dominant),
          brightness: calcBrightness(rawPalette),
        };

        // 스토어 업데이트 → 'custom-upload' 무드 자동 생성 + 3D 씬 전환
        applyPaletteToMood(palette);
      } catch (e) {
        console.error("[ImageUploader] Processing failed:", e);
      } finally {
        setIsProcessing(false);
      }
    },
    [uploadedImage, setUploadedImage, applyPaletteToMood],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = ""; // 같은 파일 재업로드 허용
    },
    [processFile],
  );

  return (
    <div className="w-full flex flex-col gap-2">
      {/* ── Section Label ── */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-600">
          Image → 3D Sync
        </p>
        {uploadedImage && (
          <motion.button
            onClick={clearImage}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-[9px] text-zinc-600 hover:text-zinc-300 transition-colors leading-none"
            title="Remove image"
          >
            ✕
          </motion.button>
        )}
      </div>

      {/* ── Drop Zone ── */}
      <motion.div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging
            ? "#a855f7"
            : uploadedImage
              ? "rgba(255,255,255,0.2)"
              : "rgba(255,255,255,0.08)",
          boxShadow: isDragging ? "0 0 0 2px rgba(168,85,247,0.25)" : "none",
        }}
        transition={{ duration: 0.15 }}
        className="relative w-full h-[72px] rounded-xl border border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden select-none"
        style={{ background: "rgba(255,255,255,0.02)" }}
        whileHover={{ background: "rgba(255,255,255,0.045)" }}
        whileTap={{ scale: 0.98 }}
      >
        {/* 업로드된 이미지 썸네일 배경 */}
        <AnimatePresence>
          {uploadedImage && (
            <motion.img
              key="thumb"
              src={uploadedImage}
              alt="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.38 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* 아이콘 + 텍스트 */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          <motion.span
            className="text-sm leading-none"
            animate={{
              rotate: isProcessing ? 360 : 0,
              scale: isDragging ? 1.3 : 1,
            }}
            transition={{
              rotate: {
                duration: 0.8,
                repeat: isProcessing ? Infinity : 0,
                ease: "linear",
              },
              scale: { type: "spring", stiffness: 600, damping: 40 },
            }}
          >
            {isProcessing ? "⟳" : uploadedImage ? "🖼" : "↑"}
          </motion.span>
          <p className="text-[9px] font-medium tracking-wide text-zinc-500">
            {isProcessing
              ? "Analyzing palette…"
              : uploadedImage
                ? "Click to replace"
                : "Drop image or click"}
          </p>
        </div>
      </motion.div>

      {/* ── 추출된 팔레트 스와치 ── */}
      <AnimatePresence>
        {palette && (
          <motion.div
            key="swatches"
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex gap-1 pt-0.5">
              {palette.colors.map((color, i) => (
                <motion.div
                  key={`${color}-${i}`}
                  className="flex-1 rounded-lg cursor-default"
                  style={{
                    background: color,
                    height: "16px",
                    transformOrigin: "bottom",
                  }}
                  title={color}
                  whileHover={{ scaleY: 1.6 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                />
              ))}
            </div>

            {/* 밝기 정보 */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex-1 h-px bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white/40"
                  initial={{ width: 0 }}
                  animate={{ width: `${palette.brightness * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="text-[8px] text-zinc-700 whitespace-nowrap">
                {Math.round(palette.brightness * 100)}% lum
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
