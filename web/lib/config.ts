import fs from 'fs'
import { SLIDE_CONFIG_PATH, hasCurrentProject } from './paths'

export interface SlideMotion {
  type: 'still' | 'kenburns' | 'pan' | 'zoom_to'
  direction?: string
  target?: { left: number; top: number; right: number; bottom: number }
  triggerText?: string
  startAt?: number
  zoomDuration?: number
  holdDuration?: number
}

export interface SlideAlignment {
  characters: string[]
  character_start_times_seconds: number[]
}

export interface Slide {
  id: string
  image: string
  duration: number
  transition: number
  audio: string
  narration: string
  enabled?: boolean   // undefined or true = active, false = excluded
  motion?: SlideMotion
  motions?: SlideMotion[]
  alignment?: SlideAlignment
}

export interface SlideConfigMeta {
  videoW: number
  videoH: number
  slideW: number
  slideH: number
}

export interface SlideConfig {
  meta: SlideConfigMeta
  slides: Slide[]
}

export function readConfig(): SlideConfig | null {
  if (!hasCurrentProject()) return null

  const raw = fs.readFileSync(SLIDE_CONFIG_PATH, 'utf-8')
  const parsed = JSON.parse(raw)

  if (Array.isArray(parsed)) {
    return {
      meta: { videoW: 1920, videoH: 1080, slideW: 1280, slideH: 720 },
      slides: parsed as Slide[],
    }
  }

  return parsed as SlideConfig
}

export function writeConfig(config: SlideConfig): void {
  const tmp = SLIDE_CONFIG_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8')
  fs.renameSync(tmp, SLIDE_CONFIG_PATH)
}

export function patchSlide(slideId: string, patch: Partial<Slide>): SlideConfig {
  const config = readConfig()
  if (!config) throw new Error('No slide-config.json found. Upload a PPTX first.')

  const idx = config.slides.findIndex(s => s.id === slideId)
  if (idx === -1) throw new Error(`Slide '${slideId}' not found in config.`)

  config.slides[idx] = { ...config.slides[idx], ...patch }
  writeConfig(config)
  return config
}
