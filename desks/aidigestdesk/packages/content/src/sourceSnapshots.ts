import {
  curationMonitors,
  sources,
  type CurationMonitor,
  type SourceRef,
} from "./catalog";

export type SourceSnapshotStatus = "new" | "unchanged" | "changed" | "failed";

export type SourceSnapshotCandidate = {
  source: SourceRef;
  priority: CurationMonitor["priority"];
  cadence: CurationMonitor["cadence"];
  nextCheck: string;
  monitorStatus: CurationMonitor["status"];
  automationHint: string;
};

export type SourceSnapshotRecord = {
  sourceId: string;
  title: string;
  publisher: string;
  kind: SourceRef["kind"];
  url: string;
  priority: CurationMonitor["priority"];
  checkedAt: string;
  status: SourceSnapshotStatus;
  changed: boolean;
  contentHash?: string;
  previousHash?: string;
  statusCode?: number;
  contentType?: string;
  byteLength?: number;
  excerpt?: string;
  error?: string;
};

export type SourceSnapshotStore = {
  version: 1;
  generatedAt: string;
  records: SourceSnapshotRecord[];
};

export type SourceSnapshotSummary = {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  failed: number;
};

export type SourceSnapshotFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type SnapshotSourcesOptions = {
  sourceItems?: readonly SourceRef[];
  monitors?: readonly CurationMonitor[];
  previous?: SourceSnapshotStore | readonly SourceSnapshotRecord[];
  fetcher?: SourceSnapshotFetch;
  now?: string;
  timeoutMs?: number;
  maxExcerptLength?: number;
  sourceIds?: readonly string[];
  requestInit?: RequestInit;
};

const priorityRank: Record<CurationMonitor["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const defaultCadence: CurationMonitor["cadence"] = "월 1회";

export function getSourceSnapshotCandidates(
  sourceItems: readonly SourceRef[] = sources,
  monitors: readonly CurationMonitor[] = curationMonitors,
): SourceSnapshotCandidate[] {
  const monitorBySourceId = new Map(
    monitors.map((monitor) => [monitor.sourceId, monitor]),
  );

  return sourceItems
    .filter((source) => {
      return (
        monitorBySourceId.has(source.id) ||
        source.kind === "official" ||
        source.kind === "benchmark"
      );
    })
    .map((source): SourceSnapshotCandidate => {
      const monitor = monitorBySourceId.get(source.id);

      return {
        source,
        priority: monitor?.priority ?? "P2",
        cadence: monitor?.cadence ?? defaultCadence,
        nextCheck: monitor?.nextCheck ?? source.lastChecked,
        monitorStatus: monitor?.status ?? "자동화 후보",
        automationHint:
          monitor?.automationHint ??
          "등록된 출처 본문을 스냅샷하고 해시 변화가 있으면 업데이트 후보로 보냅니다.",
      };
    })
    .toSorted((a, b) => {
      const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      const publisherDelta = a.source.publisher.localeCompare(
        b.source.publisher,
        "ko",
      );
      if (publisherDelta !== 0) return publisherDelta;
      return a.source.title.localeCompare(b.source.title, "ko");
    });
}

export function createContentFingerprint(content: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const character of content) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}

export function normalizeSnapshotText(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

export function createSourceSnapshotStore(
  records: readonly SourceSnapshotRecord[],
  generatedAt = new Date().toISOString(),
): SourceSnapshotStore {
  return {
    version: 1,
    generatedAt,
    records: [...records],
  };
}

export function summarizeSnapshotRecords(
  records: readonly SourceSnapshotRecord[],
): SourceSnapshotSummary {
  return records.reduce<SourceSnapshotSummary>(
    (summary, record) => {
      summary.total += 1;
      summary[record.status] += 1;
      return summary;
    },
    { total: 0, new: 0, changed: 0, unchanged: 0, failed: 0 },
  );
}

export async function snapshotSources(
  options: SnapshotSourcesOptions = {},
): Promise<SourceSnapshotRecord[]> {
  const checkedAt = options.now ?? new Date().toISOString();
  const maxExcerptLength = options.maxExcerptLength ?? 280;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const selectedSourceIds = new Set(options.sourceIds ?? []);
  const previousBySourceId = createPreviousRecordMap(options.previous);
  const fetcher = options.fetcher ?? getGlobalFetch();
  const candidates = getSourceSnapshotCandidates(
    options.sourceItems,
    options.monitors,
  ).filter((candidate) => {
    return (
      selectedSourceIds.size === 0 || selectedSourceIds.has(candidate.source.id)
    );
  });

  if (!fetcher) {
    throw new Error("fetch is not available in this runtime");
  }

  return Promise.all(
    candidates.map((candidate) =>
      fetchSnapshotCandidate({
        candidate,
        checkedAt,
        fetcher,
        maxExcerptLength,
        previous: previousBySourceId.get(candidate.source.id),
        requestInit: options.requestInit,
        timeoutMs,
      }),
    ),
  );
}

function createPreviousRecordMap(
  previous?: SourceSnapshotStore | readonly SourceSnapshotRecord[],
): Map<string, SourceSnapshotRecord> {
  if (!previous) return new Map();
  const records = "records" in previous ? previous.records : previous;
  return new Map(records.map((record) => [record.sourceId, record]));
}

function getGlobalFetch(): SourceSnapshotFetch | undefined {
  if (typeof globalThis.fetch !== "function") return undefined;
  return (url, init) => globalThis.fetch(url, init);
}

async function fetchSnapshotCandidate({
  candidate,
  checkedAt,
  fetcher,
  maxExcerptLength,
  previous,
  requestInit,
  timeoutMs,
}: {
  candidate: SourceSnapshotCandidate;
  checkedAt: string;
  fetcher: SourceSnapshotFetch;
  maxExcerptLength: number;
  previous?: SourceSnapshotRecord;
  requestInit?: RequestInit;
  timeoutMs: number;
}): Promise<SourceSnapshotRecord> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const previousHash = previous?.contentHash;
  const baseRecord = {
    sourceId: candidate.source.id,
    title: candidate.source.title,
    publisher: candidate.source.publisher,
    kind: candidate.source.kind,
    url: candidate.source.url,
    priority: candidate.priority,
    checkedAt,
    previousHash,
  };

  try {
    const response = await fetcher(candidate.source.url, {
      ...requestInit,
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
        ...requestInit?.headers,
      },
      redirect: requestInit?.redirect ?? "follow",
      signal: controller.signal,
    });
    const content = await response.text();
    const normalized = normalizeSnapshotText(content);

    if (!response.ok) {
      return {
        ...baseRecord,
        status: "failed",
        changed: false,
        statusCode: response.status,
        contentType: response.headers.get("content-type") ?? undefined,
        byteLength: content.length,
        excerpt: normalized.slice(0, maxExcerptLength),
        error: formatHttpError(response),
      };
    }

    const contentHash = createContentFingerprint(normalized);
    const changed = previousHash ? previousHash !== contentHash : true;

    return {
      ...baseRecord,
      status: previousHash ? (changed ? "changed" : "unchanged") : "new",
      changed,
      contentHash,
      statusCode: response.status,
      contentType: response.headers.get("content-type") ?? undefined,
      byteLength: content.length,
      excerpt: normalized.slice(0, maxExcerptLength),
    };
  } catch (error) {
    return {
      ...baseRecord,
      status: "failed",
      changed: false,
      error: error instanceof Error ? error.message : "Unknown snapshot error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatHttpError(response: Response) {
  const statusText = response.statusText.trim();
  return statusText
    ? `HTTP ${response.status} ${statusText}`
    : `HTTP ${response.status}`;
}
