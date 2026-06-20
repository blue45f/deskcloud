import { BadRequestException, NotFoundException } from '@nestjs/common'

import { getAuth, headerValue, type AuthedRequest } from './request-context'

import type { TenantContextService, TenantRow } from './tenant-context.service'

/**
 * 어드민 요청의 대상 테넌트 행을 해석한다.
 *  - secret-key 인증: 그 키의 테넌트가 대상.
 *  - admin-token 인증(셀프호스트): `x-tenant-id` 헤더(테넌트 id 또는 slug)로 지정.
 */
export async function resolveAdminTenant(
  req: AuthedRequest,
  ctx: TenantContextService
): Promise<TenantRow> {
  const auth = getAuth(req)
  if (auth.tenant) return auth.tenant

  const target = headerValue(req, 'x-tenant-id')
  if (!target) {
    throw new BadRequestException(
      'admin-token 인증에서는 x-tenant-id 헤더로 대상 테넌트를 지정해야 합니다'
    )
  }
  // slug 우선 조회, 아니면 id 로 간주.
  const bySlug = await ctx.findBySlug(target)
  if (bySlug) return bySlug
  const byId = await ctx.findById(target)
  if (byId) return byId
  throw new NotFoundException(`대상 테넌트를 찾을 수 없습니다: ${target}`)
}
