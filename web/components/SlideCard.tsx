'use client'

import Image from 'next/image'

interface Props {
  index: number
  id: string
  imageUrl: string
  narration: string
  duration: number
  selected: boolean
  onClick: () => void
}

export default function SlideCard({ index, id, imageUrl, narration, duration, selected, onClick }: Props) {
  const hasNarration = narration.trim().length > 0

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left rounded-xl overflow-hidden border-2 transition-all',
        selected
          ? 'border-blue-500 ring-2 ring-blue-300 shadow-md'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm',
      ].join(' ')}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        <Image
          src={imageUrl}
          alt={`Slide ${index + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 280px"
          unoptimized
        />
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded">
          {index + 1}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
          {duration.toFixed(1)}s
        </div>
      </div>

      {/* Narration preview */}
      <div className="px-3 py-2 min-h-[3rem] bg-white">
        {hasNarration ? (
          <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{narration}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">나레이션 없음</p>
        )}
      </div>

      {/* Status indicator */}
      <div className={[
        'h-1',
        hasNarration ? 'bg-green-400' : 'bg-gray-200',
      ].join(' ')} />
    </button>
  )
}
