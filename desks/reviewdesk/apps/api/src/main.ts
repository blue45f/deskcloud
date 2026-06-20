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

  // API 베이스라인: 보안 헤더 · 압축 · CORS(공개 위젯은 테넌트별 corsOrigins 로 별도 제어) · 셧다운
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ReviewDesk API')
    .setDescription('멀티테넌트 평점·리뷰·후기 수집(publishable 키) · 검수 · 집계(secret 키)')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Pk', in: 'header' }, 'publishableKey')
    .addApiKey({ type: 'apiKey', name: 'X-Sk', in: 'header' }, 'secretKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `ReviewDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
