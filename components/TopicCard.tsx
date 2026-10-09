'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSkillLabel } from './SkillBar';
import AiChat from './AiChat';
import type { TopicWithSkill } from '@/types';
import { toDisplayString } from '@/lib/normalize';

interface Props {
  topic: TopicWithSkill;
  onDelete?: (id: number) => void;
}

export default function TopicCard({ topic, onDelete }: Props) {
  const [showChat, setShowChat] = useState(false);
  const skill   = getSkillLabel(topic.level);
  const quizPct = topic.quiz_total > 0 ? Math.round((topic.quiz_correct / topic.quiz_total) * 100) : null;
  const icon = toDisplayString(topic.icon);
  const name = toDisplayString(topic.name);
  const description = toDisplayString(topic.description);

  return (
    <div className="card-btn" style={{
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: 'var(--s3)',
            border: '1px solid var(--bd-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 21,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
              {name}
            </div>
            <div style={{ marginTop: 5 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: skill.color, background: `${skill.color}16`,
                border: `1px solid ${skill.color}30`,
              }}>
                {skill.label}
              </span>
            </div>
          </div>
        </div>
        {topic.is_custom === 1 && onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(topic.id); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--tx-3)', fontSize: 19, lineHeight: 1, padding: '2px 4px', borderRadius: 5,
            }}
            title="Delete topic"
          >×</button>
        )}
      </div>

      {/* Description */}
      {description && (
        <div style={{ fontSize: 11.5, color: 'var(--tx-2)', lineHeight: 1.55, marginTop: -4 }}>
          {description}
        </div>
      )}

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 500 }}>Skill progress</span>
          <span style={{ fontSize: 11, color: 'var(--tx-2)', fontWeight: 600 }}>{topic.level}/100</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${topic.level}%`, background: skill.color }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--tx-3)' }}>
        <span>{topic.card_count} cards</span>
        <span>·</span>
        <span>{topic.quiz_total} quizzes</span>
        {quizPct !== null && (
          <>
            <span>·</span>
            <span style={{ color: quizPct >= 70 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
              {quizPct}%
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: -2 }}>
        <Link href={`/learn/${topic.id}`} style={btnGhost}>Learn</Link>
        <Link href={`/drill/${topic.id}`} style={btnGhost}>Drill</Link>
        <button
          onClick={() => setShowChat(true)}
          style={{ ...btnGhost, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 0 }}
          title="Ask AI"
        >🤖</button>
        <Link href={`/quiz/${topic.id}`} style={btnAccent}>Quiz</Link>
      </div>

      {showChat && (
        <AiChat
          context={{ type: 'topic', topic: name, topicDescription: description || undefined }}
          onClose={() => setShowChat(false)}
          greeting={`Ask me anything about ${name}. I'll keep answers practical and focused on real systems.`}
        />
      )}
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  flex: 1, textAlign: 'center', padding: '7px 0', fontSize: 12, fontWeight: 500,
  borderRadius: 8, background: 'var(--s2)', color: 'var(--tx-2)',
  border: '1px solid var(--bd-md)',
};
const btnAccent: React.CSSProperties = {
  flex: 1, textAlign: 'center', padding: '7px 0', fontSize: 12, fontWeight: 600,
  borderRadius: 8, background: 'var(--a)', color: '#fff',
  boxShadow: '0 2px 10px var(--a-glow)',
};
