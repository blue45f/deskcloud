/**
 * At-a-glance counters for a populated list (tenants / sites). Reads like a
 * small instrument cluster: a primary total, then one tabular figure per
 * segment. Tokens only; no data fetching — the caller passes pre-counted stats.
 */
type Stat = {
  /** Short label under the figure. */
  label: string
  /** The figure. */
  value: number | string
  /** Optional accent dot tone — mirrors the badge tones used in the tables. */
  tone?: 'ok' | 'warn' | 'neutral' | 'accent'
}

const DOT: Record<NonNullable<Stat['tone']>, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  neutral: 'bg-ink-subtle',
  accent: 'bg-accent',
}

export function ListSummary({ stats }: { stats: Stat[] }) {
  return (
    <dl
      className="panel grid grid-cols-2 divide-line sm:flex sm:divide-x sm:divide-y-0"
      data-testid="list-summary"
    >
      {stats.map((s) => (
        <div key={s.label} className="flex-1 px-4 py-3 min-w-0">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
            {s.tone ? (
              <span className={`w-1.5 h-1.5 rounded-full ${DOT[s.tone]}`} aria-hidden="true" />
            ) : null}
            {s.label}
          </dt>
          <dd
            className="font-mono text-xl text-ink mt-1"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
