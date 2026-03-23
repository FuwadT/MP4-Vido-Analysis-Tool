import React from 'react';
import { Bot, CopyPlus, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PanelCard } from './PanelCard';
import { WorkspaceGrid } from './WorkspaceGrid';
import { CopilotWorkbench } from './CopilotWorkbench';

function BirdseyeScene({ scenario, selectedActorId, onSelectActor }) {
  const bounds = scenario?.roadNetwork?.boundingBox || { minX: -50, maxX: 50, minY: -80, maxY: 80 };
  const width = bounds.maxX - bounds.minX || 1;
  const height = bounds.maxY - bounds.minY || 1;

  const toCanvasX = (x) => ((x - bounds.minX) / width) * 100;
  const toCanvasY = (y) => 100 - (((y - bounds.minY) / height) * 100);

  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-[24px] border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <svg viewBox="0 0 100 100" className="relative z-10 h-full w-full">
        <polyline
          points={(scenario?.route || []).map((point) => `${toCanvasX(point.x)},${toCanvasY(point.y)}`).join(' ')}
          fill="none"
          stroke="rgba(52,211,153,0.85)"
          strokeWidth="2.5"
          strokeDasharray="0"
        />
        {(scenario?.actors || []).map((actor) => {
          const x = toCanvasX(actor.spawnPose.x);
          const y = toCanvasY(actor.spawnPose.y);
          const isSelected = actor.id === selectedActorId;

          return (
            <g
              key={actor.id}
              onClick={() => onSelectActor(actor.id)}
              className="cursor-pointer"
            >
              <rect
                x={x - 2.8}
                y={y - 2.8}
                width="5.6"
                height="5.6"
                rx="1.8"
                fill={isSelected ? 'rgba(96,165,250,0.95)' : actor.tags.includes('ego') ? 'rgba(52,211,153,0.95)' : 'rgba(248,250,252,0.9)'}
                stroke={isSelected ? 'rgba(191,219,254,1)' : 'rgba(15,23,42,0.9)'}
                strokeWidth="0.8"
              />
              <text
                x={x + 3.5}
                y={y - 3.5}
                fill="rgba(226,232,240,0.86)"
                fontSize="3.2"
              >
                {actor.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-4 left-4 rounded-2xl border border-slate-700 bg-slate-950/85 px-4 py-3 text-sm text-slate-300">
        Static obstacles, dynamic actors, and routes are editable scaffolding here. OpenSCENARIO/OpenDRIVE export hooks stay explicit and separate.
      </div>
    </div>
  );
}

function ActorRow({ actor, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(actor.id)}
      className={`w-full rounded-[20px] border px-4 py-3 text-left transition-colors ${selected ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'}`}
    >
      <div className="text-sm font-semibold text-slate-100">{actor.label}</div>
      <div className="mt-1 text-xs text-slate-500">{actor.actorType} / {actor.behavior.intent}</div>
    </button>
  );
}

function ScenarioLibraryCard({ scenario, isSelected, onOpen, onReplay, onValidate }) {
  return (
    <div className={`rounded-[22px] border p-4 transition-colors ${isSelected ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{scenario.name}</div>
          <div className="mt-1 text-xs text-slate-500">
            {scenario.family} / {scenario.variants.length} variants / {scenario.actors.length} actors
          </div>
        </div>
        {isSelected && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
            Active
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {scenario.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Open scenario
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          <Play size={14} />
          Replay
        </button>
        <button
          type="button"
          onClick={onValidate}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          <ShieldCheck size={14} />
          Validate
        </button>
      </div>
    </div>
  );
}

export function ScenarioStudioWorkspace({ state, derived, actions, registries }) {
  const actor = derived.activeActor;
  const scenario = derived.activeScenario;
  const activeVariant = derived.activeVariant;

  const panels = [
    {
      id: 'scenario-canvas',
      slot: 'primary',
      content: (
        <PanelCard
          eyebrow="Scene editor"
          title={scenario?.name}
          subtitle="Bird's-eye authoring view for routes, actors, and counterfactual setup. Current pass focuses on editable scaffolding and provenance-aware scenario variants."
          actions={(
            <>
              <button
                type="button"
                onClick={() => actions.addActor('vehicle')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 hover:border-emerald-400/40"
              >
                <Plus size={14} />
                Add vehicle
              </button>
              <button
                type="button"
                onClick={actions.duplicateVariant}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-emerald-500"
              >
                <CopyPlus size={14} />
                Duplicate variant
              </button>
            </>
          )}
        >
          <BirdseyeScene scenario={scenario} selectedActorId={state.selectedActorId} onSelectActor={actions.selectActor} />
        </PanelCard>
      )
    },
    {
      id: 'scenario-actors',
      slot: 'secondary',
      content: (
        <PanelCard
          eyebrow="Actor list"
          title={`${scenario?.actors?.length || 0} actors`}
          subtitle="Vehicles, pedestrians, cyclists, animals, obstacles, cones, barriers, signage, and unknown objects can all live in the same scene model."
        >
          <div className="space-y-3">
            {scenario?.actors?.map((item) => (
              <ActorRow
                key={item.id}
                actor={item}
                selected={item.id === state.selectedActorId}
                onSelect={actions.selectActor}
              />
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => actions.addActor('obstacle')}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Add obstacle
              </button>
              <button
                type="button"
                onClick={() => actions.addActor('pedestrian')}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Add pedestrian
              </button>
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'scenario-inspector',
      slot: 'tertiary',
      content: (
        <PanelCard
          eyebrow="Actor inspector"
          title={actor?.label || 'No actor selected'}
          subtitle="Editable foundation for spawn pose, dimensions, intent, speed, tags, and notes."
          actions={actor ? (
            <button
              type="button"
              onClick={() => actions.removeActor(actor.id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-100 hover:bg-red-500/20"
            >
              <Trash2 size={14} />
              Remove actor
            </button>
          ) : null}
        >
          {actor ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.22em] text-slate-500">Label</span>
                <input
                  value={actor.label}
                  onChange={(event) => actions.updateActor(actor.id, { label: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.22em] text-slate-500">Intent</span>
                <input
                  value={actor.behavior.intent}
                  onChange={(event) => actions.updateActor(actor.id, { behavior: { intent: event.target.value } })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.22em] text-slate-500">Speed (m/s)</span>
                <input
                  type="number"
                  value={actor.speedMps}
                  onChange={(event) => actions.updateActor(actor.id, { speedMps: Number(event.target.value) })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.22em] text-slate-500">Notes</span>
                <textarea
                  rows={4}
                  value={actor.notes}
                  onChange={(event) => actions.updateActor(actor.id, { notes: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/45 p-4 text-sm text-slate-400">
              Select an actor in the list or scene view to edit it.
            </div>
          )}
        </PanelCard>
      )
    },
    {
      id: 'scenario-library',
      slot: 'detail',
      content: (
        <PanelCard
          eyebrow="Scenario library"
          title={`${state.scenarioLibrary.length} demo scenarios ready`}
          subtitle="Use these seeded scenarios to demo the studio immediately. Open one in the editor, replay it in Data Explorer, or jump straight to validation."
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {state.scenarioLibrary.map((item) => (
                <ScenarioLibraryCard
                  key={item.id}
                  scenario={item}
                  isSelected={item.id === state.selectedScenarioId}
                  onOpen={() => actions.selectScenario(item.id)}
                  onReplay={() => {
                    actions.selectScenario(item.id);
                    actions.setExplorerSurface('waymo');
                  }}
                  onValidate={() => {
                    actions.selectScenario(item.id);
                    actions.setNav('validation');
                  }}
                />
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Active variant</div>
                <div className="mt-2 text-lg font-semibold text-slate-100">{derived.activeVariant?.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{derived.activeVariant?.worldMutationSummary || 'Direct scenario replay.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(derived.activeVariant?.parameterSweep || []).map((sweep) => (
                    <div key={sweep.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{sweep.key}</div>
                      <input
                        value={(sweep.values || []).join(', ')}
                        onChange={(event) => actions.updateVariantSweep(activeVariant.id, derived.activeVariant.parameterSweep.findIndex((item) => item.key === sweep.key), {
                          values: event.target.value.split(',').map((value) => value.trim()).filter(Boolean)
                        })}
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => actions.addVariantSweep(activeVariant.id)}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
                  >
                    Add sweep
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Route authoring</div>
                  <button
                    type="button"
                    onClick={actions.addRouteWaypoint}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-slate-500"
                  >
                    Add waypoint
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {(scenario?.route || []).map((point, index) => (
                    <div key={`route-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                      <input
                        value={point.x}
                        onChange={(event) => actions.updateRouteWaypoint(index, { x: Number(event.target.value) })}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                      <input
                        value={point.y}
                        onChange={(event) => actions.updateRouteWaypoint(index, { y: Number(event.target.value) })}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => actions.removeRouteWaypoint(index)}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Trigger and event editing</div>
                  <button
                    type="button"
                    onClick={actions.addEvent}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-slate-500"
                  >
                    Add event
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {scenario?.events?.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                      <input
                        value={event.title}
                        onChange={(e) => actions.updateEvent(event.id, { title: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={event.startTimeSeconds}
                          onChange={(e) => actions.updateEvent(event.id, { startTimeSeconds: Number(e.target.value) })}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                        <input
                          type="number"
                          value={event.endTimeSeconds}
                          onChange={(e) => actions.updateEvent(event.id, { endTimeSeconds: Number(e.target.value) })}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => actions.removeEvent(event.id)}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Scenario provenance</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Source: {scenario?.provenance?.sourceLabel}</div>
                  <div>Evidence: {scenario?.provenance?.honestyLabel}</div>
                  <div>Scenario version: {scenario?.scenarioVersion}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={actions.duplicateScenario}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
                  >
                    Duplicate scenario
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.createRun('exploratory')}
                    className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Launch run
                  </button>
                </div>
              </div>
            </div>
          </div>
        </PanelCard>
      )
    },
    {
      id: 'scenario-copilot',
      slot: 'footer',
      content: (
        <CopilotWorkbench state={state} derived={derived} registries={registries} actions={actions} />
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
