import React from 'react';
import clsx from 'clsx';
import { Boxes, Database, FolderKanban, Gauge, Home, Layers3, ShieldCheck, SlidersHorizontal } from 'lucide-react';

const NAV_ICONS = {
  home: Home,
  'data-explorer': Database,
  'scenario-studio': FolderKanban,
  'simulation-runs': Gauge,
  validation: ShieldCheck,
  'models-builds': Boxes,
  settings: SlidersHorizontal
};

export function StudioNav({ items, activeNav, onSelect, activeBuild, activeModel }) {
  return (
    <aside className="hidden w-[260px] shrink-0 xl:flex xl:flex-col">
      <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-[32px] border border-slate-800 bg-slate-950/88 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.4)] backdrop-blur">
        <div className="rounded-[28px] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_58%)] p-5">
          <div className="text-[11px] uppercase tracking-[0.34em] text-emerald-300">ADAS Simulation Studio</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-100">Operator Workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Replay logs, author scenarios, run counterfactuals, and track validation evidence from one shell.
          </p>
        </div>

        <nav className="mt-6 flex-1 space-y-2">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.id] || Layers3;
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={clsx(
                  'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-transparent bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                )}
              >
                <span className={clsx('mt-0.5 rounded-xl p-2', isActive ? 'bg-emerald-500/20' : 'bg-slate-800/80')}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{item.subtitle}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Active stack</div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2">
            <div className="text-xs text-slate-500">Build alias</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{activeBuild.alias}</div>
            <div className="text-xs text-slate-500">{activeBuild.version}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-2">
            <div className="text-xs text-slate-500">Model alias</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{activeModel.alias}</div>
            <div className="text-xs text-slate-500">{activeModel.version}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
