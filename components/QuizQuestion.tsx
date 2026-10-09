'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuizQuestion } from '@/types';
import AiChat from './AiChat';
import MathText from './MathText';
import { AnswerChoice, Button, PracticeHeader, ProgressRail, QuestionCard, ReviewPanel } from './ui';
import type { ChatContext } from '@/app/api/chat/route';
import { toDisplayString } from '@/lib/normalize';
import { answersMatch, resolveCorrectAnswer } from '@/lib/quizMatch';

interface Props {
  question: QuizQuestion;
  index: number;
  total: number;
  topicName: string;
  onAnswer: (answer: string, responseTimeMs: number) => void;
}

export default function QuizQuestionUI({ question, index, total, topicName, onAnswer }: Props) {
  const [selected,   setSelected]   = useState<string | null>(null);
  const [confirmed,  setConfirmed]  = useState(false);
  const [showChat,   setShowChat]   = useState(false);
  const [showCue,    setShowCue]    = useState(false);
  const startTime = useRef(Date.now());
  const questionText = toDisplayString(question?.question);
  const answerText = toDisplayString(question?.answer);
  const displayAnswer = resolveCorrectAnswer(question?.answer, question?.options ?? []);
  const explanationText = toDisplayString(question?.explanation);
  const options = Array.isArray(question?.options)
    ? question.options.map(toDisplayString).filter(Boolean)
    : [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null);
    setConfirmed(false);
    setShowCue(false);
    startTime.current = Date.now();
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Don't handle quiz shortcuts while AI chat is open
      if (showChat) return;
      if (!confirmed) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= options.length) setSelected(options[n - 1]);
        if ((e.key === 'Enter' || e.key === ' ') && selected) { e.preventDefault(); setConfirmed(true); }
      } else {
        if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmed, selected, options, showChat]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (!selected) return;
    onAnswer(selected, Date.now() - startTime.current);
  }

  const isCorrect = answersMatch(selected, answerText, options);
  const selectedLetter = selected ? String.fromCharCode(65 + Math.max(0, options.indexOf(selected))) : null;
  const correctIndex = options.findIndex(opt => answersMatch(opt, answerText, options));
  const correctLetter = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : null;
  const progress = total > 0 ? ((index + (confirmed ? 1 : 0)) / total) * 100 : 0;

  return (
    <div className="practice-shell">
      <PracticeHeader
        kicker={`Question ${index + 1} of ${total}`}
        title={topicName}
        shortcut={!confirmed ? 'Keys 1-4 select, Enter checks' : 'Enter moves next'}
      />
      <ProgressRail value={progress} label={`Question progress ${Math.round(progress)} percent`} />

      <QuestionCard>
        <MathText text={questionText} />
      </QuestionCard>

      <div className="practice-options" role="list" aria-label="Answer choices">
        {options.map((opt, i) => {
          let status = '';
          let correct = false;
          let wrong = false;
          let muted = false;

          if (confirmed) {
            if (answersMatch(opt, answerText, options)) {
              correct = true;
              status = 'Correct';
            } else if (opt === selected) {
              wrong = true;
              status = 'Your pick';
            } else {
              muted = true;
            }
          }

          return (
            <AnswerChoice
              key={opt}
              label={String.fromCharCode(65 + i)}
              text={opt}
              selected={opt === selected}
              correct={correct}
              wrong={wrong}
              muted={muted}
              status={status}
              onClick={() => !confirmed && setSelected(opt)}
            />
          );
        })}
      </div>

      {!confirmed && showCue && (
        <div className="practice-cue">
          Start by naming the governing concept or formula, then eliminate answers with impossible units, signs, or scale.
        </div>
      )}

      {confirmed && (
        <ReviewPanel
          correct={isCorrect}
          title={isCorrect ? 'Correct' : 'Review this one'}
          action={
            <button type="button" onClick={() => setShowChat(true)} className="practice-ai-button">
              Ask AI
            </button>
          }
          userAnswer={<>{selectedLetter ? `${selectedLetter}. ` : ''}<MathText text={selected ?? ''} /></>}
          correctAnswer={<>{correctLetter ? `${correctLetter}. ` : ''}<MathText text={displayAnswer} /></>}
          explanation={explanationText ? <MathText text={explanationText} /> : undefined}
        />
      )}

      <div className="practice-actionbar">
        {!confirmed && (
          <Button variant="ghost" onClick={() => setShowCue(v => !v)}>
            {showCue ? 'Hide cue' : 'Need a cue?'}
          </Button>
        )}

        {!confirmed ? (
          <Button
            onClick={() => selected && setConfirmed(true)}
            disabled={!selected}
            variant={selected ? 'primary' : 'quiet'}
          >
            Confirm
          </Button>
        ) : (
          <Button onClick={next}>
            {index + 1 < total ? 'Next →' : 'Finish'}
          </Button>
        )}
      </div>

      {showChat && (
        <AiChat
          context={{
            type:       'quiz',
            topic:      topicName,
            front:      questionText,
            back:       displayAnswer,
            userAnswer: selected ?? undefined,
          } as ChatContext}
          onClose={() => setShowChat(false)}
          greeting={isCorrect
            ? `You got it right. Want to go deeper on this concept?`
            : `The correct answer was "${displayAnswer}". I can explain why.`}
        />
      )}
    </div>
  );
}
