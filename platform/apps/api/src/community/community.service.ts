import { SLUG_RE } from '@desk/shared'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'

import {
  COMMUNITY_STORE,
  type CommunityKind,
  type CommunityListDto,
  type CommunityPostDto,
  type CommunityStorePort,
  type CreatePostInput,
} from './tokens'

/** appId 정규화·검증 — slug 규약(소문자·숫자·하이픈, 1~64자). favorites·inquiries 와 동일. */
function normalizeAppId(raw: string): string {
  const appId = raw.trim().toLowerCase()
  if (!appId || appId.length > 64 || !SLUG_RE.test(appId)) {
    throw new BadRequestException('appId는 소문자·숫자·하이픈(1~64자)이어야 합니다')
  }
  return appId
}

function normalizeAuthorKey(raw: string | undefined): string {
  const key = (raw ?? '').trim()
  if (!key || key.length > 128) {
    throw new BadRequestException('authorKey는 1~128자여야 합니다')
  }
  return key
}

/**
 * 커뮤니티 서비스 — 키 인증 없이 들어오는 공개 위젯 API 의 도메인 로직.
 * 채팅·게시판·댓글을 appId 단위로 보관·조회한다. 본인(authorKey) 글만 삭제 가능. 자금 이동 없음.
 */
@Injectable()
export class CommunityService {
  constructor(@Inject(COMMUNITY_STORE) private readonly store: CommunityStorePort) {}

  async list(appIdRaw: string, kind?: string): Promise<CommunityListDto> {
    const appId = normalizeAppId(appIdRaw)
    const k =
      kind && (['chat', 'board', 'comment'] as const).includes(kind as CommunityKind)
        ? (kind as CommunityKind)
        : undefined
    return { appId, posts: await this.store.list(appId, k, 500) }
  }

  async create(appIdRaw: string, input: CreatePostInput): Promise<CommunityPostDto> {
    const appId = normalizeAppId(appIdRaw)
    normalizeAuthorKey(input.authorKey)
    return this.store.create(appId, input)
  }

  async remove(
    appIdRaw: string,
    id: string,
    authorKeyRaw: string | undefined
  ): Promise<{ deleted: boolean }> {
    const appId = normalizeAppId(appIdRaw)
    const authorKey = normalizeAuthorKey(authorKeyRaw)
    return { deleted: await this.store.remove(appId, id, authorKey) }
  }
}
