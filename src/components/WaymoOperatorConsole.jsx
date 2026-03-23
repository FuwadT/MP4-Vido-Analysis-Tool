import React, { memo, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BookmarkPlus,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Cloud,
    Gauge,
    Layers3,
    MapPinned,
    Radar,
    Route,
    Tag,
    Timer,
    WandSparkles
} from 'lucide-react';
import { WaymoBirdsEyeMapPanel } from './WaymoBirdsEyeMapPanel';
import { WaymoPlaybackControls } from './WaymoPlaybackControls';
import { WaymoWorldScenePanel } from './WaymoWorldScenePanel';
import { formatTimestampMicros } from '../utils/waymo/normalize';
import { getCameraLabel } from '../utils/waymo/constants';

function formatMetric(value, suffix = '') {
    if (!Number.isFinite(value)) {
        return 'N/A';
    }

    const rounded = Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(1);
    return `${rounded}${suffix}`;
}

function summarizeObjects(objects = []) {
    const grouped = new Map();

    for (const object of objects) {
        const key = object.label || 'Unknown';
        grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 6);
}

function CameraTile({ name, imageUrl, isSelected, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(name)}
            className={`group w-[198px] shrink-0 overflow-hidden rounded-[22px] border text-left transition-all md:w-[214px] ${
                isSelected
                    ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.22)]'
                    : 'border-slate-800 bg-slate-950/88 hover:border-slate-700'
            }`}
        >
            <div className="flex items-center justify-between border-b border-slate-800/90 px-3 py-2">
                <div className="text-xs font-semibold text-slate-100">{getCameraLabel(name)}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {isSelected ? 'Selected' : 'View'}
                </div>
            </div>
            <div className="flex h-[132px] items-center justify-center bg-[linear-gradient(180deg,#020617,#0f172a)] p-2">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={`Waymo ${getCameraLabel(name)}`}
                        className="h-full w-full rounded-xl object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">
                        Camera not loaded yet
                    </div>
                )}
            </div>
        </button>
    );
}

function MetricCard({ icon, label, value, accent = 'text-slate-100' }) {
    const IconComponent = icon;

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/88 px-4 py-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <IconComponent size={12} />
                {label}
            </div>
            <div className={`mt-2 text-lg font-semibold ${accent}`}>{value}</div>
        </div>
    );
}

function RailSection({ eyebrow, title, isOpen, onToggle, children }) {
    return (
        <section className="overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950/94">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-900/35"
            >
                <div>
                    {eyebrow ? <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div> : null}
                    <h3 className="mt-1 text-base font-semibold text-slate-100">{title}</h3>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900/80 p-2 text-slate-300">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </button>

            {isOpen ? (
                <div className="border-t border-slate-800 px-4 pb-4 pt-3">
                    {children}
                </div>
            ) : null}
        </section>
    );
}

