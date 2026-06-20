/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  // 문의(Inquiry) 게시판 백엔드(desk-platform) 베이스 URL. 없으면 prod 기본값.
  readonly VITE_DESK_PLATFORM_URL?: string
  // 통합 로그인(Firebase Auth) — 리터럴 금지, .env.local + Vercel env 로만 주입.
  // apiKey/appId 미주입이면 isFirebaseAuthConfigured=false 로 런타임 degrade(빌드는 정상).
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
