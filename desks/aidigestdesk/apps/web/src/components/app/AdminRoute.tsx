import {
  curationMonitors,
  featureBacklog,
  getCatalogStats,
  getSourceSnapshotCandidates,
  learningResources,
  runContentAudit,
  sources,
  updatePipeline,
} from "@aidigestdesk/content";
import {
  BookOpen,
  Boxes,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gauge,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AdminSession } from "@/components/app/adminSession";
import type { FormEvent } from "react";

import { Chip, MetricCard, SectionHeader } from "@/components/app/CommonUi";
import { EditorialOpsSection } from "@/components/app/EditorialOpsSection";
import { ExportDeskSection } from "@/components/app/ExportDeskSection";
import {
  getMemberCount,
  listMembers,
  removeMember,
} from "@/components/app/memberAuth";
import { SourcesSection } from "@/components/app/SourcesSection";

const stats = getCatalogStats();
const contentAudit = runContentAudit();

type AdminRouteTarget = "portal";
type SortDirection = "asc" | "desc";
type SnapshotSortMode = "priority" | "publisher" | "source" | "nextCheck" | "cadence";
type SnapshotSortDirection = SortDirection;
type SnapshotPriorityFilter = "all" | "P0" | "P1" | "P2";
type SnapshotStatusFilter = "all" | "자동화 후보" | "정상" | "확인 필요";
type AuditSortMode = "status" | "label";
type AuditSortDirection = SortDirection;
type AuditStatusFilter = "all" | "pass" | "warn" | "fail";

function getSearchTerms(query: string) {
  return query
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function matchSearchTerms(target: string, terms: string[]) {
  return terms.every((term) => target.includes(term));
}

function candidateCompare(a: string, b: string) {
  return a.localeCompare(b, "ko");
}

function AdminLogin({
  onLogin,
  onNavigate,
}: {
  onLogin: (session: AdminSession) => void;
  onNavigate: (route: AdminRouteTarget) => void;
}) {
  const [email, setEmail] = useState("admin@aidigestdesk.local");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail.includes("@")) {
      setError("관리자 이메일 형식으로 입력하세요.");
      return;
    }

    if (accessCode.trim().length < 4) {
      setError("운영 세션 코드를 4자 이상 입력하세요.");
      return;
    }

    onLogin({
      email: normalizedEmail,
      role: "콘텐츠 관리자",
      signedInAt: new Date().toISOString(),
    });
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-[calc(100vh-4rem)] px-4 py-8 outline-none lg:px-6"
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-ink-fg">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-accent">/admin 라우트</p>
              <h1 className="mt-1 text-2xl font-semibold text-text">
                관리자 로그인
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
                콘텐츠 큐레이션, 소스 모니터, 파이프라인 메모, 내보내기 기능을
                공개 포털과 분리해 관리합니다.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <MetricCard
              label="모델"
              value={`${stats.providers}`}
              detail="주요 제공사 비교"
              icon={Boxes}
            />
            <MetricCard
              label="모니터"
              value={`${curationMonitors.length}`}
              detail="소스 점검 대상"
              icon={Gauge}
            />
            <MetricCard
              label="감사"
              value={contentAudit.passed ? "PASS" : "WARN"}
              detail={`${contentAudit.checks.length}개 품질 체크`}
              icon={CheckCircle2}
            />
          </div>
          <div className="mt-6 rounded-lg border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-text">인증 범위 안내</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              현재 배포는 정적 Vite 앱이라 서버 비밀키 검증이 없는 로컬 관리자
              세션입니다. 실제 권한 통제는 Supabase, Auth.js, Vercel Edge
              Middleware 같은 서버 인증을 붙이는 단계에서 완성해야 합니다.
            </p>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-accent" aria-hidden />
            <h2 className="text-base font-semibold text-text">
              로컬 관리자 세션
            </h2>
          </div>
          <label className="mt-5 block">
            <span className="text-xs font-semibold text-text-subtle">
              관리자 이메일
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-text-subtle">
              운영 세션 코드
            </span>
            <input
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="4자 이상"
              className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
            />
          </label>
          {error ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-ink-fg"
          >
            <LogIn className="size-4" aria-hidden />
            로그인
          </button>
          <button
            type="button"
            onClick={() => onNavigate("portal")}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-text-muted transition hover:text-text"
          >
            <Home className="size-4" aria-hidden />
            공개 포털로 이동
          </button>
        </form>
      </div>
    </main>
  );
}

