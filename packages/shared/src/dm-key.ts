/**
 * DM dedupe 키 — 1:1 대화는 (정렬된) 멤버쌍 하나당 하나만 존재해야 한다.
 * 멤버 두 명을 정렬·이스케이프해 결합한 안정 키를 만든다(`tenant_id` 와 함께 유니크).
 *
 * 이스케이프: 구분자 충돌을 막기 위해 `\` → `\\`, `|` → `\|` 로 치환한 뒤 `|` 로 결합.
 */
function escapeMember(id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

/**
 * 정렬된 멤버쌍에서 DM 키를 만든다. 두 멤버가 같으면(자기 자신과의 DM) 단일 키.
 * @throws 멤버가 2명이 아닐 때(중복 제거 후 1~2명 허용; 그 외는 DM 이 아님)
 */
export function dmKey(memberIds: readonly string[]): string {
  const unique = [...new Set(memberIds)]
  if (unique.length < 1 || unique.length > 2) {
    throw new Error('DM 은 서로 다른 멤버 1~2명이어야 합니다')
  }
  // 코드유닛 순서 고정 비교자 — dm_key 는 DB 유니크 dedup 키라 localeCompare 로
  // 바꾸면 기존 키와 불일치(중복 DM)가 날 수 있어 바이트 순서를 그대로 보존한다.
  const sorted = [...unique].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return sorted.map(escapeMember).join('|')
}
