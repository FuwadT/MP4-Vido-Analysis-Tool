import React, { memo, useMemo } from 'react';
import { getImageDimensions } from '../utils/waymo/normalize';

export const WaymoImageViewer = memo(function WaymoImageViewer({
    imageUrl,
    cameraName,
    calibrations,
    detections,
    selectedAnnotationKey,
    onSelectDetection
}) {
    const dimensions = useMemo(
        () => getImageDimensions(cameraName, calibrations),
        [cameraName, calibrations]
    );
    const aspectRatio = `${dimensions.width} / ${dimensions.height}`;

    return (
        <div className="h-full w-full rounded-2xl border border-slate-700 bg-slate-950/80 overflow-hidden min-h-[280px]">
            {imageUrl ? (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(2,6,23,1))] p-3 md:p-5">
                    <div className="flex h-full w-full items-center justify-center">
                        <div
                            className="relative h-full max-h-full max-w-full overflow-hidden rounded-[22px] border border-slate-700/70 bg-slate-950 shadow-[0_20px_60px_rgba(2,6,23,0.45)]"
                            style={{ aspectRatio }}
                        >
                            <img
                                src={imageUrl}
                                alt={`Waymo camera ${cameraName}`}
                                className="h-full w-full object-contain"
                            />
                            <svg
                                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                                preserveAspectRatio="xMidYMid meet"
                                className="absolute inset-0 h-full w-full"
                            >
                                {detections.map((detection) => {
                                    const x = detection.centerX - detection.width / 2;
                                    const y = detection.centerY - detection.height / 2;
                                    const isSelected = detection.annotationKey === selectedAnnotationKey;

                                    return (
                                        <g
                                            key={detection.annotationKey}
                                            className="cursor-pointer"
                                            onClick={() => onSelectDetection?.(detection.annotationKey)}
                                        >
                                            <rect
                                                x={x}
                                                y={y}
                                                width={detection.width}
                                                height={detection.height}
                                                fill="transparent"
                                                stroke={detection.color}
                                                strokeWidth={isSelected ? 10 : 6}
                                                strokeOpacity={isSelected ? 1 : 0.85}
                                                rx="6"
                                            />
                                            <rect
                                                x={x}
                                                y={Math.max(y - 36, 0)}
                                                width={Math.max(detection.label.length * 10 + 48, 120)}
                                                height="28"
                                                fill="rgba(15, 23, 42, 0.88)"
                                                stroke={detection.color}
                                                strokeWidth="2"
                                                rx="8"
                                            />
                                            <text
                                                x={x + 10}
                                                y={Math.max(y - 18, 18)}
                                                fill={detection.color}
                                                fontSize="18"
                                                fontWeight="700"
                                                style={{ userSelect: 'none' }}
                                            >
                                                {detection.label}
                                            </text>
                                            {detection.tags.length > 0 && (
                                                <text
                                                    x={x + 10}
                                                    y={Math.max(y + detection.height + 22, 22)}
                                                    fill="#e2e8f0"
                                                    fontSize="16"
                                                    fontWeight="600"
                                                    style={{ userSelect: 'none' }}
                                                >
                                                    {detection.tags.join(', ')}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                    No camera image available for this frame.
                </div>
            )}
        </div>
    );
});
