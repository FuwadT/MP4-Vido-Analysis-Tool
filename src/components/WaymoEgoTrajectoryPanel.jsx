import React, { memo, useMemo } from 'react';

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

function magnitude(x, y) {
    if (x == null || y == null) {
        return null;
    }

    return Math.sqrt((x ** 2) + (y ** 2));
}

function lastValue(values) {
    return Array.isArray(values) && values.length > 0 ? Number(values[values.length - 1]) : null;
}

function formatNumber(value, digits = 1, suffix = '') {
    if (!Number.isFinite(value)) {
        return 'Unavailable';
    }

    return `${value.toFixed(digits)}${suffix}`;
}

function formatDurationFromSamples(sampleCount) {
    if (!sampleCount) {
        return 'Unavailable';
    }

    return `${(sampleCount / 4).toFixed(sampleCount % 4 === 0 ? 0 : 1)} s`;
}

function StatusCard({ label, value, hint }) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
            <div className="mt-2 text-lg font-semibold text-slate-100 break-words [overflow-wrap:anywhere]">{value}</div>
            {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
        </div>
    );
}

export const WaymoEgoTrajectoryPanel = memo(function WaymoEgoTrajectoryPanel({ currentFrame }) {
    const size = 280;
    const padding = 24;
    const pastStates = currentFrame?.pastStates || null;
    const futureStates = currentFrame?.futureStates || null;
    const ratedTrajectories = currentFrame?.preferenceTrajectories || [];
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

    const kinematics = useMemo(() => {
        const speedMs = magnitude(lastValue(pastStates?.velX), lastValue(pastStates?.velY));
        const acceleration = magnitude(lastValue(pastStates?.accelX), lastValue(pastStates?.accelY));

        return {
            speedMs,
            speedMph: speedMs == null ? null : speedMs * 2.23694,
            acceleration
        };
    }, [pastStates]);

    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">Ego Behavior</div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-100">Trajectory and motion</h2>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                    {currentFrame?.intent?.label || 'Unknown'}
                </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatusCard
                    label="Speed"
                    value={formatNumber(kinematics.speedMs, 1, ' m/s')}
                    hint={Number.isFinite(kinematics.speedMph) ? `${kinematics.speedMph.toFixed(1)} mph` : null}
                />
                <StatusCard
                    label="Acceleration"
                    value={formatNumber(kinematics.acceleration, 2, ' m/s^2')}
                    hint="Derived from the latest ego history sample"
                />
                <StatusCard
                    label="History Window"
                    value={formatDurationFromSamples(pastStates?.pointCount || 0)}
                    hint={`${pastStates?.pointCount || 0} samples at 4 Hz`}
                />
                <StatusCard
                    label="Future Window"
                    value={formatDurationFromSamples(futureStates?.pointCount || 0)}
                    hint={`${futureStates?.pointCount || 0} future samples present`}
                />
                <StatusCard
                    label="Rated Paths"
                    value={String(ratedTrajectories.length)}
                    hint={ratedTrajectories.length > 0 ? 'Human preference trajectories available' : 'No rater preference paths in this frame'}
                />
                <StatusCard
                    label="Frame ID"
                    value={currentFrame?.frameId || 'Unavailable'}
                    hint="Waymo frame identifier"
                />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-100">Top-down ego path</div>
                        <div className="mt-1 text-xs text-slate-400">Vehicle coordinates, centered at the rear axle</div>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Meters</div>
                </div>

                <svg viewBox={`0 0 ${size} ${size}`} className="mt-4 w-full rounded-xl border border-slate-800 bg-slate-950">
                    <line x1={size / 2} y1={padding / 2} x2={size / 2} y2={size - padding / 2} stroke="#1e293b" strokeWidth="2" />
                    <line x1={padding / 2} y1={size - padding} x2={size - padding / 2} y2={size - padding} stroke="#1e293b" strokeWidth="2" />

                    {pastPolyline ? (
                        <polyline
                            points={pastPolyline}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.95"
                        />
                    ) : null}

                    {futurePolyline ? (
                        <polyline
                            points={futurePolyline}
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}

                    <circle cx={size / 2} cy={size - padding} r="6" fill="#f8fafc" />
                </svg>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-300">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 mr-2" />
                        Past history: {pastStates?.pointCount || 0} samples
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-300">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 mr-2" />
                        Future target: {futureStates?.pointCount || 0} samples
                    </div>
                </div>
            </div>
        </section>
    );
});
