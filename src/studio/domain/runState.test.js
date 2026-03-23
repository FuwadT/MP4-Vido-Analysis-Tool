import { describe, expect, it } from 'vitest';
import { createValidationRun, RUN_STATUSES } from './models';
import { canTransitionRunStatus, finalizeRunArtifacts, transitionValidationRun } from './runState';

describe('runState', () => {
  it('allows valid transitions and blocks invalid ones', () => {
    expect(canTransitionRunStatus(RUN_STATUSES.QUEUED, RUN_STATUSES.PREPARING)).toBe(true);
    expect(canTransitionRunStatus(RUN_STATUSES.QUEUED, RUN_STATUSES.COMPLETED)).toBe(false);
  });

  it('records execution timestamps during transitions', () => {
    const run = createValidationRun({
      id: 'run-test',
      status: RUN_STATUSES.QUEUED
    });

    const preparing = transitionValidationRun(run, RUN_STATUSES.PREPARING, {
      transitionedAt: '2026-03-22T10:00:00.000Z'
    });

    expect(preparing.execution.preparingAt).toBe('2026-03-22T10:00:00.000Z');
  });

  it('finalizes artifacts and flags regressions as failed', () => {
    const run = createValidationRun({
      id: 'run-finalize',
      status: RUN_STATUSES.RUNNING,
      buildAlias: 'candidate',
      modelAlias: 'challenger',
      scenarioVariantId: 'variant-dusk-rain'
    });

    const completed = finalizeRunArtifacts(run, {
      metrics: {
        collisionFree: 1,
        minTtcSeconds: 1.1,
        interventionCount: 1
      }
    });

    expect(completed.status).toBe(RUN_STATUSES.FAILED);
    expect(completed.findings.length).toBeGreaterThan(0);
    expect(completed.artifacts.summary.pass).toBe(false);
  });
});
