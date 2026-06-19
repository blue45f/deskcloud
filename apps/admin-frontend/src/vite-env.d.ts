/// <reference types="vite/client" />
declare module '*.css'

interface ImportMetaEnv {
  /** SurveyDesk 백엔드 URL. 미설정(기본)이면 피드백 위젯을 렌더하지 않는다. */
  readonly VITE_SURVEYDESK_URL?: string
  /** ChangelogDesk 백엔드 URL. 미설정(기본)이면 변경 이력 위젯을 렌더하지 않는다. */
  readonly VITE_CHANGELOGDESK_URL?: string
  /** ChangelogDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_CHANGELOGDESK_PK?: string
  /** NotifyDesk 백엔드 URL. 미설정(기본)이면 알림 벨 위젯을 렌더하지 않는다. */
  readonly VITE_NOTIFYDESK_URL?: string
  /** NotifyDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_NOTIFYDESK_PK?: string
  /** SearchDesk 백엔드 URL. 미설정(기본)이면 ⌘⇧K 검색 팔레트를 렌더하지 않는다. */
  readonly VITE_SEARCHDESK_URL?: string
  /** SearchDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_SEARCHDESK_PK?: string
  /** desk-platform 문의(Inquiry) 백엔드 URL. 미설정 시 prod 기본값(desk-platform.vercel.app). */
  readonly VITE_DESK_PLATFORM_URL?: string

  /* 통합 로그인(Firebase Auth, deskcloud-fleet-auth) — 리터럴 금지, env 로만 주입.
     apiKey/appId 가 없으면 인증은 런타임에서 비활성(isFirebaseAuthConfigured=false)된다. */
  /** Firebase 웹 apiKey(`AIza…`). 로컬 `.env.local` + Vercel env 로만 공급(커밋 금지). */
  readonly VITE_FIREBASE_API_KEY?: string
  /** Firebase authDomain. 미설정 시 `deskcloud-fleet-auth.firebaseapp.com`. */
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  /** Firebase projectId. 미설정 시 `deskcloud-fleet-auth`. */
  readonly VITE_FIREBASE_PROJECT_ID?: string
  /** Firebase storageBucket. */
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  /** Firebase messagingSenderId. */
  readonly VITE_FIREBASE_SENDER_ID?: string
  /** Firebase appId. 로컬 `.env.local` + Vercel env 로만 공급(커밋 금지). */
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