function CompactRail({ onToggle, badges, direction = 'right' }) {
    return (
        <div className="flex h-full flex-col items-center gap-4 rounded-[28px] border border-slate-800 bg-slate-950/96 px-3 py-4">
            <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                aria-label="Expand side rail"
            >
                {direction === 'right' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <div className="flex flex-col items-center gap-3">
                {badges.map((badge) => (
                    <div
                        key={badge}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 px-2 py-3 text-center text-[10px] uppercase tracking-[0.22em] text-slate-400 [writing-mode:vertical-rl]"
                    >
                        {badge}
                    </div>
                ))}
            </div>
        </div>
    );
}

export const WaymoOperatorConsole = memo(function WaymoOperatorConsole({
    simulationMode,
    simulationLabel,
    sessionSummary,
    structuredSegmentOptions,
    selectedSegmentId,
    onSelectSegment,
    currentFrame,
    currentFrameIndex,
    isPlaying,
    onSeek,
    onTogglePlay,
    onStep,
    selectedCamera,
    selectableCameras,
    onSelectCamera,
    currentLidarDetections,
    currentObjects,
    lidarCalibrations,
    selectedObject,
    selectedAnnotation,
    selectedAnnotationKey,
    onUpdateAnnotation,
    onExportAnnotations,
    cameraLinkedLidarObjectIds,
    loadingMessage,
    error,
    measurements,
    recentFindings,
    onCreateFinding,
    onCreateBookmark,
    onPromoteScenario
}) {
    const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
    const [isRightRailOpen, setIsRightRailOpen] = useState(true);
    const [worldViewMode, setWorldViewMode] = useState('3d');
    const [openSections, setOpenSections] = useState({
        controls: true,
        measurements: true,
        actions: true,
        map: true,
        object: true,
        findings: true,
        inventory: false,
        replayState: true
    });

    const scenarioMetrics = useMemo(() => {
        const metrics = sessionSummary?.scenario?.metrics || {};
        return {
            distance: formatMetric(metrics.distanceMeters, ' m'),
            avgSpeed: Number.isFinite(metrics.avgSpeedMps) ? `${Math.round(metrics.avgSpeedMps * 2.23694)} mph` : 'N/A',
            duration: formatMetric(metrics.durationSeconds, ' s'),
            objects: formatMetric(metrics.totalObjectCount)
        };
    }, [sessionSummary]);

    const sceneObjects = currentLidarDetections?.length ? currentLidarDetections : currentObjects;
    const objectSummary = useMemo(() => summarizeObjects(sceneObjects), [sceneObjects]);
    const activeTimestamp = currentFrame?.timestamp ? formatTimestampMicros(currentFrame.timestamp) : 'No timestamp';
    const scenarioTitle = sessionSummary?.scenario?.title || sessionSummary?.segmentId || 'Waymo scenario replay';
    const scenarioSummary = sessionSummary?.scenario?.summary || 'Inspect the ego vehicle journey with synchronized sensor playback.';
    const activeImages = currentFrame?.imageUrls;
    const activeFindingCount = recentFindings?.length || 0;
    const scenarioTags = (sessionSummary?.scenario?.tags || []).slice(0, 4);
    const toggleSection = (sectionKey) => {
        setOpenSections((previous) => ({
            ...previous,
            [sectionKey]: !previous[sectionKey]
        }));
    };

    return (
        <div className="flex h-[calc(100vh-11rem)] gap-4 overflow-hidden">
            <aside className={`relative h-full shrink-0 transition-[width] duration-300 ${isLeftRailOpen ? 'w-[320px]' : 'w-[74px]'}`}>
                {isLeftRailOpen ? (
                    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-[30px] border border-slate-800 bg-slate-950/96 p-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Command rail</div>
                            <button
                                type="button"
                                onClick={() => setIsLeftRailOpen(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                                aria-label="Collapse left rail"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </div>

                        <RailSection
                            eyebrow="Replay controls"
                            title="Scenario selection"
                            isOpen={openSections.controls}
                            onToggle={() => toggleSection('controls')}
                        >
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                                        simulationMode === 'cloud'
                                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                    }`}>
                                        {simulationLabel}
                                    </span>
                                    <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                                        {getCameraLabel(selectedCamera)}
                                    </span>
                                </div>

                                <label className="block">
                                    <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Scenario</div>
                                    <select
                                        value={selectedSegmentId || ''}
                                        onChange={(event) => onSelectSegment?.(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                                    >
                                        {(structuredSegmentOptions?.length || 0) > 0 ? structuredSegmentOptions.map((option) => (
                                            <option key={option.segmentId} value={option.segmentId}>
                                                {option.scenario?.title || option.segmentId}
                                            </option>
                                        )) : (
                                            <option value="">No scenarios available</option>
                                        )}
                                    </select>
                                </label>

                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Replay time</div>
                                    <div className="mt-2 text-lg font-semibold text-slate-100">{activeTimestamp}</div>
                                    <div className="mt-1 text-sm text-slate-400">
                                        Frame {currentFrameIndex + 1} of {sessionSummary?.totalFrames || 0}
                                    </div>
                                </div>
                            </div>
                        </RailSection>

                        <RailSection
                            eyebrow="Measurements"
                            title="Live telemetry"
                            isOpen={openSections.measurements}
                            onToggle={() => toggleSection('measurements')}
                        >
                            <div className="grid gap-3">
                                <MetricCard icon={Gauge} label="Ego speed" value={formatMetric(measurements?.egoSpeedMps, ' m/s')} accent="text-emerald-200" />
                                <MetricCard icon={Radar} label="Relative distance" value={formatMetric(measurements?.relativeDistanceMeters, ' m')} />
                                <MetricCard icon={Route} label="Relative speed" value={formatMetric(measurements?.relativeSpeedMps, ' m/s')} />
                                <MetricCard icon={Timer} label="Event duration" value={formatMetric(measurements?.eventDurationSeconds, ' s')} />
                                <MetricCard icon={MapPinned} label="World position" value={`${formatMetric(measurements?.worldX)}, ${formatMetric(measurements?.worldY)}`} />
                            </div>
                        </RailSection>

                        <RailSection
                            eyebrow="Actions"
                            title="Review handoff"
                            isOpen={openSections.actions}
                            onToggle={() => toggleSection('actions')}
                        >
                            <div className="grid gap-3">
                                <button
                                    type="button"
                                    onClick={onCreateFinding}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                                >
                                    <AlertTriangle size={16} />
                                    Create finding
                                </button>
                                <button
                                    type="button"
                                    onClick={onCreateBookmark}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
                                >
                                    <BookmarkPlus size={16} />
                                    Bookmark replay
                                </button>
                                <button
                                    type="button"
                                    onClick={onPromoteScenario}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
                                >
                                    <WandSparkles size={16} />
                                    Promote to scenario
                                </button>
                                <button
                                    type="button"
                                    onClick={onExportAnnotations}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
                                >
                                    <Tag size={16} />
                                    Export annotations
                                </button>
                            </div>
                        </RailSection>
                    </div>
                ) : (
                    <CompactRail
                        onToggle={() => setIsLeftRailOpen(true)}
                        badges={[simulationLabel, getCameraLabel(selectedCamera), `Findings ${activeFindingCount}`]}
                        direction="right"
                    />
                )}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
                <section className="shrink-0 rounded-[30px] border border-slate-800 bg-slate-950/96 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-4xl">
                            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-emerald-400">
                                {simulationMode === 'cloud' ? <Cloud size={12} /> : <Layers3 size={12} />}
                                Scenario replay
                            </div>
                            <h1 className="mt-2 text-3xl font-semibold text-slate-100">{scenarioTitle}</h1>
                            <p className="mt-2 text-sm leading-7 text-slate-400">{scenarioSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                                    Active camera {getCameraLabel(selectedCamera)}
                                </span>
                                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                                    {activeTimestamp}
                                </span>
                                {scenarioTags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard icon={Route} label="Distance" value={scenarioMetrics.distance} />
                            <MetricCard icon={Gauge} label="Avg speed" value={scenarioMetrics.avgSpeed} accent="text-emerald-200" />
                            <MetricCard icon={Timer} label="Duration" value={scenarioMetrics.duration} />
                            <MetricCard icon={Radar} label="Objects" value={scenarioMetrics.objects} />
                        </div>
                    </div>
                </section>

                <div className="min-h-0 flex-1">
                    <WaymoWorldScenePanel
                        viewMode={worldViewMode}
                        onChangeViewMode={setWorldViewMode}
                        trajectory={sessionSummary?.egoTrajectory}
                        egoPose={currentFrame?.egoPose}
                        pointCloud={currentFrame?.lidarPointCloud}
                        lidarCalibrations={lidarCalibrations}
                        detections={currentLidarDetections}
                        cameraLinkedObjectIds={cameraLinkedLidarObjectIds}
                        selectedAnnotationKey={selectedAnnotationKey}
                        isLoading={currentFrame?.lidarStatus === 'loading'}
                    />
                </div>

                <section className="shrink-0 rounded-[28px] border border-slate-800 bg-slate-950/94 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                                <Camera size={12} />
                                Camera row
                            </div>
                            <h2 className="mt-2 text-lg font-semibold text-slate-100">Synchronized surround cameras</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                                Horizontal filmstrip
                            </span>
                            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                                {activeTimestamp}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                        {selectableCameras.map((cameraName) => (
                            <CameraTile
                                key={cameraName}
                                name={cameraName}
                                imageUrl={activeImages?.get(cameraName) || null}
                                isSelected={cameraName === selectedCamera}
                                onSelect={onSelectCamera}
                            />
                        ))}
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
                </section>
            </div>

            <aside className={`relative h-full shrink-0 transition-[width] duration-300 ${isRightRailOpen ? 'w-[360px]' : 'w-[74px]'}`}>
                {isRightRailOpen ? (
                    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-[30px] border border-slate-800 bg-slate-950/96 p-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Context rail</div>
                            <button
                                type="button"
                                onClick={() => setIsRightRailOpen(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                                aria-label="Collapse right rail"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <RailSection
                            eyebrow="Map"
                            title="Bird's-eye view"
                            isOpen={openSections.map}
                            onToggle={() => toggleSection('map')}
                        >
                            <WaymoBirdsEyeMapPanel
                                embedded
                                compact
                                trajectory={sessionSummary?.egoTrajectory}
                                egoPose={currentFrame?.egoPose}
                                scenario={sessionSummary?.scenario}
                                currentObjects={sceneObjects}
                                selectedObject={selectedObject}
                            />
                        </RailSection>

                        <RailSection
                            eyebrow="Selected object"
                            title={selectedObject?.label || 'No object selected'}
                            isOpen={openSections.object}
                            onToggle={() => toggleSection('object')}
                        >
                            {selectedObject ? (
                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                        <div className="break-all text-xs text-slate-400">{selectedObject.objectId}</div>
                                        <div className="mt-2 text-sm text-slate-300">
                                            Tags {selectedObject.tags?.join(', ') || 'None'}
                                        </div>
                                    </div>
                                    <label className="block">
                                        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Review status</div>
                                        <select
                                            value={selectedAnnotation?.status || 'unreviewed'}
                                            onChange={(event) => onUpdateAnnotation({ status: event.target.value })}
                                            className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                                        >
                                            <option value="unreviewed">Unreviewed</option>
                                            <option value="validated">Validated</option>
                                            <option value="needs-follow-up">Needs follow-up</option>
                                            <option value="ignore">Ignore</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Notes</div>
                                        <textarea
                                            rows={4}
                                            value={selectedAnnotation?.notes || ''}
                                            onChange={(event) => onUpdateAnnotation({ notes: event.target.value })}
                                            className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-500">
                                    Select a detected object from the replay to annotate it here.
                                </div>
                            )}
                        </RailSection>

                        <RailSection
                            eyebrow="Review queue"
                            title="Recent findings"
                            isOpen={openSections.findings}
                            onToggle={() => toggleSection('findings')}
                        >
                            <div className="space-y-2">
                                {activeFindingCount > 0 ? recentFindings.slice(0, 4).map((finding) => (
                                    <div key={finding.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                                        <div className="text-sm font-semibold text-slate-100">{finding.title}</div>
                                        <div className="mt-1 text-xs leading-6 text-slate-400">{finding.summary}</div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-500">
                                        No findings have been captured from this replay yet.
                                    </div>
                                )}
                            </div>
                        </RailSection>

                        <RailSection
                            eyebrow="Replay summary"
                            title="Scene inventory"
                            isOpen={openSections.inventory}
                            onToggle={() => toggleSection('inventory')}
                        >
                            <div className="space-y-2">
                                {objectSummary.length > 0 ? objectSummary.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3"
                                    >
                                        <span className="text-sm text-slate-200">{item.label}</span>
                                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{item.count}</span>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-500">
                                        No objects are visible in this replay context yet.
                                    </div>
                                )}
                            </div>
                        </RailSection>

                        {(loadingMessage || error) ? (
                            <RailSection
                                eyebrow="Replay state"
                                title="Warnings"
                                isOpen={openSections.replayState}
                                onToggle={() => toggleSection('replayState')}
                            >
                                <div className="space-y-2 text-sm leading-6 text-amber-100">
                                    {loadingMessage ? <div>{loadingMessage}</div> : null}
                                    {error ? <div>{error}</div> : null}
                                </div>
                            </RailSection>
                        ) : null}
                    </div>
                ) : (
                    <CompactRail
                        onToggle={() => setIsRightRailOpen(true)}
                        badges={['Map', 'Objects', `Findings ${activeFindingCount}`]}
                        direction="left"
                    />
                )}
            </aside>
        </div>
    );
});
