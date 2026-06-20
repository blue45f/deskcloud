import { CloudCheck, FileText, Home, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AppRoute } from '@/components/app/appRoutes'
import type { PublicPolicy } from '@heejun/deskcloud'
import type { ReactNode } from 'react'

import { Chip, SegmentBar } from '@/components/app/CommonUi'
import { getTermsClient } from '@/components/app/deskcloud'


const EFFECTIVE_DATE = '2026-06-18'

type DocumentId = 'terms' | 'privacy'

const documentTabs: Array<{ id: DocumentId; label: string }> = [
  { id: 'terms', label: '이용약관' },
  { id: 'privacy', label: '개인정보처리방침' },
]

/**
 * 문서 토글 ID → TermsDesk 정책 slug. 'terms'/'privacy'는 TermsDesk의 관례적 slug이며,
 * 이 매핑으로 활성 문서에 해당하는 게시본을 조회한다.
 */
const TERMS_DESK_SLUGS: Record<DocumentId, string> = {
  terms: 'terms',
  privacy: 'privacy',
}

const documentTitles: Record<DocumentId, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
}

/** 데모/포트폴리오 면책을 강조하는 틴티드 콜아웃 박스. */
function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="rounded-md border border-accent-3/30 bg-accent-3/10 p-4 text-sm leading-6 text-accent-3"
    >
      {children}
    </div>
  )
}

/** 약관/방침 본문의 조(條) 단위 블록. 번호와 제목, 본문을 함께 묶는다. */
function Article({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-text">
        제{number}조 ({title})
      </h3>
      <div className="space-y-2 text-sm leading-7 text-text-muted">{children}</div>
    </section>
  )
}

function TermsDocument({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-6">
      <header className="space-y-2 border-b border-border pb-5">
        <h2 className="text-xl font-semibold text-text">이용약관</h2>
        <p className="text-sm leading-7 text-text-muted">
          본 약관은 AI Digest Desk(이하 &ldquo;서비스&rdquo;)의 이용 조건과 절차, 이용자와 운영자의
          권리·의무 및 책임 사항을 규정합니다.
        </p>
      </header>

      <DemoNotice>
        본 포털은 데모/포트폴리오 목적이며 실제 계약·법적 효력을 갖지 않습니다. 아래 조항은 실제
        서비스 약관의 형식을 보여주기 위한 예시이며, 특정 사업자의 법적 의무를 발생시키지 않습니다.
      </DemoNotice>

      <div className="mt-6 space-y-7">
        <Article number={1} title="목적">
          <p>
            이 약관은 서비스가 제공하는 AI/LLM 업데이트·벤치마크·기능 비교·학습 자료 큐레이션의
            이용과 관련하여 운영자와 이용자 간의 권리, 의무 및 책임 사항을 정하는 것을 목적으로
            합니다.
          </p>
        </Article>

        <Article number={2} title="정의">
          <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              &ldquo;서비스&rdquo;란 운영자가 제공하는 AI Digest Desk 포털과 그에 포함된 모든
              기능·콘텐츠를 말합니다.
            </li>
            <li>
              &ldquo;이용자&rdquo;란 본 약관에 동의하고 서비스를 이용하는 모든 방문자 및 회원을
              말합니다.
            </li>
            <li>
              &ldquo;콘텐츠&rdquo;란 서비스가 큐레이션·게시하는 텍스트, 표, 링크, 요약, 벤치마크
              수치 등 일체의 자료를 말합니다.
            </li>
          </ul>
        </Article>

        <Article number={3} title="약관의 효력 및 변경">
          <p>
            이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 운영자는 관련 법령을 위반하지
            않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용 일자와 변경 사유를 명시하여 사전에
            공지합니다. 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단할 수 있습니다.
          </p>
        </Article>

        <Article number={4} title="서비스의 제공 및 변경">
          <p>
            운영자는 서비스의 내용을 큐레이션 정책에 따라 추가·수정·삭제할 수 있습니다. 서비스는
            데모 환경 특성상 사전 고지 없이 일부 기능이 변경되거나 중단될 수 있으며, 이로 인한 이용
            제약에 대해 운영자는 책임을 지지 않습니다.
          </p>
        </Article>

        <Article number={5} title="이용자의 의무">
          <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>서비스의 정상적인 운영을 방해하거나 자동화된 수단으로 과도하게 수집하는 행위</li>
            <li>타인의 권리를 침해하거나 관련 법령을 위반하는 행위</li>
            <li>서비스가 제공하는 정보를 출처 표기 없이 상업적으로 무단 재배포하는 행위</li>
          </ul>
        </Article>

        <Article number={6} title="콘텐츠의 출처와 정확성">
          <p>
            서비스의 모든 콘텐츠는 특정 시점의 스냅샷을 기준으로 큐레이션되며, 각 항목에는 가능한 한
            출처 링크를 제공합니다. 제품 사양은 공식 문서를 우선하고, 외부 벤치마크 수치는 별도의
            평가 결과로 구분하여 표시합니다.
          </p>
          <p>
            AI/LLM 분야는 변화가 빠르므로 게시된 수치·기능·가격은 실제와 다를 수 있습니다. 이용자는
            중요한 의사결정 전 반드시 원문(공식 문서·외부 출처)을 직접 확인해야 하며, 운영자는
            콘텐츠의 부정확성·지연으로 발생한 손해에 대해 책임을 지지 않습니다.
          </p>
        </Article>

        <Article number={7} title="지식재산권">
          <p>
            서비스가 직접 작성한 한국어 요약·편집물에 대한 권리는 운영자에게 있습니다. 외부 출처에서
            인용한 자료의 권리는 각 권리자에게 귀속되며, 서비스는 출처를 표기하고 원문을 장문으로
            복제하지 않습니다.
          </p>
        </Article>

        <Article number={8} title="면책조항">
          <p>
            서비스는 정보 제공을 목적으로 하며, 특정 모델·도구의 구매나 투자, 도입 등 일체의 의사결정
            결과에 대한 책임은 전적으로 이용자에게 있습니다. 운영자는 서비스 이용으로 발생한 직접·간접
            손해에 대해 관련 법령이 허용하는 범위에서 책임을 부담하지 않습니다.
          </p>
        </Article>

        <Article number={9} title="준거법 및 분쟁해결">
          <p>
            이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생할 경우
            운영자와 이용자는 신의성실의 원칙에 따라 원만한 해결을 위해 노력합니다.
          </p>
        </Article>

        <Article number={10} title="문의">
          <p>
            약관을 비롯한 모든 문의는 포털 내{' '}
            <button
              type="button"
              onClick={() => onNavigate('support')}
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              문의 페이지
            </button>
            를 통해 접수합니다. 전화·이메일 대신 내부 문의 게시판으로 창구를 통합했으며, 접수된
            문의는 공개 게시판에 표시되고 운영자가 확인 후 상태를 업데이트합니다.
          </p>
        </Article>
      </div>
    </article>
  )
}

