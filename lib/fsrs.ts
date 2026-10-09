// FSRS-5 spaced repetition algorithm
// Based on: https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs
// Key improvement over SM2: models the actual forgetting curve, not just a multiplier.
// Tracks Stability (days for 90% recall) and Difficulty (1-10) per card.

export type Grade = 1 | 2 | 3 | 4; // Again=1, Hard=2, Good=3, Easy=4

// The forgetting curve: R(t, S) = (1 + FACTOR × t/S)^DECAY
// With these values: interval = stability for 90% retention
const DECAY = -0.5;
const FACTOR = 19 / 81;

export interface FSRSCard {
  stability: number;    // days until retention drops to 90%
  difficulty: number;   // 1–10 (10 = hardest)
  repetitions: number;
}

export interface FSRSResult {
  stability: number;
  difficulty: number;
  repetitions: number;
  due_date: string;
  interval: number;
}

// Initial stability per first-review grade (days)
const INIT_S: Record<Grade, number> = { 1: 0.40, 2: 1.18, 3: 3.13, 4: 15.47 };

// Probability of recall at t days given stability
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

// Days to schedule for TARGET_RETENTION given stability
// Derived from R(t, S) = TARGET: t = S (when DECAY=-0.5, FACTOR=19/81, TARGET=0.9)
function targetInterval(stability: number): number {
  return Math.max(1, Math.round(stability));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function initDifficulty(grade: Grade): number {
  // Grade 1 → ~7.2 (hard card), Grade 4 → ~2.1 (easy card)
  return clamp(7.2 - 1.7 * (grade - 1), 1, 10);
}

function updateDifficulty(d: number, grade: Grade): number {
  // Shift by grade distance from "Good" (3), with gentle mean-reversion toward 5
  const delta = -0.9 * (grade - 3);
  return clamp(d + delta + 0.1 * (5 - d), 1, 10);
}

function stabilityAfterRecall(d: number, s: number, r: number, grade: Grade): number {
  const hardPenalty = grade === 2 ? 0.80 : 1.0;
  const easyBonus  = grade === 4 ? 1.30 : 1.0;
  // Stability grows more slowly for hard cards and when already very stable
  const newS = s * (1 +
    Math.exp(0.72) *
    (11 - d) *
    Math.pow(s, -0.45) *
    (Math.exp(0.72 * (1 - r)) - 1)
  ) * hardPenalty * easyBonus;
  return Math.max(newS, s + 0.01);
}

function stabilityAfterForget(d: number, s: number, r: number): number {
  // After forgetting, stability resets to a low value based on prior exposure
  return clamp(
    0.22 * Math.pow(d, -0.28) * (Math.pow(s + 1, 0.45) - 1) * Math.exp(0.9 * (1 - r)),
    0.1, 10
  );
}

export function fsrsUpdate(card: FSRSCard, grade: Grade, elapsedDays: number): FSRSResult {
  const isNew = card.repetitions === 0 || card.stability <= 0;
  let stability: number;
  let difficulty: number;

  if (isNew) {
    stability  = INIT_S[grade];
    difficulty = initDifficulty(grade);
  } else if (grade === 1) {
    const r = retrievability(elapsedDays, card.stability);
    stability  = stabilityAfterForget(card.difficulty, card.stability, r);
    difficulty = updateDifficulty(card.difficulty, grade);
  } else {
    const r = retrievability(elapsedDays, card.stability);
    stability  = stabilityAfterRecall(card.difficulty, card.stability, r, grade);
    difficulty = updateDifficulty(card.difficulty, grade);
  }

  const interval = targetInterval(stability);
  const due = new Date();
  due.setDate(due.getDate() + interval);

  return {
    stability,
    difficulty,
    repetitions: grade === 1 ? Math.max(0, card.repetitions - 1) : card.repetitions + 1,
    due_date: due.toISOString().split('T')[0],
    interval,
  };
}

// Grade labels for UI
export const GRADE_LABELS: Record<Grade, { label: string; color: string; bg: string; border: string; hint: string }> = {
  1: { label: 'Again',  color: '#ef4444', bg: '#2d1a1a', border: '#4a2020', hint: '1' },
  2: { label: 'Hard',   color: '#f97316', bg: '#2d1e0f', border: '#4a2e0f', hint: '2' },
  3: { label: 'Good',   color: '#22c55e', bg: '#1a2d1a', border: '#1e3d1e', hint: '3' },
  4: { label: 'Easy',   color: '#3b82f6', bg: '#1a1e2d', border: '#1e2545', hint: '4' },
};
