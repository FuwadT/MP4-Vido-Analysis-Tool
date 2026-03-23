// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { renderReact } from '../../test/renderReact';

let activeRender = null;

afterEach(() => {
  activeRender?.cleanup();
  activeRender = null;
});

describe('CommandPalette', () => {
  it('opens from the quick open button and executes a selected command', () => {
    const actions = {
      openCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      setCommandPaletteQuery: vi.fn(),
      executeCommand: vi.fn()
    };

    activeRender = renderReact(
      <CommandPalette
        state={{
          commandPaletteOpen: false,
          commandPaletteQuery: '',
          commandPaletteResults: [],
          quickOpenQuery: ''
        }}
        actions={actions}
      />
    );

    activeRender.container.querySelector('button')?.click();
    expect(actions.openCommandPalette).toHaveBeenCalled();

    activeRender.rerender(
      <CommandPalette
        state={{
          commandPaletteOpen: true,
          commandPaletteQuery: 'scenario',
          commandPaletteResults: [
            {
              id: 'scenario-1',
              type: 'scenario',
              label: 'Scenario 1',
              subtitle: 'demo',
              action: { kind: 'open-scenario', id: 'scenario-1' }
            }
          ],
          quickOpenQuery: 'scenario'
        }}
        actions={actions}
      />
    );

    const resultButton = activeRender.container.querySelectorAll('button')[1];
    resultButton?.click();
    expect(actions.executeCommand).toHaveBeenCalledWith(expect.objectContaining({ id: 'scenario-1' }));
  });
});
