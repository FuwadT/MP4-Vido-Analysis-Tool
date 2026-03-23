import {
  ACTOR_BEHAVIORS,
  ACTOR_TYPES,
  EVIDENCE_TYPES,
  createActor,
  createEvent,
  createScenario,
  createScenarioVariant
} from './models.js';

function cloneScenario(scenario) {
  return JSON.parse(JSON.stringify(scenario));
}

export function duplicateScenarioDefinition(scenario, overrides = {}) {
  const copy = cloneScenario(scenario);
  const timestamp = Date.now();

  return {
    ...copy,
    ...overrides,
    id: overrides.id || `${scenario.id}-copy-${timestamp}`,
    name: overrides.name || `${scenario.name} copy`,
    scenarioVersion: overrides.scenarioVersion || `${scenario.scenarioVersion || 'v1'}-copy`,
    provenance: {
      ...(copy.provenance || {}),
      ...(overrides.provenance || {}),
      sourceLabel: 'Duplicated scenario definition',
      evidenceType: EVIDENCE_TYPES.SIMULATED
    }
  };
}

export function addRoutePoint(scenario, point = { x: 0, y: 0 }) {
  const next = cloneScenario(scenario);
  next.route = [...(next.route || []), {
    x: Number(point.x) || 0,
    y: Number(point.y) || 0
  }];
  return next;
}

export function updateRoutePoint(scenario, pointIndex, pointPatch) {
  const next = cloneScenario(scenario);
  next.route = (next.route || []).map((point, index) => (
    index === pointIndex
      ? {
        ...point,
        ...pointPatch,
        x: Number(pointPatch.x ?? point.x) || 0,
        y: Number(pointPatch.y ?? point.y) || 0
      }
      : point
  ));
  return next;
}

export function removeRoutePoint(scenario, pointIndex) {
  const next = cloneScenario(scenario);
  next.route = (next.route || []).filter((_point, index) => index !== pointIndex);
  return next;
}

export function addScenarioEvent(scenario, overrides = {}) {
  const next = cloneScenario(scenario);
  next.events = [...(next.events || []), createEvent(overrides)];
  return next;
}

export function updateScenarioEvent(scenario, eventId, patch = {}) {
  const next = cloneScenario(scenario);
  next.events = (next.events || []).map((event) => (
    event.id === eventId ? { ...event, ...patch } : event
  ));
  return next;
}

export function removeScenarioEvent(scenario, eventId) {
  const next = cloneScenario(scenario);
  next.events = (next.events || []).filter((event) => event.id !== eventId);
  return next;
}

export function addParameterSweep(variant, sweep = { key: 'parameter', values: [] }) {
  return {
    ...variant,
    parameterSweep: [...(variant.parameterSweep || []), sweep]
  };
}

export function updateParameterSweep(variant, sweepIndex, patch = {}) {
  return {
    ...variant,
    parameterSweep: (variant.parameterSweep || []).map((sweep, index) => (
      index === sweepIndex ? { ...sweep, ...patch } : sweep
    ))
  };
}

export function removeParameterSweep(variant, sweepIndex) {
  return {
    ...variant,
    parameterSweep: (variant.parameterSweep || []).filter((_sweep, index) => index !== sweepIndex)
  };
}

export function createVariantFromScenarioMutation(scenario, mutationPlan = {}) {
  return createScenarioVariant({
    scenarioId: scenario.id,
    label: mutationPlan.summary || `${scenario.name} mutation`,
    parameterSweep: mutationPlan.parameterSweep || [],
    triggerEdits: mutationPlan.triggerEdits || [],
    worldMutationSummary: mutationPlan.worldMutationSummary || 'Operator-authored mutation',
    provenance: {
      scenarioId: scenario.id,
      evidenceType: EVIDENCE_TYPES.SIMULATED,
      sourceLabel: 'Scenario mutation'
    }
  });
}

