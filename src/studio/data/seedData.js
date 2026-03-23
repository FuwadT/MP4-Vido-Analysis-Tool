import {
  ACTOR_BEHAVIORS,
  ACTOR_TYPES,
  EVIDENCE_TYPES,
  INTEROP_TARGETS,
  PANEL_TYPES,
  RUN_TYPES,
  SENSOR_TYPES,
  createBuildModelCompatibility,
  createBuildProfile,
  createDatasetAsset,
  createEvent,
  createLogSession,
  createModelProfile,
  createPlaybackLayout,
  createScenario,
  createSensorProfile,
  createSensorRig,
  createValidationMetric,
  createValidationRequirement,
  createValidationRun
} from '../domain/models.js';

export const SENSOR_PROFILES = [
  createSensorProfile({
    id: 'sensor-ouster-os0',
    name: 'Ouster OS0',
    manufacturer: 'Ouster',
    sensorType: SENSOR_TYPES.LIDAR,
    maxRangeMeters: 100,
    verticalFieldOfViewDeg: 90,
    horizontalFieldOfViewDeg: 360,
    channels: 128,
    pointsPerSecond: 5_200_000,
    frameRatesHz: [10, 20],
    returnModes: ['single-return', 'dual-return'],
    calibrationNotes: 'Short-range wide-FOV profile for low-speed edge coverage.'
  }),
  createSensorProfile({
    id: 'sensor-ouster-os1',
    name: 'Ouster OS1',
    manufacturer: 'Ouster',
    sensorType: SENSOR_TYPES.LIDAR,
    maxRangeMeters: 200,
    verticalFieldOfViewDeg: 45,
    horizontalFieldOfViewDeg: 360,
    channels: 128,
    pointsPerSecond: 5_200_000,
    frameRatesHz: [10, 20],
    returnModes: ['single-return', 'dual-return'],
    calibrationNotes: 'Longer-range rooftop lidar profile for highway and arterial coverage.'
  }),
  createSensorProfile({
    id: 'sensor-hesai-at128',
    name: 'Hesai AT128',
    manufacturer: 'Hesai',
    sensorType: SENSOR_TYPES.LIDAR,
    maxRangeMeters: 200,
    verticalFieldOfViewDeg: 25.4,
    horizontalFieldOfViewDeg: 120,
    channels: 128,
    pointsPerSecond: 1_530_000,
    frameRatesHz: [10, 20],
    returnModes: ['single-return'],
    calibrationNotes: 'Automotive forward lidar profile for long-range object coverage.'
  }),
  createSensorProfile({
    id: 'sensor-waymo-camera-surround',
    name: 'Waymo Surround Camera Suite',
    manufacturer: 'Waymo',
    sensorType: SENSOR_TYPES.CAMERA,
    maxRangeMeters: 250,
    verticalFieldOfViewDeg: 70,
    horizontalFieldOfViewDeg: 120,
    channels: 8,
    pointsPerSecond: 0,
    frameRatesHz: [10],
    intrinsics: {
      distortionModel: 'calibrated-per-camera',
      shutterModel: 'rolling-or-global-per-sensor'
    },
    calibrationNotes: 'Surround camera rig abstraction for Waymo Parquet and E2E playback.'
  })
];

export const SENSOR_RIGS = [
  createSensorRig({
    id: 'rig-waymo-research',
    name: 'Waymo Research Rig',
    hardwareClass: 'research-vehicle',
    sensorProfileIds: ['sensor-waymo-camera-surround', 'sensor-hesai-at128'],
    sensors: [
      { name: 'Surround cameras', type: SENSOR_TYPES.CAMERA, count: 8 },
      { name: 'Roof lidar', type: SENSOR_TYPES.LIDAR, count: 1 }
    ],
    supportsGeneratedOutputs: true,
    notes: 'Matches the current repo focus: synchronized Waymo camera, lidar, and ego motion review.'
  }),
  createSensorRig({
    id: 'rig-dashcam-seed',
    name: 'Monocular Dashcam Seed Rig',
    hardwareClass: 'aftermarket-dashcam',
    sensorProfileIds: ['sensor-waymo-camera-surround'],
    sensors: [
      { name: 'Forward dashcam', type: SENSOR_TYPES.CAMERA, count: 1 }
    ],
    supportsGeneratedOutputs: true,
    notes: 'Useful for scenario bootstrapping and world-model hypothesis generation, not validation-grade truth.'
  })
];

