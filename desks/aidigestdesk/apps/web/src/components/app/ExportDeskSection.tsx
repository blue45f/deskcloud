import {
  createNewsletterMarkdown,
  createPipelineExportJson,
  createSnapshotRunbookMarkdown,
  createSourceMonitorCsv,
  curationMonitors,
  getSourceSnapshotCandidates,
  SNAPSHOT_DATE,
  updatePipeline,
  updates,
} from "@aidigestdesk/content";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  FileJson,
  FileText,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ComponentType } from "react";

import { SectionHeader, SegmentBar } from "@/components/app/CommonUi";

type ExportBundle = {
  id: string;
  title: string;
  metric: string;
  filename: string;
  mimeType: string;
  content: string;
  preview: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type ExportSortMode = "title" | "metric" | "filename";
type ExportSortDirection = "asc" | "desc";

function parseMetricCount(metric: string) {
  const match = metric.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function downloadTextFile(bundle: ExportBundle) {
  const blob = new Blob([bundle.content], {
    type: `${bundle.mimeType};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = bundle.filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

export function ExportDeskSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bundleQuery, setBundleQuery] = useState("");
  const [sortMode, setSortMode] = useState<ExportSortMode>("title");
  const [sortDirection, setSortDirection] =
    useState<ExportSortDirection>("asc");
  const snapshotCandidates = useMemo(() => getSourceSnapshotCandidates(), []);
  const exportBundles = useMemo<ExportBundle[]>(
    () => [
      {
        id: "newsletter",
        title: "뉴스레터 Markdown",
        metric: `${updates.length}개 업데이트`,
        filename: `aidigestdesk-newsletter-${SNAPSHOT_DATE}.md`,
        mimeType: "text/markdown",
        content: createNewsletterMarkdown(),
        preview: createNewsletterMarkdown({ maxUpdates: 2, maxBenchmarks: 2 }),
        icon: Clipboard,
      },
      {
        id: "source-monitor",
        title: "소스 모니터 CSV",
        metric: `${curationMonitors.length}개 모니터`,
        filename: `aidigestdesk-source-monitor-${SNAPSHOT_DATE}.csv`,
        mimeType: "text/csv",
        content: createSourceMonitorCsv(),
        preview: createSourceMonitorCsv().split("\n").slice(0, 4).join("\n"),
        icon: FileText,
      },
      {
        id: "pipeline-json",
        title: "편집 파이프라인 JSON",
        metric: `${updatePipeline.length}개 후보`,
        filename: `aidigestdesk-pipeline-${SNAPSHOT_DATE}.json`,
        mimeType: "application/json",
        content: createPipelineExportJson(),
        preview: createPipelineExportJson().split("\n").slice(0, 12).join("\n"),
        icon: FileJson,
      },
      {
        id: "snapshot-runbook",
        title: "스냅샷 Runbook",
        metric: `${snapshotCandidates.length}개 대상`,
        filename: `aidigestdesk-source-snapshot-runbook-${SNAPSHOT_DATE}.md`,
        mimeType: "text/markdown",
        content: createSnapshotRunbookMarkdown(snapshotCandidates),
        preview: createSnapshotRunbookMarkdown(snapshotCandidates)
          .split("\n")
          .slice(0, 10)
          .join("\n"),
        icon: Download,
      },
    ],
    [snapshotCandidates],
  );
  const sortFilters: Array<{ id: ExportSortMode; label: string }> = [
    { id: "title", label: "제목" },
    { id: "metric", label: "항목 수" },
    { id: "filename", label: "파일명" },
  ];
  const sortDirectionFilters: Array<{
    id: ExportSortDirection;
    label: string;
  }> = [
    { id: "asc", label: "오름차순" },
    { id: "desc", label: "내림차순" },
  ];

  const filteredBundles = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const normalizedQuery = bundleQuery.trim().toLocaleLowerCase("ko-KR");

    return exportBundles
      .filter((bundle) =>
        normalizedQuery
          ? `${bundle.title} ${bundle.metric} ${bundle.filename}`
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery)
          : true,
      )
      .toSorted((left, right) => {
        switch (sortMode) {
          case "title":
            return left.title.localeCompare(right.title) * direction;
          case "filename":
            return left.filename.localeCompare(right.filename) * direction;
          case "metric": {
            const leftMetric = parseMetricCount(left.metric);
            const rightMetric = parseMetricCount(right.metric);
            if (leftMetric === rightMetric) return 0;
            return (leftMetric - rightMetric) * direction;
          }
          default:
            return 0;
        }
      });
  }, [bundleQuery, exportBundles, sortDirection, sortMode]);

  const handleCopy = async (bundle: ExportBundle) => {
    const copied = await copyText(bundle.content).catch(() => false);
    setCopiedId(copied ? bundle.id : `${bundle.id}-failed`);
  };

  return (
    <section id="exports" className="space-y-4">
      <SectionHeader
        icon={Download}
        title="내보내기와 스냅샷 실행"
        description="포털 업데이트를 뉴스레터, 소스 점검표, 편집 파이프라인, 공식 소스 스냅샷 실행 계획으로 재사용합니다."
      />
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1fr_18rem_12rem_12rem]">
        <label className="block">
          <span className="text-xs font-semibold text-text-subtle">
            번들 검색
          </span>
          <input
            value={bundleQuery}
            onChange={(event) => setBundleQuery(event.target.value)}
            placeholder="뉴스레터, CSV, JSON, Runbook"
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
        </label>
        <SegmentBar
          label="정렬"
          items={sortFilters}
          value={sortMode}
          onChange={setSortMode}
        />
        <SegmentBar
          label="정렬 방향"
          items={sortDirectionFilters}
          value={sortDirection}
          onChange={setSortDirection}
        />
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">
            검색/정렬 결과
          </p>
          <p className="mt-1 text-lg font-semibold text-text">
            {filteredBundles.length}개
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {filteredBundles.map((bundle) => {
          const Icon = bundle.icon;
          const copied = copiedId === bundle.id;
          const failed = copiedId === `${bundle.id}-failed`;

          return (
            <article
              key={bundle.id}
              className="flex min-h-[20rem] min-w-0 flex-col rounded-lg border border-border bg-surface"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {bundle.title}
                  </p>
                  <p className="mt-1 text-xs text-text-subtle">
                    {bundle.metric}
                  </p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-bg text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <pre className="min-h-0 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-4 py-3 text-xs leading-5 text-text-muted">
                {bundle.preview}
              </pre>
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => downloadTextFile(bundle)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                >
                  <Download className="size-3.5" aria-hidden />
                  다운로드
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(bundle)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                >
                  {copied ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copied ? "복사됨" : failed ? "복사 실패" : "복사"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
