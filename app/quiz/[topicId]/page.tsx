'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QuizQuestionUI from '@/components/QuizQuestion';
import type { QuizQuestion } from '@/types';
import { normalizeQuizQuestions, toDisplayString } from '@/lib/normalize';
import { answersMatch } from '@/lib/quizMatch';

export default function QuizPage() {
  const params = useParams();
  const topicId = params.topicId as string;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: Number(topicId) }),
    })
      .then(r => r.json())
      .then((d: { questions?: QuizQuestion[]; sessionId?: string; topicName?: string; error?: string }) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setQuestions(normalizeQuizQuestions(d.questions ?? []));
        setSessionId(d.sessionId || '');
        setTopicName(toDisplayString(d.topicName));
        setLoading(false);
      })
      .catch(() => { setError('Failed to generate quiz'); setLoading(false); });
  }, [topicId]);

  async function handleAnswer(userAnswer: string, responseTimeMs: number) {
    const q = questions[index];
    if (!q) return;
    let correct = false;

    try {
      const res  = await fetch('/api/quiz/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: Number(topicId),
          sessionId,
          question: q.question,
          options: q.options,
          correctAnswer: q.answer,
          userAnswer,
          responseTimeMs,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { correct: boolean };
        correct = data.correct ?? answersMatch(userAnswer, q.answer, q.options);
      } else {
        correct = answersMatch(userAnswer, q.answer, q.options); // fall back to client-side check
      }
    } catch {
      correct = answersMatch(userAnswer, q.answer, q.options); // network error — grade locally
    }

    setResults(r => [...r, { correct }]);

    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 15, color: 'var(--tx-2)' }}>Generating quiz questions with AI...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 15, color: 'var(--red)', marginBottom: 16 }}>{error}</div>
        <Link href="/topics" style={{ color: 'var(--a)', textDecoration: 'none', fontSize: 13 }}>
          ← Back to Topics
        </Link>
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    return (
      <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{pct >= 70 ? '🎯' : '📚'}</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Quiz Complete</h1>
        <div style={{ fontSize: 14, color: 'var(--tx-2)', marginBottom: 24 }}>
          {topicName}
        </div>
        <div style={{
          background: 'var(--s1)',
          border: '1px solid var(--bd)',
          borderRadius: 12,
          padding: 28,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: pct >= 70 ? 'var(--green)' : 'var(--amber)' }}>
            {pct}%
          </div>
          <div style={{ fontSize: 14, color: 'var(--tx-2)', marginTop: 8 }}>
            {correct} / {results.length} correct · +{correct * 5} XP
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href={`/quiz/${topicId}`} style={btnAccent}>Retake Quiz</Link>
          <Link href="/topics" style={btnSecondary}>All Topics</Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 15, color: 'var(--red)', marginBottom: 16 }}>No valid quiz questions were generated.</div>
        <Link href="/topics" style={{ color: 'var(--a)', textDecoration: 'none', fontSize: 13 }}>
          ← Back to Topics
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{topicName}</h1>
        <div style={{ fontSize: 13, color: 'var(--tx-2)', marginTop: 4 }}>AI-generated quiz</div>
      </div>
      <QuizQuestionUI
        key={index}
        question={questions[index]}
        index={index}
        total={questions.length}
        topicName={topicName}
        onAnswer={handleAnswer}
      />
    </div>
  );
}

const btnAccent: React.CSSProperties = {
  background: 'var(--a)',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 13,
  textDecoration: 'none',
  fontWeight: 500,
};

const btnSecondary: React.CSSProperties = {
  background: 'var(--s1)',
  color: 'var(--tx)',
  border: '1px solid var(--bd)',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 13,
  textDecoration: 'none',
};