function MemberManagementSection() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const members = useMemo(() => {
    void refreshToken;
    return listMembers();
  }, [refreshToken]);
  const total = useMemo(() => {
    void refreshToken;
    return getMemberCount();
  }, [refreshToken]);

  const terms = getSearchTerms(memberQuery);
  const visible = members.filter((member) =>
    matchSearchTerms(
      `${member.email} ${member.displayName} ${member.role}`.toLocaleLowerCase("ko-KR"),
      terms,
    ),
  );

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Users}
        title="회원 관리"
        description="회원가입(데모) 계정 목록입니다. 계정은 각 브라우저의 localStorage에만 저장되므로, 여기 표시되는 회원은 현재 브라우저에 가입된 계정입니다."
        badge={<Chip tone="blue">{total}명</Chip>}
      />
      <div className="rounded-lg border border-border bg-surface p-4">
        <label className="block max-w-sm">
          <span className="text-xs font-semibold text-text-subtle">회원 검색</span>
          <input
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이메일, 닉네임, 권한"
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
        </label>
        {visible.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-text-subtle">
                  <th className="px-2 py-2">닉네임</th>
                  <th className="px-2 py-2">이메일</th>
                  <th className="px-2 py-2">권한</th>
                  <th className="px-2 py-2">가입일</th>
                  <th className="px-2 py-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => (
                  <tr key={member.id} className="border-b border-border/60">
                    <td className="px-2 py-2 font-semibold text-text">{member.displayName}</td>
                    <td className="px-2 py-2 text-text-muted">{member.email}</td>
                    <td className="px-2 py-2">
                      {member.role === "admin" ? (
                        <Chip tone="accent">관리자</Chip>
                      ) : (
                        <Chip tone="neutral">회원</Chip>
                      )}
                    </td>
                    <td className="px-2 py-2 text-text-subtle">
                      {new Date(member.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          removeMember(member.id);
                          setRefreshToken((token) => token + 1);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-accent-4/40 bg-accent-4/10 px-2 py-1 text-xs font-semibold text-accent-4 transition hover:bg-accent-4/20"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-border-strong bg-bg p-4 text-sm text-text-muted">
            {total === 0
              ? "아직 가입한 회원이 없습니다. /account 에서 회원가입을 테스트할 수 있습니다."
              : "검색 조건에 맞는 회원이 없습니다."}
          </p>
        )}
      </div>
    </section>
  );
}

