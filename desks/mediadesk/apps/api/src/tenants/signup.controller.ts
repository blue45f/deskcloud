import { signupSchema, type SignupInput, type SignupResultDto } from '@mediadesk/shared'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { TenantsService } from './tenants.service'

/**
 * 공개 가입(self-register) — 누구나 테넌트를 만들고 pk_/sk_ 키 쌍을 발급받는다.
 * secret 키(sk_) 평문은 이 응답에서만 1회 노출된다(이후 저장 안 됨, 회전만 가능).
 * 남용 방지를 위해 강하게 스로틀한다.
 */
@ApiTags('tenants (public)')
@Controller('tenants')
export class SignupController {
  constructor(private readonly tenants: TenantsService) {}

  @Post('signup')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: '테넌트 가입 — pk_/sk_ 발급(sk_ 는 1회 노출)' })
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput): Promise<SignupResultDto> {
    return this.tenants.signup(body)
  }
}
