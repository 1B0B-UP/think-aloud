import { normalizeFlashcardDrafts, normalizeQuizQuestions, normalizeSequenceSteps, normalizeWeakAreas, toDisplayString } from './normalize.ts';
import type { Grade } from './fsrs';

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function requirePositiveInt(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return numberValue;
}

export function requireString(value: unknown, field: string): string {
  const text = toDisplayString(value);
  if (!text) throw new Error(`${field} is required`);
  return text;
}

export function optionalString(value: unknown): string | null {
  const text = toDisplayString(value);
  return text || null;
}

export function requireGrade(value: unknown): Grade {
  const grade = Number(value);
  if (![1, 2, 3, 4].includes(grade)) throw new Error('grade must be 1, 2, 3, or 4');
  return grade as Grade;
}

export function requireNonNegativeNumber(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return numberValue;
}

export function parseTopicIdBody(body: unknown): { topicId: number } {
  const record = asRecord(body);
  return { topicId: requirePositiveInt(record.topicId, 'topicId') };
}

export function parseTopicCreateBody(body: unknown): { name: string; description: string | null; icon: string } {
  const record = asRecord(body);
  return {
    name: requireString(record.name, 'name'),
    description: optionalString(record.description),
    icon: optionalString(record.icon) ?? '🔧',
  };
}

export function parseManualFlashcardBody(body: unknown): {
  topicId: number;
  front: string;
  back: string;
  elaboration: string | null;
} {
  const record = asRecord(body);
  return {
    topicId: requirePositiveInt(record.topicId, 'topicId'),
    front: requireString(record.front, 'front'),
    back: requireString(record.back, 'back'),
    elaboration: optionalString(record.elaboration),
  };
}

export function parseFlashcardResultBody(body: unknown): {
  cardId: number;
  grade: Grade;
  elapsedMs: number;
} {
  const record = asRecord(body);
  return {
    cardId: requirePositiveInt(record.cardId, 'cardId'),
    grade: requireGrade(record.grade),
    elapsedMs: requireNonNegativeNumber(record.elapsedMs, 'elapsedMs'),
  };
}

export function parseQuizResultBody(body: unknown): {
  topicId: number;
  sessionId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  responseTimeMs: number;
} {
  const record = asRecord(body);
  const options = Array.isArray(record.options)
    ? record.options.map(toDisplayString).filter(Boolean)
    : [];

  if (options.length < 2) throw new Error('options must include at least two answers');

  return {
    topicId: requirePositiveInt(record.topicId, 'topicId'),
    sessionId: requireString(record.sessionId, 'sessionId'),
    question: requireString(record.question, 'question'),
    options,
    correctAnswer: requireString(record.correctAnswer, 'correctAnswer'),
    userAnswer: requireString(record.userAnswer, 'userAnswer'),
    responseTimeMs: requireNonNegativeNumber(record.responseTimeMs, 'responseTimeMs'),
  };
}

export function parseSequenceBody(body: unknown): { topicName: string } {
  const record = asRecord(body);
  return { topicName: requireString(record.topicName, 'topicName') };
}

export {
  normalizeFlashcardDrafts,
  normalizeQuizQuestions,
  normalizeSequenceSteps,
  normalizeWeakAreas,
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object');
  }
  return value as Record<string, unknown>;
}
