'use client'

import { useRouter } from 'next/navigation'
import RemotionPreview from '@/components/RemotionPreview'

export default function PreviewPage() {
  const router = useRouter()

  return (
    <main className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-bold text-gray-900">프리뷰</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/editor/voiceover')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← TTS 생성
          </button>
          <button
            onClick={() => router.push('/editor/render')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            다음: 렌더 →
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 p-6 min-h-0 flex flex-col">
        <RemotionPreview autoStart={false} />
      </div>
    </main>
  )
}
