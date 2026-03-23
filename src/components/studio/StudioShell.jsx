import React, { Suspense, lazy } from 'react';
import clsx from 'clsx';
import { Menu } from 'lucide-react';
import { BottomTimeline } from './BottomTimeline';
import { RightInspector } from './RightInspector';
import { StudioNav } from './StudioNav';
import { StudioTopBar } from './StudioTopBar';

const HomeWorkspace = lazy(() => import('./HomeWorkspace').then((module) => ({
  default: module.HomeWorkspace
})));
const DataExplorerWorkspace = lazy(() => import('./DataExplorerWorkspace').then((module) => ({
  default: module.DataExplorerWorkspace
})));
const ScenarioStudioWorkspace = lazy(() => import('./ScenarioStudioWorkspace').then((module) => ({
  default: module.ScenarioStudioWorkspace
})));
const SimulationRunsWorkspace = lazy(() => import('./SimulationRunsWorkspace').then((module) => ({
  default: module.SimulationRunsWorkspace
})));
const ValidationWorkspace = lazy(() => import('./ValidationWorkspace').then((module) => ({
  default: module.ValidationWorkspace
})));
const ModelsBuildsWorkspace = lazy(() => import('./ModelsBuildsWorkspace').then((module) => ({
  default: module.ModelsBuildsWorkspace
})));
const SettingsWorkspace = lazy(() => import('./SettingsWorkspace').then((module) => ({
  default: module.SettingsWorkspace
})));

function MobileNav({ items, activeNav, onSelect }) {
  return (
    <div className="xl:hidden">
      <details className="rounded-[24px] border border-slate-800 bg-slate-950/86 p-4 backdrop-blur">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
          <span className="inline-flex items-center gap-2">
            <Menu size={16} />
            Workspace navigation
          </span>
          <span className="text-slate-500">{activeNav}</span>
        </summary>
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={clsx(
                'rounded-2xl border px-4 py-3 text-left text-sm',
                activeNav === item.id
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300'
              )}
            >
              <div className="font-semibold">{item.label}</div>
              <div className="mt-1 text-xs text-slate-500">{item.subtitle}</div>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function WorkspaceLoadingState({ nav }) {
  return (
    <div className="flex min-h-[720px] items-center justify-center rounded-[28px] border border-slate-800 bg-slate-950/72 shadow-[0_20px_60px_rgba(2,6,23,0.26)]">
      <div className="space-y-3 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Loading studio workspace</div>
        <div className="text-xl font-semibold text-slate-100">{nav}</div>
        <div className="text-sm text-slate-400">
          Workspaces are split on demand so the shell stays responsive before replay tools are opened.
        </div>
      </div>
    </div>
  );
}

function renderWorkspace(state, derived, registries, actions) {
  switch (state.nav) {
    case 'data-explorer':
      return <DataExplorerWorkspace state={state} derived={derived} registries={registries} actions={actions} />;
    case 'scenario-studio':
      return <ScenarioStudioWorkspace state={state} derived={derived} registries={registries} actions={actions} />;
    case 'simulation-runs':
      return <SimulationRunsWorkspace state={state} derived={derived} actions={actions} />;
    case 'validation':
      return <ValidationWorkspace state={state} derived={derived} registries={registries} actions={actions} />;
    case 'models-builds':
      return <ModelsBuildsWorkspace state={state} derived={derived} registries={registries} />;
    case 'settings':
      return <SettingsWorkspace derived={derived} registries={registries} />;
    default:
      return <HomeWorkspace state={state} derived={derived} registries={registries} actions={actions} />;
  }
}

export function StudioShell({ state, derived, registries, actions }) {
  const useImmersiveExplorer = state.nav === 'data-explorer';
  const shellPaddingClass = useImmersiveExplorer ? 'min-h-screen px-3 py-3 text-slate-100' : 'min-h-screen px-4 py-4 text-slate-100';

  return (
    <div className={shellPaddingClass}>
      <div className="mx-auto flex w-full max-w-[1920px] gap-4">
        <StudioNav
          items={registries.navItems}
          activeNav={state.nav}
          onSelect={actions.setNav}
          activeBuild={derived.activeBuild}
          activeModel={derived.activeModel}
        />

        <div className="flex min-h-[calc(100vh-2rem)] min-w-0 flex-1 flex-col gap-4">
          <MobileNav items={registries.navItems} activeNav={state.nav} onSelect={actions.setNav} />
          {!useImmersiveExplorer && (
            <StudioTopBar state={state} derived={derived} registries={registries} actions={actions} />
          )}

          <div className="flex min-h-0 flex-1 gap-4">
            <main className="min-w-0 flex-1">
              <Suspense fallback={<WorkspaceLoadingState nav={state.nav} />}>
                {renderWorkspace(state, derived, registries, actions)}
              </Suspense>
            </main>
            {!useImmersiveExplorer && (
              <aside className="hidden w-[340px] shrink-0 2xl:block">
                <div className="sticky top-4">
                  <RightInspector state={state} derived={derived} />
                </div>
              </aside>
            )}
          </div>

          {!useImmersiveExplorer && (
            <BottomTimeline scenario={derived.activeScenario} runs={state.validationRuns} />
          )}
        </div>
      </div>
    </div>
  );
}
