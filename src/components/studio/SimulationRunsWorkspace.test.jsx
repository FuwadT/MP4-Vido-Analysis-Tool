// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationRunsWorkspace } from './SimulationRunsWorkspace';
import { renderReact } from '../../test/renderReact';

let activeRender = null;

afterEach(() => {
  activeRender?.cleanup();
  activeRender = null;
});

describe('SimulationRunsWorkspace', () => {
  it('updates compare mode selections from the compare panel', () => {
    const actions = {
      createRun: vi.fn(),
      cancelRun: vi.fn(),
      updateSelection: vi.fn(),
      reorderLayoutPanels: vi.fn()
    };
    const runs = [
      { id: 'run-a', label: 'Run A', runType: 'regression', status: 'completed', buildAlias: 'stable', modelAlias: 'default', metrics: { minTtcSeconds: 1.9 }, findings: [], provenance: { honestyLabel: 'Observed-from-log evidence' } },
      { id: 'run-b', label: 'Run B', runType: 'exploratory', status: 'failed', buildAlias: 'candidate', modelAlias: 'challenger', metrics: { minTtcSeconds: 1.2 }, findings: [], provenance: { honestyLabel: 'Physics-simulated counterfactual' } }
    ];

    activeRender = renderReact(
      <SimulationRunsWorkspace
        state={{
          validationRuns: runs,
          compareMode: false,
          compareLeftRunId: 'run-a',
          compareRightRunId: 'run-b'
        }}
        derived={{
          activeLayout: { id: 'layout-compare', panelOrder: [] },
          leftRun: runs[0],
          rightRun: runs[1],
          selectedRun: runs[0],
          validationFindings: []
        }}
        actions={actions}
      />
    );

    const selects = activeRender.container.querySelectorAll('select');
    selects[1].value = 'run-a';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));

    expect(actions.updateSelection).toHaveBeenCalledWith({ compareRightRunId: 'run-a', compareMode: true });
  });
});
