import 'reflect-metadata'

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

  // API 베이스라인: 보안 헤더 · 압축 · CORS(공개 가입/위젯 경로 대비 개방) · 그레이스풀 셧다운
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  // origin:true 는 요청 Origin 을 그대로 반영(any origin 허용) — 공개 문의/위젯 API 를
  // 어떤 형제 앱 출처에서도 POST/GET 할 수 있게 한다(비자격증명 fetch). 어드민/시크릿
  // 경로는 헤더 토큰으로 별도 보호되므로 개방 CORS 가 인증을 우회시키지 않는다.
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('@desk/platform API')
    .setDescription(
      'DeskCloud 중앙 계정/빌링 — 테넌트 가입 · 키 회전 · 사용량 미터링(멀티테넌트 코어)'
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'sk_…' }, 'secretKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `@desk/platform API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs · billing: ${cfg.billingProvider}`,
    'Bootstrap'
  )
}

void bootstrap()
