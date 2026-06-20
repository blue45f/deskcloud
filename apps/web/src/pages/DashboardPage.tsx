import {
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Inbox,
  MessageSquareText,
  Search,
  Share2,
  Star,
  Users,
  X,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import type { ResponseDto, SurveyQuestion } from '@surveydesk/shared'

import { useAppIdStore } from '@/app/appIdStore'
import { answerPreview } from '@/components/feature/AnswerCells'
import { AppIdSelector } from '@/components/feature/AppIdSelector'
import { MiniBar, type MiniBarRow } from '@/components/feature/MiniBar'
import { ResponseDetailDialog } from '@/components/feature/ResponseDetailDialog'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, QuestionTypeBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { shareOrCopy } from '@/lib/share'
import { ApiError } from '@/services/api'
import { fetchAllResponses, useResponses, useSummary, useSurveys } from '@/services/surveys'
import { csvFilename, downloadCsv, respondentLabel, responsesToCsv } from '@/utils/csv'
import { formatDateTime, formatNumber } from '@/utils/format'
import {
  choiceQuestions,
  headlineNps,
  headlineRating,
  npsQuestions,
  npsTone,
  ratingQuestions,
  ratingRows,
  summaryShareText,
  textQuestions,
} from '@/utils/summary'

const PAGE_SIZE = 10

/** 응답 한 건이 검색어를 (이 페이지 범위에서) 포함하는지 — 응답자·버전·답 미리보기 기준. */
function responseMatches(r: ResponseDto, questions: SurveyQuestion[], needle: string): boolean {
  if (needle === '') return true
  const haystack = [respondentLabel(r), `v${r.surveyVersion}`, answerPreview(questions, r.answers)]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export default function DashboardPage() {
  useDocumentTitle('대시보드')
  const appId = useAppIdStore((s) => s.appId)
  const searchId = useId()

  const surveysQ = useSurveys(appId)
  const summaryQ = useSummary(appId)
  const [page, setPage] = useState(0)
  const responsesQ = useResponses(appId, page * PAGE_SIZE, PAGE_SIZE)

  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [sharing, setSharing] = useState(false)

  // 응답 상세에 쓸 질문 정의 — 활성본 우선, 없으면 최신본.
  const questions: SurveyQuestion[] = useMemo(() => {
    const list = surveysQ.data ?? []
    const active = list.find((s) => s.active) ?? list[0] ?? null
    return active?.questions ?? []
  }, [surveysQ.data])

  const [detail, setDetail] = useState<ResponseDto | null>(null)

  const summary = summaryQ.data
  const noSurvey = summaryQ.error instanceof ApiError && summaryQ.error.status === 404
  // 404(설문 없음)는 빈 상태로 안내하지만, 그 외 실패(네트워크·5xx 등)는 오류 상태로
  // 다시 시도를 제공한다 — 집계 영역이 빈 화면이 되지 않도록.
  const summaryFailed = summaryQ.isError && !noSurvey
  const responsesFailed = responsesQ.isError && !responsesQ.data

  const rating = summary ? headlineRating(summary) : null
  const nps = summary ? headlineNps(summary) : null

  const total = responsesQ.data?.totalCount ?? responsesQ.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const items = useMemo(() => responsesQ.data?.items ?? [], [responsesQ.data])
  const needle = search.trim().toLowerCase()
  // 검색은 현재 페이지 범위에서만 동작한다(서버가 응답 검색 API 를 제공하지 않음).
  // 사용자에게 "이 페이지에서" 라고 명확히 알린다.
  const visibleItems = useMemo(
    () => items.filter((r) => responseMatches(r, questions, needle)),
    [items, questions, needle]
  )

  const hasResponses = total > 0 || items.length > 0

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllResponses(appId)
      if (all.length === 0) {
        toast.info('내보낼 응답이 없습니다.')
        return
      }
      downloadCsv(csvFilename(appId), responsesToCsv(questions, all))
      toast.success(`${formatNumber(all.length)}건을 CSV 로 내보냈습니다.`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'CSV 내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  const shareSummary = async () => {
    if (!summary) return
    setSharing(true)
    try {
      const text = summaryShareText(appId, summary)
      const result = await shareOrCopy({ title: `SurveyDesk · ${appId}`, text })
      if (result === 'copied') toast.success('요약을 클립보드에 복사했습니다.')
      else if (result === 'shared') toast.success('요약을 공유했습니다.')
      else if (result === 'unsupported') toast.error('이 브라우저에서는 공유할 수 없습니다.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">대시보드</h1>
          <p className="mt-1 text-sm text-text-muted">
            테넌트 <span className="font-mono font-medium text-text">{appId}</span> 의 응답 집계와
            최근 피드백.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary && !noSurvey ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void shareSummary()}
              loading={sharing}
            >
              <Share2 className="size-4" /> 요약 공유
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/editor">설문 구성</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <AppIdSelector />
        </CardContent>
      </Card>

      {/* 설문 없음 안내 */}
      {noSurvey ? (
        <EmptyState
          icon={Inbox}
          title={`'${appId}' 에 설문이 없습니다`}
          description="설문 에디터에서 첫 설문을 만들고 활성화하면 위젯이 응답을 받기 시작합니다."
          action={
            <Button asChild size="sm" variant="accent">
              <Link to="/app/editor">설문 만들기</Link>
            </Button>
          }
        />
      ) : null}

      {/* 로딩 */}
      {summaryQ.isLoading && !noSurvey ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : null}

      {/* 집계 로드 실패 */}
      {summaryFailed ? (
        <ErrorState
          title="집계를 불러오지 못했습니다"
          description="네트워크 또는 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요."
          onRetry={() => void summaryQ.refetch()}
          retrying={summaryQ.isFetching}
        />
      ) : null}

      {/* 요약 카드 */}
      {summary && !noSurvey ? (
        <>
          <section aria-label="요약 지표" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="응답 수 (이 버전)"
              value={formatNumber(summary.responseCount)}
              hint={`v${summary.surveyVersion} 기준`}
            />
            <StatCard
              icon={Star}
              label="평균 별점"
              value={rating?.average != null ? rating.average.toFixed(2) : '—'}
              hint={rating ? `${formatNumber(rating.count)}개 응답 · 5점 만점` : '별점 질문 없음'}
              tone="warning"
            />
            <StatCard
              icon={Gauge}
              label="NPS"
              value={
                nps?.score != null ? (nps.score > 0 ? `+${nps.score}` : String(nps.score)) : '—'
              }
              hint={
                nps
                  ? `추천 ${nps.promoters} · 중립 ${nps.passives} · 비추천 ${nps.detractors}`
                  : 'NPS 질문 없음'
              }
              tone={npsTone(nps?.score ?? null)}
            />
            <StatCard
              icon={MessageSquareText}
              label="자유서술"
              value={formatNumber(textQuestions(summary).reduce((a, t) => a + t.count, 0))}
              hint={`${textQuestions(summary).length}개 텍스트 질문`}
              tone="info"
            />
          </section>

          {/* 질문별 분포 */}
          <section aria-label="질문별 집계" className="grid gap-5 lg:grid-cols-2">
            {/* 별점 분포 */}
            {ratingQuestions(summary).map((r) => (
              <Card key={r.questionId}>
                <CardHeader action={<QuestionTypeBadge type="rating" />}>
                  <CardTitle>{r.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tabular-nums text-warning">
                      {r.average != null ? r.average.toFixed(2) : '—'}
                    </span>
                    <span className="text-sm text-text-subtle">/ 5 · {r.count}개</span>
                  </div>
                  <MiniBar
                    rows={ratingRows(r).map((row) => ({ ...row, tone: 'warning' as const }))}
                    total={r.count}
                  />
                </CardContent>
              </Card>
            ))}

            {/* NPS 구성 */}
            {npsQuestions(summary).map((n) => {
              const rows: MiniBarRow[] = [
                { label: '추천 (9–10)', count: n.promoters, tone: 'success' },
                { label: '중립 (7–8)', count: n.passives, tone: 'warning' },
                { label: '비추천 (0–6)', count: n.detractors, tone: 'danger' },
              ]
              return (
                <Card key={n.questionId}>
                  <CardHeader action={<QuestionTypeBadge type="nps" />}>
                    <CardTitle>{n.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tabular-nums text-info">
                        {n.score != null ? (n.score > 0 ? `+${n.score}` : n.score) : '—'}
                      </span>
                      <span className="text-sm text-text-subtle">
                        NPS · 평균 {n.average != null ? n.average.toFixed(1) : '—'} · {n.count}개
                      </span>
                    </div>
                    <MiniBar rows={rows} total={n.count} />
                  </CardContent>
                </Card>
              )
            })}

            {/* 선택지 분포 */}
            {choiceQuestions(summary).map((c) => (
              <Card key={c.questionId}>
                <CardHeader
                  action={
                    <QuestionTypeBadge
                      type={c.type === 'single_choice' ? 'single_choice' : 'multi_choice'}
                    />
                  }
                >
                  <CardTitle>{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniBar
                    rows={c.tallies.map((t) => ({
                      label: t.label,
                      count: t.count,
                      tone: 'accent' as const,
                    }))}
                    total={c.count}
                    emptyText="아직 선택된 보기가 없습니다."
                  />
                </CardContent>
              </Card>
            ))}
          </section>

          {/* 최근 자유서술 피드 */}
          {textQuestions(summary).length > 0 ? (
            <section aria-label="최근 자유서술">
              <h2 className="mb-3 text-base font-semibold text-text">최근 자유서술</h2>
              <div className="grid gap-5 lg:grid-cols-2">
                {textQuestions(summary).map((t) => (
                  <Card key={t.questionId}>
                    <CardHeader action={<Badge tone="neutral">{t.count}개</Badge>}>
                      <CardTitle>{t.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {t.recent.length === 0 ? (
                        <p className="text-sm text-text-subtle">아직 자유서술 응답이 없습니다.</p>
                      ) : (
                        <ul className="space-y-3">
                          {t.recent.map((r, i) => (
                            <li
                              key={`${r.createdAt}-${i}`}
                              className="border-l-2 border-accent/50 pl-3"
                            >
                              <p className="text-sm text-pretty text-text">{r.value}</p>
                              <p className="mt-0.5 text-xs text-text-subtle">
                                {formatDateTime(r.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* 응답 테이블 */}
      {!noSurvey ? (
        <section aria-label="응답 목록">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-text">응답</h2>
              <span className="text-xs text-text-subtle">총 {formatNumber(total)}건</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 이 페이지 검색 — 서버 검색 API 가 없어 현재 페이지 범위로 한정한다. */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle"
                  aria-hidden
                />
                <Input
                  id={searchId}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이 페이지에서 검색"
                  aria-label="이 페이지의 응답 검색 (응답자·버전·답)"
                  className="h-8 w-44 pl-8 text-xs sm:w-52"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="검색어 지우기"
                    className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportCsv()}
                loading={exporting}
                disabled={!hasResponses}
                title={hasResponses ? '전체 응답을 CSV 로 내려받기' : '내보낼 응답이 없습니다'}
              >
                <Download className="size-4" /> CSV 내보내기
              </Button>
            </div>
          </div>
          <Card>
            {responsesQ.isLoading && !responsesQ.data ? (
              <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </CardContent>
            ) : responsesFailed ? (
              <CardContent>
                <ErrorState
                  title="응답을 불러오지 못했습니다"
                  description="잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자 토큰을 확인해 주세요."
                  onRetry={() => void responsesQ.refetch()}
                  retrying={responsesQ.isFetching}
                />
              </CardContent>
            ) : items.length === 0 ? (
              <CardContent>
                <EmptyState
                  icon={Inbox}
                  title="아직 응답이 없습니다"
                  description="위젯이 활성 설문을 받아 응답을 보내기 시작하면 여기에 표시됩니다."
                />
              </CardContent>
            ) : visibleItems.length === 0 ? (
              <CardContent>
                <EmptyState
                  icon={Search}
                  title="검색 결과가 없습니다"
                  description={
                    <>
                      이 페이지에서 “<span className="font-medium text-text">{search}</span>” 와
                      일치하는 응답이 없습니다. 다른 페이지에 있을 수 있습니다.
                    </>
                  }
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                      검색 지우기
                    </Button>
                  }
                />
              </CardContent>
            ) : (
              <>
                {needle ? (
                  <p className="border-b border-border px-4 py-2 text-xs text-text-subtle">
                    이 페이지에서 {visibleItems.length}건 일치
                  </p>
                ) : null}
                <Table>
                  <THead>
                    <TR>
                      <TH>시각</TH>
                      <TH>버전</TH>
                      <TH>응답자</TH>
                      <TH>요약</TH>
                      <TH className="text-right">상세</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visibleItems.map((r) => (
                      <TR
                        key={r.id}
                        onClick={() => setDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDetail(r)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${formatDateTime(r.createdAt)} 응답 상세 보기`}
                        className="cursor-pointer transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent-strong/40 focus-visible:outline-none"
                      >
                        <TD className="whitespace-nowrap text-text-muted">
                          {formatDateTime(r.createdAt)}
                        </TD>
                        <TD>
                          <Badge tone="neutral" size="sm">
                            v{r.surveyVersion}
                          </Badge>
                        </TD>
                        <TD className="whitespace-nowrap text-text-muted">{respondentLabel(r)}</TD>
                        <TD className="max-w-md">
                          <span className="line-clamp-1 text-text-muted">
                            {answerPreview(questions, r.answers)}
                          </span>
                        </TD>
                        <TD className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetail(r)
                            }}
                            tabIndex={-1}
                          >
                            보기
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-text-subtle">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} /{' '}
                    {formatNumber(total)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => {
                        setSearch('')
                        setPage((p) => Math.max(0, p - 1))
                      }}
                      disabled={page === 0}
                      aria-label="이전 페이지"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="font-mono text-xs text-text-muted">
                      {page + 1} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => {
                        setSearch('')
                        setPage((p) => Math.min(pageCount - 1, p + 1))
                      }}
                      disabled={page >= pageCount - 1}
                      aria-label="다음 페이지"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </section>
      ) : null}

      <ResponseDetailDialog
        response={detail}
        questions={questions}
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetail(null)
        }}
      />
    </div>
  )
}
