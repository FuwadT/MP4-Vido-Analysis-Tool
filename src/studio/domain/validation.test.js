import { describe, expect, it } from 'vitest';
import { VALIDATION_METRICS, VALIDATION_REQUIREMENTS, VALIDATION_RUNS } from '../data/seedData';
import { buildValidationSummary, createValidationHtmlReport } from './validation';

describe('validation summary', () => {
  it('aggregates runs and requirements into coverage output', () => {
    const summary = buildValidationSummary({
      runs: VALIDATION_RUNS,
      requirements: VALIDATION_REQUIREMENTS,
      metrics: VALIDATION_METRICS,
      findings: []
    });

    expect(summary.totals.runs).toBe(VALIDATION_RUNS.length);
    expect(summary.requirementSummaries.length).toBe(VALIDATION_REQUIREMENTS.length);
    expect(summary.byEvidenceType.observed).toBeGreaterThan(0);
  });

  it('renders an HTML report with run evaluations', () => {
    const html = createValidationHtmlReport({
      runs: VALIDATION_RUNS,
      requirements: VALIDATION_REQUIREMENTS,
      metrics: VALIDATION_METRICS,
      findings: []
    });

    expect(html).toContain('ADAS Validation Report');
    expect(html).toContain('Run evaluations');
  });
});
