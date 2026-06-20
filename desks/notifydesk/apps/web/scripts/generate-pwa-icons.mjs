// NotifyDesk PWA 아이콘 생성기 (의존성 0 — Node 내장 zlib 만 사용).
//
// vite-plugin-pwa 매니페스트가 요구하는 설치 기준(any + maskable + apple-touch)을
// 충족하는 유효 PNG 를 public/ 에 직접 래스터라이즈한다. sharp 등 네이티브 의존성을
// 피해 어떤 CI/형제 레포에서도 `node scripts/generate-pwa-icons.mjs` 로 재현 가능하게 한다.
// (desk-platform/apps/web/scripts/generate-pwa-icons.mjs 의 zlib 인코더를 NotifyDesk
//  브랜드 — 잉크 배경 + 알림 벨 마크 — 로 각색한 표준 레퍼런스 사본.)
//
// 브랜드: 잉크(#13161c) 배경에 NotifyDesk 알림 "벨" 마크(favicon.svg 와 동일 모티프),
// 벨 본체+추는 인디고 강조(#7aa2ff).
// 출력: pwa-192x192.png · pwa-512x512.png · pwa-maskable-512x512.png · apple-touch-icon.png(180).

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ── 브랜드 팔레트(sRGB). styles/index.css 의 oklch 토큰 + favicon.svg 의 리터럴. ──
const INK = [19, 22, 28] // favicon 배경 #13161c (≈ --color-ink oklch(0.26 0.02 262))
const ACCENT = [122, 162, 255] // favicon 벨 #7aa2ff (≈ --color-accent)

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

// ── 래스터 헬퍼(슈퍼샘플 안티에일리어싱) ──
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

// 임의 영역을 채운다: inside(fx,fy)=>bool 판정 콜백 + 슈퍼샘플 AA. 정규화 바운딩 박스로 스캔.
function fillShape(px, size, bbox, inside, color, ss = 4) {
  const minX = Math.max(0, Math.floor(bbox[0] * size))
  const minY = Math.max(0, Math.floor(bbox[1] * size))
  const maxX = Math.min(size - 1, Math.ceil(bbox[2] * size))
  const maxY = Math.min(size - 1, Math.ceil(bbox[3] * size))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = (x + (sx + 0.5) / ss) / size
          const fy = (y + (sy + 0.5) / ss) / size
          if (inside(fx, fy)) hits++
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

// NotifyDesk 알림 벨 마크를 정규화 좌표(0..1)로 그린다. favicon.svg 의 벨 실루엣 재해석.
// scale<1 이면 중심을 기준으로 축소(maskable 안전영역용).
//
// 구성(위→아래): 손잡이 꼭지(작은 원) → 둥근 돔(상부 반타원) → 아래로 벌어지는
// 스커트(사다리꼴) → 갓 밑단(테) → 벨 추(아래 작은 원).
function drawBell(px, size, scale = 1, cx = 0.5, cy = 0.5) {
  const s = scale
  const handleCy = cy - 0.245 * s // 손잡이 꼭지 중심
  const handleR = 0.035 * s // 손잡이 반지름
  const shoulderY = cy - 0.06 * s // 돔이 스커트로 넘어가는 어깨선
  const domeRx = 0.12 * s // 돔 가로 반지름(=어깨 반폭)
  const rimY = cy + 0.16 * s // 갓 밑단(테)
  const halfW = 0.215 * s // 밑단 반폭

  // 벨 본체: 손잡이 원 ∪ 돔(어깨선 위 반타원) ∪ 스커트(어깨선→밑단 사다리꼴).
  const insideBell = (x, y) => {
    // 손잡이 꼭지(작은 원).
    {
      const hdx = (x - cx) / handleR
      const hdy = (y - handleCy) / handleR
      if (hdx * hdx + hdy * hdy <= 1) return true
    }
    if (y < handleCy || y > rimY) return false
    if (y <= shoulderY) {
      // 돔: 어깨선(shoulderY)을 바닥으로 하는 위쪽 반타원. 세로 반지름 = 어깨선~손잡이 살짝 위.
      const domeRy = shoulderY - (handleCy + handleR * 0.4)
      const dx = (x - cx) / domeRx
      const dy = (y - shoulderY) / domeRy
      return dx * dx + dy * dy <= 1 && y <= shoulderY
    }
    // 스커트: 어깨 반폭(domeRx)에서 밑단 반폭(halfW)으로 선형 보간(아래로 벌어짐).
    const t = (y - shoulderY) / (rimY - shoulderY)
    const w = domeRx + (halfW - domeRx) * t
    return Math.abs(x - cx) <= w
  }
  fillShape(
    px,
    size,
    [cx - halfW - 0.05, handleCy - handleR - 0.02, cx + halfW + 0.05, rimY + 0.02],
    insideBell,
    ACCENT
  )

  // 벨 추(아래 작은 원): 갓 테 바로 밑.
  const clapCy = rimY + 0.07 * s
  const clapR = 0.05 * s
  const insideClap = (x, y) => {
    const dx = (x - cx) / clapR
    const dy = (y - clapCy) / clapR
    return dx * dx + dy * dy <= 1
  }
  fillShape(
    px,
    size,
    [cx - clapR - 0.02, clapCy - clapR - 0.02, cx + clapR + 0.02, clapCy + clapR + 0.02],
    insideClap,
    ACCENT
  )
}

function renderIcon({ size, maskable }) {
  const px = makeCanvas(size, INK)
  if (maskable) {
    // maskable: 안전영역(중앙 80%) 안에 마크가 들어오도록 약간 축소. 풀블리드 배경.
    drawBell(px, size, 0.8)
  } else {
    drawBell(px, size, 1.0)
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