export const BUILD_PROFILES = [
  createBuildProfile({
    id: 'build-stable',
    alias: 'stable',
    version: '2026.03.22.1',
    branch: 'main',
    description: 'Current release candidate used for baseline replay and regression gates.',
    sensorRigIds: ['rig-waymo-research']
  }),
  createBuildProfile({
    id: 'build-candidate',
    alias: 'candidate',
    version: '2026.03.22.2',
    branch: 'codex/adas-studio-foundation',
    description: 'Active candidate build for scenario mutation and model A/B replay.',
    sensorRigIds: ['rig-waymo-research', 'rig-dashcam-seed']
  }),
  createBuildProfile({
    id: 'build-debug',
    alias: 'debug',
    version: '2026.03.22.debug.1',
    branch: 'codex/debug-trace',
    description: 'Verbose observer build with additional state dumps and validation traces.',
    targetStacks: ['replay', 'observer', 'validation'],
    sensorRigIds: ['rig-waymo-research']
  }),
  createBuildProfile({
    id: 'build-shadow',
    alias: 'shadow',
    version: '2026.03.22.shadow.1',
    branch: 'shadow',
    description: 'Shadow-only playback profile for A/B diagnostics without touching operator control.',
    targetStacks: ['shadow-replay'],
    sensorRigIds: ['rig-waymo-research']
  })
];

export const MODEL_PROFILES = [
  createModelProfile({
    id: 'model-default',
    alias: 'default',
    family: 'multimodal-perception',
    version: '2026.03.22.1',
    notes: 'Baseline perception and planning bundle.'
  }),
  createModelProfile({
    id: 'model-champion',
    alias: 'champion',
    family: 'multimodal-perception',
    version: '2026.03.22.7',
    notes: 'Current internal best run for regression comparisons.'
  }),
  createModelProfile({
    id: 'model-challenger',
    alias: 'challenger',
    family: 'multimodal-perception',
    version: '2026.03.22.9',
    notes: 'Challenger model for object-tracking and intervention comparisons.'
  }),
  createModelProfile({
    id: 'model-experimental',
    alias: 'experimental',
    family: 'policy-research',
    version: '2026.03.22.exp.3',
    supportsWorldMutation: true,
    notes: 'Experimental stack for scenario mutation and prompt-driven sweeps.'
  }),
  createModelProfile({
    id: 'model-world-model-v0',
    alias: 'world-model-v0',
    family: 'generative-world-model',
    version: '2026.03.22.wm.0',
    supportsWorldMutation: true,
    supportsSensorGeneration: true,
    notes: 'Adapter contract only. Generated outputs must be labeled as hypotheses.'
  })
];

export const COMPATIBILITY_MATRIX = [
  createBuildModelCompatibility({
    id: 'compat-stable-default',
    buildAlias: 'stable',
    modelAlias: 'default',
    sensorRigId: 'rig-waymo-research',
    scenarioFamilies: ['urban-cut-in', 'unprotected-left', 'crosswalk-yield'],
    status: 'certified'
  }),
  createBuildModelCompatibility({
    id: 'compat-candidate-challenger',
    buildAlias: 'candidate',
    modelAlias: 'challenger',
    sensorRigId: 'rig-waymo-research',
    scenarioFamilies: ['urban-cut-in', 'arterial-near-miss'],
    status: 'soak-testing'
  }),
  createBuildModelCompatibility({
    id: 'compat-candidate-world-model',
    buildAlias: 'candidate',
    modelAlias: 'world-model-v0',
    sensorRigId: 'rig-dashcam-seed',
    scenarioFamilies: ['dashcam-bootstrap'],
    status: 'experimental',
    notes: 'Dashcam-to-surround completion remains hypothesis generation only.'
  })
];

