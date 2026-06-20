/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DESK_PLATFORM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
