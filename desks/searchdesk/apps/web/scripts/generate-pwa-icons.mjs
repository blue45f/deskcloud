// SearchDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
//
// 브랜드: 잉크(#16140f) 배경에 SearchDesk "돋보기" 마크(favicon.svg 와 동일 모티프) —
// 골드 강조(#e6b873)의 링 + 손잡이. 글리프 외 면은 근백색(#f7f3ec)을 쓰지 않고
// 돋보기 한 형태로 단순화해 작은 사이즈에서도 또렷하게.
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg + styles/index.css 의 oklch 토큰을 변환한 값. ──
const INK = [22, 20, 15] // #16140f  --color-ink(dark)
const ACCENT = [230, 184, 115] // #e6b873  --color-accent (warm gold)

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

// ── 캔버스 + 블렌드 헬퍼(슈퍼샘플 안티에일리어싱) ──
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

// 정규화 좌표(0..1)로 정의된 픽셀 영역에 대해, 각 픽셀을 ss×ss 슈퍼샘플로 커버리지
// 측정 후 블렌드한다. coverFn(fx,fy) 는 해당 점이 도형 내부면 true.
function rasterize(px, size, color, coverFn, ss = 4) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = (x + (sx + 0.5) / ss) / size
          const fy = (y + (sy + 0.5) / ss) / size
          if (coverFn(fx, fy)) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, hits / (ss * ss))
    }
  }
}

// 둥근 모서리 사각형 알파 마스크(any 아이콘용). maskable 은 풀블리드라 생략.
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

// SearchDesk 돋보기 마크(링 + 손잡이)를 정규화 좌표로 그린다.
// favicon.svg 의 원형 렌즈 + 대각 손잡이 모티프를 그대로 옮김.
function drawMagnifier(px, size, scale = 1, cx = 0.44, cy = 0.44) {
  const ringR = 0.2 * scale // 렌즈 바깥 반지름
  const stroke = 0.052 * scale // 링/손잡이 두께
  const inner = ringR - stroke

  // 링(도넛): inner..ringR 사이.
  rasterize(px, size, ACCENT, (fx, fy) => {
    const d = Math.hypot(fx - cx, fy - cy)
    return d <= ringR && d >= inner
  })

  // 손잡이: 링 가장자리에서 대각(우하향)으로 뻗는 둥근 캡슐.
  const dirX = Math.SQRT1_2
  const dirY = Math.SQRT1_2
  const hx0 = cx + dirX * (ringR - stroke * 0.3)
  const hy0 = cy + dirY * (ringR - stroke * 0.3)
  const handleLen = 0.2 * scale
  const hx1 = hx0 + dirX * handleLen
  const hy1 = hy0 + dirY * handleLen
  const hr = stroke * 0.62 // 손잡이 반두께(캡슐 반지름)
  rasterize(px, size, ACCENT, (fx, fy) => {
    // 점-선분 거리(캡슐).
    const vx = hx1 - hx0
    const vy = hy1 - hy0
    const wx = fx - hx0
    const wy = fy - hy0
    const len2 = vx * vx + vy * vy
    let t = len2 ? (wx * vx + wy * vy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const px2 = hx0 + t * vx
    const py2 = hy0 + t * vy
    return Math.hypot(fx - px2, fy - py2) <= hr
  })
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 약간 축소. 풀블리드 배경.
    drawMagnifier(px, size, 0.78)
  } else {
    drawMagnifier(px, size, 1.0)
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
