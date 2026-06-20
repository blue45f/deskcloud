import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { type NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import compression from 'compression'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './config'
import { validateEnv } from './config/env'

async function bootstrap(): Promise<void> {
  // 환경 변수 검증(NON-FATAL): 문제가 있어도 부팅을 멈추지 않고 경고만 남깁니다.
  validateEnv()

  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const cfg = app.get<AppConfig>(APP_CONFIG)

  // 이미지 업로드(base64 ≈ 2.7 MB)를 받도록 JSON 바디 한도를 올린다(기본 100kb → 6mb).
  app.useBodyParser('json', { limit: '6mb' })

  // API 베이스라인: 보안 헤더 · 압축 · CORS · 그레이스풀 셧다운.
  // CORS 는 reflect(any origin)로 열어 브라우저 preflight 를 통과시키되,
  // publishable 경로의 실제 출처 허용목록은 PublishableKeyGuard 가 테넌트별로 강제한다.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AdDesk API')
    .setDescription(
      '멀티테넌트(pk/sk) 배너·광고 서빙 — 가입(pk_/sk_)·서빙(가중치 선택)·노출/클릭 추적·캠페인/크리에이티브/슬롯 CRUD·통계(CTR)'
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-sk', in: 'header' }, 'apiKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `AdDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
