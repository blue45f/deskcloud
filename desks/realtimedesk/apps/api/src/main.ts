import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { APP_CONFIG, type AppConfig } from "./config";
import { validateEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  // 환경 변수 검증(NON-FATAL): 문제가 있어도 부팅을 멈추지 않고 경고만 남깁니다.
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const cfg = app.get<AppConfig>(APP_CONFIG);

  // socket.io 어댑터 — 게이트웨이 @WebSocketGateway 의 path(REALTIME_PATH) 로 마운트.
  // (WsAdapter 는 native ws 전용. socket.io 전송에는 IoAdapter 를 쓴다.)
  app.useWebSocketAdapter(new IoAdapter(app));

  // API 베이스라인: 보안 헤더 · 압축 · CORS(어드민 REST) · 그레이스풀 셧다운
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix("api", {
    exclude: ["health", "health/live", "health/ready"],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("RealtimeDesk API")
    .setDescription(
      "멀티테넌트 실시간(WebSocket pub/sub + presence) as a service. " +
        "pk(브라우저)·sk(서버) 키 · publish/history · 테넌트 self-service.",
    )
    .setVersion("0.1.0")
    .addApiKey(
      { type: "apiKey", name: "X-Realtime-Key", in: "header" },
      "realtimeKey",
    )
    .addApiKey(
      { type: "apiKey", name: "X-Admin-Token", in: "header" },
      "adminToken",
    )
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(cfg.port);
  Logger.log(
    `RealtimeDesk API (${cfg.mode}) → http://localhost:${cfg.port}  · docs: /api/docs  · ws: ${cfg.realtimePath}`,
    "Bootstrap",
  );
}

void bootstrap();