function PrivacyDocument() {
  return (
    <article className="rounded-lg border border-border bg-surface p-6">
      <header className="space-y-2 border-b border-border pb-5">
        <h2 className="text-xl font-semibold text-text">개인정보처리방침</h2>
        <p className="text-sm leading-7 text-text-muted">
          AI Digest Desk는 이용자의 개인정보를 소중히 다루며, 데모 환경에서 처리하는 정보의 항목과
          취급 방식을 아래와 같이 안내합니다.
        </p>
      </header>

      <DemoNotice>
        본 포털은 데모/포트폴리오 목적이며, 회원 데모 정보는 이용자의 브라우저 localStorage에만
        저장됩니다. 어떤 정보도 서버나 외부로 전송되지 않으며 별도의 백엔드 데이터베이스에 수집되지
        않습니다.
      </DemoNotice>

      <div className="mt-6 space-y-7">
        <Article number={1} title="수집하는 개인정보 항목">
          <p>
            회원 데모 기능 이용 시 다음 항목이 입력될 수 있습니다. 이 정보는 모두 이용자의 브라우저
            localStorage에만 저장되고 서버로 전송되지 않습니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>이메일 주소 (데모 로그인 식별용)</li>
            <li>닉네임 (화면 표시용)</li>
            <li>다크 모드, 필터 선택값 등 화면 환경설정</li>
          </ul>
        </Article>

        <Article number={2} title="개인정보의 수집 목적">
          <p>
            입력된 정보는 데모 로그인 상태 유지, 화면 개인화(닉네임 표시·환경설정 보존) 목적으로만
            브라우저 내부에서 사용됩니다. 광고·마케팅·프로파일링 목적으로 활용하지 않습니다.
          </p>
        </Article>

        <Article number={3} title="보유 및 이용기간">
          <p>
            정보는 이용자의 브라우저에 저장된 상태로 유지되며, 이용자가 직접 삭제하거나 브라우저
            저장소를 비우면 즉시 사라집니다. 운영자는 별도의 보관 기간을 두지 않으며 서버에 사본을
            보관하지 않습니다.
          </p>
        </Article>

        <Article number={4} title="제3자 제공">
          <p>
            서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 정보가 브라우저를 벗어나지
            않으므로 외부 위탁·판매·공유가 발생하지 않습니다.
          </p>
        </Article>

        <Article number={5} title="쿠키 및 로컬스토리지 사용">
          <p>
            서비스는 로그인 상태와 화면 설정을 유지하기 위해 브라우저 localStorage를 사용합니다.
            추적용 제3자 쿠키는 사용하지 않으며, 이용자는 브라우저 설정에서 저장소 사용을 거부하거나
            언제든지 삭제할 수 있습니다.
          </p>
        </Article>

        <Article number={6} title="이용자의 권리">
          <p>
            이용자는 본인의 데모 정보를 언제든지 조회·수정·삭제할 수 있습니다. 회원 탈퇴를 선택하면
            저장된 localStorage 데이터가 즉시 삭제되며, 브라우저 캐시·저장소를 직접 비우는 방법으로도
            모든 정보를 제거할 수 있습니다.
          </p>
        </Article>

        <Article number={7} title="개인정보 보호 책임">
          <p>
            정보가 서버로 전송되지 않으므로 외부 유출 위험이 구조적으로 차단됩니다. 다만 공용 기기를
            사용하는 경우 다른 사람이 브라우저 저장소에 접근할 수 있으므로, 이용 후 로그아웃 또는
            데이터 삭제를 권장합니다.
          </p>
        </Article>

        <Article number={8} title="처리방침의 변경 고지">
          <p>
            본 처리방침이 변경될 경우 적용 일자와 변경 내용을 서비스 화면에 게시하여 안내합니다.
            중요한 변경 사항은 시행 전 충분한 기간을 두고 공지합니다.
          </p>
        </Article>

        <Article number={9} title="시행일">
          <p>본 개인정보처리방침은 {EFFECTIVE_DATE}부터 적용됩니다.</p>
        </Article>
      </div>
    </article>
  )
}

