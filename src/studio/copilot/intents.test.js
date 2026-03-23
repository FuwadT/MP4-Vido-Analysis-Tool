import { describe, expect, it } from 'vitest';
import { parseStudioPrompt } from './intents';

describe('parseStudioPrompt', () => {
  it('creates a validation suite plan with structured payload', () => {
    const plan = parseStudioPrompt(
      'Generate a validation suite for unprotected left turns in medium traffic.',
      { activeScenarioId: 'scenario-unprotected-left', activeBuildAlias: 'stable', activeModelAlias: 'default' }
    );

    expect(plan.intentType).toBe('validation-suite');
    expect(plan.artifact.suiteName).toContain('unprotected left');
    expect(plan.artifact.actions[0].kind).toBe('save-validation-suite');
  });

  it('creates a replay finding plan', () => {
    const plan = parseStudioPrompt(
      'Create a high severity finding for the late brake onset.',
      { activeScenarioId: 'scenario-urban-cut-in' }
    );

    expect(plan.intentType).toBe('finding-create');
    expect(plan.artifact.severity).toBe('high');
    expect(plan.artifact.actions[0].kind).toBe('create-finding');
  });

  it('creates a compare plan with explicit left and right aliases', () => {
    const plan = parseStudioPrompt(
      'Compare stable vs candidate build on this scenario and show object-tracking regressions.',
      { activeScenarioId: 'scenario-urban-cut-in', activeBuildAlias: 'stable', activeModelAlias: 'default' }
    );

    expect(plan.intentType).toBe('compare-runs');
    expect(plan.artifact.left.buildAlias).toBe('stable');
    expect(plan.artifact.right.buildAlias).toBe('candidate');
  });
});