function AdminConsole({
  session,
  onLogout,
  onNavigate,
}: {
  session: AdminSession;
  onLogout: () => void;
  onNavigate: (route: AdminRouteTarget) => void;
}) {
  const snapshotCandidates = useMemo(() => getSourceSnapshotCandidates(), []);
  const p0Monitors = curationMonitors.filter(
    (monitor) => monitor.priority === "P0",
  );
  const koreanResourceCount = learningResources.filter(
    (resource) => resource.language === "한국어",
  ).length;
  const [snapshotQuery, setSnapshotQuery] = useState("");
  const [snapshotPriorityFilter, setSnapshotPriorityFilter] =
    useState<SnapshotPriorityFilter>("all");
  const [snapshotStatusFilter, setSnapshotStatusFilter] =
    useState<SnapshotStatusFilter>("all");
  const [snapshotSortMode, setSnapshotSortMode] =
    useState<SnapshotSortMode>("priority");
  const [snapshotSortDirection, setSnapshotSortDirection] =
    useState<SnapshotSortDirection>("asc");
  const [checkQuery, setCheckQuery] = useState("");
  const [checkSortMode, setCheckSortMode] = useState<AuditSortMode>("status");
  const [checkSortDirection, setCheckSortDirection] =
    useState<AuditSortDirection>("asc");
  const [checkStatusFilter, setCheckStatusFilter] =
    useState<AuditStatusFilter>("all");
  const snapshotTerms = useMemo(() => getSearchTerms(snapshotQuery), [
    snapshotQuery,
  ]);
  const checkTerms = useMemo(() => getSearchTerms(checkQuery), [checkQuery]);
  const filteredSnapshotCandidates = useMemo(
    () =>
      snapshotCandidates
        .filter((candidate) => {
          if (
            snapshotPriorityFilter !== "all" &&
            candidate.priority !== snapshotPriorityFilter
          ) {
            return false;
          }
          if (
            snapshotStatusFilter !== "all" &&
            candidate.monitorStatus !== snapshotStatusFilter
          ) {
            return false;
          }
          if (!snapshotTerms.length) return true;
          return matchSearchTerms(
            `${candidate.source.publisher} ${candidate.source.title} ${candidate.source.kind} ${candidate.priority} ${candidate.monitorStatus}`.toLocaleLowerCase("ko-KR"),
            snapshotTerms,
          );
        })
        .toSorted((a, b) => {
          const direction = snapshotSortDirection === "asc" ? 1 : -1;
          if (snapshotSortMode === "priority") {
            if (a.priority === b.priority) return 0;
            if (a.priority === "P0") return -1 * direction;
            if (a.priority === "P1" && b.priority !== "P0") return -1 * direction;
            if (a.priority === "P2" && b.priority === "P0") return 1 * direction;
            return -1 * direction;
          }
          if (snapshotSortMode === "publisher") {
            const byPublisher = candidateCompare(
              a.source.publisher,
              b.source.publisher,
            );
            if (byPublisher !== 0) return byPublisher * direction;
          }
          if (snapshotSortMode === "source") {
            const byTitle = candidateCompare(a.source.title, b.source.title);
            if (byTitle !== 0) return byTitle * direction;
          }
          if (snapshotSortMode === "cadence") {
            const byCadence = a.cadence.localeCompare(b.cadence, "ko");
            if (byCadence !== 0) return byCadence * direction;
          }
          const byDate = b.nextCheck.localeCompare(a.nextCheck, "ko");
          return byDate * direction;
        }),
    [
      snapshotCandidates,
      snapshotPriorityFilter,
      snapshotStatusFilter,
      snapshotSortDirection,
      snapshotSortMode,
      snapshotTerms,
    ],
  );

  const visibleChecks = useMemo(
    () =>
      contentAudit.checks
        .filter((check) =>
          checkStatusFilter === "all" ? true : check.status === checkStatusFilter,
        )
        .filter((check) => {
          if (!checkTerms.length) return true;
          return matchSearchTerms(
            `${check.label} ${check.detail} ${check.status}`.toLocaleLowerCase("ko-KR"),
            checkTerms,
          );
        })
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
    [
      checkStatusFilter,
      checkSortDirection,
      checkSortMode,
      checkTerms,
    ],
  );

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="px-4 py-5 outline-none lg:px-6"
    >
      <div className="mx-auto max-w-[96rem] space-y-6">
        <section
          id="admin-overview"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-accent">
                관리자 콘솔 · /admin
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-text">
                콘텐츠 운영 대시보드
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
                AI 바이브 코딩 자료, 모델 업데이트, 출처 스냅샷, 편집
                파이프라인을 공개 포털과 분리해 관리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate("portal")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
              >
                <Home className="size-3.5" aria-hidden />
                포털
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
              >
                <LogOut className="size-3.5" aria-hidden />
                로그아웃
              </button>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {[
              ["#admin-overview", "개요"],
              ["#ops", "운영 편집실"],
              ["#exports", "내보내기"],
              ["#sources", "출처"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
              >
                {label}
              </a>
            ))}
          </nav>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="로그인 계정"
            value={session.role}
            detail={`${session.email} · ${new Date(
              session.signedInAt,
            ).toLocaleString("ko-KR")}`}
            icon={ShieldCheck}
          />
          <MetricCard
            label="소스 스냅샷"
            value={`${snapshotCandidates.length}`}
            detail="공식/벤치마크/모니터링 대상"
            icon={FileText}
          />
          <MetricCard
            label="P0 모니터"
            value={`${p0Monitors.length}`}
            detail="매일 또는 최우선 확인 대상"
            icon={Gauge}
          />
          <MetricCard
            label="한국어 자료"
            value={`${koreanResourceCount}`}
            detail="강좌, 문서, 블로그, 도서"
            icon={BookOpen}
          />
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-text">
                콘텐츠 감사 상태
              </h2>
              <span
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  contentAudit.passed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {contentAudit.passed ? "PASS" : "CHECK"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 rounded-md bg-bg p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="lg:col-span-2">
                <span className="text-xs font-semibold text-text-subtle">
                  검색
                </span>
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
                    setCheckStatusFilter(event.target.value as AuditStatusFilter)
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
                    setCheckSortMode(event.target.value as AuditSortMode)
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
                    setCheckSortDirection(
                      checkSortDirection === "asc" ? "desc" : "asc",
                    )
                  }
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
                >
                  방향 {checkSortDirection === "asc" ? "올림" : "내림"}
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {visibleChecks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-md border border-border bg-bg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-text">
                      {check.label}
                    </p>
                    <span className="text-xs font-semibold text-accent">
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    {check.detail}
                  </p>
                </div>
              ))}
              {!visibleChecks.length ? (
                <div className="p-4 rounded-md border border-dashed border-border">
                  <p className="text-xs text-text-subtle">
                    조건에 맞는 감사 항목이 없습니다.
                  </p>
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-text">
                스냅샷 우선 후보
              </h2>
              <span className="text-xs font-semibold text-text-subtle">
                {filteredSnapshotCandidates.length}개
              </span>
            </div>
            <div className="mt-3 grid gap-2 rounded-md bg-bg p-3 md:grid-cols-2">
              <label className="lg:col-span-2">
                <span className="text-xs font-semibold text-text-subtle">검색</span>
                <span className="relative mt-2 block">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
                  <input
                    value={snapshotQuery}
                    onChange={(event) => setSnapshotQuery(event.target.value)}
                    placeholder="출처, 제공사, 우선순위"
                    className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
                  />
                </span>
              </label>
              <label>
                <span className="text-xs font-semibold text-text-subtle">
                  우선순위
                </span>
                <select
                  value={snapshotPriorityFilter}
                  onChange={(event) =>
                    setSnapshotPriorityFilter(
                      event.target.value as SnapshotPriorityFilter,
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
                  value={snapshotStatusFilter}
                  onChange={(event) =>
                    setSnapshotStatusFilter(
                      event.target.value as SnapshotStatusFilter,
                    )
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
                <span className="text-xs font-semibold text-text-subtle">정렬</span>
                <select
                  value={snapshotSortMode}
                  onChange={(event) =>
                    setSnapshotSortMode(event.target.value as SnapshotSortMode)
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
                >
                  <option value="priority">우선순위</option>
                  <option value="publisher">출처명</option>
                  <option value="source">제목</option>
                  <option value="nextCheck">다음 확인</option>
                  <option value="cadence">주기</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() =>
                    setSnapshotSortDirection(
                      snapshotSortDirection === "asc" ? "desc" : "asc",
                    )
                  }
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-subtle transition hover:text-text"
                >
                  방향 {snapshotSortDirection === "asc" ? "올림" : "내림"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {filteredSnapshotCandidates.map((candidate) => (
                <a
                  key={candidate.source.id}
                  href={candidate.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border bg-bg p-3 transition hover:border-border-strong"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-accent">
                      {candidate.priority} · {candidate.cadence}
                    </span>
                    <ExternalLink
                      className="size-3.5 text-text-subtle"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-text">
                    {candidate.source.title}
                  </span>
                  <span className="mt-1 block text-xs text-text-subtle">
                    {candidate.source.publisher}
                  </span>
                </a>
              ))}
              {!filteredSnapshotCandidates.length ? (
                <div className="rounded-md border border-dashed border-border p-4">
                  <p className="text-xs text-text-subtle">
                    조건에 맞는 스냅샷 후보가 없습니다.
                  </p>
                </div>
              ) : null}
            </div>
          </article>
        </section>

        <MemberManagementSection />
        <EditorialOpsSection
          monitors={curationMonitors}
          pipelineItems={updatePipeline}
          backlog={featureBacklog}
        />
        <ExportDeskSection />
        <SourcesSection sourceItems={sources} />
      </div>
    </main>
  );
}

export function AdminRoute({
  session,
  onLogin,
  onLogout,
  onNavigate,
}: {
  session: AdminSession | null;
  onLogin: (session: AdminSession) => void;
  onLogout: () => void;
  onNavigate: (route: AdminRouteTarget) => void;
}) {
  return session ? (
    <AdminConsole
      session={session}
      onLogout={onLogout}
      onNavigate={onNavigate}
    />
  ) : (
    <AdminLogin onLogin={onLogin} onNavigate={onNavigate} />
  );
}
