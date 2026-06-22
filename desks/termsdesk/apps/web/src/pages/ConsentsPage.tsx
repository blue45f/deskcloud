import { Download, FileCheck2, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { DecisionPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, HashTag, Skeleton } from '@/components/ui/feedback'
import { Input, Select } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { apiUrl } from '@/config/urls'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useConsents } from '@/services/consents'
import { usePolicies } from '@/services/policies'
import { formatDateTime } from '@/utils/format'

const METHOD_LABEL: Record<string, string> = {
  checkbox_clickwrap: '클릭랩',
  api: 'API',
  import: '가져오기',
  sso: 'SSO',
}

export default function ConsentsPage() {
  useDocumentTitle('동의 영수증')
  const [subjectRef, setSubjectRef] = useState('')
  const [policySlug, setPolicySlug] = useState('')
  const [decision, setDecision] = useState('')
  const [method, setMethod] = useState('')
  const policies = usePolicies()
  const consents = useConsents({
    subjectRef: subjectRef || undefined,
    policySlug: policySlug || undefined,
    decision: decision || undefined,
    method: method || undefined,
  })

  const exportHref = `${apiUrl('export/consents.csv')}${
    policySlug || subjectRef
      ? `?${new URLSearchParams({ ...(policySlug ? { policySlug } : {}), ...(subjectRef ? { subjectRef } : {}) }).toString()}`
      : ''
  }`

  return (
    <>
      <PageHeader
        title="동의 영수증"
        description="누가 · 어떤 버전(해시)에 · 언제 · 어떻게 동의했는지의 변조 방지 기록입니다."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <a href={exportHref} download>
              <Download className="size-4" />
              CSV 내보내기
            </a>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
          <Input
            value={subjectRef}
            onChange={(e) => setSubjectRef(e.target.value)}
            placeholder="대상 식별자(subjectRef)로 검색"
            className="pl-8"
            aria-label="대상 검색"
          />
        </div>
        <Select
          value={policySlug}
          onChange={(e) => setPolicySlug(e.target.value)}
          className="sm:max-w-[200px]"
          aria-label="정책 필터"
        >
          <option value="">모든 정책</option>
          {policies.data?.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="sm:max-w-[140px]"
          aria-label="결정 필터"
        >
          <option value="">모든 결정</option>
          <option value="accepted">동의</option>
          <option value="declined">거부</option>
          <option value="withdrawn">철회</option>
        </Select>
        <Select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="sm:max-w-[150px]"
          aria-label="방식 필터"
        >
          <option value="">모든 방식</option>
          {Object.entries(METHOD_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {consents.isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (consents.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="동의 영수증이 없습니다"
          description="SDK로 동의를 기록하면 여기에 변조 방지 영수증이 쌓입니다."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <THead>
              <TR className="bg-surface-2/60">
                <TH>대상</TH>
                <TH>정책 · 버전</TH>
                <TH>결정</TH>
                <TH className="hidden sm:table-cell">방식</TH>
                <TH className="hidden lg:table-cell">해시</TH>
                <TH>시각</TH>
              </TR>
            </THead>
            <TBody>
              {consents.data?.map((r) => (
                <TR key={r.id} className="hover:bg-surface-2/50">
                  <TD>
                    <Link
                      to={`/app/consents/${encodeURIComponent(r.subjectRef)}`}
                      className="font-mono text-[0.8125rem] text-text hover:text-accent-strong"
                    >
                      {r.subjectRef}
                    </Link>
                  </TD>
                  <TD>
                    <span className="text-text">{r.policySlug}</span>
                    <span className="ml-1.5 font-mono text-xs text-text-subtle">
                      {r.versionLabel}
                    </span>
                  </TD>
                  <TD>
                    <DecisionPill decision={r.decision} />
                  </TD>
                  <TD className="hidden text-text-muted sm:table-cell">
                    {METHOD_LABEL[r.method] ?? r.method}
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <HashTag hash={r.contentHash} />
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-text-subtle">
                    {formatDateTime(r.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </>
  )
}
