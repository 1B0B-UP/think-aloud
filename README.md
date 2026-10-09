# Te Matemata

Unified personal training platform with two modes: voice-coached critical thinking and engineering study.

## Think — voice critical thinking

Work through scenarios out loud using a structured four-step framework:

1. Assumptions
2. Supporting evidence
3. Disconfirming evidence
4. Consequences

Voice input via Web Speech API. An Ollama-powered coach responds after each step and at the end of the session. Session history is saved for review.

## Learn — engineering study

Spaced-repetition flashcards (FSRS), AI quizzes, topic summaries, YouTube/Wikipedia feed, FE/PE exam prep, math refresh, focus sessions, and study habit tracking across 20 predefined engineering topics.

Inherits the study engine from [noble-shell](https://github.com/1B0B-UP/noble-shell).

## Stack

- Next.js, React 19, Tailwind v4
- SQLite (via node:sqlite)
- Ollama for AI coaching and quiz generation (default model: `llama3.2:3b`)
- Web Speech API
- Recharts

## Run locally

Requires [Ollama](https://ollama.com) running locally.

```bash
npm install
npm run dev
```

Runs on [http://localhost:4003](http://localhost:4003).
