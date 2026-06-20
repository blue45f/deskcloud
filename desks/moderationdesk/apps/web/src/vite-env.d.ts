/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 문의(Inquiry) 게시판 백엔드(desk-platform) 베이스 URL. 없으면 prod 기본값. */
  readonly VITE_DESK_PLATFORM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
