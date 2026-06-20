import { calculateModelCosts, getProviderLabel } from "@aidigestdesk/content";
import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionHeader, SortSelect } from "@/components/app/CommonUi";

type ModelCostSortMode =
  | "model"
  | "input"
  | "output"
  | "total"
  | "provider";
type ModelCostSortDirection = "asc" | "desc";
type EventCostSortMode = "model" | "normal" | "event" | "saved";
type EventCostSortDirection = "asc" | "desc";
type CostEstimateListLimit = number;
type EventEstimateListLimit = number;

export function ModelCostCalculator() {
  const [scenario, setScenario] = useState({
    inputTokensPerRun: 10000,
    outputTokensPerRun: 2000,
    runsPerMonth: 1000,
  });
  const estimates = useMemo(() => calculateModelCosts(scenario), [scenario]);
  const [costSortMode, setCostSortMode] = useState<ModelCostSortMode>("total");
  const [costSortDirection, setCostSortDirection] =
    useState<ModelCostSortDirection>("asc");
  const [costEstimateLimit, setCostEstimateLimit] =
    useState<CostEstimateListLimit>(0);
  const cheapest = estimates[0];
  const costSortValue = `${costSortMode}-${costSortDirection}`;
  const costSortOptions: Array<{
    value: string;
    label: string;
  }> = [
    { value: "total-asc", label: "월 합계 낮은순" },
    { value: "total-desc", label: "월 합계 높은순" },
    { value: "input-asc", label: "입력 비용 낮은순" },
    { value: "input-desc", label: "입력 비용 높은순" },
    { value: "output-asc", label: "출력 비용 낮은순" },
    { value: "output-desc", label: "출력 비용 높은순" },
    { value: "model-asc", label: "모델 A→Z" },
    { value: "model-desc", label: "모델 Z→A" },
    { value: "provider-asc", label: "제공사 A→Z" },
    { value: "provider-desc", label: "제공사 Z→A" },
  ];
  const handleCostSortChange = (next: string) => {
    const splitAt = next.lastIndexOf("-");
    setCostSortMode(next.slice(0, splitAt) as ModelCostSortMode);
    setCostSortDirection(next.slice(splitAt + 1) as ModelCostSortDirection);
  };
  const sortedEstimates = useMemo(() => {
    const direction = costSortDirection === "asc" ? 1 : -1;
    return estimates.toSorted((left, right) => {
      switch (costSortMode) {
        case "model":
          return left.profile.modelName.localeCompare(right.profile.modelName) * direction;
        case "provider":
          return (getProviderLabel(left.profile.providerId) ?? "미지정").localeCompare(
            getProviderLabel(right.profile.providerId) ?? "미지정",
          ) * direction;
        case "input":
          if (left.inputCost === right.inputCost) return 0;
          return (left.inputCost - right.inputCost) * direction;
        case "output":
          if (left.outputCost === right.outputCost) return 0;
          return (left.outputCost - right.outputCost) * direction;
        case "total":
          if (left.totalCost === right.totalCost) return 0;
          return (left.totalCost - right.totalCost) * direction;
        default:
          return 0;
      }
    });
  }, [costSortDirection, costSortMode, estimates]);
  const visibleCostEstimates =
    costEstimateLimit === 0 ? sortedEstimates : sortedEstimates.slice(0, costEstimateLimit);

  const updateScenario = (key: keyof typeof scenario, value: string) => {
    const parsed = Number(value);
    setScenario((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    }));
  };

  return (
    <section id="costs" className="space-y-4">
      <SectionHeader
        icon={Calculator}
        title="모델 비용 계산기"
        description="월 호출량 기준으로 주요 모델의 예상 토큰 비용을 비교합니다. 벤치마크 환산 단가는 비교용으로 표시합니다."
      />
      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <article className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">사용량 시나리오</h3>
          <div className="mt-4 space-y-3">
            <NumberField
              label="1회 입력 토큰"
              value={scenario.inputTokensPerRun}
              onChange={(value) => updateScenario("inputTokensPerRun", value)}
            />
            <NumberField
              label="1회 출력 토큰"
              value={scenario.outputTokensPerRun}
              onChange={(value) => updateScenario("outputTokensPerRun", value)}
            />
            <NumberField
              label="월 실행 횟수"
              value={scenario.runsPerMonth}
              onChange={(value) => updateScenario("runsPerMonth", value)}
            />
          </div>
          <div className="mt-4 rounded-md border border-border bg-bg p-3">
            <p className="text-xs text-text-subtle">가장 낮은 예상 비용</p>
            <p className="mt-1 text-lg font-semibold text-text">
              {cheapest?.profile.modelName ?? "-"} ·{" "}
              {cheapest?.formattedTotal ?? "$0.00"}
            </p>
            <p className="mt-1 text-xs leading-5 text-text-subtle">
              Manus, Kimi, Qwen처럼 태스크형 서비스이거나 공식 USD 토큰 단가를
              화면에서 확정하지 못한 항목은 계산기에서 제외했습니다.
            </p>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid gap-2 border-b border-border px-4 py-3 md:grid-cols-3">
            <SortSelect
              value={costSortValue}
              onChange={handleCostSortChange}
              options={costSortOptions}
            />
            <label className="block">
              <span className="text-xs font-semibold text-text-subtle">
                표시 개수
              </span>
              <select
                value={costEstimateLimit}
                onChange={(event) =>
                  setCostEstimateLimit(Number(event.target.value))
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value={0}>전체</option>
                <option value={12}>12개</option>
                <option value={24}>24개</option>
                <option value={36}>36개</option>
              </select>
            </label>
            <div className="rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-subtle">
              <span>
                표시 {visibleCostEstimates.length}개 / 전체{" "}
                {sortedEstimates.length}개
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[42rem]">
              <div className="grid grid-cols-[1fr_6rem_6rem_6rem] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-text-subtle">
                <span>모델</span>
                <span className="text-right">입력</span>
                <span className="text-right">출력</span>
                <span className="text-right">월 합계</span>
              </div>
              {visibleCostEstimates.map((estimate) => (
                <div
                  key={estimate.profile.id}
                  className="grid grid-cols-[1fr_6rem_6rem_6rem] gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {estimate.profile.modelName}
                    </p>
                    <p className="mt-1 text-xs text-text-subtle">
                      {getProviderLabel(estimate.profile.providerId)} ·{" "}
                      {estimate.profile.pricingBasis}
                    </p>
                    <p className="mt-1 hidden text-xs leading-5 text-text-subtle md:block">
                      {estimate.profile.notes}
                    </p>
                  </div>
                  <p className="text-right text-xs font-semibold text-text-muted">
                    {estimate.inputCost.toFixed(2)}
                  </p>
                  <p className="text-right text-xs font-semibold text-text-muted">
                    {estimate.outputCost.toFixed(2)}
                  </p>
                  <p className="text-right text-sm font-semibold text-text">
                    {estimate.formattedTotal}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

type EventCreditMode = "none" | "double-credit" | "half-price";

const eventCostScenarios = [
  {
    id: "webinar",
    title: "온라인 세미나 Q&A",
    summary: "참가자 질문 요약, 후속 메일 초안, 세션별 하이라이트 생성",
    inputTokensPerRun: 6000,
    outputTokensPerRun: 1200,
    runsPerMonth: 600,
  },
  {
    id: "hackathon",
    title: "해커톤/부트캠프 멘토링",
    summary: "코드 리뷰, README 초안, 에러 로그 분석, 발표 자료 피드백",
    inputTokensPerRun: 14000,
    outputTokensPerRun: 3000,
    runsPerMonth: 1200,
  },
  {
    id: "launch",
    title: "제품 런칭 이벤트",
    summary: "랜딩 카피, FAQ, 고객 문의 분류, 커뮤니티 댓글 요약",
    inputTokensPerRun: 9000,
    outputTokensPerRun: 1800,
    runsPerMonth: 2400,
  },
] as const;

export function EventCostComparisonSection() {
  const [scenarioId, setScenarioId] =
    useState<(typeof eventCostScenarios)[number]["id"]>("webinar");
  const [creditMode, setCreditMode] = useState<EventCreditMode>("none");
  const [eventSortMode, setEventSortMode] =
    useState<EventCostSortMode>("saved");
  const [eventSortDirection, setEventSortDirection] =
    useState<EventCostSortDirection>("desc");
  const [eventEstimateLimit, setEventEstimateLimit] =
    useState<EventEstimateListLimit>(0);
  const eventSortValue = `${eventSortMode}-${eventSortDirection}`;
  const eventSortOptions: Array<{
    value: string;
    label: string;
  }> = [
    { value: "saved-desc", label: "절감 큰순" },
    { value: "saved-asc", label: "절감 작은순" },
    { value: "normal-asc", label: "일반 비용 낮은순" },
    { value: "normal-desc", label: "일반 비용 높은순" },
    { value: "event-asc", label: "이벤트 비용 낮은순" },
    { value: "event-desc", label: "이벤트 비용 높은순" },
    { value: "model-asc", label: "모델 A→Z" },
    { value: "model-desc", label: "모델 Z→A" },
  ];
  const handleEventSortChange = (next: string) => {
    const splitAt = next.lastIndexOf("-");
    setEventSortMode(next.slice(0, splitAt) as EventCostSortMode);
    setEventSortDirection(next.slice(splitAt + 1) as EventCostSortDirection);
  };
  const scenario =
    eventCostScenarios.find((item) => item.id === scenarioId) ??
    eventCostScenarios[0];
  const discountFactor =
    creditMode === "double-credit" || creditMode === "half-price" ? 0.5 : 1;
  const sortedEventEstimates = useMemo(() => {
    const estimates = calculateModelCosts(scenario).map((estimate) => ({
        ...estimate,
        adjustedTotal: estimate.totalCost * discountFactor,
      }));
    const direction = eventSortDirection === "asc" ? 1 : -1;

    return estimates.toSorted((left, right) => {
      const leftSaved = left.totalCost - left.adjustedTotal;
      const rightSaved = right.totalCost - right.adjustedTotal;
      switch (eventSortMode) {
        case "model":
          return left.profile.modelName.localeCompare(right.profile.modelName) * direction;
        case "normal":
          if (left.totalCost === right.totalCost) return 0;
          return (left.totalCost - right.totalCost) * direction;
        case "event":
          if (left.adjustedTotal === right.adjustedTotal) return 0;
          return (left.adjustedTotal - right.adjustedTotal) * direction;
        case "saved":
          if (leftSaved === rightSaved) return 0;
          return (leftSaved - rightSaved) * direction;
        default:
          return 0;
      }
    });
  }, [discountFactor, eventSortDirection, eventSortMode, scenario]);
  const visibleEventEstimates =
    eventEstimateLimit === 0
      ? sortedEventEstimates
      : sortedEventEstimates.slice(0, eventEstimateLimit);

  return (
    <section id="event-costs" className="space-y-4">
      <SectionHeader
        icon={Calculator}
        title="이벤트 비용 비교"
        description="2배 크레딧, 50% 할인, 친구 초대 크레딧 같은 이벤트를 가정해 행사성 AI 운영 비용을 별도로 비교합니다."
      />
      <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
        <article className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">행사 시나리오</h3>
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-text-subtle">
              이벤트 유형
            </span>
            <select
              value={scenarioId}
              onChange={(event) =>
                setScenarioId(
                  event.target
                    .value as (typeof eventCostScenarios)[number]["id"],
                )
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              {eventCostScenarios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-text-subtle">
              프로모션 효과
            </span>
            <select
              value={creditMode}
              onChange={(event) =>
                setCreditMode(event.target.value as EventCreditMode)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value="none">이벤트 없음</option>
              <option value="double-credit">2배 크레딧 적용</option>
              <option value="half-price">50% 할인 적용</option>
            </select>
          </label>
          <div className="mt-4 rounded-md border border-border bg-bg p-3">
            <p className="text-sm font-semibold text-text">{scenario.title}</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              {scenario.summary}
            </p>
            <p className="mt-2 text-xs text-text-subtle">
              {scenario.runsPerMonth.toLocaleString("ko-KR")}회 실행 · 입력{" "}
              {scenario.inputTokensPerRun.toLocaleString("ko-KR")} · 출력{" "}
              {scenario.outputTokensPerRun.toLocaleString("ko-KR")} tokens
            </p>
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid gap-2 border-b border-border px-4 py-3 md:grid-cols-2">
          <SortSelect
            value={eventSortValue}
            onChange={handleEventSortChange}
            options={eventSortOptions}
          />
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">표시 개수</span>
            <select
              value={eventEstimateLimit}
              onChange={(event) =>
                setEventEstimateLimit(Number(event.target.value))
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value={0}>전체</option>
              <option value={6}>6개</option>
              <option value={12}>12개</option>
              <option value={18}>18개</option>
            </select>
          </label>
        </div>
        <div className="grid border-b border-border px-4 py-3 text-xs">
          <span className="font-semibold text-text-subtle">
            표시 {visibleEventEstimates.length}개 / 전체 {sortedEventEstimates.length}개
          </span>
        </div>
          <div className="grid grid-cols-[1fr_6rem_6rem] gap-3 border-b border-border px-4 py-3 text-xs font-semibold text-text-subtle md:grid-cols-[1.4fr_7rem_7rem_7rem]">
            <span>모델</span>
            <span className="text-right">일반</span>
            <span className="text-right">이벤트</span>
            <span className="hidden text-right md:block">절감</span>
          </div>
            {visibleEventEstimates.map((estimate) => {
              const saved = estimate.totalCost - estimate.adjustedTotal;
            return (
              <div
                key={estimate.profile.id}
                className="grid grid-cols-[1fr_6rem_6rem] gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1.4fr_7rem_7rem_7rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {estimate.profile.modelName}
                  </p>
                  <p className="mt-1 text-xs text-text-subtle">
                    {getProviderLabel(estimate.profile.providerId)} ·{" "}
                    {estimate.profile.pricingBasis}
                  </p>
                </div>
                <p className="text-right text-xs font-semibold text-text-muted">
                  ${estimate.totalCost.toFixed(2)}
                </p>
                <p className="text-right text-sm font-semibold text-text">
                  ${estimate.adjustedTotal.toFixed(2)}
                </p>
                <p className="hidden text-right text-xs font-semibold text-accent md:block">
                  ${saved.toFixed(2)}
                </p>
              </div>
            );
          })}
          {!visibleEventEstimates.length ? (
            <p className="px-4 py-3 text-sm text-text-subtle">조건에 맞는 비교 대상이 없습니다.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-text-subtle">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm font-semibold text-text outline-none transition focus:border-accent"
      />
    </label>
  );
}
