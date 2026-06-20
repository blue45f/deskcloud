import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'

import type { ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * 글로벌 예외 필터.
 *
 * 에러 응답 envelope는 NestJS 기본 형태와 역호환을 유지합니다:
 * - HttpException 응답이 객체면 그 객체를 그대로 펼쳐 `statusCode`/`message`/`error`를 보존하고,
 *   문자열이면 `{ statusCode, message }` 형태로 보존합니다.
 * - 그 위에 `path`·`timestamp`만 추가합니다(기존 필드는 제거·변형하지 않습니다).
 * - 5xx는 pino 로거로 error 레벨 로깅합니다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    // 기존 NestJS 기본 envelope 보존: statusCode + message(+ error) 그대로 유지.
    const base = isHttp
      ? this.normalize(exception.getResponse(), status)
      : { statusCode: status, message: 'Internal server error' }

    // path·timestamp만 ADD.
    const body = {
      ...base,
      path: request.url,
      timestamp: new Date().toISOString(),
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, path: request.url, method: request.method, statusCode: status },
        '요청 처리 중 처리되지 않은 예외'
      )
    }

    response.status(status).json(body)
  }

  /** HttpException 응답을 statusCode/message가 보존된 객체로 정규화. */
  private normalize(
    res: string | object,
    status: number
  ): { statusCode: number; message: unknown; [key: string]: unknown } {
    if (typeof res === 'string') {
      return { statusCode: status, message: res }
    }
    const obj = res as Record<string, unknown>
    return {
      statusCode: status,
      message: obj.message ?? HttpStatus[status] ?? 'Error',
      ...obj,
    }
  }
}
