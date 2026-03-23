import { createWorldModelOutput, createWorldModelRequest } from '../domain/models.js';

export const WORLD_MODEL_ADAPTERS = [
  {
    id: 'adapter-world-model-contract',
    name: 'World Model Contract',
    status: 'stub',
    description: 'Interface for future controllable world-model engines. No real generation shipped in this repo.',
    supports: ['seed-observations', 'layout-control', 'language-control', 'driving-action-control', 'camera-output', 'lidar-output']
  },
  {
    id: 'adapter-dashcam-bootstrap',
    name: 'Dashcam Bootstrap Contract',
    status: 'stub',
    description: 'Placeholder for monocular-to-world reconstruction and uncertainty-aware surround completion.',
    supports: ['ego-motion-seed', 'scene-geometry-priors', 'uncertainty-mask', 'scenario-export']
  }
];

export function createWorldModelPreviewRequest(overrides = {}) {
  return createWorldModelRequest({
    seedObservations: overrides.seedObservations || ['front-camera-clip'],
    languageInstructions: overrides.languageInstructions || 'Mutate the scene to dusk with light rain.',
    sensorRigId: overrides.sensorRigId || 'rig-dashcam-seed',
    requestedOutputs: overrides.requestedOutputs || ['camera', 'lidar', 'occupancy', 'confidence-mask'],
    ...overrides
  });
}

export async function runWorldModelPreview(request, adapterId = 'adapter-world-model-contract') {
  const normalizedRequest = createWorldModelRequest(request);

  return createWorldModelOutput({
    requestId: normalizedRequest.id,
    status: 'stub',
    cameraStreams: [],
    lidarFrames: [],
    occupancyProducts: ['occupancy-grid-placeholder'],
    confidenceMasks: ['observed-vs-inferred-mask-placeholder'],
    observedCoverageRatio: normalizedRequest.seedObservations.length > 0 ? 0.42 : 0,
    inferredCoverageRatio: normalizedRequest.seedObservations.length > 0 ? 0.58 : 1,
    provenance: {
      sourceLabel: `Experimental adapter preview: ${adapterId}`
    }
  });
}
