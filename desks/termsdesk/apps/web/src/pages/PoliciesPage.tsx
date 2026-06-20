import {
  POLICY_TYPES,
  POLICY_TYPE_LABELS,
  createPolicySchema,
  type CreatePolicyInput,
} from '@termsdesk/shared'
import { EyeOff, MoreHorizontal, Plus, ScrollText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { useConfirm } from '@/app/useConfirm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, PolicyTypeBadge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useArchivePolicy, useCreatePolicy, usePolicies } from '@/services/policies'
import { formatRelative } from '@/utils/format'
import { zodFormResolver } from '@/utils/zodFormResolver'

export default function PoliciesPage() {
  useDocumentTitle('약관·정책')
  const { data, isLoading } = usePolicies()
  const archive = useArchivePolicy()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | (typeof POLICY_TYPES)[number]>('all')

  const filtered = useMemo(() => {
    if (!data) return data
    const q = query.trim().toLowerCase()
    return data.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    })
  }, [data, query, typeFilter])

  const hasPolicies = (data?.length ?? 0) > 0
  const filterActive = query.trim() !== '' || typeFilter !== 'all'

  const onArchive = async (slug: string, name: string) => {
    const ok = await confirm({
      title: `'${name}' 정책을 보관할까요?`,
      description:
        '보관된 정책은 목록에서 숨겨집니다. 기존 버전과 동의 영수증은 그대로 유지됩니다.',
      confirmText: '보관',
      danger: true,
    })
    if (!ok) return
    archive.mutate(slug, {
      onSuccess: () => toast.success('정책을 보관했습니다'),
      onError: () => toast.error('보관에 실패했습니다'),
    })
  }

  return (
    <>
      <PageHeader
        title="약관·정책"
        description="회사가 가진 약관·정책 문서를 등록하고 버전을 관리합니다."
        actions={<CreatePolicyDialog />}
      />

      {hasPolicies ? (
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·slug 로 검색"
              aria-label="정책 검색"
              className="pl-9"
            />
          </div>
          <div className="sm:w-44">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              aria-label="종류 필터"
            >
              <option value="all">모든 종류</option>
              {POLICY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {POLICY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !hasPolicies ? (
        <EmptyState
          icon={ScrollText}
          title="등록된 정책이 없습니다"
          description="첫 정책을 등록해 버전 관리와 게시를 시작하세요. (약관 문안은 직접 보유한 것을 등록합니다)"
          action={<CreatePolicyDialog />}
        />
      ) : (filtered?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Search}
          title="검색 결과가 없습니다"
          description="다른 검색어나 종류로 다시 시도해 보세요."
          action={
            filterActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setTypeFilter('all')
                }}
              >
                필터 초기화
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <THead>
              <TR className="bg-surface-2/60">
                <TH>문서</TH>
                <TH className="hidden sm:table-cell">종류</TH>
                <TH>현재 버전</TH>
                <TH className="hidden md:table-cell">버전 수</TH>
                <TH className="hidden lg:table-cell">수정</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {filtered?.map((p) => (
                <TR key={p.id} className="hover:bg-surface-2/50">
                  <TD>
                    <Link to={`/app/policies/${p.slug}`} className="block">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-text hover:text-accent-strong">
                          {p.name}
                        </span>
                        {p.visibility === 'private' ? (
                          <Badge tone="outline" size="sm">
                            <EyeOff className="size-3" aria-hidden />
                            비공개
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-text-subtle">
                        {p.slug}
                      </span>
                    </Link>
                  </TD>
                  <TD className="hidden sm:table-cell">
                    <PolicyTypeBadge type={p.type} />
                  </TD>
                  <TD>
                    {p.currentVersionId ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted">
                          {p.currentVersionLabel}
                        </span>
                        <StatusPill status="published" size="sm" />
                      </span>
                    ) : (
                      <Badge size="sm">미게시</Badge>
                    )}
                  </TD>
                  <TD className="hidden text-text-muted md:table-cell">{p.versionCount}</TD>
                  <TD className="hidden text-xs text-text-subtle lg:table-cell">
                    {formatRelative(p.updatedAt)}
                  </TD>
                  <TD>
                    <Dropdown>
                      <DropdownTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="작업">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem asChild>
                          <Link to={`/app/policies/${p.slug}`}>상세 보기</Link>
                        </DropdownItem>
                        <DropdownItem danger onSelect={() => void onArchive(p.slug, p.name)}>
                          보관하기
                        </DropdownItem>
                      </DropdownContent>
                    </Dropdown>
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

function CreatePolicyDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const create = useCreatePolicy()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof createPolicySchema>, unknown, CreatePolicyInput>({
    resolver: zodFormResolver(createPolicySchema),
    defaultValues: { type: 'terms', jurisdiction: 'KR', slug: '', name: '' },
  })

  const onSubmit = (values: CreatePolicyInput) => {
    create.mutate(values, {
      onSuccess: (p) => {
        toast.success('정책을 등록했습니다')
        setOpen(false)
        reset()
        navigate(`/app/policies/${p.slug}`)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '등록에 실패했습니다'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />새 정책
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 정책 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="이름" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" placeholder="예: 이용약관" {...register('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="slug"
              htmlFor="slug"
              error={errors.slug?.message}
              hint="API 경로로 쓰입니다"
              required
            >
              <Input id="slug" placeholder="terms-of-service" {...register('slug')} />
            </Field>
            <Field label="종류" htmlFor="type">
              <Select id="type" {...register('type')}>
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {POLICY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="설명" htmlFor="description" error={errors.description?.message}>
            <Textarea
              id="description"
              rows={2}
              placeholder="간단한 설명(선택)"
              {...register('description')}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={create.isPending}>
              등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
