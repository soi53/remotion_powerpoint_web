'use client'

import { useState, useEffect, useRef } from 'react'

export interface Voice {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
  preview_url: string | null
}

// Default voice (Matilda — free premade, matches the script default)
export const DEFAULT_VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'

interface VoiceSelectorProps {
  value: string
  onChange: (voiceId: string) => void
  disabled?: boolean
}

export default function VoiceSelector({ value, onChange, disabled }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/voices')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          return
        }
        setVoices(data.voices ?? [])
        // If no value set yet, default to Matilda if available
        if (!value) {
          const matilda = data.voices?.find((v: Voice) => v.voice_id === DEFAULT_VOICE_ID)
          if (matilda) onChange(DEFAULT_VOICE_ID)
          else if (data.voices?.length > 0) onChange(data.voices[0].voice_id)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    onChange(id)
    const v = voices.find(x => x.voice_id === id)
    setPreviewUrl(v?.preview_url ?? null)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  function handlePreview() {
    if (!previewUrl) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      return
    }
    const audio = new Audio(previewUrl)
    audioRef.current = audio
    audio.play()
    audio.onended = () => { audioRef.current = null }
  }

  if (loading) {
    return <span className="text-xs text-gray-400">음성 목록 로드 중...</span>
  }
  if (error) {
    return <span className="text-xs text-red-500">음성 로드 실패: {error}</span>
  }

  const selectedVoice = voices.find(v => v.voice_id === value)

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600 whitespace-nowrap">음성</label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled || voices.length === 0}
        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[200px]"
      >
        {voices.map(v => (
          <option key={v.voice_id} value={v.voice_id}>
            {v.name} {v.labels['gender'] ? `(${v.labels['gender']})` : ''}
          </option>
        ))}
      </select>
      {selectedVoice?.preview_url && (
        <button
          onClick={handlePreview}
          disabled={disabled}
          title="미리 듣기"
          className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </button>
      )}
    </div>
  )
}
