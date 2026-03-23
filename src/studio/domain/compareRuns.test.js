import { describe, expect, it } from 'vitest';
import { buildCompareSummary } from './compareRuns';

describe('buildCompareSummary', () => {
  it('computes deltas and provenance gaps for two runs', () => {
    const summary = buildCompareSummary(
      {
        id: 'run-left',
        label: 'Stable',
        scenarioId: 'scenario-1',
        metrics: { interventionCount: 0, minTtcSeconds: 2.1 },
        findings: [{ id: 'finding-1' }],
        provenance: { honestyLabel: 'Observed-from-log evidence' }
      },
      {
        id: 'run-right',
        label: 'Candidate',
        scenarioId: 'scenario-1',
        metrics: { interventionCount: 1, minTtcSeconds: 1.6 },
        findings: [{ id: 'finding-2' }, { id: 'finding-3' }],
        provenance: {}
      }
    );

    expect(summary.sharedScenario).toBe(true);
    expect(summary.findingDelta).toBe(1);
    expect(summary.interventionDelta).toBe(1);
    expect(summary.metricDeltas.find((metric) => metric.key === 'minTtcSeconds')?.delta).toBe(-0.5);
    expect(summary.provenanceGaps).toHaveLength(1);
  });
});
