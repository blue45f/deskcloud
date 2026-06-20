import { CodeBlock } from '@/components/ui/code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PACKAGE_MANAGERS, SDK_PACKAGE } from '@/data/deskCatalog'
import { cn } from '@/utils/cn'

/**
 * 패키지 매니저 설치 탭 — npm / pnpm / yarn / bun.
 * 각 탭은 해당 매니저의 설치 명령을 복사 가능한 CodeBlock 으로 보여 준다.
 * 위젯 스크립트 태그 대신 공식 npm 패키지 `@heejun/deskcloud` 설치를 안내한다.
 */
export function InstallTabs({
  pkg = SDK_PACKAGE,
  className,
}: {
  /** 설치할 패키지 이름. 기본은 통합 SDK. */
  pkg?: string
  className?: string
}) {
  return (
    <Tabs defaultValue={PACKAGE_MANAGERS[0]!.id} className={cn('w-full', className)}>
      <TabsList aria-label="패키지 매니저 선택">
        {PACKAGE_MANAGERS.map((pm) => (
          <TabsTrigger key={pm.id} value={pm.id}>
            {pm.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {PACKAGE_MANAGERS.map((pm) => (
        <TabsContent key={pm.id} value={pm.id} className="mt-3">
          <CodeBlock code={pm.install(pkg)} language="bash" />
        </TabsContent>
      ))}
    </Tabs>
  )
}
