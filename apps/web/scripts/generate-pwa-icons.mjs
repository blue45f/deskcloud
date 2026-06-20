// RealtimeDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp/canvas 등 네이티브
// 의존성을 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로
// 재현 가능하게 한다. (desk-platform 의 zlib 제너레이터를 RealtimeDesk 브랜드로 각색.)
//
// 브랜드: 잉크(#0f1729) 배경에 RealtimeDesk "브로드캐스트 신호" 마크(favicon.svg 와 동일
// 모티프) — 중앙 점에서 두 쌍의 대칭 신호 호(arc)가 퍼져나가는 pub/sub·presence 메타포.
// 강조색은 라이트 블루(#7aa2ff).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). favicon.svg / styles/index.css 토큰과 일치. ──
const INK = [15, 23, 41] // #0f1729  (favicon rect fill · index.html theme-color)
const ACCENT = [122, 162, 255] // #7aa2ff (favicon stroke/dot · --color-accent 계열)
const ACCENT_SOFT = [122, 162, 255] // 동일 색, 외곽 호는 알파로 약하게.

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

// 채워진 원(중앙 점)을 그린다. 좌표는 정규화(0..1).
function fillCircle(px, size, cx, cy, r, color, alpha = 1, ss = 4) {
  const CX = cx * size
  const CY = cy * size
  const R = r * size
  const minX = Math.max(0, Math.floor(CX - R - 1))
  const maxX = Math.min(size - 1, Math.ceil(CX + R + 1))
  const minY = Math.max(0, Math.floor(CY - R - 1))
  const maxY = Math.min(size - 1, Math.ceil(CY + R + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          const dx = fx - CX
          const dy = fy - CY
          if (dx * dx + dy * dy <= R * R) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, (hits / (ss * ss)) * alpha)
    }
  }
}

// 대칭 신호 호(arc) 한 쌍을 그린다. 중앙(cx,cy)에서 반지름 rad 만큼 떨어진 동심 곡선.
// 두께 stroke(정규화), 좌우로 半각 spread(라디안) 만큼만 그려 favicon 의 좌우 괄호형 호를 재현.
function strokeArcPair(px, size, cx, cy, rad, stroke, color, alpha = 1, ss = 4) {
  const CX = cx * size
  const CY = cy * size
  const R = rad * size
  const half = (stroke * size) / 2
  const spread = 0.78 // 약 ±45°(수직축 기준) — 좌우로 열린 괄호형.
  const minX = Math.max(0, Math.floor(CX - R - half - 1))
  const maxX = Math.min(size - 1, Math.ceil(CX + R + half + 1))
  const minY = Math.max(0, Math.floor(CY - R - half - 1))
  const maxY = Math.min(size - 1, Math.ceil(CY + R + half + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss
          const fy = y + (sy + 0.5) / ss
          const dx = fx - CX
          const dy = fy - CY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (Math.abs(dist - R) > half) continue
          // 수직축(위쪽=-y)으로부터의 각도. 좌/우 두 갈래만 통과시킨다.
          const ang = Math.atan2(dx, -dy) // 0 = 위, +는 오른쪽
          const fromRight = Math.abs(ang - Math.PI / 2)
          const fromLeft = Math.abs(ang + Math.PI / 2)
          if (Math.min(fromRight, fromLeft) <= spread) hits++
        }
      }
      if (hits) blend(px, size, x, y, color, (hits / (ss * ss)) * alpha)
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

// RealtimeDesk 마크(브로드캐스트 신호)를 정규화 좌표로 그린다.
// favicon.svg: 중앙 점 + 안쪽 호 한 쌍(진하게) + 바깥 호 한 쌍(흐리게).
function drawMark(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  const stroke = 0.052 * scale
  // 바깥 호(흐림) → 안쪽 호 → 중앙 점 순으로(겹침 정리).
  strokeArcPair(px, size, cx, cy, 0.295 * scale, stroke, ACCENT_SOFT, 0.5)
  strokeArcPair(px, size, cx, cy, 0.19 * scale, stroke, ACCENT, 1)
  fillCircle(px, size, cx, cy, 0.075 * scale, ACCENT, 1)
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
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
