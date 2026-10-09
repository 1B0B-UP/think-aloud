/* Browser-only voice helpers. Web Speech API: SpeechRecognition + speechSynthesis. */

// Minimal typings — browser APIs vary
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { isFinal: boolean; 0: SpeechRecognitionAlternative; length: number }
interface SpeechRecognitionResultList { length: number; [i: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorEvent extends Event { error: string; message?: string }

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((ev: Event) => void) | null;
  onspeechend: ((ev: Event) => void) | null;
}

interface SpeechRecognitionCtor { new (): SpeechRecognitionInstance }

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null && typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/* ───────── Punctuation cleanup ─────────
   Design:
   - During dictation, pauses must NOT add periods. The Web Speech API commits
     final results on short pauses, but a pause is not a sentence boundary.
   - tidyChunk only handles spoken punctuation ("period", "comma", etc.) and
     whitespace. It does NOT auto-capitalize or auto-append punctuation.
   - joinChunks space-joins, smoothing over capitalization quirks: if the prior
     buffer doesn't end in terminal punctuation, the new chunk is treated as a
     mid-sentence continuation and its first letter is lowercased (unless the
     word is "I" or all-caps like "AI").
   - finalPolish is called only when the user submits — it capitalizes the
     first letter and ensures the text ends with terminal punctuation. */

const PUNCT_RULES: [RegExp, string][] = [
  [/\s+(period|full stop)(?=\s|$|[.,!?])/gi, '.'],
  [/\s+comma(?=\s|$|[.,!?])/gi, ','],
  [/\s+(question mark)(?=\s|$|[.,!?])/gi, '?'],
  [/\s+(exclamation (?:point|mark))(?=\s|$|[.,!?])/gi, '!'],
  [/\s+colon(?=\s|$|[.,!?])/gi, ':'],
  [/\s+semicolon(?=\s|$|[.,!?])/gi, ';'],
  [/\s+dash(?=\s|$|[.,!?])/gi, ' —'],
  [/\s+new line(?=\s|$)/gi, '\n'],
  [/\s+new paragraph(?=\s|$)/gi, '\n\n'],
];

/** Handle spoken punctuation tokens and collapse whitespace. Does NOT add
 *  periods or change case — pauses are not sentence boundaries. */
export function tidyChunk(raw: string): string {
  if (!raw) return '';
  let t = raw.trim();
  if (!t) return '';
  for (const [re, sub] of PUNCT_RULES) t = t.replace(re, sub);
  // Collapse whitespace and pull punctuation back against its preceding word
  t = t.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
  return t;
}

/** True if the new chunk's first word starts with a capital letter for an
 *  intrinsic reason (proper noun, "I", acronym, etc.) and shouldn't be
 *  lowercased when joined mid-sentence. */
function startsWithIntrinsicCap(word: string): boolean {
  if (word === 'I' || word === "I'm" || word === "I've" || word === "I'll" || word === "I'd") return true;
  // All-caps token like "AI", "USA"
  if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) return true;
  return false;
}

/** Smart space-join: if `prev` does not end with terminal punctuation, treat
 *  `next` as a continuation and lowercase its first letter (unless intrinsic). */
export function joinChunks(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  const prevEndsSentence = /[.!?]\s*$/.test(prev);
  let n = next;
  if (!prevEndsSentence) {
    const firstWord = n.split(/\s/)[0];
    if (firstWord && !startsWithIntrinsicCap(firstWord) && /^[A-Z]/.test(firstWord)) {
      n = firstWord.charAt(0).toLowerCase() + firstWord.slice(1) + n.slice(firstWord.length);
    }
  }
  return `${prev} ${n}`.replace(/[ \t]+/g, ' ').trim();
}

/** Final polish for a complete response, applied only at submit time.
 *  Ensures the result reads as a complete sentence (or sentences). */
export function finalPolish(text: string): string {
  let t = text.trim();
  if (!t) return '';
  // Capitalize the first letter
  t = t[0].toUpperCase() + t.slice(1);
  // Ensure terminal punctuation (only if the text doesn't already end with one)
  if (!/[.!?]$/.test(t)) t += '.';
  return t;
}

/* ───────── Speech-to-text ───────── */

export interface ListenerCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}

export class VoiceListener {
  private rec: SpeechRecognitionInstance | null = null;
  private cbs: ListenerCallbacks;
  private wantOn = false;

  constructor(cbs: ListenerCallbacks) { this.cbs = cbs; }

