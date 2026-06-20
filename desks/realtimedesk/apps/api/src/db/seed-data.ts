import {
  hashSecret,
  PUBLISHABLE_KEY_PREFIX,
  SECRET_KEY_PREFIX,
} from "@realtimedesk/shared";
import { eq, sql } from "drizzle-orm";

import { DatabaseService } from "./database.service";
import { messages, tenants } from "./schema";

/**
 * 데모 테넌트 — self-hosted 첫 부팅 시 시드. 고정 키(pk_demo / sk_demo)로 손쉽게 데모/검증.
 * corsOrigins ['*'] 라 어떤 Origin 에서도 핸드셰이크가 통과한다(데모 전용).
 */
export const DEMO_TENANT = {
  name: "Demo Tenant",
  publishableKey: `${PUBLISHABLE_KEY_PREFIX}demo`,
  secretKey: `${SECRET_KEY_PREFIX}demo`,
  corsOrigins: ["*"] as string[],
};

/** 데모 환영 채널에 미리 채워두는 샘플 메시지(history 데모용). */
const DEMO_MESSAGES = [
  {
    event: "announcement",
    data: { text: "RealtimeDesk 데모에 오신 것을 환영합니다 👋" },
  },
  {
    event: "announcement",
    data: { text: "pk_demo 로 연결하고 demo:welcome 채널을 구독해 보세요." },
  },
  {
    event: "tip",
    data: {
      text: "서버에서 sk_demo 로 /api/publish 를 호출하면 즉시 전달됩니다.",
    },
  },
];

export interface SeedResult {
  seeded: boolean;
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 메시지를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(
  dbs: DatabaseService,
  opts: { demo: boolean },
): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false };

  const existing = await dbs.db
    .select({ c: sql<number>`count(*)` })
    .from(tenants);
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false };

  const inserted = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO_TENANT.name,
      publishableKey: DEMO_TENANT.publishableKey,
      secretKeyHash: hashSecret(DEMO_TENANT.secretKey),
      corsOrigins: DEMO_TENANT.corsOrigins,
      plan: "free",
    })
    .returning();
  const tenant = inserted[0]!;

  // 샘플 메시지 — demo:welcome 채널에 시간순으로 몇 건.
  const now = Date.now();
  const total = DEMO_MESSAGES.length;
  const sampleRows = DEMO_MESSAGES.map((m, i) => ({
    tenantId: tenant.id,
    channel: "demo:welcome",
    event: m.event,
    data: m.data,
    publishedAt: new Date(now - (total - i) * 1000),
  }));
  await dbs.db.insert(messages).values(sampleRows);

  return { seeded: true };
}

/** 데모 테넌트가 있는지(테스트·헬스 용). */
export async function hasDemoTenant(dbs: DatabaseService): Promise<boolean> {
  const r = await dbs.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.publishableKey, DEMO_TENANT.publishableKey))
    .limit(1);
  return r.length > 0;
}
