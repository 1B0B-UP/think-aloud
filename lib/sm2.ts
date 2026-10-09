import type { SM2Card } from '@/types';

export function updateSM2(card: SM2Card, quality: number): Partial<SM2Card> {
  let { ease_factor, interval_days, repetitions } = card;

  if (quality >= 3) {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval_days = 1;
  }

  ease_factor = Math.max(1.3, ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const due = new Date();
  due.setDate(due.getDate() + interval_days);
  return { ease_factor, interval_days, repetitions, due_date: due.toISOString().split('T')[0] };
}

export function sm2Quality(correct: boolean, responseTimeMs: number): number {
  if (!correct) return 1;
  if (responseTimeMs < 4000) return 5;
  if (responseTimeMs < 8000) return 4;
  return 3;
}
