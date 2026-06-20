import {
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_REALTIME_PATH,
} from "@realtimedesk/shared";

export const APP_CONFIG = Symbol("APP_CONFIG");

export type DeploymentMode = "self-hosted" | "saas";

export interface AppConfig {
  /** 'self-hosted'(첫 부팅 시 데모 테넌트 시드) | 'saas'(멀티테넌트, 가입형) */
  mode: DeploymentMode;
  port: number;
  webOrigin: string;
  /** socket.io 마운트 경로(게이트웨이 호환 — 트레일링 슬래시 금지). */
  realtimePath: string;
  /** 채널당 보관 메시지 수(history). 0이면 영속화/히스토리 비활성. */
  historyLimit: number;
  /** 있으면 PostgreSQL, 없으면 PGlite 임베드 폴백 */
  databaseUrl: string | null;
  pgliteDir: string;
  /** 어드민 API 게이트 토큰 — X-Admin-Token 헤더와 일치해야 통과. */
  adminToken: string;
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

function envInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

/** REALTIME_PATH 정규화 — 선행 슬래시 보장, 트레일링 슬래시 제거(게이트웨이 정확 매칭). */
export function normalizeRealtimePath(raw: string | undefined): string {
  const p = (raw ?? DEFAULT_REALTIME_PATH).trim() || DEFAULT_REALTIME_PATH;
  const withLead = p.startsWith("/") ? p : `/${p}`;
  const trimmed = withLead.replace(/\/+$/, "");
  return trimmed === "" ? DEFAULT_REALTIME_PATH : trimmed;
}

export function loadConfig(): AppConfig {
  const mode: DeploymentMode =
    process.env.REALTIMEDESK_MODE === "saas" ? "saas" : "self-hosted";
  return {
    mode,
    port: envInt(process.env.PORT, 4092),
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5292",
    realtimePath: normalizeRealtimePath(process.env.REALTIME_PATH),
    historyLimit: envInt(
      process.env.REALTIME_HISTORY_LIMIT,
      DEFAULT_HISTORY_LIMIT,
    ),
    databaseUrl: process.env.DATABASE_URL?.trim() || null,
    pgliteDir: process.env.PGLITE_DIR ?? ".data/pglite",
    adminToken: process.env.ADMIN_TOKEN?.trim() || "dev-admin-token-change-me",
  };
}

/** self-hosted 는 항상 시드, saas 는 REALTIMEDESK_SEED=true 일 때만. */
export const isSeedingEnabled = (cfg: AppConfig): boolean =>
  cfg.mode === "self-hosted" || envBool(process.env.REALTIMEDESK_SEED, false);
