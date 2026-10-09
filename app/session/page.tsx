'use client';

import { useState } from 'react';
import VoiceSession from '@/components/VoiceSession';
import { DIFFICULTY_META, TOPIC_SEEDS, type Difficulty } from '@/lib/steps';

type Mode = 'setup' | 'session';

interface ActiveSession {
  id: number;
  scenario: string;
  difficulty: Difficulty;
}

export default function SessionPage() {
  const [mode, setMode] = useState<Mode>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [topic, setTopic] = useState<string>('random');
  const [customScenario, setCustomScenario] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveSession | null>(null);

  const startSession = async () => {
    setError(null);
    setLoading(true);
    try {
      const scenarioRes = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: useCustom ? 'custom' : topic === 'random' ? '' : topic,
          difficulty,
          customScenario: useCustom ? customScenario : undefined,
        }),
      });
      if (!scenarioRes.ok) throw new Error('Could not generate a scenario');
      const { scenario, topic: usedTopic, difficulty: usedDifficulty } = (await scenarioRes.json()) as {
        scenario: string; topic: string; difficulty: Difficulty;
      };

      const sessRes = await fetch('/api/voice-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, topic: usedTopic, difficulty: usedDifficulty }),
      });
      if (!sessRes.ok) throw new Error('Could not create session');
      const { session } = (await sessRes.json()) as { session: { id: number } };

      setActive({ id: session.id, scenario, difficulty: usedDifficulty });
      setMode('session');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'session' && active) {
    return (
      <VoiceSession
        sessionId={active.id}
        scenario={active.scenario}
        difficulty={active.difficulty}
        onExit={() => { setActive(null); setMode('setup'); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="page-title">Set up a session</div>
      <div className="page-sub" style={{ marginBottom: 36 }}>
        Pick a difficulty and a topic — or write your own statement. Then I&apos;ll take it from there.
      </div>

      {/* Difficulty */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Difficulty</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`tier-card ${d === difficulty ? 'is-selected' : ''}`}
            >
              <div className="tier-title">{DIFFICULTY_META[d].label}</div>
              <div className="tier-body">{DIFFICULTY_META[d].description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Topic</div>
        {!useCustom ? (
          <>
            <select value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="random">Surprise me (random)</option>
              {TOPIC_SEEDS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setUseCustom(true)} style={{ marginTop: 14, color: 'var(--a)', fontSize: 13.5, background: 'transparent', padding: 0 }}>
              Or write your own statement instead →
            </button>
          </>
        ) : (
          <>
            <textarea
              value={customScenario}
              onChange={e => setCustomScenario(e.target.value)}
              rows={3}
              placeholder="e.g. Smartphones have made us less capable of sustained attention."
            />
            <button onClick={() => setUseCustom(false)} style={{ marginTop: 14, color: 'var(--tx-2)', fontSize: 13.5, background: 'transparent', padding: 0 }}>
              ← Use a generated statement instead
            </button>
          </>
        )}
      </div>

      {error && <div className="error-banner"><span>{error}</span></div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
        <button
          onClick={startSession}
          disabled={loading || (useCustom && customScenario.trim().length < 4)}
          className="cta-pill primary cta-large"
        >
          {loading ? <><span className="spinner" /> Preparing…</> : <>Start
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 2 }}>
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </>}
        </button>
      </div>
    </div>
  );
}
