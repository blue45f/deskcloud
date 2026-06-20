/**
 * @realtimedesk/sdk — RealtimeDesk 클라이언트·서버 SDK.
 *
 * - 브라우저(구독·presence): `import { createRealtimeClient } from '@realtimedesk/sdk'`
 *   또는 트리셰이킹을 위해 `@realtimedesk/sdk/client`.
 * - 서버(publish, sk): `import { createPublisher } from '@realtimedesk/sdk/server'`.
 *   (server 진입점은 브라우저 번들에 포함하지 말 것 — sk 노출 금지)
 *
 * 브라우저 클라이언트는 node:crypto 를 끌어오지 않도록 @realtimedesk/shared 에서
 * 타입만 가져온다(런타임 값 미사용).
 */
export {
  createRealtimeClient,
  RealtimeClient,
  RealtimeAckError,
  IS_BROWSER,
  type RealtimeClientOptions,
  type ConnectionStatus,
  type Subscription,
  type PresenceSubscription,
  type MessageHandler,
  type PresenceHandler,
  type StatusHandler,
  type ErrorHandler,
  type Ack,
  type MessageDto,
  type PresenceDto,
  type ServerErrorEvent,
  type ServerPresenceDeltaEvent,
} from "./client";

export {
  createPublisher,
  RealtimePublishError,
  type RealtimePublisher,
  type PublisherOptions,
  type PublishInput,
  type PublishResultDto,
  type HistoryDto,
} from "./server";
