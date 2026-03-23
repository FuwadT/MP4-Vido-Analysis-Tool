import { ACTOR_TYPES, FINDING_SEVERITIES } from '../domain/models.js';

export const COPILOT_INTENT_TYPES = Object.freeze({
  SCENARIO_SEED: 'scenario-seed',
  LOG_SEARCH: 'log-search',
  SCENE_MUTATION: 'scene-mutation',
  VALIDATION_SUITE: 'validation-suite',
  COMPARE_RUNS: 'compare-runs',
  LAYOUT_PRESET: 'layout-preset',
  FINDING_CREATE: 'finding-create'
});

export const COPILOT_EXAMPLES = [
  'Create a near-miss cut-in scenario on an urban arterial at dusk.',
  'Find logs with aggressive cut-ins and brake interventions.',
  'Mutate this scene to heavy rain and move the pedestrian 1.5 seconds earlier.',
  'Compare stable vs candidate build on this scenario and show object-tracking regressions.',
  'Generate a validation suite for unprotected left turns in medium traffic.',
  'Create a high-severity finding from this replay for the late brake onset.'
];

const LAYOUT_KEYWORDS = [
  { match: /(replay triage|triage)/, layoutId: 'layout-triage' },
  { match: /(labeling|annotat)/, layoutId: 'layout-labeling' },
  { match: /(scenario editing|scenario studio|authoring)/, layoutId: 'layout-scenario-edit' },
  { match: /(validation)/, layoutId: 'layout-validation' },
  { match: /(compare|a\/b)/, layoutId: 'layout-compare' }
];

const BUILD_ALIASES = ['stable', 'candidate', 'debug', 'shadow'];
const MODEL_ALIASES = ['default', 'champion', 'challenger', 'experimental', 'world-model-v0'];

function normalizePrompt(prompt) {
  return String(prompt || '').trim().toLowerCase();
}

function extractFirstMatch(prompt, patterns) {
  return patterns.find((entry) => entry.match.test(prompt)) || null;
}

function collectTags(...values) {
  return Array.from(new Set(values.flat().filter(Boolean)));
}

function detectLighting(prompt) {
  if (/\b(dusk|sunset|golden hour)\b/.test(prompt)) return 'dusk';
  if (/\b(night|nighttime)\b/.test(prompt)) return 'night';
  if (/\b(dawn|sunrise)\b/.test(prompt)) return 'dawn';
  return 'daylight';
}

function detectWeather(prompt) {
  if (/\b(heavy rain|rain|wet)\b/.test(prompt)) return 'heavy-rain';
  if (/\b(fog|foggy)\b/.test(prompt)) return 'foggy';
  if (/\b(snow|snowy)\b/.test(prompt)) return 'snow';
  if (/\b(cloudy|overcast)\b/.test(prompt)) return 'overcast';
  return 'clear';
}

function detectTraffic(prompt) {
  if (/\b(heavy traffic|dense traffic)\b/.test(prompt)) return 'heavy-traffic';
  if (/\b(medium traffic|moderate traffic)\b/.test(prompt)) return 'medium-traffic';
  if (/\b(light traffic|sparse traffic)\b/.test(prompt)) return 'light-traffic';
  return 'mixed-traffic';
}

function detectManeuver(prompt) {
  if (/\b(cut-?in)\b/.test(prompt)) return 'vehicle-cut-in';
  if (/\b(unprotected left|left turn)\b/.test(prompt)) return 'unprotected-left';
  if (/\b(near-?miss)\b/.test(prompt)) return 'near-miss';
  if (/\b(pedestrian)\b/.test(prompt)) return 'pedestrian-crossing';
  if (/\b(cyclist)\b/.test(prompt)) return 'cyclist-interaction';
  if (/\b(brake|hard stop)\b/.test(prompt)) return 'braking-event';
  return 'general-driving';
}

function detectScenarioFamily(prompt) {
  const maneuver = detectManeuver(prompt);
  if (maneuver === 'vehicle-cut-in') return 'urban-cut-in';
  if (maneuver === 'unprotected-left') return 'unprotected-left';
  if (maneuver === 'pedestrian-crossing') return 'crosswalk-yield';
  return 'prompt-authored';
}

