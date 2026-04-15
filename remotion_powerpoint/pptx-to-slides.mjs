import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// ── 인수 확인 ────────────────────────────────────────────────────────
const pptxPath = process.argv[2];
if (!pptxPath) {
  console.error("사용법: node pptx-to-slides.mjs <파일.pptx>");
  console.error("예시:  node pptx-to-slides.mjs my-presentation.pptx");
  process.exit(1);
}

if (!existsSync(pptxPath)) {
  console.error(`❌ 파일을 찾을 수 없습니다: ${pptxPath}`);
  process.exit(1);
}

const absPath    = path.resolve(pptxPath).replace(/\//g, "\\");
const slidesDir  = path.resolve("public/current/slides");
const slidesDirWin = slidesDir.replace(/\//g, "\\");
const configPath = "public/current/slide-config.json";
const DEFAULT_DURATION = 5;

mkdirSync("public/current/slides", { recursive: true });
mkdirSync("public/current/audio",  { recursive: true });

console.log(`📊 PPTX 변환 시작: ${pptxPath}`);

// ── PPTX ZIP에서 슬라이드 노트 추출 ─────────────────────────────────
// PPTX는 ZIP 구조. ppt/slides/_rels/slide{N}.xml.rels 에서
// 각 슬라이드가 어느 notesSlide를 참조하는지 확인 후 텍스트 추출.
function extractNotesFromPptx(pptxAbsPath) {
  const notes = {}; // { slideIndex(1-based): "노트 텍스트" }

  try {
    // PowerShell로 ZIP 내 파일 읽기
    const readZipEntry = (entryName) => {
      const escaped = entryName.replace(/\\/g, "/");
      const ps = `
Add-Type -Assembly System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead('${pptxAbsPath}')
$entry = $zip.Entries | Where-Object { $_.FullName -eq '${escaped}' } | Select-Object -First 1
if ($entry) {
  $reader = New-Object System.IO.StreamReader($entry.Open())
  $content = $reader.ReadToEnd()
  $reader.Close()
  Write-Output $content
}
$zip.Dispose()
`;
      try {
        return execSync(`powershell -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, " ")}"`, {
          encoding: "utf-8", timeout: 10000
        }).trim();
      } catch { return ""; }
    };

    // PowerShell로 ZIP 엔트리 목록 가져오기 (슬라이드 rels 파일)
    const listPs = `
Add-Type -Assembly System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead('${pptxAbsPath}')
$zip.Entries | Select-Object -ExpandProperty FullName
$zip.Dispose()
`;
    const allEntries = execSync(`powershell -Command "${listPs.replace(/\n/g, " ")}"`, {
      encoding: "utf-8", timeout: 15000
    }).trim().split("\n").map(e => e.trim());

    // slide{N}.xml.rels 파일들 찾기
    const slideRels = allEntries.filter(e =>
      e.match(/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/)
    );

    for (const relsPath of slideRels) {
      // 슬라이드 번호 추출
      const slideNum = parseInt(relsPath.match(/slide(\d+)\.xml\.rels$/)?.[1] ?? "0");
      if (!slideNum) continue;

      const relsXml = readZipEntry(relsPath);
      if (!relsXml) continue;

      // notesSlide 참조 찾기
      const notesMatch = relsXml.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      if (!notesMatch) continue;

      const notesEntryPath = `ppt/notesSlides/${notesMatch[1]}`;
      const notesXml = readZipEntry(notesEntryPath);
      if (!notesXml) continue;

      // XML에서 텍스트 추출 (<a:t> 태그)
      // 노트 마스터 텍스트(슬라이드 번호 등) 제외: sp 타입 body만
      const textMatches = [...notesXml.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g)];
      const rawText = textMatches.map(m => m[1]).join("").trim();

      // 슬라이드 번호 텍스트(숫자만) 제외
      if (rawText && !/^\d+$/.test(rawText)) {
        notes[slideNum] = rawText;
      }
    }
  } catch (e) {
    console.warn(`   ⚠️  노트 추출 중 오류: ${e.message}`);
  }

  return notes;
}

// ── PowerShell 스크립트 (고해상도 PNG 추출) ──────────────────────────
const psScript = `
$ErrorActionPreference = 'Stop'

$versions = @('16.0', '15.0', '14.0', '17.0')
$officeVersion = $null
foreach ($v in $versions) {
    if (Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Office\\$v\\PowerPoint") {
        $officeVersion = $v; break
    }
    if (Test-Path "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Office\\$v\\PowerPoint") {
        $officeVersion = $v; break
    }
}
if (-not $officeVersion) { $officeVersion = '15.0' }

$regPath = "HKCU:\\Software\\Microsoft\\Office\\$officeVersion\\PowerPoint\\Options"
if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }

$prevValue = (Get-ItemProperty -Path $regPath -Name ExportBitmapResolution -ErrorAction SilentlyContinue).ExportBitmapResolution
Set-ItemProperty -Path $regPath -Name ExportBitmapResolution -Value 300 -Type DWord -Force

$ppt = $null
try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

    $pres = $ppt.Presentations.Open(
        '${absPath}',
        [Microsoft.Office.Core.MsoTriState]::msoFalse,
        [Microsoft.Office.Core.MsoTriState]::msoFalse,
        [Microsoft.Office.Core.MsoTriState]::msoTrue
    )

    $count = $pres.Slides.Count
    $slideWidth  = [int]$pres.PageSetup.SlideWidth
    $slideHeight = [int]$pres.PageSetup.SlideHeight

    Write-Output "SLIDE_COUNT:$count"
    Write-Output "SLIDE_SIZE:$($slideWidth)x$($slideHeight)"

    for ($i = 1; $i -le $count; $i++) {
        $num = $i.ToString('D2')
        $outFile = '${slidesDirWin}\\slide-' + $num + '.png'
        $pres.Slides[$i].Export($outFile, 'PNG')
        Write-Output "EXPORTED:$num"
    }

    $pres.Close()
} finally {
    if ($ppt) { $ppt.Quit() }
    if ($null -ne $prevValue) {
        Set-ItemProperty -Path $regPath -Name ExportBitmapResolution -Value $prevValue -Type DWord -Force
    } else {
        Remove-ItemProperty -Path $regPath -Name ExportBitmapResolution -ErrorAction SilentlyContinue
    }
}
`;

const psFile = path.join(tmpdir(), "pptx-export.ps1");
writeFileSync(psFile, "\uFEFF" + psScript, "utf-8");

// ── PNG 추출 실행 ────────────────────────────────────────────────────
let output = "";
try {
  output = execSync(
    `powershell -ExecutionPolicy Bypass -File "${psFile}"`,
    { encoding: "utf-8", timeout: 120_000 }
  );
} catch (err) {
  console.error("❌ PowerPoint 변환 실패:");
  console.error(err.stderr || err.message);
  process.exit(1);
}

// ── 결과 파싱 ───────────────────────────────────────────────────────
const countMatch = output.match(/SLIDE_COUNT:(\d+)/);
const sizeMatch  = output.match(/SLIDE_SIZE:(\d+)x(\d+)/);
const slideCount = countMatch ? parseInt(countMatch[1]) : 0;
const slideW     = sizeMatch  ? parseInt(sizeMatch[1])  : 1280;
const slideH     = sizeMatch  ? parseInt(sizeMatch[2])  : 720;

if (!slideCount) {
  console.error("❌ 슬라이드를 추출하지 못했습니다.");
  process.exit(1);
}

const isWidescreen = slideW / slideH > 1.6;
const videoW = isWidescreen ? 1920 : 1440;
const videoH = 1080;

console.log(`✅ ${slideCount}장 변환 완료`);
console.log(`   슬라이드 원본 크기: ${slideW}pt × ${slideH}pt (${isWidescreen ? "16:9 와이드" : "4:3 표준"})`);
console.log(`   영상 해상도: ${videoW}×${videoH}`);

// ── 노트 추출 ────────────────────────────────────────────────────────
console.log(`\n📝 슬라이드 노트 추출 중...`);
const notes = extractNotesFromPptx(absPath);
const notesCount = Object.keys(notes).length;
console.log(`   ${notesCount}개 슬라이드에서 노트 발견`);

// ── slide-config.json 생성 ───────────────────────────────────────────
// 슬라이드 번호 → notesSlide 매핑이 순서 기반이 아닐 수 있으므로
// notes 객체 키(slideNum)를 그대로 사용
const config = Array.from({ length: slideCount }, (_, i) => {
  const num       = String(i + 1).padStart(2, "0");
  const slideNum  = i + 1;
  const narration = notes[slideNum] ?? "";

  if (narration) {
    console.log(`   slide-${num}: 노트 ${narration.length}자 추출됨`);
  }

  return {
    id:         `slide-${num}`,
    image:      `current/slides/slide-${num}.png`,
    duration:   DEFAULT_DURATION,
    transition: 0.5,
    audio:      "",
    narration,
    motion: { type: "kenburns" },
  };
});

const configWithMeta = {
  meta: { videoW, videoH, slideW, slideH },
  slides: config,
};

writeFileSync(configPath, JSON.stringify(configWithMeta, null, 2));

console.log(`\n📝 ${configPath} 생성 완료`);
if (notesCount > 0) {
  console.log(`   ✅ narration 필드에 슬라이드 노트 자동 입력됨`);
  console.log(`   → 내용 확인 후 node generate-presentation-voiceover.mjs 실행`);
} else {
  console.log(`   ℹ️  노트가 없습니다. slide-config.json에서 narration을 직접 입력하세요.`);
}
console.log(`\n──────────────────────────────────────────`);
console.log(`다음 단계:`);
console.log(`  1. public/current/slides/ 에서 슬라이드 PNG 확인`);
console.log(`  2. slide-config.json 에서 narration 내용 검토/수정`);
console.log(`  3. node generate-presentation-voiceover.mjs`);
console.log(`  4. npm run render:ppt`);
console.log(`──────────────────────────────────────────\n`);
