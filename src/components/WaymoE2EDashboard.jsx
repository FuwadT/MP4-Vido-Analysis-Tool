import React, { memo, useMemo } from 'react';
import { Activity, Camera, Gauge, GitBranch, Image as ImageIcon, Radar } from 'lucide-react';
import { WaymoImageViewer } from './WaymoImageViewer';
import { WaymoPlaybackControls } from './WaymoPlaybackControls';
import { WaymoEgoTrajectoryPanel } from './WaymoEgoTrajectoryPanel';
import { getCameraLabel } from '../utils/waymo/constants';
import { getImageDimensions } from '../utils/waymo/normalize';

function SensorCard({ icon, label, value, hint, tone = 'default' }) {
    const toneClasses = tone === 'accent'
        ? 'border-emerald-500/30 bg-emerald-500/10'
        : tone === 'warning'
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-slate-800 bg-slate-950/70';
    const iconNode = icon ? React.createElement(icon, { size: 16 }) : null;

    return (
        <div className={`rounded-2xl border p-4 ${toneClasses}`}>
            <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-200">
                    {iconNode}
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-100 break-words [overflow-wrap:anywhere]">{value}</div>
                    {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
                </div>
            </div>
        </div>
    );
}

const CameraTile = memo(function CameraTile({
    cameraName,
    imageUrl,
    calibrations,
    isSelected,
    onSelect
}) {
    const dimensions = useMemo(
        () => getImageDimensions(cameraName, calibrations),
        [cameraName, calibrations]
    );

    return (
        <button
            onClick={() => onSelect(cameraName)}
            className={`group rounded-2xl border p-2 text-left transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/80'}`}
        >
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{getCameraLabel(cameraName)}</div>
                    <div className="text-xs text-slate-400">{dimensions.width}x{dimensions.height}</div>
                </div>
                <div className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isSelected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                    {isSelected ? 'Live' : 'View'}
                </div>
            </div>

            <div
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`${getCameraLabel(cameraName)} preview`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                        No image
                    </div>
                )}
            </div>
        </button>
    );
});

export const WaymoE2EDashboard = memo(function WaymoE2EDashboard({
    sessionSummary,
    currentFrame,
    selectedCamera,
    selectableCameras,
    onSelectCamera,
    currentFrameIndex,
    isPlaying,
    onSeek,
    onTogglePlay,
    onStep,
    loadingMessage,
    error
}) {
    const activeImageUrl = currentFrame?.imageUrls?.get(selectedCamera) || null;
    const calibrations = currentFrame?.cameraCalibrations || sessionSummary?.cameraCalibrations || [];
    const futureSamples = currentFrame?.futureStates?.pointCount || 0;
    const lidarAvailable = false;

    return (
        <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-4 md:p-6 space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_380px]">
                    <section className="rounded-[30px] border border-slate-800 bg-slate-900/80 p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">One Stop Shop</div>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-100">Ego camera cockpit</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                                    Review the current ego frame, switch across synchronized cameras, and keep the driving behavior context in view.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                                Frame {currentFrameIndex + 1} / {sessionSummary?.totalFrames || 0}
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SensorCard
                                icon={Gauge}
                                label="Intent"
                                value={currentFrame?.intent?.label || 'Unknown'}
                                hint="Current ego behavior target"
                                tone="accent"
                            />
                            <SensorCard
                                icon={Camera}
                                label="Camera Views"
                                value={`${currentFrame?.availableCameras?.length || 0}`}
                                hint="Synchronized cameras in this frame"
                            />
                            <SensorCard
                                icon={GitBranch}
                                label="Future Trajectory"
                                value={futureSamples > 0 ? `${futureSamples} samples` : 'Unavailable'}
                                hint={futureSamples > 0 ? 'Prediction targets present' : 'This frame does not expose future targets'}
                                tone={futureSamples > 0 ? 'accent' : 'warning'}
                            />
                            <SensorCard
                                icon={Radar}
                                label="LiDAR"
                                value={lidarAvailable ? 'Available' : 'Not in shard'}
                                hint="Waymo E2E camera shards do not include LiDAR returns"
                                tone="warning"
                            />
                        </div>

                        <div className="mt-5 h-[clamp(320px,52vh,620px)]">
                            <WaymoImageViewer
                                imageUrl={activeImageUrl}
                                cameraName={selectedCamera}
                                calibrations={calibrations}
                                detections={[]}
                                selectedAnnotationKey={null}
                                onSelectDetection={null}
                            />
                        </div>

                        <div className="mt-4">
                            <WaymoPlaybackControls
                                currentFrameIndex={currentFrameIndex}
                                totalFrames={sessionSummary?.totalFrames || 0}
                                isPlaying={isPlaying}
                                onSeek={onSeek}
                                onTogglePlay={onTogglePlay}
                                onStep={onStep}
                            />
                        </div>

                        {loadingMessage ? (
                            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                                {loadingMessage}
                            </div>
                        ) : null}

                        {error ? (
                            <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        ) : null}
                    </section>

                    <div className="space-y-4">
                        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-slate-200">
                                    <ImageIcon size={16} />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">Camera Atlas</div>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-100">All synchronized views</h3>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {selectableCameras.map((cameraName) => (
                                    <CameraTile
                                        key={cameraName}
                                        cameraName={cameraName}
                                        imageUrl={currentFrame?.imageUrls?.get(cameraName) || null}
                                        calibrations={calibrations}
                                        isSelected={cameraName === selectedCamera}
                                        onSelect={onSelectCamera}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-slate-200">
                                    <Activity size={16} />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">Session Context</div>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-100">Ego metadata</h3>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3">
                                <SensorCard
                                    icon={Camera}
                                    label="Selected Camera"
                                    value={getCameraLabel(selectedCamera)}
                                    hint="Current hero view"
                                    tone="accent"
                                />
                                <SensorCard
                                    icon={ImageIcon}
                                    label="Source File"
                                    value={sessionSummary?.sourceFileName || 'Unknown'}
                                    hint={currentFrame?.frameId || 'No frame loaded'}
                                />
                            </div>
                        </section>
                    </div>
                </div>

                <WaymoEgoTrajectoryPanel currentFrame={currentFrame} />
            </div>
        </div>
    );
});
