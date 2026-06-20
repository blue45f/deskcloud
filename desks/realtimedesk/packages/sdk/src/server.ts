/**
 * 서버 publisher — secret 키(sk_)로 채널에 이벤트를 발행한다(REST).
 *
 * 브라우저가 아닌 서버 환경에서만 사용한다(sk 는 절대 클라이언트에 노출 금지).
 * 게이트웨이/프록시 뒤 정확 매칭을 위해 `POST {endpoint}/api/publish` 로 보내며,
 * 인증은 `X-Realtime-Key: sk_…` 헤더로 한다(publish.controller 계약).
 *
 * 의존성 0 — fetch(전역 또는 주입)만 사용한다. @realtimedesk/shared 는 타입만 가져온다.
 */
import type {
  HistoryDto,
  MessageDto,
  PublishInput,
  PublishResultDto,
} from "@realtimedesk/shared";

export type { HistoryDto, MessageDto, PublishInput, PublishResultDto };

const KEY_HEADER = "x-realtime-key";
const SDK_VERSION = "0.1.0";

export interface PublisherOptions {
  /** secret 키(sk_…). 서버 환경 전용 — 클라이언트 번들에 포함하지 말 것. */
  secretKey: string;
  /** API 베이스 URL. 예: 'https://realtime.example.com' (끝의 / 는 무시). */
  endpoint: string;
  /** 커스텀 fetch(테스트·런타임 polyfill). 기본은 전역 fetch. */
  fetch?: typeof fetch;
}

/** publish/요청 실패 시 던지는 식별 가능한 에러. */
export class RealtimePublishError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "RealtimePublishError";
  }
}

export interface RealtimePublisher {
  /**
   * 채널로 이벤트를 발행한다(구독자에게 전달 + history 활성 시 영속화).
   * 반환값: 전달된 구독자 수 + (영속화 시) 메시지.
   */
  publish(
    channel: string,
    event: string,
    data?: unknown,
    signal?: AbortSignal,
  ): Promise<PublishResultDto>;
  /** PublishInput 객체로 직접 발행(채널·이벤트·데이터). */
  publishMessage(
    input: PublishInput,
    signal?: AbortSignal,
  ): Promise<PublishResultDto>;
}

/**
 * 서버 publisher 를 생성한다.
 *
 *   const pub = createPublisher({ secretKey: process.env.RT_SECRET!, endpoint: 'https://…' })
 *   await pub.publish('room:42', 'message', { text: 'hi' })
 */
export function createPublisher(options: PublisherOptions): RealtimePublisher {
  if (!options.secretKey?.startsWith("sk_")) {
    throw new RealtimePublishError("secretKey 는 'sk_' 로 시작해야 합니다", 0);
  }
  const base = options.endpoint.replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!doFetch) {
    throw new RealtimePublishError(
      "fetch 를 사용할 수 없습니다. options.fetch 를 전달하세요.",
      0,
    );
  }

  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    [KEY_HEADER]: options.secretKey,
    "x-realtimedesk-sdk": SDK_VERSION,
  });

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const rec = (json ?? {}) as Record<string, unknown>;
      const raw =
        rec.message ?? rec.error ?? `RealtimeDesk 요청 실패 (${res.status})`;
      const msg = Array.isArray(raw) ? raw.join(", ") : String(raw);
      throw new RealtimePublishError(msg, res.status, json);
    }
    return json as T;
  }

  const publishMessage: RealtimePublisher["publishMessage"] = async (
    input,
    signal,
  ) => {
    const res = await doFetch(`${base}/api/publish`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
      signal,
    });
    return parse<PublishResultDto>(res);
  };

  return {
    publishMessage,
    publish(channel, event, data, signal) {
      return publishMessage({ channel, event, data }, signal);
    },
  };
}
