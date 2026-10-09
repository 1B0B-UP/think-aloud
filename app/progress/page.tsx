'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { getSkillLabel } from '@/components/SkillBar';
import type { ProgressData, TopicWithSkill } from '@/types';
import { toDisplayString } from '@/lib/normalize';

interface CardStats {
  total: number;
  new_cards: number;
  learning: number;
  reviewing: number;
  mature: number;
  byTopic: { name: string; icon: string; total: number; avg_stability: number; mature_count: number }[];
  forecast: { day: number; count: number }[];
}

export default function ProgressPage() {
  const [data,    setData]    = useState<ProgressData | null>(null);
  const [cards,   setCards]   = useState<CardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/progress').then(r => r.json()),
      fetch('/api/flashcards/stats').then(r => r.json()),
    ]).then(([p, c]: [ProgressData, CardStats]) => {
      setData(p);
      setCards(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const derived = useMemo(() => data ? deriveProgress(data, cards) : null, [data, cards]);

  if (loading) return (
    <div className="card" style={{ padding: 22, maxWidth: 520 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--tx-2)', fontSize: 13 }}>
        <div className="spinner" /> Loading progress model…
      </div>
    </div>
  );
  if (!data || !derived) return (
    <div className="card" style={{ padding: 22, maxWidth: 520, color: 'var(--tx-2)', fontSize: 13 }}>
      Progress data is not available yet.
    </div>
  );

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="page-title">Progress</div>
          <div className="page-sub">Review load, retention health, and topic readiness</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/drill" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 16px' }}>Drill Due Cards</Link>
          <Link href="/topics" className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 16px' }}>Topics</Link>
        </div>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card-sheen" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>
                {derived.readinessLabel}
              </div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12.5, marginTop: 4 }}>{derived.readinessNote}</div>
            </div>
            <div style={{ color: derived.readinessColor, fontSize: 30, fontWeight: 850, lineHeight: 1 }}>
              {derived.readiness}%
            </div>
          </div>

          <div style={{ height: 9, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${derived.readiness}%`, background: derived.readinessColor, borderRadius: 99 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
            <Metric label="Streak" value={`${data.streak}d`} color="var(--sky)" />
            <Metric label="Today XP" value={`+${data.todayXP}`} color="var(--green)" />
            <Metric label="Due Now" value={String(data.totalDueCards)} color={data.totalDueCards > 0 ? 'var(--sky)' : 'var(--tx-2)'} />
            <Metric label="Mature" value={String(cards?.mature ?? 0)} color="var(--green)" />
          </div>
        </div>

        <ActionPlan data={data} cards={cards} />
      </section>

      {cards && (
        <section className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="section-title">
            Card Pipeline
            <span style={{ color: 'var(--tx-3)', fontWeight: 400, fontSize: 10.5 }}>{cards.total} total cards</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 120px)', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 24, gap: 2 }}>
                {[
                  { count: cards.new_cards, color: 'var(--tx-3)', label: 'New' },
                  { count: cards.learning,  color: 'var(--sky)', label: 'Learning' },
                  { count: cards.reviewing, color: 'var(--a-light)', label: 'Reviewing' },
                  { count: cards.mature,    color: 'var(--green)', label: 'Mature' },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} title={`${s.label}: ${s.count}`} style={{ background: s.color, flex: s.count, borderRadius: 4, opacity: 0.88 }} />
                ))}
              </div>
            </div>
            <Metric label="New" value={String(cards.new_cards)} color="var(--tx-2)" compact />
            <Metric label="Learning" value={String(cards.learning)} color="var(--sky)" compact />
            <Metric label="Reviewing" value={String(cards.reviewing)} color="var(--a-light)" compact />
            <Metric label="Mature" value={String(cards.mature)} color="var(--green)" compact />
          </div>
        </section>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <ChartCard title="XP Trend" subtitle="last 14 days">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={derived.xpData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpProgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="xp" stroke="#38bdf8" fill="url(#xpProgress)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Review Forecast" subtitle="next 7 days">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={derived.forecastData} barSize={22} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="due" radius={[5, 5, 0, 0]}>
                {derived.forecastData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#38bdf8' : '#20203a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <WeakAreas data={data} />
        <StabilityPanel cards={cards} />
      </section>

      <TopicTable topics={data.topicSkills} />
    </div>
  );
}

function ActionPlan({ data, cards }: { data: ProgressData; cards: CardStats | null }) {
  const weak = data.weakAreas[0];
  const forecastTomorrow = cards?.forecast?.[1]?.count ?? 0;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="section-title">Recommended Next</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <ActionRow
          label={data.totalDueCards > 0 ? 'Clear the current review queue' : 'No due cards right now'}
          meta={data.totalDueCards > 0 ? `${data.totalDueCards} cards due now` : `${forecastTomorrow} cards due tomorrow`}
          href={data.totalDueCards > 0 ? '/drill' : '/topics'}
          tone={data.totalDueCards > 0 ? 'sky' : 'green'}
        />
        <ActionRow
          label={weak ? `Reinforce ${toDisplayString(weak.topic)}` : 'Establish a new quiz baseline'}
          meta={weak ? `${weak.score_pct}% score · ${toDisplayString(weak.recommendation)}` : 'Pick a topic and take one quiz'}
          href="/topics"
          tone={weak ? 'red' : 'sky'}
        />
        <ActionRow
          label="Use focus training for recall depth"
          meta="Term recall and sequence memory exercise different retrieval paths"
          href="/focus"
          tone="accent"
        />
      </div>
    </div>
  );
}

function ActionRow({ label, meta, href, tone }: { label: string; meta: string; href: string; tone: 'sky' | 'green' | 'red' | 'accent' }) {
  const colors = {
    sky: ['var(--sky)', 'var(--sky-d)', 'rgba(56,189,248,0.25)'],
    green: ['var(--green)', 'var(--green-d)', 'rgba(34,197,94,0.25)'],
    red: ['var(--red)', 'var(--red-d)', 'rgba(239,68,68,0.25)'],
    accent: ['var(--a-light)', 'var(--a-dim)', 'rgba(34,211,238,0.25)'],
  }[tone];
  return (
    <Link href={href} style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 10,
      alignItems: 'center',
      background: colors[1],
      border: `1px solid ${colors[2]}`,
      borderRadius: 9,
      padding: '11px 12px',
      textDecoration: 'none',
    }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: 'var(--tx)', fontSize: 12.5, fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'block', color: 'var(--tx-2)', fontSize: 11.5, lineHeight: 1.35, marginTop: 2 }}>{meta}</span>
      </span>
      <span style={{ color: colors[0], fontWeight: 800, fontSize: 12 }}>Open →</span>
    </Link>
  );
}

function WeakAreas({ data }: { data: ProgressData }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="section-title">Weak Areas <span style={{ color: 'var(--tx-3)', fontWeight: 400, fontSize: 10.5 }}>AI analysis</span></div>
      {data.weakAreas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.weakAreas.map((w, i) => (
            <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, padding: '11px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--tx)', fontSize: 12.5, fontWeight: 700 }}>{toDisplayString(w.topic)}</span>
                <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 800 }}>{w.score_pct}%</span>
              </div>
              <div style={{ color: 'var(--tx-2)', fontSize: 11.5, lineHeight: 1.45 }}>{toDisplayString(w.recommendation)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--tx-2)', fontSize: 12.5 }}>No weak areas yet. Take a few quizzes to build signal.</div>
      )}
    </div>
  );
}

function StabilityPanel({ cards }: { cards: CardStats | null }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="section-title">Stability Leaders <span style={{ color: 'var(--tx-3)', fontWeight: 400, fontSize: 10.5 }}>avg recall days</span></div>
      {cards && cards.byTopic.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.byTopic.slice(0, 6).map(t => {
            const pct = Math.min(100, (t.avg_stability / 30) * 100);
            const color = t.avg_stability >= 21 ? 'var(--green)' : t.avg_stability >= 7 ? 'var(--sky)' : 'var(--a-light)';
            return (
              <div key={t.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{toDisplayString(t.icon)} {toDisplayString(t.name)}</span>
                  <span style={{ color: 'var(--tx-3)' }}>{t.avg_stability.toFixed(1)}d</span>
                </div>
                <div style={{ height: 6, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: 'var(--tx-2)', fontSize: 12.5 }}>Drill cards to build stability data.</div>
      )}
    </div>
  );
}

function TopicTable({ topics }: { topics: TopicWithSkill[] }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="section-title">Topic Readiness</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) 150px 90px 90px 100px', gap: 12, padding: '0 0 8px', color: 'var(--tx-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
        <span>Topic</span>
        <span>Skill</span>
        <span>Quiz</span>
        <span>Due</span>
        <span>Action</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {topics.map(t => {
          const skill = getSkillLabel(t.level);
          const quiz = t.quiz_total > 0 ? Math.round((t.quiz_correct / t.quiz_total) * 100) : null;
          const due = Number(t.due_count ?? 0);
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) 150px 90px 90px 100px', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--bd)' }}>
              <span style={{ color: 'var(--tx)', fontSize: 12.5, fontWeight: 600 }}>{toDisplayString(t.icon)} {toDisplayString(t.name)}</span>
              <span>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                  <span style={{ color: skill.color, fontWeight: 700 }}>{skill.label}</span>
                  <span style={{ color: 'var(--tx-3)' }}>{t.level}</span>
                </span>
                <span style={{ display: 'block', height: 5, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${t.level}%`, background: skill.color }} />
                </span>
              </span>
              <span style={{ color: quiz === null ? 'var(--tx-3)' : quiz >= 70 ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 12 }}>{quiz === null ? 'New' : `${quiz}%`}</span>
              <span style={{ color: due > 0 ? 'var(--sky)' : 'var(--tx-3)', fontWeight: 800, fontSize: 12 }}>{due}</span>
              <Link href={due > 0 ? `/drill/${t.id}` : `/quiz/${t.id}`} style={{ color: due > 0 ? 'var(--sky)' : 'var(--a-light)', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
                {due > 0 ? 'Drill' : 'Quiz'} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color, compact = false }: { label: string; value: string; color: string; compact?: boolean }) {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, padding: compact ? '8px 10px' : '10px 12px' }}>
      <div style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: compact ? 14 : 18, color, fontWeight: 850 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '18px 18px 12px' }}>
      <div className="section-title">{title}<span style={{ color: 'var(--tx-3)', fontWeight: 400, fontSize: 10.5 }}>{subtitle}</span></div>
      {children}
    </div>
  );
}

