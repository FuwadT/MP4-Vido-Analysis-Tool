import React, { memo } from 'react';

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function buildPolyline(states) {
    if (!states?.pointCount) {
        return [];
    }

    return states.posX.map((x, index) => ({
        x,
        y: states.posY[index] || 0
    }));
}

function projectPoint(point, maxExtent, size, padding) {
    const centerX = size / 2;
    const centerY = size - padding;
    const usable = size - padding * 2;
    const scale = usable / (maxExtent * 2);

    return {
        x: centerX - point.y * scale,
        y: centerY - point.x * scale
    };
}

const TrajectoryPreview = memo(function TrajectoryPreview({ pastStates, futureStates }) {
    const size = 280;
    const padding = 24;
    const pastPoints = buildPolyline(pastStates);
    const futurePoints = buildPolyline(futureStates);
    const allPoints = [{ x: 0, y: 0 }, ...pastPoints, ...futurePoints];

    const maxExtent = Math.max(
        1,
        ...allPoints.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)])
    );

    const pastPolyline = [{ x: 0, y: 0 }, ...pastPoints]
        .map((point) => {
            const projected = projectPoint(point, maxExtent, size, padding);
            return `${projected.x},${projected.y}`;
        })
        .join(' ');

    const futurePolyline = [{ x: 0, y: 0 }, ...futurePoints]
        .map((point) => {
            const projected = projectPoint(point, maxExtent, size, padding);
            return `${projected.x},${projected.y}`;
        })
        .join(' ');

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-100">Ego trajectory</div>
                    <div className="text-xs text-slate-400 mt-1">Top-down path in vehicle coordinates</div>
                </div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Meters</div>
            </div>

            <svg viewBox={`0 0 ${size} ${size}`} className="mt-4 w-full rounded-xl border border-slate-800 bg-slate-950">
                <line x1={size / 2} y1={padding / 2} x2={size / 2} y2={size - padding / 2} stroke="#1e293b" strokeWidth="2" />
                <line x1={padding / 2} y1={size - padding} x2={size - padding / 2} y2={size - padding} stroke="#1e293b" strokeWidth="2" />

                {pastPolyline && (
                    <polyline
                        points={pastPolyline}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.95"
                    />
                )}

                {futurePolyline && (
                    <polyline
                        points={futurePolyline}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                <circle cx={size / 2} cy={size - padding} r="6" fill="#f8fafc" />
            </svg>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-slate-300">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 mr-2" />
                    Past: {pastStates?.pointCount || 0} samples
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-slate-300">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 mr-2" />
                    Future: {futureStates?.pointCount || 0} samples
                </div>
            </div>
        </div>
    );
});

export const WaymoE2EInfoSidebar = memo(function WaymoE2EInfoSidebar({ sessionSummary, currentFrame }) {
    const ratedTrajectories = currentFrame?.preferenceTrajectories || [];

    return (
        <aside className="w-[360px] border-l border-slate-800 bg-slate-950/95 p-5 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">Raw E2E shard</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Vision driving review</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
                This mode opens Waymo end-to-end driving TFRecords directly in the browser. Raw shards expose camera footage
                and ego-driving metadata, not the box tables used by the Parquet annotation workspace.
            </p>

            <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Source</div>
                    <div className="mt-2 text-sm font-medium text-slate-100 break-all">{sessionSummary?.sourceFileName}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-slate-500 text-[11px] uppercase tracking-[0.18em]">Frames</div>
                            <div className="mt-1 text-slate-100 font-semibold">{sessionSummary?.totalFrames || 0}</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-slate-500 text-[11px] uppercase tracking-[0.18em]">File size</div>
                            <div className="mt-1 text-slate-100 font-semibold">{formatBytes(sessionSummary?.fileSize || 0)}</div>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Current frame</div>
                    <div className="mt-2 text-sm text-slate-100 break-all">{currentFrame?.frameId || 'No frame loaded'}</div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-slate-500 text-[11px] uppercase tracking-[0.18em]">Intent</div>
                            <div className="mt-1 text-slate-100 font-semibold">{currentFrame?.intent?.label || 'Unknown'}</div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <div className="text-slate-500 text-[11px] uppercase tracking-[0.18em]">Rated paths</div>
                            <div className="mt-1 text-slate-100 font-semibold">{ratedTrajectories.length}</div>
                        </div>
                    </div>
                </div>

                <TrajectoryPreview
                    pastStates={currentFrame?.pastStates}
                    futureStates={currentFrame?.futureStates}
                />

                {ratedTrajectories.length > 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                        <div className="text-sm font-semibold text-slate-100">Preference trajectories</div>
                        <div className="mt-3 space-y-3">
                            {ratedTrajectories.map((trajectory, index) => (
                                <div key={`${trajectory.preferenceScore ?? 'na'}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                                    Trajectory {index + 1}: {trajectory.pointCount} future samples
                                    {trajectory.preferenceScore !== null && ` | score ${trajectory.preferenceScore.toFixed(1)}`}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
});
