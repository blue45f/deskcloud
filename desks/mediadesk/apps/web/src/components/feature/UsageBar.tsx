import type { UsageDto } from '@mediadesk/shared'

import { formatBytes, formatNumber, formatPercent } from '@/utils/format'

/** 사용량 막대 — 바이트/건수를 플랜 캡 대비로(캡이 null=Pro 면 무제한 표시). */
export function UsageBar({ usage }: { usage: UsageDto }) {
  const bytesFraction = usage.maxBytes ? usage.bytes / usage.maxBytes : 0
  const countFraction = usage.maxCount ? usage.count / usage.maxCount : 0
  const near = bytesFraction >= 0.8 || countFraction >= 0.8

  return (
    <div className="space-y-4">
      <Row
        label="저장 용량"
        valueText={
          usage.maxBytes
            ? `${formatBytes(usage.bytes)} / ${formatBytes(usage.maxBytes)}`
            : `${formatBytes(usage.bytes)} · 무제한(Pro)`
        }
        fraction={bytesFraction}
        capped={usage.maxBytes !== null}
        warn={near}
      />
      <Row
        label="자산 개수"
        valueText={
          usage.maxCount
            ? `${formatNumber(usage.count)} / ${formatNumber(usage.maxCount)}`
            : `${formatNumber(usage.count)} · 무제한(Pro)`
        }
        fraction={countFraction}
        capped={usage.maxCount !== null}
        warn={near}
      />
    </div>
  )
}

function Row({
  label,
  valueText,
  fraction,
  capped,
  warn,
}: {
  label: string
  valueText: string
  fraction: number
  capped: boolean
  warn: boolean
}) {
  const pct = Math.min(100, Math.round(fraction * 100))
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-text">{label}</span>
        <span className="font-mono text-text-muted">{valueText}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={capped ? pct : 0}
        aria-label={`${label} 사용률 ${capped ? formatPercent(fraction) : '무제한'}`}
      >
        <div
          className={`h-full rounded-full transition-[width] ${warn ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: capped ? `${pct}%` : '8%' }}
        />
      </div>
    </div>
  )
}
