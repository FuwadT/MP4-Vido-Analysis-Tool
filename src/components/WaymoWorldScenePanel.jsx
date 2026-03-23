import React, { memo } from 'react';
import { Box, Orbit, Radar } from 'lucide-react';
import { WaymoLidarViewer } from './WaymoLidarViewer';
import { WaymoScene3DViewer } from './WaymoScene3DViewer';

function ToggleButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${active ? 'border-sky-400 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'}`}
        >
            {label}
        </button>
    );
}

export const WaymoWorldScenePanel = memo(function WaymoWorldScenePanel({
    viewMode,
    onChangeViewMode,
    trajectory,
    egoPose,
    pointCloud,
    lidarCalibrations,
    detections,
    cameraLinkedObjectIds,
    selectedAnnotationKey,
    isLoading
}) {
    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950/96">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-sky-300">
                        <Orbit size={12} />
                        World scene
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-100">
                        {viewMode === '3d' ? '3D ego-follow scene' : '2D LiDAR world scene'}
                    </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <ToggleButton active={viewMode === '2d'} label="2D" onClick={() => onChangeViewMode('2d')} />
                    <ToggleButton active={viewMode === '3d'} label="3D" onClick={() => onChangeViewMode('3d')} />
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                        Points {(pointCloud?.renderedPointCount || 0).toLocaleString()}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                        Boxes {(detections?.length || 0).toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="border-b border-slate-800 px-5 py-3">
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                        <Radar size={12} />
                        Live point cloud
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                        <Box size={12} />
                        Object overlays
                    </span>
                </div>
            </div>

            <div className="min-h-0 flex-1 p-3 md:p-4">
                {viewMode === '3d' ? (
                    <WaymoScene3DViewer
                        embedded
                        panelHeightClass="h-full min-h-[300px]"
                        trajectory={trajectory}
                        egoPose={egoPose}
                        pointCloud={pointCloud}
                        lidarCalibrations={lidarCalibrations}
                        detections={detections}
                        cameraLinkedObjectIds={cameraLinkedObjectIds}
                        selectedAnnotationKey={selectedAnnotationKey}
                        isLoading={isLoading}
                    />
                ) : (
                    <WaymoLidarViewer
                        embedded
                        canvasHeightClass="h-full min-h-[300px]"
                        pointCloud={pointCloud}
                        isLoading={isLoading}
                        detections={detections}
                        selectedAnnotationKey={selectedAnnotationKey}
                    />
                )}
            </div>
        </section>
    );
});
