
/**
 * Analyze a traffic light bounding box to determine its state (Red/Yellow/Green).
 * @param {HTMLVideoElement} video - The source video element.
 * @param {Array} bbox - [x, y, w, h] of the traffic light.
 * @param {HTMLCanvasElement} canvas - Optional offscreen canvas for processing.
 * @returns {Object} - { color: 'red'|'yellow'|'green'|'unknown', confidence: number }
 */
export function analyzeTrafficLightColor(video, bbox) {
    // Traffic lights are vertically stacked: Red (Top), Yellow (Mid), Green (Bot)
    // We will split the box into 3 vertical zones and measure average intensity/dominance.

    const [x, y, w, h] = bbox;

    // Safety check
    if (w <= 0 || h <= 0) return { color: 'unknown', confidence: 0 };

    // Create temp canvas if not provided
    // Note: Creating canvas every frame is expensive. 
    // In a real app we'd pass a persistent worker canvas. 
    // For now we'll do it on the fly but assume 'Full Analysis' mode covers the cost.
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Draw just the traffic light ROI
    ctx.drawImage(video, x, y, w, h, 0, 0, w, h);

    // Get pixels
    const frame = ctx.getImageData(0, 0, w, h);
    const data = frame.data;

    // Zones (Top 33%, Mid 33%, Bot 33%)
    let redScore = 0;
    let yellowScore = 0;
    let greenScore = 0;

    // Heuristic: Count pixels that are "significantly" one color
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Relative Y position (0.0 to 1.0)
        const py = Math.floor((i / 4) / w) / h;

        // Darkness filter (ignore dark parts)
        // Lower threshold to catch dimmer lights
        if (r < 50 && g < 50 && b < 50) continue;

        // RED Logic: High Red, dominating Green/Blue.
        // Top 50% of box (expanded zone).
        if (py < 0.5) {
            // R must be dominant
            if (r > 100 && r > g * 1.2 && r > b * 1.2) redScore++;
        }

        // YELLOW Logic: High Red + Green.
        // Middle 40% (0.3 to 0.7)
        if (py >= 0.3 && py <= 0.7) {
            if (r > 100 && g > 100 && b < 100 && Math.abs(r - g) < 60) yellowScore++;
        }

        // GREEN Logic: High Green, allowing some Blue (Cyan).
        // Bottom 50% of box.
        if (py > 0.5) {
            // G is dominant over R. B can be high (Cyan).
            if (g > 100 && g > r * 1.1) greenScore++;
        }
    }

    // Normalize scores
    // (We could normalize by zone size, but rough counts are usually robust enough for lit pixels)

    // Winner takes all, with threshold
    const max = Math.max(redScore, yellowScore, greenScore);
    const threshold = 10; // Min pixels to count as "lit"

    if (max < threshold) return { color: 'unknown', confidence: 0 };

    if (redScore === max) return { color: 'red', hex: '#FF0000', confidence: redScore / (w * h / 3) };
    if (yellowScore === max) return { color: 'yellow', hex: '#FFD700', confidence: yellowScore / (w * h / 3) };
    if (greenScore === max) return { color: 'green', hex: '#00FF00', confidence: greenScore / (w * h / 3) };

    return { color: 'unknown', confidence: 0 };
}
