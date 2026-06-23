"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "./store/useStore";
import type { Palette } from "./store/useStore";

// colorthief 타입 선언
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

const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const calcBrightness = (colors: Array<[number, number, number]>): number => {
  const sum = colors.reduce(
    (acc, [r, g, b]) => acc + (r * 0.299 + g * 0.587 + b * 0.114) / 255,
    0,
  );
  return sum / colors.length;
};

const selectUploadedImage    = (s: any): string | null  => s.uploadedImage;
const selectSetUploadedImage = (s: any)                 => s.setUploadedImage;
const selectApplyPalette     = (s: any)                 => s.applyPaletteToMood;

export default function ImageUploader() {
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedImage      = useAppStore(selectUploadedImage);
  const setUploadedImage   = useAppStore(selectSetUploadedImage);
  const applyPaletteToMood = useAppStore(selectApplyPalette);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setIsProcessing(true);

      try {
        if (uploadedImage?.startsWith("blob:")) URL.revokeObjectURL(uploadedImage);

        const url = URL.createObjectURL(file);
        setUploadedImage(url);

        const img = new Image();
        img.src = url;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { default: ColorThief } = (await import("colorthief")) as any;
        const ct = new ColorThief();

        const rawPalette = ct.getPalette(img, 5, 5) as Array<[number, number, number]>;
        const dominant   = ct.getColor(img, 5)       as [number, number, number];

        const palette: Palette = {
          colors:     rawPalette.map(rgbToHex),
          dominant:   rgbToHex(dominant),
          brightness: calcBrightness(rawPalette),
        };

        applyPaletteToMood(palette);
      } catch (e) {
        console.error("[ImageUploader] Processing failed:", e);
      } finally {
        setIsProcessing(false);
      }
    },
    [uploadedImage, setUploadedImage, applyPaletteToMood],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  return (
    <>
      <motion.button
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white transition-colors"
        title="Upload Image"
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </motion.span>
          ) : (
            <motion.svg
              key="icon"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}
