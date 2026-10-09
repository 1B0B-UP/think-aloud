import { toDisplayString } from './normalize.ts';

export function normalizeQuizAnswer(value: unknown): string {
  return stripOptionPrefix(toDisplayString(value))
    .toLowerCase()
    .replace(/√/g, 'sqrt')
    .replace(/[×·]/g, '*')
    .replace(/[–—−]/g, '-')
    .replace(/\bohms?\b/g, 'ohm')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

export function answersMatch(userAnswer: unknown, correctAnswer: unknown, options: unknown[] = []): boolean {
  const userText = toDisplayString(userAnswer);
  const correctText = toDisplayString(correctAnswer);
  const userNorm = normalizeQuizAnswer(userText);
  const correctNorm = normalizeQuizAnswer(correctText);

  if (!userNorm || !correctNorm) return false;
  if (userNorm === correctNorm) return true;

  const correctLetter = extractOptionLetter(correctText);
  if (correctLetter) {
    const idx = letterToIndex(correctLetter);
    const option = options[idx];
    if (option !== undefined && normalizeQuizAnswer(option) === userNorm) return true;
    if (extractOptionLetter(userText) === correctLetter) return true;
  }

  const userLetter = extractOptionLetter(userText);
  if (userLetter) {
    const idx = letterToIndex(userLetter);
    const option = options[idx];
    if (option !== undefined && normalizeQuizAnswer(option) === correctNorm) return true;
  }

  return false;
}

export function resolveCorrectAnswer(correctAnswer: unknown, options: unknown[] = []): string {
  const correctText = toDisplayString(correctAnswer);
  const letter = extractOptionLetter(correctText);
  if (letter) {
    const option = options[letterToIndex(letter)];
    const optionText = toDisplayString(option);
    if (optionText) return optionText;
  }

  const correctNorm = normalizeQuizAnswer(correctText);
  const matchingOption = options.map(toDisplayString).find(option => normalizeQuizAnswer(option) === correctNorm);
  return matchingOption ?? stripOptionPrefix(correctText);
}

function stripOptionPrefix(value: string): string {
  return value
    .replace(/^\s*option\s+[A-D](?:[\).:\-]\s*|\s+)/i, '')
    .replace(/^\s*[A-Da-d][\).:\-]\s*/, '')
    .trim();
}

function extractOptionLetter(value: string): string | null {
  const match = value.match(/^\s*(?:option\s+)?([A-D])(?:[\).:\-]\s*|\s*$)/i);
  return match ? match[1].toUpperCase() : null;
}

function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}
