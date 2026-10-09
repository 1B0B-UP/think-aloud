import { DatabaseSync } from 'node:sqlite';
import { ollamaGenerate } from './ollama';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface FeedItem {
  id: number;
  topic_id: number;
  type: 'video' | 'image';
  title: string;
  description: string | null;
  media_url: string;
  thumbnail_url: string | null;
  source: 'youtube' | 'wikipedia' | 'ai' | 'search';
  source_id: string;
  channel_name: string | null;
  relevance_score: number;
  user_rating: number;
  seen_count: number;
  indexed_at: string;
}

export interface IndexStatus {
  status: 'idle' | 'building' | 'done' | 'error';
  last_full_refresh: string | null;
  item_count: number;
  is_stale: boolean;
}

interface ChannelRow {
  id: number;
  channel_id: string;
  channel_name: string;
  topic_tags: string;
  last_fetched: string | null;
  enabled: number;
}

/* ── Wikipedia slug overrides ───────────────────────────────────────────── */
// Maps topic names → Wikipedia page titles (for topics whose names differ from WP)
// Primary Wikipedia slugs per topic
const WIKI_SLUGS: Record<string, string> = {
  'PID Controls':                  'PID_controller',
  'Control Systems (Hardware)':    'Control_system',
  'Control Systems (Software)':    'Control_theory',
  'Solenoid Valves':               'Solenoid_valve',
  'Control Modes & States':        'Finite-state_machine',
  'Altitude Control Systems':      'Aircraft_flight_control_system',
  'Sheaves & Load Pins':           'Block_and_tackle',
  'LVDT & LVIT':                   'Linear_variable_differential_transformer',
  'Actuator Control':              'Actuator',
  'Latches & Hatches':             'Latch_(engineering)',
  'Joystick Control Algorithms':   'Joystick',
  'Hardware Automation':           'Programmable_logic_controller',
  'Circuit Card Assemblies (CCA)': 'Printed_circuit_board',
  'Built-In Test (BIT)':           'Avionics',
  'Health & Status Monitoring':    'Industrial_control_system',
  'Hydraulic Valves':              'Hydraulic_machinery',
  'gRPC':                          'Web_API',
  'RabbitMQ':                      'Message_broker',
  'Kubernetes':                    'Docker_(software)',
  'Sequence Diagrams':             'Sequence_diagram',
};

// Fallback Wikipedia slugs — tried if primary returns no thumbnail
const WIKI_SLUG_FALLBACKS: Record<string, string[]> = {
  'Altitude Control Systems':      ['Cockpit', 'Flight_instruments'],
  'Built-In Test (BIT)':           ['Electronic_test_equipment', 'Built-in_self-test'],
  'Health & Status Monitoring':    ['SCADA', 'Condition_monitoring'],
  'Kubernetes':                    ['Microservices', 'Kubernetes'],
  'RabbitMQ':                      ['Advanced_Message_Queuing_Protocol', 'RabbitMQ'],
  'gRPC':                          ['Computer_network', 'GRPC'],
  'Control Modes & States':        ['State_machine', 'Automata_theory'],
  'LVDT & LVIT':                   ['Inductance', 'Displacement_(vector)'],
};

// Topic-specific gradient backgrounds for cards without Wikipedia thumbnails
const TOPIC_GRADIENTS: Record<string, string> = {
  'PID Controls':                  'linear-gradient(135deg, #1e3a2f 0%, #0f2920 100%)',
  'Kubernetes':                    'linear-gradient(135deg, #1a2a4a 0%, #0d1f3c 100%)',
  'gRPC':                          'linear-gradient(135deg, #2a1a4a 0%, #1a0d3c 100%)',
  'RabbitMQ':                      'linear-gradient(135deg, #3a1a1a 0%, #2a0d0d 100%)',
  'Sequence Diagrams':             'linear-gradient(135deg, #1a2a3a 0%, #0d1a2a 100%)',
  'Control Systems (Software)':    'linear-gradient(135deg, #1a3a2a 0%, #0d2a1a 100%)',
  'Altitude Control Systems':      'linear-gradient(135deg, #1a1a3a 0%, #0d0d2a 100%)',
  'LVDT & LVIT':                   'linear-gradient(135deg, #2a2a1a 0%, #1a1a0d 100%)',
  'Built-In Test (BIT)':           'linear-gradient(135deg, #3a2a1a 0%, #2a1a0d 100%)',
  'Health & Status Monitoring':    'linear-gradient(135deg, #1a3a1a 0%, #0d2a0d 100%)',
};

