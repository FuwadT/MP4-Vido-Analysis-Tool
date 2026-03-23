import React from 'react';
import { StudioShell } from './components/studio/StudioShell';
import { useStudioState } from './studio/useStudioState';

function App() {
  const studio = useStudioState();

  return (
    <StudioShell
      state={studio.state}
      derived={studio.derived}
      registries={studio.registries}
      actions={studio.actions}
    />
  );
}

export default App;
