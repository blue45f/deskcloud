import { describe, expect, it } from "vitest";

import {
  createNewsletterMarkdown,
  createPipelineExportJson,
  createSnapshotRunbookMarkdown,
  createSourceMonitorCsv,
} from "./contentExports";

describe("content exports", () => {
  it("creates a newsletter markdown export with source links", () => {
    const markdown = createNewsletterMarkdown({ maxUpdates: 1 });

    expect(markdown).toContain("# AIDigestDesk 주간 AI 브리핑");
    expect(markdown).toContain("## 핵심 업데이트");
    expect(markdown).toContain("## 참고 링크");
    expect(markdown).toContain("https://");
  });

  it("creates source monitor CSV rows", () => {
    const csv = createSourceMonitorCsv();
    const rows = csv.split("\n");

    expect(rows[0]).toBe(
      "priority,sourceId,publisher,title,url,cadence,status,nextCheck,nextAction",
    );
    expect(rows.length).toBeGreaterThan(1);
  });

  it("creates pipeline JSON with resolved sources", () => {
    const parsed = JSON.parse(createPipelineExportJson()) as {
      version: number;
      items: Array<{ sources: unknown[] }>;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.items[0]?.sources.length).toBeGreaterThan(0);
  });

  it("creates a snapshot runbook with the CLI command", () => {
    const markdown = createSnapshotRunbookMarkdown();

    expect(markdown).toContain(
      "pnpm --filter @aidigestdesk/content run snapshot:sources",
    );
    expect(markdown).toContain("packages/content/data/source-snapshots.json");
  });
});
