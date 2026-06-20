import { useAuthStore } from '@/app/authStore'

/**
 * 자격증명별 캐시 키 — 자격증명(테넌트)이 바뀌면 react-query 캐시가 섞이지 않도록
 * 쿼리 키에 섞는 안정 문자열을 만든다. secret 원문은 키에 넣지 않는다(로그/devtools 노출 방지):
 * sk 모드는 길이 지문, admin 모드는 대상 pk(공개값)로 구분한다.
 */
export function useCredKey(): string {
  const kind = useAuthStore((s) => s.kind)
  const secret = useAuthStore((s) => s.secret)
  const tenantPk = useAuthStore((s) => s.tenantPk)
  if (kind === 'admin') return `admin:${tenantPk}`
  return `sk:${secret.length}:${secret.slice(0, 3)}`
}
