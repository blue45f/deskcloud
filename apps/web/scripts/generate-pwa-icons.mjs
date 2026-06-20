// AuthDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
//
// 브랜드: 로열블루(#2f5fe0, --ad-accent) 배경에 favicon.svg 와 동일한 자물쇠 마크
//         (인증 모티프) — 흰색(#ffffff) 바디·샤클·키홀.
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 --ad-* 토큰. ──
const ACCENT = [47, 95, 224] // --ad-accent  #2f5fe0
const FG = [255, 255, 255] // --ad-accent-ink #ffffff

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

// 각 픽셀에 대해 커버리지 함수(0..1)를 슈퍼샘플로 평가해 색을 칠한다.
function paint(px, size, bounds, color, coverage, ss = 4) {
  const x0 = Math.max(0, Math.floor(bounds[0] * size))
  const y0 = Math.max(0, Math.floor(bounds[1] * size))
  const x1 = Math.min(size - 1, Math.ceil(bounds[2] * size))
  const y1 = Math.min(size - 1, Math.ceil(bounds[3] * size))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = (x + (sx + 0.5) / ss) / size
          const fy = (y + (sy + 0.5) / ss) / size
          if (coverage(fx, fy)) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 마스크(any 아이콘용). maskable 은 풀블리드라 생략.
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

// 둥근 사각형 채움 커버리지(정규화 좌표). [x0,y0,x1,y1] + corner radius rr.
function roundedRectCoverage(x0, y0, x1, y1, rr) {
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const ix = Math.min(Math.max(x, x0 + rr), x1 - rr)
    const iy = Math.min(Math.max(y, y0 + rr), y1 - rr)
    const dx = x - ix
    const dy = y - iy
    return dx * dx + dy * dy <= rr * rr
  }
}

// AuthDesk 자물쇠 마크(favicon.svg 모티프)를 정규화 좌표로 그린다.
//   - 바디: 둥근 사각형(흰색 채움).
//   - 샤클: 상단 반원 아치(스트로크) — 바깥/안쪽 원 사이 링.
//   - 키홀: 바디 중앙 작은 원(배경색으로 도려냄).
function drawLock(px, size, bg, scale = 1) {
  const cx = 0.5
  // 마크 전체를 약간 위로 올려 시각 중심을 맞춘다(키홀이 바디 중앙에 오도록).
  const bodyTop = 0.46 - 0.04 * (scale - 1)
  const bodyBottom = bodyTop + 0.28 * scale
  const bodyHalf = 0.21 * scale
  const bodyX0 = cx - bodyHalf
  const bodyX1 = cx + bodyHalf
  const bodyRR = 0.05 * scale

  // 바디(흰색 둥근 사각형).
  paint(
    px,
    size,
    [bodyX0 - 0.02, bodyTop - 0.02, bodyX1 + 0.02, bodyBottom + 0.02],
    FG,
    roundedRectCoverage(bodyX0, bodyTop, bodyX1, bodyBottom, bodyRR)
  )

  // 샤클(상단 아치): 중심(cx, bodyTop) 기준 바깥/안쪽 반지름 사이 링, 위쪽 반원만.
  const shackleCy = bodyTop
  const rOuter = 0.155 * scale
  const rInner = 0.105 * scale
  const stroke = (x, y) => {
    const dx = x - cx
    const dy = y - shackleCy
    if (dy > 0.02) return false // 아래쪽(바디 안)은 그리지 않음
    const d = Math.sqrt(dx * dx + dy * dy)
    return d >= rInner && d <= rOuter
  }
  paint(
    px,
    size,
    [cx - rOuter - 0.02, shackleCy - rOuter - 0.02, cx + rOuter + 0.02, shackleCy + 0.04],
    FG,
    stroke
  )

  // 키홀(배경색으로 도려냄): 바디 중앙 작은 원.
  const keyCy = (bodyTop + bodyBottom) / 2 + 0.005
  const keyR = 0.038 * scale
  paint(
    px,
    size,
    [cx - keyR - 0.02, keyCy - keyR - 0.02, cx + keyR + 0.02, keyCy + keyR + 0.02],
    bg,
    (x, y) => {
      const dx = x - cx
      const dy = y - keyCy
      return dx * dx + dy * dy <= keyR * keyR
    }
  )
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, ACCENT)
  if (maskable) {
    // maskable: 안전영역(중앙 ~80%) 안에 마크가 들어오도록 축소. 풀블리드 배경.
    drawLock(px, size, ACCENT, 0.78)
  } else {
    drawLock(px, size, ACCENT, 1.0)
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
