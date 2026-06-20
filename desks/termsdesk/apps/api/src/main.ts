import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './config'
import { validateEnv } from './config/env'

async function bootstrap(): Promise<void> {
  // 환경 변수 검증(NON-FATAL): 문제가 있어도 부팅을 멈추지 않고 경고만 남깁니다.
  validateEnv()

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  const cfg = app.get<AppConfig>(APP_CONFIG)

  // §6.1 API 베이스라인: 보안 헤더 · 압축 · 쿠키 · CORS · 그레이스풀 셧다운
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  app.use(cookieParser())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TermsDesk API')
    .setDescription('약관·정책 버전 관리 + 변조 방지 게시 + 동의 영수증')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'apiKey')
    .addCookieAuth('td_session', { type: 'apiKey', in: 'cookie' }, 'session')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  const logger = app.get(Logger)
  logger.log(
    `TermsDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
