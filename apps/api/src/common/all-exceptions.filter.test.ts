import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AllExceptionsFilter } from './all-exceptions.filter'

import type { ArgumentsHost } from '@nestjs/common'
import type { PinoLogger } from 'nestjs-pino'

interface CapturedResponse {
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
  body?: unknown
  code?: number
}

function makeHost(
  url = '/api/things',
  method = 'GET'
): { host: ArgumentsHost; res: CapturedResponse } {
  const res: CapturedResponse = {
    status: vi.fn(),
    json: vi.fn(),
  }
  res.status.mockImplementation((code: number) => {
    res.code = code
    return res
  })
  res.json.mockImplementation((body: unknown) => {
    res.body = body
    return res
  })
  const host = {
    switchToHttp: () => ({
      getResponse: <T>() => res as unknown as T,
      getRequest: <T>() => ({ url, method }) as unknown as T,
    }),
  } as unknown as ArgumentsHost
  return { host, res }
}

function makeFilter(): { filter: AllExceptionsFilter; error: ReturnType<typeof vi.fn> } {
  const error = vi.fn()
  const logger = { error } as unknown as PinoLogger
  return { filter: new AllExceptionsFilter(logger), error }
}

describe('AllExceptionsFilter (envelope 역호환)', () => {
  it('NotFoundException: statusCode/message/error 보존 + path/timestamp ADD', () => {
    const { filter } = makeFilter()
    const { host, res } = makeHost('/api/missing')
    filter.catch(new NotFoundException('not here'), host)

    expect(res.code).toBe(HttpStatus.NOT_FOUND)
    const body = res.body as Record<string, unknown>
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe('not here')
    expect(body.error).toBe('Not Found')
    expect(body.path).toBe('/api/missing')
    expect(typeof body.timestamp).toBe('string')
  })

  it('BadRequestException(배열 message): message 배열 그대로 보존', () => {
    const { filter } = makeFilter()
    const { host, res } = makeHost()
    filter.catch(new BadRequestException(['name: required', 'age: number']), host)

    const body = res.body as Record<string, unknown>
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST)
    expect(body.message).toEqual(['name: required', 'age: number'])
    expect(body.error).toBe('Bad Request')
  })

  it('문자열 응답 HttpException: { statusCode, message } 보존', () => {
    const { filter } = makeFilter()
    const { host, res } = makeHost()
    filter.catch(new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT), host)

    const body = res.body as Record<string, unknown>
    expect(body.statusCode).toBe(HttpStatus.I_AM_A_TEAPOT)
    expect(body.message).toBe('teapot')
  })

  it('비-HTTP 예외: 500 + statusCode/message 보존, error 로깅', () => {
    const { filter, error } = makeFilter()
    const { host, res } = makeHost('/api/boom')
    filter.catch(new Error('kaboom'), host)

    expect(res.code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    const body = res.body as Record<string, unknown>
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).toBe('Internal server error')
    expect(body.path).toBe('/api/boom')
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('5xx HttpException: error 로깅 발생', () => {
    const { filter, error } = makeFilter()
    const { host } = makeHost()
    filter.catch(new InternalServerErrorException('db down'), host)
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('4xx: error 로깅 안 함', () => {
    const { filter, error } = makeFilter()
    const { host } = makeHost()
    filter.catch(new BadRequestException('nope'), host)
    expect(error).not.toHaveBeenCalled()
  })
})
