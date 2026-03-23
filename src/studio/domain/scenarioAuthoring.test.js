import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/seedData';
import { createProvenance } from './models';
import { addRoutePoint, createScenarioSeedFromReplayContext, duplicateScenarioDefinition } from './scenarioAuthoring';

describe('scenarioAuthoring', () => {
  it('duplicates scenarios with simulated provenance', () => {
    const duplicated = duplicateScenarioDefinition(SCENARIOS[0], { name: 'Scenario copy' });

    expect(duplicated.id).not.toBe(SCENARIOS[0].id);
    expect(duplicated.name).toBe('Scenario copy');
    expect(duplicated.provenance.evidenceType).toBe('simulated');
  });

  it('adds route points for authoring flows', () => {
    const scenario = addRoutePoint(SCENARIOS[0], { x: 12, y: -18 });
    expect(scenario.route.at(-1)).toEqual({ x: 12, y: -18 });
  });

  it('creates replay-derived scenario seeds with observed provenance', () => {
    const scenario = createScenarioSeedFromReplayContext({
      segmentId: 'segment-001',
      scenarioTitle: 'Extracted replay',
      egoTrajectory: [{ x: 0, y: 1 }, { x: 2, y: 3 }],
      selectedObject: { label: 'Sedan', centerX: 10, centerY: 3 },
      measurements: { egoSpeedMps: 8.4, relativeSpeedMps: 1.2 }
    });

    expect(scenario.id).toContain('scenario-extracted-segment-001');
    expect(scenario.provenance.evidenceType).toBe('observed');
    expect(scenario.actors.length).toBeGreaterThan(1);
  });

  it('labels provenance honestly for generated evidence', () => {
    const provenance = createProvenance({ evidenceType: 'generated' });
    expect(provenance.honestyLabel).toBe('Generated hypothesis');
  });
});
