'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AiChat from '@/components/AiChat';
import type { ChatContext } from '@/app/api/chat/route';
import { toDisplayString } from '@/lib/normalize';

type Mode = 'menu' | 'pomodoro' | 'recall' | 'sequence';

const FALLBACK_SEQUENCES: Record<string, string[]> = {
  'PID Controls': [
    'Measure the process variable (PV)',
    'Calculate error = setpoint − PV',
    'Compute P term = Kp × error',
    'Compute I term = Ki × ∫error dt (add to integral sum)',
    'Compute D term = Kd × d(error)/dt',
    'Sum P + I + D and send to actuator',
  ],
  'Sequence Diagrams': [
    'Identify all participants (actors and systems)',
    'Define the initial trigger or request message',
    'Trace synchronous calls with filled arrowheads',
    'Show responses as dashed return arrows',
    'Add combined fragments (alt/loop) for conditionals',
    'Label activation bars on each lifeline',
  ],
  'Control Systems (Hardware)': [
    'Sensor measures physical process variable',
    'Signal conditioner filters and scales the signal',
    'ADC converts analog signal to digital',
    'Controller computes error and output command',
    'DAC converts digital command to analog',
    'Actuator applies corrective force to the plant',
  ],
  'Hydraulic Valves': [
    'Pump pressurizes hydraulic fluid from reservoir',
    'Relief valve sets maximum system pressure',
    'Directional control valve routes flow to actuator',
    'Actuator extends or retracts under fluid pressure',
    'Return flow passes through filter back to reservoir',
    'Pressure gauge and sensor monitor system health',
  ],
  'Built-In Test (BIT)': [
    'PBIT executes at system power-on',
    'CPU self-test and memory check complete',
    'I/O hardware connectivity verified',
    'Sensor stimulation and response check performed',
    'BIT results stored in fault register',
    'System reports GO/NO-GO health status',
  ],
  'gRPC': [
    'Define service and message types in .proto file',
    'Compile .proto with protoc to generate stubs',
    'Implement server handler with business logic',
    'Start gRPC server and bind to port',
    'Client creates channel to server address',
    'Client calls stub method and receives response',
  ],
  'Kubernetes': [
    'Write Deployment manifest with container spec',
    'Apply manifest: kubectl apply -f deploy.yaml',
    'Kubernetes scheduler places Pod on a node',
    'kubelet pulls container image and starts Pod',
    'Readiness probe passes — Pod added to Service',
    'Service routes traffic to healthy Pod endpoints',
  ],
  'default': [
    'Identify system requirements and constraints',
    'Design the control architecture and interfaces',
    'Implement hardware and software components',
    'Unit test individual subsystems',
    'Integrate and perform system-level testing',
    'Deploy, monitor, and validate in operation',
  ],
};

export default function FocusPage() {
  const [mode, setMode] = useState<Mode>('menu');

  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="page-title">Focus Training</div>
          <div className="page-sub">Retrieval, sequencing, and timed deep work</div>
        </div>
        {mode !== 'menu' && (
          <button onClick={() => setMode('menu')} className="btn-ghost" style={{ padding: '9px 16px' }}>All Modes</button>
        )}
      </div>

      {mode === 'menu'     && <FocusMenu onSelect={setMode} />}
      {mode === 'pomodoro' && <PomodoroTimer onBack={() => setMode('menu')} />}
      {mode === 'recall'   && <TermRecall onBack={() => setMode('menu')} />}
      {mode === 'sequence' && <SequenceMemory onBack={() => setMode('menu')} />}
    </div>
  );
}

/* ─── Focus menu ──────────────────────────────────────────────────────────── */

const MODE_META = [
  {
    id:   'pomodoro' as Mode,
    icon: '⏱',
    title: 'Pomodoro Timer',
    desc: '25-minute deep work sessions with 5-min breaks. +20 XP per completed session.',
    accent: 'var(--a)',
    signal: 'Deep work',
    action: 'Start timer',
  },
  {
    id:   'recall' as Mode,
    icon: 'R',
    title: 'Term Recall',
    desc: 'Write the definition from memory, then self-grade. Builds retrieval strength.',
    accent: 'var(--sky)',
    signal: 'Open recall',
    action: 'Practice cards',
  },
  {
    id:   'sequence' as Mode,
    icon: '1→',
    title: 'Sequence Memory',
    desc: 'Memorise ordered steps from engineering processes, then re-arrange them.',
    accent: 'var(--green)',
    signal: 'Procedure order',
    action: 'Train sequence',
  },
];

