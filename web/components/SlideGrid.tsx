'use client'

import Image from 'next/image'

export interface SlideItem {
  id: string
  url: string
  narration?: string
  enabled?: boolean
}

interface SlideGridProps {
  slides: SlideItem[]
  /** Optional: highlight a selected slide */
  selectedId?: string
  onSelect?: (id: string) => void
  /** When provided, checkboxes are shown for enabling/disabling slides */
  enabledIds?: Set<string>
  onToggleEnabled?: (id: string) => void
}

export default function SlideGrid({
  slides,
  selectedId,
  onSelect,
  enabledIds,
  onToggleEnabled,
}: SlideGridProps) {
  const selectable = !!onToggleEnabled && !!enabledIds

  if (slides.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        슬라이드가 없습니다.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {slides.map((slide, idx) => {
        const isEnabled = !selectable || enabledIds!.has(slide.id)
        return (
          <div
            key={slide.id}
            className={[
              'group relative rounded-lg overflow-hidden border-2 transition-all',
              selectedId === slide.id
                ? 'border-blue-500 ring-2 ring-blue-300'
                : isEnabled
                ? 'border-gray-200 hover:border-blue-300'
                : 'border-gray-200 opacity-40',
            ].join(' ')}
          >
            {/* Checkbox overlay (top-left) */}
            {selectable && (
              <button
                type="button"
                onClick={() => onToggleEnabled!(slide.id)}
                className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded flex items-center justify-center shadow"
                style={{
                  backgroundColor: isEnabled ? '#2563eb' : 'rgba(255,255,255,0.85)',
                  border: isEnabled ? '2px solid #2563eb' : '2px solid #9ca3af',
                }}
                title={isEnabled ? '클릭하여 제외' : '클릭하여 포함'}
              >
                {isEnabled && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )}

            {/* Slide thumbnail (clickable for selection) */}
            <button
              type="button"
              onClick={() => onSelect?.(slide.id)}
              className="w-full text-left"
            >
              <div className="relative aspect-video bg-gray-100">
                <Image
                  src={slide.url}
                  alt={`Slide ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  unoptimized
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                <span className="text-white text-xs font-medium">{idx + 1}</span>
              </div>
              {slide.narration && (
                <div className="px-2 py-1 text-xs text-gray-600 truncate bg-white border-t border-gray-100">
                  {slide.narration}
                </div>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
