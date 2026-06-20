import {
  benchmarkEntries,
  curationMonitors,
  getProviderLabel,
  getSources,
  learningResources,
  SNAPSHOT_DATE,
  updatePipeline,
  updates,
  type BenchmarkEntry,
  type CurationMonitor,
  type LearningResource,
  type UpdateItem,
  type UpdatePipelineItem,
} from "./catalog";
import {
  getSourceSnapshotCandidates,
  type SourceSnapshotCandidate,
} from "./sourceSnapshots";

export type NewsletterExportOptions = {
  snapshotDate?: string;
  updateItems?: readonly UpdateItem[];
  benchmarkItems?: readonly BenchmarkEntry[];
  resourceItems?: readonly LearningResource[];
  maxUpdates?: number;
  maxBenchmarks?: number;
  maxResources?: number;
};

export function createNewsletterMarkdown({
  snapshotDate = SNAPSHOT_DATE,
  updateItems = updates,
  benchmarkItems = benchmarkEntries,
  resourceItems = learningResources,
  maxUpdates = 5,
  maxBenchmarks = 3,
  maxResources = 3,
}: NewsletterExportOptions = {}) {
  const referencedSourceIds = new Set<string>();
  const rememberSources = (sourceIds: readonly string[]) => {
    for (const sourceId of sourceIds) referencedSourceIds.add(sourceId);
  };

  const updateLines = updateItems
    .slice(0, maxUpdates)
    .flatMap((item, index) => {
      rememberSources(item.sourceIds);
      return [
        `### ${index + 1}. ${item.title}`,
        `- 제공사: ${getProviderLabel(item.providerId)}`,
        `- 요약: ${item.summary}`,
        `- 영향: ${item.impact}`,
        `- 원문: ${formatInlineSourceLinks(item.sourceIds)}`,
        "",
      ];
    });

  const benchmarkLines = benchmarkItems
    .slice(0, maxBenchmarks)
    .flatMap((entry) => {
      rememberSources(entry.sourceIds);
      return [
        `- ${entry.rankLabel} ${entry.modelName}: ${entry.metric} ${entry.score}, 가격 ${entry.price}, 속도 ${entry.speed}`,
      ];
    });

  const resourceLines = resourceItems
    .slice(0, maxResources)
    .flatMap((resource) => {
      rememberSources(resource.sourceIds);
      return [
        `- ${resource.title} - ${resource.author}, ${resource.language}, ${resource.level}`,
      ];
    });

  const sourceLines = [...referencedSourceIds].flatMap((sourceId) => {
    const source = getSources([sourceId])[0];
    if (!source) return [];
    return [`- ${source.publisher}: [${source.title}](${source.url})`];
  });

  return [
    `# AIDigestDesk 주간 AI 브리핑 (${snapshotDate})`,
    "",
    "## 핵심 업데이트",
    ...updateLines,
    "## 벤치마크 변화",
    ...benchmarkLines,
    "",
    "## 추천 학습 자료",
    ...resourceLines,
    "",
    "## 참고 링크",
    ...sourceLines,
    "",
  ].join("\n");
}

export function createSourceMonitorCsv(
  monitors: readonly CurationMonitor[] = curationMonitors,
) {
  const rows = monitors.map((monitor) => {
    const source = getSources([monitor.sourceId])[0];
    return [
      monitor.priority,
      monitor.sourceId,
      source?.publisher ?? "",
      source?.title ?? monitor.sourceId,
      source?.url ?? "",
      monitor.cadence,
      monitor.status,
      monitor.nextCheck,
      monitor.nextAction,
    ];
  });

  return [
    [
      "priority",
      "sourceId",
      "publisher",
      "title",
      "url",
      "cadence",
      "status",
      "nextCheck",
      "nextAction",
    ],
    ...rows,
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function createPipelineExportJson(
  pipelineItems: readonly UpdatePipelineItem[] = updatePipeline,
) {
  return JSON.stringify(
    {
      version: 1,
      snapshotDate: SNAPSHOT_DATE,
      items: pipelineItems.map((item) => ({
        ...item,
        sources: getSources(item.sourceIds).map((source) => ({
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
        })),
      })),
    },
    null,
    2,
  );
}

export function createSnapshotRunbookMarkdown(
  candidates: readonly SourceSnapshotCandidate[] = getSourceSnapshotCandidates(),
  snapshotDate = SNAPSHOT_DATE,
) {
  const candidateLines = candidates.map((candidate) => {
    return [
      `- [${candidate.priority}] ${candidate.source.publisher} - ${candidate.source.title}`,
      `  - URL: ${candidate.source.url}`,
      `  - 주기: ${candidate.cadence}, 다음 확인: ${candidate.nextCheck}`,
    ].join("\n");
  });

  return [
    `# 공식 소스 스냅샷 실행 계획 (${snapshotDate})`,
    "",
    `- 대상: ${candidates.length}개`,
    "- 명령: `pnpm --filter @aidigestdesk/content run snapshot:sources`",
    "- 결과 파일: `packages/content/data/source-snapshots.json`",
    "",
    "## 우선순위 큐",
    ...candidateLines,
    "",
  ].join("\n");
}

function formatInlineSourceLinks(sourceIds: readonly string[]) {
  const links = getSources(sourceIds).map(
    (source) => `[${source.publisher}](${source.url})`,
  );
  return links.length ? links.join(", ") : "출처 확인 필요";
}

function csvEscape(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
