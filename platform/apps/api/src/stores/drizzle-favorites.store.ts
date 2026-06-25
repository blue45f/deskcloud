import { and, eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { favorites } from '../db/schema'
import { type FavoriteItem, type FavoritesStorePort } from '../favorites/tokens'

/** 즐겨찾기 영속화(Drizzle) — owner별 items(jsonb) 단일 행 upsert. */
export class DrizzleFavoritesStore implements FavoritesStorePort {
  constructor(private readonly dbs: DatabaseService) {}

  async get(appId: string, ownerKey: string): Promise<FavoriteItem[]> {
    const rows = await this.dbs.db
      .select()
      .from(favorites)
      .where(and(eq(favorites.appId, appId), eq(favorites.ownerKey, ownerKey)))
      .limit(1)
    return (rows[0]?.items as FavoriteItem[] | undefined) ?? []
  }

  async put(appId: string, ownerKey: string, items: FavoriteItem[]): Promise<FavoriteItem[]> {
    await this.dbs.db
      .insert(favorites)
      .values({ appId, ownerKey, items })
      .onConflictDoUpdate({
        target: [favorites.appId, favorites.ownerKey],
        set: { items, updatedAt: new Date() },
      })
    return items
  }
}
