import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import compression from 'compression'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './config'
import { validateEnv } from './config/env'

async function bootstrap(): Promise<void> {
  // 환경 변수 검증(NON-FATAL): 문제가 있어도 부팅을 멈추지 않고 경고만 남깁니다.
  validateEnv()

  const app = await NestFactory.create(AppModule)
  const cfg = app.get<AppConfig>(APP_CONFIG)

  // API 베이스라인: 보안 헤더 · 압축 · CORS · 그레이스풀 셧다운.
  // CORS 는 reflect(any origin)로 열어 브라우저 preflight 를 통과시키되,
  // publishable 경로의 실제 출처 허용목록은 PublishableKeyGuard 가 테넌트별로 강제한다.
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true, exposedHeaders: ['X-Total-Count'] })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NotifyDesk API')
    .setDescription(
      '외부 온보딩형(멀티테넌트) Notifications-as-a-Service — 가입(pk_/sk_)·발송(in-app·email·web-push)·인박스·선호·템플릿'
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'pk_… 또는 sk_… 키' }, 'apiKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `NotifyDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
