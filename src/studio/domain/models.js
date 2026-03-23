const TIMESTAMP_PREFIX = 'adas';

let localIdCounter = 0;

function createId(prefix) {
  localIdCounter += 1;
  return `${prefix}-${TIMESTAMP_PREFIX}-${localIdCounter}`;
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value, fallback = 'item') {
  const normalized = String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export const EVIDENCE_TYPES = Object.freeze({
  OBSERVED: 'observed',
  SIMULATED: 'simulated',
  GENERATED: 'generated'
});

export const ACTOR_TYPES = Object.freeze({
  VEHICLE: 'vehicle',
  PEDESTRIAN: 'pedestrian',
  CYCLIST: 'cyclist',
  ANIMAL: 'animal',
  OBSTACLE: 'obstacle',
  CONE: 'cone',
  BARRIER: 'barrier',
  SIGNAGE: 'signage',
  UNKNOWN: 'unknown'
});

export const ACTOR_BEHAVIORS = Object.freeze({
  FOLLOW_ROUTE: 'follow-route',
  CUT_IN: 'cut-in',
  CROSSING: 'crossing',
  YIELDING: 'yielding',
  STOPPED: 'stopped',
  PARKED: 'parked',
  STATIC: 'static'
});

export const RUN_TYPES = Object.freeze({
  REGRESSION: 'regression',
  EXPLORATORY: 'exploratory',
  HYPOTHESIS: 'world-model-hypothesis'
});

export const RUN_STATUSES = Object.freeze({
  QUEUED: 'queued',
  PREPARING: 'preparing',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
  PASSED: 'passed',
  IN_REVIEW: 'in-review'
});

export const FINDING_SEVERITIES = Object.freeze({
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
});

export const PANEL_TYPES = Object.freeze({
  SCENE_3D: 'scene-3d',
  IMAGE: 'image',
  POINT_CLOUD: 'point-cloud',
  TIMELINE: 'timeline',
  PLOT: 'plot',
  RAW_MESSAGES: 'raw-messages',
  TABLE: 'table',
  MAP: 'map',
  STATE_TRANSITIONS: 'state-transitions',
  DIAGNOSTICS: 'diagnostics',
  ANNOTATIONS: 'annotations',
  SCENARIO_GRAPH: 'scenario-graph',
  VALIDATION: 'validation-findings',
  COMPARE: 'compare-diff'
});

export const SENSOR_TYPES = Object.freeze({
  CAMERA: 'camera',
  LIDAR: 'lidar',
  RADAR: 'radar',
  IMU: 'imu',
  GNSS: 'gnss',
  CAN: 'can'
});

export const INTEROP_TARGETS = Object.freeze({
  MCAP: 'mcap',
  OPENSCENARIO: 'openscenario',
  OPENDRIVE: 'opendrive',
  TFRECORD: 'tfrecord',
  PARQUET: 'parquet',
  MP4: 'mp4',
  ROSBAG: 'rosbag'
});

export function createProvenance(overrides = {}) {
  const evidenceType = overrides.evidenceType || EVIDENCE_TYPES.OBSERVED;

  return {
    id: overrides.id || createId('prov'),
    datasetAssetId: overrides.datasetAssetId || '',
    logSessionId: overrides.logSessionId || '',
    scenarioId: overrides.scenarioId || '',
    scenarioVersion: overrides.scenarioVersion || 'v1',
    buildAlias: overrides.buildAlias || 'stable',
    buildVersion: overrides.buildVersion || '2026.03.22.1',
    modelAlias: overrides.modelAlias || 'default',
    modelVersion: overrides.modelVersion || '2026.03.22.1',
    sensorRigId: overrides.sensorRigId || '',
    validationPresetId: overrides.validationPresetId || 'baseline',
    sourceLabel: overrides.sourceLabel || 'Observed log replay',
    evidenceType,
    honestyLabel:
      overrides.honestyLabel
      || (evidenceType === EVIDENCE_TYPES.OBSERVED
        ? 'Observed-from-log evidence'
        : evidenceType === EVIDENCE_TYPES.SIMULATED
          ? 'Physics-simulated counterfactual'
          : 'Generated hypothesis'),
    uncertaintySummary:
      overrides.uncertaintySummary
      || (evidenceType === EVIDENCE_TYPES.GENERATED
        ? 'Generated or inferred regions must not be treated as audited ground truth.'
        : evidenceType === EVIDENCE_TYPES.SIMULATED
          ? 'Counterfactual trajectory and actor motion derive from simulation assumptions.'
          : 'Observed sensor payload with direct provenance to the recorded log.'),
    createdAt: overrides.createdAt || nowIso(),
    notes: overrides.notes || ''
  };
}

export function createDatasetAsset(overrides = {}) {
  return {
    id: overrides.id || createId('asset'),
    name: overrides.name || 'Dataset asset',
    assetType: overrides.assetType || 'multimodal-log',
    sourceType: overrides.sourceType || INTEROP_TARGETS.PARQUET,
    sourceUri: overrides.sourceUri || '',
    split: overrides.split || 'training',
    modalitySummary: overrides.modalitySummary || ['camera', 'lidar', 'pose'],
    segmentCount: overrides.segmentCount ?? 1,
    tags: overrides.tags || [],
    description: overrides.description || '',
    provenance: createProvenance(overrides.provenance)
  };
}

export function createLogSession(overrides = {}) {
  return {
    id: overrides.id || createId('log'),
    datasetAssetId: overrides.datasetAssetId || '',
    label: overrides.label || 'Log session',
    scenarioFamily: overrides.scenarioFamily || 'urban-interaction',
    durationSeconds: overrides.durationSeconds ?? 20,
    routeLabel: overrides.routeLabel || 'Unknown route',
    locationLabel: overrides.locationLabel || 'Unknown city',
    sourceFormat: overrides.sourceFormat || INTEROP_TARGETS.PARQUET,
    availableModalities: overrides.availableModalities || ['camera', 'lidar', 'pose'],
    tags: overrides.tags || [],
    eventSummary: overrides.eventSummary || [],
    provenance: createProvenance(overrides.provenance)
  };
}

export function createRoadNetwork(overrides = {}) {
  return {
    id: overrides.id || createId('road'),
    name: overrides.name || 'Road network',
    sourceType: overrides.sourceType || INTEROP_TARGETS.OPENDRIVE,
    laneCount: overrides.laneCount ?? 2,
    routeLengthMeters: overrides.routeLengthMeters ?? 1200,
    boundingBox: overrides.boundingBox || { minX: -80, maxX: 80, minY: -120, maxY: 120 },
    notes: overrides.notes || ''
  };
}

export function createSensorProfile(overrides = {}) {
  return {
    id: overrides.id || createId('sensor-profile'),
    name: overrides.name || 'Sensor profile',
    sensorType: overrides.sensorType || SENSOR_TYPES.LIDAR,
    manufacturer: overrides.manufacturer || 'Generic',
    maxRangeMeters: overrides.maxRangeMeters ?? 100,
    verticalFieldOfViewDeg: overrides.verticalFieldOfViewDeg ?? 45,
    horizontalFieldOfViewDeg: overrides.horizontalFieldOfViewDeg ?? 360,
    channels: overrides.channels ?? 128,
    pointsPerSecond: overrides.pointsPerSecond ?? 1_000_000,
    frameRatesHz: overrides.frameRatesHz || [10],
    returnModes: overrides.returnModes || ['single-return'],
    intrinsics: overrides.intrinsics || {},
    extrinsics: overrides.extrinsics || {},
    noiseModel: overrides.noiseModel || 'baseline',
    timingModel: overrides.timingModel || 'rolling',
    calibrationNotes: overrides.calibrationNotes || ''
  };
}

export function createSensorRig(overrides = {}) {
  return {
    id: overrides.id || createId('sensor-rig'),
    name: overrides.name || 'Sensor rig',
    hardwareClass: overrides.hardwareClass || 'research-vehicle',
    sensorProfileIds: overrides.sensorProfileIds || [],
    sensors: overrides.sensors || [],
    supportsGeneratedOutputs: overrides.supportsGeneratedOutputs ?? false,
    notes: overrides.notes || ''
  };
}

export function createTrack(overrides = {}) {
  return {
    id: overrides.id || createId('track'),
    actorId: overrides.actorId || '',
    source: overrides.source || EVIDENCE_TYPES.OBSERVED,
    points: overrides.points || [],
    velocityProfile: overrides.velocityProfile || [],
    confidence: overrides.confidence ?? 1,
    notes: overrides.notes || ''
  };
}

export function createTag(overrides = {}) {
  return {
    id: overrides.id || createId('tag'),
    label: overrides.label || 'tag',
    group: overrides.group || 'general',
    color: overrides.color || 'slate',
    description: overrides.description || ''
  };
}

export function createAnnotation(overrides = {}) {
  return {
    id: overrides.id || createId('annotation'),
    actorId: overrides.actorId || '',
    label: overrides.label || 'annotation',
    source: overrides.source || EVIDENCE_TYPES.OBSERVED,
    confidence: overrides.confidence ?? 1,
    observed: overrides.observed ?? true,
    notes: overrides.notes || '',
    tags: overrides.tags || []
  };
}

export function createEvent(overrides = {}) {
  return {
    id: overrides.id || createId('event'),
    type: overrides.type || 'maneuver',
    title: overrides.title || 'Scenario event',
    startTimeSeconds: overrides.startTimeSeconds ?? 0,
    endTimeSeconds: overrides.endTimeSeconds ?? overrides.startTimeSeconds ?? 0,
    severity: overrides.severity || 'info',
    actorIds: overrides.actorIds || [],
    tags: overrides.tags || [],
    notes: overrides.notes || ''
  };
}

export function createActorBehavior(overrides = {}) {
  return {
    id: overrides.id || createId('behavior'),
    type: overrides.type || ACTOR_BEHAVIORS.FOLLOW_ROUTE,
    speedProfileMps: overrides.speedProfileMps || [0, 7, 11],
    routeId: overrides.routeId || '',
    triggerIds: overrides.triggerIds || [],
    intent: overrides.intent || 'maintain-lane',
    policyNotes: overrides.policyNotes || ''
  };
}

export function createActor(overrides = {}) {
  const label = overrides.label || 'Actor';
  const actorType = overrides.actorType || ACTOR_TYPES.VEHICLE;

  return {
    id: overrides.id || createId('actor'),
    label,
    actorType,
    tags: overrides.tags || [],
    dimensionsMeters: overrides.dimensionsMeters || { length: 4.4, width: 1.9, height: 1.6 },
    spawnPose: overrides.spawnPose || { x: 0, y: 0, yawDeg: 0 },
    speedMps: overrides.speedMps ?? 0,
    visibility: overrides.visibility || 'observed',
    notes: overrides.notes || '',
    behavior: createActorBehavior(overrides.behavior),
    track: createTrack({
      actorId: overrides.id || slugify(label, actorType),
      ...(overrides.track || {})
    }),
    annotations: overrides.annotations || []
  };
}

export function createScenarioVariant(overrides = {}) {
  return {
    id: overrides.id || createId('scenario-variant'),
    label: overrides.label || 'Scenario variant',
    scenarioId: overrides.scenarioId || '',
    parameterSweep: overrides.parameterSweep || [],
    triggerEdits: overrides.triggerEdits || [],
    worldMutationSummary: overrides.worldMutationSummary || '',
    provenance: createProvenance(overrides.provenance)
  };
}

export function createScenario(overrides = {}) {
  const label = overrides.name || 'Scenario';
  const id = overrides.id || createId('scenario');

  return {
    id,
    name: label,
    family: overrides.family || slugify(label, 'scenario-family'),
    description: overrides.description || '',
    roadNetwork: createRoadNetwork(overrides.roadNetwork),
    actors: (overrides.actors || []).map(actor => createActor(actor)),
    events: (overrides.events || []).map(event => createEvent(event)),
    tracks: (overrides.tracks || []).map(track => createTrack(track)),
    annotations: (overrides.annotations || []).map(annotation => createAnnotation(annotation)),
    tags: overrides.tags || [],
    oddSlices: overrides.oddSlices || [],
    route: overrides.route || [],
    scenarioVersion: overrides.scenarioVersion || 'v1',
    variants: (overrides.variants || []).map(variant => createScenarioVariant({ scenarioId: id, ...variant })),
    provenance: createProvenance({ scenarioId: id, ...(overrides.provenance || {}) })
  };
}

export function createValidationRequirement(overrides = {}) {
  return {
    id: overrides.id || createId('requirement'),
    code: overrides.code || 'REQ-000',
    title: overrides.title || 'Validation requirement',
    description: overrides.description || '',
    oddSlices: overrides.oddSlices || [],
    linkedScenarioIds: overrides.linkedScenarioIds || [],
    linkedMetricIds: overrides.linkedMetricIds || [],
    status: overrides.status || 'draft'
  };
}

export function createValidationMetric(overrides = {}) {
  return {
    id: overrides.id || createId('metric'),
    key: overrides.key || 'metric-key',
    title: overrides.title || 'Validation metric',
    unit: overrides.unit || 'score',
    passDirection: overrides.passDirection || 'max',
    passThreshold: overrides.passThreshold ?? 1,
    source: overrides.source || 'observer',
    description: overrides.description || ''
  };
}

export function createValidationRun(overrides = {}) {
  return {
    id: overrides.id || createId('run'),
    label: overrides.label || 'Validation run',
    runType: overrides.runType || RUN_TYPES.EXPLORATORY,
    scenarioId: overrides.scenarioId || '',
    scenarioVariantId: overrides.scenarioVariantId || '',
    buildAlias: overrides.buildAlias || 'stable',
    modelAlias: overrides.modelAlias || 'default',
    status: overrides.status || RUN_STATUSES.COMPLETED,
    startedAt: overrides.startedAt || nowIso(),
    durationSeconds: overrides.durationSeconds ?? 0,
    metrics: overrides.metrics || {},
    findings: overrides.findings || [],
    oddSlices: overrides.oddSlices || [],
    artifacts: overrides.artifacts || {
      summary: null,
      evidence: [],
      rawMessages: [],
      report: null
    },
    execution: overrides.execution || {
      queuedAt: overrides.queuedAt || nowIso(),
      preparingAt: overrides.preparingAt || null,
      runningAt: overrides.runningAt || null,
      completedAt: overrides.completedAt || null,
      failedAt: overrides.failedAt || null,
      canceledAt: overrides.canceledAt || null,
      error: overrides.error || ''
    },
    provenance: createProvenance(overrides.provenance)
  };
}

export function createFinding(overrides = {}) {
  return {
    id: overrides.id || createId('finding'),
    severity: overrides.severity || FINDING_SEVERITIES.MEDIUM,
    title: overrides.title || 'Operator finding',
    description: overrides.description || '',
    type: overrides.type || 'operator-review',
    status: overrides.status || 'new',
    tags: overrides.tags || [],
    assignee: overrides.assignee || '',
    reviewHandoff: overrides.reviewHandoff || {
      owner: '',
      queue: 'triage',
      status: 'pending'
    },
    evidence: overrides.evidence || {
      frameIndex: null,
      timestampMicros: null,
      segmentId: '',
      cameraName: '',
      selectedObjectId: '',
      measurements: {},
      notes: ''
    },
    linkedRunId: overrides.linkedRunId || '',
    linkedScenarioId: overrides.linkedScenarioId || '',
    linkedScenarioVariantId: overrides.linkedScenarioVariantId || '',
    createdAt: overrides.createdAt || nowIso(),
    updatedAt: overrides.updatedAt || nowIso(),
    provenance: createProvenance(overrides.provenance)
  };
}

export function createBookmark(overrides = {}) {
  return {
    id: overrides.id || createId('bookmark'),
    title: overrides.title || 'Replay bookmark',
    note: overrides.note || '',
    tags: overrides.tags || [],
    frameIndex: overrides.frameIndex ?? 0,
    timestampMicros: overrides.timestampMicros ?? null,
    segmentId: overrides.segmentId || '',
    scenarioId: overrides.scenarioId || '',
    cameraName: overrides.cameraName || '',
    createdAt: overrides.createdAt || nowIso(),
    provenance: createProvenance(overrides.provenance)
  };
}

export function createValidationSuite(overrides = {}) {
  return {
    id: overrides.id || createId('suite'),
    name: overrides.name || 'Validation suite',
    description: overrides.description || '',
    requirementIds: overrides.requirementIds || [],
    scenarioIds: overrides.scenarioIds || [],
    variantIds: overrides.variantIds || [],
    runTemplate: overrides.runTemplate || {
      runType: RUN_TYPES.REGRESSION,
      buildAlias: 'stable',
      modelAlias: 'default'
    },
    parameterSweep: overrides.parameterSweep || [],
    oddSlices: overrides.oddSlices || [],
    passCriteria: overrides.passCriteria || [],
    createdAt: overrides.createdAt || nowIso(),
    provenance: createProvenance(overrides.provenance)
  };
}

export function createBuildProfile(overrides = {}) {
  return {
    id: overrides.id || createId('build'),
    alias: overrides.alias || 'stable',
    version: overrides.version || '2026.03.22.1',
    branch: overrides.branch || 'codex/adas-studio-foundation',
    description: overrides.description || '',
    targetStacks: overrides.targetStacks || ['replay'],
    sensorRigIds: overrides.sensorRigIds || [],
    notes: overrides.notes || ''
  };
}

export function createModelProfile(overrides = {}) {
  return {
    id: overrides.id || createId('model'),
    alias: overrides.alias || 'default',
    version: overrides.version || '2026.03.22.1',
    family: overrides.family || 'perception-stack',
    servingContract: overrides.servingContract || 'triton-compatible',
    supportsWorldMutation: overrides.supportsWorldMutation ?? false,
    supportsSensorGeneration: overrides.supportsSensorGeneration ?? false,
    notes: overrides.notes || ''
  };
}

export function createPlaybackLayout(overrides = {}) {
  return {
    id: overrides.id || createId('layout'),
    name: overrides.name || 'Layout preset',
    description: overrides.description || '',
    panelTypes: overrides.panelTypes || [],
    gridClassName: overrides.gridClassName || 'grid-cols-1 xl:grid-cols-12',
    slots: overrides.slots || {},
    optimizedFor: overrides.optimizedFor || 'triage'
  };
}

export function createWorldModelRequest(overrides = {}) {
  return {
    id: overrides.id || createId('wm-request'),
    seedObservations: overrides.seedObservations || [],
    roadConstraints: overrides.roadConstraints || {},
    actorConstraints: overrides.actorConstraints || [],
    egoRoute: overrides.egoRoute || [],
    drivingActionControl: overrides.drivingActionControl || [],
    languageInstructions: overrides.languageInstructions || '',
    sensorRigId: overrides.sensorRigId || '',
    requestedOutputs: overrides.requestedOutputs || ['camera', 'lidar'],
    provenance: createProvenance({
      evidenceType: EVIDENCE_TYPES.GENERATED,
      sourceLabel: 'World-model request',
      ...(overrides.provenance || {})
    })
  };
}

export function createWorldModelOutput(overrides = {}) {
  return {
    id: overrides.id || createId('wm-output'),
    requestId: overrides.requestId || '',
    status: overrides.status || 'stub',
    cameraStreams: overrides.cameraStreams || [],
    lidarFrames: overrides.lidarFrames || [],
    occupancyProducts: overrides.occupancyProducts || [],
    confidenceMasks: overrides.confidenceMasks || [],
    observedCoverageRatio: overrides.observedCoverageRatio ?? 0,
    inferredCoverageRatio: overrides.inferredCoverageRatio ?? 1,
    provenance: createProvenance({
      evidenceType: EVIDENCE_TYPES.GENERATED,
      sourceLabel: 'World-model hypothesis',
      ...(overrides.provenance || {})
    })
  };
}

export function createBuildModelCompatibility(overrides = {}) {
  return {
    id: overrides.id || createId('compat'),
    buildAlias: overrides.buildAlias || 'stable',
    modelAlias: overrides.modelAlias || 'default',
    sensorRigId: overrides.sensorRigId || '',
    scenarioFamilies: overrides.scenarioFamilies || [],
    status: overrides.status || 'compatible',
    notes: overrides.notes || ''
  };
}

export function summarizeCoverage(runs = []) {
  const summary = {
    totalRuns: runs.length,
    passCount: 0,
    failCount: 0,
    inProgressCount: 0,
    oddSliceCounts: {},
    findingCount: 0
  };

  runs.forEach((run) => {
    if (run.status === 'passed' || run.status === 'completed') {
      summary.passCount += 1;
    } else if (run.status === 'failed') {
      summary.failCount += 1;
    } else {
      summary.inProgressCount += 1;
    }

    summary.findingCount += run.findings?.length || 0;

    (run.oddSlices || []).forEach((slice) => {
      summary.oddSliceCounts[slice] = (summary.oddSliceCounts[slice] || 0) + 1;
    });
  });

  return summary;
}

export function createScenarioSeedFromPlan(plan = {}, activeScenario) {
  const label = plan.summary || `${activeScenario?.name || 'Scenario'} variant`;

  return createScenarioVariant({
    label,
    scenarioId: activeScenario?.id || '',
    parameterSweep: plan.parameterSweep || [],
    triggerEdits: plan.triggerEdits || [],
    worldMutationSummary: plan.worldMutationSummary || '',
    provenance: {
      evidenceType: EVIDENCE_TYPES.SIMULATED,
      sourceLabel: 'Prompt-generated scenario seed'
    }
  });
}
