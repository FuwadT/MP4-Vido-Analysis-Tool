import React, { useEffect, useRef } from 'react';

function bboxCenter(bbox) {
    return [bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2];
}

function bboxDist(a, b) {
    const [ax, ay] = bboxCenter(a);
    const [bx, by] = bboxCenter(b);
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function avgDim(bbox) {
    return (bbox[2] + bbox[3]) / 2;
}

const TL_COLORS = { red: '#FF3333', yellow: '#FFD700', green: '#33FF66', unknown: '#888888' };
const VRU_CLASSES = new Set(['Pedestrian', 'Cyclist', 'Scooter', 'Animal']);
const VEHICLE_CLASSES = new Set(['Vehicle', 'Truck', 'Bus', 'Van', 'Motorcycle', 'Emergency-Vehicle']);

export function CanvasOverlay({ width, height, videoWidth, videoHeight, predictions = [], trafficLights = [] }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.font = '14px monospace';
        ctx.textBaseline = 'top';

        let scale = 1, xOffset = 0, yOffset = 0;
        if (videoWidth > 0 && videoHeight > 0) {
            const cr = width / height;
            const vr = videoWidth / videoHeight;
            if (cr > vr) {
                scale = height / videoHeight;
                xOffset = (width - videoWidth * scale) / 2;
            } else {
                scale = width / videoWidth;
                yOffset = (height - videoHeight * scale) / 2;
            }
        }

        const tx = (bbox) => [
            bbox[0] * scale + xOffset,
            bbox[1] * scale + yOffset,
            bbox[2] * scale,
            bbox[3] * scale
        ];

        const vehicles = predictions.filter(p => VEHICLE_CLASSES.has(p.class));
        const vrUsers = predictions.filter(p => VRU_CLASSES.has(p.class));

        for (const veh of vehicles) {
            for (const vru of vrUsers) {
                const dist = bboxDist(veh.bbox, vru.bbox);
                if (dist < (avgDim(veh.bbox) + avgDim(vru.bbox)) * 0.8) {
                    const [vx, vy] = bboxCenter(veh.bbox);
                    const [px, py] = bboxCenter(vru.bbox);
                    const sx = vx * scale + xOffset, sy = vy * scale + yOffset;
                    const ex = px * scale + xOffset, ey = py * scale + yOffset;

                    ctx.beginPath();
                    ctx.setLineDash([6, 4]);
                    ctx.strokeStyle = '#FF4444';
                    ctx.lineWidth = 2;
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
                    ctx.fillStyle = '#FF4444';
                    ctx.font = '12px monospace';
                    ctx.fillText('WARN', mx - 16, my - 8);
                    ctx.font = '14px monospace';
                }
            }
        }

        for (const tl of trafficLights) {
            const [x, y, w, h] = tx(tl.bbox);
            const hex = TL_COLORS[tl.color] || TL_COLORS.unknown;

            ctx.shadowColor = hex;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = hex;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            ctx.shadowBlur = 0;

            const cx = x + w / 2, cy = y - 12;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = hex;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const label = tl.color.toUpperCase();
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x, y + h + 2, tw + 6, 18);
            ctx.fillStyle = hex;
            ctx.fillText(label, x + 3, y + h + 4);
        }

        predictions.forEach(pred => {
            if (pred.class === 'Traffic-Light') return;

            const [x, y, w, h] = tx(pred.bbox);
            const label = `${pred.class}${pred.id ? ` #${pred.id}` : ''} ${Math.round(pred.score * 100)}%`;
            const color = pred.color || '#00FF00';
            const isVRU = VRU_CLASSES.has(pred.class);

            ctx.strokeStyle = color;
            ctx.lineWidth = isVRU ? 3 : 2;
            if (isVRU) ctx.setLineDash([8, 3]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            const tw = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, y - 18, tw + 6, 18);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#000';
            ctx.fillText(label, x + 3, y - 16);
        });

        const activeAlerts = [];
        if (vrUsers.length > 0 && vehicles.length > 0) activeAlerts.push('VRU');
        if (trafficLights.some(tl => tl.color === 'red')) activeAlerts.push('RED');
        if (predictions.length >= 6) activeAlerts.push('DENSE');

        if (activeAlerts.length > 0) {
            const badge = `ADAS: ${activeAlerts.join(' | ')}`;
            const bw = ctx.measureText(badge).width + 12;
            const bx = width - bw - 10, by = 10;

            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(bx, by, bw, 22);
            ctx.strokeStyle = '#FF6600';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, 22);
            ctx.fillStyle = '#FF6600';
            ctx.font = '12px monospace';
            ctx.fillText(badge, bx + 6, by + 5);
            ctx.font = '14px monospace';
        }

    }, [predictions, trafficLights, width, height, videoWidth, videoHeight]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
        />
    );
}
