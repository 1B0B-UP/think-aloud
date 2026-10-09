'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import FlashCard from './FlashCard';
import AddCardForm from './AddCardForm';
import type { FlashcardWithTopic } from '@/types';
import type { Grade } from '@/lib/fsrs';

interface Props {
  topicId?: string;
}

export default function DrillSession({ topicId }: Props) {
  const [cards, setCards] = useState<FlashcardWithTopic[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, xp: 0, hard: 0 });
  const [topicName, setTopicName] = useState('');
  const [remainingDue,  setRemainingDue]  = useState(0);
  const [showBreak,     setShowBreak]     = useState(false);
  const [loadError,     setLoadError]     = useState('');
  const [submitting,    setSubmitting]    = useState(false); // guard against double-click
  const [, setClock] = useState(0);
  const sessionStart = useRef(Date.now());
  const cardsDrilled = useRef(0);

  const loadCards = useCallback(async () => {
    setLoadError('');
    try {
      const url = topicId ? `/api/flashcards/due?topicId=${topicId}` : '/api/flashcards/due';
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { cards: FlashcardWithTopic[]; total: number };
      setCards(data.cards);
      setRemainingDue(data.total);
    } catch {
      setLoadError('Could not load cards. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCards();
    if (topicId) {
      fetch('/api/topics').then(r => r.json()).then((d: { topics: { id: number; name: string }[] }) => {
        const t = d.topics.find(t => t.id === Number(topicId));
        if (t) setTopicName(t.name);
      });
    }
  }, [loadCards, topicId]);

  useEffect(() => {
    const timer = setInterval(() => setClock(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleResult(grade: Grade, elapsedMs: number) {
    if (submitting) return; // guard against double-click
    setSubmitting(true);

    try {
      const card = cards[index];
      const res  = await fetch('/api/flashcards/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, grade, elapsedMs }),
      });
      const data = await res.json() as { xp?: number; error?: string };

      const correct = grade >= 3;
      setStats(s => ({
        correct: s.correct + (correct ? 1 : 0),
        total:   s.total + 1,
        xp:      s.xp + (data.xp ?? 0),
        hard:    s.hard + (grade <= 2 ? 1 : 0),
      }));

      cardsDrilled.current += 1;

      if (cardsDrilled.current % 20 === 0 && index + 1 < cards.length) {
        setShowBreak(true);
      } else {
        advance();
      }
    } catch {
      // Network/parse error — still advance so the user isn't stuck
      advance();
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    setShowBreak(false);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  async function seedCards() {
    if (!topicId) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/flashcards/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: Number(topicId) }),
      });
      if (!res.ok) throw new Error('Seed failed');
      setLoading(true);
      loadCards();
    } catch {
      setLoadError('AI unavailable — make sure Ollama is running with a model installed.');
    } finally {
      setSeeding(false);
    }
  }

  if (loading) return (
    <div className="card" style={{ padding: 22, maxWidth: 620 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        <div>
          <div style={{ color: 'var(--tx)', fontWeight: 650, fontSize: 14 }}>Loading review queue</div>
          <div style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 2 }}>Finding cards due under FSRS scheduling.</div>
        </div>
      </div>
    </div>
  );

  if (loadError) return (
    <div style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto', paddingTop: 20 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: 'var(--red)', fontSize: 14, marginBottom: 16 }}>{loadError}</div>
      <button onClick={() => { setLoading(true); loadCards(); }} style={{
        background: 'var(--a)', color: '#fff', border: 'none',
        borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer',
      }}>
        Retry
      </button>
    </div>
  );

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.02em' }}>
          {topicId ? 'No cards due' : 'All caught up!'}
        </div>
        <div style={{ color: 'var(--tx-2)', fontSize: 13, marginBottom: 24, lineHeight: 1.55 }}>
          {topicId ? 'Generate flashcards for this topic to start drilling.' : 'No flashcards are due right now.'}
        </div>
        {topicId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340, margin: '0 auto' }}>
            <button onClick={seedCards} disabled={seeding} className="btn-primary" style={{ padding: '10px 24px' }}>
              {seeding ? 'Generating…' : 'Generate Cards with AI'}
            </button>
            <AddCardForm topicId={Number(topicId)} onAdded={loadCards} />
          </div>
        )}
        {!topicId && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link href="/topics" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 18px' }}>Choose a Topic</Link>
            <Link href="/focus" className="btn-ghost" style={{ textDecoration: 'none', padding: '10px 18px' }}>Focus Training</Link>
          </div>
        )}
      </div>
    );
  }

  // ── Break prompt ──────────────────────────────────────────────────────
  if (showBreak) {
    return (
      <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>☕</div>
        <div style={{ fontSize: 18, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.02em' }}>Take a 5-minute break</div>
        <div style={{ color: 'var(--tx-2)', fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
          You&apos;ve reviewed <strong style={{ color: 'var(--tx)' }}>{cardsDrilled.current} cards</strong>.
          Short breaks let your hippocampus consolidate what it just learned.
        </div>
        <div style={{ color: 'var(--tx-3)', fontSize: 12, marginBottom: 24 }}>
          Stand up, look away from the screen, breathe.
        </div>
        <button onClick={advance} className="btn-primary" style={{ padding: '10px 24px' }}>
          Continue drilling →
        </button>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────
  if (done) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const sessionMinutes = Math.round((Date.now() - sessionStart.current) / 60000);
    const sleepSoon = new Date().getHours() >= 20;

    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>
            {pct >= 80 ? '🎯' : pct >= 60 ? '💪' : '📚'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Session Complete</div>
          <div style={{ fontSize: 13, color: 'var(--tx-2)' }}>{sessionMinutes} min · +{stats.xp} XP</div>
        </div>

        {/* Score grid */}
        <div className="card" style={{ padding: '18px 20px', marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
          {[
            { label: 'Score',      value: `${pct}%`,        color: pct >= 70 ? 'var(--green)' : 'var(--amber)' },
            { label: 'Correct',    value: stats.correct,    color: 'var(--green)' },
            { label: 'Hard/Again', value: stats.hard,       color: 'var(--red)' },
            { label: 'Cards',      value: stats.total,      color: 'var(--tx-2)' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.025em' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', marginTop: 3, letterSpacing: '0.07em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {sleepSoon && (
          <div className="callout callout-night" style={{ marginBottom: 10, fontSize: 12.5 }}>
            <span style={{ color: 'var(--a-light)', fontWeight: 650 }}>🌙 Evening tip: </span>
            <span style={{ color: 'var(--tx-2)' }}>
              Reviewing once more right before sleep can boost retention by up to 20% — memory consolidation peaks during sleep.
            </span>
          </div>
        )}

        {stats.hard > 0 && (
          <div className="callout" style={{
            background: 'var(--red-d)', border: '1px solid rgba(239,68,68,0.2)',
            padding: '12px 16px',
            marginBottom: 10, fontSize: 12.5,
          }}>
            <span style={{ color: 'var(--amber)', fontWeight: 650 }}>💡 {stats.hard} hard cards</span>
            {' '}were rated Hard or Again. FSRS will resurface them soon — struggling strengthens recall more than easy reviews.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn-primary"
            style={{ padding: '10px 22px' }}
            onClick={() => { setDone(false); setIndex(0); setStats({ correct: 0, total: 0, xp: 0, hard: 0 }); setLoading(true); cardsDrilled.current = 0; sessionStart.current = Date.now(); loadCards(); }}
          >
            {remainingDue > 0 ? `Next batch (${remainingDue} due) →` : 'Drill Again'}
          </button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
  const elapsedMin = Math.max(0, Math.floor((Date.now() - sessionStart.current) / 60000));
  const remaining = Math.max(0, cards.length - index);
  const quality = pct === null ? 'Warming up' : pct >= 80 ? 'Strong recall' : pct >= 60 ? 'Building recall' : 'Needs reps';

  return (
    <div>
      <div className="card-sheen" style={{ padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {topicName && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>{topicName}</div>}
            <div style={{ fontSize: 14, color: 'var(--tx)', fontWeight: 700 }}>
              Card {index + 1} of {cards.length}
            </div>
          </div>
          <SessionPill label="Quality" value={quality} color={pct === null ? 'var(--tx-2)' : pct >= 70 ? 'var(--green)' : 'var(--sky)'} />
          <SessionPill label="XP" value={`+${stats.xp}`} color="var(--green)" />
        </div>

        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{ width: `${((index + 1) / cards.length) * 100}%`, background: 'var(--a)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          <MiniStat label="Accuracy" value={pct === null ? '--' : `${pct}%`} color={pct === null ? 'var(--tx-3)' : pct >= 70 ? 'var(--green)' : 'var(--sky)'} />
          <MiniStat label="Reviewed" value={String(stats.total)} color="var(--tx-2)" />
          <MiniStat label="Hard" value={String(stats.hard)} color={stats.hard > 0 ? 'var(--red)' : 'var(--tx-3)'} />
          <MiniStat label="Left" value={String(remaining)} color="var(--tx-2)" />
          <MiniStat label="Time" value={`${elapsedMin}m`} color="var(--tx-2)" />
        </div>
      </div>

      <FlashCard key={card.id} card={card} onResult={handleResult} disabled={submitting} />
    </div>
  );
}

function SessionPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'var(--s2)',
      border: '1px solid var(--bd)',
      borderRadius: 9,
      padding: '6px 10px',
      minWidth: 82,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 12, color, fontWeight: 750, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 9px' }}>
      <div style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color, fontWeight: 750 }}>{value}</div>
    </div>
  );
}
