'use client';

type State = 'idle' | 'listening' | 'speaking' | 'thinking';

const COLORS: Record<State, { primary: string; secondary: string; label: string }> = {
  idle:      { primary: '#6e6e73', secondary: '#a1a1a6', label: 'Tap to speak' },
  listening: { primary: '#5ac8fa', secondary: '#5b6ef5', label: 'Listening' },
  speaking:  { primary: '#a85bff', secondary: '#5b6ef5', label: 'Speaking' },
  thinking:  { primary: '#ff9f0a', secondary: '#a85bff', label: 'Thinking' },
};

export default function MicOrb({ state, onClick, disabled }: { state: State; onClick: () => void; disabled?: boolean }) {
  const { primary, secondary, label } = COLORS[state];

  return (
    <div className="mic-orb-shell">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={state === 'listening' ? 'Stop listening' : 'Start listening'}
        className={`mic-orb is-${state}`}
        style={{
          ['--orb-color' as string]: primary,
          ['--orb-color-2' as string]: secondary,
        }}
      >
        <div className="orb-ring" />
        <div className="orb-core">
          <MicIcon color={state === 'idle' ? '#a1a1a6' : '#ffffff'} />
        </div>
      </button>
      <span className="orb-label" style={{ color: primary }}>{label}</span>
    </div>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
      <rect x="9" y="3" width="6" height="12" rx="3" fill={color} />
      <path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