function detectSeverity(prompt) {
  if (/\bcritical\b/.test(prompt)) return FINDING_SEVERITIES.CRITICAL;
  if (/\bhigh\b/.test(prompt)) return FINDING_SEVERITIES.HIGH;
  if (/\blow\b/.test(prompt)) return FINDING_SEVERITIES.LOW;
  if (/\binfo\b/.test(prompt)) return FINDING_SEVERITIES.INFO;
  return FINDING_SEVERITIES.MEDIUM;
}

function detectBuildAlias(prompt, fallback = 'stable', preferCandidate = false) {
  const preferred = preferCandidate && prompt.includes('candidate') ? 'candidate' : null;
  if (preferred) {
    return preferred;
  }

  return BUILD_ALIASES.find((alias) => prompt.includes(alias)) || fallback;
}

function detectModelAlias(prompt, fallback = 'default', preferChallenger = false) {
  const preferred = preferChallenger && prompt.includes('challenger') ? 'challenger' : null;
  if (preferred) {
    return preferred;
  }

  return MODEL_ALIASES.find((alias) => prompt.includes(alias)) || fallback;
}

function detectRelativeSeconds(prompt) {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*seconds?/);
  return match ? Number(match[1]) : null;
}

function detectActorTemplates(prompt) {
  const actors = [];

  if (prompt.includes('pedestrian')) {
    actors.push({
      actorType: ACTOR_TYPES.PEDESTRIAN,
      label: 'Prompt pedestrian',
      intent: 'crossing',
      tags: ['pedestrian', 'prompt-authored']
    });
  }

  if (prompt.includes('cyclist')) {
    actors.push({
      actorType: ACTOR_TYPES.CYCLIST,
      label: 'Prompt cyclist',
      intent: 'merge',
      tags: ['cyclist', 'prompt-authored']
    });
  }

  if (prompt.includes('vehicle') || /\bcut-?in\b/.test(prompt)) {
    actors.push({
      actorType: ACTOR_TYPES.VEHICLE,
      label: /\bcut-?in\b/.test(prompt) ? 'Prompt cut-in vehicle' : 'Prompt vehicle',
      intent: /\bcut-?in\b/.test(prompt) ? 'cut-in' : 'follow-route',
      tags: ['vehicle', 'prompt-authored']
    });
  }

  if (/\b(cone|cones)\b/.test(prompt)) {
    actors.push({
      actorType: ACTOR_TYPES.CONE,
      label: 'Prompt cone',
      intent: 'static-obstacle',
      tags: ['cone', 'static', 'prompt-authored']
    });
  }

  if (/\b(barrier|signage|sign)\b/.test(prompt)) {
    actors.push({
      actorType: prompt.includes('barrier') ? ACTOR_TYPES.BARRIER : ACTOR_TYPES.SIGNAGE,
      label: prompt.includes('barrier') ? 'Prompt barrier' : 'Prompt signage',
      intent: 'static-obstacle',
      tags: ['static', 'prompt-authored']
    });
  }

  return actors;
}

function classifyIntent(prompt) {
  const scores = [
    {
      intentType: COPILOT_INTENT_TYPES.FINDING_CREATE,
      score: /\b(create|add|log|open)\b.*\bfinding\b/.test(prompt) || /\btriage\b/.test(prompt) ? 5 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.LOG_SEARCH,
      score: /\b(find|search|show)\b.*\b(log|logs|replay|dataset)\b/.test(prompt) ? 5 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.COMPARE_RUNS,
      score: /\b(compare|versus|vs\.?)\b/.test(prompt) ? 5 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.VALIDATION_SUITE,
      score: /\b(validation suite|test suite|suite)\b/.test(prompt) ? 5 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.LAYOUT_PRESET,
      score: /\b(layout|workspace|panel layout|triage view|validation view|compare view)\b/.test(prompt) ? 5 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.SCENE_MUTATION,
      score: /\b(mutate|move|earlier|later|change|set weather|set lighting|heavy rain)\b/.test(prompt) ? 4 : 0
    },
    {
      intentType: COPILOT_INTENT_TYPES.SCENARIO_SEED,
      score: /\b(create|generate|author|seed)\b.*\bscenario\b/.test(prompt) ? 4 : 1
    }
  ].sort((left, right) => right.score - left.score);

  return {
    intentType: scores[0]?.intentType || COPILOT_INTENT_TYPES.SCENARIO_SEED,
    confidence: Math.min(0.98, 0.45 + (scores[0]?.score || 0) * 0.1)
  };
}

