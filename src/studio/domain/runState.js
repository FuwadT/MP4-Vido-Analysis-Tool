import {
  FINDING_SEVERITIES,
  RUN_STATUSES,
  createFinding,
  createValidationRun
} from './models.js';

const RUN_TRANSITIONS = Object.freeze({
  [RUN_STATUSES.QUEUED]: [RUN_STATUSES.PREPARING, RUN_STATUSES.CANCELED],
  [RUN_STATUSES.PREPARING]: [RUN_STATUSES.RUNNING, RUN_STATUSES.FAILED, RUN_STATUSES.CANCELED],
  [RUN_STATUSES.RUNNING]: [RUN_STATUSES.COMPLETED, RUN_STATUSES.FAILED, RUN_STATUSES.CANCELED, RUN_STATUSES.PASSED],
  [RUN_STATUSES.COMPLETED]: [RUN_STATUSES.IN_REVIEW],
  [RUN_STATUSES.PASSED]: [RUN_STATUSES.IN_REVIEW],
  [RUN_STATUSES.FAILED]: [RUN_STATUSES.IN_REVIEW],
  [RUN_STATUSES.CANCELED]: [],
  [RUN_STATUSES.IN_REVIEW]: []
});

export function isTerminalRunStatus(status) {
  return [
    RUN_STATUSES.COMPLETED,
    RUN_STATUSES.PASSED,
    RUN_STATUSES.FAILED,
    RUN_STATUSES.CANCELED,
    RUN_STATUSES.IN_REVIEW
  ].includes(status);
}