function topicGradient(topicName: string): string {
  return TOPIC_GRADIENTS[topicName] ?? 'linear-gradient(135deg, #1a1a2a 0%, #0d0d1a 100%)';
}

/* ── YouTube RSS parser ─────────────────────────────────────────────────── */

interface RSSVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
}

function parseYouTubeRSS(xml: string): RSSVideo[] {
  const results: RSSVideo[] = [];
  const entryRx = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRx.exec(xml)) !== null) {
    const block   = m[1];
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/i.exec(block)?.[1]?.trim() ?? '';
    if (!videoId) continue;
    const rawTitle = /<title>([^<]*)<\/title>/i.exec(block)?.[1]?.trim() ?? '';
    const title = rawTitle
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    const descBlock = /<media:description>([\s\S]*?)<\/media:description>/i.exec(block)?.[1] ?? '';
    const description = descBlock.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').trim().slice(0,500);
    const thumbnail = /<media:thumbnail[^>]+url="([^"]+)"/i.exec(block)?.[1] ?? '';
    results.push({ videoId, title, description, thumbnail });
  }
  return results;
}

export async function fetchChannelVideos(channelId: string): Promise<RSSVideo[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    return parseYouTubeRSS(await res.text());
  } catch { return []; }
}

/* ── Wikimedia Commons image search ────────────────────────────────────── */
// Better query terms per topic — searches Commons for real engineering images
const COMMONS_QUERIES: Record<string, string> = {
  'PID Controls':                  'PID controller block diagram',
  'Control Systems (Hardware)':    'control system hardware industrial',
  'Control Systems (Software)':    'feedback control loop diagram',
  'Solenoid Valves':               'solenoid valve cross-section',
  'Kubernetes':                    'container orchestration architecture',
  'Control Modes & States':        'state machine finite automaton diagram',
  'Altitude Control Systems':      'aircraft autopilot altitude hold',
  'Sheaves & Load Pins':           'sheave pulley block tackle rigging',
  'LVDT & LVIT':                   'LVDT linear variable differential transformer',
  'Actuator Control':              'hydraulic actuator cylinder',
  'Latches & Hatches':             'aerospace hatch latch mechanism',
  'Joystick Control Algorithms':   'joystick controller industrial equipment',
  'Hardware Automation':           'PLC industrial automation cabinet',
  'Circuit Card Assemblies (CCA)': 'printed circuit board PCB assembly',
  'Built-In Test (BIT)':           'embedded system test equipment rack',
  'Health & Status Monitoring':    'plant control room computer screen',
  'Hydraulic Valves':              'hydraulic directional control valve',
  'gRPC':                          'microservices API architecture diagram',
  'RabbitMQ':                      'message queue broker architecture',
  'Sequence Diagrams':             'UML sequence diagram',
};

