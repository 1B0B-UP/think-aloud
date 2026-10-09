'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MediaCard from '@/components/MediaCard';
import VideoPopup from '@/components/VideoPopup';
import type { FeedItem, IndexStatus } from '@/lib/feed';
import { toDisplayString } from '@/lib/normalize';

interface Topic { id: number; name: string; icon: string; level?: number; }

const BATCH_SIZE   = 20;
const PRELOAD_AHEAD = 5;

export default function FeedPage() {
  const [topics,       setTopics]       = useState<Topic[]>([]);
  const [topicIdx,     setTopicIdx]     = useState(0);
  const [items,        setItems]        = useState<FeedItem[]>([]);
  const [itemIdx,      setItemIdx]      = useState(0);
  const [totalItems,   setTotalItems]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [indexStatus,  setIndexStatus]  = useState<IndexStatus | null>(null);
  const [popupItem,    setPopupItem]    = useState<FeedItem | null>(null);
  const [swipeX,       setSwipeX]       = useState(0);
  const [transitioning,setTransitioning]= useState(false);

  const dragging     = useRef(false);
  const dragStartX   = useRef(0);
  const fetchingMore = useRef(false);

  const [topicsWithContent, setTopicsWithContent] = useState<Set<number>>(new Set());

  // ── Fetch topics ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [tr, cr] = await Promise.all([
          fetch('/api/topics'),
          fetch('/api/feed/topics-with-content'),
        ]);
        const topicData: { topics: (Topic & { level?: number })[] } = tr.ok ? await tr.json() : { topics: [] };
        const contentData: { ids: number[] }   = cr.ok ? await cr.json() : { ids: [] };
        const topicList  = (topicData.topics ?? []) as Topic[];
        const contentSet = new Set<number>(contentData.ids ?? []);
        setTopics(topicList);
        setTopicsWithContent(contentSet);
        if (contentSet.size > 0 && topicList.length > 0) {
          const firstIdx = topicList.findIndex(t => contentSet.has(t.id));
          if (firstIdx >= 0) setTopicIdx(firstIdx);
        }
      } catch { /* network error — silently ignore */ }
    }
    load();
  }, []);

  // ── Check/trigger index ───────────────────────────────────────────────
  useEffect(() => {
    async function checkIndex() {
      try {
        const r = await fetch('/api/feed/index');
        if (!r.ok) { setLoading(false); return; }
        const status = await r.json() as IndexStatus;
        setIndexStatus(status);
        if (status.status === 'idle' && (status.item_count === 0 || status.is_stale)) {
          await fetch('/api/feed/index', { method: 'POST' });
          setIndexStatus(s => s ? { ...s, status: 'building' } : s);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    checkIndex();
  }, []);

  // ── Poll index status while building ─────────────────────────────────
  useEffect(() => {
    if (indexStatus?.status !== 'building') return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch('/api/feed/index');
        if (!r.ok) return;
        const s = await r.json() as IndexStatus;
        setIndexStatus(s);
        if (s.status !== 'building') clearInterval(timer);
        if (s.status === 'done') {
          const r2 = await fetch('/api/feed/topics-with-content');
          if (r2.ok) {
            const d = await r2.json() as { ids: number[] };
            setTopicsWithContent(new Set(d.ids ?? []));
          }
        }
      } catch { /* ignore network errors during polling */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [indexStatus?.status]);

  // Stable ref so loadItemsForTopic can read current items.length without capturing stale closure
  const itemsLengthRef = useRef(0);
  useEffect(() => { itemsLengthRef.current = items.length; }, [items]);

  // ── Load items for current topic ──────────────────────────────────────
  const loadItemsForTopic = useCallback(async (topicId: number, reset = false) => {
    if (!topicId || fetchingMore.current) return;
    fetchingMore.current = true;

    const offset = reset ? 0 : itemsLengthRef.current;
    try {
      const res  = await fetch(`/api/feed/items?topicId=${topicId}&limit=${BATCH_SIZE}&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json() as { items: FeedItem[]; total: number };
      setTotalItems(data.total);
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      if (reset) setItemIdx(0);
    } catch { /* ignore network errors */ }
    finally { fetchingMore.current = false; }
  }, []); // stable — reads itemsLengthRef directly

  useEffect(() => {
    if (topics.length > 0) {
      loadItemsForTopic(topics[topicIdx]?.id ?? 0, true);
    }
  }, [loadItemsForTopic, topics, topicIdx]);

  // ── Preload thumbnails for upcoming items ─────────────────────────────
  useEffect(() => {
    const upcoming = items.slice(itemIdx + 1, itemIdx + 1 + PRELOAD_AHEAD);
    upcoming.forEach(item => {
      if (item.thumbnail_url) {
        const img = new window.Image();
        img.src = item.thumbnail_url;
      }
    });
    // Fetch more items when approaching the end
    if (itemIdx > 0 && itemIdx >= items.length - PRELOAD_AHEAD && items.length < totalItems) {
      loadItemsForTopic(topics[topicIdx]?.id ?? 0);
    }
  }, [itemIdx, items, loadItemsForTopic, topicIdx, topics, totalItems]);

  // ── Rating + advance ──────────────────────────────────────────────────
  const rateAndAdvance = useCallback(async (rating: 1 | -1) => {
    if (transitioning || !items[itemIdx]) return;
    setTransitioning(true);

    const item = items[itemIdx];
    // Fire rating in background
    fetch('/api/feed/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, rating }),
    }).catch(() => {});

    // Animate swipe out
    setSwipeX(rating === 1 ? 500 : -500);
    await new Promise(r => setTimeout(r, 220));
    setSwipeX(0);
    setItemIdx(i => i + 1);
    setTransitioning(false);
  }, [transitioning, items, itemIdx]);

  const navigateTopic = useCallback((dir: 1 | -1) => {
    if (topics.length === 0) return;
    setTopicIdx(i => {
      const next = i + dir;
      return Math.max(0, Math.min(topics.length - 1, next));
    });
  }, [topics.length]);

  // ── Keyboard controls ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (popupItem) return; // let popup handle Escape
      if (e.key === 'ArrowRight') { e.preventDefault(); rateAndAdvance(1);  }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); rateAndAdvance(-1); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); navigateTopic(1);   }
      if (e.key === 'ArrowDown')  { e.preventDefault(); navigateTopic(-1);  }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rateAndAdvance, navigateTopic, popupItem]);

  // Stable ref so the drag handler never re-registers on every item change
  const rateAndAdvanceRef = useRef(rateAndAdvance);
  useEffect(() => { rateAndAdvanceRef.current = rateAndAdvance; }, [rateAndAdvance]);

  // ── Mouse drag for swipe — registered once, reads latest callback via ref ──
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      setSwipeX(e.clientX - dragStartX.current);
    }
    function onUp(e: MouseEvent) {
      if (!dragging.current) return;
      dragging.current = false;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 80) {
        rateAndAdvanceRef.current(dx > 0 ? 1 : -1);
      } else {
        setSwipeX(0);
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []); // stable — reads rateAndAdvanceRef which is always current

  function onCardMouseDown(e: React.MouseEvent) {
    dragging.current  = true;
    dragStartX.current = e.clientX;
  }

  // ── Derived state ─────────────────────────────────────────────────────
  const currentTopic = topics[topicIdx];
  const currentItem  = items[itemIdx];
  const allSeen      = items.length > 0 && itemIdx >= items.length;
  const noContent    = !loading && indexStatus?.item_count === 0;
  const contentTopics = topics.filter(t => topicsWithContent.has(t.id));
  const progressPct = totalItems > 0 ? Math.min(100, Math.round((itemIdx / totalItems) * 100)) : 0;

  // ── Full-screen layout escape ─────────────────────────────────────────
  return (
    <>
      {/* Break out of main-content padding with fixed overlay */}
      <div style={{
        position: 'fixed',
        top: 0, left: 'var(--nav-w)', right: 0, bottom: 0,
        background: 'var(--bg)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ── Top HUD: cleaner single row ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          padding: '14px 16px 10px',
          background: 'linear-gradient(180deg, rgba(5,5,12,0.85) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* ↓ prev topic */}
          <button
            onClick={() => navigateTopic(-1)}
            disabled={topicIdx === 0}
            style={{
              background: 'none', border: 'none', cursor: topicIdx === 0 ? 'default' : 'pointer',
              color: topicIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
              fontSize: 16, padding: '4px 6px', borderRadius: 6, flexShrink: 0,
            }}
          >↑</button>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 170 }}>
            <span style={{ color: '#fff', fontWeight: 750, fontSize: 13 }}>Engineering Feed</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              {indexStatus?.item_count ?? 0} indexed
            </span>
          </div>

          {/* Current topic name */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            {currentTopic && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>{toDisplayString(currentTopic.icon)}</span>
                <span style={{ fontSize: 13, fontWeight: 650, color: '#fff', letterSpacing: '-0.01em' }}>
                  {toDisplayString(currentTopic.name)}
                </span>
                {(currentTopic.level ?? 0) > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--a-light)',
                    background: 'var(--a-dim)', borderRadius: 20, padding: '2px 7px',
                  }}>
                    Lv {currentTopic.level}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ↑ next topic */}
          <button
            onClick={() => navigateTopic(1)}
            disabled={topicIdx >= topics.length - 1}
            style={{
              background: 'none', border: 'none', cursor: topicIdx >= topics.length - 1 ? 'default' : 'pointer',
              color: topicIdx >= topics.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
              fontSize: 16, padding: '4px 6px', borderRadius: 6, flexShrink: 0,
            }}
          >↓</button>

          {/* Building indicator */}
          {indexStatus?.status === 'building' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--sky)', flexShrink: 0 }}>
              <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: 'var(--sky)', borderTopColor: 'transparent' }} />
              <span>Building…</span>
            </div>
          )}
        </div>

        {/* ── Topic breadcrumb strip (scrollable, below top bar) ── */}
        <div style={{
          position: 'absolute', top: 50, left: 0, right: 0, zIndex: 19,
          padding: '0 16px',
          display: 'flex', gap: 6, overflowX: 'auto',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {topics.map((t, i) => {
            const isActive = i === topicIdx;
            const hasCt    = topicsWithContent.has(t.id);
            if (!hasCt && !isActive) return null;
            return (
              <button
                key={t.id}
                onClick={() => setTopicIdx(i)}
                style={{
                  background: isActive ? 'linear-gradient(135deg, rgba(34,211,238,0.95), rgba(139,92,246,0.85))' : 'rgba(255,255,255,0.07)',
                  border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 10.5, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', flexShrink: 0,
                  backdropFilter: 'blur(4px)',
                  boxShadow: isActive ? '0 0 14px rgba(34,211,238,0.32)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {toDisplayString(t.icon)} {toDisplayString(t.name)}
              </button>
            );
          })}
        </div>

        {/* ── Card area ── */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '170px minmax(320px, 480px) 190px',
          gap: 18,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '88px 28px 24px',
          minHeight: 0,
        }}>
          <TopicRail
            topics={contentTopics.length > 0 ? contentTopics : topics}
            currentId={currentTopic?.id ?? null}
            onSelect={id => {
              const next = topics.findIndex(t => t.id === id);
              if (next >= 0) setTopicIdx(next);
            }}
          />

          <div style={{ height: '100%', maxHeight: 680, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(loading || (!currentItem && indexStatus?.status === 'building')) ? (
              <BuildingState itemCount={indexStatus?.item_count ?? 0} />
            ) : noContent ? (
              <EmptyState onRetry={() => fetch('/api/feed/index', { method: 'POST' })} />
            ) : allSeen ? (
              <AllSeenState
                topicName={currentTopic?.name ?? ''}
                onNext={() => navigateTopic(1)}
                onRefresh={() => loadItemsForTopic(currentTopic?.id ?? 0, true)}
              />
            ) : !currentItem ? (
              <div style={{ color: 'var(--tx-2)', fontSize: 13 }}>No content for this topic yet.</div>
            ) : (
              <div
                style={{ width: '100%', height: '100%', cursor: 'grab' }}
                onMouseDown={onCardMouseDown}
              >
                <MediaCard
                  key={currentItem.id}
                  item={currentItem}
                  topicName={currentTopic?.name ?? ''}
                  topicIcon={currentTopic?.icon ?? ''}
                  topicLevel={currentTopic?.level ?? 0}
                  swipeX={swipeX}
                  itemIndex={itemIdx}
                  totalItems={totalItems}
                  onWatch={() => setPopupItem(currentItem)}
                />
              </div>
            )}
          </div>

          <FeedSidePanel
            currentTopic={currentTopic}
            itemIdx={itemIdx}
            totalItems={totalItems}
            progressPct={progressPct}
            disabled={!currentItem || transitioning}
            onSkip={() => rateAndAdvance(-1)}
            onLike={() => rateAndAdvance(1)}
            onRefresh={() => loadItemsForTopic(currentTopic?.id ?? 0, true)}
          />
        </div>

        {/* Nav arrows now in the top HUD — removed from here */}
      </div>

      {/* Video popup (portal, rendered outside the fixed overlay) */}
      {popupItem && (
        <VideoPopup
          embedUrl={`https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(popupItem.title)}&rel=0`}
          title={popupItem.title}
          searchQuery={currentTopic?.name}
          onClose={() => setPopupItem(null)}
        />
      )}
    </>
  );
}

/* ── Helper screens ────────────────────────────────────────────────────── */

function TopicRail({
  topics,
  currentId,
  onSelect,
}: {
  topics: Topic[];
  currentId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <aside style={{
      alignSelf: 'stretch',
      minHeight: 0,
      background: 'rgba(10,10,20,0.72)',
      border: '1px solid var(--bd)',
      borderRadius: 12,
      padding: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
        Topics
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 'calc(100% - 24px)', overflowY: 'auto' }}>
        {topics.map(topic => {
          const active = topic.id === currentId;
          return (
            <button
              key={topic.id}
              onClick={() => onSelect(topic.id)}
              style={{
                justifyContent: 'flex-start',
                width: '100%',
                padding: '7px 8px',
                borderRadius: 8,
                background: active ? 'var(--a-dim)' : 'transparent',
                border: `1px solid ${active ? 'rgba(34,211,238,0.25)' : 'transparent'}`,
                color: active ? 'var(--tx)' : 'var(--tx-2)',
                fontSize: 11.5,
                textAlign: 'left',
              }}
            >
              <span>{toDisplayString(topic.icon)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toDisplayString(topic.name)}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function FeedSidePanel({
  currentTopic,
  itemIdx,
  totalItems,
  progressPct,
  disabled,
  onSkip,
  onLike,
  onRefresh,
}: {
  currentTopic?: Topic;
  itemIdx: number;
  totalItems: number;
  progressPct: number;
  disabled: boolean;
  onSkip: () => void;
  onLike: () => void;
  onRefresh: () => void;
}) {
  return (
    <aside style={{
      alignSelf: 'stretch',
      background: 'rgba(10,10,20,0.72)',
      border: '1px solid var(--bd)',
      borderRadius: 12,
      padding: 14,
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
          Session
        </div>
        <div style={{ color: 'var(--tx)', fontSize: 13, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>
          {currentTopic ? toDisplayString(currentTopic.name) : 'Feed'}
        </div>
        <div style={{ color: 'var(--tx-3)', fontSize: 11, marginBottom: 12 }}>
          {totalItems > 0 ? `${Math.min(itemIdx + 1, totalItems)} of ${totalItems}` : 'No items loaded'}
        </div>
        <div style={{ height: 7, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--sky)', borderRadius: 99 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FeedMetric label="Done" value={`${progressPct}%`} />
          <FeedMetric label="Left" value={String(Math.max(0, totalItems - itemIdx))} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onLike} disabled={disabled} style={{ ...feedButton, background: 'var(--green-d)', color: 'var(--green)', borderColor: 'rgba(34,197,94,0.25)' }}>
          Save / Like →
        </button>
        <button onClick={onSkip} disabled={disabled} style={{ ...feedButton, background: 'var(--s2)', color: 'var(--tx-2)', borderColor: 'var(--bd)' }}>
          ← Skip
        </button>
        <button onClick={onRefresh} style={{ ...feedButton, background: 'transparent', color: 'var(--sky)', borderColor: 'rgba(56,189,248,0.25)' }}>
          Reload Topic
        </button>
      </div>
    </aside>
  );
}

function FeedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 9px' }}>
      <div style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 750, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const feedButton: React.CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  border: '1px solid',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
};

function BuildingState({ itemCount }: { itemCount: number }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--tx-2)' }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 20px' }} />
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--tx)' }}>
        Building your engineering feed…
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>
        Fetching YouTube videos and Wikipedia references from engineering channels.
        This takes 1–3 minutes the first time.
        {itemCount > 0 && <><br /><span style={{ color: 'var(--green)', fontWeight: 600 }}>{itemCount} items indexed so far.</span></>}
      </div>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--tx-2)' }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>📡</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--tx)' }}>No content yet</div>
      <div style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
        The feed index is empty. Make sure you&apos;re connected to the internet<br />
        so RSS feeds and Wikipedia can be fetched.
      </div>
      <button onClick={onRetry} className="btn-primary" style={{ padding: '9px 20px' }}>
        Retry index build
      </button>
    </div>
  );
}

function AllSeenState({ topicName, onNext, onRefresh }: { topicName: string; onNext: () => void; onRefresh: () => void }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--tx-2)' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--tx)' }}>
        You&apos;ve seen all content for {topicName}
      </div>
      <div style={{ fontSize: 13, marginBottom: 20 }}>Move to another topic or reload.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={onNext} className="btn-primary" style={{ padding: '9px 18px' }}>Next topic →</button>
        <button onClick={onRefresh} className="btn-ghost" style={{ padding: '9px 18px' }}>Reload</button>
      </div>
    </div>
  );
}
