'use client';

import { useState } from 'react';
import type { FeedItem } from '@/lib/feed';
import AiChat from './AiChat';
import VideoPopup from './VideoPopup';
import type { ChatContext } from '@/app/api/chat/route';
import { toDisplayString } from '@/lib/normalize';

/** Build a proxied URL so the page loads inside our iframe without X-Frame-Options blocking. */
function proxyUrl(url: string): string {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

/** Convert a YouTube results search URL to an embeddable playlist search. */
function ytSearchEmbed(searchUrl: string): string {
  try {
    const q = new URL(searchUrl).searchParams.get('search_query') ?? searchUrl;
    return `https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(q)}&rel=0`;
  } catch {
    return searchUrl;
  }
}


interface Props {
  item: FeedItem;
  topicName: string;
  topicIcon: string;
  topicLevel: number;   // 0–100 skill level, used to show progress context
  swipeX: number;
  itemIndex: number;
  totalItems: number;
  onWatch: () => void;
}

// Derive a deterministic accent colour per topic for gradient cards
const TOPIC_ACCENTS: Record<string, string> = {
  'PID Controls':                 '#22c55e',
  'Kubernetes':                   '#3b82f6',
  'gRPC':                         '#a855f7',
  'RabbitMQ':                     '#f97316',
  'Sequence Diagrams':            '#38bdf8',
  'Control Systems (Software)':   '#22c55e',
  'Altitude Control Systems':     '#818cf8',
  'LVDT & LVIT':                  '#f59e0b',
  'Built-In Test (BIT)':          '#f59e0b',
  'Health & Status Monitoring':   '#22c55e',
};
function topicAccent(name: string) { return TOPIC_ACCENTS[name] ?? '#22d3ee'; }

function ProgressDots({ current, total }: { current: number; total: number }) {
  const show = Math.min(total, 9);
  const base = Math.max(0, Math.min(current, total - 1));
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: show }, (_, i) => {
        const isActive = i === (show < total ? Math.round(base / total * show) : base);
        return (
          <div key={i} style={{
            width: isActive ? 14 : 5,
            height: 5,
            borderRadius: 99,
            background: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'width 0.2s ease, background 0.2s ease',
          }} />
        );
      })}
      {total > show && (
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>
          +{total - show}
        </span>
      )}
    </div>
  );
}

