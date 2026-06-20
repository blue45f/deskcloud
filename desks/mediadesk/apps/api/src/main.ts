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

  const app = await NestFactory.create(AppModule, { bodyParser: true })
  const cfg = app.get<AppConfig>(APP_CONFIG)

  // 보안 헤더 · 압축 · CORS · 그레이스풀 셧다운.
  // crossOriginResourcePolicy 는 자산을 다른 origin 에서 <img>/fetch 로 쓰도록 cross-origin 허용.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  )
  app.use(compression())
  // 공개 위젯·자산 경로는 전 origin 에서 호출되므로 개방(테넌트별 CORS 는 가드가 별도 통제).
  app.enableCors({ origin: true, credentials: false })
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready', 'file/(.*)'],
  })
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediaDesk API')
    .setDescription(
      '멀티테넌트 미디어 업로드·공개 조회·온더플라이 변환·CDN. publishable(pk_) / secret(sk_) 키.'
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Publishable-Key', in: 'header' }, 'publishableKey')
    .addApiKey({ type: 'apiKey', name: 'X-Sk', in: 'header' }, 'secretKey')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Token', in: 'header' }, 'adminToken')
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig))

  await app.listen(cfg.port)
  Logger.log(
    `MediaDesk API (${cfg.mode}, storage=${cfg.storageDriver}) → http://localhost:${cfg.port}  · docs: /api/docs`,
    'Bootstrap'
  )
}

void bootstrap()
