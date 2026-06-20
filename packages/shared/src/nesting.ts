import { MAX_COMMENT_DEPTH } from './constants'

/** 트리 조립에 필요한 댓글 최소 형태. */
export interface NestableComment {
  id: string
  parentId: string | null
}

/** 트리 노드 — 원본 댓글 + children + depth. */
export type CommentNode<T extends NestableComment> = T & {
  children: CommentNode<T>[]
  depth: number
}

/**
 * 평면 댓글 배열을 중첩 트리로 조립한다(순수 함수).
 *
 * - 입력 순서를 보존(같은 부모 아래 형제는 들어온 순서대로) → 보통 createdAt asc 로 정렬해 넘긴다.
 * - 깊이는 `MAX_COMMENT_DEPTH` 로 클램프: 더 깊은 댓글은 그 한도 조상에 평탄화해 붙인다
 *   (과도한 스레딩·렌더 폭주 방지). 부모를 못 찾는(고아) 댓글은 루트로 승격해 유실되지 않게 한다.
 * - 사이클(자기 참조·상호 참조)은 방문 추적으로 끊고 루트로 떨어뜨린다.
 *
 * api(GET 글 상세)·web·widget·테스트가 공유한다.
 */
export function buildCommentTree<T extends NestableComment>(
  comments: readonly T[],
  maxDepth: number = MAX_COMMENT_DEPTH
): CommentNode<T>[] {
  const byId = new Map<string, CommentNode<T>>()
  for (const c of comments) {
    byId.set(c.id, { ...(c as T), children: [], depth: 0 } as CommentNode<T>)
  }

  const roots: CommentNode<T>[] = []

  for (const c of comments) {
    const node = byId.get(c.id)!
    const parent = c.parentId ? byId.get(c.parentId) : undefined

    if (!parent || parent.id === node.id || isAncestor(byId, parent, node)) {
      // 부모 없음/자기참조/사이클 → 루트.
      node.depth = 0
      roots.push(node)
      continue
    }

    // 깊이 클램프: 부모 depth+1 이 한도를 넘으면, 한도 깊이의 가장 가까운 조상에 붙인다.
    let attachTo = parent
    while (attachTo.depth + 1 > maxDepth && attachTo.parentId) {
      const grand = byId.get(attachTo.parentId)
      if (!grand) break
      attachTo = grand
    }
    node.depth = Math.min(attachTo.depth + 1, maxDepth)
    attachTo.children.push(node)
  }

  return roots
}

/** node 가 candidate 의 조상이면 true (사이클 탐지용). */
function isAncestor<T extends NestableComment>(
  byId: Map<string, CommentNode<T>>,
  candidate: CommentNode<T>,
  node: CommentNode<T>
): boolean {
  let cur: CommentNode<T> | undefined = candidate
  const seen = new Set<string>()
  while (cur) {
    if (cur.id === node.id) return true
    if (seen.has(cur.id)) return true
    seen.add(cur.id)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return false
}

/** 트리 전체 노드 수(깊이 무관). */
export function countTreeNodes<T extends NestableComment>(nodes: readonly CommentNode<T>[]): number {
  let n = 0
  for (const node of nodes) n += 1 + countTreeNodes(node.children)
  return n
}
