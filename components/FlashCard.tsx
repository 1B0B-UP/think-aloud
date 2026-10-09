'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlashcardWithTopic } from '@/types';
import type { Grade } from '@/lib/fsrs';
import { fsrsUpdate } from '@/lib/fsrs';
import AiChat from './AiChat';
import type { ChatContext } from '@/app/api/chat/route';
import { toDisplayString } from '@/lib/normalize';

interface Props {
  card: FlashcardWithTopic;
  onResult: (grade: Grade, elapsedMs: number) => void;
  disabled?: boolean;
}

// Format an interval in days into a readable label
function fmtInterval(days: number): string {
  if (days < 1)  return '<1d';
  if (days === 1) return '1d';
  if (days < 7)  return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}yr`;
}

// Button config: label, color, bg, border, keyboard hint
const GRADE_UI = {
  1: { label: 'Again',  desc: 'Forgot',          color: '#f87171', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.28)',  key: '1' },
  2: { label: 'Hard',   desc: 'Struggled',        color: '#fb923c', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.28)', key: '2' },
  3: { label: 'Good',   desc: 'Got it',           color: '#4ade80', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.28)',  key: '3' },
  4: { label: 'Easy',   desc: 'Too easy',         color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.28)', key: '4' },
} as const;

const grades: Grade[] = [1, 2, 3, 4];

export default function FlashCard({ card, onResult, disabled = false }: Props) {
  const [phase,   setPhase]   = useState<'pretest' | 'question' | 'revealed'>('question');
  const [showChat, setShowChat] = useState(false);
  const startTime  = useRef(Date.now());
  const revealTime = useRef<number>(0);
  const isNew = card.repetitions === 0;
  const frontText = toDisplayString(card.front);
  const backText = toDisplayString(card.back);
  const elaborationText = toDisplayString(card.elaboration);
  const topicName = toDisplayString(card.topic_name);
  const topicIcon = toDisplayString(card.topic_icon);

  const chatContext: ChatContext = {
    type:  'flashcard',
    topic: topicName,
    front: frontText,
    back:  backText,
  };

  // Pre-compute what each grade would schedule, shown on buttons before user clicks
  const intervalPreviews = useMemo(() => {
    const base = {
      stability:   card.stability ?? 0,
      difficulty:  card.difficulty ?? 5,
      repetitions: card.repetitions ?? 0,
    };
    // Use a small elapsed days for preview (doesn't affect new cards meaningfully)
    const elapsed = Math.max(0.001, (Date.now() - startTime.current) / 86_400_000);
    return Object.fromEntries(
      grades.map(g => [g, fsrsUpdate(base, g, elapsed).interval])
    ) as Record<Grade, number>;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(isNew ? 'pretest' : 'question');
    startTime.current = Date.now();
  }, [card.id, isNew]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (phase === 'pretest' || phase === 'question') {
        if ((e.key === ' ' || e.key === 'Enter') && !e.ctrlKey) {
          e.preventDefault();
          if (phase === 'pretest') { setPhase('question'); }
          else { revealTime.current = Date.now(); setPhase('revealed'); }
        }
      // Don't fire rating shortcuts while the AI chat is open
      } else if (phase === 'revealed' && !disabled && !showChat) {
        // Space / Enter = Good (grade 3) — most common action, frictionless
        if ((e.key === ' ' || e.key === 'Enter') && !e.ctrlKey) {
          e.preventDefault();
          rate(3);
          return;
        }
        const g = parseInt(e.key) as Grade;
        if (g >= 1 && g <= 4) { e.preventDefault(); rate(g); }
        if (e.key === 'ArrowLeft')  rate(1);
        if (e.key === 'ArrowRight') rate(4);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, disabled, showChat]); // eslint-disable-line react-hooks/exhaustive-deps

  function rate(g: Grade) {
    if (disabled) return;
    onResult(g, Date.now() - startTime.current);
  }

  const topicChip = (
    <div style={{
      textAlign: 'center', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{topicIcon} {topicName}</span>
      {card.stability > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '1px 7px',
          borderRadius: 20, letterSpacing: '0.04em',
          background: card.difficulty >= 7 ? 'rgba(239,68,68,0.1)' : card.difficulty >= 5 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
          color:       card.difficulty >= 7 ? '#f87171'             : card.difficulty >= 5 ? '#fb923c'             : '#4ade80',
          border:      `1px solid ${card.difficulty >= 7 ? 'rgba(239,68,68,0.2)' : card.difficulty >= 5 ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)'}`,
        }}>
          {card.difficulty >= 7 ? 'hard' : card.difficulty >= 5 ? 'medium' : 'easy'}
        </span>
      )}
    </div>
  );

  /* ── Pre-test ── */
  if (phase === 'pretest') return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      {topicChip}
      <div style={{
        border: '1px solid rgba(34,211,238,0.28)',
        borderRadius: 'var(--r4)', padding: '36px 44px 28px',
        minHeight: 200, textAlign: 'center',
        backgroundColor: 'var(--s1)',
        backgroundImage: 'linear-gradient(160deg, rgba(34,211,238,0.12) 0%, var(--s1) 70%)',
        boxShadow: '0 0 44px rgba(34,211,238,0.09)',
      }}>
        <span className="badge badge-accent" style={{ marginBottom: 18, display: 'inline-flex' }}>
          New card — try to recall first
        </span>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.65, letterSpacing: '-0.01em', marginBottom: 20, color: 'var(--tx)' }}>
          {frontText}
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto 22px' }}>
          Attempting recall before seeing the answer improves long-term retention by ~40% — even when wrong.
        </p>
        <button
          onClick={() => setPhase('question')}
          className="btn-primary" style={{ padding: '9px 24px', borderRadius: 8 }}
        >
          Show question <kbd style={{ marginLeft: 4 }}>Space</kbd>
        </button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );

  /* ── Question ── */
  if (phase === 'question') return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      {topicChip}
      <div
        onClick={() => { revealTime.current = Date.now(); setPhase('revealed'); }}
        style={{
          backgroundColor: 'var(--s1)', border: '1px solid var(--bd-md)',
          borderRadius: 'var(--r4)', padding: '52px 44px 44px',
          minHeight: 210, cursor: 'pointer', textAlign: 'center', userSelect: 'none',
          boxShadow: 'var(--sh)',
          backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.02) 0%, transparent 60%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          transition: 'border-color 0.12s',
        }}
      >
        <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 18 }}>
          Question
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.65, letterSpacing: '-0.01em', color: 'var(--tx)' }}>
          {frontText}
        </div>
        <div style={{ position: 'absolute', bottom: 14, fontSize: 11, color: 'var(--tx-3)' }}>
          <kbd>Space</kbd> or click to reveal
        </div>
      </div>
      <div style={{ height: 80 }} />
    </div>
  );

  /* ── Revealed + rating ── */
  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      {topicChip}

      {/* Question reference */}
      <div style={{
        backgroundColor: 'var(--s1)',
        border: '1px solid var(--bd)',
        borderRadius: 'var(--r3)',
        padding: '14px 18px',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 7 }}>
          Original question
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--tx-2)', fontWeight: 500 }}>
          {frontText}
        </div>
      </div>

      {/* Answer */}
      <div style={{
        backgroundColor: 'var(--s2)',
        backgroundImage: 'linear-gradient(160deg, rgba(34,211,238,0.10) 0%, var(--s2) 80%)',
        border: '1px solid rgba(34,211,238,0.22)', borderRadius: 'var(--r4)',
        padding: '26px 44px', marginBottom: 16,
        boxShadow: '0 0 30px rgba(34,211,238,0.08)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--a-light)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 }}>
          Answer
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.7, color: 'var(--tx)' }}>
          {backText}
        </div>
        {elaborationText && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)', fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Why it matters: </span>
            {elaborationText}
          </div>
        )}
      </div>

      {/* Rating */}
      <RatingBar
        intervalPreviews={intervalPreviews}
        disabled={disabled}
        onRate={rate}
      />

      {/* Ask AI button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
        <button
          onClick={() => setShowChat(true)}
          style={{
            background: 'none',
            border: '1px solid var(--bd-md)',
            borderRadius: 20,
            padding: '5px 14px',
            fontSize: 12,
            color: 'var(--tx-3)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'border-color 0.1s, color 0.1s',
          }}
        >
          <span style={{ fontSize: 13 }}>🤖</span>
          Ask AI a follow-up
        </button>
      </div>

      {showChat && (
        <AiChat
          context={chatContext}
          onClose={() => setShowChat(false)}
          greeting={`I can help you understand "${frontText.slice(0, 60)}${frontText.length > 60 ? '…' : ''}". What would you like to know?`}
        />
      )}
    </div>
  );
}

/* ─── Rating bar ────────────────────────────────────────────────────────────
   Shows 4 buttons in a single row. Each has:
   - Color-coded label
   - Human-readable next-review interval ("3d", "2w", etc.)
   - Keyboard shortcut hint
   "Good" is visually emphasised as the default action.
──────────────────────────────────────────────────────────────────────────── */
function RatingBar({
  intervalPreviews,
  disabled,
  onRate,
}: {
  intervalPreviews: Record<Grade, number>;
  disabled: boolean;
  onRate: (g: Grade) => void;
}) {
  const [hovered, setHovered] = useState<Grade | null>(null);

  return (
    <div>
      {/* Helper text */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, padding: '0 2px',
      }}>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>How well did you know this?</span>
        <span style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>
          <kbd>Space</kbd> = Good &nbsp;·&nbsp; <kbd>1</kbd>–<kbd>4</kbd> to rate
        </span>
      </div>

      {/* Button row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {grades.map(g => {
          const ui  = GRADE_UI[g];
          const days = intervalPreviews[g];
          const isGood = g === 3;
          const isHov  = hovered === g;

          return (
            <button
              key={g}
              disabled={disabled}
              onMouseEnter={() => setHovered(g)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onRate(g)}
              style={{
                flex: isGood ? 1.25 : 1, // Good is slightly wider
                padding: isGood ? '14px 8px' : '12px 8px',
                borderRadius: 10,
                border: `1px solid ${isHov ? ui.color + '80' : ui.border}`,
                background: isHov ? ui.color + '20' : ui.bg,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                transition: 'background 0.1s, border-color 0.1s, transform 0.08s',
                transform: isHov && !disabled ? 'translateY(-1px)' : 'none',
                boxShadow: isHov && !disabled ? `0 4px 12px ${ui.color}20` : 'none',
                // "Good" gets a subtle extra glow
                ...(isGood && !isHov ? { borderColor: 'rgba(74,222,128,0.35)' } : {}),
              }}
            >
              {/* Label */}
              <span style={{ fontSize: 13, fontWeight: 700, color: ui.color, letterSpacing: '-0.01em' }}>
                {ui.label}
              </span>

              {/* Next review interval — the key UX improvement */}
              <span style={{
                fontSize: 11.5, fontWeight: 600,
                color: isHov ? ui.color : 'var(--tx-2)',
                letterSpacing: '-0.01em',
                transition: 'color 0.1s',
              }}>
                {fmtInterval(days)}
              </span>

              {/* Keyboard hint */}
              <kbd style={{
                fontSize: 9.5, opacity: 0.55, marginTop: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, padding: '1px 5px',
                color: 'var(--tx-3)',
              }}>
                {isGood ? 'Space' : ui.key}
              </kbd>
            </button>
          );
        })}
      </div>

      {/* Subtle description line — explains what the hovered button means */}
      <div style={{ height: 18, marginTop: 8, textAlign: 'center', fontSize: 11, color: 'var(--tx-3)' }}>
        {hovered ? (
          <span>
            <span style={{ color: GRADE_UI[hovered].color, fontWeight: 600 }}>{GRADE_UI[hovered].label}</span>
            {' — '}{GRADE_UI[hovered].desc} · next review in {fmtInterval(intervalPreviews[hovered])}
          </span>
        ) : (
          <span style={{ opacity: 0.6 }}>← Again &nbsp;&nbsp; Easy →</span>
        )}
      </div>
    </div>
  );
}
