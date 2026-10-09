import type { Difficulty, StepKey } from './steps';
import { STEPS } from './steps';

const DIFF_GUIDE: Record<Difficulty, string> = {
  easy: 'Make it concrete and everyday. One short sentence. Specific enough to disagree with, simple enough that a teenager could engage.',
  medium: 'A real-world policy, business, science, or social claim. One or two sentences. The kind of thing you might hear in the news or a podcast.',
  hard: 'A contested ethical, philosophical, or interpretive claim. Up to two sentences. Should reward nuance — no clean right answer.',
};

export function scenarioPrompt(topic: string, difficulty: Difficulty, salt: string): string {
  return `You write thought-provoking statements for a critical-thinking exercise.

Generate ONE statement on the topic: "${topic}".
Difficulty: ${difficulty}. ${DIFF_GUIDE[difficulty]}

Rules:
- Output ONLY the statement itself. No preamble, no quotes, no labels, no explanation.
- It should be a definitive-sounding claim, not a question.
- Avoid jargon. Use plain language.
- Do not hedge. The statement should feel arguable.
- Vary your output — do not default to the most common talking points. Variation seed: ${salt}.

Statement:`;
}

export interface CoachContext {
  scenario: string;
  stepKey: StepKey;
  priorSteps: { stepKey: StepKey; userText: string }[];
  userText: string;
  hintRequested: boolean;
  difficulty: Difficulty;
}

export function coachSystemPrompt(ctx: CoachContext): string {
  const step = STEPS.find(s => s.key === ctx.stepKey)!;
  const prior = ctx.priorSteps.length
    ? `\n\nWhat the user already said in earlier steps:\n${ctx.priorSteps
        .map(p => `- [${p.stepKey}] ${p.userText}`)
        .join('\n')}`
    : '';

  return `You are a calm, sharp Socratic thinking coach. The user is practicing critical thinking out loud. Their words come from speech, so they may be informal, fragmented, or include filler. Be charitable.

STATEMENT:
"${ctx.scenario}"

CURRENT STEP: ${step.title} — ${step.speak}
${prior}

RULES (most important first):
1. NEVER reveal a full list of correct answers, even on hint. Hints point at an angle (${step.hintAngle}). They do not fill in the blank.
2. Acknowledge what the user said in ONE short, specific sentence.
3. If their answer is shallow, vague, or single-point when more would help, ask ONE probing follow-up question. Otherwise, do not ask one.
4. Total reply: 2–3 sentences max. You will be spoken aloud — plain prose only. No markdown, no lists, no bullets, no headers.
5. ${ctx.hintRequested ? 'The user asked for a hint. Give a one-sentence nudge pointing at the angle without naming the answer.' : 'Do not give hints unless asked.'}

OUTPUT FORMAT (REQUIRED):
After your spoken reply, on a NEW LINE, output exactly this tag:
[[score=N, ready=Y]]
or
[[score=N, ready=N]]
where N is 1–5 (1=nothing useful, 5=excellent depth), and ready=Y if their answer is solid enough to move on (default Y when score ≥ 3 and not a hint request; default N on hint requests).

EXAMPLES of the tag:
[[score=4, ready=Y]]
[[score=2, ready=N]]

You MUST include the tag — it is parsed by software. Begin your reply now.`;
}

export interface SummaryContext {
  scenario: string;
  difficulty: Difficulty;
  steps: { stepKey: StepKey; userText: string; quality: number | null }[];
  totalHints: number;
}

export function summaryPrompt(ctx: SummaryContext): string {
  return `You are wrapping up a critical-thinking practice session.

Statement: "${ctx.scenario}"
Difficulty: ${ctx.difficulty}
Hints used: ${ctx.totalHints}

What the user said at each step:
${ctx.steps.map(s => `- ${s.stepKey} (quality ${s.quality ?? '?'}/5): ${s.userText}`).join('\n')}

Write a warm, honest 3-4 sentence reflection for the user. Mention one thing they did well and one thing they could sharpen next time. Spoken aloud, so plain prose — no markdown.

End with a tag on its own final line: [[score=N]] where N is 1-100 reflecting overall quality.`;
}

/** Parse the [[score=N, ready=Y|N]] tag and strip it from the body.
 *  Forgiving: also accepts variations like "score: 4, ready: Y" or bare "ready=Y".
 *  If no tag is found, treats the response as ready (so user can advance even if model
 *  forgets formatting), but with a null score. */
export function parseCoachTag(text: string): { body: string; score: number | null; ready: boolean } {
  // Strict form first
  const strict = text.match(/\[\[\s*score\s*[=:]\s*(\d+)\s*,\s*ready\s*[=:]\s*([YN])\s*\]\]/i);
  if (strict) {
    return {
      body: text.replace(strict[0], '').trim(),
      score: Math.max(1, Math.min(5, parseInt(strict[1], 10))),
      ready: strict[2].toUpperCase() === 'Y',
    };
  }
  // Lenient: any "score: N" and "ready: Y/N" pair (possibly on separate lines, no brackets)
  const scoreM = text.match(/score\s*[=:]\s*(\d)/i);
  const readyM = text.match(/ready\s*[=:]\s*([YN])/i);
  if (scoreM || readyM) {
    const score = scoreM ? Math.max(1, Math.min(5, parseInt(scoreM[1], 10))) : null;
    const ready = readyM ? readyM[1].toUpperCase() === 'Y' : (score !== null && score >= 3);
    // Strip any bracketed tag or trailing "score:..., ready:..." line
    let body = text.replace(/\[\[[^\]]*\]\]/g, '').replace(/^\s*score[^.\n]*ready[^.\n]*\.?\s*$/gim, '').trim();
    // Also strip a trailing line if it looks like a tag-only line
    body = body.replace(/\n\s*(score|ready)[^\n]*$/gi, '').trim();
    return { body, score, ready };
  }
  // No tag at all — treat as ready so the session doesn't trap the user.
  return { body: text.trim(), score: null, ready: true };
}

export function parseSummaryTag(text: string): { body: string; score: number | null } {
  const m = text.match(/\[\[\s*score\s*=\s*(\d+)\s*\]\]/i);
  if (!m) return { body: text.trim(), score: null };
  const score = Math.max(1, Math.min(100, parseInt(m[1], 10)));
  const body = text.replace(m[0], '').trim();
  return { body, score };
}
