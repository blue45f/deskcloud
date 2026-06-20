// DeskCloud PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
//
// 브랜드: 잉크(#1c1f28) 배경에 DeskCloud "쌓인 레이어" 마크(favicon.svg 와 동일 모티프),
// 최상단 레이어는 인디고 강조(#6e76f0), 나머지는 근백색(#fbfcfe).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 oklch 토큰을 변환한 값. ──
const INK = [28, 31, 40] // --color-ink  oklch(0.24 0.018 270)
const FG = [251, 252, 254] // --color-ink-fg oklch(0.99 0.003 260)
const ACCENT = [110, 118, 240] // --color-accent oklch(0.62 0.18 277)

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

// 볼록 사변형(레이어 한 장)을 채운다. 점은 [x,y] 정규화(0..1).
function fillQuad(px, size, quad, color, ss = 4) {
  const pts = quad.map(([x, y]) => [x * size, y * size])
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
  const inside = (px2, py2) => {
    // 사변형을 두 삼각형으로 나눠 포함 판정.
    const tri = (a, b, c) => {
      const d1 = sign(px2, py2, a, b)
      const d2 = sign(px2, py2, b, c)
      const d3 = sign(px2, py2, c, a)
      const neg = d1 < 0 || d2 < 0 || d3 < 0
      const pos = d1 > 0 || d2 > 0 || d3 > 0
      return !(neg && pos)
    }
    return tri(pts[0], pts[1], pts[2]) || tri(pts[0], pts[2], pts[3])
  }
  const sign = (px2, py2, a, b) => (px2 - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py2 - b[1])
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          if (inside(fx, fy)) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 배경(any 아이콘용). maskable 은 풀블리드라 생략.
function roundRectMask(px, size, radiusRatio, bg) {
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
    void bg
  }
}

// DeskCloud 마크(쌓인 레이어 3장)를 정규화 좌표로 그린다.
// favicon.svg 의 다이아몬드 레이어 모티프를 채움 형태로 재해석.
function drawMark(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  // 레이어 다이아몬드 폭/높이(정규화).
  const w = 0.3 * scale // 좌우 반폭
  const h = 0.155 * scale // 상하 반높이
  const gap = 0.115 * scale // 레이어 간 수직 간격
  // 세 레이어의 중심 y(위에서 아래로).
  const ys = [cy - gap, cy, cy + gap]
  const colors = [ACCENT, FG, FG]
  // 아래에서 위로 그려 위 레이어가 겹치게.
  for (let k = ys.length - 1; k >= 0; k--) {
    const yc = ys[k]
    const quad = [
      [cx, yc - h], // top
      [cx + w, yc], // right
      [cx, yc + h], // bottom
      [cx - w, yc], // left
    ]
    fillQuad(px, size, quad, colors[k])
  }
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 약간 축소. 풀블리드 배경.
    drawMark(px, size, 0.78)
  } else {
    drawMark(px, size, 1.0)
    roundRectMask(px, size, 0.22, INK)
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
