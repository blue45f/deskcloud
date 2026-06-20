// MediaDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web/scripts/generate-pwa-icons.mjs 의 zlib PNG 인코더를 MediaDesk
//  브랜드/마크에 맞춰 적응한 사본이다.)
//
// 브랜드: 잉크(#101826) 배경에 MediaDesk "미디어 프레임" 마크(public/favicon.svg 와 동일
// 모티프) — 둥근 프레임 + 해(circle) + 봉우리(peaks). 강조는 블루(#5aa0f2).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg 와 styles/index.css 의 토큰을 변환한 값. ──
const INK = [16, 24, 38] // #101826  favicon 배경, --color-ink ≈ oklch(0.24 0.02 252)
const ACCENT = [90, 160, 242] // #5aa0f2 favicon 스트로크, --color-accent oklch(0.6 0.16 250)

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

// ── 캔버스/블렌딩 헬퍼 ──
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
function blendAt(px, size, x, y, color, a) {
  if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return
  const i = (y * size + x) * 4
  const inv = 1 - a
  px[i] = Math.round(color[0] * a + px[i] * inv)
  px[i + 1] = Math.round(color[1] * a + px[i + 1] * inv)
  px[i + 2] = Math.round(color[2] * a + px[i + 2] * inv)
  px[i + 3] = 255
}

// ── 슈퍼샘플(4x4) 커버리지 래스터: coverage(fx,fy)->bool 로 도형을 채운다. ──
function fillShape(px, size, bbox, coverage, color, ss = 4) {
  const [minX, minY, maxX, maxY] = bbox
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(size - 1, Math.ceil(maxY)); y++) {
    for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(size - 1, Math.ceil(maxX)); x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          if (coverage(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss)) hits++
        }
      }
      if (hits) blendAt(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 점이 둥근 모서리 사각 안인지.
function inRoundRect(fx, fy, ax, ay, bx, by, r) {
  if (fx < ax || fx > bx || fy < ay || fy > by) return false
  const cx = Math.min(Math.max(fx, ax + r), bx - r)
  const cy = Math.min(Math.max(fy, ay + r), by - r)
  const dx = fx - cx
  const dy = fy - cy
  return dx * dx + dy * dy <= r * r
}

// 둥근 모서리 사각 "프레임"(테두리만). outer 둥근 사각에서 inner 둥근 사각을 뺀다.
function strokeRoundRect(px, size, color, x0, y0, x1, y1, radius, thickness) {
  const inset = thickness
  const rInner = Math.max(0, radius - inset)
  const coverage = (fx, fy) =>
    inRoundRect(fx, fy, x0, y0, x1, y1, radius) &&
    !inRoundRect(fx, fy, x0 + inset, y0 + inset, x1 - inset, y1 - inset, rInner)
  fillShape(px, size, [x0 - 1, y0 - 1, x1 + 1, y1 + 1], coverage, color)
}

function fillCircle(px, size, color, cx, cy, r) {
  const coverage = (fx, fy) => {
    const dx = fx - cx
    const dy = fy - cy
    return dx * dx + dy * dy <= r * r
  }
  fillShape(px, size, [cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1], coverage, color)
}

// 채워진 삼각형(봉우리). pts = [[x,y],[x,y],[x,y]] 픽셀 좌표.
function fillTriangle(px, size, color, pts) {
  const sign = (ax, ay, b, c) => (ax - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (ay - c[1])
  const coverage = (fx, fy) => {
    const d1 = sign(fx, fy, pts[0], pts[1])
    const d2 = sign(fx, fy, pts[1], pts[2])
    const d3 = sign(fx, fy, pts[2], pts[0])
    const neg = d1 < 0 || d2 < 0 || d3 < 0
    const pos = d1 > 0 || d2 > 0 || d3 > 0
    return !(neg && pos)
  }
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
  fillShape(px, size, [minX - 1, minY - 1, maxX + 1, maxY + 1], coverage, color)
}

// 둥근 모서리 배경 마스크(any 아이콘용). maskable 은 풀블리드라 생략.
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

// favicon.svg 의 viewBox(0..32) 좌표를 정규화해 임의 size·scale 로 매핑하는 헬퍼를 만든다.
function projector(size, scale) {
  const c = size / 2
  const u = (size / 32) * scale // favicon 1단위 → 픽셀
  return { u, map: (vx, vy) => [c + (vx - 16) * u, c + (vy - 16) * u] }
}

// MediaDesk 마크 = 미디어 프레임(둥근 사각 테두리) + 해(circle) + 봉우리(2 산).
// favicon.svg 와 동일 모티프를 채움 형태로 재해석한다. 봉우리는 프레임 위에 겹쳐 그린다.
function drawMark(px, size, scale) {
  const { u, map } = projector(size, scale)

  // 프레임(둥근 사각 테두리). favicon: x7 y8 w18 h14 rx2.2.
  const [fx0, fy0] = map(7, 8)
  const [fx1, fy1] = map(25, 22)
  strokeRoundRect(px, size, ACCENT, fx0, fy0, fx1, fy1, 2.2 * u, 2.4 * u)

  // 해(circle). favicon: cx12 cy13 r1.8.
  const [scx, scy] = map(12, 12.6)
  fillCircle(px, size, ACCENT, scx, scy, 1.9 * u)

  // 봉우리(두 산) — 프레임 안쪽 바닥선(≈ y21)에 닿게.
  const base = 21.0
  fillTriangle(px, size, ACCENT, [map(8.5, base), map(13.5, 15.0), map(18.5, base)])
  fillTriangle(px, size, ACCENT, [map(16.0, base), map(19.5, 16.6), map(23.5, base)])
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  // maskable: 안전영역(중앙 ~74%) 안으로 마크를 축소(풀블리드 배경). any: 거의 풀.
  drawMark(px, size, maskable ? 0.74 : 0.96)
  if (!maskable) roundRectMask(px, size, 0.22)
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
