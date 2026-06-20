import { describe, expect, it, vi } from "vitest";

import { createPublisher, RealtimePublishError } from "./server";

import type { PublishResultDto } from "@realtimedesk/shared";

const RESULT: PublishResultDto = {
  delivered: 3,
  message: {
    id: "m_1",
    tenantId: "t_1",
    channel: "room:42",
    event: "message",
    data: { text: "hi" },
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(
  impl: (url: string, init?: RequestInit) => Response,
): typeof fetch {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(impl(String(input), init)),
  ) as unknown as typeof fetch;
}

function calls(fn: typeof fetch): Array<[string, RequestInit | undefined]> {
  const m = fn as unknown as { mock: { calls: Array<[unknown, unknown]> } };
  return m.mock.calls.map(([u, i]) => [
    String(u),
    i as RequestInit | undefined,
  ]);
}

describe("createPublisher", () => {
  it("rejects a non-sk secret key", () => {
    expect(() =>
      createPublisher({
        secretKey: "pk_nope",
        endpoint: "https://rt.example.com",
      }),
    ).toThrow(RealtimePublishError);
  });

  it("POSTs to /api/publish with X-Realtime-Key and json body", async () => {
    const fetchMock = mockFetch((_url) => jsonResponse(RESULT));
    const pub = createPublisher({
      secretKey: "sk_secret",
      endpoint: "https://rt.example.com/",
      fetch: fetchMock,
    });

    const res = await pub.publish("room:42", "message", { text: "hi" });
    expect(res).toEqual(RESULT);

    const [url, init] = calls(fetchMock)[0]!;
    // 트레일링 슬래시는 정규화되어 정확히 /api/publish 로 간다(게이트웨이 경로 함정 방지).
    expect(url).toBe("https://rt.example.com/api/publish");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-realtime-key"]).toBe("sk_secret");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      channel: "room:42",
      event: "message",
      data: { text: "hi" },
    });
  });

  it("publishMessage forwards a PublishInput as-is", async () => {
    const fetchMock = mockFetch(() => jsonResponse(RESULT));
    const pub = createPublisher({
      secretKey: "sk_secret",
      endpoint: "https://rt.example.com",
      fetch: fetchMock,
    });
    await pub.publishMessage({ channel: "c", event: "e" });
    const [, init] = calls(fetchMock)[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      channel: "c",
      event: "e",
    });
  });

  it("throws RealtimePublishError with server message on non-2xx", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse({ message: "메시지 사용량 상한을 초과했습니다" }, 429),
    );
    const pub = createPublisher({
      secretKey: "sk_secret",
      endpoint: "https://rt.example.com",
      fetch: fetchMock,
    });
    await expect(pub.publish("c", "e")).rejects.toMatchObject({
      name: "RealtimePublishError",
      status: 429,
      message: "메시지 사용량 상한을 초과했습니다",
    });
  });

  it("joins array error messages (Nest validation shape)", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse({ message: ["channel: invalid", "event: invalid"] }, 400),
    );
    const pub = createPublisher({
      secretKey: "sk_secret",
      endpoint: "https://rt.example.com",
      fetch: fetchMock,
    });
    await expect(pub.publish("c", "e")).rejects.toMatchObject({
      status: 400,
      message: "channel: invalid, event: invalid",
    });
  });
});
