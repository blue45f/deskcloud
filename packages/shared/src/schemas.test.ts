import { describe, expect, it } from "vitest";

import {
  channelSchema,
  createTenantSchema,
  historyQuerySchema,
  originSchema,
  publishSchema,
  updateTenantSettingsSchema,
} from "./schemas";

describe("schemas", () => {
  it("channelSchema 는 안전한 이름만 허용", () => {
    expect(channelSchema.safeParse("room:42").success).toBe(true);
    expect(channelSchema.safeParse("orders.created").success).toBe(true);
    expect(channelSchema.safeParse("bad channel!").success).toBe(false);
    expect(channelSchema.safeParse("").success).toBe(false);
  });

  it("originSchema 는 * 또는 http(s) origin 만", () => {
    expect(originSchema.safeParse("*").success).toBe(true);
    expect(originSchema.safeParse("https://app.example.com").success).toBe(
      true,
    );
    expect(originSchema.safeParse("http://localhost:5292").success).toBe(true);
    expect(originSchema.safeParse("app.example.com").success).toBe(false);
    expect(originSchema.safeParse("ftp://x").success).toBe(false);
  });

  it("createTenantSchema 는 name 필수, corsOrigins/plan 선택", () => {
    expect(createTenantSchema.safeParse({ name: "Acme" }).success).toBe(true);
    expect(
      createTenantSchema.safeParse({
        name: "Acme",
        corsOrigins: ["https://acme.com"],
        plan: "free",
      }).success,
    ).toBe(true);
    expect(createTenantSchema.safeParse({}).success).toBe(false);
  });

  it("updateTenantSettingsSchema 는 부분 갱신 — 최소 한 필드 필요", () => {
    expect(
      updateTenantSettingsSchema.safeParse({ name: "New" }).success,
    ).toBe(true);
    expect(
      updateTenantSettingsSchema.safeParse({ corsOrigins: [], plan: "pro" })
        .success,
    ).toBe(true);
    // 빈 객체는 거부(수정할 필드 없음)
    expect(updateTenantSettingsSchema.safeParse({}).success).toBe(false);
    // 잘못된 Origin 은 거부
    expect(
      updateTenantSettingsSchema.safeParse({ corsOrigins: ["nope"] }).success,
    ).toBe(false);
  });

  it("publishSchema 는 channel·event 필수, data 자유", () => {
    expect(
      publishSchema.safeParse({ channel: "c", event: "e", data: { x: 1 } })
        .success,
    ).toBe(true);
    expect(
      publishSchema.safeParse({ channel: "c", event: "e", data: "hello" })
        .success,
    ).toBe(true);
    expect(publishSchema.safeParse({ channel: "c", event: "e" }).success).toBe(
      true,
    ); // data optional(unknown)
    expect(
      publishSchema.safeParse({ channel: "bad chan", event: "e", data: 1 })
        .success,
    ).toBe(false);
  });

  it("historyQuerySchema 는 limit 강제(1..MAX)", () => {
    expect(historyQuerySchema.parse({ limit: "10" }).limit).toBe(10);
    expect(historyQuerySchema.parse({}).limit).toBeUndefined();
    expect(historyQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ limit: "99999" }).success).toBe(
      false,
    );
  });
});
