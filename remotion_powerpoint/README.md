# Remotion 영상 자동화 시스템

Remotion 기반의 두 가지 영상 제작 파이프라인을 지원합니다.

| 파이프라인 | 컴포지션 | 용도 |
|---|---|---|
| **PPTX → 영상** | `PresentationPlayer` | PowerPoint를 애니메이션 영상으로 변환 (주력) |
| **쇼츠 제작** | `ShortsPlayer` | AI 이미지 + TTS로 9:16 쇼츠 영상 제작 |

---

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일 생성:

```
ELEVENLABS_API_KEY=...        # 필수 (보이스오버 생성)
OPENAI_API_KEY=sk-...         # 쇼츠용 이미지 생성 시에만 필요
```

### 3. PPTX → 영상 (주력 파이프라인)

```bash
node pptx-to-slides.mjs 파일명.pptx   # PNG 변환 + 슬라이드 노트 자동 추출
# slide-config.json에서 narration 확인/수정
node generate-presentation-voiceover.mjs  # TTS 생성
npm run render:ppt                        # 렌더링 → out/presentation.mp4
```

### 4. 쇼츠 제작

```bash
/shorts-creator "주제" 60초로 만들어줘   # Claude Code 스킬
npm run render:shorts                     # 렌더링 → out/shorts.mp4
```

### 5. 프리뷰

```bash
npm run dev   # → http://localhost:3000
```

---

## 주요 명령어

| 명령어 | 역할 |
|---|---|
| `node pptx-to-slides.mjs <파일.pptx>` | PPTX → PNG 변환 + slide-config.json 생성 (슬라이드 노트 자동 추출) |
| `node generate-presentation-voiceover.mjs` | 프레젠테이션 TTS 생성 (alignment 기반 정확한 줌 싱크) |
| `node generate-presentation-voiceover.mjs --force` | 기존 파일 무시하고 전체 재생성 |
| `node generate-presentation-voiceover.mjs --retry-failed` | 실패 항목만 재시도 |
| `node generate-voiceover.mjs` | 쇼츠 TTS 생성 |
| `npm run dev` | Remotion Studio 실행 (미리보기) |
| `npm run render:ppt` | 프레젠테이션 최종 렌더링 |
| `npm run render:shorts` | 쇼츠 최종 렌더링 |
| `node archive.mjs` | 현재 작업물 `projects/`에 날짜별 보관 |

---

## 등록된 컴포지션

| ID | 설명 | 해상도 |
|---|---|---|
| `PresentationPlayer` | PPTX 기반 프레젠테이션 영상 | 1920×1080 (16:9) |
| `ShortsPlayer` | 범용 쇼츠 렌더러 | 1080×1920 (9:16) |

---

## 폴더 구조

```
remotion_powerpoint/
├── src/
│   ├── PresentationComposition.tsx  ← 프레젠테이션 렌더러 (zoom_to, kenburns, pan)
│   ├── ShortsComposition.tsx        ← 쇼츠 렌더러
│   ├── Subtitle.tsx                 ← 문장 단위 자막 (alignment 기반)
│   └── Root.tsx                     ← 컴포지션 등록
│
├── public/current/
│   ├── slides/                      ← 슬라이드 PNG
│   ├── audio/                       ← TTS 음성 파일
│   ├── audio-status.json            ← 슬라이드별 생성 상태 (ok/failed)
│   ├── slide-config.json            ← 프레젠테이션 설정
│   └── script.json                  ← 쇼츠 설정
│
├── pptx-to-slides.mjs               ← PPTX 변환 + 슬라이드 노트 추출
├── generate-presentation-voiceover.mjs  ← TTS + alignment 저장 + 중단/재시작
├── generate-voiceover.mjs           ← 쇼츠 TTS
├── archive.mjs                      ← 완료 작업 보관
├── .env                             ← API 키 (git 제외)
└── out/                             ← 렌더링 결과물
```

---

## 문서

- [유저 매뉴얼](USER_MANUAL.md) — 상세 사용법
- [히스토리](history.md) — 세션별 개발 기록
- [프로덕션 TODO](TODO_PRODUCTION.md) — 개선 항목 진행 현황
