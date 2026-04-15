import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { SpeechAlignment } from "./PresentationComposition";

const FONT = `'Pretendard Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif`;

interface SubtitleProps {
  text: string;
  startFrame?: number;
  durationInFrames?: number;
  alignment?: SpeechAlignment;
}

// ── 문장 단위 분리 ────────────────────────────────────────────────────
// 마침표, 쉼표, 물음표, 느낌표 뒤에서 분리. 빈 문자열 제거.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.。,，?!])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── alignment에서 문장의 시작/끝 시간 계산 ───────────────────────────
interface SentenceTiming {
  text: string;
  startSec: number;
  endSec: number;
}

function buildSentenceTimings(
  text: string,
  alignment: SpeechAlignment
): SentenceTiming[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const fullText = characters.join("");
  const sentences = splitSentences(text);
  const timings: SentenceTiming[] = [];

  let searchFrom = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    // 구두점 포함 원문에서 위치 탐색
    const pos = fullText.indexOf(sentence[0], searchFrom);
    if (pos === -1) {
      const prevEnd = timings.length > 0 ? timings[timings.length - 1].endSec : 0;
      timings.push({ text: sentence, startSec: prevEnd, endSec: prevEnd + 2 });
      continue;
    }

    const startSec = character_start_times_seconds[pos] ?? 0;

    // 이 문장의 마지막 글자 위치
    const endPos = pos + sentence.length - 1;
    const endSec = character_end_times_seconds[Math.min(endPos, characters.length - 1)] ?? startSec + 2;

    timings.push({ text: sentence, startSec, endSec });
    searchFrom = pos + sentence.length;
  }

  return timings;
}

// alignment 없을 때: 문장 길이 비례로 시간 추정
function buildSentenceTimingsEstimated(
  text: string,
  totalSec: number
): SentenceTiming[] {
  const sentences = splitSentences(text);
  const totalLen = sentences.reduce((s, t) => s + t.length, 0);
  const timings: SentenceTiming[] = [];
  let elapsed = 0;
  for (const sentence of sentences) {
    const dur = (sentence.length / totalLen) * totalSec;
    timings.push({ text: sentence, startSec: elapsed, endSec: elapsed + dur });
    elapsed += dur;
  }
  return timings;
}

export const Subtitle: React.FC<SubtitleProps> = ({
  text,
  startFrame = 10,
  durationInFrames,
  alignment,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalDurationSec = alignment
    ? (alignment.character_end_times_seconds.at(-1) ?? 0)
    : (durationInFrames ? durationInFrames / fps : text.length / 4.5);
  const totalDurFrames = Math.round(totalDurationSec * fps);

  const elapsedSec = (frame - startFrame) / fps;

  // 나레이션 구간 밖이면 숨김
  if (frame < startFrame || frame > startFrame + totalDurFrames + fps) return null;

  // ── 문장 타이밍 ────────────────────────────────────────────────────
  const sentenceTimings: SentenceTiming[] = alignment
    ? buildSentenceTimings(text, alignment)
    : buildSentenceTimingsEstimated(text, totalDurationSec);

  // 현재 발화 중인 문장 인덱스
  let activeIdx = sentenceTimings.findIndex(
    (t) => elapsedSec >= t.startSec && elapsedSec < t.endSec
  );
  // 발화 구간 사이 공백(쉬는 구간)에서는 직전 문장 유지
  if (activeIdx === -1) {
    for (let i = sentenceTimings.length - 1; i >= 0; i--) {
      if (elapsedSec >= sentenceTimings[i].startSec) {
        activeIdx = i;
        break;
      }
    }
  }
  if (activeIdx === -1) activeIdx = 0;

  const current = sentenceTimings[activeIdx];
  if (!current) return null;

  // ── 문장 전환 시 페이드 (빠른 크로스페이드) ─────────────────────────
  const sentenceStartFr = startFrame + Math.round(current.startSec * fps);
  const fadeIn = interpolate(frame, [sentenceStartFr, sentenceStartFr + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.6)",
          borderRadius: 12,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 32,
          paddingRight: 32,
          maxWidth: 1300,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize: 38,
            fontWeight: 600,
            color: "#ffffff",
            lineHeight: 1.5,
            letterSpacing: "0.3px",
          }}
        >
          {current.text}
        </span>
      </div>
    </div>
  );
};
