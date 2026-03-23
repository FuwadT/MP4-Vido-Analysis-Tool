// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderReact } from '../test/renderReact';

vi.mock('./WaymoImageViewer', () => ({
  WaymoImageViewer: () => <div data-testid="image-viewer">image</div>
}));

vi.mock('./WaymoLidarViewer', () => ({
  WaymoLidarViewer: () => <div data-testid="lidar-viewer">lidar</div>
}));

vi.mock('./WaymoPlaybackControls', () => ({
  WaymoPlaybackControls: () => <div data-testid="playback-controls">controls</div>
}));

vi.mock('./WaymoScene3DViewer', () => ({
  WaymoScene3DViewer: () => <div data-testid="scene-3d">scene</div>
}));

const { WaymoOperatorConsole } = await import('./WaymoOperatorConsole');

let activeRender = null;

afterEach(() => {
  activeRender?.cleanup();
  activeRender = null;
});

describe('WaymoOperatorConsole', () => {
  it('lets the operator create a finding from replay context', () => {
    const onCreateFinding = vi.fn();

    activeRender = renderReact(
      <WaymoOperatorConsole
        simulationMode="cloud"
        simulationLabel="Cloud simulation"
        sessionSummary={{ totalFrames: 10, scenario: { title: 'Scenario', summary: 'Demo', tags: [], metrics: {} }, stats: {}, egoTrajectory: [] }}
        structuredSegmentOptions={[{ segmentId: 'segment-1', scenario: { title: 'Scenario' } }]}
        selectedSegmentId="segment-1"
        onSelectSegment={vi.fn()}
        currentFrame={{ timestamp: 1000, egoPose: { x: 0, y: 0 }, availableCameras: [] }}
        currentFrameIndex={0}
        isPlaying={false}
        onSeek={vi.fn()}
        onTogglePlay={vi.fn()}
        onStep={vi.fn()}
        selectedCamera={1}
        selectableCameras={[1]}
        onSelectCamera={vi.fn()}
        activeImageUrl={null}
        calibrations={[]}
        currentCameraDetections={[]}
        currentLidarDetections={[]}
        currentObjects={[]}
        selectedObject={null}
        selectedAnnotation={null}
        selectedAnnotationKey={null}
        onSelectObject={vi.fn()}
        onUpdateAnnotation={vi.fn()}
        onExportAnnotations={vi.fn()}
        cameraLinkedLidarObjectIds={new Set()}
        loadingMessage=""
        error=""
        measurements={{ egoSpeedMps: 8.2 }}
        recentFindings={[]}
        onCreateFinding={onCreateFinding}
        onCreateBookmark={vi.fn()}
        onPromoteScenario={vi.fn()}
      />
    );

    const button = Array.from(activeRender.container.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes('Create finding'));
    button?.click();
    expect(onCreateFinding).toHaveBeenCalled();
  });
});
