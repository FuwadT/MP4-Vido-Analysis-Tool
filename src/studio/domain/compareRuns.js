export function buildCompareSummary(leftRun, rightRun) {
  if (!leftRun || !rightRun) {
    return null;
  }

  const metricKeys = Array.from(new Set([
    ...Object.keys(leftRun.metrics || {}),
    ...Object.keys(rightRun.metrics || {})
  ]));

  return {
    leftRunId: leftRun.id,
    rightRunId: rightRun.id,
    sharedScenario: Boolean(leftRun.scenarioId && leftRun.scenarioId === rightRun.scenarioId),
    metricDeltas: metricKeys.map((key) => {
      const leftValue = Number(leftRun.metrics?.[key] ?? 0);
      const rightValue = Number(rightRun.metrics?.[key] ?? 0);
      const bothNumeric = Number.isFinite(leftValue) && Number.isFinite(rightValue);

      return {
        key,
        leftValue: leftRun.metrics?.[key] ?? null,
        rightValue: rightRun.metrics?.[key] ?? null,
        delta: bothNumeric ? Number((rightValue - leftValue).toFixed(3)) : null
      };
    }),
    findingDelta: (rightRun.findings?.length || 0) - (leftRun.findings?.length || 0),
    interventionDelta: Number(rightRun.metrics?.interventionCount || 0) - Number(leftRun.metrics?.interventionCount || 0),
    provenanceGaps: [
      leftRun.provenance?.honestyLabel ? null : `${leftRun.label} missing provenance label`,
      rightRun.provenance?.honestyLabel ? null : `${rightRun.label} missing provenance label`
    ].filter(Boolean)
  };
}
