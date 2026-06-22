import { describe, expect, it } from 'vitest'

// public/manifest.webmanifest 는 정적 자산 — 소스를 ?raw 로 읽어 설치성(installability) 계약을 검증한다.
import manifestSource from '../public/manifest.webmanifest?raw'

type ManifestIcon = { src: string; sizes: string; type: string; purpose: string }

const manifest = JSON.parse(manifestSource) as {
  id: string
  start_url: string
  scope: string
  theme_color: string
  background_color: string
  icons: ManifestIcon[]
}

// PNG 실물은 data URL(?inline)로 끌어와 검증한다 — web tsconfig 는 node 타입을 쓰지 않으므로 fs 금지.
const iconFiles = import.meta.glob<string>('../public/icon-*.png', {
  query: '?inline',
  import: 'default',
  eager: true,
})

/** PNG 시그니처와 IHDR(항상 첫 청크)을 직접 파싱해 실물 픽셀 크기를 읽는다 — 디코더 의존성 없음. */
function readPngSize(src: string): { width: number; height: number } {
  const dataUrl = iconFiles[`../public/${src.replace(/^\//, '')}`]
  expect(dataUrl, `public${src} 실물 파일 누락`).toBeDefined()
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(String.fromCharCode(...bytes.subarray(12, 16))).toBe('IHDR')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

describe('manifest.webmanifest (PWA 설치성)', () => {
  it('id/scope/start_url 이 DeskPlatform 하위 TermsDesk 설치 경계를 가리킨다', () => {
    expect(manifest.id).toBe('/termsdesk/')
    expect(manifest.start_url).toBe('.')
    expect(manifest.scope).toBe('.')
  })

  it('스플래시 색이 기본 라이트 테마 첫 페인트와 일치한다 (ThemeProvider 기본값 light)', () => {
    // manifest 는 단일값만 허용 — 다크 사용자 스플래시는 라이트로 절충하고 기본 경험을 우선한다.
    const lightBg = '#fdfcfa' // ≈ --color-bg oklch(0.994 0.003 90)
    expect(manifest.background_color).toBe(lightBg)
    expect(manifest.theme_color).toBe(lightBg)
  })

  it('아이콘 purpose 는 단일 값만 쓴다 ("any maskable" 결합은 maskable 크롭이 any 에도 적용됨)', () => {
    for (const icon of manifest.icons) {
      expect(icon.purpose).toMatch(/^(any|maskable|monochrome)$/)
    }
  })

  it('비트맵 런처용 PNG(any 192·512)와 maskable 512 를 분리 선언한다', () => {
    const pngSizes = (purpose: string) =>
      manifest.icons
        .filter((icon) => icon.type === 'image/png' && icon.purpose === purpose)
        .map((icon) => icon.sizes)
    expect(pngSizes('any').sort()).toEqual(['192x192', '512x512'])
    expect(pngSizes('maskable')).toEqual(['512x512'])
  })

  it('벡터(SVG) 아이콘은 고정 해상도가 아닌 sizes "any" 로 선언한다', () => {
    const svgs = manifest.icons.filter((icon) => icon.type === 'image/svg+xml')
    expect(svgs).toHaveLength(1)
    expect(svgs[0].sizes).toBe('any')
  })

  it('선언된 PNG 아이콘 실물이 public/ 에 존재하고 IHDR 크기가 sizes 와 일치한다', () => {
    for (const icon of manifest.icons.filter((entry) => entry.type === 'image/png')) {
      const [width, height] = icon.sizes.split('x').map(Number)
      expect(readPngSize(icon.src)).toEqual({ width, height })
    }
  })
})
