import { describe, expect, it } from "vitest";

import {
  avatarColor,
  avatarInitial,
  DEFAULT_ACCENT,
  themeVars,
  WIDGET_CSS,
} from "./styles";

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("alice")).toBe(avatarColor("alice"));
  });

  it("differs across seeds (high probability)", () => {
    expect(avatarColor("alice")).not.toBe(avatarColor("bob"));
  });

  it("returns an hsl color with fixed sat/lightness", () => {
    expect(avatarColor("x")).toMatch(/^hsl\(\d+ 52% 38%\)$/);
  });
});

describe("avatarInitial", () => {
  it("uppercases the first alphanumeric char", () => {
    expect(avatarInitial("alice")).toBe("A");
    expect(avatarInitial("  bob")).toBe("B");
    expect(avatarInitial("9lives")).toBe("9");
  });

  it("falls back to ? when no usable char", () => {
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial("___")).toBe("?");
  });
});

describe("themeVars", () => {
  it("maps accent to scoped CSS variables", () => {
    expect(themeVars({ accent: "#abc", accentInk: "#fff" })).toEqual({
      "--rt-accent": "#abc",
      "--rt-accent-ink": "#fff",
    });
  });
});

describe("WIDGET_CSS", () => {
  it("namespaces everything under .rt- and uses the default accent", () => {
    expect(WIDGET_CSS).toContain(".rt-root");
    expect(WIDGET_CSS).toContain(DEFAULT_ACCENT);
    // 외부 CSS 프레임워크 0 — Tailwind/utility 흔적이 없어야 한다.
    expect(WIDGET_CSS).not.toMatch(/\b(tailwind|!important;.*tw-)\b/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(WIDGET_CSS).toContain("prefers-reduced-motion");
  });
});
