/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** desk-platform 문의 게시판 베이스 URL(미설정 시 prod 기본값). */
  readonly VITE_DESK_PLATFORM_URL?: string
  /** 통합 로그인(Firebase Auth) 웹 설정 — 리터럴 금지, env 로만 주입(.env.local + Vercel). */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
