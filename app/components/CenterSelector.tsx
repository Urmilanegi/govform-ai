'use client';

import { useState, useRef, useEffect } from 'react';
import { UPSC_CENTERS, MAX_CENTERS } from '@/lib/upsc-centers';

interface Center { code: string; city: string; state: string; }

interface Props {
  selected: Center[];
  onChange: (centers: Center[]) => void;
}

export default function CenterSelector({ selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  const filtered = query.length > 0
    ? UPSC_CENTERS.filter(c =>
        !selected.find(s => s.code === c.code) &&
        (c.city.toLowerCase().includes(query.toLowerCase()) ||
         c.state.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  function addCenter(c: Center) {
    if (selected.length >= MAX_CENTERS) return;
    onChange([...selected, c]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeCenter(code: string) {
    onChange(selected.filter(c => c.code !== code));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const arr = [...selected];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    onChange(arr);
  }

  function moveDown(index: number) {
    if (index === selected.length - 1) return;
    const arr = [...selected];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    onChange(arr);
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.center-selector')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="center-selector flex flex-col gap-3">

      {/* Selected centers — ordered list */}
      {selected.length > 0 && (
        <div className="flex flex-col gap-2">
          {selected.map((c, i) => (
            <div key={c.code}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              {/* Preference badge */}
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: i === 0 ? '#7c3aed' : 'rgba(124,58,237,0.3)', color: 'white' }}>
                {i + 1}
              </span>

              {/* City info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{c.city}</div>
                <div className="text-xs" style={{ color: '#9ca3af' }}>{c.state}</div>
              </div>

              {/* Move up/down */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="w-5 h-5 rounded flex items-center justify-center text-xs disabled:opacity-20"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#c4b5fd' }}>
                  ▲
                </button>
                <button onClick={() => moveDown(i)} disabled={i === selected.length - 1}
                  className="w-5 h-5 rounded flex items-center justify-center text-xs disabled:opacity-20"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#c4b5fd' }}>
                  ▼
                </button>
              </div>

              {/* Remove */}
              <button onClick={() => removeCenter(c.code)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs hover:bg-red-500/20 transition-colors"
                style={{ color: '#f87171' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      {selected.length < MAX_CENTERS && (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? 'City type karo — e.g. Jaipur, Delhi...' : `Preference ${selected.length + 1} add karo...`}
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
            }}
          />
          {selected.length < MAX_CENTERS && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: '#6b7280' }}>
              {MAX_CENTERS - selected.length} baaki
            </span>
          )}

          {/* Dropdown suggestions */}
          {open && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{ background: '#1a0a2e', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              {filtered.map(c => (
                <button key={c.code} onClick={() => addCenter(c)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-500/10 transition-colors border-b border-white/5 last:border-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7c3aed' }} />
                  <div>
                    <div className="text-sm text-white font-medium">{c.city}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{c.state}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs" style={{ color: '#6b7280' }}>
        {selected.length === 0
          ? `Max ${MAX_CENTERS} centers — pehla wala 1st preference hoga`
          : selected.length === MAX_CENTERS
          ? '✅ Max centers select ho gaye — order change karne ke liye ▲▼ use karo'
          : `${selected.length}/${MAX_CENTERS} selected — aur add karo`}
      </p>
    </div>
  );
}
