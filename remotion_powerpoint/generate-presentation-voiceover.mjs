import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { Input, ALL_FORMATS, FilePathSource } from "mediabunny";
import path from "path";

// ── 환경변수 로드 ────────────────────────────────────────────────────
const env = readFileSync(".env", "utf-8");
const apiKey = env.match(/ELEVENLABS_API_KEY=(.+)/)?.[1]?.trim();
const isPaid = env.match(/ELEVENLABS_PLAN=paid/i) !== null;

if (!apiKey) {
  console.error("❌ ELEVENLABS_API_KEY not found in .env");
  process.exit(1);
}

const CONFIG_PATH = "public/current/slide-config.json";
const AUDIO_DIR = "public/current/audio";
const STATUS_PATH = "public/current/audio-status.json";
const FPS = 30;
const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda — 무료 premade

// ── CLI 플래그 파싱 ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes("--force");        // 이미 생성된 것도 덮어쓰기
const RETRY_FAILED = args.includes("--retry-failed"); // 실패 항목만 재실행

// --voice-id <id> : 음성 ID 재정의 (기본값: VOICE_ID 상수)
const voiceIdArgIdx = args.indexOf("--voice-id");
const VOICE_ID_OVERRIDE = voiceIdArgIdx !== -1 ? args[voiceIdArgIdx + 1] : null;

mkdirSync(AUDIO_DIR, { recursive: true });

// ── slide-config.json 로드 ──────────────────────────────────────────
const configRaw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const slides = Array.isArray(configRaw) ? configRaw : configRaw.slides;
const narrSlides = slides.filter((s) => s.narration?.trim());

console.log(`📋 총 ${slides.length}장 중 나레이션 있는 슬라이드: ${narrSlides.length}장`);
if (FORCE) console.log("   ⚠️  --force: 기존 파일 무시하고 전부 재생성");
if (RETRY_FAILED) console.log("   🔁 --retry-failed: 이전 실패 항목만 재실행");
console.log();

// ── audio-status.json 로드 ──────────────────────────────────────────
// 구조: { "slide-01": "ok" | "failed" | "skipped" }
let status = {};
if (existsSync(STATUS_PATH)) {
  try {
    status = JSON.parse(readFileSync(STATUS_PATH, "utf-8"));
  } catch {
    status = {};
  }
}

// ── triggerText → startAt 추출 (alignment 기반) ─────────────────────
// alignment.characters 배열에서 triggerText 첫 글자 위치를 찾아
// character_start_times_seconds 에서 실제 발화 시점(초) 반환.
function resolveStartAtFromAlignment(alignment, triggerText) {
  if (!triggerText || !alignment) return null;

  const chars = alignment.characters ?? [];
  const startTimes = alignment.character_start_times_seconds ?? [];

  // triggerText의 첫 글자부터 순서대로 매칭되는 시작 인덱스 탐색
  const target = triggerText.trim();
  for (let i = 0; i <= chars.length - target.length; i++) {
    const slice = chars.slice(i, i + target.length).join("");
    if (slice === target) {
      return startTimes[i] ?? null;
    }
  }
  return null;
}

// ── SlideMotion 에서 triggerText 목록 추출 ──────────────────────────
function collectTriggers(slide) {
  const triggers = [];
  const motions = slide.motions ?? (slide.motion ? [slide.motion] : []);
  for (const m of motions) {
    if (m.type === "zoom_to" && m.triggerText) {
      triggers.push(m.triggerText);
    }
  }
  return triggers;
}

// ── ElevenLabs TTS with-timestamps 호출 ─────────────────────────────
async function generateAudioWithTimestamps(text, slideId) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_OVERRIDE ?? VOICE_ID}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`ElevenLabs 오류 [${slideId}]: ${JSON.stringify(err.detail ?? err)}`);
  }

  // 응답: { audio_base64, alignment, normalized_alignment }
  const json = await res.json();
  return json;
}

// ── 오디오 길이 측정 (초) ────────────────────────────────────────────
async function measureDuration(filePath) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new FilePathSource(path.resolve(filePath)),
  });
  return await input.computeDuration();
}

// ── 메인 실행 ────────────────────────────────────────────────────────
const updatedSlides = [...slides];
let processedCount = 0;
let skippedCount = 0;
let failedCount = 0;