function buildLogSearchPlan(prompt, context) {
  return {
    queryLabel: prompt,
    filters: {
      datasetAssetId: context.activeDatasetAssetId,
      maneuverClass: detectManeuver(prompt),
      lighting: detectLighting(prompt),
      weather: detectWeather(prompt),
      trafficDensity: detectTraffic(prompt),
      interventionType: prompt.includes('brake') ? 'brake-intervention' : 'review-all'
    },
    previewQuery: {
      metric: 'time_to_encroachment',
      comparator: '<',
      thresholdSeconds: prompt.includes('aggressive') ? 2.0 : 3.0
    },
    actions: [{ kind: 'navigate', nav: 'data-explorer' }]
  };
}

function buildScenarioSeedPlan(prompt, context) {
  const maneuver = detectManeuver(prompt);
  const lighting = detectLighting(prompt);
  const weather = detectWeather(prompt);
  const traffic = detectTraffic(prompt);

  return {
    name: `${maneuver.replace(/-/g, ' ')} scenario seed`,
    summary: prompt.trim(),
    description: `Prompt-authored scenario for ${maneuver} under ${weather} / ${lighting} conditions.`,
    family: detectScenarioFamily(prompt),
    tags: collectTags(maneuver, lighting, weather, traffic, 'prompt-authored'),
    oddSlices: collectTags(maneuver, lighting, weather, traffic),
    actors: detectActorTemplates(prompt),
    route: [],
    parameterSweep: [
      { key: 'weather', values: [weather] },
      { key: 'lighting', values: [lighting] },
      { key: 'trafficDensity', values: [traffic] }
    ],
    triggerEdits: [],
    worldMutationSummary: `Seeded from structured prompt plan for ${weather} / ${lighting}.`,
    variantLabel: 'Prompt-authored baseline',
    basedOnScenarioId: context.activeScenarioId,
    actions: [{ kind: 'create-scenario' }]
  };
}

function buildSceneMutationPlan(prompt, context) {
  const offsetSeconds = detectRelativeSeconds(prompt);

  return {
    targetScenarioId: context.activeScenarioId,
    summary: prompt.trim(),
    mutations: [
      { op: 'set-weather', value: detectWeather(prompt) },
      { op: 'set-lighting', value: detectLighting(prompt) }
    ],
    triggerEdits: offsetSeconds != null && prompt.includes('earlier')
      ? [`Advance referenced actor trigger by ${offsetSeconds.toFixed(1)} seconds`]
      : offsetSeconds != null && prompt.includes('later')
        ? [`Delay referenced actor trigger by ${offsetSeconds.toFixed(1)} seconds`]
        : [],
    parameterSweep: [],
    worldMutationSummary: 'Counterfactual mutation plan ready for variant creation.',
    actions: [{ kind: 'create-variant' }]
  };
}

function buildValidationSuitePlan(prompt, context) {
  const maneuver = detectManeuver(prompt);
  const lighting = detectLighting(prompt);
  const weather = detectWeather(prompt);
  const traffic = detectTraffic(prompt);

  return {
    suiteName: `${maneuver.replace(/-/g, ' ')} suite`,
    description: `Prompt-authored validation suite for ${maneuver} under ${traffic} and ${lighting} conditions.`,
    basedOnScenarioId: context.activeScenarioId,
    requirementIds: maneuver === 'unprotected-left' ? ['req-left-turn'] : ['req-urban-cut-in'],
    scenarioIds: context.activeScenarioId ? [context.activeScenarioId] : [],
    oddSlices: collectTags(maneuver, traffic, lighting, weather),
    metrics: ['collisionFree', 'minTtcSeconds', 'interventionCount'],
    passCriteria: ['collisionFree', 'minTtcSeconds', 'interventionCount'],
    parameterSweep: [
      { key: 'trafficDensity', values: ['light-traffic', 'medium-traffic', 'heavy-traffic'] },
      { key: 'weather', values: ['clear', weather] }
    ],
    runTemplate: {
      runType: 'regression',
      buildAlias: context.activeBuildAlias || 'stable',
      modelAlias: context.activeModelAlias || 'default'
    },
    actions: [{ kind: 'save-validation-suite' }, { kind: 'navigate', nav: 'validation' }]
  };
}

