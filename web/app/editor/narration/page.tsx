'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SlideConfig, Slide } from '@/lib/config'
import SlideCard from '@/components/SlideCard'
import NarrationEditor from '@/components/NarrationEditor'
import LanguageSelector from '@/components/LanguageSelector'
import SubtitleToggle from '@/components/SubtitleToggle'

type LoadState = 'loading' | 'ready' | 'error'
type TranslateState = 'idle' | 'translating' | 'done' | 'error'

export default function NarrationPage() {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [config, setConfig] = useState<SlideConfig | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Translation state
  const [targetLanguage, setTargetLanguage] = useState('')
  const [translateState, setTranslateState] = useState<TranslateState>('idle')
  const [translateError, setTranslateError] = useState<string | null>(null)

  // Slide image URLs (served via /api/static)
  const slideImageUrl = useCallback(
    (slide: Slide) => `/api/static/current/slides/${slide.id}.png`,
    []
  )

  // Load config on mount
  useEffect(() => {
    async function load() {
      const res = await fetch('/api/config')
      if (res.status === 404) {
        setLoadState('error')
        setLoadError('업로드된 프로젝트가 없습니다. 먼저 PPTX를 업로드하세요.')
        return
      }
      if (!res.ok) {
        setLoadState('error')
        setLoadError(`설정을 불러오지 못했습니다. (${res.status})`)
        return
      }
      const data: SlideConfig = await res.json()
      setConfig(data)
      const firstActive = data.slides.find(s => s.enabled !== false)
      setSelectedId(firstActive?.id ?? null)
      setLoadState('ready')
    }
    load()
  }, [])

  // Only show enabled slides (enabled === undefined or true)
  const activeSlides = config?.slides.filter(s => s.enabled !== false) ?? []

  const selectedIndex = activeSlides.findIndex(s => s.id === selectedId)
  const selectedSlide = selectedIndex >= 0 ? activeSlides[selectedIndex] : null

  // Save single slide narration + duration via PATCH
  async function handleSave(narration: string, duration: number) {
    if (!selectedId) return
    const res = await fetch(`/api/config/slide/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narration, duration }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? '저장 실패')
    }
    // Update local state
    setConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map(s =>
          s.id === selectedId ? { ...s, narration, duration } : s
        ),
      }
    })
  }

  function handleNavigate(direction: 'prev' | 'next') {
    const idx = activeSlides.findIndex(s => s.id === selectedId)
    if (direction === 'prev' && idx > 0) setSelectedId(activeSlides[idx - 1].id)
    if (direction === 'next' && idx < activeSlides.length - 1) setSelectedId(activeSlides[idx + 1].id)
  }

  // Translate all narrations
  async function handleTranslate() {
    if (!config || !targetLanguage) return
    setTranslateState('translating')
    setTranslateError(null)

    const narrations = activeSlides.map(s => s.narration)
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narrations, targetLanguage }),
    })
    const data = await res.json()

    if (!res.ok) {
      setTranslateState('error')
      setTranslateError(data.error ?? '번역에 실패했습니다.')
      return
    }

    const translated: string[] = data.narrations
    // Apply translations to active slides only, preserve disabled slides as-is
    const activeIds = new Set(activeSlides.map(s => s.id))
    const activeMap = new Map(activeSlides.map((s, i) => [s.id, translated[i] ?? s.narration]))
    const newConfig: SlideConfig = {
      ...config,
      slides: config.slides.map(s =>
        activeIds.has(s.id) ? { ...s, narration: activeMap.get(s.id)! } : s
      ),
    }
    const putRes = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    if (!putRes.ok) {
      setTranslateState('error')
      setTranslateError('번역 결과 저장에 실패했습니다.')
      return
    }
    setConfig(newConfig)
    setTranslateState('done')
    setTimeout(() => setTranslateState('idle'), 3000)
  }

  const completedCount = activeSlides.filter(s => s.narration.trim()).length
  const totalCount = activeSlides.length

  // ── Render ─────────────────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <main className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">불러오는 중...</div>
      </main>
    )
  }

  if (loadState === 'error') {
    return (
      <main className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
        <button
          onClick={() => router.push('/editor/upload')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          업로드 페이지로 이동
        </button>
      </main>
    )
  }

  return (
    <main className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">나레이션 편집</h1>
          <span className="text-sm text-gray-500">
            {completedCount}/{totalCount}개 작성됨
          </span>
          {/* Progress bar */}
          <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Subtitle toggle */}
          <SubtitleToggle />

          {/* Translate section */}
          <div className="flex items-center gap-2">
            <LanguageSelector
              value={targetLanguage}
              onChange={setTargetLanguage}
              disabled={translateState === 'translating'}
            />
            <button
              onClick={handleTranslate}
              disabled={!targetLanguage || translateState === 'translating'}
              className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {translateState === 'translating' ? '번역 중...' : '전체 번역'}
            </button>
            {translateState === 'done' && (
              <span className="text-xs text-green-600 font-medium">완료!</span>
            )}
            {translateState === 'error' && translateError && (
              <span className="text-xs text-red-600">{translateError}</span>
            )}
          </div>

          {/* Next step */}
          <button
            onClick={() => router.push('/editor/voiceover')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            다음: TTS 생성 →
          </button>
        </div>
      </header>

      {/* Body: slide list + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide list */}
        <aside className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50 shrink-0 p-3 space-y-2">
          {activeSlides.map((slide, idx) => (
            <SlideCard
              key={slide.id}
              index={idx}
              id={slide.id}
              imageUrl={slideImageUrl(slide)}
              narration={slide.narration}
              duration={slide.duration}
              selected={slide.id === selectedId}
              onClick={() => setSelectedId(slide.id)}
            />
          ))}
        </aside>

        {/* Editor panel */}
        <section className="flex-1 overflow-y-auto p-6">
          {selectedSlide ? (
            <NarrationEditor
              key={selectedSlide.id}
              slide={selectedSlide}
              imageUrl={slideImageUrl(selectedSlide)}
              index={selectedIndex}
              total={totalCount}
              onSave={handleSave}
              onNavigate={handleNavigate}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              왼쪽에서 슬라이드를 선택하세요
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
