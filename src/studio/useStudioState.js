import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { COPILOT_EXAMPLES, parseStudioPrompt } from './copilot/intents';
import { buildCompareSummary } from './domain/compareRuns';
import { searchStudioResources } from './domain/commandPalette';
import {
  addRoutePoint,
  addScenarioEvent,
  createScenarioSeedFromPromptPlan,
  removeParameterSweep,
  removeRoutePoint,
  removeScenarioEvent,
  updateParameterSweep,
  updateRoutePoint
} from './domain/scenarioAuthoring';
import { createBookmark, createValidationSuite, summarizeCoverage } from './domain/models';
import { buildValidationSummary } from './domain/validation';
import {
  BUILD_PROFILES,
  COMPATIBILITY_MATRIX,
  DATASET_ASSETS,
  DATA_ADAPTERS,
  HONESTY_GUIDELINES,
  LOG_SESSIONS,
  MODEL_PROFILES,
  PLAYBACK_LAYOUTS,
  SCENARIOS,
  SENSOR_PROFILES,
  SENSOR_RIGS,
  STUDIO_NAV_ITEMS,
  VALIDATION_METRICS,
  VALIDATION_REQUIREMENTS,
  VALIDATION_RUNS
} from './data/seedData';
import {
  createBookmark as createBookmarkRequest,
  createScenarioVariant,
  createStudioFinding,
  createStudioRun,
  duplicateStudioScenario,
  extractScenarioFromReplay,
  getCompareSummary,
  getStudioBootstrap,
  getValidationReportHtmlUrl,
  saveStudioLayout,
  saveStudioScenario,
  saveValidationSuite,
  searchStudio,
  updateStudioLayout,
  updateStudioRun,
  updateStudioScenario
} from './api/studioApi';

const STORAGE_KEY = 'adas_simulation_studio_state_v2';

const FALLBACK_REGISTRIES = {
  navItems: STUDIO_NAV_ITEMS,
  datasetAssets: DATASET_ASSETS,
  logSessions: LOG_SESSIONS,
  buildProfiles: BUILD_PROFILES,
  modelProfiles: MODEL_PROFILES,
  sensorProfiles: SENSOR_PROFILES,
  sensorRigs: SENSOR_RIGS,
  validationRequirements: VALIDATION_REQUIREMENTS,
  validationMetrics: VALIDATION_METRICS,
  playbackLayouts: PLAYBACK_LAYOUTS,
  compatibilityMatrix: COMPATIBILITY_MATRIX,
  honestyGuidelines: HONESTY_GUIDELINES,
  dataAdapters: DATA_ADAPTERS,
  copilotExamples: COPILOT_EXAMPLES
};

function createDefaultState() {
  return {
    nav: 'home',
    explorerSurface: 'waymo',
    selectedDatasetAssetId: DATASET_ASSETS[0].id,
    selectedLogSessionId: LOG_SESSIONS[0].id,
    selectedScenarioId: SCENARIOS[0].id,
    selectedScenarioVariantId: SCENARIOS[0].variants[0]?.id || '',
    selectedActorId: SCENARIOS[0].actors[0]?.id || '',
    selectedBuildAlias: BUILD_PROFILES[0].alias,
    selectedModelAlias: MODEL_PROFILES[0].alias,
    selectedLayoutId: PLAYBACK_LAYOUTS[0].id,
    compareMode: false,
    compareLeftRunId: VALIDATION_RUNS[0]?.id || '',
    compareRightRunId: VALIDATION_RUNS[1]?.id || VALIDATION_RUNS[0]?.id || '',
    selectedRunId: VALIDATION_RUNS[0]?.id || '',
    selectedFindingId: '',
    scenarioLibrary: SCENARIOS,
    validationRuns: VALIDATION_RUNS,
    findings: [],
    bookmarks: [],
    savedLayouts: PLAYBACK_LAYOUTS,
    validationSuites: [
      createValidationSuite({
        id: 'suite-local-fallback',
        name: 'Local fallback suite',
        requirementIds: ['req-urban-cut-in'],
        scenarioIds: ['scenario-urban-cut-in']
      })
    ],
    promptDraft: COPILOT_EXAMPLES[0],
    lastStructuredPlan: null,
    quickOpenQuery: '',
    commandPaletteOpen: false,
    commandPaletteQuery: '',
    commandPaletteResults: [],
    activeSearchPlan: null,
    validationSuitePreview: null,
    compareSummary: null,
    replayContext: null,
    backendAvailable: false,
    isHydrated: false,
    lastSyncAt: null,
    backendError: ''
  };
}

