import React from 'react';
import { GitCompareArrows, Play, Rocket, Scale } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { WorkspaceGrid } from './WorkspaceGrid';

function MetricLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}

export function SimulationRunsWorkspace({ state, derived, actions }) {
  const compareSummary = derived.compareSummary;
  const compareMetrics = compareSummary?.metricDeltas || [];

  const panels = [
    {
      id: 'runs-queue',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Execution"
          title="Run queue and replay launch"
          subtitle="Queued, preparing, running, completed, failed, and canceled states now persist with provenance."
          actions={(
            <>
              <button
                type="button"
                onClick={() => actions.createRun('regression')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 hover:border-emerald-400/40"
              >
                <Play size={14} />
                Regression
              </button>
              <button
                type="button"
                onClick={() => actions.createRun('world-model-hypothesis')}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-500"
              >
                <Rocket size={14} />
                Hypothesis
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            {state.validationRuns.map((run) => (
              <div key={run.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{run.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {run.runType} / {run.status} / {run.buildAlias}/{run.modelAlias}
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {run.provenance.honestyLabel}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => actions.updateSelection({ selectedRunId: run.id })}
                    className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 hover:border-slate-500"
                  >
                    Inspect
                  </button>
                  {!['completed', 'failed', 'canceled'].includes(run.status) && (
                    <button
                      type="button"
                      onClick={() => actions.cancelRun(run.id)}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {Object.entries(run.metrics || {}).slice(0, 3).map(([key, value]) => (
                    <MetricLine key={key} label={key} value={String(value)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'runs-compare',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Compare"
          title="Operational compare"
          subtitle="Pick two persisted runs and inspect metric deltas, provenance gaps, and finding changes."
        >
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <GitCompareArrows size={14} />
                A / B setup
              </div>
              <div className="mt-3 grid gap-2">
                <select
                  value={state.compareLeftRunId}
                  onChange={(event) => actions.updateSelection({ compareLeftRunId: event.target.value, compareMode: true })}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100"
                >
                  {state.validationRuns.map((run) => <option key={`left-${run.id}`} value={run.id}>{run.label}</option>)}
                </select>
                <select
                  value={state.compareRightRunId}
                  onChange={(event) => actions.updateSelection({ compareRightRunId: event.target.value, compareMode: true })}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100"
                >
                  {state.validationRuns.map((run) => <option key={`right-${run.id}`} value={run.id}>{run.label}</option>)}
                </select>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                  {state.compareMode ? 'Compare mode is enabled for the active run pair.' : 'Enable compare mode from the command bar to keep this diff sticky.'}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Scale size={14} />
                Metric deltas
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <MetricLine label="Shared scenario" value={compareSummary?.sharedScenario ? 'Yes' : 'No'} />
                <MetricLine label="Finding delta" value={String(compareSummary?.findingDelta ?? 0)} />
                <MetricLine label="Intervention delta" value={String(compareSummary?.interventionDelta ?? 0)} />
              </div>
              <div className="mt-3 space-y-2">
                {compareMetrics.map((metric) => (
                  <div key={metric.key} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm">
                    <div className="font-semibold text-slate-100">{metric.key}</div>
                    <div className="mt-1 text-slate-400">Left {String(metric.leftValue ?? 'N/A')} / Right {String(metric.rightValue ?? 'N/A')}</div>
                    <div className="mt-1 text-sky-200">Delta {metric.delta != null ? metric.delta.toFixed(2) : 'N/A'}</div>
                  </div>
                ))}
              </div>
              {compareSummary?.provenanceGaps?.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                  {compareSummary.provenanceGaps.join(' | ')}
                </div>
              )}
              {compareMetrics.length === 0 && (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-400">
                  Create or select two runs to generate a compare summary.
                </div>
              )}
            </div>

            <div className="rounded-[22px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Side-by-side evidence</div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {[derived.leftRun, derived.rightRun].map((run, index) => (
                  <div key={run?.id || index} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-sm font-semibold text-slate-100">{run?.label || 'No run selected'}</div>
                    <div className="mt-1 text-xs text-slate-500">{index === 0 ? 'Left context' : 'Right context'}</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                      <div>Status: {run?.status || 'n/a'}</div>
                      <div>Evidence: {run?.provenance?.honestyLabel || 'n/a'}</div>
                      <div>Artifacts: {run?.artifacts?.summary?.headline || 'Artifacts appear after completion.'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'runs-latest',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Selected run"
          title={derived.selectedRun?.label}
          subtitle="Summary and artifacts for the currently selected run."
        >
          <div className="space-y-3">
            {Object.entries(derived.selectedRun?.metrics || {}).map(([key, value]) => (
              <MetricLine key={key} label={key} value={String(value)} />
            ))}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-300">
              {derived.selectedRun?.artifacts?.summary?.headline || 'Queued runs will generate summary artifacts here.'}
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'runs-findings',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Findings"
          title={`${derived.validationFindings.length} execution findings`}
          subtitle="Event-based issues stay attached to their run provenance and scenario context."
        >
          <div className="space-y-3">
            {derived.validationFindings.map((finding) => (
              <div key={finding.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-slate-100">{finding.title}</div>
                <div className="mt-1 text-xs text-slate-500">{finding.runLabel || 'Replay finding'} / {finding.severity}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{finding.description}</p>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    }
  ];

  return (
    <WorkspaceGrid
      layout={derived.activeLayout}
      panels={panels}
      onReorder={(panelOrder) => actions.reorderLayoutPanels(derived.activeLayout?.id, panelOrder)}
    />
  );
}
