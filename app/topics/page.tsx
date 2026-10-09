'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AiChat from '@/components/AiChat';
import { getSkillLabel } from '@/components/SkillBar';
import type { TopicWithSkill } from '@/types';
import { toDisplayString } from '@/lib/normalize';

type Filter = 'recommended' | 'due' | 'weak' | 'new' | 'all';
type TopicSuggestion = { name: string; description: string; icon: string };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'due', label: 'Due' },
  { id: 'weak', label: 'Weak' },
  { id: 'new', label: 'New' },
  { id: 'all', label: 'All' },
];

export default function TopicsPage() {
  const [topics,   setTopics]   = useState<TopicWithSkill[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [name,     setName]     = useState('');
  const [desc,     setDesc]     = useState('');
  const [icon,     setIcon]     = useState('🔧');
  const [adding,   setAdding]   = useState(false);
  const [addErr,   setAddErr]   = useState('');
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<Filter>('recommended');
  const [selected, setSelected] = useState<number | null>(null);
  const [chatTopic,setChatTopic]= useState<TopicWithSkill | null>(null);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const load = async () => {
    try {
      const res  = await fetch('/api/topics');
      const data = await res.json() as { topics: TopicWithSkill[] };
      const loaded = data.topics ?? [];
      setTopics(loaded);
      setSelected(current => current ?? loaded[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const seed = name.trim();
    if (!showAdd || seed.length < 3) {
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const res = await fetch('/api/topics/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: seed }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json() as { suggestions: TopicSuggestion[] };
          setSuggestions(data.suggestions ?? []);
        }
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 450);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [name, showAdd]);

  async function addTopic() {
    if (!name.trim()) return;
    setAdding(true);
    setAddErr('');
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc, icon }),
      });
      if (res.ok) {
        setName('');
        setDesc('');
        setIcon('🔧');
        setShowAdd(false);
        await load();
      } else {
        const d = await res.json() as { error: string };
        setAddErr(d.error ?? 'Failed');
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteTopic(id: number) {
    if (!confirm('Delete this topic and all its cards?')) return;
    const res = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      alert(data.error ?? 'Could not delete topic');
      return;
    }
    setSelected(current => current === id ? null : current);
    await load();
  }

  const ranked = useMemo(() => rankTopics(topics), [topics]);
  const selectedTopic = topics.find(t => t.id === selected) ?? ranked[0] ?? null;
  const query = search.trim().toLowerCase();

  const visible = ranked.filter(t => {
    if (query && !toDisplayString(t.name).toLowerCase().includes(query)) return false;
    if (filter === 'all') return true;
    if (filter === 'due') return dueCount(t) > 0;
    if (filter === 'weak') return isWeak(t);
    if (filter === 'new') return t.card_count === 0 || t.quiz_total === 0;
    return recommendationScore(t) > 0;
  });

  const queue = ranked.filter(t => recommendationScore(t) > 0).slice(0, 5);
  const dueTotal = topics.reduce((sum, t) => sum + dueCount(t), 0);
  const weakTotal = topics.filter(isWeak).length;
  const newTotal = topics.filter(t => t.card_count === 0 || t.quiz_total === 0).length;

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="page-title">Topics</div>
          <div className="page-sub">
            {topics.length} topics · {dueTotal} due cards · {weakTotal} weak areas · {newTotal} new starts
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(s => !s); setAddErr(''); }}
          className={showAdd ? 'btn-ghost' : 'btn-primary'}
          style={{ padding: '9px 16px' }}
        >
          {showAdd ? 'Cancel' : '+ Add Topic'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 18, marginBottom: 18, maxWidth: 520 }}>
          <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 14, color: 'var(--tx)' }}>New Topic</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={icon} onChange={e => setIcon(e.target.value)} style={{ width: 52 }} placeholder="🔧" />
            <input
              value={name}
              onChange={e => {
                const next = e.target.value;
                setName(next);
                if (next.trim().length < 3) {
                  setSuggestions([]);
                  setSuggesting(false);
                }
              }}
              placeholder="Topic name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              style={{ flex: 1 }}
            />
          </div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description (optional)" style={{ marginBottom: 12 }} />
          {(suggesting || suggestions.length > 0) && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 7 }}>
                {suggesting ? 'Finding related topics…' : 'Related topic ideas'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(s => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => { setName(s.name); setDesc(s.description); setIcon(s.icon); }}
                    style={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      background: 'var(--s2)',
                      border: '1px solid var(--bd)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      color: 'var(--tx)',
                    }}
                  >
                    <span style={{ width: 22, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{s.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {addErr && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{addErr}</div>}
          <button onClick={addTopic} disabled={adding || !name.trim()} className="btn-primary" style={{ padding: '8px 16px' }}>
            {adding ? 'Adding…' : 'Add Topic'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
          <div className="spinner" /> Loading…
        </div>
      ) : (
        <>
          <FocusQueue topics={queue} onSelect={setSelected} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 16, alignItems: 'start' }}>
            <section>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        fontSize: 11.5,
                        background: filter === f.id ? 'var(--a)' : 'transparent',
                        color: filter === f.id ? '#fff' : 'var(--tx-2)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search topics…"
                  style={{ width: 240, marginLeft: 'auto' }}
                />
              </div>

              <TopicTable
                topics={visible}
                selectedId={selectedTopic?.id ?? null}
                onSelect={setSelected}
                onAsk={setChatTopic}
              />
            </section>

            <TopicDetail
              topic={selectedTopic}
              onAsk={setChatTopic}
              onDelete={deleteTopic}
            />
          </div>
        </>
      )}

      {chatTopic && (
        <AiChat
          context={{
            type: 'topic',
            topic: toDisplayString(chatTopic.name),
            topicDescription: toDisplayString(chatTopic.description) || undefined,
          }}
          onClose={() => setChatTopic(null)}
          greeting={`Ask me anything about ${toDisplayString(chatTopic.name)}. I'll keep answers practical and focused on real systems.`}
        />
      )}
    </div>
  );
}

