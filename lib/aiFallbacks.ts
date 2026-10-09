import type { QuizQuestion } from '@/types';

export interface FlashcardFallback {
  front: string;
  back: string;
}

export function fallbackFlashcards(topic: string): FlashcardFallback[] {
  const clean = topic.trim() || 'this topic';
  return [
    {
      front: `What is the core idea behind ${clean}?`,
      back: `Define ${clean}, identify what problem it solves, and connect it to one real engineering use case.`,
    },
    {
      front: `What is one common failure mode or misconception in ${clean}?`,
      back: `Look for where assumptions break, units are misread, or the wrong model/formula is applied.`,
    },
    {
      front: `How would you recognize a problem about ${clean} on an exam or in practice?`,
      back: `Identify the keywords, given quantities, constraints, and the governing principle before calculating.`,
    },
  ];
}

export function fallbackQuizQuestions(topic: string): QuizQuestion[] {
  const clean = topic.trim() || 'this topic';
  return [
    {
      question: `When approaching a problem about ${clean}, what should you do first?`,
      options: [
        'Identify the governing concept and given quantities',
        'Pick the longest formula available',
        'Ignore units until the final step',
        'Assume every problem uses the same method',
      ],
      answer: 'Identify the governing concept and given quantities',
      explanation: 'Most engineering errors start from choosing the wrong model. Classify the problem first, then calculate.',
    },
    {
      question: `What is the best way to study ${clean} for long-term retention?`,
      options: [
        'Attempt recall and solve mixed problems',
        'Only reread notes',
        'Only watch videos passively',
        'Avoid checking mistakes',
      ],
      answer: 'Attempt recall and solve mixed problems',
      explanation: 'Retrieval practice and interleaving are more reliable than passive rereading for durable learning.',
    },
  ];
}
