import { beforeEach, describe, expect, it } from "vitest";

import { PresenceService } from "./presence.service";

const A = "tenant-a";
const B = "tenant-b";

describe("PresenceService", () => {
  let p: PresenceService;

  beforeEach(() => {
    p = new PresenceService();
  });

  it("add/remove 가 멤버 수·목록을 정확히 반영", () => {
    expect(p.add(A, "room", "s1")).toBe(true);
    expect(p.add(A, "room", "s2")).toBe(true);
    expect(p.add(A, "room", "s1")).toBe(false); // 중복 추가는 false
    expect(p.count(A, "room")).toBe(2);
    expect(p.members(A, "room").sort()).toEqual(["s1", "s2"]);

    expect(p.remove(A, "room", "s1")).toBe(true);
    expect(p.remove(A, "room", "s1")).toBe(false); // 이미 없음
    expect(p.count(A, "room")).toBe(1);
    expect(p.members(A, "room")).toEqual(["s2"]);
  });

  it("빈 채널은 정리되어 count 0", () => {
    p.add(A, "room", "s1");
    p.remove(A, "room", "s1");
    expect(p.count(A, "room")).toBe(0);
    expect(p.members(A, "room")).toEqual([]);
  });

  it("removeFromAll 이 모든 채널에서 멤버를 떼고 영향 채널을 반환", () => {
    p.add(A, "r1", "s1");
    p.add(A, "r2", "s1");
    p.add(A, "r3", "s2");
    const affected = p.removeFromAll(A, "s1").sort();
    expect(affected).toEqual(["r1", "r2"]);
    expect(p.count(A, "r1")).toBe(0);
    expect(p.count(A, "r2")).toBe(0);
    expect(p.count(A, "r3")).toBe(1); // s2 는 그대로
  });

  it("테넌트 격리 — 같은 채널명이라도 테넌트별 멤버가 분리", () => {
    p.add(A, "room", "s1");
    p.add(B, "room", "s2");
    expect(p.count(A, "room")).toBe(1);
    expect(p.count(B, "room")).toBe(1);
    expect(p.members(A, "room")).toEqual(["s1"]);
    expect(p.members(B, "room")).toEqual(["s2"]);

    // 한 테넌트에서 removeFromAll 해도 다른 테넌트는 영향 없음
    p.removeFromAll(A, "s1");
    expect(p.count(A, "room")).toBe(0);
    expect(p.count(B, "room")).toBe(1);
  });
});
