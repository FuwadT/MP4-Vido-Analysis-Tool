import React, { memo, useEffect, useMemo, useRef } from 'react';
import { LoaderCircle, Radar } from 'lucide-react';
import { getLidarColor } from '../utils/waymo/constants';
import { getLidarBoxCorners } from '../utils/waymo/lidar';

const VIEW_PADDING = 32;

function expandBounds(bounds, detections) {
    let minX = bounds?.minX ?? -40;
    let maxX = bounds?.maxX ?? 40;
    let minY = bounds?.minY ?? -40;
    let maxY = bounds?.maxY ?? 40;

    for (const detection of detections || []) {
        const corners = getLidarBoxCorners(detection);
        for (const corner of corners) {
            minX = Math.min(minX, corner.x);
            maxX = Math.max(maxX, corner.x);
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
        }
    }

    const front = Math.max(maxX, 35);
    const rear = Math.max(-minX, 20);
    const lateral = Math.max(Math.abs(minY), Math.abs(maxY), 28);

    return {
        minX: -rear,
        maxX: front,
        minY: -lateral,
        maxY: lateral
    };
}

function projectPoint(point, bounds, width, height, padding = VIEW_PADDING) {
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanY = Math.max(bounds.maxY - bounds.minY, 1);
    const usableWidth = Math.max(width - (padding * 2), 1);
    const usableHeight = Math.max(height - (padding * 2), 1);

    return {
        x: padding + (((bounds.maxY - point.y) / spanY) * usableWidth),
        y: padding + (((bounds.maxX - point.x) / spanX) * usableHeight)
    };
}

function drawGrid(ctx, bounds, width, height) {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.75)';
    ctx.lineWidth = 1;

    for (let meter = -60; meter <= 60; meter += 10) {
        const left = projectPoint({ x: bounds.minX, y: meter }, bounds, width, height);
        const right = projectPoint({ x: bounds.maxX, y: meter }, bounds, width, height);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();

        const top = projectPoint({ x: meter, y: bounds.minY }, bounds, width, height);
        const bottom = projectPoint({ x: meter, y: bounds.maxY }, bounds, width, height);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();
    }
}