export async function fetchCommonsImage(topicName: string): Promise<string | null> {
  const query = COMMONS_QUERIES[topicName] ?? topicName;
  try {
    // Step 1: search Commons for image files
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=15&format=json&origin=*`,
      { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'TeMatemataFeed/1.0 (educational app)' } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as {
      query?: { search?: { title: string }[] };
    };

    // Filter for raster image formats (not SVG/PDF which may not render well)
    const candidates = (searchData.query?.search ?? [])
      .map(r => r.title)
      .filter(t => /\.(jpg|jpeg|png|webp|gif)$/i.test(t));

    if (!candidates.length) return null;

    // Step 2: get a thumbnail URL for the first candidate
    const imageInfoRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(candidates[0])}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
      { signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'TeMatemataFeed/1.0 (educational app)' } }
    );
    if (!imageInfoRes.ok) return null;
    const infoData = await imageInfoRes.json() as {
      query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> };
    };

    const pages = Object.values(infoData.query?.pages ?? {});
    const ii    = pages[0]?.imageinfo?.[0];
    return ii?.thumburl ?? ii?.url ?? null;
  } catch { return null; }
}

/* ── Wikipedia ──────────────────────────────────────────────────────────── */

interface WikiSummary {
  title: string;
  extract: string;
  thumbnail: string | null;
  gradient: string;
}

async function fetchWikiSlug(slug: string): Promise<{ title: string; extract: string; thumbnail: string | null } | null> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'TeMatemataFeed/1.0 (educational app)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { title: string; extract: string; thumbnail?: { source: string; width: number } };
    // Accept thumbnails 80px wide or larger — logos count
    const thumbnail = (data.thumbnail && data.thumbnail.width >= 80) ? data.thumbnail.source : null;
    return { title: data.title, extract: data.extract?.slice(0, 600) ?? '', thumbnail };
  } catch { return null; }
}

export async function fetchWikipediaSummary(topicName: string): Promise<WikiSummary | null> {
  const primarySlug  = WIKI_SLUGS[topicName] ?? topicName.replace(/ /g, '_');
  const fallbacks    = WIKI_SLUG_FALLBACKS[topicName] ?? [];
  const slugsToTry   = [primarySlug, ...fallbacks];

  let bestResult: { title: string; extract: string; thumbnail: string | null } | null = null;

  for (const slug of slugsToTry) {
    const result = await fetchWikiSlug(slug);
    if (!result) continue;
    if (!bestResult) bestResult = result;
    // Stop as soon as we have a thumbnail
    if (result.thumbnail) { bestResult = result; break; }
  }

  if (!bestResult) return null;
  return {
    title:     bestResult.title,
    extract:   bestResult.extract,
    thumbnail: bestResult.thumbnail,
    gradient:  topicGradient(topicName),
  };
}

/* ── AI-generated content ───────────────────────────────────────────────── */

async function generateAICard(topicName: string, model: string): Promise<{ title: string; description: string } | null> {
  const prompt = `You are a senior systems engineer teaching a junior engineer about "${topicName}".
Write 3 punchy facts that would make someone go "oh, that's how it works!" — focus on the practical, real-world insight.
Each fact should be 1 sentence. Start each with "• ".
Return ONLY the 3 bullet points, nothing else.`;
  try {
    const raw = await ollamaGenerate(prompt, model);
    if (!raw) return null;
    return { title: `⚡ ${topicName} — quick hits`, description: raw.trim().slice(0, 500) };
  } catch { return null; }
}

/* ── Status helpers ─────────────────────────────────────────────────────── */

export function getFeedStatus(db: DatabaseSync): IndexStatus {
  const sr = db.prepare("SELECT value FROM feed_config WHERE key = 'index_status'").get() as { value: string } | undefined;
  const rr = db.prepare("SELECT value FROM feed_config WHERE key = 'last_full_refresh'").get() as { value: string } | undefined;
  const cr = db.prepare('SELECT COUNT(*) as c FROM feed_items').get() as { c: number };
  const lastRefresh = rr?.value ?? null;
  const stale = !lastRefresh || (Date.now() - new Date(lastRefresh).getTime()) > 2 * 24 * 60 * 60 * 1000;
  return {
    status: (sr?.value as IndexStatus['status']) ?? 'idle',
    last_full_refresh: lastRefresh,
    item_count: cr.c,
    is_stale: stale,
  };
}

/* ── Index builder ──────────────────────────────────────────────────────── */

export async function buildFeedIndex(db: DatabaseSync, model: string): Promise<void> {
  db.prepare("INSERT OR REPLACE INTO feed_config (key, value) VALUES ('index_status', 'building')").run();

  try {
    const topics = db.prepare('SELECT id, name FROM topics').all() as { id: number; name: string }[];
    const topicMap = new Map(topics.map(t => [t.name, t.id]));

    // ── 1. YouTube RSS ────────────────────────────────────────────────────
    const channels = db.prepare('SELECT * FROM feed_channels WHERE enabled = 1').all() as ChannelRow[];
    for (const ch of channels) {
      const tagNames: string[] = JSON.parse(ch.topic_tags);
      const matched = tagNames.map(n => ({ name: n, id: topicMap.get(n) })).filter((t): t is { name: string; id: number } => t.id !== undefined);
      if (!matched.length) continue;

      const videos = await fetchChannelVideos(ch.channel_id);
      for (const v of videos.slice(0, 12)) {
        for (const topic of matched) {
          const exists = db.prepare("SELECT id FROM feed_items WHERE source='youtube' AND source_id=? AND topic_id=?").get(v.videoId, topic.id);
          if (exists !== undefined) continue;
          const embedUrl = `https://www.youtube.com/embed/${v.videoId}?rel=0`;
          db.prepare(`INSERT OR IGNORE INTO feed_items (topic_id,type,title,description,media_url,thumbnail_url,source,source_id,channel_name,relevance_score) VALUES (?,?,?,?,?,?,'youtube',?,?,0.7)`)
            .run(topic.id, 'video', v.title, v.description.slice(0,300), embedUrl, v.thumbnail, v.videoId, ch.channel_name);
        }
      }
      const cnt = (db.prepare('SELECT COUNT(*) as c FROM feed_items WHERE channel_name=?').get(ch.channel_name) as { c: number }).c;
      db.prepare("UPDATE feed_channels SET last_fetched=datetime('now'), item_count=? WHERE channel_id=?").run(cnt, ch.channel_id);
    }

    // ── 2. Wikipedia + Commons image fallback ────────────────────────────
    for (const topic of topics) {
      const existsWiki = db.prepare("SELECT id FROM feed_items WHERE source='wikipedia' AND topic_id=? LIMIT 1").get(topic.id);
      if (existsWiki !== undefined) continue;
      const wiki = await fetchWikipediaSummary(topic.name);
      if (!wiki || !wiki.extract) continue;

      // Try: Wikipedia thumbnail → Wikimedia Commons search → gradient fallback
      let thumbnail = wiki.thumbnail;
      if (!thumbnail) thumbnail = await fetchCommonsImage(topic.name);
      const mediaUrl = thumbnail ?? `gradient:${wiki.gradient}`;

      db.prepare(`INSERT OR IGNORE INTO feed_items (topic_id,type,title,description,media_url,thumbnail_url,source,source_id,relevance_score) VALUES (?,?,?,?,?,?,'wikipedia',?,1.0)`)
        .run(topic.id, 'image', wiki.title, wiki.extract, mediaUrl, thumbnail, topic.name);
    }

    // ── 3. YouTube search tiles (work without RSS) ────────────────────────
    // Every topic gets a "Search YouTube" card with the right query
    const SEARCH_QUERIES: Record<string, string> = {
      'PID Controls':                  'PID control systems tutorial',
      'Control Systems (Hardware)':    'control systems hardware engineering',
      'Control Systems (Software)':    'control theory software engineering',
      'Solenoid Valves':               'solenoid valve how it works',
      'Kubernetes':                    'Kubernetes explained beginners',
      'Control Modes & States':        'state machine control systems',
      'Altitude Control Systems':      'altitude control aerospace engineering',
      'Sheaves & Load Pins':           'rigging sheaves load pins engineering',
      'LVDT & LVIT':                   'LVDT linear variable differential transformer',
      'Actuator Control':              'actuator control systems tutorial',
      'Latches & Hatches':             'electromechanical latch hatch systems',
      'Joystick Control Algorithms':   'joystick control algorithm deadband scaling',
      'Hardware Automation':           'PLC programmable logic controller tutorial',
      'Circuit Card Assemblies (CCA)': 'circuit card assembly PCB electronics',
      'Built-In Test (BIT)':           'built-in test embedded systems BIT BITE',
      'Health & Status Monitoring':    'health monitoring embedded systems HUMS',
      'Hydraulic Valves':              'hydraulic valve types how they work',
      'gRPC':                          'gRPC explained tutorial',
      'RabbitMQ':                      'RabbitMQ message broker tutorial',
      'Sequence Diagrams':             'UML sequence diagram tutorial',
    };

    for (const topic of topics) {
      const query = SEARCH_QUERIES[topic.name] ?? topic.name;
      const exists = db.prepare("SELECT id FROM feed_items WHERE source='search' AND source_id=? AND topic_id=?").get(query, topic.id);
      if (exists !== undefined) continue;

      // Try to get a real image for the search tile (much more eye-catching than a gradient)
      const commonsImg = await fetchCommonsImage(topic.name);
      const thumbUrl   = commonsImg ?? null;
      const mediaUrl   = thumbUrl ?? `gradient:linear-gradient(135deg,#1a0808 0%,#2a1010 100%)`;

      db.prepare(`INSERT OR IGNORE INTO feed_items (topic_id,type,title,description,media_url,thumbnail_url,source,source_id,relevance_score) VALUES (?,?,?,?,?,?,'search',?,0.85)`)
        .run(topic.id, 'video', `Find tutorials: ${topic.name}`, `Search YouTube for "${query}" to find the best video tutorials on this topic.`, mediaUrl, thumbUrl, query);
    }

    // ── 4. AI key-facts cards (one per topic, requires Ollama) ───────────
    if (model) {
      for (const topic of topics) {
        const existsAI = db.prepare("SELECT id FROM feed_items WHERE source='ai' AND topic_id=? LIMIT 1").get(topic.id);
        if (existsAI !== undefined) continue;
        const aiCard = await generateAICard(topic.name, model);
        if (!aiCard) continue;
        const gradient = topicGradient(topic.name);
        db.prepare(`INSERT OR IGNORE INTO feed_items (topic_id,type,title,description,media_url,source,source_id,relevance_score) VALUES (?,?,?,?,?,'ai',?,1.0)`)
          .run(topic.id, 'image', aiCard.title, aiCard.description, `gradient:${gradient}`, `ai_${topic.name}`);
      }
    }

    db.prepare("INSERT OR REPLACE INTO feed_config (key, value) VALUES ('index_status', 'done')").run();
    db.prepare("INSERT OR REPLACE INTO feed_config (key, value) VALUES ('last_full_refresh', datetime('now'))").run();
  } catch (err) {
    db.prepare("INSERT OR REPLACE INTO feed_config (key, value) VALUES ('index_status', 'error')").run();
    throw err;
  }
}