export const DATASET_ASSETS = [
  createDatasetAsset({
    id: 'asset-waymo-perception-local',
    name: 'Waymo Perception Segment Cache',
    assetType: 'dataset',
    sourceType: INTEROP_TARGETS.PARQUET,
    sourceUri: 'C:\\Users\\PC\\Desktop\\waymo_data',
    split: 'training',
    segmentCount: 1,
    tags: ['camera', 'lidar', 'ego-pose', 'local-cache'],
    description: 'Local Parquet segment cache used for synchronized ego-camera and lidar review.',
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      sourceLabel: 'Observed Waymo Parquet segment',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createDatasetAsset({
    id: 'asset-waymo-e2e-bucket',
    name: 'Waymo E2E Camera Dataset',
    assetType: 'dataset',
    sourceType: INTEROP_TARGETS.TFRECORD,
    sourceUri: 'gs://waymo_open_dataset_end_to_end_camera_v_1_0_0',
    split: 'testing',
    segmentCount: 266,
    tags: ['camera', 'intent', 'ego-history', 'no-lidar'],
    description: 'Raw end-to-end camera shards for ego-view playback and behavior review.',
    provenance: {
      datasetAssetId: 'asset-waymo-e2e-bucket',
      sourceLabel: 'Observed Waymo E2E camera shard',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createDatasetAsset({
    id: 'asset-dashcam-mp4',
    name: 'Dashcam Uploads',
    assetType: 'media',
    sourceType: INTEROP_TARGETS.MP4,
    sourceUri: 'sample.mp4',
    split: 'operator-review',
    segmentCount: 1,
    tags: ['monocular', 'scenario-seed', 'mp4'],
    description: 'Monocular dashcam video uploads for incident review and scenario bootstrapping.',
    provenance: {
      datasetAssetId: 'asset-dashcam-mp4',
      sourceLabel: 'Observed dashcam footage',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  })
];

export const LOG_SESSIONS = [
  createLogSession({
    id: 'log-waymo-cut-in',
    datasetAssetId: 'asset-waymo-perception-local',
    label: 'Urban arterial cut-in replay',
    scenarioFamily: 'urban-cut-in',
    durationSeconds: 19.8,
    routeLabel: 'Mission corridor / arterial segment',
    locationLabel: 'San Francisco, CA',
    availableModalities: ['camera', 'lidar', 'pose', 'boxes'],
    tags: ['cut-in', 'urban', 'daylight', 'lidar-available'],
    eventSummary: ['aggressive cut-in', 'ego brake response'],
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      logSessionId: 'log-waymo-cut-in',
      sourceLabel: 'Observed Waymo Parquet replay',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createLogSession({
    id: 'log-waymo-e2e-turn',
    datasetAssetId: 'asset-waymo-e2e-bucket',
    label: 'E2E urban intent review',
    scenarioFamily: 'dashcam-bootstrap',
    durationSeconds: 12,
    routeLabel: 'Testing shard replay',
    locationLabel: 'Waymo E2E testing split',
    availableModalities: ['camera', 'intent', 'ego-history'],
    tags: ['e2e', 'camera-only', 'go-right'],
    eventSummary: ['intent transition', 'camera-only review'],
    provenance: {
      datasetAssetId: 'asset-waymo-e2e-bucket',
      logSessionId: 'log-waymo-e2e-turn',
      sourceLabel: 'Observed Waymo E2E replay',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createLogSession({
    id: 'log-dashcam-bridge',
    datasetAssetId: 'asset-dashcam-mp4',
    label: 'Dashcam bridge bootstrap',
    scenarioFamily: 'dashcam-bootstrap',
    durationSeconds: 24,
    routeLabel: 'Scenic arterial drive',
    locationLabel: 'Operator upload',
    sourceFormat: INTEROP_TARGETS.MP4,
    availableModalities: ['camera'],
    tags: ['dashcam', 'monocular', 'seed-only'],
    eventSummary: ['manual review pending'],
    provenance: {
      datasetAssetId: 'asset-dashcam-mp4',
      logSessionId: 'log-dashcam-bridge',
      sourceLabel: 'Observed dashcam clip',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  })
];

export const SCENARIOS = [
  createScenario({
    id: 'scenario-urban-cut-in',
    name: 'Near-miss cut-in on urban arterial',
    family: 'urban-cut-in',
    description: 'Recorded arterial drive where a lead vehicle cuts across ego lane and triggers a brake intervention.',
    tags: ['urban', 'cut-in', 'medium-traffic', 'daylight'],
    oddSlices: ['urban-arterial', 'daylight', 'medium-traffic', 'vehicle-cut-in'],
    roadNetwork: {
      id: 'road-arterial',
      name: 'Urban arterial with bus lane',
      laneCount: 4,
      routeLengthMeters: 480,
      boundingBox: { minX: -35, maxX: 35, minY: -90, maxY: 90 },
      notes: 'OpenDRIVE mapping hook pending. Using internal geometry seed for now.'
    },
    route: [
      { x: 0, y: 72 }, { x: 0, y: 40 }, { x: 0, y: 8 }, { x: 2, y: -24 }, { x: 3, y: -64 }
    ],
    actors: [
      {
        id: 'actor-ego',
        label: 'Ego vehicle',
        actorType: ACTOR_TYPES.VEHICLE,
        tags: ['ego', 'primary'],
        spawnPose: { x: 0, y: 70, yawDeg: 180 },
        speedMps: 10.8,
        behavior: {
          type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
          speedProfileMps: [11, 10, 7, 0],
          intent: 'maintain-lane-then-brake'
        },
        notes: 'Observed from log.'
      },
      {
        id: 'actor-cut-in-sedan',
        label: 'Cut-in sedan',
        actorType: ACTOR_TYPES.VEHICLE,
        tags: ['target', 'cut-in'],
        spawnPose: { x: 10, y: 16, yawDeg: 195 },
        speedMps: 9.3,
        behavior: {
          type: ACTOR_BEHAVIORS.CUT_IN,
          speedProfileMps: [8, 10, 11],
          intent: 'late-lane-change'
        },
        notes: 'Primary counterfactual actor.'
      },
      {
        id: 'actor-curb-cone',
        label: 'Construction cone',
        actorType: ACTOR_TYPES.CONE,
        tags: ['static', 'roadside'],
        spawnPose: { x: -8, y: -8, yawDeg: 0 },
        speedMps: 0,
        behavior: {
          type: ACTOR_BEHAVIORS.STATIC,
          speedProfileMps: [0],
          intent: 'static-obstacle'
        },
        notes: 'Editable static obstacle scaffold.'
      }
    ],
    events: [
      createEvent({
        id: 'event-cut-in',
        type: 'cut-in',
        title: 'Aggressive cut-in',
        startTimeSeconds: 5.8,
        endTimeSeconds: 7.2,
        severity: 'high',
        actorIds: ['actor-cut-in-sedan', 'actor-ego'],
        tags: ['issue', 'triage']
      }),
      createEvent({
        id: 'event-brake',
        type: 'intervention',
        title: 'Ego brake response',
        startTimeSeconds: 6.4,
        endTimeSeconds: 8.1,
        severity: 'medium',
        actorIds: ['actor-ego'],
        tags: ['intervention']
      })
    ],
    variants: [
      {
        id: 'variant-baseline',
        label: 'Observed baseline',
        parameterSweep: [],
        triggerEdits: [],
        worldMutationSummary: 'Direct replay from observed log.',
        provenance: {
          evidenceType: EVIDENCE_TYPES.OBSERVED,
          sourceLabel: 'Observed scenario extraction'
        }
      },
      {
        id: 'variant-dusk-rain',
        label: 'Heavy rain at dusk',
        parameterSweep: [
          { key: 'weather', values: ['heavy-rain'] },
          { key: 'lighting', values: ['dusk'] }
        ],
        triggerEdits: ['actor-cut-in-sedan enters 0.7s earlier'],
        worldMutationSummary: 'Prompt-seeded variant for counterfactual braking review.',
        provenance: {
          evidenceType: EVIDENCE_TYPES.SIMULATED,
          sourceLabel: 'Simulated counterfactual variant'
        }
      }
    ],
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      logSessionId: 'log-waymo-cut-in',
      scenarioId: 'scenario-urban-cut-in',
      sourceLabel: 'Observed log extracted into scenario library',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createScenario({
    id: 'scenario-unprotected-left',
    name: 'Unprotected left with moderate traffic',
    family: 'unprotected-left',
    description: 'Logical scenario seed used for validation suite authoring and parameter sweeps.',
    tags: ['intersection', 'unprotected-left', 'medium-traffic'],
    oddSlices: ['signalized-intersection', 'daylight', 'medium-traffic'],
    roadNetwork: {
      id: 'road-left-turn',
      name: 'Signalized four-way intersection',
      laneCount: 6,
      routeLengthMeters: 300,
      boundingBox: { minX: -75, maxX: 75, minY: -75, maxY: 75 }
    },
    route: [
      { x: 0, y: 60 }, { x: 0, y: 15 }, { x: -10, y: 0 }, { x: -35, y: -25 }, { x: -58, y: -45 }
    ],
    actors: [
      {
        id: 'actor-left-ego',
        label: 'Ego vehicle',
        actorType: ACTOR_TYPES.VEHICLE,
        tags: ['ego', 'turning-left'],
        spawnPose: { x: 0, y: 60, yawDeg: 180 },
        speedMps: 8.2,
        behavior: {
          type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
          speedProfileMps: [8, 6, 4, 7],
          intent: 'yield-then-turn'
        }
      },
      {
        id: 'actor-oncoming',
        label: 'Oncoming SUV',
        actorType: ACTOR_TYPES.VEHICLE,
        tags: ['oncoming', 'priority'],
        spawnPose: { x: 0, y: -48, yawDeg: 0 },
        speedMps: 12.2,
        behavior: {
          type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
          speedProfileMps: [12, 12, 12],
          intent: 'proceed-straight'
        }
      },
      {
        id: 'actor-crosswalk-ped',
        label: 'Crosswalk pedestrian',
        actorType: ACTOR_TYPES.PEDESTRIAN,
        tags: ['crosswalk'],
        spawnPose: { x: -18, y: 10, yawDeg: 90 },
        speedMps: 1.5,
        behavior: {
          type: ACTOR_BEHAVIORS.CROSSING,
          speedProfileMps: [1.2, 1.6, 1.5],
          intent: 'cross-on-flash'
        }
      }
    ],
    events: [
      createEvent({
        id: 'event-yield',
        type: 'yield',
        title: 'Yield to oncoming traffic',
        startTimeSeconds: 4.1,
        endTimeSeconds: 6.0,
        severity: 'medium',
        actorIds: ['actor-left-ego', 'actor-oncoming'],
        tags: ['yield']
      })
    ],
    variants: [
      {
        id: 'variant-sweep-gap',
        label: 'Gap acceptance sweep',
        parameterSweep: [
          { key: 'oncoming-gap-seconds', values: [2.5, 3, 3.5, 4] },
          { key: 'pedestrian-offset-seconds', values: [0, 1.5] }
        ],
        worldMutationSummary: 'Template for reusable validation sweeps.'
      }
    ],
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      logSessionId: 'log-waymo-cut-in',
      scenarioId: 'scenario-unprotected-left',
      sourceLabel: 'Logical scenario library seed',
      evidenceType: EVIDENCE_TYPES.SIMULATED
    }
  }),
  createScenario({
    id: 'scenario-dashcam-bootstrap-seed',
    name: 'Dashcam bootstrap with inferred surround gaps',
    family: 'dashcam-bootstrap',
    description: 'A monocular dashcam seed scenario used to demonstrate observed versus inferred labeling and world-model handoff points.',
    tags: ['dashcam', 'bootstrap', 'generated-hypothesis', 'dusk'],
    oddSlices: ['dashcam-bootstrap', 'urban-arterial', 'dusk'],
    roadNetwork: {
      id: 'road-dashcam-seed',
      name: 'Partial arterial reconstruction',
      laneCount: 3,
      routeLengthMeters: 420,
      boundingBox: { minX: -40, maxX: 40, minY: -90, maxY: 90 },
      notes: 'Derived from monocular observations and map priors. Not validation-grade truth.'
    },
    route: [
      { x: 0, y: 78 }, { x: -1, y: 42 }, { x: -2, y: 8 }, { x: -4, y: -28 }, { x: -7, y: -70 }
    ],
    actors: [
      {
        id: 'actor-dashcam-ego',
        label: 'Ego vehicle',
        actorType: ACTOR_TYPES.VEHICLE,
        tags: ['ego', 'observed'],
        spawnPose: { x: 0, y: 78, yawDeg: 180 },
        speedMps: 9.1,
        behavior: {
          type: ACTOR_BEHAVIORS.FOLLOW_ROUTE,
          speedProfileMps: [9, 9, 8, 6],
          intent: 'follow-arterial'
        },
        notes: 'Observed front-view motion estimate.'
      },
      {
        id: 'actor-dashcam-ped',
        label: 'Inferred curb pedestrian',
        actorType: ACTOR_TYPES.PEDESTRIAN,
        tags: ['inferred', 'side-gap'],
        spawnPose: { x: 9, y: -6, yawDeg: 90 },
        speedMps: 1.2,
        behavior: {
          type: ACTOR_BEHAVIORS.CROSSING,
          speedProfileMps: [0.8, 1.2, 1.4],
          intent: 'possible-crossing'
        },
        notes: 'Actor exists to demonstrate uncertainty-aware scene completion.'
      }
    ],
    events: [
      createEvent({
        id: 'event-dashcam-bootstrap',
        type: 'bootstrap',
        title: 'World-model handoff point',
        startTimeSeconds: 7.4,
        endTimeSeconds: 9.2,
        severity: 'medium',
        actorIds: ['actor-dashcam-ego', 'actor-dashcam-ped'],
        tags: ['generated-hypothesis', 'uncertainty']
      })
    ],
    variants: [
      {
        id: 'variant-dashcam-observed-seed',
        label: 'Observed front-camera seed',
        parameterSweep: [],
        triggerEdits: [],
        worldMutationSummary: 'Direct monocular observation with no surround completion.'
      },
      {
        id: 'variant-dashcam-generated-surround',
        label: 'Generated surround hypothesis',
        parameterSweep: [
          { key: 'completion-mode', values: ['surround-hypothesis'] },
          { key: 'uncertainty-mask', values: ['enabled'] }
        ],
        triggerEdits: ['Pedestrian spawn remains inferred until corroborated.'],
        worldMutationSummary: 'Generated side and rear views remain explicitly labeled as inferred.'
      }
    ],
    provenance: {
      datasetAssetId: 'asset-dashcam-mp4',
      logSessionId: 'log-dashcam-bridge',
      scenarioId: 'scenario-dashcam-bootstrap-seed',
      sourceLabel: 'Dashcam bootstrap scenario seed',
      evidenceType: EVIDENCE_TYPES.GENERATED
    }
  })
];

export const VALIDATION_REQUIREMENTS = [
  createValidationRequirement({
    id: 'req-urban-cut-in',
    code: 'REQ-ODD-URBAN-017',
    title: 'Urban cut-in response',
    description: 'System shall maintain safe separation and bounded deceleration during aggressive urban cut-ins.',
    oddSlices: ['urban-arterial', 'vehicle-cut-in'],
    linkedScenarioIds: ['scenario-urban-cut-in'],
    linkedMetricIds: ['metric-min-ttc', 'metric-peak-decel'],
    status: 'active'
  }),
  createValidationRequirement({
    id: 'req-left-turn',
    code: 'REQ-ODD-INT-004',
    title: 'Unprotected left safety',
    description: 'System shall clear the intersection without violating oncoming actor right-of-way.',
    oddSlices: ['signalized-intersection', 'unprotected-left'],
    linkedScenarioIds: ['scenario-unprotected-left'],
    linkedMetricIds: ['metric-collision-free', 'metric-intervention-count'],
    status: 'active'
  }),
  createValidationRequirement({
    id: 'req-generated-labeling',
    code: 'REQ-GEN-001',
    title: 'Generated output labeling',
    description: 'Any generated sensor outputs must carry provenance, confidence, and observed-vs-inferred labeling.',
    oddSlices: ['world-model', 'dashcam-bootstrap'],
    linkedScenarioIds: ['scenario-urban-cut-in'],
    linkedMetricIds: ['metric-provenance-completeness'],
    status: 'draft'
  })
];

export const VALIDATION_METRICS = [
  createValidationMetric({
    id: 'metric-collision-free',
    key: 'collisionFree',
    title: 'Collision free',
    unit: 'boolean',
    passDirection: 'equals',
    passThreshold: 1,
    source: 'safety-observer'
  }),
  createValidationMetric({
    id: 'metric-min-ttc',
    key: 'minTtcSeconds',
    title: 'Minimum TTC',
    unit: 's',
    passDirection: 'min',
    passThreshold: 1.5,
    source: 'kinematics-observer'
  }),
  createValidationMetric({
    id: 'metric-peak-decel',
    key: 'peakDecelMps2',
    title: 'Peak deceleration',
    unit: 'm/s^2',
    passDirection: 'max',
    passThreshold: 6.5,
    source: 'comfort-observer'
  }),
  createValidationMetric({
    id: 'metric-intervention-count',
    key: 'interventionCount',
    title: 'Intervention count',
    unit: 'count',
    passDirection: 'max',
    passThreshold: 0,
    source: 'operator-observer'
  }),
  createValidationMetric({
    id: 'metric-provenance-completeness',
    key: 'provenanceCoverage',
    title: 'Provenance completeness',
    unit: '%',
    passDirection: 'min',
    passThreshold: 100,
    source: 'reporting-observer'
  })
];

export const VALIDATION_RUNS = [
  createValidationRun({
    id: 'run-stable-cut-in',
    label: 'Stable / default / cut-in replay',
    runType: RUN_TYPES.REGRESSION,
    scenarioId: 'scenario-urban-cut-in',
    scenarioVariantId: 'variant-baseline',
    buildAlias: 'stable',
    modelAlias: 'default',
    status: 'passed',
    durationSeconds: 18.7,
    metrics: {
      collisionFree: 1,
      minTtcSeconds: 1.9,
      peakDecelMps2: 5.2,
      interventionCount: 0
    },
    findings: [
      {
        id: 'finding-latency-note',
        severity: 'info',
        title: 'Track reacquisition delay',
        description: 'Lead actor ID flickers for 120 ms during occlusion but safety envelope remains intact.'
      }
    ],
    oddSlices: ['urban-arterial', 'vehicle-cut-in'],
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      logSessionId: 'log-waymo-cut-in',
      scenarioId: 'scenario-urban-cut-in',
      scenarioVersion: 'v1',
      buildAlias: 'stable',
      modelAlias: 'default',
      sensorRigId: 'rig-waymo-research',
      validationPresetId: 'urban-cut-in-regression',
      sourceLabel: 'Observed replay with observer stack',
      evidenceType: EVIDENCE_TYPES.OBSERVED
    }
  }),
  createValidationRun({
    id: 'run-candidate-cut-in',
    label: 'Candidate / challenger / dusk-rain counterfactual',
    runType: RUN_TYPES.EXPLORATORY,
    scenarioId: 'scenario-urban-cut-in',
    scenarioVariantId: 'variant-dusk-rain',
    buildAlias: 'candidate',
    modelAlias: 'challenger',
    status: 'failed',
    durationSeconds: 18.9,
    metrics: {
      collisionFree: 1,
      minTtcSeconds: 1.2,
      peakDecelMps2: 6.9,
      interventionCount: 1
    },
    findings: [
      {
        id: 'finding-brake-gap',
        severity: 'high',
        title: 'Late brake onset in rain',
        description: 'Counterfactual mutation drops minimum TTC below target and triggers one intervention.'
      },
      {
        id: 'finding-report-gap',
        severity: 'medium',
        title: 'Missing generated-mask export',
        description: 'Generated-weather overlay lacks a persisted confidence mask in the run artifact.'
      }
    ],
    oddSlices: ['urban-arterial', 'heavy-rain', 'dusk', 'vehicle-cut-in'],
    provenance: {
      datasetAssetId: 'asset-waymo-perception-local',
      logSessionId: 'log-waymo-cut-in',
      scenarioId: 'scenario-urban-cut-in',
      scenarioVersion: 'v1',
      buildAlias: 'candidate',
      modelAlias: 'challenger',
      sensorRigId: 'rig-waymo-research',
      validationPresetId: 'counterfactual-exploration',
      sourceLabel: 'Physics-simulated counterfactual',
      evidenceType: EVIDENCE_TYPES.SIMULATED
    }
  }),
  createValidationRun({
    id: 'run-world-model-dashcam',
    label: 'World-model dashcam bootstrap',
    runType: RUN_TYPES.HYPOTHESIS,
    scenarioId: 'scenario-urban-cut-in',
    scenarioVariantId: 'variant-dusk-rain',
    buildAlias: 'candidate',
    modelAlias: 'world-model-v0',
    status: 'in-review',
    durationSeconds: 12.4,
    metrics: {
      provenanceCoverage: 82
    },
    findings: [
      {
        id: 'finding-inferred-coverage',
        severity: 'medium',
        title: 'High inferred surround coverage',
        description: 'Only front camera observations are grounded. Side and rear views remain generated hypotheses.'
      }
    ],
    oddSlices: ['dashcam-bootstrap', 'world-model'],
    provenance: {
      datasetAssetId: 'asset-dashcam-mp4',
      logSessionId: 'log-dashcam-bridge',
      scenarioId: 'scenario-urban-cut-in',
      scenarioVersion: 'v1',
      buildAlias: 'candidate',
      modelAlias: 'world-model-v0',
      sensorRigId: 'rig-dashcam-seed',
      validationPresetId: 'dashcam-bootstrap-review',
      sourceLabel: 'Generated dashcam-to-world hypothesis',
      evidenceType: EVIDENCE_TYPES.GENERATED
    }
  })
];

export const PLAYBACK_LAYOUTS = [
  createPlaybackLayout({
    id: 'layout-triage',
    name: 'Triage',
    description: 'Large replay surface with nearby diagnostics, raw messages, and findings.',
    optimizedFor: 'triage',
    panelTypes: [PANEL_TYPES.SCENE_3D, PANEL_TYPES.IMAGE, PANEL_TYPES.TIMELINE, PANEL_TYPES.DIAGNOSTICS, PANEL_TYPES.RAW_MESSAGES],
    gridClassName: 'grid grid-cols-1 gap-4 xl:grid-cols-12 auto-rows-[minmax(180px,auto)]',
    slots: {
      primary: 'xl:col-span-8 xl:row-span-2 min-h-[920px]',
      secondary: 'xl:col-span-4',
      tertiary: 'xl:col-span-4',
      detail: 'xl:col-span-4',
      footer: 'xl:col-span-12'
    }
  }),
  createPlaybackLayout({
    id: 'layout-labeling',
    name: 'Labeling',
    description: 'Camera-forward layout with actor/tagging context and intervention markers.',
    optimizedFor: 'labeling',
    panelTypes: [PANEL_TYPES.IMAGE, PANEL_TYPES.ANNOTATIONS, PANEL_TYPES.TABLE, PANEL_TYPES.TIMELINE],
    gridClassName: 'grid grid-cols-1 gap-4 xl:grid-cols-12 auto-rows-[minmax(180px,auto)]',
    slots: {
      primary: 'xl:col-span-7 xl:row-span-2 min-h-[880px]',
      secondary: 'xl:col-span-5',
      tertiary: 'xl:col-span-5',
      detail: 'xl:col-span-12',
      footer: 'xl:col-span-12'
    }
  }),
  createPlaybackLayout({
    id: 'layout-scenario-edit',
    name: 'Scenario editing',
    description: 'Birds-eye authoring, actor inspector, and prompt mutation preview.',
    optimizedFor: 'scenario-editing',
    panelTypes: [PANEL_TYPES.SCENARIO_GRAPH, PANEL_TYPES.TIMELINE, PANEL_TYPES.TABLE],
    gridClassName: 'grid grid-cols-1 gap-4 xl:grid-cols-12 auto-rows-[minmax(170px,auto)]',
    slots: {
      primary: 'xl:col-span-7 xl:row-span-2 min-h-[760px]',
      secondary: 'xl:col-span-5',
      tertiary: 'xl:col-span-5',
      detail: 'xl:col-span-7',
      footer: 'xl:col-span-12'
    }
  }),
  createPlaybackLayout({
    id: 'layout-validation',
    name: 'Validation',
    description: 'Requirements traceability, metrics, findings, and run history.',
    optimizedFor: 'validation',
    panelTypes: [PANEL_TYPES.VALIDATION, PANEL_TYPES.TABLE, PANEL_TYPES.PLOT, PANEL_TYPES.TIMELINE],
    gridClassName: 'grid grid-cols-1 gap-4 xl:grid-cols-12 auto-rows-[minmax(160px,auto)]',
    slots: {
      primary: 'xl:col-span-5',
      secondary: 'xl:col-span-7',
      tertiary: 'xl:col-span-6',
      detail: 'xl:col-span-6',
      footer: 'xl:col-span-12'
    }
  }),
  createPlaybackLayout({
    id: 'layout-compare',
    name: 'Compare',
    description: 'A/B replay and diff-oriented operator view.',
    optimizedFor: 'compare',
    panelTypes: [PANEL_TYPES.COMPARE, PANEL_TYPES.SCENE_3D, PANEL_TYPES.IMAGE, PANEL_TYPES.TIMELINE],
    gridClassName: 'grid grid-cols-1 gap-4 xl:grid-cols-12 auto-rows-[minmax(160px,auto)]',
    slots: {
      primary: 'xl:col-span-6 xl:row-span-2 min-h-[760px]',
      secondary: 'xl:col-span-6 xl:row-span-2 min-h-[760px]',
      tertiary: 'xl:col-span-6',
      detail: 'xl:col-span-6',
      footer: 'xl:col-span-12'
    }
  })
];

export const STUDIO_NAV_ITEMS = [
  { id: 'home', label: 'Home', subtitle: 'Overview + quick starts' },
  { id: 'data-explorer', label: 'Data Explorer', subtitle: 'Logs, datasets, replay' },
  { id: 'scenario-studio', label: 'Scenario Studio', subtitle: 'Actors, routes, mutations' },
  { id: 'simulation-runs', label: 'Simulation Runs', subtitle: 'Re-sim and compare' },
  { id: 'validation', label: 'Validation', subtitle: 'Requirements + coverage' },
  { id: 'models-builds', label: 'Models & Builds', subtitle: 'Aliases + compatibility' },
  { id: 'settings', label: 'Settings', subtitle: 'Interop + honesty' }
];

export const DATA_ADAPTERS = [
  {
    id: 'adapter-waymo-parquet',
    name: 'Waymo Parquet adapter',
    status: 'functional',
    target: INTEROP_TARGETS.PARQUET,
    description: 'Local and cloud-backed Waymo Perception playback with camera, lidar, and object boxes.'
  },
  {
    id: 'adapter-waymo-e2e',
    name: 'Waymo E2E TFRecord adapter',
    status: 'functional',
    target: INTEROP_TARGETS.TFRECORD,
    description: 'Browser-side raw E2E shard indexing for ego-camera and intent playback.'
  },
  {
    id: 'adapter-mp4',
    name: 'MP4 dashcam adapter',
    status: 'functional',
    target: INTEROP_TARGETS.MP4,
    description: 'Browser-side MP4 review with TensorFlow.js object detection and ADAS event tagging.'
  },
  {
    id: 'adapter-mcap',
    name: 'MCAP normalization adapter',
    status: 'planned',
    target: INTEROP_TARGETS.MCAP,
    description: 'Canonical multimodal playback and export container for future interop.'
  },
  {
    id: 'adapter-openscenario',
    name: 'OpenSCENARIO mapper',
    status: 'planned',
    target: INTEROP_TARGETS.OPENSCENARIO,
    description: 'Mapping hooks from internal scenario model to ASAM OpenSCENARIO 2.x targets.'
  },
  {
    id: 'adapter-opendrive',
    name: 'OpenDRIVE mapper',
    status: 'planned',
    target: INTEROP_TARGETS.OPENDRIVE,
    description: 'Road network abstraction target for future route and lane-level authoring.'
  }
];

export const HONESTY_GUIDELINES = [
  'Observed-from-log evidence remains the only source that should be treated as direct ground truth.',
  'Physics-simulated counterfactuals are useful for replay, root cause analysis, and regression testing, but still depend on model and environment assumptions.',
  'Generated camera or lidar outputs must carry explicit observed-vs-inferred labeling, uncertainty, and provenance metadata.',
  'Front-only dashcam to surround-world reconstruction is a scenario seed and hypothesis-generation workflow, not a validation-grade audit trail.'
];