function drawAxes(ctx, bounds, width, height) {
    const origin = projectPoint({ x: 0, y: 0 }, bounds, width, height);
    const forward = projectPoint({ x: 12, y: 0 }, bounds, width, height);
    const left = projectPoint({ x: 0, y: 12 }, bounds, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(forward.x, forward.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(left.x, left.y);
    ctx.stroke();
}

function drawVehicle(ctx, bounds, width, height) {
    const body = [
        { x: 2.6, y: 1.1 },
        { x: 2.6, y: -1.1 },
        { x: -2.2, y: -1.1 },
        { x: -2.2, y: 1.1 }
    ].map((point) => projectPoint(point, bounds, width, height));

    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);
    for (let index = 1; index < body.length; index += 1) {
        ctx.lineTo(body[index].x, body[index].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawPackedPoints(ctx, points, bounds, width, height, sampleStride, pointStride) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    const pointSize = sampleStride > 4 ? 1.8 : 1.4;
    let currentColor = '';

    for (let index = 0; index < points.length; index += pointStride) {
        const laserName = points[index + 3];
        const nextColor = getLidarColor(laserName);
        if (nextColor !== currentColor) {
            currentColor = nextColor;
            ctx.fillStyle = nextColor;
        }

        const projected = projectPoint({
            x: points[index],
            y: points[index + 1]
        }, bounds, width, height);
        ctx.fillRect(projected.x, projected.y, pointSize, pointSize);
    }

    ctx.restore();
}

function drawObjectPoints(ctx, points, bounds, width, height, sampleStride) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    const pointSize = sampleStride > 4 ? 1.8 : 1.4;

    for (const point of points || []) {
        const projected = projectPoint(point, bounds, width, height);
        ctx.fillStyle = point.color;
        ctx.fillRect(projected.x, projected.y, pointSize, pointSize);
    }

    ctx.restore();
}

function drawPoints(ctx, pointCloud, bounds, width, height) {
    const points = pointCloud?.points || [];
    const sampleStride = pointCloud?.sampleStride || 1;

    if (points.length === 0) {
        return;
    }

    if (typeof points[0] === 'number') {
        drawPackedPoints(ctx, points, bounds, width, height, sampleStride, pointCloud?.pointStride || 4);
        return;
    }

    drawObjectPoints(ctx, points, bounds, width, height, sampleStride);
}

function formatCount(value) {
    return Number(value || 0).toLocaleString();
}

export const WaymoLidarViewer = memo(function WaymoLidarViewer({
    pointCloud,
    isLoading,
    detections,
    selectedAnnotationKey,
    onSelectDetection,
    embedded = false,
    canvasHeightClass = 'h-[380px] md:h-[420px]'
}) {
    const canvasRef = useRef(null);
    const bounds = useMemo(
        () => expandBounds(pointCloud?.bounds, detections),
        [detections, pointCloud?.bounds]
    );

    const projectedDetections = useMemo(() => {
        const width = 1000;
        const height = 1000;

        return (detections || []).map((detection) => {
            const corners = getLidarBoxCorners(detection).map((corner) => (
                projectPoint(corner, bounds, width, height)
            ));
            const center = projectPoint(
                { x: detection.centerX, y: detection.centerY },
                bounds,
                width,
                height
            );

            return {
                ...detection,
                corners,
                center
            };
        });
    }, [bounds, detections]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return undefined;
        }

        const redraw = () => {
            const rect = canvas.getBoundingClientRect();
            const devicePixelRatio = window.devicePixelRatio || 1;
            const width = Math.max(Math.floor(rect.width * devicePixelRatio), 1);
            const height = Math.max(Math.floor(rect.height * devicePixelRatio), 1);
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }

            ctx.scale(devicePixelRatio, devicePixelRatio);
            ctx.clearRect(0, 0, rect.width, rect.height);

            const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
            gradient.addColorStop(0, '#020617');
            gradient.addColorStop(1, '#071330');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, rect.width, rect.height);

            drawGrid(ctx, bounds, rect.width, rect.height);
            drawPoints(ctx, pointCloud, bounds, rect.width, rect.height);
            drawAxes(ctx, bounds, rect.width, rect.height);
            drawVehicle(ctx, bounds, rect.width, rect.height);
        };

        redraw();
        const observer = new ResizeObserver(() => redraw());
        observer.observe(canvas);

        return () => observer.disconnect();
    }, [bounds, pointCloud]);
    const isHoldingPreviousPointCloud = isLoading && Number(pointCloud?.renderedPointCount || 0) > 0;

    const content = (
        <>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-2 text-slate-200">
                        <Radar size={16} />
                    </div>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-400">LiDAR Point Cloud</div>
                        <h3 className="mt-1 text-lg font-semibold text-slate-100">Bird&apos;s-eye vehicle view</h3>
                        <p className="mt-1 max-w-2xl text-sm text-slate-400">
                            Downsampled raw point cloud from the `lidar` component with 3D box labels from `lidar_box`.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    {isLoading && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                            <LoaderCircle size={12} className="animate-spin" />
                            Loading points
                        </span>
                    )}
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                        Points {formatCount(pointCloud?.renderedPointCount)}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                        Boxes {formatCount(detections?.length)}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5">
                        Sample stride {pointCloud?.sampleStride || 1}
                    </span>
                    {isHoldingPreviousPointCloud ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                            Advancing LiDAR...
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {(pointCloud?.sensorStats || []).map((sensor) => (
                    <span
                        key={sensor.laserName}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300"
                    >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sensor.color }} />
                        {sensor.label} {formatCount(sensor.count)}
                    </span>
                ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950/80">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                    <span>Front Up</span>
                    <span>Left Left</span>
                </div>

                <div className={`relative ${canvasHeightClass}`}>
                    <canvas ref={canvasRef} className="h-full w-full" />

                    {isLoading && (!pointCloud?.renderedPointCount) && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full border border-slate-700 bg-slate-950/85 px-4 py-2 text-sm text-slate-300">
                                Decoding LiDAR range image...
                            </div>
                        </div>
                    )}

                    <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full">
                        {projectedDetections.map((detection) => {
                            const isSelected = detection.annotationKey === selectedAnnotationKey;
                            const points = detection.corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
                            const labelY = Math.max(detection.center.y - 16, 24);
                            const canSelect = typeof onSelectDetection === 'function';

                            return (
                                <g key={detection.annotationKey}>
                                    <polygon
                                        points={points}
                                        fill={isSelected ? `${detection.color}22` : 'transparent'}
                                        stroke={detection.color}
                                        strokeWidth={isSelected ? 7 : 4}
                                        className={canSelect ? 'pointer-events-auto cursor-pointer' : ''}
                                        onClick={canSelect ? () => onSelectDetection(detection.annotationKey) : undefined}
                                    />
                                    <text
                                        x={detection.center.x}
                                        y={labelY}
                                        textAnchor="middle"
                                        fill={detection.color}
                                        fontSize="24"
                                        fontWeight="700"
                                        style={{ userSelect: 'none' }}
                                    >
                                        {detection.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </>
    );

    if (embedded) {
        return <div className="space-y-4">{content}</div>;
    }

    return (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 md:p-5">
            {content}
        </section>
    );
});
