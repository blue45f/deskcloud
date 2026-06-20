// FileDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (DeskCloud(@desk/platform) 레퍼런스를 FileDesk 브랜드로 적응.)
//
// 브랜드: 아이콘 배경 = FileDesk 블루(#2f5fe0, styles/index.css --fd-accent),
// 마크 = favicon.svg 와 동일 모티프(문서 + 접힌 모서리 + 아래화살표 "업로드")를
// 근백색(#ffffff)으로 채운다.
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 토큰과 favicon.svg 에서 가져옴. ──
const ACCENT = [47, 95, 224] // --fd-accent #2f5fe0 (아이콘 배경)
const FG = [255, 255, 255] // --fd-accent-ink #ffffff (마크)

// ── 최소 PNG 인코더(truecolor+alpha, 8bit) ──
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: truecolor + alpha
  // 10..12: compression/filter/interlace = 0
  // 각 스캔라인 앞에 filter byte(0=None) 를 붙인다.
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── 벡터 렌더 헬퍼(슈퍼샘플 안티에일리어싱) ──
function makeCanvas(size, bg) {
  const px = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0]
    px[i * 4 + 1] = bg[1]
    px[i * 4 + 2] = bg[2]
    px[i * 4 + 3] = 255
  }
  return px
}
function blend(px, size, x, y, color, a) {
  if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return
  const i = (y * size + x) * 4
  const inv = 1 - a
  px[i] = Math.round(color[0] * a + px[i] * inv)
  px[i + 1] = Math.round(color[1] * a + px[i + 1] * inv)
  px[i + 2] = Math.round(color[2] * a + px[i + 2] * inv)
  px[i + 3] = 255
}

// 정규화 좌표(0..1)에 대한 픽셀 커버리지를 슈퍼샘플로 계산해 칠한다.
// inside(fx, fy)는 정규화 좌표를 받아 도형 내부 여부를 반환.
function fillShape(px, size, inside, color, bbox, ss = 4) {
  const minX = Math.max(0, Math.floor(bbox[0] * size))
  const minY = Math.max(0, Math.floor(bbox[1] * size))
  const maxX = Math.min(size - 1, Math.ceil(bbox[2] * size))
  const maxY = Math.min(size - 1, Math.ceil(bbox[3] * size))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = (x + (sx + 0.5) / ss) / size
          const fy = (y + (sy + 0.5) / ss) / size
          if (inside(fx, fy)) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 배경(any 아이콘용). maskable 은 풀블리드라 생략.
function roundRectMask(px, size, radiusRatio) {
  const r = size * radiusRatio
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 모서리 바깥은 투명 처리(둥근 모서리).
      const cx = Math.min(Math.max(x, r), size - r)
      const cy = Math.min(Math.max(y, r), size - r)
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const i = (y * size + x) * 4
      if (dist > r) {
        px[i + 3] = 0
      } else if (dist > r - 1.5) {
        const a = Math.max(0, r - dist) / 1.5
        px[i + 3] = Math.round(255 * a)
      }
    }
  }
}

// FileDesk 마크 = 문서(접힌 모서리) + 아래 화살표(업로드). favicon.svg 의 모티프를
// 채움/스트로크 형태로 재해석. 정규화 좌표(scale·중심으로 변환 가능).
function drawMark(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  // 문서 본체 사각형(정규화). favicon: x∈[10,22], y∈[7,25] / 32 ≈ [0.31..0.69]×[0.22..0.78].
  const halfW = 0.205 * scale
  const halfH = 0.3 * scale
  const fold = 0.13 * scale // 접힌 모서리 한 변
  const left = cx - halfW
  const right = cx + halfW
  const top = cy - halfH
  const bottom = cy + halfH
  const stroke = 0.03 * scale // 외곽선 두께(반)

  // 1) 문서 외곽(둥근 모서리 사각형 윤곽 + 우상단 접힘) — 채워진 흰 카드로 단순화.
  const inDoc = (fx, fy) => {
    if (fx < left || fx > right || fy < top || fy > bottom) return false
    // 우상단 접힌 모서리: 대각선 위쪽 잘라냄.
    const fx2 = fx - (right - fold)
    const fy2 = top + fold - fy
    if (fx2 > 0 && fy2 > 0 && fx2 + fy2 > fold) return false
    return true
  }
  fillShape(px, size, inDoc, FG, [left, top, right, bottom], 4)

  // 2) 내부를 블루로 도려내 "윤곽 카드"처럼(중앙 화살표 공간 확보).
  const inDocInner = (fx, fy) => {
    const l = left + stroke
    const r2 = right - stroke
    const t = top + stroke
    const b = bottom - stroke
    if (fx < l || fx > r2 || fy < t || fy > b) return false
    const fx2 = fx - (r2 - fold)
    const fy2 = t + fold - fy
    if (fx2 > 0 && fy2 > 0 && fx2 + fy2 > fold - stroke) return false
    return true
  }
  fillShape(px, size, inDocInner, ACCENT, [left, top, right, bottom], 4)

  // 3) 업로드 화살표(아래로 향하는 ↓): 세로 줄기 + 촉. 흰색.
  const stemHalf = 0.02 * scale
  const ay0 = cy - 0.12 * scale // 줄기 위
  const ay1 = cy + 0.085 * scale // 줄기 아래(촉 시작)
  const headHalf = 0.075 * scale // 촉 반폭
  const headTipY = cy + 0.17 * scale // 촉 끝
  const inArrow = (fx, fy) => {
    // 줄기
    if (Math.abs(fx - cx) <= stemHalf && fy >= ay0 && fy <= ay1) return true
    // 아래 삼각 촉: 위변(ay1)에서 headTipY 로 좁아짐.
    if (fy >= ay1 && fy <= headTipY) {
      const t = (fy - ay1) / (headTipY - ay1) // 0..1
      const half = headHalf * (1 - t)
      if (Math.abs(fx - cx) <= half) return true
    }
    return false
  }
  fillShape(px, size, inArrow, FG, [cx - headHalf, ay0, cx + headHalf, headTipY], 4)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, ACCENT)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 축소. 풀블리드 배경.
    drawMark(px, size, 0.74)
  } else {
    drawMark(px, size, 1.0)
    roundRectMask(px, size, 0.22)
  }
  return encodePng(size, size, px)
}

const targets = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

for (const t of targets) {
  const png = renderIcon(t)
  writeFileSync(join(OUT_DIR, t.file), png)
  console.log(`wrote ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`)
}
console.log('done.')