function FocusQueue({ topics, onSelect }: { topics: TopicWithSkill[]; onSelect: (id: number) => void }) {
  if (topics.length === 0) return (
    <section style={{ marginBottom: 18 }}>
      <div className="section-title">Focus Queue</div>
      <div className="card" style={{ padding: 16, color: 'var(--tx-2)', fontSize: 13 }}>
        No urgent topics right now. Pick any topic from the table and keep momentum.
      </div>
    </section>
  );

  return (
    <section style={{ marginBottom: 18 }}>
      <div className="section-title">Focus Queue</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        {topics.map(topic => {
          const action = primaryAction(topic);
          return (
            <button
              key={topic.id}
              onClick={() => onSelect(topic.id)}
              className="card-btn"
              style={{
                padding: '13px 14px',
                textAlign: 'left',
                display: 'block',
                borderColor: action.color,
              }}
            >
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{toDisplayString(topic.icon)}</span>
                <span style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 650, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                  {toDisplayString(topic.name)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-2)', lineHeight: 1.45, marginBottom: 8 }}>
                {reason(topic)}
              </div>
              <span style={{ color: action.color, fontSize: 11, fontWeight: 700 }}>{action.label} →</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TopicTable({
  topics,
  selectedId,
  onSelect,
  onAsk,
}: {
  topics: TopicWithSkill[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAsk: (topic: TopicWithSkill) => void;
}) {
  if (topics.length === 0) return (
    <div className="card" style={{ padding: 18, color: 'var(--tx-3)', fontSize: 13 }}>
      No topics match this view.
    </div>
  );

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1.7fr) 130px 70px 76px 92px 166px',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--bd)',
        color: 'var(--tx-3)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 700,
      }}>
        <span>Topic</span>
        <span>Skill</span>
        <span>Due</span>
        <span>Quiz</span>
        <span>Last</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>

      {topics.map(topic => {
        const skill = getSkillLabel(topic.level);
        const quiz = quizPct(topic);
        const action = primaryAction(topic);
        const active = topic.id === selectedId;
        return (
          <div
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 1.7fr) 130px 70px 76px 92px 166px',
              gap: 12,
              alignItems: 'center',
              padding: '11px 14px',
              borderBottom: '1px solid var(--bd)',
              background: active ? 'rgba(34,211,238,0.10)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--s2)', border: '1px solid var(--bd)' }}>
                {toDisplayString(topic.icon)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                  {toDisplayString(topic.name)}
                </div>
                <div style={{ color: 'var(--tx-3)', fontSize: 10.5 }}>
                  {topic.card_count} cards
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 5 }}>
                <span style={{ color: skill.color, fontWeight: 700 }}>{skill.label}</span>
                <span style={{ color: 'var(--tx-3)' }}>{topic.level}</span>
              </div>
              <div style={{ height: 5, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${topic.level}%`, background: skill.color, borderRadius: 99 }} />
              </div>
            </div>

            <span style={{ color: dueCount(topic) > 0 ? 'var(--sky)' : 'var(--tx-3)', fontWeight: 700, fontSize: 12 }}>
              {dueCount(topic)}
            </span>
            <span style={{ color: quiz === null ? 'var(--tx-3)' : quiz >= 70 ? 'var(--green)' : 'var(--amber)', fontWeight: 650, fontSize: 12 }}>
              {quiz === null ? 'New' : `${quiz}%`}
            </span>
            <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>
              {lastPracticed(topic.last_practiced)}
            </span>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
              <Link href={action.href(topic)} style={{ ...smallAction, background: action.bg, color: action.color, borderColor: action.border }}>
                {action.label}
              </Link>
              <button onClick={() => onAsk(topic)} title="Ask AI" style={{ ...smallIcon, color: 'var(--tx-2)' }}>🤖</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopicDetail({
  topic,
  onAsk,
  onDelete,
}: {
  topic: TopicWithSkill | null;
  onAsk: (topic: TopicWithSkill) => void;
  onDelete: (id: number) => void;
}) {
  if (!topic) return (
    <aside className="card" style={{ padding: 18, color: 'var(--tx-2)', fontSize: 13 }}>
      Select a topic to see details.
    </aside>
  );

  const skill = getSkillLabel(topic.level);
  const quiz = quizPct(topic);
  const action = primaryAction(topic);
  const description = toDisplayString(topic.description);

  return (
    <aside className="card" style={{ padding: 18, position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--s2)',
          border: '1px solid var(--bd-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          {toDisplayString(topic.icon)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--tx)', fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
            {toDisplayString(topic.name)}
          </div>
          <div style={{ color: skill.color, fontSize: 11, fontWeight: 700, marginTop: 4 }}>
            {skill.label} · level {topic.level}
          </div>
        </div>
      </div>

      {description && (
        <div style={{ color: 'var(--tx-2)', fontSize: 12.5, lineHeight: 1.55, marginBottom: 16 }}>
          {description}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <Metric label="Due" value={String(dueCount(topic))} color={dueCount(topic) > 0 ? 'var(--sky)' : 'var(--tx-2)'} />
        <Metric label="Cards" value={String(topic.card_count)} color="var(--tx-2)" />
        <Metric label="Quiz" value={quiz === null ? 'New' : `${quiz}%`} color={quiz === null ? 'var(--tx-3)' : quiz >= 70 ? 'var(--green)' : 'var(--amber)'} />
        <Metric label="Last" value={lastPracticed(topic.last_practiced)} color="var(--tx-2)" />
      </div>

      <div style={{ height: 7, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${topic.level}%`, background: skill.color, borderRadius: 99 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Link href={action.href(topic)} className="btn-primary" style={{ ...detailButton, background: action.color }}>
          {action.label}
        </Link>
        <Link href={`/learn/${topic.id}`} className="btn-ghost" style={detailButton}>Learn</Link>
        <Link href={`/drill/${topic.id}`} className="btn-ghost" style={detailButton}>Drill</Link>
        <Link href={`/quiz/${topic.id}`} className="btn-ghost" style={detailButton}>Quiz</Link>
        <button onClick={() => onAsk(topic)} className="btn-ghost" style={{ ...detailButton, gridColumn: '1 / -1' }}>
          🤖 Ask AI
        </button>
        {topic.is_custom === 1 && (
          <button
            onClick={() => onDelete(topic.id)}
            style={{
              ...detailButton,
              gridColumn: '1 / -1',
              background: 'var(--red-d)',
              color: 'var(--red)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            Delete Topic
          </button>
        )}
      </div>
    </aside>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '9px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function dueCount(topic: TopicWithSkill): number {
  return Number(topic.due_count ?? 0);
}

function quizPct(topic: TopicWithSkill): number | null {
  return topic.quiz_total > 0 ? Math.round((topic.quiz_correct / topic.quiz_total) * 100) : null;
}

function isWeak(topic: TopicWithSkill): boolean {
  const quiz = quizPct(topic);
  return (quiz !== null && quiz < 70) || (topic.quiz_total > 0 && topic.level < 45);
}

function recommendationScore(topic: TopicWithSkill): number {
  let score = 0;
  score += Math.min(dueCount(topic), 20) * 4;
  if (isWeak(topic)) score += 40;
  if (topic.card_count === 0 || topic.quiz_total === 0) score += 18;
  if (!topic.last_practiced) score += 10;
  return score;
}

function rankTopics(topics: TopicWithSkill[]): TopicWithSkill[] {
  return [...topics].sort((a, b) => {
    const scoreDelta = recommendationScore(b) - recommendationScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    return toDisplayString(a.name).localeCompare(toDisplayString(b.name));
  });
}

function primaryAction(topic: TopicWithSkill) {
  if (dueCount(topic) > 0) {
    return {
      label: 'Drill',
      color: 'var(--sky)',
      bg: 'var(--sky-d)',
      border: 'rgba(56,189,248,0.25)',
      href: (t: TopicWithSkill) => `/drill/${t.id}`,
    };
  }
  if (topic.card_count === 0 || topic.quiz_total === 0) {
    return {
      label: 'Learn',
      color: 'var(--a-light)',
      bg: 'var(--a-dim)',
      border: 'rgba(34,211,238,0.25)',
      href: (t: TopicWithSkill) => `/learn/${t.id}`,
    };
  }
  if (isWeak(topic)) {
    return {
      label: 'Quiz',
      color: 'var(--red)',
      bg: 'var(--red-d)',
      border: 'rgba(239,68,68,0.25)',
      href: (t: TopicWithSkill) => `/quiz/${t.id}`,
    };
  }
  return {
    label: 'Review',
    color: 'var(--green)',
    bg: 'var(--green-d)',
    border: 'rgba(34,197,94,0.25)',
    href: (t: TopicWithSkill) => `/learn/${t.id}`,
  };
}

function reason(topic: TopicWithSkill): string {
  const due = dueCount(topic);
  const quiz = quizPct(topic);
  if (due > 0) return `${due} cards due · ${quiz === null ? 'no quiz yet' : `${quiz}% quiz`}`;
  if (quiz !== null && quiz < 70) return `${quiz}% quiz accuracy · needs reinforcement`;
  if (topic.card_count === 0) return 'No cards yet · start with a quick learn pass';
  if (topic.quiz_total === 0) return 'No quiz history · establish a baseline';
  return `Level ${topic.level} · ${lastPracticed(topic.last_practiced)}`;
}

function lastPracticed(value: string | null): string {
  if (!value) return 'Never';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Unknown';
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const smallAction: React.CSSProperties = {
  minWidth: 68,
  textAlign: 'center',
  padding: '5px 10px',
  borderRadius: 7,
  border: '1px solid',
  fontSize: 11.5,
  fontWeight: 700,
  textDecoration: 'none',
};

const smallIcon: React.CSSProperties = {
  width: 30,
  height: 28,
  borderRadius: 7,
  background: 'var(--s2)',
  border: '1px solid var(--bd)',
  fontSize: 12,
};

const detailButton: React.CSSProperties = {
  minHeight: 34,
  padding: '8px 10px',
  borderRadius: 8,
  textAlign: 'center',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 650,
};
