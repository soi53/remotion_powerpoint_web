import path from 'path'
import fs from 'fs'
import os from 'os'

function resolveRemotionRoot(): string {
  const raw = process.env.REMOTION_ROOT
  if (!raw) {
    throw new Error(
      'REMOTION_ROOT is not set. ' +
      'Create web/.env.local with: REMOTION_ROOT=../remotion_powerpoint'
    )
  }
  return path.resolve(process.cwd(), raw)
}

export const REMOTION_ROOT = resolveRemotionRoot()

export const PUBLIC_DIR = path.join(REMOTION_ROOT, 'public')
export const CURRENT_DIR = path.join(PUBLIC_DIR, 'current')
export const SLIDES_DIR = path.join(CURRENT_DIR, 'slides')
export const AUDIO_DIR = path.join(CURRENT_DIR, 'audio')
export const SLIDE_CONFIG_PATH = path.join(CURRENT_DIR, 'slide-config.json')
export const AUDIO_STATUS_PATH = path.join(CURRENT_DIR, 'audio-status.json')
export const OUTPUT_VIDEO_PATH = path.join(os.homedir(), 'Downloads', 'presentation.mp4')
export const RENDER_OUT_DIR = path.join(REMOTION_ROOT, 'out')
export const REMOTION_ENV_PATH = path.join(REMOTION_ROOT, '.env')

export const PPTX_TO_SLIDES_SCRIPT = path.join(REMOTION_ROOT, 'pptx-to-slides.mjs')
export const GENERATE_VOICEOVER_SCRIPT = path.join(REMOTION_ROOT, 'generate-presentation-voiceover.mjs')

export function hasCurrentProject(): boolean {
  return fs.existsSync(SLIDE_CONFIG_PATH)
}

export function readRemotionEnv(): Record<string, string> {
  if (!fs.existsSync(REMOTION_ENV_PATH)) return {}
  try {
    const raw = fs.readFileSync(REMOTION_ENV_PATH, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim()
      result[key] = val
    }
    return result
  } catch {
    return {}
  }
}