function loadPersistedSelection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSelection(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nav: state.nav,
      explorerSurface: state.explorerSurface,
      selectedDatasetAssetId: state.selectedDatasetAssetId,
      selectedLogSessionId: state.selectedLogSessionId,
      selectedScenarioId: state.selectedScenarioId,
      selectedScenarioVariantId: state.selectedScenarioVariantId,
      selectedActorId: state.selectedActorId,
      selectedBuildAlias: state.selectedBuildAlias,
      selectedModelAlias: state.selectedModelAlias,
      selectedLayoutId: state.selectedLayoutId,
      compareMode: state.compareMode,
      compareLeftRunId: state.compareLeftRunId,
      compareRightRunId: state.compareRightRunId
    }));
  } catch {
    // Ignore local storage failures to keep the studio usable.
  }
}

function ensureSelectedIds(nextState) {
  const activeScenario = nextState.scenarioLibrary.find((scenario) => scenario.id === nextState.selectedScenarioId)
    || nextState.scenarioLibrary[0];
  const activeVariant = activeScenario?.variants?.find((variant) => variant.id === nextState.selectedScenarioVariantId)
    || activeScenario?.variants?.[0];
  const activeActor = activeScenario?.actors?.find((actor) => actor.id === nextState.selectedActorId)
    || activeScenario?.actors?.[0];
  const activeRun = nextState.validationRuns.find((run) => run.id === nextState.selectedRunId) || nextState.validationRuns[0];

  return {
    ...nextState,
    selectedScenarioId: activeScenario?.id || '',
    selectedScenarioVariantId: activeVariant?.id || '',
    selectedActorId: activeActor?.id || '',
    selectedRunId: activeRun?.id || '',
    compareLeftRunId: nextState.validationRuns.some((run) => run.id === nextState.compareLeftRunId)
      ? nextState.compareLeftRunId
      : nextState.validationRuns[0]?.id || '',
    compareRightRunId: nextState.validationRuns.some((run) => run.id === nextState.compareRightRunId)
      ? nextState.compareRightRunId
      : nextState.validationRuns[1]?.id || nextState.validationRuns[0]?.id || '',
    selectedLayoutId: nextState.savedLayouts.some((layout) => layout.id === nextState.selectedLayoutId)
      ? nextState.selectedLayoutId
      : nextState.savedLayouts[0]?.id || PLAYBACK_LAYOUTS[0]?.id || ''
  };
}

function findScenarioById(scenarios, scenarioId) {
  return scenarios.find((scenario) => scenario.id === scenarioId) || scenarios[0];
}

function buildCommandResources(registries, state) {
  return {
    datasetAssets: registries.datasetAssets,
    scenarios: state.scenarioLibrary,
    runs: state.validationRuns,
    findings: state.findings,
    layouts: state.savedLayouts,
    actions: [
      {
        id: 'action-data-explorer',
        label: 'Open Data Explorer',
        description: 'Inspect synchronized replay and create findings.',
        tags: ['navigation', 'replay'],
        action: { kind: 'navigate', nav: 'data-explorer' }
      },
      {
        id: 'action-scenario-studio',
        label: 'Open Scenario Studio',
        description: 'Edit actors, routes, triggers, and variants.',
        tags: ['navigation', 'scenario'],
        action: { kind: 'navigate', nav: 'scenario-studio' }
      },
      {
        id: 'action-validation',
        label: 'Open Validation',
        description: 'Inspect requirement traceability and export reports.',
        tags: ['navigation', 'validation'],
        action: { kind: 'navigate', nav: 'validation' }
      }
    ]
  };
}

function findRunByAliasPair(runs, buildAlias, modelAlias, scenarioId = '') {
  const scenarioMatched = runs.find((run) => (
    run.buildAlias === buildAlias
    && run.modelAlias === modelAlias
    && (!scenarioId || run.scenarioId === scenarioId)
  ));

  if (scenarioMatched) {
    return scenarioMatched;
  }

  return runs.find((run) => run.buildAlias === buildAlias && run.modelAlias === modelAlias) || runs[0] || null;
}

