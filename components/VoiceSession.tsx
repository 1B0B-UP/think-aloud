'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import MicOrb from './MicOrb';
import {
  VoiceListener, speak, cancelSpeech, primeTTS,
  commandOrContent, joinChunks, finalPolish,
  SpeechQueue, takeSentences,
  isVoiceSupported, type VoiceCommand,
} from '@/lib/voice';
import { STEPS, type StepKey, type Difficulty } from '@/lib/steps';
import { parseCoachTag } from '@/lib/prompts';

type Phase = 'idle' | 'speaking' | 'listening' | 'thinking' | 'summary' | 'done';

interface Props {
  sessionId: number;
  scenario: string;
  difficulty: Difficulty;
  onExit: () => void;
}

interface StepState {
  key: StepKey;
  userText: string;
  coachFeedback: string;
  hintsUsed: number;
  quality: number | null;
}

interface MessageLogItem {
  role: 'coach' | 'user';
  text: string;
  step?: StepKey;
}

export default function VoiceSession({ sessionId, scenario, difficulty, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [interim, setInterim] = useState('');
  const [stepBuffer, setStepBuffer] = useState('');                  // committed final transcripts for current step
  const [stepData, setStepData] = useState<StepState[]>(() =>
    STEPS.map(s => ({ key: s.key, userText: '', coachFeedback: '', hintsUsed: 0, quality: null }))
  );
  const [log, setLog] = useState<MessageLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState<{ summary: string; score: number } | null>(null);
  const [muted, setMuted] = useState(false);

  const listenerRef = useRef<VoiceListener | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const lastCoachMsgRef = useRef<string>('');
  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;
  const stepBufferRef = useRef<string>('');
  stepBufferRef.current = stepBuffer;
  const interimRef = useRef<string>('');
  interimRef.current = interim;
  const stepDataRef = useRef<StepState[]>(stepData);
  stepDataRef.current = stepData;
  const stepIdxRef = useRef<number>(0);
  stepIdxRef.current = stepIdx;
  // Guards against double-fire (orb's native space-to-click + global keydown).
  const submittingRef = useRef<boolean>(false);

  /* ───────── Bootstrap support check ───────── */
  useEffect(() => {
    if (!isVoiceSupported()) {
      setError('Voice features need Chrome, Edge, or Safari. Please switch browsers to use this app fully.');
    }
  }, []);

  /* ───────── Start session — speak intro ───────── */
  const begin = useCallback(() => {
    if (!isVoiceSupported()) return;
    setError(null);
    // Prime TTS engine + nudge Ollama so the first coach call is fast.
    primeTTS();
    fetch('/api/warmup', { method: 'POST' }).catch(() => { /* best effort */ });

    const introText = `Here is your statement. ${scenario}. Let's begin. ${STEPS[0].speak}`;
    setLog([{ role: 'coach', text: introText }]);
    speakIfUnmuted(introText, () => {
      setStepIdx(0);
      startListening({ resetBuffer: true });
    });
  }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakIfUnmuted = (text: string, onEnd?: () => void) => {
    lastCoachMsgRef.current = text;
    if (mutedRef.current) {
      onEnd?.();
      return;
    }
    setPhase('speaking');
    phaseRef.current = 'speaking';
    speak(text, {
      onEnd: () => {
        if (phaseRef.current === 'speaking') onEnd?.();
      },
    });
  };

  /* ───────── STT lifecycle ───────── */
  const startListening = useCallback((opts: { resetBuffer?: boolean } = {}) => {
    if (listenerRef.current) {
      listenerRef.current.abort();
      listenerRef.current = null;
    }
    setInterim('');
    if (opts.resetBuffer) setStepBuffer('');
    setError(null);
    setPhase('listening');

    const listener = new VoiceListener({
      onInterim: text => setInterim(text),
      onFinal: rawText => {
        const { command, content } = commandOrContent(rawText);
        if (content) {
          setStepBuffer(prev => joinChunks(prev, content));
        }
        setInterim('');
        if (command) handleCommand(command);
      },
      onError: msg => setError(msg),
      onEnd: () => { /* class auto-respawns while wantOn */ },
    });
    listenerRef.current = listener;
    listener.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    if (listenerRef.current) {
      listenerRef.current.abort();
      listenerRef.current = null;
    }
  }, []);

  /** Fold any in-flight interim transcript into the committed buffer so it
   *  doesn't get lost when we abort the recognizer to submit. */
  const flushInterim = useCallback(() => {
    const pending = interimRef.current;
    if (!pending) return;
    const { command, content } = commandOrContent(pending);
    if (command) {
      // Voice command in interim — ignore here; the explicit action overrides it.
      return;
    }
    if (content) {
      const next = joinChunks(stepBufferRef.current, content);
      stepBufferRef.current = next;
      setStepBuffer(next);
    }
    interimRef.current = '';
    setInterim('');
  }, []);

  /* ───────── Command dispatcher ───────── */
  const handleCommand = useCallback((cmd: VoiceCommand) => {
    if (phaseRef.current === 'thinking' || phaseRef.current === 'speaking') return;
    if (cmd === 'hint') doHint();
    else if (cmd === 'next') doSubmit();
    else if (cmd === 'skip') doSkip();
    else if (cmd === 'repeat') doRepeat();
    else if (cmd === 'stop') endSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── Action implementations ───────── */

  const doHint = useCallback(async () => {
    if (phaseRef.current === 'thinking' || phaseRef.current === 'speaking') return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      flushInterim();
      stopListening();
      await runCoach({ hint: true });
    } finally {
      submittingRef.current = false;
    }
  }, [flushInterim]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRepeat = useCallback(() => {
    stopListening();
    speakIfUnmuted(lastCoachMsgRef.current, () => startListening({ resetBuffer: false }));
  }, [startListening]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSubmit = useCallback(async () => {
    if (phaseRef.current === 'thinking') return;
    // If coach is mid-speech, let space interrupt and start listening (same as tapping the orb).
    if (phaseRef.current === 'speaking') {
      cancelSpeech();
      startListening({ resetBuffer: false });
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      flushInterim();
      stopListening();
      await runCoach({ hint: false });
    } finally {
      submittingRef.current = false;
    }
  }, [flushInterim, startListening]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSkip = useCallback(async () => {
    if (phaseRef.current === 'thinking' || phaseRef.current === 'speaking') return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      flushInterim();
      stopListening();
      const idx = stepIdxRef.current;
      const data = stepDataRef.current;
      const currentText = finalPolish(joinChunks(data[idx].userText, stepBufferRef.current));
      await saveStepProgress(currentText || '(skipped)', '', data[idx].hintsUsed, 1);
      // Clear local buffer — saved value now lives on stepData.userText.
      stepBufferRef.current = '';
      setStepBuffer('');
      if (idx < STEPS.length - 1) advanceStep();
      else finishSession();
    } finally {
      submittingRef.current = false;
    }
  }, [flushInterim]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── Coach call — streams response and speaks sentence-by-sentence ───────── */
  const runCoach = useCallback(async (opts: { hint: boolean }) => {
    setPhase('thinking');
    phaseRef.current = 'thinking';

    const idx = stepIdxRef.current;
    const data = stepDataRef.current;
    const currentText = finalPolish(joinChunks(data[idx].userText, stepBufferRef.current));

    if (!opts.hint) {
      setLog(prev => [...prev, { role: 'user', text: currentText || '(silence)', step: STEPS[idx].key }]);
    } else {
      setLog(prev => [...prev, { role: 'user', text: '(hint requested)', step: STEPS[idx].key }]);
    }

    const priorSteps = data.slice(0, idx)
      .filter(s => s.userText.trim().length > 0)
      .map(s => ({ stepKey: s.key, userText: s.userText }));

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          stepKey: STEPS[idx].key,
          difficulty,
          priorSteps,
          userText: currentText,
          hintRequested: opts.hint,
        }),
      });
      if (!res.ok || !res.body) throw new Error('Coach is unavailable. Make sure Ollama is running.');

      // Stream chunks → extract complete sentences → enqueue to TTS as they arrive.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const queue = mutedRef.current ? null : new SpeechQueue();
      let buffer = '';
      let full = '';
      let switchedToSpeaking = false;

      const flushSentences = (streamDone: boolean) => {
        const { sentences, remainder } = takeSentences(buffer, streamDone);
        buffer = remainder;
        for (const s of sentences) {
          if (!switchedToSpeaking) {
            switchedToSpeaking = true;
            setPhase('speaking');
            phaseRef.current = 'speaking';
          }
          queue?.enqueue(s);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        full += chunk;
        flushSentences(false);
      }
      flushSentences(true);

      const { body, score, ready } = parseCoachTag(full);
      const finalText = body || 'Hm. Let me think about that.';

      // Update log with the polished body, save progress.
      setLog(prev => [...prev, { role: 'coach', text: finalText, step: STEPS[idx].key }]);
      lastCoachMsgRef.current = finalText;

      const newUserText = currentText;
      const newHints = opts.hint ? data[idx].hintsUsed + 1 : data[idx].hintsUsed;
      const newQuality = opts.hint ? data[idx].quality : score;
      await saveStepProgress(newUserText, finalText, newHints, newQuality);
      // The saved userText now contains everything the user has said this step.
      // Clear the raw buffer so future appends don't duplicate it on screen.
      stepBufferRef.current = '';
      setStepBuffer('');
      interimRef.current = '';
      setInterim('');

      const afterSpeak = () => {
        // If the user cancelled (tapped mic), don't override their state.
        if (phaseRef.current !== 'speaking' && phaseRef.current !== 'thinking') return;
        if (opts.hint) {
          startListening({ resetBuffer: false });
          return;
        }
        if (ready && idx < STEPS.length - 1) {
          advanceStep();
        } else if (ready && idx === STEPS.length - 1) {
          finishSession();
        } else {
          startListening({ resetBuffer: false });
        }
      };

      if (queue) queue.finish(afterSpeak);
      else afterSpeak();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coach error');
      setPhase('listening');
      startListening({ resetBuffer: false });
    }
  }, [scenario, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── Persistence ───────── */
  const saveStepProgress = useCallback(async (userText: string, coachFeedback: string, hintsUsed: number, quality: number | null) => {
    const idx = stepIdxRef.current;
    setStepData(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], userText, coachFeedback, hintsUsed, quality };
      stepDataRef.current = next;
      return next;
    });
    try {
      await fetch(`/api/voice-sessions/${sessionId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepKey: STEPS[idx].key,
          userText,
          coachFeedback,
          hintsUsed,
          quality,
        }),
      });
    } catch { /* swallow */ }
  }, [sessionId]);

  /* ───────── Step navigation ───────── */
  const advanceStep = useCallback(() => {
    const next = stepIdxRef.current + 1;
    setStepIdx(next);
    stepIdxRef.current = next;
    setStepBuffer('');
    setInterim('');
    const intro = `Good. ${STEPS[next].speak}`;
    setLog(prev => [...prev, { role: 'coach', text: intro }]);
    speakIfUnmuted(intro, () => startListening({ resetBuffer: true }));
  }, [startListening]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishSession = useCallback(async () => {
    stopListening();
    setPhase('summary');
    phaseRef.current = 'summary';
    const opener = 'Let me pull this together.';
    setLog(prev => [...prev, { role: 'coach', text: opener }]);
    // Kick off summary fetch and opener speech in parallel — the summary call
    // is the slow leg; speaking the opener masks some of its latency.
    const summaryPromise = fetch(`/api/voice-sessions/${sessionId}/complete`, { method: 'POST' })
      .then(r => r.json() as Promise<{ summary: string; score: number }>);

    speakIfUnmuted(opener, async () => {
      try {
        const data = await summaryPromise;
        setFinalSummary(data);
        setLog(prev => [...prev, { role: 'coach', text: data.summary }]);
        speakIfUnmuted(data.summary, () => {
          setPhase('done');
          phaseRef.current = 'done';
        });
      } catch {
        setError('Could not complete session.');
        setPhase('done');
      }
    });
  }, [sessionId, stopListening]); // eslint-disable-line react-hooks/exhaustive-deps

  const endSession = useCallback(() => {
    stopListening();
    cancelSpeech();
    onExit();
  }, [onExit, stopListening]);

  /* ───────── Cleanup ───────── */
  useEffect(() => {
    return () => {
      stopListening();
      cancelSpeech();
    };
  }, [stopListening]);

  /* ───────── Mute toggle ───────── */
  const toggleMute = () => {
    setMuted(m => {
      const next = !m;
      if (next) cancelSpeech();
      return next;
    });
  };

  /* ───────── Keyboard shortcuts ─────────
     Reads phase from `phaseRef.current`, NOT the React closure, so it always
     sees the latest phase even if the effect hasn't re-bound yet. Accepts both
     `e.key === ' '` and `e.code === 'Space'` (some keyboard layouts differ). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = (target?.isContentEditable ?? false);
      // Ignore key events that have a modifier — those are browser shortcuts.
      const hasMod = e.metaKey || e.ctrlKey || e.altKey;

      const isSpace = e.key === ' ' || e.code === 'Space';
      const isH = e.key === 'h' || e.key === 'H' || e.code === 'KeyH';
      const isEsc = e.key === 'Escape' || e.code === 'Escape';
      const phaseNow = phaseRef.current;

      if (tag === 'TEXTAREA' || tag === 'INPUT' || isEditable) return;
      if (hasMod) return;

      if (isSpace && (phaseNow === 'listening' || phaseNow === 'speaking')) {
        e.preventDefault();
        e.stopPropagation();
        doSubmit();
      } else if (isH && phaseNow === 'listening') {
        e.preventDefault();
        e.stopPropagation();
        doHint();
      } else if (isEsc) {
        endSession();
      }
    };
    // Capture phase so we beat any focused-button native space-to-click handler.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [doSubmit, doHint, endSession]);

  /* ───────── Render ───────── */
  const step = STEPS[stepIdx];
  const orbState =
    phase === 'listening' ? 'listening' :
    phase === 'speaking' || phase === 'summary' ? 'speaking' :
    phase === 'thinking' ? 'thinking' : 'idle';

  const liveText = joinChunks(joinChunks(stepData[stepIdx]?.userText || '', stepBuffer), interim);
  const canSubmit = phase === 'listening' && (stepBuffer.trim().length > 0 || (stepData[stepIdx]?.userText.trim().length ?? 0) > 0 || interim.trim().length > 0);

  return (
    <div className="session-shell">
      {/* Top bar */}
      <div className="session-topbar">
        <button onClick={endSession} className="icon-btn" aria-label="Exit session" title="Exit (Esc)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="step-pills">
          {STEPS.map((s, i) => {
            const isCurrent = i === stepIdx && phase !== 'done' && phase !== 'summary';
            const isDone = i < stepIdx || (phase === 'done' || phase === 'summary' || (i === stepIdx && finalSummary !== null));
            return (
              <div key={s.key} className={`step-pill ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}>
                <span className="step-pill-num">{isDone ? '✓' : i + 1}</span>
                <span className="step-pill-label">{s.title}</span>
              </div>
            );
          })}
        </div>
        <button onClick={toggleMute} className="icon-btn" aria-label={muted ? 'Unmute coach' : 'Mute coach'} title={muted ? 'Coach muted (text only)' : 'Mute coach voice'}>
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6v4h3l4 3V3L5 6H2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M13 5l-3 3M10 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6v4h3l4 3V3L5 6H2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M11 5a3 3 0 0 1 0 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          )}
        </button>
      </div>

      {/* Scenario card */}
      <div className="scenario-card">
        <div className="kicker">Statement</div>
        <div className="scenario-text">&ldquo;{scenario}&rdquo;</div>
      </div>

      {/* Current step prompt */}
      {phase !== 'idle' && phase !== 'done' && (
        <div className="step-prompt">
          <div className="kicker kicker-muted">Step {stepIdx + 1} of {STEPS.length} · {step.title}</div>
          <div className="step-prompt-text">{step.speak}</div>
        </div>
      )}

      {/* Orb */}
      <div className="orb-stage">
        {phase === 'idle' ? (
          <button onClick={begin} className="cta-pill cta-large" disabled={!!error}>
            <span>Begin</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l7 4-7 4V3z" fill="currentColor" /></svg>
          </button>
        ) : (
          <MicOrb
            state={orbState}
            onClick={() => {
              if (phase === 'listening') doSubmit();
              else if (phase === 'speaking' || phase === 'summary') {
                cancelSpeech();
                startListening({ resetBuffer: false });
              }
            }}
            disabled={phase === 'thinking' || phase === 'done'}
          />
        )}
      </div>

      {/* Live transcript */}
      {phase !== 'idle' && phase !== 'done' && (
        <div className="transcript">
          <div className="kicker kicker-muted">
            {phase === 'listening' ? "You're saying" : phase === 'thinking' ? 'Coach is thinking…' : phase === 'speaking' ? 'Coach is speaking…' : 'Your response so far'}
          </div>
          <div className="transcript-text">
            {liveText || <span className="transcript-empty">Speak when you&apos;re ready. I&apos;m listening.</span>}
          </div>
        </div>
      )}

      {/* Action row */}
      {(phase === 'listening' || phase === 'speaking') && (
        <div className="action-row">
          <button onClick={doHint} className="cta-pill ghost" disabled={phase !== 'listening'}>
            <kbd>H</kbd>
            Hint
            {stepData[stepIdx].hintsUsed > 0 && <span className="hint-counter">×{stepData[stepIdx].hintsUsed}</span>}
          </button>
          <button onClick={doSubmit} className="cta-pill primary" disabled={!canSubmit}>
            <kbd>SPACE</kbd>
            Done — react to this
          </button>
        </div>
      )}

      {/* Final summary */}
      {phase === 'done' && finalSummary && (
        <div className="summary-card">
          <div className="summary-score">{finalSummary.score}<span>/100</span></div>
          <div className="summary-text">{finalSummary.summary}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
            <button onClick={onExit} className="cta-pill primary">Back to home</button>
            <button onClick={() => window.location.reload()} className="cta-pill ghost">New session</button>
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <details className="log-details">
          <summary>Conversation transcript</summary>
          <div className="log-list">
            {log.map((m, i) => (
              <div key={i} className={`log-msg log-${m.role}`}>
                <div className="kicker kicker-muted">{m.role === 'coach' ? 'Coach' : 'You'}{m.step ? ` · ${m.step.replace(/_/g, ' ')}` : ''}</div>
                <div className="log-text">{m.text}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Errors */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="icon-btn" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      <div className="shortcut-hint">
        <kbd>Space</kbd> done · <kbd>H</kbd> hint · <kbd>Esc</kbd> exit · say &ldquo;hint&rdquo;, &ldquo;next&rdquo;, or &ldquo;repeat&rdquo;
        <br />
        <span style={{ opacity: 0.7 }}>Spoken punctuation: &ldquo;period&rdquo;, &ldquo;comma&rdquo;, &ldquo;question mark&rdquo; insert it inline.</span>
      </div>
    </div>
  );
}