  start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.cbs.onError('Voice input not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }
    this.wantOn = true;
    this.spawn();
  }

  private spawn() {
    const Ctor = getRecognitionCtor()!;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const t = result[0].transcript;
        if (result.isFinal) {
          this.cbs.onFinal(t.trim());
        } else {
          interim += t;
        }
      }
      if (interim) this.cbs.onInterim(interim.trim());
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        this.cbs.onError(ev.error);
      }
    };

    rec.onend = () => {
      if (this.wantOn) {
        try { this.spawn(); } catch { this.cbs.onEnd(); }
      } else {
        this.cbs.onEnd();
      }
    };

    try {
      rec.start();
      this.rec = rec;
    } catch (err) {
      this.cbs.onError(err instanceof Error ? err.message : 'Could not start mic');
    }
  }

  stop()  { this.wantOn = false; try { this.rec?.stop();  } catch { /* noop */ } }
  abort() { this.wantOn = false; try { this.rec?.abort(); } catch { /* noop */ } }
}

/* ───────── Text-to-speech ─────────
   Voice preference order (best → fallback):
   1. User's saved choice (localStorage: tta_voice_name)
   2. Siri voices  (only Safari exposes these by name)
   3. Premium voices  (macOS: requires user to download via System Settings)
   4. Enhanced voices  (macOS: also downloaded; better than base)
   5. Google network voices in Chrome
   6. Decent local en-US voices (Samantha, Allison, Ava, Karen)
   7. Any en-* voice
   8. Whatever the browser hands us first */

const STORAGE_KEYS = { voice: 'tta_voice_name', rate: 'tta_voice_rate' } as const;

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedVoiceKey: string = '';            // invalidate cache when prefs change
let activeQueue: SpeechQueue | null = null;

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function getSavedVoiceName(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(STORAGE_KEYS.voice) || ''; } catch { return ''; }
}

export function getSavedRate(): number {
  if (typeof window === 'undefined') return 1.0;
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_KEYS.rate) || '');
    if (Number.isFinite(v) && v >= 0.6 && v <= 1.6) return v;
  } catch { /* ignore */ }
  return 1.0;
}

export function saveVoicePref(name: string, rate: number) {
  if (typeof window === 'undefined') return;
  try {
    if (name) localStorage.setItem(STORAGE_KEYS.voice, name);
    else localStorage.removeItem(STORAGE_KEYS.voice);
    localStorage.setItem(STORAGE_KEYS.rate, String(rate));
  } catch { /* ignore */ }
  // Invalidate cache so the next speak() picks up the change.
  cachedVoice = null;
  cachedVoiceKey = '';
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Cache key includes the saved voice name and the voice-list length, so
  // the cache invalidates when the user changes pref or new voices load.
  const key = `${getSavedVoiceName()}::${voices.length}`;
  if (cachedVoice && cachedVoiceKey === key) return cachedVoice;

  const savedName = getSavedVoiceName();

  // Tier 1: user's explicit choice
  if (savedName) {
    const chosen = voices.find(v => v.name === savedName);
    if (chosen) { cachedVoice = chosen; cachedVoiceKey = key; return chosen; }
  }

  const en = (v: SpeechSynthesisVoice) => v.lang.startsWith('en');
  const enUS = (v: SpeechSynthesisVoice) => v.lang === 'en-US';

  // Tier 2: Siri (Safari)
  const siri = voices.find(v => /siri/i.test(v.name) && en(v));
  if (siri) { cachedVoice = siri; cachedVoiceKey = key; return siri; }

  // Tier 3: Premium voices, en-US first
  const premiumEnUS = voices.find(v => /\(premium\)/i.test(v.name) && enUS(v));
  if (premiumEnUS) { cachedVoice = premiumEnUS; cachedVoiceKey = key; return premiumEnUS; }
  const premiumEn = voices.find(v => /\(premium\)/i.test(v.name) && en(v));
  if (premiumEn) { cachedVoice = premiumEn; cachedVoiceKey = key; return premiumEn; }

  // Tier 4: Enhanced voices, en-US first
  const enhancedEnUS = voices.find(v => /\(enhanced\)/i.test(v.name) && enUS(v));
  if (enhancedEnUS) { cachedVoice = enhancedEnUS; cachedVoiceKey = key; return enhancedEnUS; }
  const enhancedEn = voices.find(v => /\(enhanced\)/i.test(v.name) && en(v));
  if (enhancedEn) { cachedVoice = enhancedEn; cachedVoiceKey = key; return enhancedEn; }

  // Tier 5: Google network voices (Chrome)
  const googleUS = voices.find(v => /google.*us english/i.test(v.name));
  if (googleUS) { cachedVoice = googleUS; cachedVoiceKey = key; return googleUS; }
  const googleEn = voices.find(v => /google/i.test(v.name) && en(v));
  if (googleEn) { cachedVoice = googleEn; cachedVoiceKey = key; return googleEn; }

  // Tier 6: known-decent local voices
  const NICE_NAMES = ['Samantha', 'Allison', 'Ava', 'Joelle', 'Zoe', 'Karen', 'Moira', 'Tessa', 'Veena'];
  for (const name of NICE_NAMES) {
    const match = voices.find(v => v.name === name);
    if (match) { cachedVoice = match; cachedVoiceKey = key; return match; }
  }

  // Tier 7: any en
  const anyEn = voices.find(en);
  if (anyEn) { cachedVoice = anyEn; cachedVoiceKey = key; return anyEn; }

  // Tier 8: whatever
  cachedVoice = voices[0]; cachedVoiceKey = key;
  return cachedVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null; cachedVoiceKey = '';
    pickVoice();
  };
}

