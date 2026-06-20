import {
  ROLES,
  ROLE_LABELS,
  can,
  inviteMemberSchema,
  type InviteMemberInput,
  type MemberDto,
  type Role,
} from '@termsdesk/shared'
import { ShieldAlert, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { z } from 'zod'

import { useConfirm } from '@/app/useConfirm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useInviteMember, useMembers, useRemoveMember, useUpdateMemberRole } from '@/services/admin'
import { useSession } from '@/services/auth'
import { formatDate } from '@/utils/format'
import { zodFormResolver } from '@/utils/zodFormResolver'

export default function AdminPage() {
  useDocumentTitle('관리자')
  const session = useSession()
  const members = useMembers()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const confirm = useConfirm()

  const me = session.data?.user
  const isAdmin = me ? can(me.role, 'member.manage') : false

  if (session.data && !isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="권한이 없습니다"
        description="구성원 관리는 소유자·관리자만 접근할 수 있습니다."
      />
    )
  }

  const onChangeRole = (m: MemberDto, role: Role) => {
    if (role === m.role) return
    updateRole.mutate(
      { id: m.id, role },
      {
        onSuccess: () =>
          toast.success(`${m.name}의 역할을 ${ROLE_LABELS[role]}(으)로 변경했습니다`),
        onError: (e) => toast.error(e instanceof Error ? e.message : '역할 변경에 실패했습니다'),
      }
    )
  }

  const onRemove = async (m: MemberDto) => {
    const ok = await confirm({
      title: `'${m.name}' 구성원을 삭제할까요?`,
      description: `${m.email} 계정의 접근이 즉시 차단됩니다. 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      danger: true,
    })
    if (!ok) return
    removeMember.mutate(m.id, {
      onSuccess: () => toast.success('구성원을 삭제했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다'),
    })
  }

  return (
    <>
      <PageHeader
        title="관리자"
        description="조직 구성원과 접근 권한을 관리합니다. (소유자·관리자 전용)"
        actions={<InviteMemberDialog />}
      />

      {members.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <THead>
              <TR className="bg-surface-2/60">
                <TH>이름</TH>
                <TH className="hidden sm:table-cell">이메일</TH>
                <TH>역할</TH>
                <TH className="hidden md:table-cell">가입</TH>
                <TH className="w-16 text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {members.data?.map((m) => {
                const isSelf = m.id === me?.id
                return (
                  <TR key={m.id} className="hover:bg-surface-2/40">
                    <TD className="font-medium text-text">
                      {m.name}
                      {isSelf ? (
                        <Badge tone="outline" size="sm" className="ml-2">
                          나
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="hidden text-text-muted sm:table-cell">{m.email}</TD>
                    <TD>
                      <Select
                        aria-label={`${m.name} 역할`}
                        value={m.role}
                        onChange={(e) => onChangeRole(m, e.target.value as Role)}
                        className="h-8 w-32 text-[0.8125rem]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD className="hidden text-xs text-text-subtle md:table-cell">
                      {formatDate(m.createdAt)}
                    </TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${m.name} 삭제`}
                        disabled={isSelf}
                        className="text-text-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-30"
                        onClick={() => void onRemove(m)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-xs text-text-subtle">
        역할: 소유자·관리자(전체), 게시자(게시 가능), 편집자(초안 작성), 뷰어(읽기). 마지막 소유자는
        삭제·강등할 수 없습니다.
      </p>
    </>
  )
}

function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const invite = useInviteMember()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof inviteMemberSchema>, unknown, InviteMemberInput>({
    resolver: zodFormResolver(inviteMemberSchema),
    defaultValues: { role: 'viewer', email: '', name: '', password: '' },
  })

  const onSubmit = (values: InviteMemberInput) => {
    invite.mutate(values, {
      onSuccess: () => {
        toast.success('구성원을 추가했습니다')
        setOpen(false)
        reset()
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '추가에 실패했습니다'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          구성원 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구성원 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름" htmlFor="a-name" error={errors.name?.message} required>
              <Input id="a-name" {...register('name')} />
            </Field>
            <Field label="역할" htmlFor="a-role">
              <Select id="a-role" {...register('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="이메일" htmlFor="a-email" error={errors.email?.message} required>
            <Input id="a-email" type="email" {...register('email')} />
          </Field>
          <Field
            label="초기 비밀번호"
            htmlFor="a-pw"
            error={errors.password?.message}
            hint="최소 8자"
            required
          >
            <Input id="a-pw" type="text" {...register('password')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={invite.isPending}>
              추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
