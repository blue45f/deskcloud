// ChatDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web 의 표준 zlib 생성기를 ChatDesk 브랜드로 각색.)
//
// 브랜드: 잉크(#16140f) 배경에 ChatDesk "말풍선" 마크(favicon.svg 와 동일 모티프),
// 말풍선 외곽선+점 두 개는 웜골드 강조(#e6b873). styles/index.css 의 --color-ink/--color-accent.
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 oklch 토큰 + favicon.svg 의 확정 색. ──
const INK = [22, 20, 15] // #16140f — favicon/index.html theme-color 와 동일(--color-ink)
const ACCENT = [230, 184, 115] // #e6b873 — favicon 말풍선 stroke(--color-accent)

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

// 채워진 원/점(슈퍼샘플 안티에일리어싱). 좌표·반지름은 정규화(0..1).
function fillCircle(px, size, cxN, cyN, rN, color, ss = 4) {
  const cx = cxN * size
  const cy = cyN * size
  const r = rN * size
  const minX = Math.floor(cx - r - 1)
  const maxX = Math.ceil(cx + r + 1)
  const minY = Math.floor(cy - r - 1)
  const maxY = Math.ceil(cy + r + 1)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss - cx
          const fy = y + (sy + 0.5) / ss - cy
          if (fx * fx + fy * fy <= r * r) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 패널(말풍선 본체)을 채운다. 좌표는 정규화(0..1).
function fillRoundRect(px, size, x0N, y0N, x1N, y1N, rN, color, ss = 4) {
  const x0 = x0N * size,
    y0 = y0N * size,
    x1 = x1N * size,
    y1 = y1N * size,
    r = rN * size
  const inside = (fx, fy) => {
    if (fx < x0 || fx > x1 || fy < y0 || fy > y1) return false
    // 각 모서리 코너의 라운드 컷.
    const cx = Math.min(Math.max(fx, x0 + r), x1 - r)
    const cy = Math.min(Math.max(fy, y0 + r), y1 - r)
    const dx = fx - cx
    const dy = fy - cy
    return dx * dx + dy * dy <= r * r
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
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

// 채워진 삼각형(말풍선 꼬리). 점은 [x,y] 정규화(0..1).
function fillTriangle(px, size, tri, color, ss = 4) {
  const pts = tri.map(([x, y]) => [x * size, y * size])
  const minX = Math.floor(Math.min(...pts.map((p) => p[0])))
  const maxX = Math.ceil(Math.max(...pts.map((p) => p[0])))
  const minY = Math.floor(Math.min(...pts.map((p) => p[1])))
  const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])))
  const sign = (px2, py2, a, b) => (px2 - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py2 - b[1])
  const inside = (fx, fy) => {
    const d1 = sign(fx, fy, pts[0], pts[1])
    const d2 = sign(fx, fy, pts[1], pts[2])
    const d3 = sign(fx, fy, pts[2], pts[0])
    const neg = d1 < 0 || d2 < 0 || d3 < 0
    const pos = d1 > 0 || d2 > 0 || d3 > 0
    return !(neg && pos)
  }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
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

// 둥근 모서리 사각형 배경 마스크(any 아이콘용). maskable 은 풀블리드라 생략.
function roundRectMask(px, size, radiusRatio) {
  const r = size * radiusRatio
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
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

// ChatDesk 마크(말풍선 + 점 두 개)를 정규화 좌표로 그린다.
// favicon.svg 의 말풍선 모티프를 채움 형태로 재해석(잉크 배경에 골드 말풍선).
function drawMark(px, size, scale = 1) {
  const cx = 0.5
  const cy = 0.47
  const halfW = 0.28 * scale
  const halfH = 0.2 * scale
  const x0 = cx - halfW
  const y0 = cy - halfH
  const x1 = cx + halfW
  const y1 = cy + halfH
  // 말풍선 본체(골드 채움) + 잉크 안쪽 컷아웃으로 외곽선 느낌을 준다.
  const ring = 0.04 * scale
  fillRoundRect(px, size, x0, y0, x1, y1, 0.09 * scale, ACCENT)
  // 말풍선 꼬리(왼쪽 아래로 향하는 삼각형, 골드).
  fillTriangle(
    px,
    size,
    [
      [cx - 0.12 * scale, y1 - 0.02 * scale],
      [cx - 0.02 * scale, y1 - 0.02 * scale],
      [cx - 0.16 * scale, y1 + 0.13 * scale],
    ],
    ACCENT
  )
  // 안쪽을 잉크로 비워 윤곽선만 남긴다(본체 + 꼬리 안쪽).
  fillRoundRect(px, size, x0 + ring, y0 + ring, x1 - ring, y1 - ring, 0.07 * scale, INK)
  fillTriangle(
    px,
    size,
    [
      [cx - 0.115 * scale, y1 - 0.055 * scale],
      [cx - 0.05 * scale, y1 - 0.055 * scale],
      [cx - 0.125 * scale, y1 + 0.06 * scale],
    ],
    INK
  )
  // 대화 점 두 개(골드).
  const dotR = 0.032 * scale
  fillCircle(px, size, cx - 0.085 * scale, cy, dotR, ACCENT)
  fillCircle(px, size, cx + 0.085 * scale, cy, dotR, ACCENT)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 약간 축소. 풀블리드 배경.
    drawMark(px, size, 0.8)
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
