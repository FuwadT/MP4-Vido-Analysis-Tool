import React from 'react';
import { BookOpenCheck, Cable, Database, MapPinned } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { WorkspaceGrid } from './WorkspaceGrid';

export function SettingsWorkspace({ registries, derived }) {
  const panels = [
    {
      id: 'settings-adapters',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Interop"
          title="Data adapters and normalization targets"
          subtitle="The current codebase keeps TFRecord, Parquet, and MP4 inputs alive while aiming toward MCAP, OpenSCENARIO, and OpenDRIVE compatibility."
        >
          <div className="space-y-3">
            {registries.dataAdapters.map((adapter) => (
              <div key={adapter.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Cable size={14} />
                  {adapter.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">{adapter.target} · {adapter.status}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{adapter.description}</p>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'settings-feasibility',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Feasibility"
          title="What works now"
          subtitle="The studio shell makes the current repo honest about what is functional, what needs more infrastructure, and what remains experimental."
        >
          <ul className="space-y-3 text-sm leading-6 text-slate-300">
            <li className="rounded-2xl border border-slate-800 bg-slate-900/65 px-3 py-2">Functional now: local/cloud Waymo replay, MP4 review, scenario scaffolding, build/model registry UX, validation browser.</li>
            <li className="rounded-2xl border border-slate-800 bg-slate-900/65 px-3 py-2">Needs more infrastructure: distributed sim execution, MCAP import/export, layout sharing backend, CI-scale coverage generation.</li>
            <li className="rounded-2xl border border-slate-800 bg-slate-900/65 px-3 py-2">Research frontier: controllable multi-sensor world-model generation, high-fidelity novel-view synthesis, dashcam-to-surround validation evidence.</li>
          </ul>
        </PanelCard>
      )
    },
    {
      id: 'settings-standards',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Standards"
          title="Target standards"
          subtitle="Standards remain explicit targets instead of hidden assumptions."
        >
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Database size={14} />
                MCAP
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Canonical multimodal container target for normalized playback and export.</p>
            </div>
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <BookOpenCheck size={14} />
                OpenSCENARIO
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Logical and concrete scenario representation target for scenario authoring and exchange.</p>
            </div>
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <MapPinned size={14} />
                OpenDRIVE
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Road network description target for lane-level routing and map context.</p>
            </div>
          </div>
        </PanelCard>
      )
    }
  ];

  return <WorkspaceGrid layout={derived.activeLayout} panels={panels} />;
}