/** Prime the TTS engine so the first real speak() is instant. Safe to call
 *  repeatedly. Also forces the voice list to populate (it's async on Chrome). */
export function primeTTS() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.getVoices();
  pickVoice();
}

/** Configure an utterance with the picked voice and natural prosody defaults. */
function configureUtterance(text: string, rate?: number): SpeechSynthesisUtterance {
  const utt = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) utt.voice = v;
  utt.rate = rate ?? getSavedRate();
  // Slightly under 1.0 pitch reads as more relaxed and natural for narration.
  utt.pitch = 0.98;
  utt.volume = 1.0;
  return utt;
}

export function speak(text: string, opts: { onEnd?: () => void; rate?: number } = {}): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  cancelSpeech();
  const utt = configureUtterance(text, opts.rate);

  // Chrome occasionally fails to fire `onend` (notably after cancel/resume cycles
  // or for ultra-short utterances). Estimate a safe ceiling from text length at
  // the configured rate and add 50% slack; if neither onend nor onerror fires
  // by then, treat it as done so we don't deadlock the caller.
  let done = false;
  const finish = () => { if (done) return; done = true; opts.onEnd?.(); };
  const wordsPerSec = 2.6 * (utt.rate || 1);
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  const estMs = Math.min(90_000, Math.max(2_000, Math.ceil(wordCount / wordsPerSec * 1500) + 1500));
  const watchdog = window.setTimeout(finish, estMs);
  utt.onend = () => { window.clearTimeout(watchdog); finish(); };
  utt.onerror = () => { window.clearTimeout(watchdog); finish(); };

  window.speechSynthesis.speak(utt);
  return utt;
}

export function cancelSpeech() {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (activeQueue) {
    activeQueue.cancel();
    activeQueue = null;
  }
}

/* ───────── Streaming speech queue ─────────
   Enqueue sentences as they arrive from a streaming LLM response, and the
   queue plays them sequentially. Lets the user hear the coach within ~1s
   of submitting instead of waiting for the whole response. */

export class SpeechQueue {
  private queue: string[] = [];
  private speaking = false;
  private finished = false;
  private cancelled = false;
  private onDoneCb: (() => void) | null = null;
  private rate: number;

  constructor(opts: { rate?: number } = {}) {
    this.rate = opts.rate ?? getSavedRate();
    // Stop any prior speaking (and cancel any prior queue) when a new one starts.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeQueue && activeQueue !== this) {
      activeQueue.cancelled = true;
      activeQueue.queue = [];
      activeQueue.onDoneCb = null;
    }
    activeQueue = this;
  }

  enqueue(text: string) {
    if (this.cancelled) return;
    const t = text.trim();
    if (!t) return;
    this.queue.push(t);
    this.tick();
  }

  /** Mark stream complete. Callback fires once the last queued sentence ends. */
  finish(cb: () => void) {
    if (this.cancelled) return;
    this.finished = true;
    this.onDoneCb = cb;
    this.maybeDone();
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
    this.onDoneCb = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
    if (activeQueue === this) activeQueue = null;
  }

  private maybeDone() {
    if (this.finished && !this.speaking && this.queue.length === 0) {
      if (activeQueue === this) activeQueue = null;
      const cb = this.onDoneCb;
      this.onDoneCb = null;
      cb?.();
    }
  }

  private tick() {
    if (this.cancelled || this.speaking) return;
    if (this.queue.length === 0) { this.maybeDone(); return; }
    const text = this.queue.shift()!;
    this.speaking = true;
    const utt = configureUtterance(text, this.rate);

    let done = false;
    const settle = () => {
      if (done) return; done = true;
      window.clearTimeout(watchdog);
      this.speaking = false;
      if (this.cancelled) return;
      this.tick();
    };
    // Per-sentence watchdog — see speak() comment.
    const wordsPerSec = 2.6 * (this.rate || 1);
    const wordCount = Math.max(1, text.trim().split(/\s+/).length);
    const estMs = Math.min(60_000, Math.max(1_500, Math.ceil(wordCount / wordsPerSec * 1500) + 1500));
    const watchdog = window.setTimeout(settle, estMs);

    utt.onend = settle;
    utt.onerror = settle;
    window.speechSynthesis.speak(utt);
  }
}

