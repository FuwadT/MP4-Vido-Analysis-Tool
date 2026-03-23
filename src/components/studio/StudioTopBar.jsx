import React from 'react';
import clsx from 'clsx';
import { BellRing, ChevronDown, CirclePlay, Columns2, Play, Search, WandSparkles } from 'lucide-react';
import { CommandPalette } from './CommandPalette';

function ControlSelect({ value, onChange, options, label, className }) {
  return (
    <label className={clsx('min-w-[170px]', className)}>
      <span className="mb-1 block text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 pr-9 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>
    </label>
  );
}

export function StudioTopBar({
  state,
  derived,
  registries,
  actions
}) {
  const layoutOptions = Array.from(new Map([
    ...(state.savedLayouts || []).map((layout) => [layout.id, layout]),
    ...(registries.playbackLayouts || []).map((layout) => [layout.id, layout])
  ]).values());

  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-950/86 p-4 shadow-[0_20px_70px_rgba(2,6,23,0.35)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Command bar</div>
          <div className="relative mt-2 max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={state.quickOpenQuery}
              onChange={(event) => actions.updateSelection({ quickOpenQuery: event.target.value })}
              onFocus={() => actions.openCommandPalette(state.quickOpenQuery)}
              placeholder="Quick open datasets, scenarios, requirements, or prompt plans"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/75 px-11 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-800 px-3 py-1">MCAP target</span>
            <span className="rounded-full border border-slate-800 px-3 py-1">OpenSCENARIO hooks</span>
            <span className="rounded-full border border-slate-800 px-3 py-1">Observed vs inferred labeling</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CommandPalette state={state} actions={actions} />
          <button
            type="button"
            onClick={() => actions.createRun('exploratory')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Play size={16} />
            Run current context
          </button>
          <button
            type="button"
            onClick={actions.previewPromptPlan}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-emerald-400/40 hover:bg-slate-900"
          >
            <WandSparkles size={16} />
            Preview plan
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-slate-400 transition-colors hover:text-slate-100"
          >
            <BellRing size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <ControlSelect
          label="Dataset"
          value={state.selectedDatasetAssetId}
          onChange={(value) => actions.updateSelection({ selectedDatasetAssetId: value })}
          options={registries.datasetAssets.map((asset) => ({ value: asset.id, label: asset.name }))}
        />
        <ControlSelect
          label="Scenario"
          value={state.selectedScenarioId}
          onChange={actions.selectScenario}
          options={state.scenarioLibrary.map((scenario) => ({ value: scenario.id, label: scenario.name }))}
        />
        <ControlSelect
          label="Build alias"
          value={state.selectedBuildAlias}
          onChange={(value) => actions.updateSelection({ selectedBuildAlias: value })}
          options={registries.buildProfiles.map((profile) => ({ value: profile.alias, label: `${profile.alias} / ${profile.version}` }))}
        />
        <ControlSelect
          label="Model alias"
          value={state.selectedModelAlias}
          onChange={(value) => actions.updateSelection({ selectedModelAlias: value })}
          options={registries.modelProfiles.map((profile) => ({ value: profile.alias, label: `${profile.alias} / ${profile.family}` }))}
        />
        <ControlSelect
          label="Layout"
          value={state.selectedLayoutId}
          onChange={(value) => actions.updateSelection({ selectedLayoutId: value })}
          options={layoutOptions.map((layout) => ({ value: layout.id, label: layout.name }))}
        />
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => actions.saveCurrentLayout('Saved operator layout', 'Saved from the command bar.')}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 hover:border-slate-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={actions.duplicateCurrentLayout}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 hover:border-slate-500"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={actions.resetLayoutToPreset}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 hover:border-slate-500"
          >
            Reset
          </button>
        </div>

        <div className="ml-auto flex min-w-[210px] items-end gap-3">
          <button
            type="button"
            onClick={() => actions.updateSelection({ compareMode: !state.compareMode })}
            className={clsx(
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors',
              state.compareMode
                ? 'border-sky-400/40 bg-sky-500/10 text-sky-100'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
            )}
          >
            <Columns2 size={16} />
            {state.compareMode ? 'Compare on' : 'Compare off'}
          </button>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-400">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Active provenance</div>
            <div className="mt-1 font-semibold text-slate-100">{derived.activeVariant?.provenance?.honestyLabel || 'Observed-from-log evidence'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
        <CirclePlay size={16} className="text-emerald-300" />
        <span>{derived.activeScenario?.name}</span>
        <span className="text-slate-600">/</span>
        <span>{derived.activeVariant?.label}</span>
        <span className="text-slate-600">/</span>
        <span>{derived.activeDatasetAsset?.name}</span>
      </div>
    </div>
  );
}
