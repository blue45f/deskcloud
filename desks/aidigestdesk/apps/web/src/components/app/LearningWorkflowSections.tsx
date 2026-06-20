import {
  benchmarkEntries,
  getModelById,
  getProviderLabel,
  type ProviderId,
  type ManualGuide,
  type ModelProfile,
  type PersonaGuide,
  updates,
} from "@aidigestdesk/content";
import {
  CheckCircle2,
  CircleHelp,
  Palette,
  Search,
  SortAsc,
  SortDesc,
  Users,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { EmptyState, SectionHeader } from "@/components/app/CommonUi";

type SortDirection = "asc" | "desc";
type DesignSortMode = "date" | "title" | "provider" | "summary";
type PptSortMode = "provider" | "model" | "score" | "metric";
type GuideSortMode = "provider" | "level" | "title" | "sources";
type ManualGuideLevel = "all" | "입문" | "실무" | "고급";
type UpdateProviderFilter = "all" | ProviderId | "market";
type GuideProviderFilter = "all" | ProviderId;
type PersonaSortMode = "role" | "title" | "provider";
type PersonaRoleFilter = "all" | "개발자" | "PM" | "마케터" | "리서처" | "기타";

function getSearchTerms(query: string) {
  return query
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isTermMatch(target: string, terms: string[]) {
  return terms.every((term) => target.includes(term));
}

function parseNumeric(raw: string) {
  const match = raw.replace(/,/g, "").trim().match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function sortDirectionIcon(direction: SortDirection) {
  return direction === "asc" ? (
    <SortAsc className="size-3" aria-hidden />
  ) : (
    <SortDesc className="size-3" aria-hidden />
  );
}

function getPersonaRoleLabel(role: string) {
  if (role.includes("PM")) return "PM";
  if (role.includes("리서")) return "리서처";
  if (role.includes("마케팅") || role.includes("마케터")) return "마케터";
  return role.includes("개발") ? "개발자" : "기타";
}

function getSafeProviderLabel(providerId: ProviderId | "market" | "other") {
  return getProviderLabel(providerId) ?? providerId;
}

function getDesignTargets(item: (typeof updates)[number]) {
  return [
    item.title,
    item.summary,
    item.impact,
    item.date,
    item.id,
  ]
    .join(" ")
    .toLocaleLowerCase("ko-KR");
}

export function DesignWorkflowSection() {
  const allDesignUpdates = updates.filter((item) => item.category === "design");
  const designProviders = useMemo<Array<UpdateProviderFilter>>(
    () => ["all", ...Array.from(new Set(allDesignUpdates.map((item) => item.providerId)))],
    [allDesignUpdates],
  );
  const [designQuery, setDesignQuery] = useState("");
  const [designProviderFilter, setDesignProviderFilter] =
    useState<UpdateProviderFilter>("all");
  const [designSortMode, setDesignSortMode] =
    useState<DesignSortMode>("date");
  const [designSortDirection, setDesignSortDirection] =
    useState<SortDirection>("desc");
  const [pptSortMode, setPptSortMode] = useState<PptSortMode>("score");
  const [pptSortDirection, setPptSortDirection] =
    useState<SortDirection>("desc");

  const deferredDesignQuery = useDeferredValue(designQuery);
  const designSearchTerms = useMemo(
    () => getSearchTerms(deferredDesignQuery),
    [deferredDesignQuery],
  );
  const designUpdates = useMemo(
    () =>
      allDesignUpdates
        .filter((item) =>
          designProviderFilter === "all"
            ? true
            : item.providerId === designProviderFilter,
        )
        .filter((item) =>
          isTermMatch(getDesignTargets(item), designSearchTerms),
        )
        .toSorted((a, b) => {
          const direction = designSortDirection === "asc" ? 1 : -1;
          if (designSortMode === "date") {
            return a.date.localeCompare(b.date) * direction;
          }
          if (designSortMode === "title") {
            return a.title.localeCompare(b.title, "ko") * direction;
          }
          if (designSortMode === "provider") {
            return getSafeProviderLabel(a.providerId).localeCompare(
              getSafeProviderLabel(b.providerId),
              "ko",
            ) * direction;
          }
          return a.summary.localeCompare(b.summary, "ko") * direction;
        }),
    [allDesignUpdates, designProviderFilter, designSearchTerms, designSortDirection, designSortMode],
  );

  const sortedPptSignals = useMemo(
    () =>
      benchmarkEntries
        .filter((entry) => entry.domain === "ppt")
        .toSorted((a, b) => {
          const direction = pptSortDirection === "asc" ? 1 : -1;
          if (pptSortMode === "provider") {
            return (
              getSafeProviderLabel(a.providerId).localeCompare(
              getSafeProviderLabel(b.providerId),
                "ko",
              ) * direction
            );
          }
          if (pptSortMode === "model") {
            return a.modelName.localeCompare(b.modelName, "ko") * direction;
          }
          if (pptSortMode === "metric") {
            return a.metric.localeCompare(b.metric, "ko") * direction;
          }
          const scoreA = parseNumeric(a.score) ?? 0;
          const scoreB = parseNumeric(b.score) ?? 0;
          const diff = scoreA - scoreB;
          if (diff !== 0) return diff * direction;
          return a.rankLabel.localeCompare(b.rankLabel, "ko") * direction;
        }),
    [pptSortDirection, pptSortMode],
  );

  return (
    <section id="design" className="space-y-4">
      <SectionHeader
        icon={Palette}
        title="디자인/PPT 산출물 비교"
        description="PPT, 웹진, 문서 기반 산출물은 모델 점수보다 입력 자료 처리, 에이전트 실행, 검수 흐름을 기준으로 비교합니다."
      />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-accent">작업 흐름</p>
            <span className="text-xs font-semibold text-text-subtle">
              {designUpdates.length}개
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-text">
            AI 웹진·PPT 제작 워크플로
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Manus는 태스크형 제작, Gemini는 영상/PDF/이미지 이해, Mistral은
            OCR과 자체 배포 가능성, GPT/Claude는 문안과 구조화 검수에 강점을
            둡니다.
          </p>
          <div className="mt-4 space-y-2 rounded-md border border-border bg-bg/60 p-3">
            <div className="block">
              <span className="text-xs font-semibold text-text-subtle">
                검색/정렬
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="relative grow">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
                  <input
                    value={designQuery}
                    onChange={(event) => setDesignQuery(event.target.value)}
                    placeholder="제목, 요약, 날짜, 라벨"
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 py-2 pl-9 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                  />
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDesignSortDirection(
                      designSortDirection === "asc" ? "desc" : "asc",
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
                >
                  방향 {sortDirectionIcon(designSortDirection)}
                </button>
              </div>
            </div>
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-text-subtle">
                  제공사
                </span>
                <select
                  value={designProviderFilter}
                  onChange={(event) =>
                    setDesignProviderFilter(
                      event.target.value as UpdateProviderFilter,
                    )
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
                >
                  {designProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider === "all"
                        ? "전체"
                        : getSafeProviderLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-text-subtle">
                  정렬
                </span>
                <select
                  value={designSortMode}
                  onChange={(event) =>
                    setDesignSortMode(event.target.value as DesignSortMode)
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
                >
                  <option value="date">날짜</option>
                  <option value="title">제목</option>
                  <option value="provider">제공사</option>
                  <option value="summary">요약</option>
                </select>
              </label>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {designUpdates.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text-muted"
              >
                <span className="font-semibold text-text">{item.title}</span>
                <div className="mt-1 text-text-subtle">
                  {item.date} · {getSafeProviderLabel(item.providerId)}
                </div>
                <p className="mt-1">{item.summary}</p>
              </li>
            ))}
            {!designUpdates.length ? (
              <EmptyState
                title="조건에 맞는 설계 항목이 없습니다"
                body="조건을 완화하면 항목이 표시됩니다."
              />
            ) : null}
          </ul>
        </article>

        <article className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text">
                PPT/문서 분야 운영 지표
              </h3>
              <span className="text-xs font-semibold text-text-subtle">
                {sortedPptSignals.length}개
              </span>
            </div>
            <p className="mt-1 text-xs text-text-subtle">
              정량 벤치마크가 아닌 공식 기능·운영 신호는 metric으로 구분합니다.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setPptSortDirection(
                    pptSortDirection === "asc" ? "desc" : "asc",
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-subtle transition hover:text-text md:col-span-1"
              >
                방향 {sortDirectionIcon(pptSortDirection)}
              </button>
              <label className="block md:col-span-1">
                <span className="text-xs font-semibold text-text-subtle">정렬</span>
                <select
                  value={pptSortMode}
                  onChange={(event) =>
                    setPptSortMode(event.target.value as PptSortMode)
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
                >
                  <option value="score">점수</option>
                  <option value="provider">제공사</option>
                  <option value="model">모델</option>
                  <option value="metric">메트릭</option>
                </select>
              </label>
            </div>
          </div>
          <div className="divide-y divide-border">
            {sortedPptSignals.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_7rem]"
              >
                <span className="text-xs font-semibold text-accent">
                  {getSafeProviderLabel(entry.providerId)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text">
                    {entry.modelName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    {entry.metric} · {entry.context}
                  </p>
                </div>
                <span className="text-right text-xs font-semibold text-text-subtle">
                  {entry.score}
                </span>
              </div>
            ))}
            {!sortedPptSignals.length ? (
              <EmptyState
                title="조건에 맞는 PPT 지표가 없습니다"
                body="정렬 조건 또는 카테고리를 조정해 다시 검색해 보세요."
              />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

export function ManualGuides({ guides }: { guides: ManualGuide[] }) {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] =
    useState<GuideProviderFilter>("all");
  const [levelFilter, setLevelFilter] =
    useState<"all" | ManualGuideLevel>("all");
  const [sortMode, setSortMode] = useState<GuideSortMode>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const deferredQuery = useDeferredValue(query);
  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);
  const providers = useMemo<Array<GuideProviderFilter>>(
    () => ["all", ...Array.from(new Set(guides.map((guide) => guide.providerId)))] ,
    [guides],
  );

  const visibleGuides = useMemo(
    () =>
      guides
        .filter((guide) =>
          providerFilter === "all" ? true : guide.providerId === providerFilter,
        )
        .filter((guide) =>
          levelFilter === "all" ? true : guide.level === levelFilter,
        )
        .filter((guide) =>
          isTermMatch(
            [
              guide.title,
              guide.summary,
              guide.level,
              getSafeProviderLabel(guide.providerId),
            ]
              .join(" ")
              .toLocaleLowerCase("ko-KR"),
            searchTerms,
          ),
        )
        .toSorted((a, b) => {
          const direction = sortDirection === "asc" ? 1 : -1;
          if (sortMode === "title") {
            return a.title.localeCompare(b.title, "ko") * direction;
          }
          if (sortMode === "provider") {
            return getSafeProviderLabel(a.providerId).localeCompare(
              getSafeProviderLabel(b.providerId),
              "ko",
            ) * direction;
          }
          if (sortMode === "level") {
            return a.level.localeCompare(b.level, "ko") * direction;
          }
          return (a.sourceIds.length - b.sourceIds.length) * direction;
        }),
    [guides, levelFilter, providerFilter, searchTerms, sortDirection, sortMode],
  );

  return (
    <section id="manuals" className="space-y-4">
      <SectionHeader
        icon={CircleHelp}
        title="사용법 비교"
        description="제품별 문법보다 실무 의사결정과 오류 처리 흐름을 우선 정리했습니다."
      />
      <div className="grid gap-2 rounded-md border border-border bg-surface/70 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2">
          <span className="text-xs font-semibold text-text-subtle">검색</span>
          <span className="relative mt-2 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="매뉴얼 제목, 개요, 제공사"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
            />
          </span>
        </label>
        <label>
          <span className="text-xs font-semibold text-text-subtle">제공사</span>
          <select
                value={providerFilter}
                onChange={(event) =>
              setProviderFilter(event.target.value as GuideProviderFilter)
                }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider === "all" ? "전체" : getSafeProviderLabel(provider)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-text-subtle">수준</span>
          <select
            value={levelFilter}
            onChange={(event) =>
              setLevelFilter(event.target.value as ManualGuideLevel)
            }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            <option value="all">전체</option>
            <option value="입문">입문</option>
            <option value="실무">실무</option>
            <option value="고급">고급</option>
          </select>
        </label>
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-text-subtle">정렬</span>
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as GuideSortMode)
            }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            <option value="title">제목</option>
            <option value="provider">제공사</option>
            <option value="level">난이도</option>
            <option value="sources">자료 수</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() =>
              setSortDirection(sortDirection === "asc" ? "desc" : "asc")
            }
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
          >
            방향 {sortDirectionIcon(sortDirection)}
          </button>
          <span className="whitespace-nowrap text-xs font-semibold text-text-subtle">
            {visibleGuides.length}개
          </span>
        </div>
      </div>

      {visibleGuides.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleGuides.map((guide) => (
            <article
              key={guide.id}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-accent">
                  {getSafeProviderLabel(guide.providerId)}
                </span>
                <span className="rounded-md border border-border bg-bg px-2 py-1 text-xs font-semibold text-text-subtle">
                  {guide.level}
                </span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-text">
                {guide.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                {guide.summary}
              </p>
              <ol className="mt-4 space-y-2">
                {guide.steps.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-3 text-xs leading-5 text-text-muted"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-ink text-[0.6875rem] font-semibold text-ink-fg">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 사용법 항목이 없습니다"
          body="검색/필터를 완화하면 항목이 표시됩니다."
        />
      )}
    </section>
  );
}

export function PersonaPlaybooks({ guides }: { guides: PersonaGuide[] }) {
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] =
    useState<GuideProviderFilter>("all");
  const [roleFilter, setRoleFilter] =
    useState<PersonaRoleFilter>("all");
  const [sortMode, setSortMode] = useState<PersonaSortMode>("role");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const deferredQuery = useDeferredValue(query);
  const searchTerms = useMemo(() => getSearchTerms(deferredQuery), [deferredQuery]);
  const providers = useMemo<Array<GuideProviderFilter>>(
    () => [
      "all",
      ...new Set(guides.flatMap((guide) => guide.providerIds)),
    ],
    [guides],
  );
  const roleFilters = useMemo<Array<PersonaRoleFilter>>(() => {
    const mapped = new Set<PersonaRoleFilter>(["기타"]);
    guides.forEach((guide) => {
      mapped.add(getPersonaRoleLabel(guide.role) as PersonaRoleFilter);
    });
    return ["all", ...mapped];
  }, [guides]);

  const visibleGuides = useMemo(
    () =>
      guides
        .filter((guide) => {
          const personaRole = getPersonaRoleLabel(guide.role);
          if (roleFilter !== "all" && personaRole !== roleFilter) return false;
          if (
            providerFilter !== "all" &&
            !guide.providerIds.includes(providerFilter)
          ) {
            return false;
          }
          if (!searchTerms.length) return true;
          return isTermMatch(
            [
              guide.title,
              guide.role,
              guide.summary,
              guide.promptExamples.join(" "),
              guide.checklist.join(" "),
              guide.workflow.join(" "),
            ].join(" ").toLocaleLowerCase("ko-KR"),
            searchTerms,
          );
        })
        .toSorted((a, b) => {
          const direction = sortDirection === "asc" ? 1 : -1;
          if (sortMode === "role") {
            return (
              getPersonaRoleLabel(a.role).localeCompare(
                getPersonaRoleLabel(b.role),
                "ko",
              ) * direction
            );
          }
          if (sortMode === "title") {
            return a.title.localeCompare(b.title, "ko") * direction;
          }
          const aProvider = a.providerIds[0] ?? "";
          const bProvider = b.providerIds[0] ?? "";
          return aProvider.localeCompare(bProvider, "ko") * direction;
        }),
    [
      guides,
      providerFilter,
      roleFilter,
      searchTerms,
      sortDirection,
      sortMode,
    ],
  );

  return (
    <section id="personas" className="space-y-4">
      <SectionHeader
        icon={Users}
        title="직군별 사용법 플레이북"
        description="개발자, PM, 마케터, 리서처가 모델을 고르는 기준과 검증 흐름을 서로 다른 업무 맥락으로 정리했습니다."
      />
      <div className="grid gap-2 rounded-md border border-border bg-surface/70 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2">
          <span className="text-xs font-semibold text-text-subtle">검색</span>
          <span className="relative mt-2 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="역할, 목표, 체크 항목"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
            />
          </span>
        </label>
        <label>
          <span className="text-xs font-semibold text-text-subtle">직군</span>
          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as PersonaRoleFilter)
            }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            {roleFilters.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? "전체" : role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-text-subtle">제공사</span>
          <select
            value={providerFilter}
            onChange={(event) =>
              setProviderFilter(event.target.value as GuideProviderFilter)
                }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider === "all" ? "전체" : getSafeProviderLabel(provider)}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-1">
          <span className="text-xs font-semibold text-text-subtle">정렬</span>
          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as PersonaSortMode)
            }
            className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            <option value="role">직군</option>
            <option value="title">가이드명</option>
            <option value="provider">대표 제공사</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() =>
              setSortDirection(sortDirection === "asc" ? "desc" : "asc")
            }
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
          >
            방향 {sortDirectionIcon(sortDirection)}
          </button>
          <span className="whitespace-nowrap text-xs font-semibold text-text-subtle">
            {visibleGuides.length}개
          </span>
        </div>
      </div>

      {visibleGuides.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleGuides.map((guide) => {
            const recommendedModels = guide.recommendedModelIds
              .map(getModelById)
              .filter((model): model is ModelProfile => Boolean(model));
            const alternateModels = guide.alternateModelIds
              .map(getModelById)
              .filter((model): model is ModelProfile => Boolean(model));

            return (
              <article
                key={guide.id}
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                <div className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-accent">
                        {guide.role}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-text">
                        {guide.title}
                      </h3>
                    </div>
                    <span className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-subtle">
                      {guide.providerIds
                        .map((providerId) => getSafeProviderLabel(providerId)).join(" · ")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-muted">
                    {guide.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recommendedModels.map((model) => (
                      <span
                        key={model.id}
                        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text"
                      >
                        {model.modelName}
                      </span>
                    ))}
                    {alternateModels.map((model) => (
                      <span
                        key={model.id}
                        className="rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-semibold text-text-subtle"
                      >
                        대체 {model.modelName}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border px-4 py-4">
                  <p className="text-xs font-semibold text-text-subtle">
                    업무 흐름
                  </p>
                  <ol className="mt-3 space-y-2">
                    {guide.workflow.map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-3 text-xs leading-5 text-text-muted"
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-ink text-[0.6875rem] font-semibold text-ink-fg">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid border-t border-border md:grid-cols-2">
                  <div className="px-4 py-4 md:border-r md:border-border">
                    <p className="text-xs font-semibold text-text-subtle">
                      프롬프트 예시
                    </p>
                    <ul className="mt-3 space-y-2">
                      {guide.promptExamples.map((prompt) => (
                        <li
                          key={prompt}
                          className="text-xs leading-5 text-text-muted"
                        >
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-border px-4 py-4 md:border-t-0">
                    <p className="text-xs font-semibold text-text-subtle">
                      검증 체크
                    </p>
                    <ul className="mt-3 space-y-2">
                      {guide.checklist.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-xs leading-5 text-text-muted"
                        >
                          <CheckCircle2
                            className="mt-0.5 size-3.5 shrink-0 text-accent"
                            aria-hidden
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 직군별 플레이북이 없습니다"
          body="검색어와 필터를 완화하면 항목을 볼 수 있습니다."
        />
      )}
    </section>
  );
}
