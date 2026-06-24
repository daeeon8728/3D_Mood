// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Zustand Global Store (v2)
//  viewMode: 'spline' | 'custom'
//  currentMoodId + moodPresets: R3F 씬 조명/무드
//  uploadedImage + palette: 이미지 업로드 → 색상 추출 → 3D 동기화
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ── R3F 무드 프리셋 ───────────────────────────────────────────────────────
export interface R3FMoodPreset {
  id: string
  label: string
  emoji: string
  description: string
  ambientColor: string
  ambientIntensity: number
  keyLightColor: string
  rimLightColor: string
  bgColor: string
  rotationSpeed: number
}

// ── 3D 히어로 도형 타입 ──────────────────────────────────────────────
export type HeroShape = 'torusknot' | 'sphere' | 'box'

// ── 이미지 팔레트 ─────────────────────────────────────────────────────────
export interface Palette {
  /** 추출된 5개 hex 색상 (dominant → 보조 순) */
  colors: string[]
  /** 대표 hex 색상 */
  dominant: string
  /** 지각 밝기 0-1 (ContactShadows/Environment 강도 제어용) */
  brightness: number
}

// ── 기본 무드 프리셋 ──────────────────────────────────────────────────────
export const R3F_MOOD_PRESETS: R3FMoodPreset[] = [
  {
    id: 'dawn',
    label: '#Dawn',
    emoji: '🌅',
    description: 'Warm golden hour',
    ambientColor: '#ff8c42',
    ambientIntensity: 0.5,
    keyLightColor: '#ffb347',
    rimLightColor: '#ff6b35',
    bgColor: '#050201',
    rotationSpeed: 0.3,
  },
  {
    id: 'cyberpunk',
    label: '#Cyberpunk',
    emoji: '⚡',
    description: 'Neon dystopian glow',
    ambientColor: '#ff2079',
    ambientIntensity: 0.8,
    keyLightColor: '#ff2079',
    rimLightColor: '#00d4ff',
    bgColor: '#020008',
    rotationSpeed: 0.8,
  },
  {
    id: 'minimal',
    label: '#Minimal',
    emoji: '◻',
    description: 'Pure white gallery',
    ambientColor: '#e0e0e0',
    ambientIntensity: 0.9,
    keyLightColor: '#ffffff',
    rimLightColor: '#c0c0c0',
    bgColor: '#060606',
    rotationSpeed: 0.15,
  },
  {
    id: 'retrocity',
    label: '#RetroCity',
    emoji: '🌆',
    description: '80s sunset cityscape',
    ambientColor: '#a855f7',
    ambientIntensity: 0.7,
    keyLightColor: '#a855f7',
    rimLightColor: '#f59e0b',
    bgColor: '#030007',
    rotationSpeed: 0.5,
  },
]

export type ViewMode = 'spline' | 'depth' | 'mockup' | 'custom'

// ── 헬퍼: hex 색상 어둡게 (배경색 생성용) ────────────────────────────────
const darkenHex = (hex: string, factor: number): string => {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * factor))
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * factor))
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── 스토어 타입 ───────────────────────────────────────────────────────────
interface AppState {
  // ── Engine ─────────────────────────────────────────────────────────────────
  viewMode: ViewMode
  toggleViewMode: () => void
  setViewMode: (mode: ViewMode) => void

  // ── Mood ──────────────────────────────────────────────────────────────────
  currentMoodId: string
  moodPresets: R3FMoodPreset[]
  setMood: (id: string) => void

  // ── 3D Hero ───────────────────────────────────────────────────────────
  heroShape: HeroShape
  setHeroShape: (s: HeroShape) => void
  /** 키 라이트 강도 (스토어독 슬라이더와 직결) */
  keyIntensity: number
  setKeyIntensity: (v: number) => void

  // ── Image Upload + Palette ──────────────────────────────────────────────
  uploadedImage: string | null
  palette: Palette | null
  setUploadedImage: (url: string | null) => void
  setPalette: (p: Palette | null) => void
  /**
   * 팔레트 데이터를 받아 'custom-upload' 무드 프리셋을 생성하고
   * 즉시 활성화하는 핵심 액션.
   * — 조명 색상, 배경, 회전속도가 이미지 팔레트 기반으로 자동 계산됨.
   */
  applyPaletteToMood: (palette: Palette) => void
  clearImage: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────
//  Performance: selector 패턴 사용
//  예시: const viewMode = useAppStore(s => s.viewMode)
// ─────────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // ── Engine ──────────────────────────────────────────────────────────
      viewMode: 'spline',
      toggleViewMode: () =>
        set((s) => ({ viewMode: s.viewMode === 'spline' ? 'depth' : 'spline' }), false, 'toggleViewMode'),
      setViewMode: (mode) => set({ viewMode: mode }, false, 'setViewMode'),

      // ── Mood ───────────────────────────────────────────────────────────────
      currentMoodId: 'cyberpunk',
      moodPresets: R3F_MOOD_PRESETS,
      setMood: (id) => set({ currentMoodId: id }, false, 'setMood'),

      // ── 3D Hero ───────────────────────────────────────────────────────────
      heroShape: 'torusknot',
      setHeroShape: (s) => set({ heroShape: s }, false, 'setHeroShape'),
      keyIntensity: 120,
      setKeyIntensity: (v) => set({ keyIntensity: v }, false, 'setKeyIntensity'),

      // ── Image / Palette ──────────────────────────────────────────────────────
      uploadedImage: null,
      palette: null,

      setUploadedImage: (url) => set({ uploadedImage: url }, false, 'setUploadedImage'),
      setPalette: (p) => set({ palette: p }, false, 'setPalette'),

      applyPaletteToMood: (palette) => {
        const { moodPresets } = get()

        // 배경색: 대표색을 매우 어둡게 (5% 밝기)
        const bgColor = darkenHex(palette.dominant, 0.06)

        // 팔레트 기반 커스텀 무드 프리셋 생성
        const customPreset: R3FMoodPreset = {
          id: 'custom-upload',
          label: '#Upload',
          emoji: '🖼',
          description: 'From your artwork',
          // 대표색 → 앰비언트
          ambientColor: palette.dominant,
          // 밝기에 따라 강도 조절 (밝은 이미지 → 강한 조명)
          ambientIntensity: 0.38 + palette.brightness * 0.48,
          // 보조색 → 키라이트
          keyLightColor: palette.colors[1] ?? palette.dominant,
          // 보조색 #4 → 림라이트 (없으면 #3, 없으면 시안)
          rimLightColor: palette.colors[3] ?? palette.colors[2] ?? '#00c8ff',
          bgColor,
          rotationSpeed: 0.35 + palette.brightness * 0.25,
        }

        // 기존 custom-upload 프리셋 교체 후 즉시 활성화
        const updated = moodPresets
          .filter((p) => p.id !== 'custom-upload')
          .concat(customPreset)

        set(
          { palette, moodPresets: updated, currentMoodId: 'custom-upload' },
          false,
          'applyPaletteToMood',
        )
      },

      clearImage: () => {
        const { uploadedImage, moodPresets } = get()
        // ObjectURL 메모리 해제
        if (uploadedImage?.startsWith('blob:')) URL.revokeObjectURL(uploadedImage)
        set(
          {
            uploadedImage: null,
            palette: null,
            moodPresets: moodPresets.filter((p) => p.id !== 'custom-upload'),
            currentMoodId: 'cyberpunk',
          },
          false,
          'clearImage',
        )
      },
    }),
    { name: '3d-mood-store' },
  ),
)
