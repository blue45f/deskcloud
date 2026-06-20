import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  PUBLISHABLE_KEY_BYTES,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_BYTES,
  SECRET_KEY_PREFIX,
} from "./constants";

/**
 * 키 생성·접두·해시 헬퍼. api(가입/회전/검증)·web·sdk 가 공유한다.
 * pk(publishable) 는 평문으로 노출(브라우저), sk(secret) 는 sha-256 해시로만 저장한다.
 */

/** publishable 키 생성 — `pk_` + 32 hex. */
export function generatePublishableKey(): string {
  return (
    PUBLISHABLE_KEY_PREFIX + randomBytes(PUBLISHABLE_KEY_BYTES).toString("hex")
  );
}

/** secret 키 생성 — `sk_` + 48 hex. 평문은 발급 응답에서 1회만 노출. */
export function generateSecretKey(): string {
  return SECRET_KEY_PREFIX + randomBytes(SECRET_KEY_BYTES).toString("hex");
}

/** sk 평문을 DB 저장용 sha-256 해시(hex)로. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** 입력 sk 가 저장된 해시와 일치하는지(상수시간 비교). */
export function verifySecret(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 문자열이 publishable 키 형태인지(`pk_` 접두). */
export function isPublishableKey(
  value: string | undefined | null,
): value is string {
  return typeof value === "string" && value.startsWith(PUBLISHABLE_KEY_PREFIX);
}

/** 문자열이 secret 키 형태인지(`sk_` 접두). */
export function isSecretKey(value: string | undefined | null): value is string {
  return typeof value === "string" && value.startsWith(SECRET_KEY_PREFIX);
}

/** 새 키 한 쌍(pk 평문 · sk 평문 · sk 해시)을 한 번에. 가입/회전 공통. */
export interface KeyPair {
  publishableKey: string;
  secretKey: string;
  secretKeyHash: string;
}

export function generateKeyPair(): KeyPair {
  const secretKey = generateSecretKey();
  return {
    publishableKey: generatePublishableKey(),
    secretKey,
    secretKeyHash: hashSecret(secretKey),
  };
}
