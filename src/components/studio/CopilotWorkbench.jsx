import React from 'react';
import { Code2, Sparkles } from 'lucide-react';
import { PanelCard } from './PanelCard';

export function CopilotWorkbench({ state, derived, registries, actions }) {
  return (
    <PanelCard
      eyebrow="Prompt Copilot"
      title="Structured plan preview"
      subtitle="Prompt requests are turned into inspectable structured artifacts before anything is applied."
      actions={(
        <>
          <button
            type="button"
            onClick={actions.previewPromptPlan}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 hover:border-emerald-400/40"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={actions.applyPromptPlan}
            className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-500"
          >
            Apply
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <textarea
          value={state.promptDraft}
          onChange={(event) => actions.setPromptDraft(event.target.value)}
          rows={4}
          className="w-full rounded-[22px] border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400"
        />
        <div className="flex flex-wrap gap-2">
          {registries.copilotExamples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => actions.setPromptDraft(example)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-slate-100"
            >
              {example}
            </button>
          ))}
        </div>

        {state.lastStructuredPlan ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[22px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Sparkles size={14} />
                Plan summary
              </div>
              <div className="mt-3 text-sm text-slate-300">
                <div><span className="text-slate-500">Intent:</span> {state.lastStructuredPlan.intentType}</div>
                <div className="mt-1"><span className="text-slate-500">Confidence:</span> {Math.round((state.lastStructuredPlan.confidence || 0) * 100)}%</div>
                <div className="mt-1"><span className="text-slate-500">Scenario:</span> {derived.activeScenario?.name}</div>
                <div className="mt-1"><span className="text-slate-500">Dataset:</span> {derived.activeDatasetAsset?.name}</div>
                <div className="mt-1"><span className="text-slate-500">Actions:</span> {(state.lastStructuredPlan.artifact?.actions || []).map((action) => action.kind).join(', ') || 'preview only'}</div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-800 bg-slate-900/65 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                <Code2 size={14} />
                Structured payload
              </div>
              <pre className="mt-3 max-h-[280px] overflow-auto rounded-2xl bg-slate-950/80 p-3 text-xs leading-6 text-slate-300">
                {JSON.stringify(state.lastStructuredPlan.artifact, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-700 bg-slate-900/45 p-4 text-sm text-slate-400">
            Preview a plan to expose the structured search filter, scenario seed, validation suite, compare request, or layout mutation before it changes the workspace.
          </div>
        )}
      </div>
    </PanelCard>
  );
}
