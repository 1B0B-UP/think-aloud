'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { ChatContext, ChatMessage } from '@/app/api/chat/route';
import { toDisplayString } from '@/lib/normalize';

interface Props {
  context: ChatContext;
  onClose: () => void;
  greeting?: string;
}

const STARTERS: Record<ChatContext['type'], string[]> = {
  feed: [
    'Explain this concept simply',
    'How is this used in real systems?',
    'What should I know first?',
    'Connect this to other topics I study',
  ],
  flashcard: [
    'Explain this with a real-world example',
    'Why does this matter in practice?',
    'What are common mistakes here?',
    'How does this relate to similar concepts?',
  ],
  quiz: [
    'Why is that the correct answer?',
    'Explain the wrong options',
    'Give me a real-world application',
    'What are common edge cases?',
  ],
  learn: [
    'Summarize the key takeaways',
    'What should I focus on first?',
    'Give me a practical example',
    'How is this used in aerospace systems?',
  ],
  topic: [
    'Give me a quick overview',
    'What are the most important concepts?',
    'How does this apply to real systems?',
    'What should I learn first?',
  ],
  recall: [
    'Help me remember this better',
    'Give me a memory hook or analogy',
    'How does this apply in practice?',
  ],
  math: [
    'Walk me through this step by step',
    'What prerequisite am I missing?',
    'Give me a similar practice problem',
    'How does this show up in EE?',
  ],
  exam: [
    'Walk me through the fastest exam method',
    'Why is my answer wrong?',
    'What formula should I recognize?',
    'Give me a similar FE-style problem',
  ],
};

