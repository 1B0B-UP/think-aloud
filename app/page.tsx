'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface VoiceProgress {
  totalSessions: number;
  completedSessions: number;
  avgScore: number | null;
  streakDays: number;
  recent: { id: number; scenario: string; difficulty: string; started_at: string; completed_at: string | null; quality_score: number | null }[];
}

interface StudyProgress {
  streak?: number;
  todayXP?: number;
  totalDueCards?: number;
  weeklyXP?: { date: string; xp_earned: number }[];
  topicSkills?: { id: number; name: string; icon: string; level: number }[];
  weakAreas?: { topic: string; score_pct: number; recommendation: string }[];
}

export default function HomePage() {
  const [voice, setVoice] = useState<VoiceProgress | null>(null);
  const [study, setStudy] = useState<StudyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/voice-progress').then(r => r.json()).catch(() => null),
      fetch('/api/progress').then(r => r.json()).catch(() => null),
    ]).then(([v, s]) => {
      setVoice(v);
      setStudy(s);
      setLoading(false);
    });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const xpData = (study?.weeklyXP ?? []).map(d => ({ date: d.date.slice(5), xp: d.xp_earned }));
  const totalXP = (study?.weeklyXP ?? []).reduce((sum, d) => sum + d.xp_earned, 0);
  const topSkills = (study?.topicSkills ?? []).filter(t => t.level > 0).slice(0, 5);

  return (
    <div>
      {/* Greeting */}
      <div>
        <div className="display-title">{greeting}.</div>
        <div className="page-sub">Think out loud. Learn deeply. Reflect daily.</div>
      </div>

      {/* Stat row */}
      <div className="stat-grid" style={{ marginTop: 32, marginBottom: 28 }}>
        <Stat label="Voice streak" value={voice?.streakDays ?? 0} suffix=" days" />
        <Stat label="Study streak" value={study?.streak ?? 0} suffix=" days" accent />
        <Stat label="Voice sessions" value={voice?.completedSessions ?? 0} />
        <Stat label="Due cards" value={study?.totalDueCards ?? 0} />
      </div>

      {/* Hero pair — Think + Learn primary CTAs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
        <div className="glass-warm" style={{ padding: '32px 28px' }}>
          <div className="hero-eyebrow">Think</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--tx)', letterSpacing: '-0.024em', marginBottom: 12 }}>
            Talk through a claim.
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--tx-2)', lineHeight: 1.55, marginBottom: 20 }}>
            Voice-driven critical thinking. Four steps: assumptions, support, counter, consequences.
          </div>
          <Link href="/session" className="cta-pill primary">
            Start a session
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          </Link>
        </div>

        <div className="glass" style={{ padding: '32px 28px' }}>
          <div className="hero-eyebrow" style={{ background: 'linear-gradient(135deg, #5ac8fa, #5b6ef5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Learn
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--tx)', letterSpacing: '-0.024em', marginBottom: 12 }}>
            Drill the engineering deck.
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--tx-2)', lineHeight: 1.55, marginBottom: 20 }}>
            Spaced repetition (FSRS), AI quizzes, and deep-dive topic summaries.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/drill" className="cta-pill primary">
              Drill {study?.totalDueCards ? `(${study.totalDueCards})` : ''}
            </Link>
            <Link href="/topics" className="cta-pill ghost">Topics</Link>
          </div>
        </div>
      </div>

      {/* XP chart + Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            XP over time
            <span style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>last 14 days · total {totalXP}</span>
          </div>
          {xpData.length > 0 ? (
            <ResponsiveContainer width="100%" height={156}>
              <AreaChart data={xpData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="xpG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#a85bff" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#5ac8fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--glass-2)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, color: 'var(--tx)' }}
                  cursor={{ stroke: 'var(--a)', strokeWidth: 1, strokeDasharray: '3 2' }}
                />
                <Area type="monotone" dataKey="xp" stroke="#a85bff" fill="url(#xpG)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13.5 }}>
              {loading ? <span className="spinner" /> : 'Complete activities to see your XP curve.'}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Jump in</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/session', label: 'New voice session', meta: 'Think out loud' },
              { href: '/quiz', label: 'AI quiz', meta: 'Test what you know' },
              { href: '/learn', label: 'Deep dive', meta: 'AI topic summary' },
              { href: '/focus', label: 'Focus session', meta: 'Pomodoro-style' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--r-sm)',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)',
                transition: 'background 0.12s, border-color 0.12s',
              }}>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13.5, color: 'var(--tx)' }}>{a.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{a.meta}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent + Top skills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="section-title">Recent voice sessions</div>
          {loading ? (
            <div style={{ color: 'var(--tx-3)' }}><span className="spinner" /></div>
          ) : voice && voice.recent.length > 0 ? (
            voice.recent.slice(0, 4).map(s => (
              <Link key={s.id} href={`/history#s-${s.id}`} style={{ display: 'block' }}>
                <div className="history-row">
                  <div>
                    <div className="history-scenario">&ldquo;{s.scenario}&rdquo;</div>
                    <div className="history-meta">
                      {s.difficulty} · {new Date(s.started_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="history-score">{s.quality_score ?? '—'}</div>
                </div>
              </Link>
            ))
          ) : (
            <div style={{ color: 'var(--tx-3)', fontSize: 13.5 }}>
              No voice sessions yet. <Link href="/session" style={{ color: 'var(--a-2)' }}>Start one →</Link>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Top skills
            <Link href="/progress" style={{ fontSize: 11.5, color: 'var(--a-2)', fontWeight: 500, marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>See all →</Link>
          </div>
          {topSkills.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topSkills.map(t => (
                <div key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{t.icon} {t.name}</span>
                    <span style={{ color: 'var(--tx-3)', fontSize: 11.5 }}>{t.level}/100</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${t.level}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--tx-3)', fontSize: 13.5 }}>
              No skill data yet. Take a quiz or drill cards on any topic.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix = '', accent = false }: { label: string; value: number | string; suffix?: string; accent?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? 'stat-value-accent' : ''}`}>
        {value}{suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
