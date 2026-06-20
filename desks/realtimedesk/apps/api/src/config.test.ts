import { describe, expect, it } from "vitest";

import { normalizeRealtimePath } from "./config";

describe("normalizeRealtimePath (WS 경로 정확 매칭)", () => {
  it("선행 슬래시를 보장한다", () => {
    expect(normalizeRealtimePath("realtime")).toBe("/realtime");
    expect(normalizeRealtimePath("/realtime")).toBe("/realtime");
  });

  it("트레일링 슬래시를 제거한다(게이트웨이 mismatch 방지)", () => {
    expect(normalizeRealtimePath("/realtime/")).toBe("/realtime");
    expect(normalizeRealtimePath("/realtime///")).toBe("/realtime");
  });

  it("미지정·빈 값은 기본 /realtime", () => {
    expect(normalizeRealtimePath(undefined)).toBe("/realtime");
    expect(normalizeRealtimePath("")).toBe("/realtime");
    expect(normalizeRealtimePath("   ")).toBe("/realtime");
    expect(normalizeRealtimePath("/")).toBe("/realtime");
  });

  it("커스텀 경로도 정규화", () => {
    expect(normalizeRealtimePath("ws/realtime/")).toBe("/ws/realtime");
  });
});
