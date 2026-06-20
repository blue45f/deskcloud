import { describe, expect, it } from "vitest";

import { PUBLISHABLE_KEY_PREFIX, SECRET_KEY_PREFIX } from "./constants";
import {
  generateKeyPair,
  generatePublishableKey,
  generateSecretKey,
  hashSecret,
  isPublishableKey,
  isSecretKey,
  verifySecret,
} from "./keys";

describe("keys", () => {
  it("pk 는 pk_ 접두 + 32 hex", () => {
    const pk = generatePublishableKey();
    expect(pk.startsWith(PUBLISHABLE_KEY_PREFIX)).toBe(true);
    expect(pk.slice(PUBLISHABLE_KEY_PREFIX.length)).toMatch(/^[0-9a-f]{32}$/);
    expect(isPublishableKey(pk)).toBe(true);
    expect(isSecretKey(pk)).toBe(false);
  });

  it("sk 는 sk_ 접두 + 48 hex", () => {
    const sk = generateSecretKey();
    expect(sk.startsWith(SECRET_KEY_PREFIX)).toBe(true);
    expect(sk.slice(SECRET_KEY_PREFIX.length)).toMatch(/^[0-9a-f]{48}$/);
    expect(isSecretKey(sk)).toBe(true);
    expect(isPublishableKey(sk)).toBe(false);
  });

  it("verifySecret 는 올바른 sk 만 통과(해시 일치)", () => {
    const sk = generateSecretKey();
    const hash = hashSecret(sk);
    expect(verifySecret(sk, hash)).toBe(true);
    expect(verifySecret(generateSecretKey(), hash)).toBe(false);
    expect(verifySecret("sk_deadbeef", hash)).toBe(false);
  });

  it("generateKeyPair 는 pk 평문·sk 평문·sk 해시를 일관되게 반환", () => {
    const pair = generateKeyPair();
    expect(isPublishableKey(pair.publishableKey)).toBe(true);
    expect(isSecretKey(pair.secretKey)).toBe(true);
    expect(pair.secretKeyHash).toBe(hashSecret(pair.secretKey));
    expect(verifySecret(pair.secretKey, pair.secretKeyHash)).toBe(true);
  });

  it("두 번 생성하면 서로 다른 키(무작위성)", () => {
    expect(generatePublishableKey()).not.toBe(generatePublishableKey());
    expect(generateSecretKey()).not.toBe(generateSecretKey());
  });
});