for (let i = 0; i < slides.length; i++) {
  const slide = slides[i];
  if (!slide.narration?.trim()) continue;

  const num = slide.id.replace("slide-", "");
  const filePath = `${AUDIO_DIR}/slide-${num}.mp3`;

  // ── 스킵 판단 ───────────────────────────────────────────────────
  const alreadyOk = existsSync(filePath) && status[slide.id] === "ok";
  const isFailed = status[slide.id] === "failed";

  if (RETRY_FAILED && !isFailed) {
    console.log(`⏭️  [${slide.id}] 건너뜀 (--retry-failed: 실패 항목 아님)`);
    skippedCount++;
    continue;
  }

  if (!FORCE && !RETRY_FAILED && alreadyOk) {
    console.log(`⏭️  [${slide.id}] 건너뜀 (이미 생성됨 — 재생성하려면 --force 사용)`);
    skippedCount++;
    continue;
  }

  // ── TTS 생성 ────────────────────────────────────────────────────
  try {
    console.log(`🎙️  [${slide.id}] 생성 중...`);
    const { audio_base64, alignment } = await generateAudioWithTimestamps(
      slide.narration,
      slide.id
    );

    // base64 → MP3 저장
    const audioBuffer = Buffer.from(audio_base64, "base64");
    writeFileSync(filePath, audioBuffer);

    // 실제 오디오 길이 측정
    const seconds = await measureDuration(filePath);
    const rounded = Math.ceil(seconds * 10) / 10;

    // ── alignment 기반 startAt 갱신 ───────────────────────────────
    // motions[] 또는 motion 에서 triggerText가 있는 zoom_to 를 찾아
    // 실제 발화 시점으로 startAt 을 덮어씀
    let updatedMotion = slide.motion ? { ...slide.motion } : slide.motion;
    let updatedMotions = slide.motions ? slide.motions.map((m) => ({ ...m })) : slide.motions;

    const applyAlignment = (m) => {
      if (m.type !== "zoom_to" || !m.triggerText) return m;
      const startAt = resolveStartAtFromAlignment(alignment, m.triggerText);
      if (startAt !== null) {
        const result = { ...m, startAt: Math.round(startAt * 100) / 100 };
        console.log(
          `   🎯 [${slide.id}] triggerText "${m.triggerText}" → startAt ${result.startAt}초 (alignment 측정)`
        );
        return result;
      } else {
        console.warn(
          `   ⚠️  [${slide.id}] triggerText "${m.triggerText}" alignment에서 찾지 못함 — startAt 유지`
        );
        return m;
      }
    };

    if (updatedMotions) {
      updatedMotions = updatedMotions.map(applyAlignment);
    } else if (updatedMotion) {
      updatedMotion = applyAlignment(updatedMotion);
    }

    updatedSlides[i] = {
      ...slide,
      audio: `current/audio/slide-${num}.mp3`,
      duration: rounded + 1.0,
      alignment: alignment ?? undefined,
      ...(updatedMotion !== slide.motion && { motion: updatedMotion }),
      ...(updatedMotions !== slide.motions && { motions: updatedMotions }),
    };

    status[slide.id] = "ok";
    processedCount++;
    console.log(`   ✅ 저장: ${filePath}  (${rounded}초 → duration: ${rounded + 1.0}초)`);
  } catch (err) {
    status[slide.id] = "failed";
    failedCount++;
    console.error(`   ❌ 실패 [${slide.id}]: ${err.message}`);
  }

  // ElevenLabs 무료 플랜 rate limit 방지 (약 3req/min)
  const isLast = i === slides.length - 1 ||
    !slides.slice(i + 1).some((s) => s.narration?.trim());
  if (!isLast) {
    const waitMs = isPaid ? 1_000 : 20_000;
    process.stdout.write(`   ⏳ ${waitMs / 1000}초 대기...\r`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// ── slide-config.json 업데이트 ──────────────────────────────────────
const output = Array.isArray(configRaw)
  ? updatedSlides
  : { ...configRaw, slides: updatedSlides };

writeFileSync(CONFIG_PATH, JSON.stringify(output, null, 2));

// ── audio-status.json 업데이트 ──────────────────────────────────────
writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

// ── 요약 ────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────────`);
console.log(`생성: ${processedCount}장 | 건너뜀: ${skippedCount}장 | 실패: ${failedCount}장`);
if (failedCount > 0) {
  const failedIds = Object.entries(status)
    .filter(([, v]) => v === "failed")
    .map(([k]) => k)
    .join(", ");
  console.log(`실패 항목: ${failedIds}`);
  console.log(`재시도: node generate-presentation-voiceover.mjs --retry-failed`);
}
console.log(`\n✅ slide-config.json 업데이트 완료 (audio 경로 + duration + startAt 반영)`);
console.log(`   렌더링: npx remotion render PresentationPlayer out/presentation.mp4`);
console.log(`──────────────────────────────────────────`);