export function canTransitionRunStatus(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return true;
  }

  return (RUN_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

export function transitionValidationRun(run, nextStatus, patch = {}) {
  if (!canTransitionRunStatus(run.status, nextStatus)) {
    throw new Error(`Invalid run transition: ${run.status} -> ${nextStatus}`);
  }

  const timestamp = patch.transitionedAt || new Date().toISOString();
  const execution = {
    ...(run.execution || {}),
    ...(patch.execution || {})
  };

  if (nextStatus === RUN_STATUSES.PREPARING) {
    execution.preparingAt = execution.preparingAt || timestamp;
  } else if (nextStatus === RUN_STATUSES.RUNNING) {
    execution.runningAt = execution.runningAt || timestamp;
  } else if ([RUN_STATUSES.COMPLETED, RUN_STATUSES.PASSED, RUN_STATUSES.IN_REVIEW].includes(nextStatus)) {
    execution.completedAt = execution.completedAt || timestamp;
  } else if (nextStatus === RUN_STATUSES.FAILED) {
    execution.failedAt = execution.failedAt || timestamp;
  } else if (nextStatus === RUN_STATUSES.CANCELED) {
    execution.canceledAt = execution.canceledAt || timestamp;
  }

  return {
    ...run,
    ...patch,
    status: nextStatus,
    execution
  };
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildRunMetricsTemplate(context = {}) {
  const variantPenalty = context.scenarioVariantId?.includes('rain') ? 0.4 : 0;
  const challengerPenalty = context.modelAlias === 'challenger' ? 0.25 : 0;
  const debugPenalty = context.buildAlias === 'debug' ? 0.1 : 0;
  const experimentalPenalty = context.modelAlias === 'experimental' ? 0.35 : 0;
  const worldModelMode = context.modelAlias === 'world-model-v0' || context.runType === 'world-model-hypothesis';

  if (worldModelMode) {
    return {
      provenanceCoverage: 82,
      inferredCoverageRatio: 0.61,
      interventionCount: 0,
      collisionFree: 1
    };
  }

  const minTtcSeconds = Math.max(0.8, 1.95 - variantPenalty - challengerPenalty - experimentalPenalty);
  const peakDecelMps2 = 5 + variantPenalty * 4 + challengerPenalty * 2 + debugPenalty;
  const interventionCount = minTtcSeconds < 1.5 ? 1 : 0;

  return {
    collisionFree: 1,
    minTtcSeconds: Number(minTtcSeconds.toFixed(2)),
    peakDecelMps2: Number(peakDecelMps2.toFixed(2)),
    interventionCount,
    egoSpeedMps: Number((9.8 - variantPenalty).toFixed(2))
  };
}

function buildRunFindings(metrics, context = {}) {
  const findings = [];
  const variantLabel = context.variantLabel || 'scenario variant';

  if (metrics.minTtcSeconds != null && metrics.minTtcSeconds < 1.5) {
    findings.push(
      createFinding({
        severity: FINDING_SEVERITIES.HIGH,
        title: 'Tracking or braking regression',
        description: `Minimum TTC dropped below target for ${variantLabel}, suggesting a replay regression that needs operator review.`,
        type: 'tracking-regression',
        tags: ['ttc', 'tracking', 'operator-review'],
        linkedScenarioId: context.scenarioId,
        linkedScenarioVariantId: context.scenarioVariantId,
        linkedRunId: context.runId,
        provenance: context.provenance
      })
    );
  }

  if (metrics.interventionCount > 0) {
    findings.push(
      createFinding({
        severity: FINDING_SEVERITIES.MEDIUM,
        title: 'Unexpected intervention',
        description: `Replay recorded ${metrics.interventionCount} intervention(s) for this run context.`,
        type: 'intervention-change',
        tags: ['intervention', 'triage'],
        linkedScenarioId: context.scenarioId,
        linkedScenarioVariantId: context.scenarioVariantId,
        linkedRunId: context.runId,
        provenance: context.provenance
      })
    );
  }

  if (metrics.provenanceCoverage != null && metrics.provenanceCoverage < 100) {
    findings.push(
      createFinding({
        severity: FINDING_SEVERITIES.MEDIUM,
        title: 'Missing provenance coverage',
        description: 'Generated or inferred payloads are missing complete provenance coverage in the exported artifacts.',
        type: 'provenance-gap',
        tags: ['generated', 'provenance'],
        linkedScenarioId: context.scenarioId,
        linkedScenarioVariantId: context.scenarioVariantId,
        linkedRunId: context.runId,
        provenance: context.provenance
      })
    );
  }

  return findings;
}

export function finalizeRunArtifacts(run, options = {}) {
  const metrics = {
    ...buildRunMetricsTemplate(run),
    ...(options.metrics || {})
  };
  const findings = options.findings || buildRunFindings(metrics, {
    runId: run.id,
    scenarioId: run.scenarioId,
    scenarioVariantId: run.scenarioVariantId,
    variantLabel: options.variantLabel,
    provenance: run.provenance,
    buildAlias: run.buildAlias,
    modelAlias: run.modelAlias,
    runType: run.runType
  });
  const failed = findings.some((finding) => [FINDING_SEVERITIES.HIGH, FINDING_SEVERITIES.CRITICAL].includes(finding.severity))
    || safeNumber(metrics.interventionCount, 0) > 0;
  const completedStatus = failed ? RUN_STATUSES.FAILED : RUN_STATUSES.COMPLETED;
  const timestamp = options.completedAt || new Date().toISOString();

  return transitionValidationRun({
    ...run,
    durationSeconds: safeNumber(run.durationSeconds, 0) || 18.2,
    metrics,
    findings,
    artifacts: {
      summary: {
        headline: failed ? 'Regression requires operator review' : 'Run completed without blocking failures',
        pass: !failed,
        generatedAt: timestamp
      },
      evidence: options.evidence || [],
      rawMessages: options.rawMessages || [],
      report: options.report || null
    }
  }, completedStatus, {
    transitionedAt: timestamp
  });
}

export function createQueuedRun(overrides = {}) {
  return createValidationRun({
    ...overrides,
    status: overrides.status || RUN_STATUSES.QUEUED
  });
}
