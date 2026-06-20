// SurveyDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web/scripts/generate-pwa-icons.mjs 의 zlib 인코더를 SurveyDesk 브랜드로 적응.)
//
// 브랜드: 잉크(#16140f) 배경에 SurveyDesk 마크(favicon.svg 와 동일 모티프) — 설문 응답 행 3줄,
// 마지막 줄은 짧게(체크된 항목), 우하단에 강조 응답 점. 행은 근백색(#fbfcfe), 강조 점은 골드(#e6b873).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg 와 styles/index.css 토큰에서 가져옴. ──
const INK = [22, 20, 15] // 잉크 배경 (#16140f) — theme/background_color 와 동일
const FG = [251, 252, 254] // 근백색 응답 행 (--color-ink-fg oklch(0.99 0.003 90))
const ACCENT = [230, 184, 115] // 골드 강조 점 (#e6b873, --color-accent 계열)

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

// 가로 둥근 막대(설문 응답 행 한 줄). 좌표는 정규화(0..1), 두께는 정규화 반지름.
function fillBar(px, size, x0, x1, yc, halfH, color, ss = 4) {
  const X0 = x0 * size
  const X1 = x1 * size
  const YC = yc * size
  const H = halfH * size
  const minX = Math.floor(X0 - H)
  const maxX = Math.ceil(X1 + H)
  const minY = Math.floor(YC - H)
  const maxY = Math.ceil(YC + H)
  // 둥근 캡 막대 = 라인 세그먼트까지의 거리 ≤ H.
  const distToSeg = (px2, py2) => {
    const ax = X0,
      ay = YC,
      bx = X1,
      by = YC
    const dx = bx - ax,
      dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    let t = ((px2 - ax) * dx + (py2 - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx
    const cy = ay + t * dy
    return Math.hypot(px2 - cx, py2 - cy)
  }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          if (distToSeg(fx, fy) <= H) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 원반(강조 응답 점). 중심·반지름 정규화.
function fillDisc(px, size, cxN, cyN, rN, color, ss = 4) {
  const CX = cxN * size
  const CY = cyN * size
  const R = rN * size
  const minX = Math.floor(CX - R)
  const maxX = Math.ceil(CX + R)
  const minY = Math.floor(CY - R)
  const maxY = Math.ceil(CY + R)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          if (Math.hypot(fx - CX, fy - CY) <= R) hits++
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

// SurveyDesk 마크(설문 응답 행 3줄 + 강조 점)를 정규화 좌표로 그린다.
// favicon.svg 의 가로 막대 3줄 + 우하단 점 모티프를 채움 형태로 재해석.
function drawMark(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  const half = 0.085 * scale // 막대 절반 두께
  const gap = 0.16 * scale // 행 간 수직 간격
  const left = cx - 0.235 * scale // 좌측 정렬 시작
  const fullRight = cx + 0.235 * scale // 긴 행 우측 끝
  const shortRight = cx + 0.04 * scale // 짧은(체크된) 행 우측 끝
  const ys = [cy - gap, cy, cy + gap]
  // 윗 두 줄 = 긴 막대, 마지막 줄 = 짧은 막대.
  fillBar(px, size, left, fullRight, ys[0], half, FG)
  fillBar(px, size, left, fullRight, ys[1], half, FG)
  fillBar(px, size, left, shortRight, ys[2], half, FG)
  // 마지막 줄 우측의 강조 응답 점(골드).
  fillDisc(px, size, cx + 0.2 * scale, ys[2], 0.085 * scale, ACCENT)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 약간 축소. 풀블리드 배경.
    drawMark(px, size, 0.78)
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
