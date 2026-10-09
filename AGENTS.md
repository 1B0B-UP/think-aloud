# This is NOT the Next.js you know

This version (16.2.6) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Te Matemata

Unified personal training platform. Two halves:

## Think (voice critical thinking)
User gets a scenario, walks through four steps out loud:
assumptions → supporting evidence → disconfirming evidence → consequences.
Voice via Web Speech API. Coach via Ollama. Pages: `/`, `/session`, `/history`.
API: `/api/voice-sessions`, `/api/voice-progress`, `/api/coach`, `/api/scenarios`, `/api/warmup`.
Tables: `voice_sessions`, `voice_steps`.

## Learn (engineering training, from noble-shell heritage)
20 predefined topics (PID, Kubernetes, hydraulic valves, etc.). FSRS flashcards,
AI quizzes, AI topic summaries, YouTube/Wikipedia feed, FE/PE prep, math refresh,
focus sessions, study habits, progress tracking.
Pages: `/topics`, `/drill`, `/quiz`, `/math`, `/exams`, `/learn`, `/feed`,
`/progress`, `/focus`, `/habits`, `/settings`.
API: `/api/topics`, `/api/flashcards`, `/api/quiz`, `/api/summary`, `/api/feed`,
`/api/focus`, `/api/sessions` (study sessions), `/api/progress`, `/api/chat`,
`/api/proxy`, `/api/ai/status`, `/api/settings`.
Tables: `topics`, `flashcards`, `quiz_attempts`, `study_sessions`,
`daily_stats`, `topic_skills`, `feed_channels`, `feed_items`, `feed_config`,
`app_settings`.

Stack: Next.js 16.2.6 (port 4003), React 19.2.4, Tailwind v4,
node:sqlite (`te-matemata.db`), Ollama (default `llama3.2:3b`), Recharts,
Web Speech API.

UI: Apple Intelligence theme (violet→indigo→cyan gradient, cool dark
background, SF Pro Display/Text/Rounded, New York for editorial moments).
Noble-shell heritage CSS classes (`.card-sheen`, `.callout`, `.badge`,
`.practice-*`, etc.) are kept and re-themed via legacy variable aliases in
`app/globals.css`.

Migration: `lib/db.ts` reads any legacy `think-aloud.db` once and copies
`sessions` → `voice_sessions` and `steps` → `voice_steps`.
