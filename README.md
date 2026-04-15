# KR-ACADEMY MOVIE MAKER
> AI 기반 PPT → 강의 영상 자동 변환 시스템

파워포인트(PPTX) 파일을 업로드하면 AI 성우 나레이션, 자막, 화면 확대 효과가 포함된 고화질 MP4 강의 영상을 자동으로 생성합니다.

---

## 핵심 기능

| 기능 | 설명 |
|---|---|
| PPT 자동 추출 | PPTX를 슬라이드별 고화질(300DPI) PNG로 변환 |
| AI 나레이션 편집 | 슬라이드별 대본 입력, GPT-4o 기반 다국어 자동 번역 |
| ElevenLabs TTS | 고품질 AI 성우 선택, 발화 타이밍 alignment 자동 저장 |
| zoom_to 효과 | 슬라이드 영역 드래그 지정 → 영상에서 자연스럽게 확대 |
| 자막 토글 | 단어 단위 하이라이트 자막 켜기/끄기 (렌더링에 실시간 반영) |
| 원클릭 렌더 | Remotion 엔진으로 `~/Downloads/presentation.mp4` 생성 |
| 프로젝트 초기화 | 기존 슬라이드/오디오/설정 일괄 삭제 후 새 작업 시작 |

---

## 빠른 시작 (다른 컴퓨터에서 처음 실행하는 경우)

### 필수 조건
- Windows OS
- Microsoft PowerPoint 설치됨
- Node.js 18 이상 설치됨 (https://nodejs.org)

### 실행 방법

1. 이 폴더 전체를 새 컴퓨터로 복사합니다.
2. `start.bat` 파일을 더블클릭합니다.
   - 처음 실행 시 API 키 입력 안내가 나옵니다.
   - `remotion_powerpoint/.env` 파일에 ElevenLabs / OpenAI API 키를 입력하세요.
3. `start.bat`을 다시 실행하면 자동으로 패키지 설치 후 브라우저가 열립니다.

### API 키 발급 방법
- **ElevenLabs** (TTS): https://elevenlabs.io → 로그인 → Profile → API Keys
- **OpenAI** (번역): https://platform.openai.com/api-keys

---

## 수동 실행 (개발자용)

```bash
# 웹 서버 (Next.js)
cd web && npm run dev

# Remotion 스튜디오 (선택, 미리보기 전용)
cd remotion_powerpoint && npm run dev
```

브라우저에서 http://localhost:3000 접속.

---

## 프로젝트 구조

```
remotion_powerpoint_web/
├── start.bat                    ← 시작 파일 (더블클릭)
├── web/                         ← Next.js 웹 UI 및 API 서버
│   ├── app/
│   │   ├── editor/              ← 5단계 편집 화면
│   │   │   ├── upload/          ← 1단계: PPTX 업로드
│   │   │   ├── narration/       ← 2단계: 나레이션 편집
│   │   │   ├── voiceover/       ← 3단계: TTS 생성
│   │   │   ├── preview/         ← 4단계: 프리뷰
│   │   │   └── render/          ← 5단계: MP4 렌더
│   │   └── api/                 ← REST API 라우트
│   └── components/              ← React 컴포넌트
└── remotion_powerpoint/         ← Remotion 렌더 엔진
    ├── src/
    │   ├── PresentationComposition.tsx  ← 핵심 영상 컴포넌트
    │   └── Subtitle.tsx                 ← 자막 컴포넌트
    ├── public/current/          ← 작업 파일 저장 위치
    │   ├── slides/              ← 슬라이드 PNG
    │   ├── audio/               ← TTS MP3
    │   └── slide-config.json    ← 통합 설정 파일
    ├── generate-presentation-voiceover.mjs  ← TTS 생성 스크립트
    └── pptx-to-slides.mjs       ← PPTX 변환 스크립트
```

---

## 환경 변수 설정

`remotion_powerpoint/.env`:
```env
ELEVENLABS_API_KEY=sk_...
OPENAI_API_KEY=sk-proj-...
# 유료 플랜 사용 시 (생성 속도 향상, 슬라이드당 대기 1초):
# ELEVENLABS_PLAN=paid
```

`web/.env.local`:
```env
REMOTION_ROOT=../remotion_powerpoint
```

---

## 자주 묻는 질문

**포트 3000이 이미 사용 중이에요**
`web/package.json`의 `"dev": "next dev --port 3001"` 로 포트 변경 후 재실행.

**TTS 생성 속도가 느려요**
무료 플랜은 API rate limit으로 슬라이드당 ~5초 대기. `ELEVENLABS_PLAN=paid` 설정 시 1초로 단축.

**영상 렌더링이 오래 걸려요**
슬라이드 10장 기준 약 2~5분 소요. `--concurrency=8` 병렬 처리로 이미 최적화되어 있습니다.

---

## 상세 사용 가이드

컴퓨터를 잘 모르시는 분은 `remotion_powerpoint/USER_MANUAL.md`를 참고하세요.
