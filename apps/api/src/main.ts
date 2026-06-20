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
  // 공개 위젯 경로의 실제 출처 허용목록은 PublishableKeyGuard 가 테넌트별로 강제한다.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AuthDesk API')
    .setDescription(
      '드롭인 로그인/인증(auth-as-a-service) — 테넌트 가입(pk_/sk_) · end-user 가입/로그인(scrypt + JWT) · 세션 · 어드민 사용자/통계'
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Authdesk-Key', in: 'header' }, 'publishableKey')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'sk_…' }, 'secretKey')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'endUserToken')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `AuthDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
