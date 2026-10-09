"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

interface Props {
  embedUrl: string;
  title: string;
  onClose: () => void;
  /** If provided: shown as a search-embed fallback when the video can't be embedded */
  searchQuery?: string;
}

const DEFAULT_W = 620;
const DEFAULT_H = 420;

/** Append enablejsapi=1 so YouTube posts error events to us via postMessage. */
function withJsApi(url: string): string {
  if (!url.includes("youtube.com/embed/") || url.includes("listType")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}enablejsapi=1`;
}

/** Build a YouTube search-embed URL for a given query. */
function searchEmbed(query: string): string {
  return `https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(query)}&rel=0`;
}

export default function VideoPopup({ embedUrl, title, onClose, searchQuery }: Props) {
  const [mounted,     setMounted]     = useState(false);
  const [pos,         setPos]         = useState({ x: 0, y: 0 });
  const [videoError,  setVideoError]  = useState(false);
  const [activeUrl,   setActiveUrl]   = useState(() => withJsApi(embedUrl));

  const posInit      = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging     = useRef(false);
  const dragOffset   = useRef({ x: 0, y: 0 });
  const onCloseRef   = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Center popup in the content area on first open
  useEffect(() => {
    if (!posInit.current) {
      posInit.current = true;
      const navW = 220;
      const cw   = window.innerWidth - navW;
      setPos({
        x: navW + Math.max(0, (cw - DEFAULT_W) / 2),
        y: Math.max(20, (window.innerHeight - DEFAULT_H) / 2),
      });
    }
  }, []);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Listen for YouTube player error events (sent via postMessage)
  // Error codes: 100 = not found, 101/150 = embedding disabled
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!data || typeof data !== "object") return;
        const isError = (
          data.event === "onError" ||
          data.event === "video-not-playable" ||
          (data.event === "infoDelivery" && data.info?.errorCode)
        );
        if (isError) setVideoError(true);
      } catch { /* non-JSON iframe messages — ignore */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Drag header
  function onHeaderMouseDown(e: React.MouseEvent) {
    dragging.current   = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 200, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80,  e.clientY - dragOffset.current.y)),
      });
    }
    function onUp() { dragging.current = false; }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, []);

  function switchToSearch() {
    if (searchQuery) {
      setActiveUrl(searchEmbed(searchQuery));
      setVideoError(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: pos.x, top: pos.y,
        width: DEFAULT_W, height: DEFAULT_H,
        minWidth: 320, minHeight: 240,
        maxWidth: "90vw", maxHeight: "90vh",
        resize: "both", overflow: "hidden",
        background: "var(--s1)",
        border: "1px solid var(--bd-md)",
        borderRadius: "var(--r3)",
        boxShadow: "0 16px 64px rgba(0,0,0,0.7), 0 0 0 1px var(--bd)",
        zIndex: 2000,
        display: "flex", flexDirection: "column",
        userSelect: "none",
      }}
    >
      {/* Title bar / drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--bd)",
          display: "flex", alignItems: "center", gap: 10,
          cursor: "grab", flexShrink: 0,
          background: "var(--s2)",
          borderRadius: "var(--r3) var(--r3) 0 0",
        }}
      >
        <span style={{ fontSize: 14 }}>▶</span>
        <span style={{
          flex: 1, fontSize: 12, fontWeight: 500, color: "var(--tx)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {title}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {searchQuery && (
            <button
              onClick={switchToSearch}
              onMouseDown={e => e.stopPropagation()}
              style={{
                background: "var(--a-dim)", border: "1px solid rgba(34,211,238,0.24)",
                borderRadius: 6, padding: "3px 10px", fontSize: 11,
                color: "var(--a-light)", cursor: "pointer",
              }}
            >
              Search topic
            </button>
          )}
          <span style={{ fontSize: 10, color: "var(--tx-3)" }}>drag · resize</span>
          <button
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--tx-3)", fontSize: 18, lineHeight: 1,
              width: 24, height: 24,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 5,
            }}
          >×</button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: "relative" }}>
        <iframe
          key={activeUrl}
          src={activeUrl}
          title={title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />

        {/* Error overlay — slides up when embedding is blocked */}
        {videoError && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(8,8,15,0.92)",
            backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 14, padding: 24, textAlign: "center",
            animation: "ns-fadeIn 0.2s ease both",
          }}>
            <div style={{ fontSize: 32 }}>🚫</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--tx)" }}>
              This video can&apos;t be embedded
            </div>
            <div style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.55, maxWidth: 340 }}>
              The video owner has disabled playback outside YouTube.
              {searchQuery && " You can search for similar videos on the same topic below."}
            </div>
            {searchQuery && (
              <button
                onClick={switchToSearch}
                style={{
                  background: "#ff0000", color: "#fff", border: "none",
                  borderRadius: 8, padding: "10px 24px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 2px 12px rgba(255,0,0,0.4)",
                }}
              >
                ▶ Search YouTube: {searchQuery}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
