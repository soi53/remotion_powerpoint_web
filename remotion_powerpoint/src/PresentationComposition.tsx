import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Series,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useEffect, useState } from "react";
import { Subtitle } from "./Subtitle";

// ─── 타입 정의 ───────────────────────────────────────────────────────

/** zoom_to 대상 영역 (슬라이드 크기 기준 0~1 비율) */
interface ZoomTarget {
  left: number;   // 왼쪽 경계 (0.0 ~ 1.0)
  top: number;    // 위쪽 경계 (0.0 ~ 1.0)
  right: number;  // 오른쪽 경계 (0.0 ~ 1.0)
  bottom: number; // 아래쪽 경계 (0.0 ~ 1.0)
}

interface SlideMotion {
  type: "still" | "kenburns" | "zoom_to" | "pan";
  target?: ZoomTarget;       // zoom_to 전용
  triggerText?: string;      // zoom_to 전용: narration 내 이 텍스트 발화 시점에 줌인 시작
  startAt?: number;          // zoom_to 전용: 줌 시작 시점 (초). triggerText가 있으면 자동 계산
  zoomDuration?: number;     // zoom_to 전용: 줌 인/아웃 애니메이션 길이 (초, 기본 1.2)
  holdDuration?: number;     // zoom_to 전용: 줌인 유지 시간 (초). 설정 시 이후 자동 줌아웃
  direction?: "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top"; // pan 전용
}

export interface SlideConfig {
  id: string;
  image: string;
  audio?: string;
  narration?: string;
  duration: number;        // 초
  transition?: number;     // 페이드 길이 (초, 기본 0.5)
  motion?: SlideMotion;    // 기본 모션 (kenburns, still, pan 등)
  motions?: SlideMotion[]; // zoom_to 복수 지정 시 사용. 활성 zoom 없을 때 motion으로 폴백
  alignment?: SpeechAlignment; // ElevenLabs with-timestamps alignment (보이스오버 생성 시 자동 저장)
}

/** ElevenLabs /with-timestamps 응답의 alignment 객체 */
export interface SpeechAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ConfigFile {
  meta?: { videoW: number; videoH: number; slideW: number; slideH: number; subtitle?: boolean };
  slides: SlideConfig[];
}

// ─── 줌 트랜스폼 계산 ────────────────────────────────────────────────
//
// CSS transform-origin: center center 기준으로 계산.
// 슬라이드 이미지(W×H)가 컨테이너를 꽉 채울 때,
// target 영역 중앙이 컨테이너 중앙에 오도록 scale + translate 계산.
//
// 수식:
//   scale  = min(1/targetW, 1/targetH) * padding
//   txFinal = videoW * scale * (0.5 - targetCenterX)
//   tyFinal = videoH * scale * (0.5 - targetCenterY)
//   (origin=center이므로 scale 전에 중앙 이동 보정 포함)

interface Transform {
  scale: number;
  tx: number; // px
  ty: number; // px
}

// ─── triggerText → startAt 변환 ─────────────────────────────────────
// 한국어 평균 발화 속도: 약 4.5자/초 (발표용 편안한 속도 기준)
const KO_CHARS_PER_SEC = 4.5;

function resolveStartAt(
  motion: SlideMotion,
  narration: string | undefined,
  slideDuration: number
): number {
  if (motion.triggerText && narration) {
    const idx = narration.indexOf(motion.triggerText);
    if (idx >= 0) {
      const estimated = idx / KO_CHARS_PER_SEC;
      // 줌인+홀드+줌아웃이 슬라이드 안에 들어오도록 클램핑
      const zoomDur = motion.zoomDuration ?? 1.2;
      const holdDur = motion.holdDuration ?? 0;
      const maxStart = slideDuration - zoomDur * 2 - holdDur - 0.5;
      return Math.min(Math.max(estimated, 0), Math.max(maxStart, 0));
    }
  }
  return motion.startAt ?? 1.0;
}

