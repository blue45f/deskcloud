import { PGlite } from "@electric-sql/pglite";
import {
  hashSecret,
  isPublishableKey,
  isSecretKey,
  verifySecret,
} from "@realtimedesk/shared";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS } from "../db/migrations";
import * as schema from "../db/schema";

import { TenantsService } from "./tenants.service";

import type { Database, DatabaseService } from "../db/database.service";

async function makeService(): Promise<{
  dbs: DatabaseService;
  service: TenantsService;
}> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema }) as unknown as Database;
  for (const m of MIGRATIONS) await client.exec(m.sql);
  const dbs = { db, kind: "pglite" } as unknown as DatabaseService;
  return { dbs, service: new TenantsService(dbs) };
}

describe("TenantsService (PGlite)", () => {
  let service: TenantsService;

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it("가입 → pk·sk 발급, sk 는 응답 1회만 평문(해시는 검증 가능)", async () => {
    const t = await service.create({ name: "Acme" });
    expect(isPublishableKey(t.publishableKey)).toBe(true);
    expect(isSecretKey(t.secretKey)).toBe(true);
    expect(t.corsOrigins).toEqual(["*"]); // 미지정 시 데모 기본
    expect(t.plan).toBe("free");

    // DB 에는 해시만 — 평문 sk 로 검증 가능
    const row = await service.findById(t.id);
    expect(row).toBeTruthy();
    expect(row!.secretKeyHash).toBe(hashSecret(t.secretKey));
    expect(
      (row as unknown as { secretKey?: string }).secretKey,
    ).toBeUndefined();
  });

  it("pk 로 테넌트 해석(올바른 키만)", async () => {
    const t = await service.create({
      name: "Acme",
      corsOrigins: ["https://acme.com"],
    });
    const byPk = await service.findByPublishableKey(t.publishableKey);
    expect(byPk?.id).toBe(t.id);
    expect(await service.findByPublishableKey("pk_wrong")).toBeNull();
    expect(await service.findByPublishableKey(t.secretKey)).toBeNull(); // sk 로는 안 됨
  });

  it("sk 로 테넌트 해석(해시 비교)", async () => {
    const t = await service.create({ name: "Acme" });
    const bySk = await service.findBySecretKey(t.secretKey);
    expect(bySk?.id).toBe(t.id);
    expect(await service.findBySecretKey("sk_wrong")).toBeNull();
    expect(await service.findBySecretKey(t.publishableKey)).toBeNull(); // pk 로는 안 됨
    expect(verifySecret(t.secretKey, bySk!.secretKeyHash)).toBe(true);
  });

  it("CORS allowlist — * 는 모두 허용, 그 외엔 정확 매칭(Origin 없으면 통과)", async () => {
    const open = await service.create({ name: "Open", corsOrigins: ["*"] });
    const openRow = (await service.findById(open.id))!;
    expect(service.isOriginAllowed(openRow, "https://anything.com")).toBe(true);

    const strict = await service.create({
      name: "Strict",
      corsOrigins: ["https://app.acme.com"],
    });
    const strictRow = (await service.findById(strict.id))!;
    expect(service.isOriginAllowed(strictRow, "https://app.acme.com")).toBe(
      true,
    );
    expect(service.isOriginAllowed(strictRow, "https://evil.com")).toBe(false);
    // server-to-server(Origin 없음)는 통과
    expect(service.isOriginAllowed(strictRow, undefined)).toBe(true);
  });

  it("키 회전 — 새 pk·sk 발급, 이전 키 무효", async () => {
    const t = await service.create({ name: "Acme" });
    const oldPk = t.publishableKey;
    const oldSk = t.secretKey;

    const rotated = await service.rotateKeys(t.id);
    expect(rotated.publishableKey).not.toBe(oldPk);
    expect(rotated.secretKey).not.toBe(oldSk);

    // 이전 키로는 더 이상 해석 안 됨
    expect(await service.findByPublishableKey(oldPk)).toBeNull();
    expect(await service.findBySecretKey(oldSk)).toBeNull();
    // 새 키로는 됨
    expect(
      (await service.findByPublishableKey(rotated.publishableKey))?.id,
    ).toBe(t.id);
    expect((await service.findBySecretKey(rotated.secretKey))?.id).toBe(t.id);
  });

  it("설정 수정 — 이름·요금제·Origin 부분 갱신(보낸 필드만)", async () => {
    const t = await service.create({
      name: "Acme",
      corsOrigins: ["https://acme.com"],
    });

    // 이름만 변경 — Origin·요금제는 유지
    const renamed = await service.updateSettings(t.id, { name: "Acme Corp" });
    expect(renamed.name).toBe("Acme Corp");
    expect(renamed.corsOrigins).toEqual(["https://acme.com"]);
    expect(renamed.plan).toBe("free");

    // 요금제 + Origin 변경(상한도 함께 반영)
    const upgraded = await service.updateSettings(t.id, {
      plan: "pro",
      corsOrigins: ["https://a.com", "https://b.com"],
    });
    expect(upgraded.plan).toBe("pro");
    expect(upgraded.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
    expect(upgraded.usage.cap.messages).toBeGreaterThan(100_000);
  });

  it("설정 수정 — 빈 Origin 배열은 ['*'] 로 정규화(데모 보호)", async () => {
    const t = await service.create({
      name: "Acme",
      corsOrigins: ["https://acme.com"],
    });
    const updated = await service.updateSettings(t.id, { corsOrigins: [] });
    expect(updated.corsOrigins).toEqual(["*"]);
  });

  it("usage — 메시지 소비가 cap 까지 누적되고 초과하면 거부", async () => {
    const t = await service.create({ name: "Acme" });
    expect(await service.tryConsumeMessage(t.id, 1)).toBe(true);
    const usage = await service.getUsage(t.id);
    expect(usage.messages).toBe(1);
    expect(usage.cap.messages).toBeGreaterThan(0);

    // cap 직전까지 채운 뒤 한 건 더 시도하면 false
    await service.tryConsumeMessage(t.id, usage.cap.messages - 1); // 이제 정확히 cap
    expect(await service.tryConsumeMessage(t.id, 1)).toBe(false);
  });
});
