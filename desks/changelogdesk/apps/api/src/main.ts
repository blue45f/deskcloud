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
  // 공개 위젯 경로는 테넌트별 corsOrigins 가드로 별도 검사하므로 미들웨어 CORS 는 개방한다.
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ChangelogDesk API')
    .setDescription(
      '외부 온보딩형 멀티테넌트 인앱 체인지로그. 퍼블리시 키(pk_, 위젯 읽기·미읽음) vs 시크릿 키(sk_, CRUD)·글로벌 ADMIN_TOKEN.'
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'x-pk', in: 'header' }, 'publishableKey')
    .addApiKey({ type: 'apiKey', name: 'x-sk', in: 'header' }, 'secretKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `ChangelogDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
