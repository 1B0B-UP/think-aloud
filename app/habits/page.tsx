'use client';

import Link from 'next/link';
import LearningHabitCards from '@/components/LearningHabitCards';
import DailyStudyPlan from '@/components/DailyStudyPlan';

const LOOP = [
  {
    step: '1',
    title: 'Cold recall',
    time: '8 min',
    body: 'Before opening notes, answer due flashcards or solve one problem from memory. The effort is the point.',
    href: '/drill',
  },
  {
    step: '2',
    title: 'Targeted repair',
    time: '12 min',
    body: 'Use the first miss to pick a narrow repair task: one formula family, one math unit, or one weak topic.',
    href: '/progress',
  },
  {
    step: '3',
    title: 'Mixed practice',
    time: '15 min',
    body: 'Interleave related but different problems so you practice identifying the method, not just repeating it.',
    href: '/math',
  },
  {
    step: '4',
    title: 'Calibration note',
    time: '3 min',
    body: 'Write what felt easy, what fooled you, and what should come back tomorrow.',
    href: '/focus',
  },
];

const ANTI_PATTERNS = [
  'Rereading a whole section without first attempting recall.',
  'Doing ten identical problems in a row after the method is obvious.',
  'Only reviewing what feels fluent.',
  'Waiting until the end of a long session to check mistakes.',
];

export default function HabitsPage() {
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div className="page-title">Learning Habits</div>
          <div className="page-sub">A local study system built around retrieval, spacing, interleaving, feedback, and calibration</div>
        </div>
        <Link href="/focus" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 16px' }}>
          Start Focus
        </Link>
      </div>

      <section className="card-sheen" style={{ padding: 18, marginBottom: 14 }}>
        <div className="section-title">Today’s Study Loop</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {LOOP.map(item => (
            <Link key={item.step} href={item.href} className="card" style={{ padding: 14, display: 'block', background: 'var(--s1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--a)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{item.step}</span>
                <span style={{ color: 'var(--tx)', fontWeight: 850, fontSize: 13 }}>{item.title}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--tx-3)', fontSize: 11 }}>{item.time}</span>
              </div>
              <div style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.5 }}>{item.body}</div>
            </Link>
          ))}
        </div>
      </section>

      <DailyStudyPlan dueCards={0} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.65fr)', gap: 14, alignItems: 'start' }}>
        <section className="card" style={{ padding: 18 }}>
          <div className="section-title">Principles Built Into The App</div>
          <LearningHabitCards />
        </section>

        <section className="card" style={{ padding: 18 }}>
          <div className="section-title">Avoid These</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {ANTI_PATTERNS.map(item => (
              <div key={item} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 11px', color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.45 }}>
                {item}
              </div>
            ))}
          </div>
          <div className="callout callout-accent" style={{ marginTop: 12 }}>
            Good study should feel effortful but bounded. If everything feels fluent, test yourself. If everything feels impossible, narrow the target.
          </div>
        </section>
      </div>
    </div>
  );
}
