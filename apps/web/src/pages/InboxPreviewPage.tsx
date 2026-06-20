import { NotificationBell } from '@notifydesk/widget'
import { Inbox, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { SendComposer } from '@/components/feature/SendComposer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiBaseUrl } from '@/services/api'
import { useTemplates, useTenant } from '@/services/notifications'

/**
 * 인박스 프리뷰 — 실제 <NotificationBell> 위젯을 publishable 키로 띄운다.
 * 발송 컴포저로 보낸 알림이 같은 recipientId 의 벨에 즉시 미읽음으로 쌓이고, 벨을 열면 읽음 처리된다.
 * (publishable 경로는 테넌트 CORS 허용목록을 따르므로, 이 origin 이 허용되어 있어야 한다.)
 */
export default function InboxPreviewPage() {
  useDocumentTitle('인박스 프리뷰')
  const tenant = useTenant()
  const templates = useTemplates()

  const [recipientId, setRecipientId] = useState('user_demo')
  // 위젯 재마운트(발송 후 즉시 새로고침)용 nonce.
  const [nonce, setNonce] = useState(0)
  const remount = () => setNonce((n) => n + 1)

  const publishableKey = tenant.data?.publishableKey ?? ''
  const endpoint = apiBaseUrl()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">인박스 프리뷰</h1>
        <p className="mt-1 text-sm text-text-muted">
          실제 알림 벨 위젯을 publishable 키로 띄웁니다. 보낸 알림이 같은 recipientId 벨에 쌓이는지
          바로 확인하세요.
        </p>
      </div>

      {tenant.isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : !publishableKey ? (
        <EmptyState
          icon={Inbox}
          title="publishable 키를 찾을 수 없습니다"
          description="테넌트 정보를 불러오지 못했습니다. 설정에서 키를 확인하거나 다시 로그인해 주세요."
        />
      ) : (
        <>
          <Card>
            <CardHeader
              action={
                <Button variant="secondary" size="sm" onClick={remount}>
                  <RefreshCw className="size-4" /> 벨 새로고침
                </Button>
              }
            >
              <CardTitle>알림 벨</CardTitle>
              <CardDescription>
                publishable: <span className="font-mono">{publishableKey}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <Field
                  label="recipientId"
                  htmlFor="inbox-rid"
                  hint="이 사용자의 인박스를 봅니다."
                  required
                >
                  <Input
                    id="inbox-rid"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="max-w-xs font-mono"
                  />
                </Field>
                <Button variant="secondary" size="sm" onClick={remount} className="mb-px">
                  적용
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-lg border border-border bg-surface-2 px-6 py-8">
                <span className="text-sm text-text-muted">
                  아래 벨을 눌러 인박스를 열어 보세요 →
                </span>
                <div className="relative">
                  <NotificationBell
                    key={`${nonce}-${recipientId}-${publishableKey}`}
                    recipientId={recipientId.trim() || 'user_demo'}
                    publishableKey={publishableKey}
                    endpoint={endpoint}
                    pollIntervalMs={5000}
                    onUnreadChange={(c) => {
                      if (c > 0) console.info('[inbox] unread', c)
                    }}
                  />
                </div>
                <Badge tone="outline" size="sm">
                  5초마다 폴링
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>이 사용자에게 보내기</CardTitle>
              <CardDescription>
                recipientId 가 위 벨과 같으면, 보낸 즉시 벨 배지가 올라갑니다(폴링).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <SendComposer
                  templates={templates.data ?? []}
                  defaultRecipientId={recipientId.trim() || 'user_demo'}
                  onSent={() => {
                    toast.info('벨이 5초 내 갱신됩니다. 즉시 보려면 “벨 새로고침”.')
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
