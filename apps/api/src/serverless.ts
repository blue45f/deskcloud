import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import compression from 'compression'
import express from 'express'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { validateEnv } from './config/env'

import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Vercel(서버리스) 진입점.
 *
 * `main.ts`(로컬/도커: NestFactory.create + app.listen)와 동일한 미들웨어·전역 프리픽스·Swagger 를
 * 적용하되, `listen()` 대신 `app.init()` 만 호출하고 초기화된 Express 핸들러를 export 한다.
 * 웜 인보케이션에서 재사용되도록 부트스트랩 Promise 를 모듈 스코프에 캐시한다.
 *
 * `main.ts` 는 로컬/도커용으로 그대로 유지된다(이 파일은 추가일 뿐 대체가 아니다).
 */

/** Express 앱은 (req, res) 를 받는 요청 핸들러 함수다. */
export type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void

let cached: ExpressHandler | null = null
let bootstrapping: Promise<ExpressHandler> | null = null

async function bootstrapServerless(): Promise<ExpressHandler> {
  // 환경 변수 검증(NON-FATAL): 문제가 있어도 부팅을 멈추지 않고 경고만 남깁니다.
  validateEnv()

  // ExpressAdapter 를 명시적으로 주입한다(서버리스 번들러 NFT 가 platform-express·express 를
  // 정적으로 추적하도록 — NestFactory 의 동적 어댑터 로드는 트레이싱에서 누락될 수 있다).
  const expressApp = express()
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      // 서버리스 cold start 로그 노이즈를 줄입니다(에러/경고/로그는 유지).
      logger: ['error', 'warn', 'log'],
    }
  )

  // 이미지 업로드(base64 ≈ 2.7 MB)를 받도록 JSON 바디 한도를 올린다(기본 100kb → 6mb).
  app.useBodyParser('json', { limit: '6mb' })

  // main.ts 와 동일한 API 베이스라인: 보안 헤더 · 압축 · CORS(공개 가입/위젯 대비 개방).
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  // 주: 서버리스에서는 shutdown hook(enableShutdownHooks)을 켜지 않습니다 — 함수 인스턴스가
  // 재사용되며, 프로세스 시그널 훅이 누수/중복 등록될 수 있어 init 만 수행합니다.

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AdDesk API')
    .setDescription(
      '멀티테넌트(pk/sk) 배너·광고 서빙 — 가입(pk_/sk_)·서빙·노출/클릭 추적·캠페인/크리에이티브/슬롯 CRUD·통계(CTR)'
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-sk', in: 'header' }, 'apiKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  // listen() 대신 init(): HTTP 서버를 띄우지 않고 Nest 라이프사이클(onModuleInit·
  // onApplicationBootstrap = DB 마이그레이션 + 시드)만 실행한 뒤 Express 핸들러를 반환.
  await app.init()
  return app.getHttpAdapter().getInstance() as ExpressHandler
}

/** 초기화된 Express 핸들러를 반환(웜 인보케이션 캐시). */
export async function getApp(): Promise<ExpressHandler> {
  if (cached) return cached
  bootstrapping ??= bootstrapServerless()
  cached = await bootstrapping
  return cached
}
