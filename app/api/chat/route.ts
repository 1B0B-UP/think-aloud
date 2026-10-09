export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { toDisplayString } from '@/lib/normalize';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  type: 'flashcard' | 'quiz' | 'learn' | 'topic' | 'recall' | 'feed' | 'math' | 'exam';
  topic: string;
  front?: string;        // flashcard question, quiz question, or feed item title
  back?: string;         // flashcard answer or correct answer
  userAnswer?: string;
  topicDescription?: string;
  mediaDescription?: string; // feed item description / AI key facts
  content?: string;      // for learn page — the full summary content
}

function buildSystemPrompt(ctx: ChatContext): string {
  const topic = toDisplayString(ctx.topic);
  const base = `You are a senior systems and electrical engineer helping someone learn on the job.
Be concise, practical, and technical. Use real-world examples when helpful.
When explaining concepts, connect them to how they're actually used in aerospace, industrial, or embedded systems.
Keep responses focused — 2-4 sentences unless more detail is clearly needed.`;

  switch (ctx.type) {
    case 'flashcard':
      return `${base}

The user is reviewing a flashcard and has a follow-up question.

Topic: ${topic}
Card front: ${toDisplayString(ctx.front)}
Card answer: ${toDisplayString(ctx.back)}

Answer their follow-up question in the context of this specific concept.`;

    case 'quiz':
      return `${base}

The user just answered a quiz question and wants to understand it better.

Topic: ${topic}
Question: ${toDisplayString(ctx.front)}
Correct answer: ${toDisplayString(ctx.back)}
${ctx.userAnswer ? `User selected: ${toDisplayString(ctx.userAnswer)}` : ''}

Help them understand this concept deeply. If they got it wrong, explain why the correct answer is right.`;

    case 'learn':
      return `${base}

The user is reading a deep-dive summary about "${topic}" and has a question.
${ctx.topicDescription ? `Topic description: ${toDisplayString(ctx.topicDescription)}` : ''}

Answer questions about this topic specifically, using your engineering knowledge.`;

    case 'recall':
      return `${base}

The user is doing a term recall exercise.
Term: ${toDisplayString(ctx.front)}
Correct definition: ${toDisplayString(ctx.back)}

Help them understand this concept and why it matters.`;

    case 'topic':
      return `${base}

The user wants to know more about the topic: ${topic}
${ctx.topicDescription ? toDisplayString(ctx.topicDescription) : ''}

Answer their questions about this engineering topic.`;

    case 'feed':
      return `${base}

The user is browsing their engineering learning feed and saw content about "${topic}".
${ctx.front ? `Content title: ${toDisplayString(ctx.front)}` : ''}
${ctx.mediaDescription ? `Content summary: ${toDisplayString(ctx.mediaDescription)}` : ''}

Help them go deeper on this concept. Connect it to practical engineering work.`;

    case 'math':
      return `${base}

The user is refreshing engineering mathematics for electrical engineering.

Course/topic: ${topic}
Problem: ${toDisplayString(ctx.front)}
Reference answer: ${toDisplayString(ctx.back)}
${ctx.topicDescription ? `Study context: ${toDisplayString(ctx.topicDescription)}` : ''}

Help with the selected math problem. Show the reasoning step by step, call out common algebra/calculus mistakes, and connect the result to EE uses such as circuits, controls, signals, electromagnetics, probability, or numerical analysis when relevant.`;

    case 'exam':
      return `${base}

The user is reviewing an FE/PE exam-style practice problem.

Exam section: ${topic}
Question: ${toDisplayString(ctx.front)}
Correct answer: ${toDisplayString(ctx.back)}
${ctx.userAnswer ? `User selected: ${toDisplayString(ctx.userAnswer)}` : ''}
${ctx.topicDescription ? `Known explanation: ${toDisplayString(ctx.topicDescription)}` : ''}

Tutor them like an FE/PE prep instructor. Start from the quickest exam-solving route, show the formula or concept to use, explain why the correct option is right, and if their selected answer is wrong, diagnose the likely trap. Keep it practical and step-by-step.`;

    default:
      return base;
  }
}

export async function POST(req: Request) {
  const { messages, context } = await req.json() as {
    messages: ChatMessage[];
    context: ChatContext;
  };

  // Get saved model preference
  let model = 'llama3.2:3b';
  try {
    const db  = getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ollama_model') as { value: string } | undefined;
    if (row?.value) model = row.value;
  } catch { /* use default */ }

  const systemPrompt = buildSystemPrompt(context);

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: toDisplayString(m.content) })),
  ];

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return new Response('AI unavailable', { status: 503 });
  }

  if (!ollamaRes.ok) {
    return new Response('AI error', { status: 503 });
  }

  // Stream the response back — transform Ollama NDJSON → plain text chunks
  const stream = new ReadableStream({
    async start(controller) {
      const reader  = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let   buffer  = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line) as {
                message?: { content: string };
                done?: boolean;
              };
              if (data.message?.content) {
                controller.enqueue(encoder.encode(data.message.content));
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
