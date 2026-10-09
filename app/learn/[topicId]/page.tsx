'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AiChat from '@/components/AiChat';
import { toDisplayString } from '@/lib/normalize';

export default function LearnPage() {
  const params  = useParams();
  const topicId = params.topicId as string;

  const [content,   setContent]   = useState('');
  const [topicName, setTopicName] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [showChat,  setShowChat]  = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: Number(topicId) }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then((d: { content?: string; topicName?: string; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setContent(toDisplayString(d.content));
        setTopicName(toDisplayString(d.topicName));
      })
      .catch(e => {
        if (e instanceof Error && e.name === 'AbortError') return; // navigated away
        setError('Failed to generate summary. Check that Ollama is running.');
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort(); // cancel if user navigates away before response
  }, [topicId]);

  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>🤖</div>
      <div style={{ fontSize: 15, color: 'var(--tx-2)', marginBottom: 8 }}>
        Generating deep-dive…
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>
        This can take 30–90 s depending on your model
      </div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', paddingTop: 60, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: 'var(--red)', marginBottom: 8, fontWeight: 600 }}>{error}</div>
      <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 20 }}>
        Make sure Ollama is running and a model is installed:<br />
        <code style={{ color: 'var(--a-light)' }}>ollama pull llama3.2:3b</code>
      </div>
      <Link href="/topics" style={{ color: 'var(--a-light)', fontSize: 13 }}>← Back to Topics</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 780 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/topics" style={{ color: 'var(--tx-2)', fontSize: 13 }}>← Topics</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{topicName}</h1>
          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3 }}>+10 XP earned</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowChat(true)}
            style={{
              background: 'var(--s2)', border: '1px solid var(--bd-md)',
              borderRadius: 8, padding: '7px 14px', fontSize: 12,
              color: 'var(--tx-2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🤖 Ask AI
          </button>
          <Link href={`/quiz/${topicId}`} style={{
            background: 'var(--a)', color: '#fff',
            borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600,
            boxShadow: '0 1px 4px var(--a-glow)',
            display: 'inline-flex', alignItems: 'center',
          }}>
            Take Quiz →
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{
        background: 'var(--s1)',
        border: '1px solid var(--bd)',
        borderRadius: 'var(--r3)',
        padding: '32px 40px',
        lineHeight: 1.75,
        fontSize: 14,
        boxShadow: 'var(--sh)',
      }}>
        <MarkdownRenderer content={content} />
      </div>

      {showChat && (
        <AiChat
          context={{ type: 'learn', topic: topicName }}
          onClose={() => setShowChat(false)}
          greeting={`I can answer questions about ${topicName}. What would you like to know?`}
        />
      )}
    </div>
  );
}

/* ── Markdown renderer ──────────────────────────────────────────────────── */

function MarkdownRenderer({ content }: { content: string }) {
  // Normalize line endings — Ollama can return \r\n on some platforms
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  return (
    <div>
      {lines.map((raw, i) => {
        const line = raw.trimEnd(); // remove trailing whitespace / carriage returns

        if (line.startsWith('## ')) return (
          <h2 key={i} style={{
            fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
            margin: '28px 0 10px', color: 'var(--a-light)',
            borderBottom: '1px solid var(--bd)', paddingBottom: 7,
          }}>
            {line.slice(3)}
          </h2>
        );

        if (line.startsWith('### ')) return (
          <h3 key={i} style={{ fontSize: 14, fontWeight: 650, margin: '18px 0 6px', color: 'var(--tx)' }}>
            {line.slice(4)}
          </h3>
        );

        // Bullet list: - or *
        if (/^[-*]\s/.test(line)) return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
            <span style={{ color: 'var(--a)', flexShrink: 0, marginTop: 1 }}>•</span>
            <span style={{ color: 'var(--tx)' }}>{renderInline(line.slice(2))}</span>
          </div>
        );

        // Numbered list: 1. 2. etc.
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) return (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
              <span style={{ color: 'var(--a)', flexShrink: 0, fontWeight: 600, minWidth: 20, textAlign: 'right', marginTop: 1 }}>
                {match[1]}.
              </span>
              <span style={{ color: 'var(--tx)' }}>{renderInline(match[2])}</span>
            </div>
          );
        }

        // Whole-line bold: **text**
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) return (
          <p key={i} style={{ fontWeight: 650, margin: '10px 0 4px', color: 'var(--tx)' }}>
            {line.slice(2, -2)}
          </p>
        );

        // Horizontal rule
        if (/^---+$/.test(line)) return (
          <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--bd)', margin: '16px 0' }} />
        );

        // Blank line
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;

        // Normal paragraph
        return (
          <p key={i} style={{ margin: '4px 0', color: 'var(--tx)', lineHeight: 1.75 }}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Split on inline code and bold, keeping the delimiters
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text; // fast path: no inline formatting

  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} style={{
              background: 'var(--s2)', padding: '1px 6px', borderRadius: 4,
              fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#a5b4fc',
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
