import React, { Suspense, lazy } from 'react';
import { Cloud, FileSearch, Radar, Video } from 'lucide-react';

const LazyVideoAnnotation = lazy(() => import('../VideoAnnotation').then((module) => ({
  default: module.VideoAnnotation
})));
const LazyWaymoDatasetStudio = lazy(() => import('../WaymoDatasetStudio').then((module) => ({
  default: module.WaymoDatasetStudio
})));

function SourceToggle({ activeSource, onChange }) {
  const options = [
    { id: 'waymo', label: 'Waymo scenario replay', icon: Radar },
    { id: 'mp4', label: 'MP4 incident review', icon: Video }
  ];

  return (
    <div className="inline-flex flex-wrap rounded-2xl border border-slate-800 bg-slate-950/90 p-1.5">
      {options.map((option) => {
        const IconComponent = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeSource === option.id ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-900'}`}
          >
            <IconComponent size={14} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ExplorerLoadingState({ label }) {
  return (
    <div className="flex h-full min-h-[840px] items-center justify-center rounded-[28px] border border-slate-800 bg-slate-950/92">
      <div className="space-y-3 text-center">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Loading explorer</div>
        <div className="text-xl font-semibold text-slate-100">{label}</div>
        <div className="text-sm text-slate-400">
          Replay surfaces are loaded on demand so the operator shell stays responsive.
        </div>
      </div>
    </div>
  );
}

function ExplorerHeader({ activeSource, onSourceChange }) {
  const waymoSteps = [
    '1. Leave Cloud API blank for local `/api` proxy mode.',
    '2. Click Cloud simulation, then open a scenario card.',
    '3. Review cameras, LiDAR, 3D scene, and annotations in one view.'
  ];

  const mp4Steps = [
    '1. Switch to MP4 review.',
    '2. Upload a video file and let the models load.',
    '3. Review detections, incidents, and timeline events.'
  ];

  const steps = activeSource === 'waymo' ? waymoSteps : mp4Steps;

  return (
    <section className="rounded-[28px] border border-slate-800 bg-slate-950/88 p-5 shadow-[0_20px_70px_rgba(2,6,23,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">Data Explorer</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Simple operator replay</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            Open a scenario, inspect the ego vehicle journey, and keep the important sensor views in one place.
            The Data Explorer now prioritizes the actual replay surface over extra scaffolding.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <SourceToggle activeSource={activeSource} onChange={onSourceChange} />
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
            {activeSource === 'waymo' ? <Cloud size={12} className="text-sky-300" /> : <FileSearch size={12} className="text-emerald-300" />}
            {activeSource === 'waymo' ? 'Best demo path: Cloud simulation with local /api proxy' : 'Best demo path: upload a short incident clip'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step}
            className="rounded-2xl border border-slate-800 bg-slate-900/72 px-4 py-3 text-sm leading-6 text-slate-300"
          >
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}

function Mp4ExplorerShell() {
  return (
    <div className="grid min-h-[840px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/92">
        <Suspense fallback={<ExplorerLoadingState label="MP4 incident review" />}>
          <LazyVideoAnnotation embedded />
        </Suspense>
      </div>

      <aside className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-950/90 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">How to use</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">MP4 review flow</h3>
        </div>

        <div className="space-y-3 text-sm leading-7 text-slate-300">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/72 p-4">
            Upload a clip from the existing viewer and wait for the CV models to finish loading.
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/72 p-4">
            Use the incident timeline and overlays to inspect the event frame by frame.
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/72 p-4">
            Move to Scenario Studio when you want to turn the observed event into a reusable scenario seed.
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DataExplorerWorkspace({ state, actions }) {
  const isWaymo = state.explorerSurface === 'waymo';
  const recentFindings = state.findings
    .filter((finding) => finding.linkedScenarioId === state.selectedScenarioId)
    .slice(0, 6);

  return (
    <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-4">
      {isWaymo ? (
        <section className="rounded-[24px] border border-slate-800 bg-slate-950/90 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SourceToggle activeSource={state.explorerSurface} onChange={actions.setExplorerSurface} />
            <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
              World scene centered, command rail on the left, camera strip below
            </div>
          </div>
        </section>
      ) : null}

      <div className="min-h-0 flex-1">
        {isWaymo ? (
          <Suspense fallback={<ExplorerLoadingState label="Waymo scenario replay" />}>
            <LazyWaymoDatasetStudio
              embedded
              presentation="operator"
              onReplayContextChange={actions.setReplayContext}
              onCreateFindingRequest={actions.createFindingFromReplay}
              onCreateBookmarkRequest={actions.createReplayBookmark}
              onPromoteScenarioRequest={actions.promoteReplayToScenario}
              recentFindings={recentFindings}
            />
          </Suspense>
        ) : (
          <div className="flex flex-col gap-4">
            <ExplorerHeader activeSource={state.explorerSurface} onSourceChange={actions.setExplorerSurface} />
            <Mp4ExplorerShell />
          </div>
        )}
      </div>
    </div>
  );
}
