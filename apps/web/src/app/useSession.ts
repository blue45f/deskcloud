import { useSyncExternalStore } from 'react'

import { sessionStore } from './sessionStore'

/** 현재 보관된 secret 키를 구독한다(없으면 null = 미로그인). */
export function useSecretKey(): string | null {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSecretKey,
    () => null
  )
}
