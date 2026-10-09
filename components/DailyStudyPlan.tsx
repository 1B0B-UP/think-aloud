'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toDisplayString } from '@/lib/normalize';

interface Task {
  id: string;
  label: string;
  reason: string;
  href: string;
  accent: string;
}

interface Props {
  dueCards: number;
  weakTopic?: unknown;
}

export default function DailyStudyPlan({ dueCards, weakTopic }: Props) {
  const storageKey = `te-matemata-plan:${new Date().toISOString().slice(0, 10)}`;
  const weakText = toDisplayString(weakTopic) || 'one weak concept';
  const tasks: Task[] = [
    {
      id: 'recall',
      label: 'Retrieve',
      reason: dueCards > 0 ? `${dueCards} due flashcards` : 'cold-start with 8 flashcards',
      href: '/drill',
      accent: 'var(--green)',
    },
    {
      id: 'repair',
      label: 'Repair',
      reason: weakTopic ? weakText : 'pick one miss and fix it',
      href: '/progress',
      accent: 'var(--sky)',
    },
    {
      id: 'mix',
      label: 'Interleave',
      reason: 'math + FE formula practice',
      href: '/math',
      accent: 'var(--a-light)',
    },
    {
      id: 'reflect',
      label: 'Calibrate',
      reason: 'record what fooled you',
      href: '/habits',
      accent: 'var(--amber)',
    },
  ];

  const [done, setDone] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch { /* ignore local storage failures */ }
    return {};
  });

  function toggle(id: string) {
    setDone(current => {
      const next = { ...current, [id]: !current[id] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function reset() {
    setDone({});
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }

  const completed = tasks.filter(t => done[t.id]).length;
  const progress = Math.round((completed / tasks.length) * 100);
  const nextTask = tasks.find(t => !done[t.id]) ?? tasks[tasks.length - 1];

  return (
    <section className="card-sheen" style={{ padding: 18, marginBottom: 16, borderColor: 'rgba(56,189,248,0.18)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ color: 'var(--sky)', fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Daily Command Center
          </div>
          <div style={{ color: 'var(--tx)', fontSize: 23, fontWeight: 900, lineHeight: 1.05, marginBottom: 8 }}>{progress}% ready</div>
          <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.45, marginBottom: 14 }}>
            A complete session: recall, repair, interleave, then calibrate.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={nextTask.href} className="btn-primary" style={{ textDecoration: 'none', padding: '9px 15px' }}>
              Start {nextTask.label}
            </Link>
            <button onClick={reset} className="btn-ghost" style={{ padding: '9px 12px' }}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 9 }}>
          {tasks.map((task, i) => {
            const checked = !!done[task.id];
            return (
              <div
                key={task.id}
                className="card"
                style={{
                  padding: 12,
                  background: checked ? 'rgba(34,197,94,0.08)' : 'var(--s1)',
                  borderColor: checked ? 'rgba(34,197,94,0.24)' : 'var(--bd)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <button
                    onClick={() => toggle(task.id)}
                    title={checked ? 'Mark incomplete' : 'Mark complete'}
                    style={{
                      width: 25,
                      height: 25,
                      flexShrink: 0,
                      borderRadius: 8,
                      background: checked ? 'var(--green)' : 'var(--s3)',
                      color: checked ? '#031108' : task.accent,
                      border: `1px solid ${checked ? 'rgba(34,197,94,0.35)' : 'var(--bd-md)'}`,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {checked ? '✓' : i + 1}
                  </button>
                  <Link href={task.href} style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 850, lineHeight: 1.2 }}>
                    {task.label}
                  </Link>
                </div>
                <div style={{ color: checked ? 'var(--tx-2)' : 'var(--tx-3)', fontSize: 11.5, lineHeight: 1.35 }}>
                  {task.reason}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
