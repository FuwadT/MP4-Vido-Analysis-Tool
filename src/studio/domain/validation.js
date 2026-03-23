import { RUN_STATUSES } from './models.js';

function toMetricMap(metrics = []) {
  return new Map(metrics.map((metric) => [metric.key, metric]));
}

function compareMetric(metric, value) {
  if (!metric) {
    return { status: 'unknown', observed: value, expected: null };
  }

  const observed = Number.isFinite(Number(value)) ? Number(value) : value;
  const threshold = metric.passThreshold;

  if (metric.passDirection === 'equals') {
    return {
      status: observed === threshold ? 'pass' : 'fail',
      observed,
      expected: threshold
    };
  }

  if (metric.passDirection === 'min') {
    return {
      status: Number(observed) >= Number(threshold) ? 'pass' : 'fail',
      observed,
      expected: threshold
    };
  }

  return {
    status: Number(observed) <= Number(threshold) ? 'pass' : 'fail',
    observed,
    expected: threshold
  };
}

export function aggregateRunEvaluations(runs = [], validationMetrics = []) {
  const metricMap = toMetricMap(validationMetrics);

  return runs.map((run) => {
    const evaluations = Object.entries(run.metrics || {}).map(([key, value]) => ({
      key,
      ...(compareMetric(metricMap.get(key), value))
    }));
    const failedMetrics = evaluations.filter((evaluation) => evaluation.status === 'fail');

    return {
      runId: run.id,
      runLabel: run.label,
      status: run.status,
      evidenceType: run.provenance?.evidenceType || 'observed',
      failedMetrics,
      passed: failedMetrics.length === 0 && ![RUN_STATUSES.FAILED].includes(run.status)
    };
  });
}

export function buildValidationSummary({
  runs = [],
  requirements = [],
  metrics = [],
  findings = []
}) {
  const runEvaluations = aggregateRunEvaluations(runs, metrics);
  const requirementMap = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const requirementSummaries = requirements.map((requirement) => {
    const relatedRuns = runs.filter((run) => requirement.linkedScenarioIds.includes(run.scenarioId));
    const relatedFindings = findings.filter((finding) => requirement.linkedScenarioIds.includes(finding.linkedScenarioId));
    const failedRuns = relatedRuns.filter((run) => run.status === RUN_STATUSES.FAILED);

    return {
      requirementId: requirement.id,
      code: requirement.code,
      title: requirement.title,
      relatedRunCount: relatedRuns.length,
      relatedFindingCount: relatedFindings.length,
      status: failedRuns.length > 0 ? 'attention' : relatedRuns.length > 0 ? 'covered' : 'uncovered'
    };
  });

  const byEvidenceType = runs.reduce((accumulator, run) => {
    const key = run.provenance?.evidenceType || 'observed';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      runs: runs.length,
      findings: findings.length,
      requirements: requirements.length,
      passedRuns: runs.filter((run) => [RUN_STATUSES.COMPLETED, RUN_STATUSES.PASSED].includes(run.status)).length,
      failedRuns: runs.filter((run) => run.status === RUN_STATUSES.FAILED).length
    },
    byEvidenceType,
    requirementSummaries,
    runEvaluations,
    openRequirements: requirementSummaries.filter((item) => item.status !== 'covered').map((item) => requirementMap.get(item.requirementId)?.code || item.requirementId)
  };
}

export function createValidationJsonReport(payload) {
  return {
    reportVersion: 1,
    ...buildValidationSummary(payload),
    exportedAt: new Date().toISOString()
  };
}

export function createValidationHtmlReport(payload) {
  const summary = createValidationJsonReport(payload);
  const requirementRows = summary.requirementSummaries.map((item) => {
    return `<tr><td>${item.code}</td><td>${item.title}</td><td>${item.relatedRunCount}</td><td>${item.relatedFindingCount}</td><td>${item.status}</td></tr>`;
  }).join('');

  const runRows = summary.runEvaluations.map((item) => {
    return `<tr><td>${item.runLabel}</td><td>${item.status}</td><td>${item.evidenceType}</td><td>${item.failedMetrics.map((metric) => metric.key).join(', ') || 'none'}</td></tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ADAS Validation Report</title>
    <style>
      body { font-family: Arial, sans-serif; background: #020617; color: #e2e8f0; margin: 0; padding: 32px; }
      h1, h2 { margin: 0 0 12px; }
      .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #1e293b; padding: 10px 8px; text-align: left; }
      th { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>ADAS Validation Report</h1>
      <p>Generated at ${summary.exportedAt}. Observed, simulated, and generated evidence remain separated in this report.</p>
      <p>Total runs: ${summary.totals.runs} | Failed runs: ${summary.totals.failedRuns} | Findings: ${summary.totals.findings}</p>
    </div>
    <div class="card">
      <h2>Requirement coverage</h2>
      <table>
        <thead><tr><th>Code</th><th>Title</th><th>Runs</th><th>Findings</th><th>Status</th></tr></thead>
        <tbody>${requirementRows}</tbody>
      </table>
    </div>
    <div class="card">
      <h2>Run evaluations</h2>
      <table>
        <thead><tr><th>Run</th><th>Status</th><th>Evidence</th><th>Failed metrics</th></tr></thead>
        <tbody>${runRows}</tbody>
      </table>
    </div>
  </body>
</html>`;
}