function deriveProgress(data: ProgressData, cards: CardStats | null) {
  const xpData = data.weeklyXP.map(d => ({ date: d.date.slice(5), xp: d.xp_earned }));
  const days = ['Today', 'Tmr', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  const forecastData = (cards?.forecast ?? []).map((f, i) => ({ day: days[i], due: f.count }));
  const avgSkill = data.topicSkills.length > 0
    ? Math.round(data.topicSkills.reduce((sum, t) => sum + t.level, 0) / data.topicSkills.length)
    : 0;
  const duePenalty = Math.min(35, data.totalDueCards * 2);
  const weakPenalty = Math.min(30, data.weakAreas.length * 10);
  const readiness = Math.max(0, Math.min(100, Math.round(avgSkill + data.streak * 2 - duePenalty - weakPenalty + 20)));
  const readinessColor = readiness >= 75 ? 'var(--green)' : readiness >= 45 ? 'var(--sky)' : 'var(--red)';
  const readinessLabel = readiness >= 75 ? 'Stable learning rhythm' : readiness >= 45 ? 'Good base, active queue' : 'Review queue needs attention';
  const readinessNote = data.totalDueCards > 0
    ? `${data.totalDueCards} due cards are the biggest near-term lever.`
    : 'Your review queue is clear; use quizzes or focus drills to build signal.';
  return { xpData, forecastData, readiness, readinessColor, readinessLabel, readinessNote };
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--s2)',
  border: '1px solid var(--bd-md)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--tx)',
};