function buildComparePlan(prompt, context) {
  return {
    left: {
      buildAlias: detectBuildAlias(prompt, context.activeBuildAlias || 'stable', false),
      modelAlias: detectModelAlias(prompt, context.activeModelAlias || 'default', false)
    },
    right: {
      buildAlias: prompt.includes('candidate') ? 'candidate' : detectBuildAlias(prompt, 'candidate', true),
      modelAlias: prompt.includes('challenger') ? 'challenger' : detectModelAlias(prompt, 'challenger', true)
    },
    targetScenarioId: context.activeScenarioId,
    focus: prompt.includes('tracking') ? 'object-tracking-regressions' : 'run-diff',
    actions: [{ kind: 'compare-runs' }]
  };
}

function buildLayoutPlan(prompt) {
  const match = extractFirstMatch(prompt, LAYOUT_KEYWORDS);

  return {
    layoutId: match?.layoutId || 'layout-triage',
    reason: 'Prompt-selected task layout',
    actions: [{ kind: 'select-layout', layoutId: match?.layoutId || 'layout-triage' }]
  };
}

function buildFindingPlan(prompt, context) {
  const maneuver = detectManeuver(prompt);

  return {
    title: prompt.replace(/\b(create|add|log|open)\b/gi, '').replace(/\bfinding\b/gi, '').trim() || 'Replay finding',
    description: `Prompt-authored finding for ${maneuver}.`,
    severity: detectSeverity(prompt),
    tags: collectTags(maneuver, 'prompt-authored-finding'),
    linkedScenarioId: context.activeScenarioId,
    reviewHandoff: {
      owner: '',
      queue: 'triage',
      status: 'pending'
    },
    actions: [{ kind: 'create-finding' }, { kind: 'navigate', nav: 'validation' }]
  };
}

export function parseStudioPrompt(prompt, context = {}) {
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    return null;
  }

  const normalized = normalizePrompt(safePrompt);
  const { intentType, confidence } = classifyIntent(normalized);
  const base = {
    id: `plan-${Date.now()}`,
    parserVersion: 'v2',
    prompt: safePrompt,
    intentType,
    confidence,
    status: 'preview',
    createdAt: new Date().toISOString(),
    context: {
      activeScenarioId: context.activeScenarioId || '',
      activeDatasetAssetId: context.activeDatasetAssetId || '',
      activeBuildAlias: context.activeBuildAlias || 'stable',
      activeModelAlias: context.activeModelAlias || 'default'
    },
    slots: {
      maneuver: detectManeuver(normalized),
      lighting: detectLighting(normalized),
      weather: detectWeather(normalized),
      trafficDensity: detectTraffic(normalized),
      actorTemplates: detectActorTemplates(normalized).map((actor) => actor.actorType)
    }
  };

  switch (intentType) {
    case COPILOT_INTENT_TYPES.LOG_SEARCH:
      return { ...base, artifact: buildLogSearchPlan(normalized, context) };
    case COPILOT_INTENT_TYPES.SCENE_MUTATION:
      return { ...base, artifact: buildSceneMutationPlan(normalized, context) };
    case COPILOT_INTENT_TYPES.VALIDATION_SUITE:
      return { ...base, artifact: buildValidationSuitePlan(normalized, context) };
    case COPILOT_INTENT_TYPES.COMPARE_RUNS:
      return { ...base, artifact: buildComparePlan(normalized, context) };
    case COPILOT_INTENT_TYPES.LAYOUT_PRESET:
      return { ...base, artifact: buildLayoutPlan(normalized) };
    case COPILOT_INTENT_TYPES.FINDING_CREATE:
      return { ...base, artifact: buildFindingPlan(normalized, context) };
    default:
      return { ...base, artifact: buildScenarioSeedPlan(normalized, context) };
  }
}
