import {
  getProviderLabel,
  getSources,
  movePipelineStage,
  runContentAudit,
  SNAPSHOT_DATE,
  type CurationMonitor,
  type FeatureBacklogItem,
  type PipelineStage,
  type ProviderId,
  type UpdatePipelineItem,
} from "@aidigestdesk/content";
import { CheckCircle2, ChevronLeft, ChevronRight, Gauge, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, SectionHeader } from "@/components/app/CommonUi";

const WORKBENCH_STORAGE_KEY = "aidigestdesk.editorWorkbench.v1";
const contentAudit = runContentAudit();

type SortDirection = "asc" | "desc";
type SourceSortMode = "priority" | "status" | "cadence" | "nextCheck" | "title";
type PipelineSortMode =
  | "priority"
  | "title"
  | "stage"
  | "status"
  | "provider";
type BacklogSortMode = "priority" | "status" | "title";
type CheckSortMode = "status" | "label";
type PipelineStatusFilter = "all" | "다음" | "진행 후보" | "나중" | "구현됨";
type PipelineStageFilter = "all" | PipelineStage;
type CurationPriorityFilter = "all" | "P0" | "P1" | "P2";
type PipelinePriorityFilter = "all" | "높음" | "보통" | "낮음";
type MonitorStatusFilter = "all" | "정상" | "확인 필요" | "자동화 후보";
type ProviderFilter = "all" | ProviderId | "market";

type SourceAuditCheckStatus = "all" | "pass" | "warn" | "fail";

const monitorStatusOrder: Record<CurationMonitor["status"], number> = {
  정상: 0,
  "확인 필요": 1,
  "자동화 후보": 2,
};

const curationPriorityOrder: Record<CurationMonitor["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const pipelinePriorityOrder: Record<UpdatePipelineItem["priority"], number> = {
  높음: 0,
  보통: 1,
  낮음: 2,
};

function getProviderText(providerId: ProviderId | "market" | "other") {
  return getProviderLabel(providerId) ?? providerId;
}

function toSourceTitle(sourceId: string) {
  return getSources([sourceId])[0]?.title ?? sourceId;
}

const pipelineStageOrder: Record<PipelineStage, number> = {
  수집: 0,
  검토: 1,
  "한국어 요약": 2,
  "게시 준비": 3,
  게시: 4,
};

function getSearchTerms(query: string) {
  return query
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function hasTerms(target: string, terms: string[]) {
  return terms.every((term) => target.includes(term));
}

function toggleDirection(direction: SortDirection) {
  return direction === "asc" ? "desc" : "asc";
}

type WorkbenchDraft = {
  stage: PipelineStage;
  note: string;
  updatedAt: string;
};

type WorkbenchStorage = {
  version: 1;
  drafts: Record<string, WorkbenchDraft>;
};

function getInitialWorkbenchDrafts(): Record<string, WorkbenchDraft> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(WORKBENCH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkbenchStorage>;
    return parsed.version === 1 && parsed.drafts ? parsed.drafts : {};
  } catch {
    return {};
  }
}

function saveWorkbenchDrafts(drafts: Record<string, WorkbenchDraft>) {
  if (typeof window === "undefined") return;
  const payload: WorkbenchStorage = { version: 1, drafts };
  window.localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(payload));
}

function statusClass(status: string) {
  switch (status) {
    case "정상":
    case "pass":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "확인 필요":
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "fail":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300";
  }
}

function priorityClass(priority: string) {
  switch (priority) {
    case "P0":
    case "높음":
      return "text-rose-700 dark:text-rose-300";
    case "P1":
    case "보통":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-text-subtle";
  }
}

