import type { Difficulty, StepKey } from '@/lib/steps';

/* ═══════════════════════════════════════════════════════════════════════════
   Think (voice critical thinking) types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VoiceSession {
  id: number;
  scenario: string;
  topic: string;
  difficulty: Difficulty;
  started_at: string;
  completed_at: string | null;
  total_hints: number;
  quality_score: number | null;
  summary: string | null;
}

// Back-compat alias for places still importing `Session` from earlier think-aloud code.
export type Session = VoiceSession;

export interface VoiceStep {
  id: number;
  session_id: number;
  step_key: StepKey;
  user_text: string;
  coach_feedback: string | null;
  hints_used: number;
  quality: number | null;
  created_at: string;
}

// Back-compat alias.
export type StepRow = VoiceStep;

export interface VoiceSessionDetail extends VoiceSession {
  steps: VoiceStep[];
}
export type SessionDetail = VoiceSessionDetail;

export interface VoiceProgressData {
  totalSessions: number;
  completedSessions: number;
  avgScore: number | null;
  streakDays: number;
  byDifficulty: { difficulty: Difficulty; count: number }[];
  recent: VoiceSession[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   Learn (engineering training, from noble-shell heritage) types
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Topic {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  is_custom: number;
  created_at: string;
}

export interface TopicWithSkill extends Topic {
  level: number;
  quiz_total: number;
  quiz_correct: number;
  cards_mastered: number;
  last_practiced: string | null;
  card_count: number;
  due_count: number;
}

export interface Flashcard {
  id: number;
  topic_id: number;
  front: string;
  back: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  created_at: string;
  // FSRS fields
  stability: number;
  difficulty: number;
  elaboration: string | null;
}

export type Grade = 1 | 2 | 3 | 4;

export interface FlashcardWithTopic extends Flashcard {
  topic_name: string;
  topic_icon: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface QuizAttempt {
  id: number;
  topic_id: number;
  session_id: string;
  question: string;
  options: string;
  correct_answer: string;
  user_answer: string | null;
  correct: number;
  response_time_ms: number | null;
  created_at: string;
}

export interface DailyStats {
  date: string;
  total_time_ms: number;
  flashcards_reviewed: number;
  quiz_questions: number;
  quiz_correct: number;
  focus_sessions: number;
  xp_earned: number;
}

export interface TopicSkill {
  topic_id: number;
  level: number;
  quiz_total: number;
  quiz_correct: number;
  cards_mastered: number;
  last_practiced: string | null;
}

export interface WeakArea {
  topic: string;
  score_pct: number;
  recommendation: string;
}

export interface ProgressData {
  streak: number;
  todayXP: number;
  weeklyXP: DailyStats[];
  topicSkills: TopicWithSkill[];
  weakAreas: WeakArea[];
  totalDueCards: number;
}

export interface SM2Card {
  id: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
}
