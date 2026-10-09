import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'te-matemata.db')
  : path.join(process.cwd(), 'te-matemata.db');
const LEGACY_VOICE_DB = process.env.VERCEL
  ? path.join('/tmp', 'think-aloud.db')
  : path.join(process.cwd(), 'think-aloud.db');

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

const PREDEFINED_TOPICS = [
  { name: 'Sequence Diagrams', description: 'Reading and writing UML sequence diagrams for system flows', icon: '📊' },
  { name: 'Control Systems (Hardware)', description: 'Hardware components in control loops: sensors, actuators, controllers', icon: '⚙️' },
  { name: 'Control Systems (Software)', description: 'Software architecture and algorithms for control systems', icon: '💻' },
  { name: 'PID Controls', description: 'Proportional-Integral-Derivative control theory and tuning', icon: '🎛️' },
  { name: 'Solenoid Valves', description: 'Electromagnetic valves for fluid and pneumatic control', icon: '🔌' },
  { name: 'Kubernetes', description: 'Container orchestration for distributed systems', icon: '☸️' },
  { name: 'Control Modes & States', description: 'State machines, operational modes, and mode transitions', icon: '🔄' },
  { name: 'Altitude Control Systems', description: 'Vertical position control in aerospace and marine systems', icon: '✈️' },
  { name: 'Sheaves & Load Pins', description: 'Mechanical pulleys, rigging hardware, and load sensing', icon: '⚓' },
  { name: 'LVDT & LVIT', description: 'Linear Variable Differential/Inductive Transducers for position sensing', icon: '📏' },
  { name: 'Actuator Control', description: 'Electric, hydraulic, and pneumatic actuator systems', icon: '🦾' },
  { name: 'Latches & Hatches', description: 'Mechanical locking mechanisms and hatch control systems', icon: '🔒' },
  { name: 'Joystick Control Algorithms', description: 'Input processing, deadbands, scaling, and multi-axis control', icon: '🕹️' },
  { name: 'Hardware Automation', description: 'PLCs, RTUs, and automated hardware control systems', icon: '🤖' },
  { name: 'Circuit Card Assemblies (CCA)', description: 'PCB design, components, and troubleshooting circuit cards', icon: '🔬' },
  { name: 'Built-In Test (BIT)', description: 'IBIT, CBIT, PBIT — test strategies for embedded systems', icon: '🧪' },
  { name: 'Health & Status Monitoring', description: 'System health reporting, fault detection, and diagnostics', icon: '📡' },
  { name: 'Hydraulic Valves', description: 'Directional, pressure, and flow control valves in hydraulic systems', icon: '💧' },
  { name: 'gRPC', description: 'High-performance RPC framework for microservices communication', icon: '🔗' },
  { name: 'RabbitMQ', description: 'Message broker for asynchronous communication and queuing', icon: '🐇' },
];