/** Pull complete sentences out of a streaming buffer. Stops at the first `[[`
 *  so the coach's `[[score=N, ready=Y]]` tag is never spoken. When `streamDone`
 *  is true, whatever's left (minus the tag) is flushed as a final sentence even
 *  if it doesn't end with terminal punctuation. */
export function takeSentences(buf: string, streamDone: boolean): { sentences: string[]; remainder: string } {
  // Never speak the machine-readable tag region.
  const tagIdx = buf.indexOf('[[');
  const spoken = tagIdx >= 0 ? buf.slice(0, tagIdx) : buf;
  const tagPart = tagIdx >= 0 ? buf.slice(tagIdx) : '';

  const sentences: string[] = [];
  let cursor = 0;
  // Match terminal punctuation followed by whitespace — that's a sentence boundary
  // that's safe to flush mid-stream. (We can't flush a `.` at the very end of the
  // buffer because more text might still arrive that extends the sentence.)
  const re = /[.!?]+["')\]]?\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(spoken)) !== null) {
    const end = m.index + m[0].length;
    const piece = spoken.slice(cursor, end).trim();
    if (piece) sentences.push(piece);
    cursor = end;
  }

  let remainder = spoken.slice(cursor);

  // If the stream is over OR the tag has already appeared (meaning the spoken
  // content is done), flush whatever's left as a final sentence.
  const spokenDone = streamDone || tagIdx >= 0;
  if (spokenDone) {
    const tail = remainder.trim();
    if (tail) sentences.push(tail);
    remainder = '';
  }

  return { sentences, remainder: remainder + tagPart };
}

/* ───────── Voice command detection ─────────
   Strict matching: a command must BE the whole short utterance, not a fragment
   inside a longer sentence. This avoids accidentally firing "next" when the
   user says "the next step would be...". */

export type VoiceCommand = 'hint' | 'next' | 'skip' | 'repeat' | 'stop';

const COMMAND_PATTERNS: { cmd: VoiceCommand; re: RegExp; maxWords: number }[] = [
  { cmd: 'hint',   re: /^(hint|need a hint|give me a hint|i'?m stuck|i am stuck|help me out|i need help)\.?$/i, maxWords: 5 },
  { cmd: 'next',   re: /^(next|next step|next please|move on|i'?m done|that'?s it|that is it|continue|okay next|go next|ready|done|next one)\.?$/i, maxWords: 4 },
  { cmd: 'skip',   re: /^(skip|skip this|skip step|skip ahead|pass)\.?$/i, maxWords: 3 },
  { cmd: 'repeat', re: /^(repeat|say again|say that again|what was that|repeat that|come again)\.?$/i, maxWords: 5 },
  { cmd: 'stop',   re: /^(stop|stop session|end session|exit|i'?m finished|all done)\.?$/i, maxWords: 4 },
];

function normalizeForCommand(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?]+$/, '').trim();
}

export function detectCommand(text: string): VoiceCommand | null {
  const norm = normalizeForCommand(text);
  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  for (const { cmd, re, maxWords } of COMMAND_PATTERNS) {
    if (wordCount <= maxWords && re.test(norm)) return cmd;
  }
  return null;
}

/** If the chunk is a command, return ''. Otherwise return the tidied chunk. */
export function commandOrContent(rawChunk: string): { command: VoiceCommand | null; content: string } {
  const command = detectCommand(rawChunk);
  if (command) return { command, content: '' };
  return { command: null, content: tidyChunk(rawChunk) };
}
