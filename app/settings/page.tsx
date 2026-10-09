'use client';

import { useEffect, useState } from 'react';
import { listVoices, getSavedVoiceName, getSavedRate, saveVoicePref, speak, primeTTS } from '@/lib/voice';

interface AiStatus {
  online: boolean;
  modelInstalled: boolean;
  model: string;
  models: string[];
}

const PREVIEW = "Here is your statement. Let's think about it together.";

export default function SettingsPage() {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [model, setModel] = useState('llama3.2:3b');
  const [defaultDifficulty, setDefaultDifficulty] = useState('medium');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>('');
  const [rate, setRate] = useState(1.0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/ai/status').then(r => r.json()).then(setAi);
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings?.ollama_model) setModel(d.settings.ollama_model);
      if (d.settings?.default_difficulty) setDefaultDifficulty(d.settings.default_difficulty);
    });

    // Voice list is async on Chrome — populate now and again on voiceschanged
    primeTTS();
    const refresh = () => setVoices(listVoices());
    refresh();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
    setVoiceName(getSavedVoiceName());
    setRate(getSavedRate());

    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handlePreview = () => {
    // Persist current choices first so speak() picks them up.
    saveVoicePref(voiceName, rate);
    speak(PREVIEW, { rate });
  };

  const save = async () => {
    saveVoicePref(voiceName, rate);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ollama_model: model, default_difficulty: defaultDifficulty }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // Sort voices: English first, premium/enhanced/siri labels prioritized.
  const sortedVoices = [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      if (/siri/i.test(v.name)) s -= 5;
      if (/\(premium\)/i.test(v.name)) s -= 4;
      if (/\(enhanced\)/i.test(v.name)) s -= 3;
      if (/google/i.test(v.name)) s -= 2;
      if (v.lang === 'en-US') s -= 2;
      else if (v.lang.startsWith('en')) s -= 1;
      return s;
    };
    return score(a) - score(b);
  });

  const groupedVoices = sortedVoices.reduce<Record<string, SpeechSynthesisVoice[]>>((acc, v) => {
    let group = 'Other';
    if (/siri/i.test(v.name)) group = 'Siri';
    else if (/\(premium\)/i.test(v.name)) group = 'Premium';
    else if (/\(enhanced\)/i.test(v.name)) group = 'Enhanced';
    else if (/google/i.test(v.name)) group = 'Google';
    else if (v.lang.startsWith('en')) group = 'Standard English';
    (acc[group] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="page-title">Settings</div>
      <div className="page-sub" style={{ marginBottom: 32 }}>
        Tune the model, default difficulty, and how the coach sounds.
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Coach voice</div>
        {voices.length === 0 ? (
          <div style={{ color: 'var(--tx-3)', fontSize: 13 }}>Loading voices…</div>
        ) : (
          <>
            <select value={voiceName} onChange={e => setVoiceName(e.target.value)}>
              <option value="">Auto — pick the best available</option>
              {Object.entries(groupedVoices).map(([group, vs]) => (
                <optgroup key={group} label={group}>
                  {vs.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} {v.lang ? `· ${v.lang}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 8, lineHeight: 1.5 }}>
              On macOS you can install more natural voices via <em>System Settings → Accessibility → Spoken Content → System Voice → Manage Voices</em>. Look for &ldquo;Premium&rdquo; or &ldquo;Enhanced&rdquo; tier.
            </div>

            <div style={{ marginTop: 22, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: 'var(--tx-2)', fontWeight: 500 }}>Speech rate</label>
              <span style={{ fontSize: 12, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>{rate.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.4}
              step={0.02}
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--a)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--tx-3)', marginTop: 4 }}>
              <span>Slower</span><span>Natural</span><span>Faster</span>
            </div>

            <div style={{ marginTop: 18 }}>
              <button onClick={handlePreview} className="cta-pill ghost">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l7 4-7 4V3z" fill="currentColor" /></svg>
                Preview voice
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="section-title">Ollama model</div>
        {ai === null ? (
          <div style={{ color: 'var(--tx-3)' }}>Checking…</div>
        ) : !ai.online ? (
          <div style={{ color: 'var(--red)', fontSize: 13 }}>
            Ollama isn&apos;t running. Start it with <code>ollama serve</code>.
          </div>
        ) : ai.models.length === 0 ? (
          <div style={{ color: 'var(--a)', fontSize: 13 }}>
            No models installed yet. Try <code>ollama pull llama3.2:3b</code>.
          </div>
        ) : (
          <select value={model} onChange={e => setModel(e.target.value)}>
            {ai.models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 8, lineHeight: 1.5 }}>
          A small model (3B) is fast. Bigger models give richer coaching but cost latency.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="section-title">Default difficulty</div>
        <select value={defaultDifficulty} onChange={e => setDefaultDifficulty(e.target.value)}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
        {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved</span>}
        <button onClick={save} className="cta-pill primary">Save</button>
      </div>
    </div>
  );
}
