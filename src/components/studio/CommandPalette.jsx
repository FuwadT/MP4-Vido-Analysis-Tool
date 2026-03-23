import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CornerDownLeft, Search } from 'lucide-react';

function paletteShortcutLabel() {
  if (typeof navigator === 'undefined') {
    return 'Ctrl+K';
  }

  return /mac/i.test(navigator.platform || '') ? 'Cmd+K' : 'Ctrl+K';
}

export function CommandPalette({ state, actions }) {
  const inputRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = useMemo(() => state.commandPaletteResults || [], [state.commandPaletteResults]);
  const shortcut = paletteShortcutLabel();
  const activeIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));

  useEffect(() => {
    const handleKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        actions.openCommandPalette(state.quickOpenQuery || '');
        return;
      }

      if (!state.commandPaletteOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        actions.closeCommandPalette();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((previous) => Math.min(previous + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((previous) => Math.max(previous - 1, 0));
      } else if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault();
        actions.executeCommand(results[activeIndex]);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [actions, activeIndex, results, state.commandPaletteOpen, state.quickOpenQuery]);

  useEffect(() => {
    if (!state.commandPaletteOpen) {
      return;
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [state.commandPaletteOpen]);

  if (!state.commandPaletteOpen) {
    return (
      <button
        type="button"
        onClick={() => actions.openCommandPalette(state.quickOpenQuery || '')}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-slate-100"
      >
        <Command size={14} />
        Quick open
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-500">{shortcut}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 pt-[12vh] backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] border border-slate-800 bg-[#050912] shadow-[0_30px_90px_rgba(2,6,23,0.55)]">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <Search size={18} className="text-slate-500" />
          <input
            ref={inputRef}
            value={state.commandPaletteQuery}
            onChange={(event) => actions.setCommandPaletteQuery(event.target.value)}
            placeholder="Open datasets, scenarios, runs, findings, layouts, or actions"
            className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={actions.closeCommandPalette}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-slate-100"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto p-3">
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => actions.executeCommand(result)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${index === activeIndex ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/75 hover:border-slate-700'}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{result.label}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{result.subtitle}</div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      {result.type}
                    </span>
                    {index === activeIndex && <CornerDownLeft size={14} className="text-emerald-300" />}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
              No matching datasets, scenarios, runs, findings, or layouts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