// ─── 복수 motions에서 현재 프레임에 활성화된 motion 선택 ─────────────
// motions 배열 중 현재 frame이 해당 motion의 활성 구간(줌인~줌아웃 완료)에
// 속하는 것을 찾아 반환. 없으면 null (→ 기본 motion 폴백).
function getActiveMotion(
  frame: number,
  fps: number,
  motions: SlideMotion[],
  narration: string | undefined,
  slideDuration: number
): SlideMotion | null {
  for (const m of motions) {
    if (m.type !== "zoom_to" || !m.target) continue;

    const startAt = resolveStartAt(m, narration, slideDuration);
    const zoomDur = m.zoomDuration ?? 1.2;
    const holdDur = m.holdDuration ?? 0;
    const startFr = Math.round(startAt * fps);
    // holdDuration 미설정 시 → 슬라이드 끝까지 활성
    const endFr = holdDur > 0
      ? Math.round((startAt + zoomDur * 2 + holdDur) * fps)
      : Infinity;

    if (frame >= startFr && frame <= endFr) return m;
  }
  return null;
}

function computeTransform(
  frame: number,
  totalFrames: number,
  fps: number,
  motion: SlideMotion | undefined,
  videoW: number,
  videoH: number,
  narration?: string,
  slideDuration?: number
): Transform {
  const identity: Transform = { scale: 1, tx: 0, ty: 0 };

  if (!motion || motion.type === "still") return identity;

  // ── kenburns: 전체 슬라이드 서서히 줌인 ─────────────────────────────
  if (motion.type === "kenburns") {
    const scale = interpolate(frame, [0, totalFrames], [1, 1.08], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { scale, tx: 0, ty: 0 };
  }

  // ── zoom_to: 지정 영역으로 줌인 → 홀드 → 줌아웃 ────────────────────
  if (motion.type === "zoom_to" && motion.target) {
    const { target } = motion;
    const resolvedStartAt = resolveStartAt(motion, narration, slideDuration ?? totalFrames / fps);
    const startAtFr = Math.round(resolvedStartAt * fps);
    const zoomInFr = Math.round((motion.zoomDuration ?? 1.2) * fps);
    const holdFr = motion.holdDuration != null
      ? Math.round(motion.holdDuration * fps)
      : totalFrames; // holdDuration 미설정 시 슬라이드 끝까지 유지
    const zoomOutStart = startAtFr + zoomInFr + holdFr;
    const zoomOutEnd = zoomOutStart + zoomInFr; // 줌아웃은 줌인과 같은 시간

    const targetW = target.right - target.left;
    const targetH = target.bottom - target.top;
    const targetCX = (target.left + target.right) / 2;
    const targetCY = (target.top + target.bottom) / 2;

    // 타겟 영역이 너무 작으면(드래그 없이 클릭만 한 경우 등) zoom 스킵
    if (targetW < 0.01 || targetH < 0.01) return identity;

    // 패딩 0.88: 타겟 영역이 화면 88%를 채우도록
    const maxScale = Math.min(1 / targetW, 1 / targetH) * 0.88;
    const txFinal = videoW * maxScale * (0.5 - targetCX);
    const tyFinal = videoH * maxScale * (0.5 - targetCY);

    // progress 계산: 줌인(0→1) / 홀드(1) / 줌아웃(1→0) 세 구간
    let progress: number;
    if (frame <= startAtFr) {
      progress = 0; // 전체 뷰
    } else if (frame <= startAtFr + zoomInFr) {
      progress = interpolate(frame, [startAtFr, startAtFr + zoomInFr], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    } else if (frame <= zoomOutStart) {
      progress = 1; // 홀드
    } else {
      progress = interpolate(frame, [zoomOutStart, zoomOutEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic),
      });
    }

    const scale = interpolate(progress, [0, 1], [1, maxScale]);
    const tx = interpolate(progress, [0, 1], [0, txFinal]);
    const ty = interpolate(progress, [0, 1], [0, tyFinal]);

    return { scale, tx, ty };
  }

  // ── pan: 수평/수직 패닝 ──────────────────────────────────────────────
  if (motion.type === "pan") {
    const PAN = 0.03; // 3% 이동
    const dir = motion.direction ?? "left-to-right";
    const p = interpolate(frame, [0, totalFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    let tx = 0, ty = 0;
    if (dir === "left-to-right") tx = interpolate(p, [0, 1], [-PAN * videoW, PAN * videoW]);
    if (dir === "right-to-left") tx = interpolate(p, [0, 1], [PAN * videoW, -PAN * videoW]);
    if (dir === "top-to-bottom") ty = interpolate(p, [0, 1], [-PAN * videoH, PAN * videoH]);
    if (dir === "bottom-to-top") ty = interpolate(p, [0, 1], [PAN * videoH, -PAN * videoH]);

    return { scale: 1.06, tx, ty };
  }

  return identity;
}

// ─── 개별 슬라이드 컴포넌트 ──────────────────────────────────────────
const PresentationSlide: React.FC<{
  slide: SlideConfig;
  isLast: boolean;
  showSubtitle: boolean;
}> = ({ slide, isLast, showSubtitle }) => {
  const frame = useCurrentFrame();
  const { fps, width: videoW, height: videoH } = useVideoConfig();
  const totalFrames = Math.round(slide.duration * fps);
  const fadeDuration = Math.round((slide.transition ?? 0.5) * fps);

  // 슬라이드 인/아웃 페이드
  const fadeIn = interpolate(frame, [0, fadeDuration], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [totalFrames - fadeDuration, totalFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  // motions 배열이 있으면 현재 프레임에 활성 zoom을 찾고,
  // 없으면 기본 motion으로 폴백
  const effectiveMotion = slide.motions
    ? (getActiveMotion(frame, fps, slide.motions, slide.narration, slide.duration)
      ?? slide.motion)
    : slide.motion;

  const { scale, tx, ty } = computeTransform(
    frame, totalFrames, fps, effectiveMotion, videoW, videoH,
    slide.narration, slide.duration
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* 나레이션 오디오 */}
      {slide.audio && (
        <Audio
          src={staticFile(slide.audio)}
          volume={1}
        />
      )}

      {/* 슬라이드 이미지 + 모션 */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile(slide.image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",       // 컨테이너에 맞게 채움 (16:9 슬라이드 기준)
            transformOrigin: "center center",
            transform: `scale(${scale}) translate(${tx / scale}px, ${ty / scale}px)`,
            // translate를 scale 내부에서 적용: translate(tx/scale)을 scale 후 적용하면 최종적으로 tx이동
          }}
        />
      </AbsoluteFill>

      {/* 나레이션 자막 (단어별 하이라이트) */}
      {showSubtitle && slide.narration && (
        <Subtitle
          text={slide.narration}
          startFrame={fadeDuration}
          durationInFrames={totalFrames - fadeDuration * 2}
          alignment={slide.alignment}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── 메인 컴포지션 ────────────────────────────────────────────────────
export const PresentationComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const [config, setConfig] = useState<ConfigFile | null>(null);
  const [handle] = useState(() => delayRender("slide-config.json 로딩 중..."));

  useEffect(() => {
    fetch(staticFile("current/slide-config.json"))
      .then((r) => r.json())
      .then((data: ConfigFile | SlideConfig[]) => {
        // 구버전 호환: 배열로 직접 저장된 경우도 처리
        if (Array.isArray(data)) {
          setConfig({ slides: data });
        } else {
          setConfig(data);
        }
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  if (!config) return <AbsoluteFill style={{ background: "#000" }} />;

  const { slides, meta } = config;
  const showSubtitle = meta?.subtitle !== false;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Series>
        {slides.map((slide, i) => (
          <Series.Sequence
            key={slide.id}
            durationInFrames={Math.round(slide.duration * fps)}
            premountFor={15}
          >
            <PresentationSlide
              slide={slide}
              isLast={i === slides.length - 1}
              showSubtitle={showSubtitle}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