export function createScenarioSeedFromPromptPlan(plan = {}, baseScenario = null) {
  const timestamp = Date.now();
  const defaultRoute = [
    { x: 0, y: 42 },
    { x: 0, y: 12 },
    { x: -4, y: -18 },
    { x: -8, y: -48 }
  ];
  const baseActors = Array.isArray(baseScenario?.actors) ? cloneScenario(baseScenario.actors) : [];
  const promptActors = (plan.actors || []).map((actor, index) => createActor({
    id: actor.id || `actor-prompt-${timestamp}-${index + 1}`,
    label: actor.label,
    actorType: actor.actorType,
    tags: actor.tags || ['prompt-authored'],
    notes: actor.notes || 'Added from structured prompt plan.',
    behavior: actor.behavior || {
      type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
      intent: actor.intent || 'maintain-lane'
    }
  }));

  return createScenario({
    ...(baseScenario ? cloneScenario(baseScenario) : {}),
    id: `scenario-prompt-${timestamp}`,
    name: plan.name || plan.summary || `${baseScenario?.name || 'Prompt'} scenario`,
    family: plan.family || baseScenario?.family || 'prompt-authored',
    description: plan.description || plan.summary || 'Scenario seeded from structured prompt authoring.',
    tags: Array.from(new Set([...(baseScenario?.tags || []), ...(plan.tags || []), 'prompt-authored'])),
    oddSlices: Array.from(new Set([...(baseScenario?.oddSlices || []), ...(plan.oddSlices || [])])),
    route: Array.isArray(plan.route) && plan.route.length > 0 ? plan.route : (baseScenario?.route || defaultRoute),
    actors: [...baseActors, ...promptActors],
    events: Array.isArray(plan.events) ? plan.events.map((event) => createEvent(event)) : (baseScenario?.events || []),
    variants: [
      createScenarioVariant({
        id: `variant-prompt-${timestamp}`,
        label: plan.variantLabel || 'Prompt-authored baseline',
        parameterSweep: plan.parameterSweep || [],
        triggerEdits: plan.triggerEdits || [],
        worldMutationSummary: plan.worldMutationSummary || 'Scenario created from structured prompt plan.',
        provenance: {
          evidenceType: EVIDENCE_TYPES.SIMULATED,
          sourceLabel: 'Prompt-authored scenario seed'
        }
      })
    ],
    provenance: {
      ...(baseScenario?.provenance || {}),
      sourceLabel: 'Prompt-authored scenario seed',
      evidenceType: EVIDENCE_TYPES.SIMULATED
    }
  });
}

export function createScenarioSeedFromReplayContext(replayContext = {}) {
  const segmentId = replayContext.segmentId || 'replay-seed';
  const scenarioName = replayContext.scenarioTitle || `Extracted replay ${segmentId}`;
  const route = Array.isArray(replayContext.egoTrajectory) && replayContext.egoTrajectory.length > 0
    ? replayContext.egoTrajectory.slice(0, 32).map((sample) => ({ x: Number(sample.x) || 0, y: Number(sample.y) || 0 }))
    : [
      { x: 0, y: 24 },
      { x: 0, y: 0 },
      { x: 0, y: -24 }
    ];
  const actors = [];

  actors.push(createActor({
    id: `actor-ego-${segmentId}`,
    label: 'Ego vehicle',
    actorType: ACTOR_TYPES.VEHICLE,
    tags: ['ego', 'observed'],
    spawnPose: route[0] ? { x: route[0].x, y: route[0].y, yawDeg: 180 } : { x: 0, y: 0, yawDeg: 180 },
    speedMps: Number(replayContext.measurements?.egoSpeedMps) || 0,
    behavior: {
      type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
      intent: replayContext.intentLabel || 'follow-route'
    },
    notes: 'Recovered from replay context.'
  }));

  if (replayContext.selectedObject) {
    actors.push(createActor({
      id: `actor-target-${segmentId}`,
      label: replayContext.selectedObject.label || 'Target actor',
      actorType: ACTOR_TYPES.VEHICLE,
      tags: ['recovered', 'selected-object'],
      spawnPose: {
        x: Number(replayContext.selectedObject.centerX) || 0,
        y: Number(replayContext.selectedObject.centerY) || 0,
        yawDeg: 0
      },
      speedMps: Number(replayContext.measurements?.relativeSpeedMps) || 0,
      behavior: {
        type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
        intent: 'recovered-from-log'
      },
      notes: 'Recovered from the selected replay object.'
    }));
  }

  return createScenario({
    id: `scenario-extracted-${segmentId}`,
    name: scenarioName,
    family: 'log-extraction',
    description: 'Scenario extracted from replay context. Preserve source linkage back to the observed log.',
    tags: ['extracted', 'replay', ...(replayContext.tags || [])],
    route,
    actors,
    events: replayContext.eventWindowSeconds
      ? [
        createEvent({
          title: 'Extracted replay window',
          type: 'replay-window',
          startTimeSeconds: Math.max(0, replayContext.eventWindowSeconds.start || 0),
          endTimeSeconds: Math.max(0, replayContext.eventWindowSeconds.end || 0),
          tags: ['extracted', 'replay']
        })
      ]
      : [],
    variants: [
      createScenarioVariant({
        id: `variant-extracted-${segmentId}`,
        label: 'Observed extraction',
        worldMutationSummary: 'Observed replay promoted into Scenario Studio.',
        provenance: {
          evidenceType: EVIDENCE_TYPES.OBSERVED,
          sourceLabel: 'Extracted from replay'
        }
      })
    ],
    provenance: {
      datasetAssetId: replayContext.datasetAssetId || '',
      logSessionId: replayContext.logSessionId || '',
      sourceLabel: `Extracted from replay segment ${segmentId}`,
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  });
}
