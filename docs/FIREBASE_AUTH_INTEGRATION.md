# 통합 로그인(Firebase Auth) 모듈 가이드

형제 앱의 제각각인 로그인(raw Google Identity Services 등)을 **Firebase Authentication 기반
단일 로그인 모듈**로 통합한다. 하나의 Firebase 프로젝트(`deskcloud-fleet-auth`)가 전 앱의
사용자/인증 백엔드 역할을 하고, 각 앱은 동일한 벤더드 모듈(`src/lib/firebaseAuth/`)을 복사해
쓴다. (npm publish 401 회피 — inquiry 보드와 동일한 벤더드 전략.)

## 1. Firebase 프로젝트 / 웹 설정 (env로 주입)

Firebase 웹 apiKey 등은 기술적으로 **공개 식별자**지만(보안은 Auth 규칙 + authorizedDomains로),
저장소 시크릿 스캔 훅이 `AIza…` 패턴을 차단하므로 **리터럴을 커밋하지 않고 env로 주입**한다.

프로젝트: `deskcloud-fleet-auth` (projectId / authDomain `deskcloud-fleet-auth.firebaseapp.com`).
나머지 값(apiKey·appId·messagingSenderId·storageBucket)은 아래 env로 공급.

```ts
// config.ts — 리터럴 금지, env에서만 읽는다.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'deskcloud-fleet-auth.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'deskcloud-fleet-auth',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
```

env 키(`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_SENDER_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`)의 실제 값은 **로컬 `.env.local`(gitignored)** + **Vercel 프로젝트 env**
로 공급한다(커밋 금지). 실제 값은 `~/.config/deskcloud-firebase.env`에 보관(비커밋).

## 2. 활성화된 provider

- **이메일/비밀번호** (`signInWithEmailAndPassword` / `createUserWithEmailAndPassword`) — 도메인
  제약 없이 모든 origin 동작.
- **익명(게스트)** (`signInAnonymously`) — 마찰 없는 "게스트로 시작". 나중에 이메일 계정으로 연결 가능.
- (후속) **Google** — Firebase 프로젝트에 OAuth 클라이언트 1개 + 앱 도메인을 authorizedDomains에
  추가하면 `signInWithPopup(GoogleAuthProvider)`로 추가 가능. 현재는 이메일/익명만.

## 3. 의존성

```
pnpm add firebase    # 웹 SDK v11+ (modular). 트리셰이킹됨.
```

## 4. 모듈 구조 (각 앱 `src/lib/firebaseAuth/`)

- `config.ts` — 위 `firebaseConfig`(+ env 오버라이드).
- `firebase.ts` — `initializeApp` + `getAuth` 싱글턴(HMR 안전: 이미 init되면 재사용).
- `AuthProvider.tsx` — `onAuthStateChanged` 구독, context로 `{ user, loading, signUp, signIn,
signInAsGuest, signOut, error }` 노출. 앱 루트에 1회 마운트.
- `useAuth.ts` — context 소비 훅.
- `AuthDialog.tsx`(또는 `LoginPanel`) — 친근한 UI: 이메일/비번 로그인 ↔ 가입 토글, "게스트로
  시작", 에러/로딩 상태, a11y(label·aria-live·포커스). 앱 디자인 토큰에 맞춤.

### useAuth API

```ts
type AuthUser = {
  uid: string
  email: string | null
  isAnonymous: boolean
  displayName: string | null
}
type AuthState = {
  user: AuthUser | null
  loading: boolean // 초기 onAuthStateChanged 해석 전
  error: string | null
  signUp(email: string, password: string): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signInAsGuest(): Promise<void>
  signOut(): Promise<void>
}
```

에러는 Firebase `auth/*` 코드를 한국어 메시지로 매핑(`auth/email-already-in-use`→"이미 가입된
이메일입니다" 등).

## 5. 백엔드 연동 (선택)

Firebase Auth가 발급한 **ID 토큰**(`user.getIdToken()`)을 각 앱 백엔드(NestJS)에서 `firebase-admin`
으로 검증해 보호 라우트에 쓸 수 있다(예: 내 문의 내역, 회원 전용 기능). 우선은 클라이언트 인증만
도입하고, 서버 검증이 필요한 기능에서 점진 적용.

## 6. 롤아웃 원칙

- 기존에 동작하는 per-app Google 로그인(GIS)을 무조건 제거하지 않는다. Firebase 모듈을 **추가**
  하거나(이메일/게스트 옵션 제공), 로그인이 없던 앱에 도입한다. Google provider 정식 도입 후
  GIS→Firebase Google 일원화 검토.
- 라우트/모달 어느 쪽이든 앱 관례에 맞춤. "로그인" 진입점은 헤더에.
- 데모 성격 앱은 "게스트로 시작"을 기본 노출(가입 마찰 최소화).

## 7. 운영 메모 (gcloud 프로그램matic 설정)

- 프로젝트/Provider 설정은 콘솔 없이 gcloud user 토큰 + REST로 가능. \*\*`Accept: application/json`
  - `X-Goog-User-Project: deskcloud-fleet-auth` 헤더 필수\*\*(없으면 ESF가 HTML 404/quota 오류).
- Auth 초기화: `POST identitytoolkit.googleapis.com/v2/projects/<p>/identityPlatform:initializeAuth`.
- Provider: `PATCH identitytoolkit.googleapis.com/admin/v2/projects/<p>/config?updateMask=signIn.email.enabled,...`.
- 웹 config: `GET firebase.googleapis.com/v1beta1/projects/<p>/webApps/<appId>/config`.
