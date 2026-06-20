/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** desk-platform 공개 문의 API 베이스 URL(없으면 prod 기본값). */
  readonly VITE_DESK_PLATFORM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
