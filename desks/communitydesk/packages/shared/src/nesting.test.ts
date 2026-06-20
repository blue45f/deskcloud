import { describe, expect, it } from 'vitest'

import { buildCommentTree, countTreeNodes, type NestableComment } from './nesting'

const c = (id: string, parentId: string | null = null): NestableComment => ({ id, parentId })

describe('buildCommentTree', () => {
  it('평면 배열을 중첩 트리로 조립(부모-자식)', () => {
    const tree = buildCommentTree([c('a'), c('b', 'a'), c('c', 'a'), c('d', 'b')])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe('a')
    expect(tree[0]!.children.map((n) => n.id)).toEqual(['b', 'c'])
    expect(tree[0]!.children[0]!.children[0]!.id).toBe('d')
  })

  it('depth 를 올바르게 부여', () => {
    const tree = buildCommentTree([c('a'), c('b', 'a'), c('d', 'b')])
    expect(tree[0]!.depth).toBe(0)
    expect(tree[0]!.children[0]!.depth).toBe(1)
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2)
  })

  it('형제 순서는 입력 순서를 보존', () => {
    const tree = buildCommentTree([c('root'), c('x', 'root'), c('y', 'root'), c('z', 'root')])
    expect(tree[0]!.children.map((n) => n.id)).toEqual(['x', 'y', 'z'])
  })

  it('고아(부모 없음) 댓글은 루트로 승격(유실 방지)', () => {
    const tree = buildCommentTree([c('a'), c('orphan', 'missing-parent')])
    expect(tree.map((n) => n.id).sort()).toEqual(['a', 'orphan'])
    expect(countTreeNodes(tree)).toBe(2)
  })

  it('자기 참조는 사이클로 보고 루트로', () => {
    const tree = buildCommentTree([c('self', 'self')])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.depth).toBe(0)
  })

  it('상호 참조 사이클을 끊고 노드를 유실하지 않음', () => {
    // a -> b -> a 사이클
    const tree = buildCommentTree([c('a', 'b'), c('b', 'a')])
    expect(countTreeNodes(tree)).toBe(2)
  })

  it('maxDepth 초과 시 한도 깊이로 클램프(평탄화)', () => {
    const flat = [c('n0')]
    for (let i = 1; i <= 10; i += 1) flat.push(c(`n${i}`, `n${i - 1}`))
    const tree = buildCommentTree(flat, 3)
    // 모든 노드가 유실 없이 존재
    expect(countTreeNodes(tree)).toBe(11)
    // 최대 depth 는 3 을 넘지 않음
    const maxDepth = (() => {
      let m = 0
      const walk = (nodes: ReturnType<typeof buildCommentTree>): void => {
        for (const node of nodes) {
          m = Math.max(m, node.depth)
          walk(node.children)
        }
      }
      walk(tree)
      return m
    })()
    expect(maxDepth).toBeLessThanOrEqual(3)
  })

  it('원본 필드를 보존하며 children/depth 만 추가', () => {
    type Rich = NestableComment & { body: string }
    const tree = buildCommentTree<Rich>([
      { id: 'a', parentId: null, body: 'hi' },
      { id: 'b', parentId: 'a', body: 'yo' },
    ])
    expect(tree[0]!.body).toBe('hi')
    expect(tree[0]!.children[0]!.body).toBe('yo')
  })

  it('빈 입력은 빈 트리', () => {
    expect(buildCommentTree([])).toEqual([])
    expect(countTreeNodes([])).toBe(0)
  })
})
