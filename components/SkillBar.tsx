'use client';

interface Props { level: number; showLabel?: boolean; }

const TIERS = [
  { min: 0,  label: 'Novice',       color: 'var(--sk0)' },
  { min: 21, label: 'Beginner',     color: 'var(--sk1)' },
  { min: 41, label: 'Intermediate', color: 'var(--sk2)' },
  { min: 61, label: 'Advanced',     color: 'var(--sk3)' },
  { min: 81, label: 'Expert',       color: 'var(--sk4)' },
];

export function getSkillLabel(level: number) {
  return [...TIERS].reverse().find(t => level >= t.min) ?? TIERS[0];
}

export default function SkillBar({ level, showLabel = true }: Props) {
  const info = getSkillLabel(level);
  return (
    <div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: info.color }}>
            {info.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--tx-2)' }}>{level}/100</span>
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${level}%`, background: info.color }} />
      </div>
    </div>
  );
}
