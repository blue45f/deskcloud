import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type AppConfig } from "../config";
import { MIGRATIONS } from "../db/migrations";
import * as schema from "../db/schema";

import { RealtimeService } from "./realtime.service";

import type { Database, DatabaseService } from "../db/database.service";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

function cfg(historyLimit: number): AppConfig {
  return {
    mode: "self-hosted",
    port: 0,
    webOrigin: "http://localhost",
    realtimePath: "/realtime",
    historyLimit,
    databaseUrl: null,
    pgliteDir: ".data/test",
    adminToken: "test",
  };
}

async function makeService(
  historyLimit = 5,
): Promise<{ dbs: DatabaseService; svc: RealtimeService }> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema }) as unknown as Database;
  for (const m of MIGRATIONS) await client.exec(m.sql);
  const dbs = { db, kind: "pglite" } as unknown as DatabaseService;
  return { dbs, svc: new RealtimeService(dbs, cfg(historyLimit)) };
}

describe("RealtimeService (PGlite)", () => {
  let svc: RealtimeService;

  beforeEach(async () => {
    ({ svc } = await makeService());
  });

  it("publish 가 메시지를 영속화하고 브로드캐스터로 전달", async () => {
    const broadcaster = vi.fn().mockReturnValue(3);
    svc.setBroadcaster(broadcaster);

    const res = await svc.publish(TENANT_A, {
      channel: "room:1",
      event: "msg",
      data: { x: 1 },
    });
    expect(res.delivered).toBe(3);
    expect(res.message).toBeTruthy();
    expect(res.message!.channel).toBe("room:1");
    expect(res.message!.event).toBe("msg");
    expect(res.message!.data).toEqual({ x: 1 });
    expect(broadcaster).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ channel: "room:1" }),
    );

    // 영속화 확인 — history 로 다시 읽힘
    const hist = await svc.history(TENANT_A, "room:1");
    expect(hist).toHaveLength(1);
    expect(hist[0]!.event).toBe("msg");
  });

  it("history 는 최근 N개를 오래된→최신 순으로 반환", async () => {
    for (let i = 0; i < 4; i += 1) {
      await svc.publish(TENANT_A, { channel: "c", event: "e", data: { n: i } });
    }
    const hist = await svc.history(TENANT_A, "c");
    const ns = hist.map((m) => (m.data as { n: number }).n);
    expect(ns).toEqual([0, 1, 2, 3]); // 오름차순
  });

  it("history limit 으로 채널 보관 개수를 자른다(prune)", async () => {
    // historyLimit=5 인 서비스에 7건 publish → 최근 5건만 남아야
    for (let i = 0; i < 7; i += 1) {
      await svc.publish(TENANT_A, { channel: "c", event: "e", data: { n: i } });
    }
    const hist = await svc.history(TENANT_A, "c", 100);
    expect(hist).toHaveLength(5);
    const ns = hist.map((m) => (m.data as { n: number }).n);
    expect(ns).toEqual([2, 3, 4, 5, 6]); // 오래된 0,1 은 잘림
  });

  it("채널 격리 — 다른 채널·다른 테넌트의 메시지가 섞이지 않음", async () => {
    await svc.publish(TENANT_A, { channel: "a", event: "e", data: 1 });
    await svc.publish(TENANT_A, { channel: "b", event: "e", data: 2 });
    await svc.publish(TENANT_B, { channel: "a", event: "e", data: 3 });

    const aA = await svc.history(TENANT_A, "a");
    expect(aA).toHaveLength(1);
    expect(aA[0]!.data).toBe(1);

    const aB = await svc.history(TENANT_B, "a");
    expect(aB).toHaveLength(1);
    expect(aB[0]!.data).toBe(3); // 같은 채널명이지만 테넌트로 격리
  });

  it("history 비활성(limit=0)이면 영속화하지 않고 휘발성으로만 브로드캐스트", async () => {
    const { svc: volatile } = await makeService(0);
    const broadcaster = vi.fn().mockReturnValue(1);
    volatile.setBroadcaster(broadcaster);
    expect(volatile.persistenceEnabled).toBe(false);

    const res = await volatile.publish(TENANT_A, {
      channel: "c",
      event: "e",
      data: "x",
    });
    expect(res.delivered).toBe(1);
    expect(res.message).toBeNull(); // 영속화 안 함
    expect(broadcaster).toHaveBeenCalled(); // 전달은 됨

    const hist = await volatile.history(TENANT_A, "c");
    expect(hist).toEqual([]);
  });
});
