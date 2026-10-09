import type { ReactNode } from 'react';
import MathText from '@/components/MathText';
import { cx } from './cx';

interface PracticeHeaderProps {
  kicker: string;
  title: string;
  shortcut?: string;
}

export function PracticeHeader({ kicker, title, shortcut }: PracticeHeaderProps) {
  return (
    <div className="practice-topbar">
      <div>
        <div className="practice-kicker">{kicker}</div>
        <div className="practice-topic">{title}</div>
      </div>
      {shortcut && <div className="practice-shortcut">{shortcut}</div>}
    </div>
  );
}

export function ProgressRail({ value, label }: { value: number; label?: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="practice-progress" aria-label={label ?? `Progress ${Math.round(bounded)} percent`}>
      <div style={{ width: `${bounded}%` }} />
    </div>
  );
}

export function QuestionCard({ label = 'Prompt', children }: { label?: string; children: ReactNode }) {
  return (
    <div className="practice-question-card">
      <div className="practice-card-label">{label}</div>
      <div className="practice-question-text">{children}</div>
    </div>
  );
}

interface AnswerChoiceProps {
  label: string;
  text: string;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
  muted?: boolean;
  status?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function AnswerChoice({
  label,
  text,
  selected,
  correct,
  wrong,
  muted,
  status,
  disabled,
  onClick,
}: AnswerChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'practice-option',
        selected && 'is-selected',
        correct && 'is-correct',
        wrong && 'is-wrong',
        muted && 'is-muted',
      )}
      aria-pressed={selected}
    >
      <span className="practice-option-letter">{label}</span>
      <span className="practice-option-text"><MathText text={text} /></span>
      {status && <span className="practice-option-status">{status}</span>}
    </button>
  );
}

interface ReviewPanelProps {
  correct: boolean;
  title: string;
  action?: ReactNode;
  userAnswer: ReactNode;
  correctAnswer: ReactNode;
  explanation?: ReactNode;
}

export function ReviewPanel({ correct, title, action, userAnswer, correctAnswer, explanation }: ReviewPanelProps) {
  return (
    <div className={cx('practice-review', correct ? 'is-correct' : 'is-wrong')}>
      <div className="practice-review-header">
        <span>{title}</span>
        {action}
      </div>
      <div className="practice-review-grid">
        <div>
          <div className="practice-mini-label">Your answer</div>
          <div className="practice-mini-value">{userAnswer}</div>
        </div>
        <div>
          <div className="practice-mini-label">Correct answer</div>
          <div className="practice-mini-value">{correctAnswer}</div>
        </div>
      </div>
      {explanation && (
        <div className="practice-explanation">
          <div className="practice-mini-label">Why</div>
          {explanation}
        </div>
      )}
    </div>
  );
}
