'use client';

import { useState } from 'react';

interface Props {
  topicId: number;
  onAdded: () => void;
}

export default function AddCardForm({ topicId, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [elaboration, setElaboration] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    await fetch('/api/flashcards/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, front, back, elaboration: elaboration || null }),
    });
    setFront('');
    setBack('');
    setElaboration('');
    setSaving(false);
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: '1px dashed var(--bd)', borderRadius: 8,
          color: 'var(--tx-2)', padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%',
        }}
      >
        + Add Card Manually
      </button>
    );
  }

  return (
    <div style={{
      background: 'var(--s2)', border: '1px solid var(--bd)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>New Flashcard</div>
      <textarea
        value={front} onChange={e => setFront(e.target.value)}
        placeholder="Question / front of card"
        rows={2} style={taStyle}
      />
      <textarea
        value={back} onChange={e => setBack(e.target.value)}
        placeholder="Answer / back of card"
        rows={3} style={{ ...taStyle, marginTop: 8 }}
      />
      <textarea
        value={elaboration} onChange={e => setElaboration(e.target.value)}
        placeholder="Why this matters (optional) — a real-world context that makes it stick"
        rows={2} style={{ ...taStyle, marginTop: 8, borderColor: elaboration ? '#f59e0b50' : undefined }}
      />
      {!elaboration && (
        <div style={{ fontSize: 11, color: 'var(--tx-2)', marginTop: 4, marginBottom: 4 }}>
          Tip: adding &quot;why this matters&quot; improves retention — link it to a real system or problem.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={save} disabled={saving || !front.trim() || !back.trim()}
          style={{
            background: (saving || !front.trim() || !back.trim()) ? 'var(--s1)' : 'var(--a)',
            color: (saving || !front.trim() || !back.trim()) ? 'var(--tx-2)' : '#fff',
            border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12,
            cursor: saving ? 'default' : 'pointer', fontWeight: 500,
          }}
        >
          {saving ? 'Saving...' : 'Save Card'}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none', border: '1px solid var(--bd)', borderRadius: 6,
            padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--tx-2)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const taStyle: React.CSSProperties = {
  width: '100%', background: 'var(--s1)', border: '1px solid var(--bd)',
  borderRadius: 6, color: 'var(--tx)', padding: '8px 12px', fontSize: 13,
  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
};