function FocusMenu({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div>
      <section className="card-sheen" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.4fr) repeat(3, minmax(120px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          <div style={{ minWidth: 0, alignSelf: 'center' }}>
            <div style={{ color: 'var(--tx)', fontSize: 17, fontWeight: 800, marginBottom: 5 }}>Choose the retrieval mode</div>
            <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55 }}>
              Use timer work for attention, recall for definitions, and sequence memory for ordered procedures.
            </div>
          </div>
          <FocusMetric label="Timer" value="25/5" color="var(--a-light)" />
          <FocusMetric label="Recall" value="Due Cards" color="var(--sky)" />
          <FocusMetric label="Sequence" value="Process" color="var(--green)" />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {MODE_META.map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="card-btn"
            style={{
              padding: 18,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'space-between',
              textAlign: 'left',
              minHeight: 190,
              width: '100%',
              borderColor: `${m.accent}45`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: `${m.accent}18`,
                border: `1px solid ${m.accent}35`,
                color: m.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 850,
              }}>{m.icon}</div>
              <span style={{ color: m.accent, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.signal}</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 750, color: 'var(--tx)', marginBottom: 6 }}>{m.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55 }}>{m.desc}</div>
            </div>

            <div style={{ color: m.accent, fontSize: 12, fontWeight: 800, marginTop: 16 }}>{m.action} →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Pomodoro ────────────────────────────────────────────────────────────── */

