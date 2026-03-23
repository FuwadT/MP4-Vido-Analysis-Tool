import React from 'react';
import { Activity, BookMarked, Boxes, Radar, ShieldCheck, Video } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { CopilotWorkbench } from './CopilotWorkbench';
import { WorkspaceGrid } from './WorkspaceGrid';

function MetricCard({ label, value, icon, helper }) {
  const IconComponent = icon;

  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
        <IconComponent size={14} />
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold text-slate-100">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

export function HomeWorkspace({ state, derived, registries, actions }) {
  const panels = [
    {
      id: 'home-overview',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Overview"
          title="ADAS platform foundation"
          subtitle="This repo now acts as a modular studio shell for data exploration, scenario authoring, simulation runs, validation, and future world-model experimentation."
          tone="brand"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Datasets" value={registries.datasetAssets.length} icon={Radar} helper="Waymo local/cloud datasets plus dashcam uploads." />
            <MetricCard label="Scenarios" value={state.scenarioLibrary.length} icon={BookMarked} helper="Logical and extracted scenarios with variant scaffolding." />
            <MetricCard label="Runs" value={state.validationRuns.length} icon={Activity} helper="Observed, simulated, and generated-hypothesis runs." />
            <MetricCard label="Build / model aliases" value={`${registries.buildProfiles.length} / ${registries.modelProfiles.length}`} icon={Boxes} helper="Switch like a model selector in an AI IDE." />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Current focus</div>
              <div className="mt-3 text-xl font-semibold text-slate-100">{derived.activeScenario?.name}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{derived.activeScenario?.description}</p>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Truth boundary</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Observed logs stay separate from physics-simulated counterfactuals and generated world-model hypotheses. That split is preserved in layouts, runs, and validation evidence.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Quick launch</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => actions.setExplorerSurface('waymo')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Radar size={14} />
                  Open Waymo explorer
                </button>
                <button
                  type="button"
                  onClick={() => actions.setExplorerSurface('mp4')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
                >
                  <Video size={14} />
                  Open MP4 review
                </button>
                <button
                  type="button"
                  onClick={() => actions.setNav('validation')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
                >
                  <ShieldCheck size={14} />
                  Open validation
                </button>
                <button
                  type="button"
                  onClick={() => actions.setNav('scenario-studio')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
                >
                  <BookMarked size={14} />
                  Open scenario library
                </button>
              </div>
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'home-pipeline',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Start Here"
          title="Fastest demo path"
          subtitle="The simplest way to see the full camera, LiDAR, and 3D replay flow."
        >
          <div className="space-y-3 text-sm leading-7 text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              1. Start the frontend and backend, then open <span className="font-semibold text-slate-100">Data Explorer</span>.
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              2. Stay in <span className="font-semibold text-slate-100">Waymo scenario replay</span>, switch to <span className="font-semibold text-slate-100">Cloud simulation</span>, and leave the API field blank for the local `/api` proxy.
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              3. Open a scenario card to see the left diagnostics rail, camera wall, LiDAR bird&apos;s-eye panel, 3D world view, and playback controls.
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'home-honesty',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Honesty"
          title="Feasibility and boundaries"
          subtitle="The repo implements the high-leverage foundation now and leaves heavier infra behind explicit stubs."
        >
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            {registries.honestyGuidelines.map((guideline) => (
              <li key={guideline} className="rounded-2xl border border-slate-800 bg-slate-900/65 px-3 py-2">
                {guideline}
              </li>
            ))}
          </ul>
        </PanelCard>
      )
    },
    {
      id: 'home-scenario-library',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Demo scenarios"
          title="Ready-to-demo scenario library"
          subtitle="These seed scenarios are immediately available, even without importing new logs."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {state.scenarioLibrary.slice(0, 3).map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  actions.selectScenario(scenario.id);
                  actions.setNav('scenario-studio');
                }}
                className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4 text-left transition-colors hover:border-emerald-400/30 hover:bg-slate-900"
              >
                <div className="text-sm font-semibold text-slate-100">{scenario.name}</div>
                <div className="mt-1 text-xs text-slate-500">{scenario.family} / {scenario.variants.length} variants</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{scenario.description}</p>
              </button>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'home-copilot',
      slot: 'footer',
      content: <CopilotWorkbench state={state} derived={derived} registries={registries} actions={actions} />
    }
  ];

  return <WorkspaceGrid layout={derived.activeLayout} panels={panels} />;
}