export function EditorialOpsSection({
  monitors,
  pipelineItems,
  backlog,
}: {
  monitors: CurationMonitor[];
  pipelineItems: UpdatePipelineItem[];
  backlog: FeatureBacklogItem[];
}) {
  const [drafts, setDrafts] = useState(getInitialWorkbenchDrafts);
  const failedChecks = contentAudit.checks.filter(
    (check) => check.status === "fail",
  ).length;
  const warningChecks = contentAudit.checks.filter(
    (check) => check.status === "warn",
  ).length;

  const providerFilterValues = useMemo<ProviderFilter[]>(
    () => ["all", ...Array.from(new Set(monitors.map((item) => item.providerId)))] as ProviderFilter[],
    [monitors],
  );
  const [monitorQuery, setMonitorQuery] = useState("");
  const [monitorPriorityFilter, setMonitorPriorityFilter] =
    useState<CurationPriorityFilter>("all");
  const [monitorStatusFilter, setMonitorStatusFilter] =
    useState<MonitorStatusFilter>("all");
  const [monitorProviderFilter, setMonitorProviderFilter] =
    useState<ProviderFilter>("all");
  const [monitorSortMode, setMonitorSortMode] = useState<SourceSortMode>(
    "priority",
  );
  const [monitorSortDirection, setMonitorSortDirection] =
    useState<SortDirection>("desc");

  const [pipelineQuery, setPipelineQuery] = useState("");
  const [pipelinePriorityFilter, setPipelinePriorityFilter] =
    useState<PipelinePriorityFilter>("all");
  const [pipelineStageFilter, setPipelineStageFilter] =
    useState<PipelineStageFilter>("all");
  const [pipelineSortMode, setPipelineSortMode] = useState<PipelineSortMode>(
    "priority",
  );
  const [pipelineSortDirection, setPipelineSortDirection] =
    useState<SortDirection>("desc");

  const [backlogQuery, setBacklogQuery] = useState("");
  const [backlogPriorityFilter, setBacklogPriorityFilter] =
    useState<CurationPriorityFilter>("all");
  const [backlogStatusFilter, setBacklogStatusFilter] =
    useState<PipelineStatusFilter>("all");
  const [backlogSortMode, setBacklogSortMode] = useState<BacklogSortMode>(
    "priority",
  );
  const [backlogSortDirection, setBacklogSortDirection] =
    useState<SortDirection>("desc");

  const [checkQuery, setCheckQuery] = useState("");
  const [checkStatusFilter, setCheckStatusFilter] =
    useState<SourceAuditCheckStatus>("all");
  const [checkSortMode, setCheckSortMode] = useState<CheckSortMode>("status");
  const [checkSortDirection, setCheckSortDirection] =
    useState<SortDirection>("asc");

  const monitorTerms = useMemo(() => getSearchTerms(monitorQuery), [monitorQuery]);
  const pipelineTerms = useMemo(
    () => getSearchTerms(pipelineQuery),
    [pipelineQuery],
  );
  const backlogTerms = useMemo(() => getSearchTerms(backlogQuery), [backlogQuery]);
  const checkTerms = useMemo(() => getSearchTerms(checkQuery), [checkQuery]);

  const filteredMonitors = useMemo(
    () =>
      monitors
        .filter((monitor) => {
          if (monitorPriorityFilter !== "all" && monitor.priority !== monitorPriorityFilter) {
            return false;
          }
          if (monitorStatusFilter !== "all" && monitor.status !== monitorStatusFilter) {
            return false;
          }
          if (
            monitorProviderFilter !== "all" &&
            monitor.providerId !== monitorProviderFilter
          ) {
            return false;
          }
          const source = getSources([monitor.sourceId])[0];
          const searchable = [
            monitor.priority,
            monitor.cadence,
            monitor.status,
            monitor.nextAction,
            monitor.automationHint,
            source?.title ?? "",
            source?.publisher ?? "",
            monitor.nextCheck,
          ]
            .join(" ")
            .toLocaleLowerCase("ko-KR");
          return hasTerms(searchable, monitorTerms);
        })
        .toSorted((a, b) => {
          const direction = monitorSortDirection === "asc" ? 1 : -1;
          if (monitorSortMode === "priority") {
            const delta =
              curationPriorityOrder[a.priority] - curationPriorityOrder[b.priority];
            if (delta !== 0) return delta * direction;
          }
          if (monitorSortMode === "nextCheck") {
            return b.nextCheck.localeCompare(a.nextCheck, "ko") * direction;
          }
          if (monitorSortMode === "cadence") {
            return a.cadence.localeCompare(b.cadence, "ko") * direction;
          }
          if (monitorSortMode === "status") {
            const delta = monitorStatusOrder[a.status] - monitorStatusOrder[b.status];
            if (delta !== 0) return delta * direction;
          }
          const aSource = toSourceTitle(a.sourceId);
          const bSource = toSourceTitle(b.sourceId);
          return aSource.localeCompare(bSource, "ko") * direction;
        }),
    [
      monitorPriorityFilter,
      monitorProviderFilter,
      monitorSortDirection,
      monitorSortMode,
      monitorStatusFilter,
      monitorTerms,
      monitors,
    ],
  );

  const filteredChecks = useMemo(
    () =>
      contentAudit.checks
        .filter((check) =>
          checkStatusFilter === "all" ? true : check.status === checkStatusFilter,
        )
        .filter((check) =>
          hasTerms(
            `${check.label} ${check.detail} ${check.status}`.toLocaleLowerCase("ko-KR"),
            checkTerms,
          ),
        )
        .toSorted((a, b) => {
          const direction = checkSortDirection === "asc" ? 1 : -1;
          if (checkSortMode === "label") {
            return a.label.localeCompare(b.label, "ko") * direction;
          }
          if (a.status === b.status) {
            return a.label.localeCompare(b.label, "ko") * direction;
          }
          return a.status.localeCompare(b.status, "ko") * direction;
        }),
        [checkTerms, checkSortDirection, checkSortMode, checkStatusFilter],
  );

  const filteredPipelineItems = useMemo(
    () =>
      pipelineItems
        .filter((item) => {
          if (pipelinePriorityFilter !== "all" && item.priority !== pipelinePriorityFilter) {
            return false;
          }
          if (pipelineStageFilter !== "all" && item.stage !== pipelineStageFilter) {
            return false;
          }
          if (!pipelineTerms.length) return true;
          const sources = getSources(item.sourceIds)
            .map((source) => source.title)
            .join(" ");
          const provider = getProviderText(item.providerId);
          return hasTerms(
            `${item.title} ${item.summary} ${item.acceptance.join(" ")} ${item.stage} ${provider} ${sources}`.toLocaleLowerCase("ko-KR"),
            pipelineTerms,
          );
        })
        .toSorted((a, b) => {
          const direction = pipelineSortDirection === "asc" ? 1 : -1;
          if (pipelineSortMode === "priority") {
            const delta =
              pipelinePriorityOrder[a.priority] - pipelinePriorityOrder[b.priority];
            if (delta !== 0) return delta * direction;
          }
          if (pipelineSortMode === "stage") {
            const delta = pipelineStageOrder[a.stage] - pipelineStageOrder[b.stage];
            if (delta !== 0) return delta * direction;
          }
          if (pipelineSortMode === "provider") {
              return getProviderText(a.providerId).localeCompare(
                getProviderText(b.providerId),
                "ko",
              )
              * direction;
          }
          return a.title.localeCompare(b.title, "ko") * direction;
        }),
    [
      pipelineItems,
      pipelinePriorityFilter,
      pipelineStageFilter,
      pipelineSortDirection,
      pipelineSortMode,
      pipelineTerms,
    ],
  );

  const filteredBacklog = useMemo(
    () =>
      backlog
        .filter((item) => {
          if (backlogPriorityFilter !== "all" && item.priority !== backlogPriorityFilter) {
            return false;
          }
          if (backlogStatusFilter !== "all" && item.status !== backlogStatusFilter) {
            return false;
          }
          if (!backlogTerms.length) return true;
          return hasTerms(
            `${item.title} ${item.rationale} ${item.acceptance.join(" ")}`.toLocaleLowerCase("ko-KR"),
            backlogTerms,
          );
        })
        .toSorted((a, b) => {
          const direction = backlogSortDirection === "asc" ? 1 : -1;
          if (backlogSortMode === "priority") {
            const delta =
              curationPriorityOrder[a.priority] - curationPriorityOrder[b.priority];
            if (delta !== 0) return delta * direction;
          }
          if (backlogSortMode === "status") {
            const delta = a.status.localeCompare(b.status, "ko");
            if (delta !== 0) return delta * direction;
          }
          return a.title.localeCompare(b.title, "ko") * direction;
        }),
    [
      backlog,
      backlogPriorityFilter,
      backlogStatusFilter,
      backlogSortDirection,
      backlogSortMode,
      backlogTerms,
    ],
  );

  useEffect(() => {
    saveWorkbenchDrafts(drafts);
  }, [drafts]);

  const updateDraft = (
    item: UpdatePipelineItem,
    patch: Partial<Pick<WorkbenchDraft, "stage" | "note">>,
  ) => {
    setDrafts((current) => {
      const previous = current[item.id] ?? {
        stage: item.stage,
        note: "",
        updatedAt: SNAPSHOT_DATE,
      };

      return {
        ...current,
        [item.id]: {
          ...previous,
          ...patch,
          updatedAt: new Date().toISOString().slice(0, 10),
        },
      };
    });
  };

  const resetDraft = (item: UpdatePipelineItem) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  };

  return (
    <section id="ops" className="space-y-4">
      <SectionHeader
        icon={Gauge}
        title="편집실과 자동화 준비"
        description="포털을 최신 상태로 유지하기 위한 출처 모니터링, 업데이트 후보, 다음 기능 백로그를 운영 화면처럼 정리했습니다."
      />

      <article className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-text">
              소스 모니터링 큐
            </h3>
            <p className="mt-1 text-xs text-text-subtle">
              변동성이 높은 공식 문서와 벤치마크를 우선순위별로 확인합니다.
            </p>
          </div>
          <span className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-subtle">
            {filteredMonitors.length}개 소스
          </span>
        </div>

        <div className="grid gap-2 border-b border-border bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-text-subtle">검색</span>
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={monitorQuery}
                onChange={(event) => setMonitorQuery(event.target.value)}
                placeholder="출처명, 액션, 자동화 힌트"
                className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
              />
            </span>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">우선순위</span>
            <select
              value={monitorPriorityFilter}
              onChange={(event) =>
                    setMonitorPriorityFilter(
                      event.target.value as CurationPriorityFilter,
                    )
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="all">전체</option>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">상태</span>
            <select
              value={monitorStatusFilter}
              onChange={(event) =>
                setMonitorStatusFilter(event.target.value as MonitorStatusFilter)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="all">전체</option>
              <option value="정상">정상</option>
              <option value="확인 필요">확인 필요</option>
              <option value="자동화 후보">자동화 후보</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">제공사</span>
            <select
              value={monitorProviderFilter}
              onChange={(event) =>
                setMonitorProviderFilter(event.target.value as ProviderFilter)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              {providerFilterValues.map((provider) => (
                <option key={provider} value={provider}>
                      {provider === "all" ? "전체" : getProviderText(provider)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">정렬</span>
            <select
              value={monitorSortMode}
              onChange={(event) =>
                setMonitorSortMode(event.target.value as SourceSortMode)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="priority">우선순위</option>
              <option value="status">상태</option>
              <option value="cadence">수집 주기</option>
              <option value="nextCheck">다음 확인</option>
              <option value="title">출처명</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setMonitorSortDirection(toggleDirection(monitorSortDirection))
              }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
            >
              방향 {monitorSortDirection === "asc" ? "올림" : "내림"}
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredMonitors.length ? (
            filteredMonitors.map((monitor) => {
              const source = getSources([monitor.sourceId])[0];
              return (
                <div
                  key={monitor.id}
                  className="grid gap-3 px-4 py-3 lg:grid-cols-[8rem_1fr_8rem]"
                >
                  <div>
                    <p
                      className={`text-xs font-semibold ${priorityClass(monitor.priority)}`}
                    >
                      {monitor.priority}
                    </p>
                    <p className="mt-1 text-xs text-text-subtle">
                      {monitor.cadence}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {source?.title ?? monitor.sourceId}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      {monitor.nextAction}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-subtle">
                      {monitor.automationHint}
                    </p>
                  </div>
                  <div className="flex items-start justify-between gap-2 lg:block lg:text-right">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(monitor.status)}`}
                    >
                      {monitor.status}
                    </span>
                    <p className="mt-0 text-xs text-text-subtle lg:mt-2">
                      {monitor.nextCheck}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4">
              <EmptyState
                title="조건에 맞는 모니터링 항목이 없습니다"
                body="검색어나 필터를 완화하면 운영 항목을 볼 수 있습니다."
              />
            </div>
          )}
        </div>
      </article>

      <article className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text">콘텐츠 품질 게이트</h3>
          <p className="mt-1 text-xs leading-5 text-text-subtle">
            실패 {failedChecks}개 · 주의 {warningChecks}개 · 통과{" "}
            {contentAudit.checks.length - failedChecks - warningChecks}개
          </p>
        </div>
        <div className="grid gap-2 border-b border-border bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-text-subtle">검색</span>
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={checkQuery}
                onChange={(event) => setCheckQuery(event.target.value)}
                placeholder="점검 항목명, 상세"
                className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
              />
            </span>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">
              상태
            </span>
            <select
              value={checkStatusFilter}
              onChange={(event) =>
                setCheckStatusFilter(event.target.value as SourceAuditCheckStatus)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="all">전체</option>
              <option value="pass">pass</option>
              <option value="warn">warn</option>
              <option value="fail">fail</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-text-subtle">정렬</span>
            <select
              value={checkSortMode}
              onChange={(event) =>
                setCheckSortMode(event.target.value as CheckSortMode)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="status">상태</option>
              <option value="label">항목명</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setCheckSortDirection(toggleDirection(checkSortDirection))
              }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
            >
              방향 {checkSortDirection === "asc" ? "올림" : "내림"}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2 px-4 pb-4">
          {filteredChecks.map((check) => (
            <div
              key={check.id}
              className="rounded-md border border-border bg-bg p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text">
                  {check.label}
                </p>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${statusClass(check.status)}`}
                >
                  {check.status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-text-subtle">
                {check.detail}
              </p>
            </div>
          ))}
          {!filteredChecks.length ? (
            <EmptyState
              title="조건에 맞는 품질 체크 항목이 없습니다"
              body="검색어/상태 필터를 줄이면 다시 확인할 수 있습니다."
            />
          ) : null}
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text">
              업데이트 후보 파이프라인
            </h3>
            <p className="mt-1 text-xs text-text-subtle">
              자동 수집 전에도 어떤 정보가 어떤 단계에 있는지 추적합니다.
            </p>
          </div>
          <div className="grid gap-2 border-b border-border bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-text-subtle">검색</span>
              <span className="relative mt-2 block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
                <input
                  value={pipelineQuery}
                  onChange={(event) => setPipelineQuery(event.target.value)}
                  placeholder="제목, 요약, acceptance"
                  className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                />
              </span>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">우선순위</span>
              <select
                value={pipelinePriorityFilter}
                onChange={(event) =>
                  setPipelinePriorityFilter(
                    event.target.value as PipelinePriorityFilter,
                  )
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="all">전체</option>
                <option value="높음">높음</option>
                <option value="보통">보통</option>
                <option value="낮음">낮음</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">단계</span>
              <select
                value={pipelineStageFilter}
                onChange={(event) =>
                  setPipelineStageFilter(
                    event.target.value as PipelineStageFilter,
                  )
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="all">전체</option>
                <option value="수집">수집</option>
                <option value="검토">검토</option>
                <option value="한국어 요약">한국어 요약</option>
                <option value="게시 준비">게시 준비</option>
                <option value="게시">게시</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">정렬</span>
              <select
                value={pipelineSortMode}
                onChange={(event) =>
                  setPipelineSortMode(event.target.value as PipelineSortMode)
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="priority">우선순위</option>
                <option value="title">제목</option>
                <option value="stage">단계</option>
                <option value="status">우선도</option>
                <option value="provider">제공사</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setPipelineSortDirection(toggleDirection(pipelineSortDirection))
                }
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
              >
                방향 {pipelineSortDirection === "asc" ? "올림" : "내림"}
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {filteredPipelineItems.length ? (
              filteredPipelineItems.map((item) => {
                const draft = drafts[item.id];
                const currentStage = draft?.stage ?? item.stage;
                const note = draft?.note ?? "";

                return (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-text-subtle">
                          {getProviderText(item.providerId)} · 원본{" "}
                          {item.stage}
                          {draft ? ` · 수정 ${draft.updatedAt}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-text-muted">
                      {item.summary}
                    </p>
                    <div className="mt-3 rounded-md border border-border bg-bg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text">
                          {currentStage}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(item, {
                                stage: movePipelineStage(
                                  currentStage,
                                  "previous",
                                ),
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                          >
                            <ChevronLeft className="size-3.5" aria-hidden />
                            이전
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(item, {
                                stage: movePipelineStage(currentStage, "next"),
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                          >
                            다음
                            <ChevronRight className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetDraft(item)}
                            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-subtle transition hover:text-text"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-xs font-semibold text-text-subtle">
                          편집 메모
                        </span>
                        <textarea
                          value={note}
                          onChange={(event) =>
                            updateDraft(item, { note: event.target.value })
                          }
                          placeholder="원문 확인, 번역 기준, 게시 전 체크 포인트"
                          className="mt-1 min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                        />
                      </label>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {item.acceptance.slice(0, 2).map((line) => (
                        <li
                          key={line}
                          className="flex gap-2 text-xs leading-5 text-text-subtle"
                        >
                          <CheckCircle2
                            className="mt-0.5 size-3.5 shrink-0 text-accent"
                            aria-hidden
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : (
              <div className="p-4">
                <EmptyState
                  title="조건에 맞는 업데이트 후보가 없습니다"
                  body="필터를 완화하면 후보를 확인할 수 있습니다."
                />
              </div>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text">다음 기능 제안</h3>
            <p className="mt-1 text-xs text-text-subtle">
              포털 완성도를 계속 올리기 위한 우선순위와 완료 기준입니다.
            </p>
            <div className="text-xs mt-2 text-text-subtle">
              {filteredBacklog.length}개 항목
            </div>
          </div>
          <div className="grid gap-2 border-b border-border bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-text-subtle">검색</span>
              <span className="relative mt-2 block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
                <input
                  value={backlogQuery}
                  onChange={(event) => setBacklogQuery(event.target.value)}
                  placeholder="기능명, 완료 기준"
                  className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                />
              </span>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">우선순위</span>
              <select
                value={backlogPriorityFilter}
                onChange={(event) =>
                  setBacklogPriorityFilter(
                    event.target.value as CurationPriorityFilter,
                  )
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="all">전체</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">상태</span>
              <select
                value={backlogStatusFilter}
                onChange={(event) =>
                  setBacklogStatusFilter(
                    event.target.value as PipelineStatusFilter,
                  )
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="all">전체</option>
                <option value="다음">다음</option>
                <option value="진행 후보">진행 후보</option>
                <option value="나중">나중</option>
                <option value="구현됨">구현됨</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-text-subtle">정렬</span>
              <select
                value={backlogSortMode}
                onChange={(event) =>
                  setBacklogSortMode(event.target.value as BacklogSortMode)
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="priority">우선순위</option>
                <option value="status">상태</option>
                <option value="title">제목</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setBacklogSortDirection(toggleDirection(backlogSortDirection))
                }
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
              >
                방향 {backlogSortDirection === "asc" ? "올림" : "내림"}
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {filteredBacklog.length ? (
              filteredBacklog.map((item) => (
                <div key={item.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-text-subtle">
                        {item.status}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${priorityClass(item.priority)}`}
                    >
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-text-muted">
                    {item.rationale}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-text-subtle">
                    완료 기준: {item.acceptance[0]}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4">
                <EmptyState
                  title="조건에 맞는 기능 제안이 없습니다"
                  body="필터를 바꾸면 우선순위 후보를 다시 볼 수 있습니다."
                />
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
