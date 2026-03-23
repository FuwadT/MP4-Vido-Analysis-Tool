import React, { memo, useMemo } from 'react';
import { AlertTriangle, MapPinned, TrafficCone } from 'lucide-react';
import { buildInferredRoadContext } from '../utils/waymo/roadContext';

function projectLocalPoint(point, viewport, width, height, padding = 24) {
    const forwardSpan = Math.max(viewport.maxForward - viewport.minForward, 1);
    const lateralSpan = Math.max(viewport.maxLateral - viewport.minLateral, 1);
    const usableWidth = Math.max(width - (padding * 2), 1);
    const usableHeight = Math.max(height - (padding * 2), 1);

    return {
        x: padding + (((point.lateral - viewport.minLateral) / lateralSpan) * usableWidth),
        y: padding + (((viewport.maxForward - point.forward) / forwardSpan) * usableHeight)
    };
}

function LocalLine({ line, viewport, stroke, strokeWidth = 2, dashed = false }) {
    const from = projectLocalPoint(line.from, viewport, 1000, 1000);
    const to = projectLocalPoint(line.to, viewport, 1000, 1000);

    return (
        <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dashed ? '10 8' : undefined}
            strokeLinecap="round"
        />
    );
}

export const WaymoBirdsEyeMapPanel = memo(function WaymoBirdsEyeMapPanel({
    trajectory,
    egoPose,
    scenario,
    currentObjects,
    selectedObject,
    compact = false,
    embedded = false
}) {
    const context = useMemo(() => {
        return buildInferredRoadContext({
            trajectory,
            egoPose,
            scenario,
            currentObjects,
            selectedObject
        });
    }, [currentObjects, egoPose, scenario, selectedObject, trajectory]);

    const { viewport } = context;
    const trajectoryPoints = context.localTrajectory
        .map((sample) => projectLocalPoint({ forward: sample.forward, lateral: sample.lateral }, viewport, 1000, 1000))
        .map((point) => `${point.x},${point.y}`)
        .join(' ');

    const content = (
        <>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-emerald-300">
                        <MapPinned size={12} />
                        Bird&apos;s-eye context
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-100">Ego-follow roadway map</h3>
                    {!compact ? (
                        <p className="mt-1 max-w-3xl text-sm text-slate-400">
                            The map window follows the ego vehicle in real time. Road edges, lane lines, the intersection pocket,
                            and roadside controls are displayed as observed-or-inferred context, not as audited HD map truth.
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                        Ego-centered
                    </span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                        {context.honestyLabel}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                        Actors {context.spatialObjects.length}
                    </span>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.76),rgba(2,6,23,1))]">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <span>Forward up</span>
                    <span>Local roadway context</span>
                </div>

                <div className={`relative ${compact ? 'h-[220px]' : 'h-[280px] md:h-[320px]'}`}>
                    <svg viewBox="0 0 1000 1000" className="h-full w-full">
                        <rect x="0" y="0" width="1000" height="1000" fill="#050816" />

                        <rect
                            x={projectLocalPoint({ forward: viewport.maxForward, lateral: -context.roadHalfWidth }, viewport, 1000, 1000).x}
                            y={projectLocalPoint({ forward: viewport.maxForward, lateral: -context.roadHalfWidth }, viewport, 1000, 1000).y}
                            width={
                                projectLocalPoint({ forward: viewport.maxForward, lateral: context.roadHalfWidth }, viewport, 1000, 1000).x
                                - projectLocalPoint({ forward: viewport.maxForward, lateral: -context.roadHalfWidth }, viewport, 1000, 1000).x
                            }
                            height={
                                projectLocalPoint({ forward: viewport.minForward, lateral: -context.roadHalfWidth }, viewport, 1000, 1000).y
                                - projectLocalPoint({ forward: viewport.maxForward, lateral: -context.roadHalfWidth }, viewport, 1000, 1000).y
                            }
                            fill="rgba(30,41,59,0.86)"
                        />

                        {context.crossStreet && (
                            <rect
                                x={projectLocalPoint({ forward: context.crossStreet.centerForward + context.crossStreet.halfDepth, lateral: -context.crossStreet.halfWidth }, viewport, 1000, 1000).x}
                                y={projectLocalPoint({ forward: context.crossStreet.centerForward + context.crossStreet.halfDepth, lateral: -context.crossStreet.halfWidth }, viewport, 1000, 1000).y}
                                width={
                                    projectLocalPoint({ forward: context.crossStreet.centerForward + context.crossStreet.halfDepth, lateral: context.crossStreet.halfWidth }, viewport, 1000, 1000).x
                                    - projectLocalPoint({ forward: context.crossStreet.centerForward + context.crossStreet.halfDepth, lateral: -context.crossStreet.halfWidth }, viewport, 1000, 1000).x
                                }
                                height={
                                    projectLocalPoint({ forward: context.crossStreet.centerForward - context.crossStreet.halfDepth, lateral: -context.crossStreet.halfWidth }, viewport, 1000, 1000).y
                                    - projectLocalPoint({ forward: context.crossStreet.centerForward + context.crossStreet.halfDepth, lateral: -context.crossStreet.halfWidth }, viewport, 1000, 1000).y
                                }
                                fill="rgba(30,41,59,0.86)"
                            />
                        )}

                        {context.curbLines.map((line, index) => (
                            <LocalLine key={`curb-${index}`} line={line} viewport={viewport} stroke="rgba(148,163,184,0.9)" strokeWidth={4} />
                        ))}
                        {context.mainRoadEdges.map((line, index) => (
                            <LocalLine key={`road-${index}`} line={line} viewport={viewport} stroke="rgba(71,85,105,0.85)" strokeWidth={2.5} />
                        ))}
                        {context.laneSegments.map((line, index) => (
                            <LocalLine key={`lane-${index}`} line={line} viewport={viewport} stroke="rgba(248,250,252,0.7)" dashed />
                        ))}

                        {context.crosswalks.map((crosswalk) => {
                            const stripeCount = 7;
                            return Array.from({ length: stripeCount }, (_unused, stripeIndex) => {
                                const offset = ((stripeIndex / Math.max(stripeCount - 1, 1)) * (context.roadHalfWidth * 2)) - context.roadHalfWidth;
                                const from = projectLocalPoint({ forward: crosswalk.forward, lateral: offset - 0.9 }, viewport, 1000, 1000);
                                const to = projectLocalPoint({ forward: crosswalk.forward, lateral: offset + 0.9 }, viewport, 1000, 1000);
                                return (
                                    <line
                                        key={`${crosswalk.id}-${stripeIndex}`}
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke="rgba(226,232,240,0.85)"
                                        strokeWidth="7"
                                        strokeLinecap="round"
                                    />
                                );
                            });
                        })}

                        {context.stopLine && (
                            <LocalLine
                                line={{
                                    from: { forward: context.stopLine.forward, lateral: -context.roadHalfWidth },
                                    to: { forward: context.stopLine.forward, lateral: context.roadHalfWidth }
                                }}
                                viewport={viewport}
                                stroke="rgba(248,113,113,0.9)"
                                strokeWidth={5}
                            />
                        )}

                        {trajectoryPoints && (
                            <polyline
                                points={trajectoryPoints}
                                fill="none"
                                stroke="rgba(16,185,129,0.95)"
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {context.spatialObjects.map((object) => {
                            const point = projectLocalPoint({ forward: object.forward, lateral: object.lateral }, viewport, 1000, 1000);
                            return (
                                <g key={object.id}>
                                    <circle cx={point.x} cy={point.y} r="11" fill={object.color} fillOpacity="0.9" />
                                    <circle cx={point.x} cy={point.y} r="18" fill={object.color} fillOpacity="0.14" />
                                </g>
                            );
                        })}

                        {context.signals.map((signal) => {
                            const point = projectLocalPoint({ forward: signal.forward, lateral: signal.lateral }, viewport, 1000, 1000);
                            return (
                                <g key={signal.id}>
                                    <rect x={point.x - 16} y={point.y - 16} width="32" height="32" rx="10" fill="rgba(14,165,233,0.2)" stroke="rgba(56,189,248,0.88)" strokeWidth="2.5" />
                                    <text x={point.x} y={point.y + 4} textAnchor="middle" fill="#e0f2fe" fontSize="14" fontWeight="700">TL</text>
                                </g>
                            );
                        })}

                        {context.signs.map((sign) => {
                            const point = projectLocalPoint({ forward: sign.forward, lateral: sign.lateral }, viewport, 1000, 1000);
                            return (
                                <g key={sign.id}>
                                    <rect x={point.x - 16} y={point.y - 16} width="32" height="32" rx="10" fill="rgba(248,113,113,0.16)" stroke="rgba(248,113,113,0.82)" strokeWidth="2.5" />
                                    <text x={point.x} y={point.y + 4} textAnchor="middle" fill="#fee2e2" fontSize="14" fontWeight="700">S</text>
                                </g>
                            );
                        })}

                        {context.selectedSpatialObject && (
                            <circle
                                cx={projectLocalPoint(context.selectedSpatialObject, viewport, 1000, 1000).x}
                                cy={projectLocalPoint(context.selectedSpatialObject, viewport, 1000, 1000).y}
                                r="22"
                                fill="transparent"
                                stroke="rgba(248,250,252,0.95)"
                                strokeWidth="4"
                            />
                        )}

                        <polygon
                            points="500,785 474,845 500,915 526,845"
                            fill="rgba(248,250,252,0.95)"
                            stroke="rgba(15,23,42,0.92)"
                            strokeWidth="6"
                        />
                    </svg>
                </div>
            </div>

            {compact ? (
                <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-100">
                    Ego-centered inferred roadway context. Observed objects are mixed with inferred road cues.
                </div>
            ) : (
                <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 leading-6">
                        {context.honestySummary}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-amber-100">
                        <TrafficCone size={12} />
                        Inferred map cues
                    </div>
                </div>
            )}
        </>
    );

    if (embedded) {
        return <div>{content}</div>;
    }

    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-950/92 p-4">
            {content}
        </section>
    );
});
