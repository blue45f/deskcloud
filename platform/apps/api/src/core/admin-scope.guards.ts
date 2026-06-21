import { AdminTokenGuard, CORE_OPTIONS, type CoreOptions } from '@desk/core/nest'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class InquiryReadAdminGuard extends AdminTokenGuard {
  protected override readonly requiredScopes = ['inquiries:read'] as const

  constructor(@Inject(CORE_OPTIONS) options: CoreOptions) {
    super(options)
  }
}

@Injectable()
export class InquiryWriteAdminGuard extends AdminTokenGuard {
  protected override readonly requiredScopes = ['inquiries:read', 'inquiries:write'] as const

  constructor(@Inject(CORE_OPTIONS) options: CoreOptions) {
    super(options)
  }
}
