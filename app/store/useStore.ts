// ─────────────────────────────────────────────────────────────────────────────
//  3D Mood — Zustand Global Store
//  viewMode: 'spline' (Showroom) | 'custom' (R3F Atelier)
//  currentMoodId + moodPresets: R3F 씬 조명/무드 데이터
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// ── R3F 전용 무드 프리셋 타입 ──────────────────────────────────────────────
export interface R3FMoodPreset {
  id: string
  label: string
  emoji: string
  description: string
  /** Three.js 호환 hex 색상 */
  ambientColor: string
  ambientIntensity: number
  keyLightColor: string
  rimLightColor: string
  bgColor: string
  /** 초당 Y축 회전각 (radian) */
  rotationSpeed: number
}

// ── R3F 무드 프리셋 데이터 ────────────────────────────────────────────────
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

// ── 뷰 모드 타입 ──────────────────────────────────────────────────────────
export type ViewMode = 'spline' | 'custom'

// ── 스토어 인터페이스 ─────────────────────────────────────────────────────
interface AppState {
  // Engine
  viewMode: ViewMode
  toggleViewMode: () => void
  setViewMode: (mode: ViewMode) => void

  // Mood (R3F 씬용)
  currentMoodId: string
  moodPresets: R3FMoodPreset[]
  setMood: (id: string) => void

  // 헬퍼: 현재 프리셋 반환
  getCurrentPreset: () => R3FMoodPreset
}

// ── Zustand Store ─────────────────────────────────────────────────────────
//  Performance: selector 패턴 사용 시 구독한 슬라이스만 변경될 때만 리렌더
//  예시: const viewMode = useAppStore(s => s.viewMode)
// ─────────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // ── Engine ──────────────────────────────────────────────────────────
      viewMode: 'spline',

      toggleViewMode: () =>
        set(
          (s) => ({ viewMode: s.viewMode === 'spline' ? 'custom' : 'spline' }),
          false,
          'toggleViewMode',
        ),

      setViewMode: (mode) => set({ viewMode: mode }, false, 'setViewMode'),

      // ── Mood ─────────────────────────────────────────────────────────────
      currentMoodId: 'cyberpunk',
      moodPresets: R3F_MOOD_PRESETS,

      setMood: (id) => set({ currentMoodId: id }, false, 'setMood'),

      getCurrentPreset: () => {
        const { currentMoodId, moodPresets } = get()
        return moodPresets.find((p) => p.id === currentMoodId) ?? moodPresets[0]
      },
    }),
    { name: '3d-mood-store' },
  ),
)
