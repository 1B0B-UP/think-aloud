'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AiStatus { online: boolean; modelInstalled: boolean; model: string }

const SECTIONS: { label: string | null; links: { href: string; label: string; icon: (p: { active: boolean }) => React.ReactElement; exact?: boolean }[] }[] = [
  {
    label: 'Think',
    links: [
      { href: '/',         label: 'Home',         icon: HomeIcon, exact: true },
      { href: '/session',  label: 'New session',  icon: MicIcon },
      { href: '/history',  label: 'History',      icon: ClockIcon },
    ],
  },
  {
    label: 'Learn',
    links: [
      { href: '/topics',   label: 'Topics',       icon: TopicsIcon },
      { href: '/drill',    label: 'Flashcards',   icon: CardsIcon },
      { href: '/quiz',     label: 'Quiz',         icon: QuizIcon },
      { href: '/math',     label: 'Math Refresh', icon: MathIcon },
      { href: '/exams',    label: 'FE / PE Prep', icon: ExamIcon },
      { href: '/learn',    label: 'Deep dive',    icon: BookIcon },
    ],
  },
  {
    label: 'Discover',
    links: [
      { href: '/feed',     label: 'Feed',         icon: FeedIcon },
    ],
  },
  {
    label: 'Reflect',
    links: [
      { href: '/progress', label: 'Progress',     icon: ChartIcon },
      { href: '/focus',    label: 'Focus',        icon: FocusIcon },
      { href: '/habits',   label: 'Habits',       icon: HabitsIcon },
    ],
  },
  {
    label: null,
    links: [
      { href: '/settings', label: 'Settings',     icon: GearIcon },
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  const [ai, setAi] = useState<AiStatus | null>(null);

  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then((status: AiStatus) => {
        setAi(status);
        if (status.online && status.modelInstalled) {
          fetch('/api/warmup', { method: 'POST' }).catch(() => { /* best effort */ });
        }
      })
      .catch(() => setAi({ online: false, modelInstalled: false, model: '' }));
  }, []);

  const aiOk = ai?.online && ai?.modelInstalled;

  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <div className="nav-brand-mark">T</div>
        <div>
          <div className="nav-brand-name">Te Matemata</div>
          <div className="nav-brand-sub">Think · Learn · Reflect</div>
        </div>
      </div>

      <div className="nav-sections">
        {SECTIONS.map((section, si) => (
          <div key={si} className="nav-section">
            {section.label && <div className="nav-section-label">{section.label}</div>}
            {section.links.map(l => {
              const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/');
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} className={`nav-link ${active ? 'is-active' : ''}`}>
                  <Icon active={active} />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="nav-ai-status">
        <div className="nav-ai-dot" style={{
          background: ai === null ? 'var(--tx-3)' : aiOk ? 'var(--green)' : ai.online ? 'var(--a)' : 'var(--red)',
          boxShadow: aiOk ? '0 0 8px rgba(48,209,88,0.5)' : 'none',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: aiOk ? 'var(--tx)' : 'var(--tx-2)', fontWeight: aiOk ? 500 : 400 }}>
            {ai === null ? 'Checking AI…' : aiOk ? 'Coach ready' : ai.online ? 'No model' : 'Ollama offline'}
          </div>
          {ai && !aiOk && (
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--mono)' }}>
              {ai.online ? `pull ${ai.model || 'llama3.2:3b'}` : 'start Ollama'}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ── Icons ── */
function HomeIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 7v8h4v-5h6v5h4V7L8 1z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /></svg>; }
function MicIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="6" y="2" width="4" height="8" rx="2" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><path d="M3 8a5 5 0 0 0 10 0" stroke={c} strokeWidth="1.4" strokeLinecap="round" /><line x1="8" y1="13" x2="8" y2="15" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function ClockIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><path d="M8 4.5V8l2.5 1.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function GearIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15M2.93 2.93l1.55 1.55M11.52 11.52l1.55 1.55M2.93 13.07l1.55-1.55M11.52 4.48l1.55-1.55" stroke={c} strokeWidth="1.3" strokeLinecap="round" /></svg>; }
function TopicsIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.4" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.4" stroke={c} strokeWidth="1.4" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.4" stroke={c} strokeWidth="1.4" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.4" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /></svg>; }
function CardsIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="11" height="8" rx="1.5" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><path d="M4.5 5.5h6M4.5 8h4" stroke={c} strokeWidth="1.3" strokeLinecap="round" /></svg>; }
function QuizIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><path d="M6 6.5a2 2 0 0 1 4 0c0 1.2-1.5 1.3-1.5 2.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none" /><circle cx="8.5" cy="11.5" r="0.7" fill={c} /></svg>; }
function MathIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3.5h11M2 11.5h11" stroke={c} strokeWidth="1.4" strokeLinecap="round" /><path d="M6 8.5c1.1-2.5 1.9-3.8 2.7-3.8.7 0 1 .7 1.3 1.8.3 1.2.6 2 1.2 2 .4 0 .8-.3 1.1-.9" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function ExamIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 1.5h7l2.5 2.5v10.5h-9.5v-13z" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} strokeLinejoin="round" /><path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" stroke={c} strokeWidth="1.3" strokeLinecap="round" /></svg>; }
function BookIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3v10a1 1 0 0 0 1 1h10V2H3a1 1 0 0 0-1 1z" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} strokeLinejoin="round" /><path d="M5 5.5h6M5 8h5" stroke={c} strokeWidth="1.3" strokeLinecap="round" /></svg>; }
function FeedIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="7" rx="1.5" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><rect x="1.5" y="10" width="7" height="4.5" rx="1.2" stroke={c} strokeWidth="1.4" /><rect x="10" y="10" width="4.5" height="4.5" rx="1.2" stroke={c} strokeWidth="1.4" /></svg>; }
function ChartIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 13h13M3 11V8M6 11V5M9 11V7M12 11V3" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function FocusIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke={c} strokeWidth="1.4" fill={active ? 'rgba(255,255,255,0.10)' : 'none'} /><circle cx="8" cy="8" r="2.4" fill={c} /></svg>; }
function HabitsIcon({ active }: { active: boolean }) { const c = active ? 'var(--tx)' : 'var(--tx-3)'; return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l2.2 2.2L13 3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M2 3h5M2 6h3M2 12h8" stroke={c} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" /></svg>; }
