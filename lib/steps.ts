export type StepKey = 'assumptions' | 'evidence_for' | 'evidence_against' | 'consequences';

export interface StepDef {
  key: StepKey;
  ordinal: number;
  title: string;
  speak: string;
  hintAngle: string;
}

export const STEPS: StepDef[] = [
  {
    key: 'assumptions',
    ordinal: 1,
    title: 'Assumptions',
    speak: 'What is this statement taking for granted? What has to be true for it to hold up?',
    hintAngle: 'unstated beliefs the claim depends on',
  },
  {
    key: 'evidence_for',
    ordinal: 2,
    title: 'Supporting evidence',
    speak: 'What evidence would back this up? Studies, data, observations, lived experience — what supports it?',
    hintAngle: 'sources or facts that would make the claim more credible',
  },
  {
    key: 'evidence_against',
    ordinal: 3,
    title: 'Disconfirming evidence',
    speak: 'Now flip it. What evidence would contradict this claim or weaken it?',
    hintAngle: 'counter-examples or data that would make the claim less credible',
  },
  {
    key: 'consequences',
    ordinal: 4,
    title: 'Consequences',
    speak: 'If this is true, what follows? And if it turns out to be false — who is affected, and how?',
    hintAngle: 'downstream effects, second-order consequences, who benefits and who loses',
  },
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_META: Record<Difficulty, { label: string; description: string }> = {
  easy: {
    label: 'Easy',
    description: 'Concrete everyday claims. One or two assumptions per step is enough.',
  },
  medium: {
    label: 'Medium',
    description: 'Policy, business, or science claims with several angles to examine.',
  },
  hard: {
    label: 'Hard',
    description: 'Ambiguous ethical or philosophical claims that reward nuance.',
  },
};

export const TOPIC_SEEDS = [
  'everyday life',
  'health & nutrition',
  'technology & AI',
  'business & economics',
  'politics & policy',
  'science & research',
  'ethics & society',
  'self-help & psychology',
  'history',
  'media & news',
];

export function pickRandomTopic(): string {
  return TOPIC_SEEDS[Math.floor(Math.random() * TOPIC_SEEDS.length)];
}
