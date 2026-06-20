import { describe, expect, it } from "vitest";

import {
  createSourceSnapshotStore,
  getSourceSnapshotCandidates,
  snapshotSources,
  summarizeSnapshotRecords,
} from "./sourceSnapshots";

import type { CurationMonitor, SourceRef } from "./catalog";

const fixtureSource: SourceRef = {
  id: "fixture-source",
  title: "Fixture Model Docs",
  publisher: "Fixture AI",
  kind: "official",
  url: "https://example.com/models",
  lastChecked: "2026-06-17",
  note: "테스트용 공식 문서",
};

function createMonitor(
  sourceId: string,
  priority: CurationMonitor["priority"],
): CurationMonitor {
  return {
    id: `${sourceId}-monitor`,
    sourceId,
    providerId: "market",
    cadence: "매일",
    priority,
    status: "자동화 후보",
    owner: "모델 스펙",
    nextCheck: "2026-06-18",
    nextAction: "스냅샷 테스트",
    automationHint: "본문 해시 변경 감지",
  };
}

describe("source snapshots", () => {
  it("sorts snapshot candidates by monitoring priority", () => {
    const lowPrioritySource = { ...fixtureSource, id: "low" };
    const highPrioritySource = { ...fixtureSource, id: "high" };
    const candidates = getSourceSnapshotCandidates(
      [lowPrioritySource, highPrioritySource],
      [createMonitor("low", "P2"), createMonitor("high", "P0")],
    );

    expect(candidates.map((candidate) => candidate.source.id)).toEqual([
      "high",
      "low",
    ]);
  });

  it("marks changed records against a previous snapshot", async () => {
    const firstRun = await snapshotSources({
      sourceItems: [fixtureSource],
      fetcher: async () => new Response("old model page"),
      now: "2026-06-17T00:00:00.000Z",
    });
    const previous = createSourceSnapshotStore(
      firstRun,
      "2026-06-17T00:00:00.000Z",
    );

    const secondRun = await snapshotSources({
      sourceItems: [fixtureSource],
      previous,
      fetcher: async () => new Response("new model page"),
      now: "2026-06-18T00:00:00.000Z",
    });

    expect(secondRun[0]).toMatchObject({
      sourceId: "fixture-source",
      status: "changed",
      changed: true,
      previousHash: firstRun[0]?.contentHash,
    });
  });

  it("keeps failed fetches as records instead of throwing", async () => {
    const records = await snapshotSources({
      sourceItems: [fixtureSource],
      fetcher: async () => {
        throw new Error("offline");
      },
      now: "2026-06-18T00:00:00.000Z",
    });

    expect(records[0]).toMatchObject({
      status: "failed",
      changed: false,
      error: "offline",
    });
    expect(summarizeSnapshotRecords(records)).toMatchObject({
      total: 1,
      failed: 1,
    });
  });

  it("marks non-success HTTP responses as failed records", async () => {
    const records = await snapshotSources({
      sourceItems: [fixtureSource],
      fetcher: async () =>
        new Response("missing page", {
          status: 404,
          statusText: "Not Found",
        }),
      now: "2026-06-18T00:00:00.000Z",
    });

    expect(records[0]).toMatchObject({
      status: "failed",
      changed: false,
      statusCode: 404,
      error: "HTTP 404 Not Found",
    });
    expect(summarizeSnapshotRecords(records)).toMatchObject({
      total: 1,
      failed: 1,
    });
  });
});
