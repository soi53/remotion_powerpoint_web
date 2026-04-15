import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Video,
  Series,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { useEffect, useState } from "react";
import { Subtitle } from "./Subtitle";

// ─── 디자인 토큰 ───────────────────────────────────────────────────
const COLORS = {
  bg: "#0a0805",
  amber: "#e9a84c",
  white: "#ffffff",
};

const FONT = `'Pretendard Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif`;

// ─── 씬 데이터 타입 ────────────────────────────────────────────────
export interface SceneData {
  id: string;
  image?: string;
  video?: string;
  audio: string;
  narration: string;
  hook_text?: string;
  audioDurationInFrames: number;
}

// ─── 타이밍 헬퍼 ─────────────────────────────────────────────────────
function animIn(frame: number, delay: number, duration: number): number {
  return interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function kenBurns(frame: number, totalFrames: number): number {
  return interpolate(frame, [0, totalFrames], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── 개별 씬 컴포넌트 ─────────────────────────────────────────────
const ShortsSlide: React.FC<{
  scene: SceneData;
  isLast: boolean;
}> = ({ scene, isLast }) => {
  const frame = useCurrentFrame();
  const total = scene.audioDurationInFrames;

  const fadeIn = animIn(frame, 0, 15);
  const fadeOut = interpolate(frame, [total - 12, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  const textOpacity = animIn(frame, 10, 18);
  const textY = interpolate(frame, [10, 28], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const lineWidth = interpolate(frame, [15, 45], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const zoom = kenBurns(frame, total);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      {/* 나레이션 오디오 */}
      <Audio
        src={staticFile(scene.audio)}
        volume={(f) =>
          interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" })
        }
      />

      {/* 배경 미디어 */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {scene.video ? (
          <Video
            src={staticFile(scene.video)}
            loop
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Img
            src={staticFile(scene.image!)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        )}
      </AbsoluteFill>

      {/* 다크 오버레이 */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 25%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* hook_text 오버레이 — 상단 중앙 */}
      {scene.hook_text && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: animIn(frame, 8, 20),
            transform: `translateY(${interpolate(frame, [8, 28], [-20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 64,
              fontWeight: 900,
              color: COLORS.white,
              textAlign: "center",
              lineHeight: 1.2,
              letterSpacing: "-1px",
              paddingLeft: 60,
              paddingRight: 60,
              textShadow: "0 2px 24px rgba(0,0,0,0.8)",
            }}
          >
            {scene.hook_text}
          </div>
          {/* 언더라인 액센트 */}
          <div
            style={{
              marginTop: 16,
              height: 3,
              width: interpolate(frame, [20, 50], [0, 160], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              background: COLORS.amber,
              borderRadius: 2,
              boxShadow: `0 0 16px ${COLORS.amber}`,
            }}
          />
        </div>
      )}

      {/* 하단 콘텐츠 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingLeft: 60,
          paddingRight: 60,
          paddingBottom: 280,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {/* 액센트 라인 */}
        <div
          style={{
            height: 2,
            width: lineWidth,
            background: COLORS.amber,
            borderRadius: 1,
            marginBottom: 20,
            boxShadow: `0 0 12px ${COLORS.amber}`,
          }}
        />

        {/* 나레이션 텍스트 */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 68,
            fontWeight: 800,
            color: COLORS.white,
            lineHeight: 1.25,
            letterSpacing: "-0.5px",
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          {scene.narration}
        </div>

        {/* 마지막 씬 CTA */}
        {isLast && (
          <div
            style={{
              marginTop: 40,
              opacity: animIn(frame, total - 60, 20),
              transform: `scale(${interpolate(
                frame,
                [total - 60, total - 40],
                [0.88, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                }
              )})`,
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.bg,
                background: COLORS.amber,
                paddingTop: 16,
                paddingBottom: 16,
                paddingLeft: 44,
                paddingRight: 44,
                borderRadius: 50,
              }}
            >
              팔로우하고 더 받아보기 ✨
            </div>
          </div>
        )}
      </div>

      {/* 자막 */}
      <Subtitle
        text={scene.narration}
        startFrame={15}
        durationInFrames={scene.audioDurationInFrames - 15}
      />
    </AbsoluteFill>
  );
};

// ─── 메인 쇼츠 컴포지션 ───────────────────────────────────────────
export const ShortsComposition: React.FC = () => {
  const [scenes, setScenes] = useState<SceneData[] | null>(null);
  const [handle] = useState(() => delayRender("script.json 로딩 중..."));

  useEffect(() => {
    fetch(staticFile("current/script.json"))
      .then((r) => r.json())
      .then((data) => {
        setScenes(data);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  if (!scenes) return <AbsoluteFill style={{ background: COLORS.bg }} />;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence
            key={scene.id}
            durationInFrames={scene.audioDurationInFrames}
            premountFor={15}
          >
            <ShortsSlide scene={scene} isLast={i === scenes.length - 1} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