export default function MediaCard({
  item, topicName, topicIcon, topicLevel, swipeX, itemIndex, totalItems,
}: Props) {
  const [showChat,    setShowChat]    = useState(false);
  const [showArticle, setShowArticle] = useState(false);
  const [showSearch,  setShowSearch]  = useState(false);
  // For YouTube video cards: search by video title so we never hit the embed restriction
  const [showVideo,   setShowVideo]   = useState(false);
  const titleText = toDisplayString(item.title);
  const descriptionText = toDisplayString(item.description);
  const mediaUrl = toDisplayString(item.media_url);
  const thumbnailUrl = toDisplayString(item.thumbnail_url);
  const topicNameText = toDisplayString(topicName);
  const topicIconText = toDisplayString(topicIcon);

  const chatContext: ChatContext = {
    type:             'feed',
    topic:            topicNameText,
    front:            titleText,
    mediaDescription: descriptionText || undefined,
  };
  const likeOpacity    = Math.max(0, Math.min(1, swipeX / 100));
  const dislikeOpacity = Math.max(0, Math.min(1, -swipeX / 100));
  const rotation       = Math.max(-8, Math.min(8, swipeX * 0.022));

  const isVideo  = item.type === 'video';
  const isSearch = item.source === 'search';
  const isAI     = item.source === 'ai';
  const isWiki   = item.source === 'wikipedia';
  const hasThumb = !!thumbnailUrl;
  const accent   = topicAccent(topicNameText);

  // ── CSS FIX: always use longhand properties, never the background shorthand ──
  // CSS gradients are valid values for backgroundImage, so we can use longhand for all cases.
  // This prevents the React "conflicting background/backgroundImage" warning across renders.
  const gradientValue = mediaUrl.startsWith('gradient:')
    ? mediaUrl.slice('gradient:'.length)
    : `linear-gradient(135deg, ${accent}22 0%, #0a0a14 70%)`;

  const mediaBg: React.CSSProperties = {
    backgroundColor: '#0a0a14',
    backgroundImage:    hasThumb ? `url(${thumbnailUrl})` : gradientValue,
    backgroundSize:     hasThumb ? 'cover'    : '100% 100%',
    backgroundPosition: hasThumb ? 'center top' : 'center',
    backgroundRepeat:   'no-repeat',
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
      transition: swipeX === 0 ? 'transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1)' : 'none',
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#0a0a14',
      boxShadow: `0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)`,
      cursor: 'grab',
      userSelect: 'none',
    }}>

      {/* ── Background layer ── */}
      <div style={{ position: 'absolute', inset: 0, ...mediaBg }} />

      {/* ── Gradient overlays ── */}
      {hasThumb && (
        // Photo cards: fade to dark at bottom for text legibility
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.96) 100%)',
          }} />
          {/* Soft vignette at edges */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
          }} />
        </>
      )}
      {!hasThumb && (
        // Gradient cards: subtle darkened bottom
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.92) 100%)',
        }} />
      )}

      {/* ── Gradient card: centred topic icon ── */}
      {!hasThumb && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -60%)',
          fontSize: 72,
          opacity: 0.18,
          pointerEvents: 'none',
          filter: 'blur(1px)',
          lineHeight: 1,
        }}>
          {topicIconText}
        </div>
      )}

      {/* ── Swipe feedback badges ── */}
      {likeOpacity > 0.05 && (
        <div style={{
          position: 'absolute', top: 44, left: 24, zIndex: 10,
          opacity: likeOpacity,
          border: '2.5px solid var(--green)',
          color: 'var(--green)',
          borderRadius: 8, padding: '5px 14px',
          fontSize: 17, fontWeight: 800, letterSpacing: '0.07em',
          transform: `rotate(-10deg) scale(${0.8 + likeOpacity * 0.2})`,
          backdropFilter: 'blur(4px)',
          background: 'rgba(34,197,94,0.1)',
        }}>
          LIKE ✓
        </div>
      )}
      {dislikeOpacity > 0.05 && (
        <div style={{
          position: 'absolute', top: 44, right: 24, zIndex: 10,
          opacity: dislikeOpacity,
          border: '2.5px solid var(--red)',
          color: 'var(--red)',
          borderRadius: 8, padding: '5px 14px',
          fontSize: 17, fontWeight: 800, letterSpacing: '0.07em',
          transform: `rotate(10deg) scale(${0.8 + dislikeOpacity * 0.2})`,
          backdropFilter: 'blur(4px)',
          background: 'rgba(239,68,68,0.1)',
        }}>
          SKIP ✗
        </div>
      )}

      {/* ── Source badge (top right) ── */}
      <SourceBadge item={item} isSearch={isSearch} isAI={isAI} isWiki={isWiki} isVideo={isVideo} />

      {/* ── Topic + skill (top left) ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          border: `1px solid ${accent}50`,
          borderRadius: 20, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, color: '#fff',
        }}>
          <span>{topicIconText}</span>
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topicNameText}
          </span>
          {topicLevel > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: accent,
              background: `${accent}20`, borderRadius: 20, padding: '1px 6px',
            }}>
              Lv {topicLevel}
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '16px 20px 20px',
        zIndex: 5,
      }}>
        {/* Title */}
        <div style={{
          fontSize: isAI ? 16 : 18, fontWeight: 700, color: '#fff',
          lineHeight: 1.3, letterSpacing: '-0.02em',
          marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textShadow: '0 1px 8px rgba(0,0,0,0.5)',
        }}>
          {titleText}
        </div>

        {/* Description */}
        {descriptionText && (
          <div style={{
            fontSize: 12.5,
            color: isAI ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: isAI ? 6 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 14,
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}>
            {descriptionText}
          </div>
        )}

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <ActionButton
            isSearch={isSearch} isAI={isAI} isWiki={isWiki} isVideo={isVideo}
            accent={accent}
            onWatch={() => setShowVideo(true)}
            onSearchOpen={() => setShowSearch(true)}
            onArticleOpen={() => setShowArticle(true)}
          />

          {/* Skill weakness nudge: if user is novice, surface a note */}
          {topicLevel < 20 && topicLevel >= 0 && (
            <div style={{
              marginLeft: 'auto',
              fontSize: 10, color: 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ color: 'var(--amber)' }}>●</span>
              Needs work
            </div>
          )}
        </div>

        {/* Progress dots + counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <ProgressDots current={itemIndex} total={totalItems} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
            {itemIndex + 1} / {totalItems}
          </span>
        </div>

        {/* Bottom row: keyboard hints + Ask AI */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            <span><KbdKey>←</KbdKey> Skip</span>
            <span><KbdKey>↑↓</KbdKey> Topics</span>
            <span>Like <KbdKey>→</KbdKey></span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowChat(true); }}
            style={{
              background: 'rgba(34,211,238,0.18)',
              border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: 20, padding: '4px 11px',
              fontSize: 11, color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ fontSize: 12 }}>🤖</span>
            Ask AI
          </button>
        </div>
      </div>

      {showChat && (
        <AiChat
          context={chatContext}
          onClose={() => setShowChat(false)}
          greeting={`I can explain anything about ${topicNameText}. What would you like to know?`}
        />
      )}

      {showArticle && (
        <VideoPopup
          embedUrl={proxyUrl(`https://en.wikipedia.org/wiki/${encodeURIComponent(titleText.replace(/ /g, '_'))}`)}
          title={titleText}
          onClose={() => setShowArticle(false)}
        />
      )}

      {/* YouTube video cards — search by video title, never embed specific IDs */}
      {showVideo && (
        <VideoPopup
          embedUrl={ytSearchEmbed(titleText)}
          title={titleText}
          searchQuery={topicNameText}
          onClose={() => setShowVideo(false)}
        />
      )}

      {/* YouTube search tiles */}
      {showSearch && (
        <VideoPopup
          embedUrl={ytSearchEmbed(mediaUrl)}
          title={titleText}
          searchQuery={topicNameText}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function SourceBadge({ item, isSearch, isAI, isWiki, isVideo }: {
  item: FeedItem; isSearch: boolean; isAI: boolean; isWiki: boolean; isVideo: boolean;
}) {
  let icon: React.ReactNode;
  let label: string;
  let color = 'rgba(255,255,255,0.75)';

  if (isVideo && !isSearch) {
    icon = <span style={{ color: '#ff3b30', fontSize: 13, fontWeight: 900 }}>▶</span>;
    label = toDisplayString(item.channel_name) || 'YouTube';
  } else if (isSearch) {
    icon = <span style={{ color: '#ff3b30', fontSize: 11 }}>▶</span>;
    label = 'YouTube';
    color = '#ff8888';
  } else if (isAI) {
    icon = <span style={{ color: '#818cf8', fontSize: 12 }}>✦</span>;
    label = 'AI';
    color = '#818cf8';
  } else if (isWiki) {
    icon = <span style={{ fontSize: 11, opacity: 0.8 }}>W</span>;
    label = 'Wikipedia';
  } else {
    return null;
  }

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 5,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      borderRadius: 20, padding: '4px 10px', fontSize: 11,
      color, border: '1px solid rgba(255,255,255,0.08)',
      fontWeight: 500,
    }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ActionButton({ isSearch, isAI, isWiki, isVideo, accent, onWatch, onSearchOpen, onArticleOpen }: {
  isSearch: boolean; isAI: boolean; isWiki: boolean;
  isVideo: boolean; accent: string;
  onWatch: () => void;
  onSearchOpen: () => void;
  onArticleOpen: () => void;
}) {
  const base: React.CSSProperties = {
    borderRadius: 9, padding: '8px 16px', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', textDecoration: 'none',
    backdropFilter: 'blur(6px)',
  };

  if (isVideo && !isSearch) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onWatch(); }}
        style={{ ...base, background: '#ff3b30', color: '#fff', boxShadow: '0 2px 12px rgba(255,59,48,0.4)' }}
      >
        ▶ Watch
      </button>
    );
  }
  if (isSearch) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onSearchOpen(); }}
        style={{ ...base, background: '#ff3b30', color: '#fff', boxShadow: '0 2px 10px rgba(255,59,48,0.35)' }}
      >
        ▶ Search YouTube
      </button>
    );
  }
  if (isWiki) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onArticleOpen(); }}
        style={{ ...base, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
      >
        📖 Read article
      </button>
    );
  }
  // AI card — no external link, just context
  if (isAI) {
    return (
      <div style={{
        ...base, background: `${accent}25`, color: accent,
        border: `1px solid ${accent}40`, cursor: 'default',
      }}>
        ✦ Key facts
      </div>
    );
  }
  return null;
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 4, padding: '1px 5px', fontSize: 9,
      fontFamily: 'inherit',
    }}>
      {children}
    </kbd>
  );
}
