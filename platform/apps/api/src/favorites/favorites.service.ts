import { SLUG_RE } from '@desk/shared'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'

import {
  FAVORITES_STORE,
  type FavoriteItem,
  type FavoritesListDto,
  type FavoritesStorePort,
} from './tokens'

/** appId 정규화·검증 — slug 규약(소문자·숫자·하이픈, 1~64자). inquiries 와 동일. */
function normalizeAppId(raw: string): string {
  const appId = raw.trim().toLowerCase()
  if (!appId || appId.length > 64 || !SLUG_RE.test(appId)) {
    throw new BadRequestException('appId는 소문자·숫자·하이픈(1~64자)이어야 합니다')
  }
  return appId
}

/** ownerKey 검증 — 비어있지 않은 1~128자(익명키 anon:... 또는 사용자 id). */
function normalizeOwnerKey(raw: string | undefined): string {
  const key = (raw ?? '').trim()
  if (!key || key.length > 128) {
    throw new BadRequestException('ownerKey는 1~128자여야 합니다')
  }
  return key
}

/**
 * 즐겨찾기 서비스 — 키 인증 없이 들어오는 공개 위젯 API 의 도메인 로직.
 * owner(익명키/사용자) 단위로 북마크 목록을 보관·조회한다. 자금 이동 없음.
 */
@Injectable()
export class FavoritesService {
  constructor(@Inject(FAVORITES_STORE) private readonly store: FavoritesStorePort) {}

  async list(appIdRaw: string, ownerKeyRaw: string | undefined): Promise<FavoritesListDto> {
    const appId = normalizeAppId(appIdRaw)
    const ownerKey = normalizeOwnerKey(ownerKeyRaw)
    return { appId, ownerKey, items: await this.store.get(appId, ownerKey) }
  }

  async replace(
    appIdRaw: string,
    ownerKeyRaw: string | undefined,
    items: FavoriteItem[]
  ): Promise<FavoritesListDto> {
    const appId = normalizeAppId(appIdRaw)
    const ownerKey = normalizeOwnerKey(ownerKeyRaw)
    return { appId, ownerKey, items: await this.store.put(appId, ownerKey, items) }
  }
}