export default function AiChat({ context, onClose, greeting }: Props) {
  const [messages,  setMessages]  = useState<ChatMessage[]>(
    greeting ? [{ role: 'assistant', content: greeting }] : []
  );
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error,     setError]     = useState('');
  const [mounted,   setMounted]   = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);
  // Stable ref so the Escape handler never goes stale
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Wait for DOM before portaling
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open — clear the timer if the component unmounts before it fires
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Stable Escape handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // intentionally empty — onCloseRef is always current

  // Auto-resize textarea as user types
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    setInput('');
    setError('');
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsg: ChatMessage = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, context }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(
          res.status === 503
            ? 'AI is offline — make sure Ollama is running with a model installed.'
            : `Server error (${res.status})`
        );
      }

      if (!res.body) throw new Error('Response has no body');
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   acc     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // eslint-disable-next-line react-hooks/immutability
        acc += decoder.decode(value, { stream: true });
        setMessages(m => {
          const updated = [...m];
          updated[updated.length - 1] = { role: 'assistant', content: acc };
          return updated;
        });
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // Partial response kept — user stopped it
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setMessages(m => m.slice(0, -1)); // remove empty placeholder
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // inputRef.current may be null if chat was closed during streaming
      if (inputRef.current) inputRef.current.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const starters = STARTERS[context.type] ?? STARTERS.topic;
  // Show starters if user hasn't sent any message yet
  const showStarters = !messages.some(m => m.role === 'user');

  if (!mounted) return null;

  // ── Portal — renders directly into document.body, escaping all stacking contexts ──
  return createPortal(
    <>
      {/* Backdrop — full screen, clicking it closes chat */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.58)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'ns-fadeIn 0.15s ease both',
        }}
      />

      {/* Chat panel — slides up from bottom, respects nav width */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 'var(--nav-w)',
          right: 0,
          height: 'clamp(320px, 52vh, 540px)',
          maxWidth: 860,       // comfortable reading width on ultrawide
          background: 'linear-gradient(180deg, rgba(8,13,26,0.96), rgba(3,7,18,0.94))',
          borderTop: '1px solid var(--bd-md)',
          borderLeft: '1px solid var(--bd)',
          borderRight: '1px solid var(--bd)',
          borderRadius: '14px 14px 0 0',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'ns-slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1) both',
          boxShadow: '0 -18px 70px rgba(0,0,0,0.62), 0 0 46px rgba(34,211,238,0.08), 0 -1px 0 var(--bd-md)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 18px',
          borderBottom: '1px solid var(--bd)',
          flexShrink: 0,
          borderRadius: '14px 14px 0 0',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--a) 0%, var(--a-2) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, boxShadow: '0 0 16px var(--a-glow)',
          }}>🤖</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--tx)', lineHeight: 1.1 }}>
              Ask AI
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 1 }}>
              {contextLabel(context)}
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--tx-3)', fontSize: 20, lineHeight: 1,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
            }}
          >×</button>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Starter chips — visible until user sends their first message */}
          {showStarters && (
            <div style={{ paddingBottom: messages.length > 0 ? 4 : 0 }}>
              {messages.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 8 }}>
                  Suggested:
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {starters.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      background: 'var(--s2)',
                      border: '1px solid var(--bd-md)',
                      borderRadius: 20,
                      padding: '5px 11px',
                      fontSize: 11.5,
                      color: 'var(--tx-2)',
                      cursor: 'pointer',
                      transition: 'border-color 0.1s, color 0.1s, background 0.1s',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: m.role === 'user' ? 'var(--a)' : 'var(--s3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: m.role === 'user' ? 10 : 11, fontWeight: 700,
                color: m.role === 'user' ? '#fff' : 'var(--tx-2)',
                marginTop: 1,
              }}>
                {m.role === 'user' ? 'R' : '✦'}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '80%',
                background: m.role === 'user' ? 'var(--a-dim)' : 'var(--s2)',
                border: `1px solid ${m.role === 'user' ? 'rgba(34,211,238,0.22)' : 'var(--bd)'}`,
                borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                padding: '8px 13px',
                fontSize: 13, lineHeight: 1.6, color: 'var(--tx)',
              }}>
                {toDisplayString(m.content)
                  ? <BubbleMarkdown text={toDisplayString(m.content)} />
                  : <ThinkingDots />
                }
              </div>
            </div>
          ))}

          {error && (
            <div style={{
              fontSize: 12, color: 'var(--red)',
              background: 'var(--red-d)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} style={{ height: 1 }} />
        </div>

        {/* ── Input ── */}
        <div style={{
          padding: '8px 14px 12px',
          borderTop: '1px solid var(--bd)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
              // Stop event from bubbling to parent key handlers (e.g. FlashCard rating)
              e.stopPropagation();
            }}
            placeholder="Ask a follow-up… (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1, resize: 'none',
              minHeight: 36, maxHeight: 120,
              background: 'var(--s2)', border: '1px solid var(--bd-md)',
              borderRadius: 8, color: 'var(--tx)',
              padding: '8px 12px', fontSize: 13, outline: 'none',
              fontFamily: 'var(--font)', lineHeight: 1.5,
              overflow: 'auto',
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
          />
          {streaming ? (
            <button
              onClick={stop}
              style={{
                background: 'var(--red-d)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '8px 14px', fontSize: 12,
                color: 'var(--red)', cursor: 'pointer', flexShrink: 0, height: 36,
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="btn-primary"
              style={{ padding: '0 16px', borderRadius: 8, flexShrink: 0, fontSize: 13, height: 36 }}
            >
              Send
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ns-slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes ns-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ns-blink {
          0%, 100% { opacity: 0.2; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </>,
    document.body
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function contextLabel(ctx: ChatContext): string {
  const labels: Record<ChatContext['type'], string> = {
    flashcard: 'Flashcard',
    quiz:      'Quiz question',
    learn:     'Deep-dive',
    recall:    'Term recall',
    topic:     'Topic overview',
    feed:      'Feed',
    math:      'Math problem',
    exam:      'Exam review',
  };
  return `${labels[ctx.type] ?? ctx.type} · ${toDisplayString(ctx.topic)}`;
}

function BubbleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (!line) return <div key={i} style={{ height: 5 }} />;
        if (/^##+ /.test(line)) {
          return <p key={i} style={{ fontWeight: 650, marginBottom: 3, color: 'var(--a-light)' }}>{line.replace(/^##+ /, '')}</p>;
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} style={{ fontWeight: 650, marginBottom: 2 }}>{line.slice(2, -2)}</p>;
        }
        if (/^[-*]\s/.test(line)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--a-light)', flexShrink: 0, marginTop: 2, fontSize: 12 }}>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const m = line.match(/^(\d+)\.\s(.*)/);
          if (m) return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--a-light)', flexShrink: 0, fontWeight: 600, fontSize: 11 }}>{m[1]}.</span>
              <span>{renderInline(m[2])}</span>
            </div>
          );
        }
        return <p key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} style={{
              background: 'var(--s3)', padding: '1px 5px',
              borderRadius: 4, fontSize: 11.5,
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--a-light)',
              border: '1px solid var(--bd)',
            }}>
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          return <strong key={i} style={{ fontWeight: 650 }}>{p.slice(2, -2)}</strong>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--tx-3)',
          display: 'inline-block',
          animation: 'ns-blink 1.2s ease infinite',
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </span>
  );
}