function initSchema(db: DatabaseSync) {
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`PRAGMA foreign_keys = ON`);

  // ───────── Te Matemata (engineering training) tables ─────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '🔧',
      is_custom INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      ease_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      due_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER REFERENCES topics(id),
      session_id TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT,
      correct INTEGER NOT NULL,
      response_time_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (date('now')),
      topic_id INTEGER REFERENCES topics(id),
      session_type TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      total_time_ms INTEGER DEFAULT 0,
      flashcards_reviewed INTEGER DEFAULT 0,
      quiz_questions INTEGER DEFAULT 0,
      quiz_correct INTEGER DEFAULT 0,
      focus_sessions INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS topic_skills (
      topic_id INTEGER PRIMARY KEY REFERENCES topics(id),
      level INTEGER DEFAULT 0,
      quiz_total INTEGER DEFAULT 0,
      quiz_correct INTEGER DEFAULT 0,
      cards_mastered INTEGER DEFAULT 0,
      last_practiced TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // FSRS extensions to flashcards
  try { db.exec('ALTER TABLE flashcards ADD COLUMN stability REAL DEFAULT 0'); } catch { /* exists */ }
  try { db.exec('ALTER TABLE flashcards ADD COLUMN difficulty REAL DEFAULT 5.0'); } catch { /* exists */ }
  try { db.exec('ALTER TABLE flashcards ADD COLUMN elaboration TEXT'); } catch { /* exists */ }

  // Feed feature tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE NOT NULL,
      channel_name TEXT NOT NULL,
      topic_tags TEXT NOT NULL DEFAULT '[]',
      last_fetched TEXT,
      item_count INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('video','image')),
      title TEXT NOT NULL,
      description TEXT,
      media_url TEXT NOT NULL,
      thumbnail_url TEXT,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      channel_name TEXT,
      relevance_score REAL DEFAULT 0.5,
      user_rating INTEGER DEFAULT 0,
      seen_count INTEGER DEFAULT 0,
      indexed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source, source_id, topic_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Reset any stuck 'building' state from a previous crashed run
  db.prepare("UPDATE feed_config SET value = 'idle' WHERE key = 'index_status' AND value = 'building'").run();
  try { db.exec('ALTER TABLE topic_skills ADD COLUMN feed_weight REAL DEFAULT 1.0'); } catch { /* exists */ }

  // ───────── Think Aloud (voice critical thinking) tables ─────────
  // Renamed from plain "sessions" to "voice_sessions" to avoid clashing with
  // noble-shell's study_sessions and the /api/sessions study-tracking route.
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      total_hints INTEGER DEFAULT 0,
      quality_score INTEGER,
      summary TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      user_text TEXT NOT NULL,
      coach_feedback TEXT,
      hints_used INTEGER DEFAULT 0,
      quality INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, step_key)
    )
  `);

  seedTopics(db);
  seedFeedChannels(db);
}

function seedTopics(db: DatabaseSync) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM topics').get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare('INSERT OR IGNORE INTO topics (name, description, icon) VALUES (?, ?, ?)');
  const insertSkill = db.prepare('INSERT OR IGNORE INTO topic_skills (topic_id) VALUES (?)');
  for (const t of PREDEFINED_TOPICS) {
    insert.run(t.name, t.description, t.icon);
    const row = db.prepare('SELECT id FROM topics WHERE name = ?').get(t.name) as { id: number };
    if (row) insertSkill.run(row.id);
  }
}

function seedFeedChannels(db: DatabaseSync) {
  const CHANNELS = [
    { channel_id: 'UCsBjURrPoezykLs9EqgamOA', channel_name: 'Fireship',               topic_tags: ['gRPC','Kubernetes','RabbitMQ'] },
    { channel_id: 'UCdngmbVKX1Tgre699-XLlUA', channel_name: 'TechWorld with Nana',    topic_tags: ['Kubernetes','Hardware Automation'] },
    { channel_id: 'UC9x0AN7BWHpCDHSm9NiJFJQ', channel_name: 'NetworkChuck',           topic_tags: ['Kubernetes','gRPC'] },
    { channel_id: 'UCKWaEZ-_VweaEx1j62do_vQ', channel_name: 'IBM Technology',         topic_tags: ['gRPC','RabbitMQ','Control Systems (Software)'] },
    { channel_id: 'UCvqbFHwN-nwalWPjMpolhqA', channel_name: 'CNCF',                   topic_tags: ['Kubernetes','gRPC'] },
    { channel_id: 'UCk0fGHncEJ41oyMbx6stJNA', channel_name: 'The Engineering Mindset', topic_tags: ['Control Systems (Hardware)','Actuator Control','Hydraulic Valves','Solenoid Valves'] },
    { channel_id: 'UCMOqf8ab-42UUQIdVoKwjlQ', channel_name: 'Practical Engineering',  topic_tags: ['PID Controls','Control Systems (Hardware)','Sheaves & Load Pins'] },
    { channel_id: 'UCB2OU9CGoEAGBCMSRhDtmvA', channel_name: 'MATLAB',                topic_tags: ['PID Controls','Control Systems (Software)','Altitude Control Systems'] },
    { channel_id: 'UCR1IuLEqb6UEA_zQ81kwXfg', channel_name: 'Real Engineering',       topic_tags: ['Control Systems (Hardware)','Circuit Card Assemblies (CCA)','Built-In Test (BIT)'] },
    { channel_id: 'UCVrFfKToRb4mULFfVHj5bkQ', channel_name: "Phil's Lab",            topic_tags: ['Circuit Card Assemblies (CCA)','LVDT & LVIT','Health & Status Monitoring'] },
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO feed_channels (channel_id, channel_name, topic_tags) VALUES (?, ?, ?)');
  for (const ch of CHANNELS) {
    insert.run(ch.channel_id, ch.channel_name, JSON.stringify(ch.topic_tags));
  }
}

/* ───────── One-time data migrations ─────────
   Migrate voice-session data from the old think-aloud.db if it exists. */
function runMigrations(db: DatabaseSync) {
  const flag = (db.prepare('SELECT value FROM app_settings WHERE key = ?').get('migrated_from_think_aloud_db') as { value: string } | undefined)?.value;
  if (flag === '1') return;

  if (fs.existsSync(LEGACY_VOICE_DB)) {
    try {
      const old = new DatabaseSync(LEGACY_VOICE_DB);

      // Copy sessions → voice_sessions (preserving IDs)
      const oldSessions = old.prepare('SELECT * FROM sessions').all() as Array<{
        id: number; scenario: string; topic: string; difficulty: string;
        started_at: string; completed_at: string | null;
        total_hints: number; quality_score: number | null; summary: string | null;
      }>;
      const insertVS = db.prepare(`
        INSERT OR IGNORE INTO voice_sessions
          (id, scenario, topic, difficulty, started_at, completed_at, total_hints, quality_score, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of oldSessions) {
        insertVS.run(s.id, s.scenario, s.topic, s.difficulty, s.started_at, s.completed_at, s.total_hints, s.quality_score, s.summary);
      }

      // Copy steps → voice_steps
      const oldSteps = old.prepare('SELECT * FROM steps').all() as Array<{
        id: number; session_id: number; step_key: string; user_text: string;
        coach_feedback: string | null; hints_used: number; quality: number | null; created_at: string;
      }>;
      const insertVST = db.prepare(`
        INSERT OR IGNORE INTO voice_steps
          (id, session_id, step_key, user_text, coach_feedback, hints_used, quality, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of oldSteps) {
        insertVST.run(s.id, s.session_id, s.step_key, s.user_text, s.coach_feedback, s.hints_used, s.quality, s.created_at);
      }

      old.close();
      console.log(`[migration] copied ${oldSessions.length} voice sessions + ${oldSteps.length} steps from think-aloud.db`);
    } catch (e) {
      console.warn('[migration] failed to copy from think-aloud.db:', e);
    }
  }

  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('migrated_from_think_aloud_db', '1');
}

export function ensureTopicSkill(topicId: number) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO topic_skills (topic_id) VALUES (?)').run(topicId);
}

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function upsertDailyStats(updates: Partial<{
  total_time_ms: number;
  flashcards_reviewed: number;
  quiz_questions: number;
  quiz_correct: number;
  focus_sessions: number;
  xp_earned: number;
}>) {
  const db = getDb();
  const today = localDateStr();
  db.prepare(`INSERT OR IGNORE INTO daily_stats (date) VALUES (?)`).run(today);
  for (const [key, val] of Object.entries(updates)) {
    db.prepare(`UPDATE daily_stats SET ${key} = ${key} + ? WHERE date = ?`).run(val, today);
  }
}

export function setSetting(key: string, value: string) {
  const d = getDb();
  d.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getSetting(key: string): string | null {
  const d = getDb();
  const row = d.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
