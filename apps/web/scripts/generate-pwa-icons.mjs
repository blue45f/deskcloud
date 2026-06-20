// AdDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web/scripts/generate-pwa-icons.mjs 의 zlib 인코더를 AdDesk 브랜드로 적응.)
//
// 브랜드: 액센트 블루(#2f5fe0) 배경에 AdDesk "광고 배너 슬롯" 마크(favicon.svg 와 동일 모티프) —
// 흰색 라운드 배너 프레임 + 중앙 강조 바. styles/index.css 의 --ax-accent(#2f5fe0) 와 일치.
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 토큰을 그대로 사용(이미 hex). ──
const ACCENT = [47, 95, 224] // --ax-accent  #2f5fe0 (아이콘 배경)
const FG = [255, 255, 255] // 흰색 마크 (favicon stroke=#ffffff 와 동일)

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

// ── 캔버스/블렌드 헬퍼 ──
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

// 둥근 사각형 영역을 색으로 채운다(슈퍼샘플 AA). 좌표는 정규화(0..1).
function fillRoundRect(px, size, rect, radiusN, color, ss = 4) {
  const x0 = rect.x * size
  const y0 = rect.y * size
  const w = rect.w * size
  const h = rect.h * size
  const r = radiusN * size
  const inside = (fx, fy) => {
    const lx = fx - x0
    const ly = fy - y0
    if (lx < 0 || ly < 0 || lx > w || ly > h) return false
    // 모서리 라운드 판정.
    const cx = Math.min(Math.max(lx, r), w - r)
    const cy = Math.min(Math.max(ly, r), h - r)
    const dx = lx - cx
    const dy = ly - cy
    return dx * dx + dy * dy <= r * r
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x0 + w); x++) {
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

// AdDesk 마크(광고 배너 슬롯)를 정규화 좌표로 그린다. scale 로 안전영역 축소.
// favicon.svg 의 "배너 프레임 + 중앙 강조 바" 모티프를 채움 형태로 재해석.
function drawMark(px, size, scale = 1) {
  const cx = 0.5
  const cy = 0.5
  // 바깥 배너 프레임(흰색 라운드 사각형).
  const fw = 0.56 * scale
  const fh = 0.4 * scale
  const frame = { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh }
  fillRoundRect(px, size, frame, 0.06 * scale, FG)
  // 프레임 안쪽을 액센트로 다시 파내 "프레임 라인"만 남긴다(테두리 두께 ≈ size*0.045).
  const t = 0.05 * scale
  const inner = {
    x: frame.x + t,
    y: frame.y + t,
    w: frame.w - t * 2,
    h: frame.h - t * 2,
  }
  fillRoundRect(px, size, inner, 0.035 * scale, ACCENT)
  // 중앙 강조 바(흰색) — "활성 크리에이티브" 슬롯 표현.
  const bw = inner.w * 0.62
  const bh = inner.h * 0.34
  const bar = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }
  fillRoundRect(px, size, bar, 0.025 * scale, FG)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, ACCENT)
  if (maskable) {
    // maskable: 안전영역(중앙 ~80%) 안에 마크가 들어오도록 축소. 풀블리드 배경.
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