function PomodoroTimer({ onBack }: { onBack: () => void }) {
  const WORK  = 25 * 60;
  const BREAK =  5 * 60;

  const [phase,     setPhase]     = useState<'work' | 'break'>('work');
  const [remaining, setRemaining] = useState(WORK);
  const [running,   setRunning]   = useState(false);
  const [sessions,  setSessions]  = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref in sync with phase so the interval callback always reads the current value
  const phaseRef = useRef<'work' | 'break'>('work');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r > 1) return r - 1;
        // Timer hit zero — transition phase
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        if (phaseRef.current === 'work') {
          setSessions(s => s + 1);
          fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end', sessionType: 'focus', durationMs: WORK * 1000 }),
          }).catch(() => {});
          setPhase('break');
          setRunning(false);
          return BREAK;
        } else {
          setPhase('work');
          setRunning(false);
          return WORK;
        }
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');
  const pct  = phase === 'work' ? 1 - remaining / WORK : 1 - remaining / BREAK;
  const hexAlpha = Math.round(pct * 255).toString(16).padStart(2, '0');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <button onClick={onBack} style={backBtn}>← Back</button>
      <div className="card-sheen" style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)', gap: 26, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 200, height: 200, borderRadius: '50%',
          border: '6px solid var(--bd)',
          boxShadow: `inset 0 0 0 6px ${phase === 'work' ? '#22d3ee' : '#22c55e'}${hexAlpha}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          margin: '0 auto 24px', background: 'var(--s1)', transition: 'box-shadow 1s linear',
        }}>
          <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</div>
          <div style={{ fontSize: 12, color: phase === 'work' ? 'var(--a)' : 'var(--green)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {phase}
          </div>
        </div>
        </div>

        <div>
          <div style={{ color: 'var(--tx)', fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
            {phase === 'work' ? 'Deep work interval' : 'Recovery interval'}
          </div>
          <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
            Keep one target open. When the interval completes, this session records focus XP locally.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(96px, 1fr))', gap: 8, marginBottom: 16 }}>
            <FocusMetric label="Sessions" value={String(sessions)} color="var(--sky)" />
            <FocusMetric label="XP" value={`+${sessions * 20}`} color="var(--green)" />
            <FocusMetric label="Progress" value={`${Math.round(pct * 100)}%`} color="var(--a-light)" />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setRunning(r => !r)} style={{
            background: running ? 'var(--s2)' : 'var(--a)',
            color: running ? 'var(--tx)' : '#fff',
            border: '1px solid var(--bd)', borderRadius: 10,
            padding: '12px 32px', fontSize: 15, cursor: 'pointer', fontWeight: 600,
          }}>
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button onClick={() => { setRunning(false); setRemaining(WORK); setPhase('work'); }} style={{
            background: 'var(--s1)', color: 'var(--tx-2)',
            border: '1px solid var(--bd)', borderRadius: 10,
            padding: '12px 20px', fontSize: 15, cursor: 'pointer',
          }}>
            ↺
          </button>
          <Link href="/topics" className="btn-ghost" style={{ textDecoration: 'none', padding: '12px 18px' }}>Pick Topic</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Term Recall ─────────────────────────────────────────────────────────── */

function TermRecall({ onBack }: { onBack: () => void }) {
  const [card,     setCard]     = useState<{ front: string; back: string; topic_name: string } | null>(null);
  const [answer,   setAnswer]   = useState('');
  const [phase,    setPhase]    = useState<'writing' | 'comparing'>('writing');
  const [loading,  setLoading]  = useState(true);
  const [score,    setScore]    = useState({ correct: 0, total: 0 });
  const [showChat, setShowChat] = useState(false);
  const cardFront = toDisplayString(card?.front);
  const cardBack = toDisplayString(card?.back);
  const cardTopicName = toDisplayString(card?.topic_name);

  async function loadCard() {
    setLoading(true);
    setAnswer('');
    setPhase('writing');
    try {
      const res  = await fetch('/api/flashcards/due');
      if (!res.ok) throw new Error('Failed to load cards');
      const data = await res.json() as { cards: { front: string; back: string; topic_name: string }[] };
      if (data.cards.length > 0) {
        const idx = Math.floor(Math.random() * Math.min(data.cards.length, 20));
        setCard(data.cards[idx]);
      } else {
        setCard(null);
      }
    } catch {
      setCard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCard();
  }, []);

  function reveal() {
    if (!answer.trim()) return;
    setPhase('comparing');
  }

  function grade(correct: boolean) {
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    loadCard();
  }

  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : null;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onBack} style={backBtn}>← Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <FocusMetric label="Correct" value={`${score.correct}/${score.total}`} color="var(--green)" compact />
          <FocusMetric label="Accuracy" value={pct === null ? '--' : `${pct}%`} color={pct === null ? 'var(--tx-3)' : pct >= 70 ? 'var(--green)' : 'var(--sky)'} compact />
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 20, color: 'var(--tx-2)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="spinner" /> Loading recall card…
        </div>
      )}

      {!loading && !card && (
        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>□</div>
          <div style={{ fontSize: 14, color: 'var(--tx-2)' }}>
            No flashcards yet. Generate cards for some topics first.
          </div>
          <Link href="/topics" className="btn-primary" style={{ textDecoration: 'none', padding: '9px 18px', marginTop: 16 }}>Open Topics</Link>
        </div>
      )}

      {!loading && card && (
        <div className="card-sheen" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sky)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
                {cardTopicName}
              </div>
              <div style={{ fontSize: 18, color: 'var(--tx)', fontWeight: 750, lineHeight: 1.45 }}>
                {cardFront}
              </div>
            </div>
            <div style={{ color: phase === 'writing' ? 'var(--sky)' : 'var(--green)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {phase === 'writing' ? 'Recall' : 'Compare'}
            </div>
          </div>

          {phase === 'writing' ? (
            /* ── Writing phase ── */
            <div>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Write the definition from memory..."
                rows={4}
                autoFocus
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)',
                  borderRadius: 8, color: 'var(--tx)', padding: '12px 14px',
                  fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  marginBottom: 12,
                  minHeight: 120,
                }}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) reveal(); }}
              />
              <button onClick={reveal} disabled={!answer.trim()} style={{
                background: answer.trim() ? 'var(--a)' : 'var(--s2)',
                color: answer.trim() ? '#fff' : 'var(--tx-2)',
                border: 'none', borderRadius: 8, padding: '10px 24px',
                fontSize: 13, cursor: answer.trim() ? 'pointer' : 'default', fontWeight: 500,
              }}>
                Reveal Answer <span style={{ opacity: 0.5, fontSize: 10 }}>Ctrl+Enter</span>
              </button>
            </div>
          ) : (
            /* ── Comparing phase ── */
            <div>
              {/* Side-by-side comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{
                  background: 'var(--s2)', border: '1px solid var(--bd)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>
                    Your answer
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tx)' }}>{answer}</div>
                </div>
                <div style={{
                  background: '#1a2d1a', border: '1px solid #1e3d1e',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 10, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>
                    Correct answer
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tx)' }}>{cardBack}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 10, textAlign: 'center' }}>
                How close were you?
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={() => grade(false)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 8,
                  background: 'var(--red-d)', border: '1px solid var(--g1e)',
                  color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  ✗ Missed it
                </button>
                <button onClick={() => grade(true)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 8,
                  background: 'var(--sky-d)', border: '1px solid rgba(56,189,248,0.25)',
                  color: 'var(--sky)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  ~ Close enough
                </button>
                <button onClick={() => grade(true)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 8,
                  background: 'var(--green-d)', border: '1px solid rgba(34,197,94,0.25)',
                  color: 'var(--green)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  ✓ Got it
                </button>
              </div>

              {/* Ask AI about this term */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowChat(true)}
                  style={{
                    background: 'none', border: '1px solid var(--bd-md)',
                    borderRadius: 20, padding: '5px 14px', fontSize: 12,
                    color: 'var(--tx-2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  🤖 Ask AI about this term
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showChat && card && (
        <AiChat
          context={{ type: 'recall', topic: cardTopicName, front: cardFront, back: cardBack } as ChatContext}
          onClose={() => setShowChat(false)}
          greeting={`I can help you understand "${cardFront}" better. What do you want to know?`}
        />
      )}
    </div>
  );
}

/* ─── Sequence Memory ─────────────────────────────────────────────────────── */

function SequenceMemory({ onBack }: { onBack: () => void }) {
  const [steps,        setSteps]        = useState<string[]>([]);
  const [shuffled,     setShuffled]     = useState<string[]>([]);
  const [order,        setOrder]        = useState<number[]>([]);
  const [phase,        setPhase]        = useState<'loading' | 'memorize' | 'arrange' | 'result'>('loading');
  const [showChat,     setShowChat]     = useState(false);
  const [topicName,    setTopicName]    = useState('');
  const [score,        setScore]        = useState(0);
  const [memorizeTime, setMemorizeTime] = useState(10);
  // Snapshot of order at check time, separate from live order state
  const [resultOrder,  setResultOrder]  = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function loadSequence() {
    clearTimer();
    setScore(0);
    setResultOrder([]);
    setPhase('loading');

    try {
      const topicsRes  = await fetch('/api/topics');
      if (!topicsRes.ok) throw new Error('Failed to load topics');
      const topicsData = await topicsRes.json() as { topics: { id: number; name: string }[] };
      const topicList  = topicsData.topics ?? [];
      if (topicList.length === 0) throw new Error('No topics available');

      const randomValues = new Uint32Array(1);
      crypto.getRandomValues(randomValues);
      const t = topicList[randomValues[0] % topicList.length];
      setTopicName(t.name);

      try {
        const seqRes = await fetch('/api/focus/sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId: t.id, topicName: t.name }),
        });
        if (seqRes.ok) {
          const seqData = await seqRes.json() as { steps: string[] };
          if (seqData.steps?.length >= 3) {
            applySteps(seqData.steps);
            return;
          }
        }
      } catch { /* AI unavailable — use fallback */ }

      applySteps(FALLBACK_SEQUENCES[t.name] ?? FALLBACK_SEQUENCES['default']);
    } catch {
      // Couldn't load topics — use generic fallback
      setTopicName('Engineering Process');
      applySteps(FALLBACK_SEQUENCES['default']);
    }
  }

  function applySteps(s: string[]) {
    const shuffledCopy = [...s].sort(() => Math.random() - 0.5);
    setSteps(s);
    setShuffled(shuffledCopy);
    setOrder(Array.from({ length: s.length }, (_, i) => i));
    startMemorize();
  }

  function startMemorize() {
    clearTimer();               // defensive: clear again before starting
    setPhase('memorize');
    setMemorizeTime(10);
    timerRef.current = setInterval(() => {
      setMemorizeTime(t => {
        if (t <= 1) {
          clearTimer();
          setPhase('arrange');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSequence();
    return clearTimer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...order];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setOrder(next);
  }

  function moveDown(i: number) {
    if (i === order.length - 1) return;
    const next = [...order];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setOrder(next);
  }

  function check() {
    // Snapshot the order now so results render with the submitted arrangement
    const snapshot = [...order];
    setResultOrder(snapshot);

    let correct = 0;
    for (let i = 0; i < steps.length; i++) {
      if (shuffled[snapshot[i]] === steps[i]) correct++;
    }
    setScore(correct);
    setPhase('result');
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <button onClick={onBack} style={backBtn}>← Back</button>

      {phase === 'loading' && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--tx-2)', padding: 34 }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          Generating sequence for {topicName || 'a topic'}...
        </div>
      )}

      {phase === 'memorize' && (
        <div className="card-sheen" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--tx)' }}>Memorise this sequence</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 2 }}>{topicName}</div>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: memorizeTime <= 3 ? 'var(--red)' : 'var(--sky)',
              fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right',
            }}>
              {memorizeTime}s
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((s, i) => (
              <div key={i} style={{
                background: 'var(--s1)', border: '1px solid var(--bd)',
                borderRadius: 8, padding: '12px 16px', fontSize: 13,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{ color: 'var(--a)', fontWeight: 700, fontSize: 12, flexShrink: 0, paddingTop: 1 }}>
                  {i + 1}
                </span>
                {toDisplayString(s)}
              </div>
            ))}
          </div>
          <button
            onClick={() => { clearTimer(); setPhase('arrange'); }}
            style={{
              marginTop: 16, background: 'none', border: '1px solid var(--bd)',
              borderRadius: 8, padding: '8px 16px', fontSize: 12,
              color: 'var(--tx-2)', cursor: 'pointer',
            }}
          >
            I&apos;m ready — skip countdown
          </button>
        </div>
      )}

      {phase === 'arrange' && (
        <div className="card-sheen" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--tx)' }}>Re-order the steps correctly</div>
            <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 2 }}>{topicName}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {order.map((stepIdx, i) => (
              <div key={i} style={{
                background: 'var(--s1)', border: '1px solid var(--bd)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <span style={{ color: 'var(--tx-2)', fontSize: 11, fontWeight: 600, flexShrink: 0, minWidth: 16 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>{toDisplayString(shuffled[stepIdx])}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button
                    onClick={() => moveUp(i)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--bd)' : 'var(--tx-2)', fontSize: 12, padding: '1px 6px', lineHeight: 1 }}
                  >▲</button>
                  <button
                    onClick={() => moveDown(i)} disabled={i === order.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === order.length - 1 ? 'default' : 'pointer', color: i === order.length - 1 ? 'var(--bd)' : 'var(--tx-2)', fontSize: 12, padding: '1px 6px', lineHeight: 1 }}
                  >▼</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={check} style={{
            background: 'var(--a)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '11px 28px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
          }}>
            Check Order
          </button>
        </div>
      )}

      {phase === 'result' && (
        <div className="card-sheen" style={{ padding: 20 }}>
          {/* Score header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {score === steps.length
                ? 'Perfect!'
                : `${score} / ${steps.length} correct`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx-2)', marginTop: 4 }}>{topicName}</div>
          </div>

          {/* Step-by-step breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {steps.map((correctStep, i) => {
              const placedStep = toDisplayString(shuffled[resultOrder[i]]);
              const correctStepText = toDisplayString(correctStep);
              const isCorrect  = placedStep === correctStepText;
              return (
                <div key={i} style={{
                  borderRadius: 8, padding: '12px 14px', fontSize: 13,
                  background: isCorrect ? '#1a2d1a' : '#2d1a1a',
                  border: `1px solid ${isCorrect ? '#1e4020' : '#4a2020'}`,
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1 }}>{isCorrect ? '✓' : '✗'}</span>
                    <div style={{ flex: 1 }}>
                      {isCorrect ? (
                        <div style={{ color: '#22c55e' }}>{correctStepText}</div>
                      ) : (
                        <>
                          <div style={{ color: '#ef4444', marginBottom: 4 }}>
                            You placed: {placedStep}
                          </div>
                          <div style={{ color: 'var(--tx-2)', fontSize: 12 }}>
                            Should be: <span style={{ color: 'var(--tx)' }}>{correctStepText}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <span style={{ color: 'var(--tx-2)', fontSize: 11, flexShrink: 0 }}>#{i + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={loadSequence} className="btn-primary" style={{ padding: '10px 24px' }}>
              New Sequence
            </button>
            <button
              onClick={() => setShowChat(true)}
              style={{
                background: 'none', border: '1px solid var(--bd-md)',
                borderRadius: 20, padding: '8px 14px', fontSize: 12,
                color: 'var(--tx-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🤖 Ask AI about these steps
            </button>
          </div>
        </div>
      )}

      {showChat && topicName && (
        <AiChat
          context={{
            type: 'recall',
            topic: topicName,
            front: `Sequence: ${steps.join(' → ')}`,
            back: `This is the correct order for the ${topicName} process.`,
          } as ChatContext}
          onClose={() => setShowChat(false)}
          greeting={`I can explain why these steps are ordered this way for ${topicName}. What's unclear?`}
        />
      )}
    </div>
  );
}

/* ─── Shared styles ───────────────────────────────────────────────────────── */

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--tx-2)',
  cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0,
};

function FocusMetric({ label, value, color, compact = false }: { label: string; value: string; color: string; compact?: boolean }) {
  return (
    <div style={{
      background: 'var(--s2)',
      border: '1px solid var(--bd)',
      borderRadius: 9,
      padding: compact ? '6px 10px' : '10px 12px',
      minWidth: compact ? 84 : undefined,
      minHeight: compact ? 50 : 66,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      overflow: 'hidden',
    }}>
      <div style={{ color: 'var(--tx-3)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, lineHeight: 1.15, width: '100%' }}>
        {label}
      </div>
      <div style={{ color, fontSize: compact ? 12 : 14, fontWeight: 850, lineHeight: 1.15, width: '100%', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}
