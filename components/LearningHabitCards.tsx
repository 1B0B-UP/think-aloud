import Link from 'next/link';

export const LEARNING_HABITS = [
  {
    name: 'Retrieve first',
    short: 'Start by pulling answers from memory before rereading.',
    action: 'Do due flashcards or one closed-book problem.',
    href: '/drill',
    accent: 'var(--green)',
  },
  {
    name: 'Space the review',
    short: 'Let a little forgetting happen, then come back to the same idea.',
    action: 'Review due cards today; leave easy cards for later.',
    href: '/focus',
    accent: 'var(--sky)',
  },
  {
    name: 'Interleave topics',
    short: 'Mix problem types so you practice choosing the method.',
    action: 'Alternate math, FE formulas, and core EE topics.',
    href: '/exams',
    accent: 'var(--a-light)',
  },
  {
    name: 'Explain and calibrate',
    short: 'Write what you missed and compare confidence to results.',
    action: 'Use progress weak areas to pick tomorrow’s target.',
    href: '/progress',
    accent: 'var(--amber)',
  },
];

export default function LearningHabitCards({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
      {LEARNING_HABITS.map(habit => (
        <Link
          key={habit.name}
          href={habit.href}
          className="card"
          style={{
            padding: compact ? 12 : 14,
            borderColor: 'var(--bd-md)',
            display: 'block',
            minHeight: compact ? 'auto' : 132,
            background: 'linear-gradient(180deg, var(--s2), var(--s1))',
          }}
        >
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: habit.accent, boxShadow: `0 0 10px ${habit.accent}` }} />
            <span style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 850, lineHeight: 1.2 }}>{habit.name}</span>
          </div>
          <div style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.45, marginBottom: 8 }}>{habit.short}</div>
          <div style={{ color: habit.accent, fontSize: 11.5, fontWeight: 750, lineHeight: 1.35 }}>{habit.action}</div>
        </Link>
      ))}
    </div>
  );
}