/* ── Query helpers ──────────────────────────────────────────────────────── */

export function getFeedItems(db: DatabaseSync, topicId: number, limit = 20, offset = 0): FeedItem[] {
  // Ordering factors:
  //   1. relevance_score   — how well this item matches the topic (AI-scored 0–1)
  //   2. feed_weight       — user-driven like/dislike history (0.1–3.0)
  //   3. weakness_boost    — topics with poor quiz scores surface 20% more content
  //      formula: 1.0 + (1.0 - quiz_accuracy) * 0.2  → max 1.2× boost for 0% accuracy
  //   4. novelty           — unseen items first, then variety
  return db.prepare(`
    SELECT fi.*
    FROM feed_items fi
    WHERE fi.topic_id = ?
    ORDER BY (
      fi.relevance_score
      * COALESCE((SELECT ts.feed_weight FROM topic_skills ts WHERE ts.topic_id = fi.topic_id), 1.0)
      * (1.0 + (1.0 - COALESCE(
          (SELECT CAST(ts.quiz_correct AS REAL) / NULLIF(ts.quiz_total, 0)
           FROM topic_skills ts WHERE ts.topic_id = fi.topic_id),
          0.5
        )) * 0.2)
    ) DESC,
    fi.user_rating DESC,
    fi.seen_count ASC,
    RANDOM()
    LIMIT ? OFFSET ?
  `).all(topicId, limit, offset) as FeedItem[];
}

export function getFeedItemCount(db: DatabaseSync, topicId: number): number {
  return (db.prepare('SELECT COUNT(*) as c FROM feed_items WHERE topic_id = ?').get(topicId) as { c: number }).c;
}

export function getTopicsWithContent(db: DatabaseSync): number[] {
  const rows = db.prepare('SELECT DISTINCT topic_id FROM feed_items').all() as { topic_id: number }[];
  return rows.map(r => r.topic_id);
}
