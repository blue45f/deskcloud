import { BadRequestException, type PipeTransform } from '@nestjs/common'

import type { ZodType } from 'zod'

/** Zod 스키마로 요청 바디/쿼리를 검증하는 파이프. @reviewdesk/shared 스키마를 그대로 사용. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      )
    }
    return result.data
  }
}
