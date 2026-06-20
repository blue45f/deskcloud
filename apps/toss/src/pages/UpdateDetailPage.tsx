import { Button } from '@toss/tds-mobile';
import { useEffect, useState } from 'react';

import { getUpdate } from '../lib/api';
import { shareMessage } from '../lib/toss';
import { navigate } from '../router';
import { theme } from '../theme';
import { Badge } from '../ui';

export function UpdateDetailPage({ id = '' }: { id?: string }) {
  const u = getUpdate(id);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const x = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(x);
  }, [toast]);

  const Header = (
    <header style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 8px', paddingTop: 'env(safe-area-inset-top)',
      position: 'sticky', top: 0, zIndex: 5, background: `color-mix(in oklab, ${theme.bg} 84%, transparent)`, backdropFilter: 'blur(12px)' }}>
      <button type="button" aria-label="뒤로" onClick={() => navigate('/')} className="pressable"
        style={{ width: 44, height: 44, background: 'none', border: 'none', color: theme.text, fontSize: 24, cursor: 'pointer' }}>←</button>
    </header>
  );
  if (!u) return <div style={{ background: theme.bg, minHeight: '100dvh' }}>{Header}<p style={{ textAlign: 'center', color: theme.textMuted, paddingTop: 40 }}>소식을 찾을 수 없어요.</p></div>;

  const share = async () => {
    const r = await shareMessage(`[AI다이제스트] ${u.title}\n${u.summary}`);
    if (r === 'clipboard') setToast('클립보드에 복사했어요.');
  };
  const hasUrl = Boolean(u.url);

  return (
    <div style={{ minHeight: '100dvh', background: theme.bg }}>
      {Header}
      <div className="rise" style={{ padding: `4px 20px ${hasUrl ? 110 : 40}px` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <Badge accent>{u.provider}</Badge>{u.date && <span style={{ fontSize: 13, color: theme.textMuted }}>{u.date}</span>}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.34 }}>{u.title}</h1>

        {u.summary && <p style={{ fontSize: 15.5, lineHeight: 1.78, color: theme.text, margin: '18px 0 0', maxWidth: '72ch' }}>{u.summary}</p>}

        {u.impact && <div style={{ marginTop: 20, padding: 16, borderRadius: theme.radius, background: theme.accentSoft }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.accent, marginBottom: 6 }}>💡 영향</div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: theme.text }}>{u.impact}</p>
        </div>}

        {u.tags?.length ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>{u.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div> : null}

        <div style={{ marginTop: 22 }}>
          <button type="button" onClick={share} className="pressable" style={{ width: '100%', minHeight: 52, borderRadius: 14,
            border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>공유하기</button>
        </div>
      </div>

      {hasUrl && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
          background: `linear-gradient(to top, ${theme.bg} 72%, transparent)`, zIndex: 20 }}>
          <a href={u.url} target="_blank" rel="noopener noreferrer"><Button style={{ width: '100%' }}>공식 문서 보기</Button></a>
        </div>
      )}
      {toast && <div role="status" style={{ position: 'fixed', bottom: 'calc(84px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.82)', color: theme.text, padding: '10px 18px', borderRadius: 999, fontSize: 14 }}>{toast}</div>}
    </div>
  );
}
