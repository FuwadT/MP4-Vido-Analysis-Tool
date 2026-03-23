import React from 'react';
import { BadgeAlert, Fingerprint, Route, ScanSearch, Sparkles } from 'lucide-react';
import { PanelCard } from './PanelCard';

function TagPill({ children }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
      {children}
    </span>
  );
}

export function RightInspector({ state, derived }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelCard
        eyebrow="Inspector"
        title={derived.activeActor?.label || derived.activeScenario?.name}
        subtitle="Selection details, provenance, and uncertainty labeling stay visible while you move between workspaces."
      >
        {derived.activeActor && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-500">Actor type</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">{derived.activeActor.actorType}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-500">Intent</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">{derived.activeActor.behavior.intent}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-500">Spawn pose</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {derived.activeActor.spawnPose.x}m, {derived.activeActor.spawnPose.y}m
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-500">Speed</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">{derived.activeActor.speedMps.toFixed(1)} m/s</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {derived.activeActor.tags.map((tag) => (
                <TagPill key={tag}>{tag}</TagPill>
              ))}
            </div>
            <p className="text-sm leading-6 text-slate-400">{derived.activeActor.notes}</p>
          </div>
        )}
      </PanelCard>

      <PanelCard
        eyebrow="Provenance"
        title={derived.activeVariant?.provenance?.honestyLabel || 'Observed-from-log evidence'}
        subtitle={derived.activeVariant?.provenance?.uncertaintySummary}
      >
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <Fingerprint size={16} className="text-emerald-300" />
            <span>Build `{state.selectedBuildAlias}` / model `{state.selectedModelAlias}`</span>
          </div>
          <div className="flex items-center gap-3">
            <Route size={16} className="text-sky-300" />
            <span>Scenario `{derived.activeScenario?.name}` / variant `{derived.activeVariant?.label}`</span>
          </div>
          <div className="flex items-center gap-3">
            <ScanSearch size={16} className="text-violet-300" />
            <span>Dataset `{derived.activeDatasetAsset?.name}` / session `{derived.activeLogSession?.label}`</span>
          </div>
        </div>
      </PanelCard>

      <PanelCard
        eyebrow="Experimental"
        title="World-model boundary"
        subtitle="Research-facing interfaces are kept visible, but generated outputs remain clearly labeled as hypotheses."
        tone="warning"
      >
        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 text-amber-300" />
            <span>Dashcam-to-surround remains a scenario seed and ideation workflow unless corroborated by more sensors or map priors.</span>
          </div>
          <div className="flex items-start gap-3">
            <BadgeAlert size={16} className="mt-0.5 text-amber-300" />
            <span>Observed, simulated, and generated evidence stay separated in runs, findings, and validation reports.</span>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
