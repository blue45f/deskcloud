/**
 * 미읽음 개수 계산(순수 함수).
 *
 * 입력은 "최신순으로 정렬된 게시 항목 id 목록"과 anonId 가 마지막으로 본 id.
 * lastSeenEntryId 가 목록에 있으면 그보다 더 최신(앞쪽) 항목 수가 미읽음.
 * 없거나(처음 방문) 목록에서 못 찾으면 전부 미읽음으로 본다.
 */
export interface UnreadResult {
  unreadCount: number
  latestEntryId: string | null
}

export function computeUnread(
  publishedIdsNewestFirst: readonly string[],
  lastSeenEntryId: string | null | undefined
): UnreadResult {
  const latestEntryId = publishedIdsNewestFirst[0] ?? null
  if (!lastSeenEntryId) {
    return { unreadCount: publishedIdsNewestFirst.length, latestEntryId }
  }
  const idx = publishedIdsNewestFirst.indexOf(lastSeenEntryId)
  // 못 찾으면(삭제됐거나 처음) 전부 미읽음 처리.
  if (idx === -1) {
    return { unreadCount: publishedIdsNewestFirst.length, latestEntryId }
  }
  // idx 위치의 항목까지는 읽음 → 그 앞(더 최신)만 미읽음.
  return { unreadCount: idx, latestEntryId }
}
