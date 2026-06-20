/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_CHANGELOGDESK_URL?: string
  readonly VITE_CHANGELOGDESK_PK?: string
  readonly VITE_NOTIFYDESK_URL?: string
  readonly VITE_NOTIFYDESK_PK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
