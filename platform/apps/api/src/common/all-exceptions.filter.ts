import { TenantError } from '@desk/core'
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'

import type { Response } from 'express'

/** 통일된 에러 응답 — HttpException 보존, core 의 TenantError 매핑, 그 외 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      res
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body)
      return
    }

    // core 의 도메인 에러를 HTTP 로 매핑(프레임워크 무관 코어 → API 경계).
    if (exception instanceof TenantError) {
      const status =
        exception.code === 'not_found'
          ? HttpStatus.NOT_FOUND
          : exception.code === 'slug_taken'
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_REQUEST
      res.status(status).json({ statusCode: status, message: exception.message })
      return
    }

    this.logger.error('처리되지 않은 예외', exception as Error)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '내부 서버 오류',
    })
  }
}
