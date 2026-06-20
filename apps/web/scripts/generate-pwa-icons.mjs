// ModerationDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any 192/512 + maskable 512 + apple-touch 180)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을 피해
// 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web/scripts/generate-pwa-icons.mjs 의 zlib 인코더 접근을 차용/적응.)
//
// 브랜드: 잉크(#1a1410) 배경에 ModerationDesk "방패 + 체크" 마크(favicon.svg 와 동일 모티프 —
// 안전/조치 메타포), 스트로크는 크림슨 강조(#cf4040 = --color-accent 토큰), 채움은 근백색(#fefbfa).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg + styles/index.css 의 oklch 토큰을 변환한 값. ──
const INK = [26, 20, 16] // favicon rect fill #1a1410 (잉크 배경)
const ACCENT = [207, 64, 64] // --color-accent oklch(0.58 0.18 25) → #cf4040 (크림슨 방패)
const FG = [254, 251, 250] // --color-ink-fg oklch(0.99 0.003 30) → #fefbfa (근백색 체크)

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

// ── 캔버스 + 알파 블렌드 헬퍼 ──
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

// 임의 다각형(시계/반시계)을 슈퍼샘플 안티에일리어싱으로 채운다. 점은 정규화(0..1).
function fillPolygon(px, size, poly, color, ss = 4) {
  const pts = poly.map(([x, y]) => [x * size, y * size])
  let minX = size,
    minY = size,
    maxX = 0,
    maxY = 0
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  // even-odd ray casting 포함 판정.
  const inside = (x, y) => {
    let hit = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(size - 1, Math.ceil(maxY)); y++) {
    for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(size - 1, Math.ceil(maxX)); x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          if (inside(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 두 점을 잇는 둥근 끝(round-cap) 두꺼운 선분. 좌표 정규화(0..1), 두께도 정규화.
function strokeSegment(px, size, p0, p1, thickness, color, ss = 4) {
  const x0 = p0[0] * size,
    y0 = p0[1] * size
  const x1 = p1[0] * size,
    y1 = p1[1] * size
  const half = (thickness * size) / 2
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1) + half + 1))
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1) + half + 1))
  const dx = x1 - x0,
    dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  const distToSeg = (px2, py2) => {
    let t = ((px2 - x0) * dx + (py2 - y0) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = x0 + t * dx,
      cy = y0 + t * dy
    return Math.hypot(px2 - cx, py2 - cy)
  }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          if (distToSeg(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss) <= half) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 마스크(any 아이콘용 — 모서리 바깥을 투명 처리). maskable 은 풀블리드라 생략.
function roundRectMask(px, size, radiusRatio) {
  const r = size * radiusRatio
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(Math.max(x, r), size - r)
      const cy = Math.min(Math.max(y, r), size - r)
      const dist = Math.hypot(x - cx, y - cy)
      const i = (y * size + x) * 4
      if (dist > r) px[i + 3] = 0
      else if (dist > r - 1.5) px[i + 3] = Math.round((255 * Math.max(0, r - dist)) / 1.5)
    }
  }
}

// ModerationDesk 마크(방패 + 체크)를 정규화 좌표로 그린다.
// favicon.svg 의 방패 윤곽 + 체크 모티프를 채움/스트로크로 재해석.
// scale: 글리프 전체 크기 배율(maskable 안전영역용). cx/cy: 중심.
function drawMark(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  // 방패 윤곽(위 평평·아래 뾰족). 정규화 반폭/반높이.
  const w = 0.27 * scale
  const top = cy - 0.3 * scale
  const shoulder = cy - 0.06 * scale // 어깨(직선부 끝)
  const bottom = cy + 0.33 * scale // 뾰족한 하단
  const shieldFill = [
    [cx, top],
    [cx + w, top + 0.06 * scale],
    [cx + w, shoulder],
    [cx, bottom],
    [cx - w, shoulder],
    [cx - w, top + 0.06 * scale],
  ]
  // 크림슨 방패 채움.
  fillPolygon(px, size, shieldFill, ACCENT)
  // 근백색 체크마크(✓). 세 점 두 선분, 둥근 끝.
  const t = 0.052 * scale
  const a = [cx - 0.12 * scale, cy + 0.0 * scale]
  const b = [cx - 0.03 * scale, cy + 0.11 * scale]
  const c = [cx + 0.15 * scale, cy - 0.12 * scale]
  strokeSegment(px, size, a, b, t, FG)
  strokeSegment(px, size, b, c, t, FG)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 축소. 풀블리드 잉크 배경.
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
