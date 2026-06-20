// ChangelogDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (접근법은 desk-platform/apps/web/scripts/generate-pwa-icons.mjs 표준 레퍼런스를 차용.)
//
// 브랜드: 잉크(#16140f) 배경에 favicon.svg 와 동일한 "체인지로그 라인 + 릴리스 점" 모티프.
// 라인은 근백색(#fcfcf9), 마지막(가장 짧은) 라인 끝의 릴리스 점은 앰버 강조(#e6b873).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg + styles/index.css 토큰 기준. ──
const INK = [22, 20, 15] // #16140f  favicon 배경(=meta theme-color)
const FG = [252, 252, 249] // #fcfcf9  --color-ink-fg oklch(0.99 0.003 90)
const ACCENT = [230, 184, 115] // #e6b873  favicon 마크 색(앰버 강조)

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

// 둥근 끝(stroke-linecap:round) 수평선 한 줄을 정규화 좌표(0..1)로 채운다.
// favicon 의 `stroke-linecap="round"` 라인을 캡슐(둥근 양끝 사각형)로 재현.
function fillRoundLine(px, size, x0, x1, yc, halfW, color, ss = 4) {
  const ax = x0 * size
  const bx = x1 * size
  const cy = yc * size
  const hw = halfW * size
  const minX = Math.floor(ax - hw)
  const maxX = Math.ceil(bx + hw)
  const minY = Math.floor(cy - hw)
  const maxY = Math.ceil(cy + hw)
  // 점-선분(수평) 최단거리로 캡슐 내부 판정.
  const dist = (fx, fy) => {
    const px2 = Math.min(Math.max(fx, ax), bx)
    const dx = fx - px2
    const dy = fy - cy
    return Math.sqrt(dx * dx + dy * dy)
  }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          if (dist(fx, fy) <= hw) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 채워진 원(릴리스 점)을 정규화 좌표로 그린다.
function fillCircle(px, size, cx, cy, r, color, ss = 4) {
  const ccx = cx * size
  const ccy = cy * size
  const rr = r * size
  const minX = Math.floor(ccx - rr)
  const maxX = Math.ceil(ccx + rr)
  const minY = Math.floor(ccy - rr)
  const maxY = Math.ceil(ccy + rr)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          const dx = fx - ccx
          const dy = fy - ccy
          if (dx * dx + dy * dy <= rr * rr) hits++
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
      const d = Math.sqrt(dx * dx + dy * dy)
      const i = (y * size + x) * 4
      if (d > r) {
        px[i + 3] = 0
      } else if (d > r - 1.5) {
        const a = Math.max(0, r - d) / 1.5
        px[i + 3] = Math.round(255 * a)
      }
    }
  }
}

// ChangelogDesk 마크(체인지로그 라인 3줄 + 릴리스 점)를 정규화 좌표로 그린다.
// favicon.svg 의 `M9 10.5h11 / M9 15h14 / M9 19.5h8` + `circle 23.5,19.5 r2.4` 모티프를
// 0..1 좌표계(원본 viewBox 32)로 옮긴 값. scale 로 maskable 안전영역에 맞춰 축소.
function drawMark(px, size, scale = 1) {
  const cx = 0.5
  const cy = 0.5
  const u = 1 / 32 // viewBox 32 단위 → 정규화
  // 원본 좌표(0..32)를 중심(16,16) 기준으로 scale 한 뒤 캔버스 중심으로 평행이동.
  const map = (vx, vy) => [cx + (vx - 16) * u * scale, cy + (vy - 16) * u * scale]
  const sw = 2.4 * u * scale // stroke-width → 캡슐 지름
  const half = sw / 2
  const lines = [
    [9, 20, 10.5], // x0, x1, y
    [9, 23, 15],
    [9, 17, 19.5],
  ]
  for (const [x0, x1, y] of lines) {
    const [ax, ay] = map(x0, y)
    const [bx] = map(x1, y)
    fillRoundLine(px, size, ax, bx, ay, half, FG)
  }
  // 릴리스 점(앰버) — 가장 짧은 라인과 같은 baseline 우측.
  const [dotx, doty] = map(23.5, 19.5)
  fillCircle(px, size, dotx, doty, 2.4 * u * scale, ACCENT)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 ~80%) 안에 마크가 들어오도록 축소. 풀블리드 배경.
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
