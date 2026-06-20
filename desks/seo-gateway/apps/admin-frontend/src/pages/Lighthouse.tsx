import { Share2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { AuthGate } from '../components/AuthGate'
import { api, errorMessage } from '../lib/api'
import { lighthouseScoreBand, lighthouseScoreColor } from '../lib/format'
import { shareOrCopy } from '../lib/share'
import { useStore } from '../lib/store'

import type { LighthouseResult, LighthouseScores } from '../lib/types'

export function Lighthouse() {
  return (
    <AuthGate>
      <LighthouseBody />
    </AuthGate>
  )
}

function LighthouseBody() {
  const t = useStore((s) => s.t)
  const setError = useStore((s) => s.setGlobalError)
  const pushToast = useStore((s) => s.pushToast)
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LighthouseResult | null>(null)

  async function run(e: FormEvent) {
    e.preventDefault()
    if (!url.trim() || running) return
    setRunning(true)
    setResult(null)
    try {
      const r = await api<LighthouseResult>('POST', '/admin/api/lighthouse', { url: url.trim() })
      setResult(r)
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
    } finally {
      setRunning(false)
    }
  }

  const labels: Array<{ key: keyof LighthouseScores; label: string }> = [
    { key: 'performance', label: t('lighthouse.scores.performance') },
    { key: 'accessibility', label: t('lighthouse.scores.accessibility') },
    { key: 'seo', label: t('lighthouse.scores.seo') },
    { key: 'bestPractices', label: t('lighthouse.scores.bestPractices') },
  ]

  // 측정 결과를 사람이 읽을 한 줄 점수표로 공유/복사한다. 네이티브 공유 시트 우선, 미지원 시 클립보드.
  async function shareScores(r: LighthouseResult) {
    const scoreLine = labels.map((l) => `${l.label} ${Math.round(r.scores[l.key])}`).join(' · ')
    const res = await shareOrCopy({
      title: t('lighthouse.share.title'),
      text: `${r.url} — ${scoreLine}`,
      url: r.url,
    })
    if (res === 'copied') pushToast(t('lighthouse.share.copied'), 'success')
    else if (res === 'unsupported') pushToast(t('toast.clipboard.denied'), 'warn')
  }

  return (
    <section className="space-y-4" data-testid="page-lighthouse">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{t('lighthouse.title')}</h2>
      <p className="text-sm text-ink-muted">
        {t('lighthouse.peerDep.pre')}
        <code>lighthouse</code>
        {t('lighthouse.peerDep.mid')}
        <code>chrome-launcher</code>
        {t('lighthouse.peerDep.post')}
      </p>

      <form onSubmit={run} className="panel p-5 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">{t('lighthouse.url.label')}</span>
          <input
            type="url"
            className="input mt-1 w-full px-3 py-2 text-sm"
            placeholder="https://www.example.com/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="btn-primary px-4 py-2 text-sm font-medium"
        >
          {running ? t('btn.running') : t('lighthouse.run')}
        </button>
      </form>

      {result ? (
        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <code className="text-sm">{result.url}</code>
              {result.cached ? (
                <span className="ml-2 badge badge--neutral">{t('lighthouse.cached')}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
                onClick={() => shareScores(result)}
              >
                <Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {t('lighthouse.share')}
              </button>
              <span className="text-xs text-ink-subtle">{result.durationMs}ms</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {labels.map((l) => {
              const score = result.scores[l.key]
              const band = lighthouseScoreBand(score)
              return (
                <div key={l.key} className="bg-panel-2 rounded p-4 text-center">
                  <div className="text-xs text-ink-subtle">{l.label}</div>
                  <div
                    className={`mt-2 font-mono text-2xl font-semibold ${lighthouseScoreColor(score)}`}
                  >
                    {Math.round(score)}
                  </div>
                  {band ? (
                    <span
                      className={`badge mt-2 ${band === 'good' ? 'badge--ok' : band === 'needs' ? 'badge--warn' : 'badge--err'}`}
                    >
                      {t(`lighthouse.band.${band}`)}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
