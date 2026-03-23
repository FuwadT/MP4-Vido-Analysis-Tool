import React from 'react';
import { AlertTriangle, Gauge, ShieldCheck, TableProperties } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { WorkspaceGrid } from './WorkspaceGrid';

export function ValidationWorkspace({ state, derived, registries, actions }) {
  const coverageEntries = Object.entries(derived.validationSummary?.byEvidenceType || {});

  const panels = [
    {
      id: 'validation-requirements',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Requirements"
          title="Traceability table"
          subtitle="Requirements now summarize against persisted run and finding data."
        >
          <div className="space-y-3">
            {registries.validationRequirements.map((requirement) => {
              const summary = derived.validationSummary?.requirementSummaries?.find((item) => item.requirementId === requirement.id);

              return (
                <div key={requirement.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{requirement.code}</div>
                      <div className="mt-1 text-sm text-slate-300">{requirement.title}</div>
                    </div>
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                      {summary?.status || requirement.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{requirement.description}</p>
                </div>
              );
            })}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'validation-coverage',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Coverage"
          title="Evidence summary"
          subtitle="Observed, simulated, and generated runs stay separated while sharing one validation view."
          actions={(
            <button
              type="button"
              onClick={actions.exportValidationReport}
              className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-500"
            >
              Export HTML
            </button>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <ShieldCheck size={14} />
                Passes
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-100">{derived.coverage.passCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <AlertTriangle size={14} />
                Fails
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-100">{derived.coverage.failCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Gauge size={14} />
                Findings
              </div>
              <div className="mt-3 text-3xl font-semibold text-slate-100">{derived.coverage.findingCount}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {coverageEntries.map(([slice, count]) => (
              <div key={slice} className="flex items-center justify-between rounded-xl bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">{slice}</span>
                <span className="font-semibold text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'validation-suites',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Suites"
          title="Reusable validation suites"
          subtitle="Protocol-style suites persist scenario families, sweeps, and pass criteria."
        >
          <div className="space-y-3">
            {state.validationSuites.map((suite) => (
              <div key={suite.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-slate-100">{suite.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {suite.requirementIds.length} requirements / {suite.scenarioIds.length} scenarios
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{suite.description || 'Reusable regression suite.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(suite.oddSlices || []).slice(0, 4).map((slice) => (
                    <span key={`${suite.id}-${slice}`} className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {slice}
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
      id: 'validation-metrics',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Metrics registry"
          title="Observers and pass/fail rules"
          subtitle="Metrics remain reusable across scenarios, suites, and replay-derived runs."
        >
          <div className="space-y-3">
            {registries.validationMetrics.map((metric) => (
              <div key={metric.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-slate-100">{metric.title}</div>
                <div className="mt-1 text-xs text-slate-500">{metric.key} / {metric.source}</div>
                <div className="mt-2 text-sm text-slate-300">
                  {metric.passDirection} {metric.passThreshold} {metric.unit}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'validation-runs',
      slot: 'footer',
      content: (
        <PanelCard
          eyebrow="Run history"
          title="Validation executions"
          subtitle="Runs are now persisted artifacts with summary, metrics, findings, and evidence context."
        >
          <div className="space-y-3">
            {state.validationRuns.map((run) => (
              <div key={run.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{run.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {run.runType} / {run.buildAlias}/{run.modelAlias}
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {run.provenance.evidenceType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )
    },
    {
      id: 'validation-findings',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Findings"
          title="Event-based issues"
          subtitle="Replay findings and run findings are merged into one evidence-driven review queue."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {derived.validationFindings.map((finding) => (
              <div key={finding.id} className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  <TableProperties size={14} />
                  {finding.runLabel || 'Replay finding'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{finding.title}</div>
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