/** 정적 폴백 문서. 원격 클라이언트가 없거나 조회에 실패하면 이 본문을 그대로 보여준다. */
function StaticDocument({
  document,
  onNavigate,
}: {
  document: DocumentId
  onNavigate: (route: AppRoute) => void
}) {
  return document === 'terms' ? <TermsDocument onNavigate={onNavigate} /> : <PrivacyDocument />
}

/**
 * TermsDesk(DeskCloud) 게시본을 불러와 렌더한다.
 * - 클라이언트가 null(미설정)이면 즉시 정적 폴백을 보여준다.
 * - 활성 문서가 바뀔 때마다 AbortController로 이전 요청을 취소하고 다시 조회한다.
 * - 조회 실패 시에도 정적 폴백으로 폴백하여 회귀가 없도록 한다.
 * - 본문(body)은 플레인 텍스트로 취급해 whitespace-pre-wrap으로 렌더한다(XSS 방지).
 */
function RemoteTermsDocument({
  document,
  onNavigate,
}: {
  document: DocumentId
  onNavigate: (route: AppRoute) => void
}) {
  const [policy, setPolicy] = useState<PublicPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const client = getTermsClient()
    if (!client) return
    // 동기 setState 금지(react-hooks/set-state-in-effect): 상태 변경은 비동기
    // 콜백에서만 한다. 문서 전환 시 초기 상태는 호출부 key 리마운트로 리셋된다.
    const controller = new AbortController()
    client
      .getCurrent({ slug: TERMS_DESK_SLUGS[document], signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setPolicy(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [document])

  if (loading) {
    return (
      <article className="rounded-lg border border-border bg-surface p-6">
        <p className="text-sm leading-7 text-text-muted">게시본을 불러오는 중…</p>
      </article>
    )
  }

  // 미설정 또는 조회 실패 → 기존 정적 본문(회귀 없음).
  if (failed || !policy) {
    return <StaticDocument document={document} onNavigate={onNavigate} />
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-6">
      <header className="space-y-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="blue" icon={CloudCheck}>
            TermsDesk 게시본 · {policy.versionLabel}
            {policy.effectiveAt ? ` · 시행 ${policy.effectiveAt}` : ''}
          </Chip>
        </div>
        <h2 className="text-xl font-semibold text-text">
          {policy.name || documentTitles[document]}
        </h2>
        {policy.changeSummary ? (
          <p className="text-sm leading-7 text-text-muted">{policy.changeSummary}</p>
        ) : null}
      </header>

      <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-text-muted">
        {policy.body}
      </div>
    </article>
  )
}

export function TermsRoute({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const [activeDocument, setActiveDocument] = useState<DocumentId>('terms')
  // env로 게이트: TermsDesk가 설정되면 게시본을, 미설정이면 정적 데모 본문을 렌더한다.
  const remoteEnabled = getTermsClient() !== null

  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-5 outline-none lg:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">약관·정책 · /terms</p>
              <h1 className="mt-1 text-2xl font-semibold text-text">
                이용약관 및 개인정보처리방침
              </h1>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                AI Digest Desk는 데모/포트폴리오 포털입니다. 아래 문서는 실제 서비스 약관·방침의
                형식과 구성을 보여주기 위한 시연용 내용이며, 법적 효력을 갖지 않습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <Home className="size-3.5" aria-hidden />
              포털로
            </button>
          </div>

          <div className="mt-5">
            <SegmentBar
              label="문서 선택"
              items={documentTabs}
              value={activeDocument}
              onChange={setActiveDocument}
            />
          </div>
        </section>

        {remoteEnabled ? (
          <RemoteTermsDocument
            key={activeDocument}
            document={activeDocument}
            onNavigate={onNavigate}
          />
        ) : (
          <StaticDocument document={activeDocument} onNavigate={onNavigate} />
        )}

        <p className="flex flex-wrap items-center gap-1.5 border-t border-border pt-5 text-xs text-text-subtle">
          {activeDocument === 'terms' ? (
            <FileText className="size-3.5" aria-hidden />
          ) : (
            <ShieldCheck className="size-3.5" aria-hidden />
          )}
          {activeDocument === 'terms' ? '이용약관' : '개인정보처리방침'} · 시행일 {EFFECTIVE_DATE} ·
          데모/포트폴리오 스냅샷 기준
        </p>
      </div>
    </main>
  )
}