export function useStudioState() {
  const [registries, setRegistries] = useState(FALLBACK_REGISTRIES);
  const [state, setState] = useState(() => ensureSelectedIds({
    ...createDefaultState(),
    ...loadPersistedSelection()
  }));
  const deferredCommandQuery = useDeferredValue(state.commandPaletteQuery);

  useEffect(() => {
    persistSelection(state);
  }, [state]);

  const refreshFromBackend = useCallback(async () => {
    try {
      const bootstrap = await getStudioBootstrap();

      startTransition(() => {
        setRegistries((previous) => ({
          ...previous,
          ...(bootstrap.registries || {}),
          copilotExamples: COPILOT_EXAMPLES
        }));
        setState((previous) => ensureSelectedIds({
          ...previous,
          scenarioLibrary: bootstrap.studio?.scenarios || previous.scenarioLibrary,
          validationRuns: bootstrap.studio?.runs || previous.validationRuns,
          findings: bootstrap.studio?.findings || previous.findings,
          bookmarks: bootstrap.studio?.bookmarks || previous.bookmarks,
          savedLayouts: bootstrap.studio?.savedLayouts || previous.savedLayouts,
          validationSuites: bootstrap.studio?.validationSuites || previous.validationSuites,
          backendAvailable: true,
          isHydrated: true,
          lastSyncAt: new Date().toISOString(),
          backendError: ''
        }));
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        backendAvailable: false,
        isHydrated: true,
        backendError: error instanceof Error ? error.message : 'Studio backend unavailable.'
      }));
    }
  }, []);

  useEffect(() => {
    void refreshFromBackend();
  }, [refreshFromBackend]);

  useEffect(() => {
    const hasLiveRuns = state.validationRuns.some((run) => ['queued', 'preparing', 'running'].includes(run.status));
    if (!hasLiveRuns || !state.backendAvailable) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      void refreshFromBackend();
    }, 1200);

    return () => window.clearInterval(timerId);
  }, [refreshFromBackend, state.backendAvailable, state.validationRuns]);

  useEffect(() => {
    if (!state.compareLeftRunId || !state.compareRightRunId) {
      return undefined;
    }

    let cancelled = false;

    const refreshCompare = async () => {
      try {
        const payload = await getCompareSummary(state.compareLeftRunId, state.compareRightRunId);
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            compareSummary: payload.summary || null
          }));
        }
      } catch {
        if (!cancelled) {
          const leftRun = state.validationRuns.find((run) => run.id === state.compareLeftRunId);
          const rightRun = state.validationRuns.find((run) => run.id === state.compareRightRunId);
          setState((previous) => ({
            ...previous,
            compareSummary: buildCompareSummary(leftRun, rightRun)
          }));
        }
      }
    };

    void refreshCompare();

    return () => {
      cancelled = true;
    };
  }, [state.backendAvailable, state.compareLeftRunId, state.compareRightRunId, state.validationRuns]);

  useEffect(() => {
    if (!state.commandPaletteOpen) {
      return undefined;
    }

    let cancelled = false;

    const runSearch = async () => {
      try {
        const payload = await searchStudio(deferredCommandQuery);
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            commandPaletteResults: payload.results || []
          }));
        }
      } catch {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            commandPaletteResults: searchStudioResources(buildCommandResources(registries, previous), deferredCommandQuery)
          }));
        }
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredCommandQuery, registries, state.commandPaletteOpen]);

  const setNav = useCallback((nav) => {
    setState((previous) => ({ ...previous, nav }));
  }, []);

  const setExplorerSurface = useCallback((explorerSurface) => {
    setState((previous) => ({ ...previous, explorerSurface, nav: 'data-explorer' }));
  }, []);

  const updateSelection = useCallback((patch) => {
    setState((previous) => ensureSelectedIds({ ...previous, ...patch }));
  }, []);

  const selectScenario = useCallback((scenarioId) => {
    setState((previous) => ensureSelectedIds({
      ...previous,
      selectedScenarioId: scenarioId
    }));
  }, []);

  const selectActor = useCallback((actorId) => {
    setState((previous) => ({ ...previous, selectedActorId: actorId }));
  }, []);

  const persistScenario = useCallback(async (nextScenario) => {
    setState((previous) => ensureSelectedIds({
      ...previous,
      scenarioLibrary: previous.scenarioLibrary.map((scenario) => (
        scenario.id === nextScenario.id ? nextScenario : scenario
      ))
    }));
    await updateStudioScenario(nextScenario.id, nextScenario);
    await refreshFromBackend();
  }, [refreshFromBackend]);

  const updateActor = useCallback(async (actorId, patch) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const nextScenario = {
      ...scenario,
      actors: scenario.actors.map((actor) => (
        actor.id === actorId
          ? {
            ...actor,
            ...patch,
            behavior: {
              ...actor.behavior,
              ...(patch.behavior || {})
            }
          }
          : actor
      ))
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const addActor = useCallback(async (actorType = 'obstacle') => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const newId = `actor-${Date.now()}`;
    const nextActor = {
      id: newId,
      label: actorType === 'vehicle' ? 'Inserted vehicle' : `Inserted ${actorType}`,
      actorType,
      tags: ['operator-added'],
      dimensionsMeters: { length: 4.4, width: 1.9, height: 1.6 },
      spawnPose: { x: 10, y: -8, yawDeg: 0 },
      speedMps: actorType === 'vehicle' ? 6 : 0,
      visibility: 'observed',
      notes: 'Added in Scenario Studio.',
      behavior: {
        id: `behavior-${Date.now()}`,
        type: 'follow-route',
        speedProfileMps: actorType === 'vehicle' ? [6, 6, 6] : [0],
        routeId: '',
        triggerIds: [],
        intent: actorType === 'vehicle' ? 'maintain-lane' : 'static-obstacle',
        policyNotes: ''
      },
      track: {
        id: `track-${Date.now()}`,
        actorId: newId,
        source: 'observed',
        points: [],
        velocityProfile: [],
        confidence: 1,
        notes: ''
      },
      annotations: []
    };

    const nextScenario = {
      ...scenario,
      actors: [...scenario.actors, nextActor]
    };
    setState((previous) => ({ ...previous, selectedActorId: newId }));
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const removeActor = useCallback(async (actorId) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario || scenario.actors.length <= 1) {
      return;
    }

    const nextScenario = {
      ...scenario,
      actors: scenario.actors.filter((actor) => actor.id !== actorId)
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const addRouteWaypoint = useCallback(async () => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    await persistScenario(addRoutePoint(scenario, { x: 0, y: 0 }));
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const updateRouteWaypoint = useCallback(async (pointIndex, patch) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    await persistScenario(updateRoutePoint(scenario, pointIndex, patch));
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const removeRouteWaypoint = useCallback(async (pointIndex) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    await persistScenario(removeRoutePoint(scenario, pointIndex));
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const addEvent = useCallback(async () => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    await persistScenario(addScenarioEvent(scenario, {
      id: `event-${Date.now()}`,
      title: 'New event',
      type: 'trigger',
      startTimeSeconds: 0,
      endTimeSeconds: 1,
      severity: 'info',
      actorIds: [],
      tags: ['operator-authored']
    }));
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const updateEvent = useCallback(async (eventId, patch) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const nextScenario = {
      ...scenario,
      events: scenario.events.map((event) => (
        event.id === eventId ? { ...event, ...patch } : event
      ))
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const removeEvent = useCallback(async (eventId) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    await persistScenario(removeScenarioEvent(scenario, eventId));
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const updateVariantSweep = useCallback(async (variantId, sweepIndex, patch) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const nextScenario = {
      ...scenario,
      variants: scenario.variants.map((variant) => (
        variant.id === variantId ? updateParameterSweep(variant, sweepIndex, patch) : variant
      ))
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const addVariantSweep = useCallback(async (variantId) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const nextScenario = {
      ...scenario,
      variants: scenario.variants.map((variant) => (
        variant.id === variantId
          ? {
            ...variant,
            parameterSweep: [...(variant.parameterSweep || []), { key: 'parameter', values: ['value'] }]
          }
          : variant
      ))
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const removeVariantSweep = useCallback(async (variantId, sweepIndex) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    if (!scenario) {
      return;
    }

    const nextScenario = {
      ...scenario,
      variants: scenario.variants.map((variant) => (
        variant.id === variantId ? removeParameterSweep(variant, sweepIndex) : variant
      ))
    };
    await persistScenario(nextScenario);
  }, [persistScenario, state.scenarioLibrary, state.selectedScenarioId]);

  const duplicateVariant = useCallback(async () => {
    await createScenarioVariant(state.selectedScenarioId, {
      summary: `${state.selectedScenarioVariantId} copy`,
      worldMutationSummary: 'Duplicated scenario variant',
      parameterSweep: [],
      triggerEdits: []
    });
    await refreshFromBackend();
  }, [refreshFromBackend, state.selectedScenarioId, state.selectedScenarioVariantId]);

  const duplicateScenario = useCallback(async () => {
    await duplicateStudioScenario(state.selectedScenarioId);
    await refreshFromBackend();
  }, [refreshFromBackend, state.selectedScenarioId]);

  const createValidationSuiteAction = useCallback(async (payload) => {
    await saveValidationSuite(payload);
    await refreshFromBackend();
  }, [refreshFromBackend]);

  const createRun = useCallback(async (runType) => {
    const scenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    const variant = scenario?.variants?.find((item) => item.id === state.selectedScenarioVariantId) || scenario?.variants?.[0];

    await createStudioRun({
      runType,
      scenarioId: scenario?.id,
      scenarioVariantId: variant?.id,
      buildAlias: state.selectedBuildAlias,
      modelAlias: state.selectedModelAlias,
      label: `${state.selectedBuildAlias} / ${state.selectedModelAlias} / ${runType}`,
      oddSlices: scenario?.oddSlices || [],
      provenance: {
        datasetAssetId: state.selectedDatasetAssetId,
        logSessionId: state.selectedLogSessionId,
        scenarioId: scenario?.id,
        scenarioVersion: scenario?.scenarioVersion || 'v1',
        buildAlias: state.selectedBuildAlias,
        modelAlias: state.selectedModelAlias,
        sensorRigId: 'rig-waymo-research',
        validationPresetId: 'operator-created',
        sourceLabel: 'Studio-created run'
      },
      variantLabel: variant?.label
    });

    setState((previous) => ({ ...previous, nav: 'simulation-runs' }));
    await refreshFromBackend();
  }, [
    refreshFromBackend,
    state.scenarioLibrary,
    state.selectedBuildAlias,
    state.selectedDatasetAssetId,
    state.selectedLogSessionId,
    state.selectedModelAlias,
    state.selectedScenarioId,
    state.selectedScenarioVariantId
  ]);

  const cancelRun = useCallback(async (runId) => {
    await updateStudioRun(runId, { status: 'canceled' });
    await refreshFromBackend();
  }, [refreshFromBackend]);

  const setPromptDraft = useCallback((promptDraft) => {
    setState((previous) => ({ ...previous, promptDraft }));
  }, []);

  const previewPromptPlan = useCallback(() => {
    setState((previous) => ({
      ...previous,
      lastStructuredPlan: parseStudioPrompt(previous.promptDraft, {
        activeScenarioId: previous.selectedScenarioId,
        activeDatasetAssetId: previous.selectedDatasetAssetId,
        activeBuildAlias: previous.selectedBuildAlias,
        activeModelAlias: previous.selectedModelAlias
      })
    }));
  }, []);

  const setReplayContext = useCallback((replayContext) => {
    setState((previous) => ({
      ...previous,
      replayContext
    }));
  }, []);

  const createFindingFromReplay = useCallback(async (payload = {}) => {
    const replayContext = payload.replayContext || state.replayContext;
    if (!replayContext) {
      return;
    }

    await createStudioFinding({
      title: payload.title || replayContext.selectedObject?.label || 'Replay finding',
      description: payload.description || 'Created from replay context.',
      severity: payload.severity || 'medium',
      tags: payload.tags || replayContext.tags || [],
      linkedScenarioId: state.selectedScenarioId,
      linkedScenarioVariantId: state.selectedScenarioVariantId,
      evidence: {
        frameIndex: replayContext.frameIndex,
        timestampMicros: replayContext.timestampMicros,
        segmentId: replayContext.segmentId,
        cameraName: replayContext.cameraName,
        selectedObjectId: replayContext.selectedObject?.objectId || '',
        measurements: replayContext.measurements || {},
        notes: replayContext.notes || ''
      },
      provenance: replayContext.provenance
    });

    await refreshFromBackend();
  }, [refreshFromBackend, state.replayContext, state.selectedScenarioId, state.selectedScenarioVariantId]);

  const applyPromptPlan = useCallback(async () => {
    const plan = state.lastStructuredPlan;
    if (!plan) {
      return;
    }

    if (plan.intentType === 'log-search') {
      setState((previous) => ({
        ...previous,
        nav: 'data-explorer',
        activeSearchPlan: plan
      }));
      return;
    }

    if (plan.intentType === 'compare-runs') {
      const leftRun = findRunByAliasPair(
        state.validationRuns,
        plan.artifact.left?.buildAlias || state.selectedBuildAlias,
        plan.artifact.left?.modelAlias || state.selectedModelAlias,
        plan.artifact.targetScenarioId
      );
      const rightRun = findRunByAliasPair(
        state.validationRuns,
        plan.artifact.right?.buildAlias || 'candidate',
        plan.artifact.right?.modelAlias || 'challenger',
        plan.artifact.targetScenarioId
      );

      setState((previous) => ({
        ...previous,
        nav: 'simulation-runs',
        compareMode: true,
        compareLeftRunId: leftRun?.id || previous.compareLeftRunId,
        compareRightRunId: rightRun?.id || previous.compareRightRunId
      }));
      return;
    }

    if (plan.intentType === 'layout-preset') {
      setState((previous) => ({
        ...previous,
        selectedLayoutId: plan.artifact.layoutId || previous.selectedLayoutId
      }));
      return;
    }

    if (plan.intentType === 'validation-suite') {
      await createValidationSuiteAction({
        name: plan.artifact.suiteName,
        description: plan.artifact.description,
        requirementIds: plan.artifact.requirementIds,
        scenarioIds: plan.artifact.scenarioIds,
        oddSlices: plan.artifact.oddSlices,
        parameterSweep: plan.artifact.parameterSweep,
        passCriteria: plan.artifact.passCriteria,
        runTemplate: plan.artifact.runTemplate,
        provenance: {
          scenarioId: state.selectedScenarioId,
          buildAlias: state.selectedBuildAlias,
          modelAlias: state.selectedModelAlias,
          sourceLabel: 'Prompt-authored validation suite'
        }
      });
      setState((previous) => ({
        ...previous,
        nav: 'validation',
        validationSuitePreview: plan
      }));
      return;
    }

    if (plan.intentType === 'finding-create') {
      await createFindingFromReplay({
        title: plan.artifact.title,
        description: plan.artifact.description,
        severity: plan.artifact.severity,
        tags: plan.artifact.tags
      });
      setState((previous) => ({
        ...previous,
        nav: 'validation'
      }));
      return;
    }

    if (plan.intentType === 'scene-mutation') {
      await createScenarioVariant(state.selectedScenarioId, plan.artifact);
      setState((previous) => ({ ...previous, nav: 'scenario-studio' }));
      await refreshFromBackend();
      return;
    }

    const baseScenario = findScenarioById(state.scenarioLibrary, state.selectedScenarioId);
    const scenarioSeed = createScenarioSeedFromPromptPlan(plan.artifact, baseScenario);
    await saveStudioScenario(scenarioSeed);
    setState((previous) => ({
      ...previous,
      nav: 'scenario-studio',
      selectedScenarioId: scenarioSeed.id
    }));
    await refreshFromBackend();
  }, [
    createFindingFromReplay,
    createValidationSuiteAction,
    refreshFromBackend,
    state.lastStructuredPlan,
    state.scenarioLibrary,
    state.selectedBuildAlias,
    state.selectedModelAlias,
    state.selectedScenarioId,
    state.validationRuns
  ]);

  const createReplayBookmark = useCallback(async (note = '') => {
    if (!state.replayContext) {
      return;
    }

    await createBookmarkRequest({
      ...createBookmark({
        title: state.replayContext.selectedObject?.label || `Bookmark frame ${state.replayContext.frameIndex + 1}`,
        note,
        frameIndex: state.replayContext.frameIndex,
        timestampMicros: state.replayContext.timestampMicros,
        segmentId: state.replayContext.segmentId,
        scenarioId: state.selectedScenarioId,
        cameraName: state.replayContext.cameraName,
        provenance: state.replayContext.provenance
      })
    });

    await refreshFromBackend();
  }, [refreshFromBackend, state.replayContext, state.selectedScenarioId]);

  const promoteReplayToScenario = useCallback(async () => {
    if (!state.replayContext) {
      return;
    }

    await extractScenarioFromReplay({
      ...state.replayContext,
      datasetAssetId: state.selectedDatasetAssetId,
      logSessionId: state.selectedLogSessionId
    });
    setState((previous) => ({ ...previous, nav: 'scenario-studio' }));
    await refreshFromBackend();
  }, [refreshFromBackend, state.replayContext, state.selectedDatasetAssetId, state.selectedLogSessionId]);

  const openCommandPalette = useCallback((initialQuery = '') => {
    setState((previous) => ({
      ...previous,
      commandPaletteOpen: true,
      commandPaletteQuery: initialQuery,
      commandPaletteResults: searchStudioResources(buildCommandResources(registries, previous), initialQuery)
    }));
  }, [registries]);

  const closeCommandPalette = useCallback(() => {
    setState((previous) => ({
      ...previous,
      commandPaletteOpen: false,
      commandPaletteQuery: ''
    }));
  }, []);

  const setCommandPaletteQuery = useCallback((commandPaletteQuery) => {
    setState((previous) => ({
      ...previous,
      commandPaletteQuery
    }));
  }, []);

  const executeCommand = useCallback((command) => {
    const action = command?.action || {};

    if (action.kind === 'navigate') {
      setNav(action.nav);
    } else if (action.kind === 'open-scenario') {
      selectScenario(action.id);
      setNav('scenario-studio');
    } else if (action.kind === 'open-run') {
      setState((previous) => ({
        ...previous,
        selectedRunId: action.id,
        nav: 'simulation-runs'
      }));
    } else if (action.kind === 'open-finding') {
      setState((previous) => ({
        ...previous,
        selectedFindingId: action.id,
        nav: 'validation'
      }));
    } else if (action.kind === 'select-layout') {
      setState((previous) => ({
        ...previous,
        selectedLayoutId: action.id
      }));
    } else if (action.kind === 'open-dataset') {
      setState((previous) => ({
        ...previous,
        selectedDatasetAssetId: action.id,
        nav: 'data-explorer'
      }));
    }

    closeCommandPalette();
  }, [closeCommandPalette, selectScenario, setNav]);

  const saveCurrentLayout = useCallback(async (name, description = '') => {
    const currentLayout = state.savedLayouts.find((layout) => layout.id === state.selectedLayoutId)
      || PLAYBACK_LAYOUTS.find((layout) => layout.id === state.selectedLayoutId)
      || PLAYBACK_LAYOUTS[0];

    await saveStudioLayout({
      ...currentLayout,
      id: `layout-${Date.now()}`,
      name,
      description,
      isPreset: false
    });
    await refreshFromBackend();
  }, [refreshFromBackend, state.savedLayouts, state.selectedLayoutId]);

  const duplicateCurrentLayout = useCallback(async () => {
    const currentLayout = state.savedLayouts.find((layout) => layout.id === state.selectedLayoutId)
      || PLAYBACK_LAYOUTS.find((layout) => layout.id === state.selectedLayoutId);

    if (!currentLayout) {
      return;
    }

    await saveStudioLayout({
      ...currentLayout,
      id: `layout-${Date.now()}`,
      name: `${currentLayout.name} copy`,
      isPreset: false
    });
    await refreshFromBackend();
  }, [refreshFromBackend, state.savedLayouts, state.selectedLayoutId]);

  const resetLayoutToPreset = useCallback(async () => {
    const preset = PLAYBACK_LAYOUTS.find((layout) => layout.id === state.selectedLayoutId);
    if (!preset) {
      return;
    }

    await updateStudioLayout(state.selectedLayoutId, {
      ...preset,
      isPreset: true
    });
    await refreshFromBackend();
  }, [refreshFromBackend, state.selectedLayoutId]);

  const reorderLayoutPanels = useCallback(async (layoutId, panelOrder) => {
    await updateStudioLayout(layoutId, { panelOrder });
    await refreshFromBackend();
  }, [refreshFromBackend]);

  const exportValidationReport = useCallback(() => {
    window.open(getValidationReportHtmlUrl(), '_blank', 'noopener,noreferrer');
  }, []);

  const derived = useMemo(() => {
    const activeDatasetAsset = registries.datasetAssets.find((item) => item.id === state.selectedDatasetAssetId) || registries.datasetAssets[0];
    const activeLogSession = registries.logSessions.find((item) => item.id === state.selectedLogSessionId) || registries.logSessions[0];
    const activeScenario = state.scenarioLibrary.find((item) => item.id === state.selectedScenarioId) || state.scenarioLibrary[0];
    const activeVariant = activeScenario?.variants?.find((item) => item.id === state.selectedScenarioVariantId) || activeScenario?.variants?.[0];
    const activeActor = activeScenario?.actors?.find((item) => item.id === state.selectedActorId) || activeScenario?.actors?.[0];
    const activeBuild = registries.buildProfiles.find((item) => item.alias === state.selectedBuildAlias) || registries.buildProfiles[0];
    const activeModel = registries.modelProfiles.find((item) => item.alias === state.selectedModelAlias) || registries.modelProfiles[0];
    const activeLayout = state.savedLayouts.find((item) => item.id === state.selectedLayoutId)
      || registries.playbackLayouts.find((item) => item.id === state.selectedLayoutId)
      || registries.playbackLayouts[0];
    const selectedRun = state.validationRuns.find((run) => run.id === state.selectedRunId) || state.validationRuns[0];
    const leftRun = state.validationRuns.find((run) => run.id === state.compareLeftRunId) || state.validationRuns[0];
    const rightRun = state.validationRuns.find((run) => run.id === state.compareRightRunId) || state.validationRuns[1] || state.validationRuns[0];
    const validationSummary = buildValidationSummary({
      runs: state.validationRuns,
      requirements: registries.validationRequirements,
      metrics: registries.validationMetrics,
      findings: state.findings
    });
    const mergedFindings = [
      ...state.findings,
      ...state.validationRuns.flatMap((run) => (run.findings || []).map((finding) => ({
        ...finding,
        runLabel: run.label,
        linkedRunId: run.id,
        linkedScenarioId: run.scenarioId,
        linkedScenarioVariantId: run.scenarioVariantId
      })))
    ];
    const validationFindings = Array.from(
      new Map(mergedFindings.map((finding) => [`${finding.id}:${finding.linkedRunId || 'replay'}`, finding])).values()
    );

    return {
      activeDatasetAsset,
      activeLogSession,
      activeScenario,
      activeVariant,
      activeActor,
      activeBuild,
      activeModel,
      activeLayout,
      selectedRun,
      leftRun,
      rightRun,
      compareSummary: state.compareSummary || buildCompareSummary(leftRun, rightRun),
      coverage: summarizeCoverage(state.validationRuns),
      validationSummary,
      validationFindings,
      availableVariants: activeScenario?.variants || []
    };
  }, [registries, state]);

  return {
    state,
    derived,
    registries: {
      ...registries,
      copilotExamples: COPILOT_EXAMPLES
    },
    actions: {
      setNav,
      setExplorerSurface,
      updateSelection,
      selectScenario,
      selectActor,
      updateActor,
      addActor,
      removeActor,
      addRouteWaypoint,
      updateRouteWaypoint,
      removeRouteWaypoint,
      addEvent,
      updateEvent,
      removeEvent,
      addVariantSweep,
      updateVariantSweep,
      removeVariantSweep,
      duplicateVariant,
      duplicateScenario,
      createValidationSuiteAction,
      createRun,
      cancelRun,
      setPromptDraft,
      previewPromptPlan,
      applyPromptPlan,
      setReplayContext,
      createFindingFromReplay,
      createReplayBookmark,
      promoteReplayToScenario,
      openCommandPalette,
      closeCommandPalette,
      setCommandPaletteQuery,
      executeCommand,
      saveCurrentLayout,
      duplicateCurrentLayout,
      resetLayoutToPreset,
      reorderLayoutPanels,
      exportValidationReport,
      refreshFromBackend
    }
  };
}
