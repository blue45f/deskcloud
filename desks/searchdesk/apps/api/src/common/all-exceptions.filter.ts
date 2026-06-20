import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'

import type { Response } from 'express'

/** 통일된 에러 응답 — HttpException 은 상태/메시지 보존, 그 외는 500 으로 안전 처리. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body)
      return
    }

    this.logger.error('처리되지 않은 예외', exception as Error)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '내부 서버 오류',
    })
  }
}
