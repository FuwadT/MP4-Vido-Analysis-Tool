import React, { useEffect, useRef } from 'react';

export function CanvasOverlay({ width, height, videoWidth, videoHeight, predictions = [] }) {
    const canvasRef = useRef(null);

    // Draw the predictions
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        // Styling
        ctx.font = '16px monospace';
        ctx.textBaseline = 'top';

        // Calculate scaling factors to match "object-fit: contain"
        let scale = 1;
        let xOffset = 0;
        let yOffset = 0;

        if (videoWidth > 0 && videoHeight > 0) {
            const containerRatio = width / height;
            const videoRatio = videoWidth / videoHeight;

            if (containerRatio > videoRatio) {
                // Container wider than video -> limited by height
                scale = height / videoHeight;
                xOffset = (width - (videoWidth * scale)) / 2;
                yOffset = 0;
            } else {
                // Video wider than container -> limited by width
                scale = width / videoWidth;
                yOffset = (height - (videoHeight * scale)) / 2;
                xOffset = 0;
            }
        }

        predictions.forEach(prediction => {
            // Original raw box in intrinsic coords
            const [rx, ry, rw, rh] = prediction.bbox;

            // Transform to displayed coords
            const x = rx * scale + xOffset;
            const y = ry * scale + yOffset;
            const w = rw * scale;
            const h = rh * scale;

            // Add ID if available
            const idStr = prediction.id ? ` #${prediction.id}` : '';
            const label = `${prediction.class}${idStr} ${Math.round(prediction.score * 100)}%`;

            // Draw Box
            ctx.strokeStyle = prediction.color || '#00FF00'; // Use track color if available
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);

            // Draw Background for Text
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = prediction.color || '#00FF00'; // Match box color
            ctx.fillRect(x, y, textWidth + 4, 20);

            // Draw Text
            ctx.fillStyle = '#000000';
            ctx.fillText(label, x + 2, y + 2);
        });

    }, [predictions, width, height, videoWidth, videoHeight]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-10"
        />
    );
}
