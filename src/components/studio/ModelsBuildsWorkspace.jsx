import React, { useEffect, useState } from 'react';
import { Cpu, DatabaseZap, GitBranch, Network, Radar } from 'lucide-react';
import { createWorldModelPreviewRequest, runWorldModelPreview, WORLD_MODEL_ADAPTERS } from '../../studio/world-model/adapter';
import { PanelCard } from './PanelCard';
import { WorkspaceGrid } from './WorkspaceGrid';

export function ModelsBuildsWorkspace({ state, registries }) {
  const [previewOutput, setPreviewOutput] = useState(null);

  useEffect(() => {
    let active = true;

    void runWorldModelPreview(createWorldModelPreviewRequest({
      languageInstructions: 'Create a dusk rainy variant with explicit uncertainty masks.'
    })).then((result) => {
      if (active) {
        setPreviewOutput(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const panels = [
    {
      id: 'models-builds-builds',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Build registry"
          title="Switch software stacks by alias"
          subtitle="Build profiles use aliases and immutable versions so replay and validation runs can be reproduced cleanly."
        >
          <div className="space-y-3">
            {registries.buildProfiles.map((build) => (
              <div key={build.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{build.alias}</div>
                    <div className="mt-1 text-xs text-slate-500">{build.version} · {build.branch}</div>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {build.targetStacks.join(', ')}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{build.description}</p>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'models-builds-models',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Model registry"
          title="Perception and world-model aliases"
          subtitle="Models are referenced by alias and version rather than raw file paths."
        >
          <div className="space-y-3">
            {registries.modelProfiles.map((model) => (
              <div key={model.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-slate-100">{model.alias}</div>
                <div className="mt-1 text-xs text-slate-500">{model.family} · {model.version}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {model.supportsWorldMutation && <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">world-mutation</span>}
                  {model.supportsSensorGeneration && <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">sensor-generation</span>}
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{model.servingContract}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'models-builds-compat',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Compatibility"
          title="Build / model / rig matrix"
          subtitle="Use this contract to guard unsupported combinations before execution."
        >
          <div className="space-y-3">
            {registries.compatibilityMatrix.map((entry) => (
              <div key={entry.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Network size={14} />
                  {entry.buildAlias} ↔ {entry.modelAlias}
                </div>
                <div className="mt-1 text-xs text-slate-500">{entry.sensorRigId} · {entry.status}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.scenarioFamilies.map((family) => (
                    <span key={family} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                      {family}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'models-builds-rigs',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Sensor rigs"
          title="Hardware-aware simulation profile scaffold"
          subtitle="Sensor profiles stay separate from scenario content so hardware changes do not rewrite the scenario library."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {registries.sensorRigs.map((rig) => (
              <div key={rig.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Radar size={14} />
                  {rig.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">{rig.hardwareClass}</div>
                <div className="mt-3 space-y-2">
                  {rig.sensors.map((sensor) => (
                    <div key={sensor.name} className="rounded-xl bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                      {sensor.count}× {sensor.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'models-builds-world-model',
      slot: 'footer',
      content: (
        <PanelCard
          eyebrow="World-model adapter"
          title="Experimental interface"
          subtitle="The repo exposes a clean adapter contract for future controllable world-model engines without pretending to ship one today."
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              {WORLD_MODEL_ADAPTERS.map((adapter) => (
                <div key={adapter.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <GitBranch size={14} />
                    {adapter.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{adapter.status}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{adapter.description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Cpu size={14} />
                Preview output
              </div>
              <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-slate-950/90 p-4 text-xs leading-6 text-slate-300">
                {JSON.stringify(previewOutput, null, 2)}
              </pre>
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Generated outputs are placeholders here and must remain labeled as generated hypotheses with uncertainty masks.
              </div>
            </div>
          </div>
        </PanelCard>
      )
    }
  ];

  return <WorkspaceGrid layout={derivedLayout(state.selectedLayoutId, registries.playbackLayouts)} panels={panels} />;
}

function derivedLayout(layoutId, layouts) {
  return layouts.find((layout) => layout.id === layoutId) || layouts[0];
}
