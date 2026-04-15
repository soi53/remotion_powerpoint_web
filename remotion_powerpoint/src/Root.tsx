import "./index.css";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { staticFile } from "remotion";
import { ShortsComposition } from "./ShortsComposition";
import type { SceneData } from "./ShortsComposition";
import { PresentationComposition } from "./PresentationComposition";
import type { SlideConfig } from "./PresentationComposition";

// 각 씬의 audioDurationInFrames 합산으로 총 길이 계산
const calculateMetadata: CalculateMetadataFunction<
  Record<string, unknown>
> = async () => {
  const res = await fetch(staticFile("current/script.json"));
  const script: SceneData[] = await res.json();
  const totalFrames = script.reduce(
    (sum, scene) => sum + (scene.audioDurationInFrames ?? 150),
    0,
  );

  return {
    durationInFrames: totalFrames,
  };
};

const PRESENTATION_FPS = 30;

// PresentationPlayer: slide-config.json 기반 총 길이 계산
const calculatePresentationMetadata: CalculateMetadataFunction<
  Record<string, unknown>
> = async () => {
  const res = await fetch(staticFile("current/slide-config.json"));
  const data = await res.json();
  const slides: SlideConfig[] = Array.isArray(data)
    ? data
    : (data.slides ?? []);

  // 각 슬라이드 duration(초) × fps 합산
  const totalFrames = slides.reduce(
    (sum, slide) => sum + Math.round((slide.duration ?? 5) * PRESENTATION_FPS),
    0,
  );

  // 슬라이드 비율에 따라 영상 크기 결정 (기본 16:9)
  const meta = Array.isArray(data) ? null : data.meta;
  const isWidescreen = !meta || meta.slideW / meta.slideH > 1.6;
  const width = isWidescreen ? 1920 : 1440;
  const height = 1080;

  return { durationInFrames: totalFrames, fps: PRESENTATION_FPS, width, height };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PresentationPlayer"
        component={PresentationComposition}
        calculateMetadata={calculatePresentationMetadata}
        durationInFrames={5 * 30 * 10} // 기본값 (10슬라이드 × 5초)
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
