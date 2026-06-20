/**
 * 임베드 스니펫 생성기 — 랜딩·가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/auth/* 를 호출).
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  accent?: string
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentLine = accent ? `,\n    accent: '${accent}'` : ''
  return `<!-- AuthDesk 인증 위젯 -->
<div id="authdesk-form"></div>
<script src="${base}/authdesk-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    AuthDesk.init({
      target: '#authdesk-form',
      publishableKey: '${publishableKey}',
      endpoint: '${base}'${accentLine}
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentProp = accent ? `\n  accent="${accent}"` : ''
  return `import { AuthForm } from '@authdesk/widget'

export function SignIn() {
  return (
    <AuthForm
      publishableKey="${publishableKey}"
      endpoint="${base}"${accentProp}
      onAuthenticated={(r) => console.log(r.user.email)}
    />
  )
}`
}

/** 순수 SDK(폼 직접 제작) 스니펫. */
export function sdkSnippet({ publishableKey, endpoint }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  return `import { createAuthDeskClient } from '@authdesk/widget'

const auth = createAuthDeskClient({
  publishableKey: '${publishableKey}',
  endpoint: '${base}',
})

await auth.register({ email, password, name })
const user = await auth.getSession()
await auth.logout()`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @authdesk/widget
# 또는: pnpm add @authdesk/widget`
}
