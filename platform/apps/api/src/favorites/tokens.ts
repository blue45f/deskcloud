import { z } from 'zod'

/**
 * 즐겨찾기(favorites) — 형제 앱이 공개 REST 로 직접 쓰는 owner별 북마크 목록.
 * 항목 형태는 앱마다 다르므로(웹 kind/savedAt, 토스 type 등) 서버는 불투명 객체로 보관하되
 * `id`(전역 고유 키)만 요구한다. ownerKey = 익명 멤버키(getMemberId) 또는 인증 사용자 id.
 */
export const favoriteItemSchema = z.object({ id: z.string().min(1) }).passthrough()
export type FavoriteItem = z.infer<typeof favoriteItemSchema>

/** PUT 본문 — owner의 전체 목록을 통째로 교체(클라이언트가 토글 후 전송). */
export const putFavoritesSchema = z.object({
  items: z.array(favoriteItemSchema).max(500),
})
export type PutFavoritesInput = z.infer<typeof putFavoritesSchema>

export interface FavoritesListDto {
  appId: string
  ownerKey: string
  items: FavoriteItem[]
}

export const FAVORITES_STORE = Symbol('FAVORITES_STORE')

/** 영속화 포트 — apps/api 가 Drizzle 로 구현해 주입(테스트는 PGlite). */
export interface FavoritesStorePort {
  get(appId: string, ownerKey: string): Promise<FavoriteItem[]>
  put(appId: string, ownerKey: string, items: FavoriteItem[]): Promise<FavoriteItem[]>
}
