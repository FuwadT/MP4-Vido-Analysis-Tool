// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationWorkspace } from './ValidationWorkspace';
import { renderReact } from '../../test/renderReact';

let activeRender = null;

afterEach(() => {
  activeRender?.cleanup();
  activeRender = null;
});

describe('ValidationWorkspace', () => {
  it('calls export when the report action is selected', () => {
    const actions = {
      exportValidationReport: vi.fn(),
      reorderLayoutPanels: vi.fn()
    };

    activeRender = renderReact(
      <ValidationWorkspace
        state={{ validationRuns: [], validationSuites: [] }}
        derived={{
          activeLayout: { id: 'layout-validation', panelOrder: [] },
          coverage: { passCount: 1, failCount: 0, findingCount: 2 },
          validationSummary: { byEvidenceType: { observed: 1 }, requirementSummaries: [] },
          validationFindings: []
        }}
        registries={{
          validationRequirements: [{ id: 'req-1', code: 'REQ-1', title: 'Requirement', description: 'Desc', status: 'active' }],
          validationMetrics: [{ id: 'metric-1', key: 'collisionFree', title: 'Collision free', source: 'observer', passDirection: 'equals', passThreshold: 1, unit: 'boolean' }]
        }}
        actions={actions}
      />
    );

    const exportButton = Array.from(activeRender.container.querySelectorAll('button')).find((button) => button.textContent?.includes('Export HTML'));
    exportButton?.click();
    expect(actions.exportValidationReport).toHaveBeenCalled();
  });
});
