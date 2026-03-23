import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

export function renderReact(element) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender(nextElement) {
      act(() => {
        root.render(nextElement);
      });
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}
