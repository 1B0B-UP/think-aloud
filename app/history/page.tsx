'use client';

import { useEffect, useState } from 'react';
import type { Session, SessionDetail } from '@/types';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<SessionDetail | null>(null);

  useEffect(() => {
    fetch('/api/voice-sessions').then(r => r.json()).then(d => {
      setSessions(d.sessions || []);
      setLoading(false);
    });
  }, []);

  const openSession = async (id: number) => {
    const res = await fetch(`/api/voice-sessions/${id}`);
    const data = (await res.json()) as SessionDetail;
    setOpen(data);
  };

  const deleteSession = async (id: number) => {
    if (!confirm('Delete this session?')) return;
    await fetch(`/api/voice-sessions/${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (open?.id === id) setOpen(null);
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="page-title">History</div>
      <div className="page-sub" style={{ marginBottom: 28 }}>
        Every session you&apos;ve worked through. Tap one to read the conversation.
      </div>

      {loading ? (
        <div style={{ color: 'var(--tx-3)' }}><span className="spinner" /> Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ padding: 26, color: 'var(--tx-2)' }}>
          No sessions yet. Head back home and start one.
        </div>
      ) : (
        sessions.map(s => (
          <div key={s.id} id={`s-${s.id}`} className="history-row" onClick={() => openSession(s.id)} style={{ cursor: 'pointer' }}>
            <div>
              <div className="history-scenario">&ldquo;{s.scenario}&rdquo;</div>
              <div className="history-meta">
                {s.difficulty} · {new Date(s.started_at).toLocaleString()} · {s.completed_at ? 'completed' : 'in progress'} · {s.total_hints} hints
              </div>
            </div>
            <div className="history-score">{s.quality_score ?? '—'}</div>
            <button
              onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
              className="exit-btn"
              aria-label="Delete"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))
      )}

      {open && (
        <div onClick={() => setOpen(null)} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--s1)',
            border: '1px solid var(--bd-md)',
            borderRadius: 'var(--r3)',
            maxWidth: 680,
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: 28,
            boxShadow: 'var(--sh-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="scenario-label">Statement</div>
                <div className="scenario-text" style={{ marginTop: 6 }}>&ldquo;{open.scenario}&rdquo;</div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 10 }}>
                  {open.difficulty} · {new Date(open.started_at).toLocaleString()} · {open.total_hints} hints
                  {open.quality_score !== null && ` · ${open.quality_score}/100`}
                </div>
              </div>
              <button onClick={() => setOpen(null)} className="exit-btn">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>

            {open.summary && (
              <div className="summary-card" style={{ padding: 22, marginBottom: 18 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--a-light)', fontWeight: 700, marginBottom: 8 }}>
                  Coach&apos;s reflection
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15.5, color: 'var(--tx)', lineHeight: 1.6 }}>
                  {open.summary}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {open.steps.map(s => (
                <div key={s.id} style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--a-light)', fontWeight: 700, marginBottom: 8 }}>
                    {s.step_key.replace(/_/g, ' ')} {s.quality !== null && <span style={{ color: 'var(--tx-3)' }}>· quality {s.quality}/5</span>} {s.hints_used > 0 && <span style={{ color: 'var(--tx-3)' }}>· {s.hints_used} hint{s.hints_used > 1 ? 's' : ''}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.6, marginBottom: 8 }}>
                    <strong style={{ color: 'var(--tx-2)' }}>You:</strong> {s.user_text}
                  </div>
                  {s.coach_feedback && (
                    <div style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--a-light)' }}>Coach:</strong> {s.coach_feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
