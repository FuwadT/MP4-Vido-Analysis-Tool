export function analyzeTrafficLightColor(video, bbox) {
    const [x, y, w, h] = bbox;
    if (!video || w <= 0 || h <= 0) return { color: 'unknown', confidence: 0 };

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, x, y, w, h, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    let redScore = 0, yellowScore = 0, greenScore = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r < 50 && g < 50 && b < 50) continue;

        const py = Math.floor((i / 4) / w) / h;

        // Red: top 50%
        if (py < 0.5 && r > 100 && r > g * 1.2 && r > b * 1.2) redScore++;

        // Yellow: middle 40%
        if (py >= 0.3 && py <= 0.7 && r > 100 && g > 100 && b < 100 && Math.abs(r - g) < 60) yellowScore++;

        // Green: bottom 50%, allowing cyan
        if (py > 0.5 && g > 100 && g > r * 1.1) greenScore++;
    }

    const max = Math.max(redScore, yellowScore, greenScore);
    if (max < 10) return { color: 'unknown', confidence: 0 };

    if (redScore === max) return { color: 'red', hex: '#FF0000', confidence: redScore / (w * h / 3) };
    if (yellowScore === max) return { color: 'yellow', hex: '#FFD700', confidence: yellowScore / (w * h / 3) };
    if (greenScore === max) return { color: 'green', hex: '#00FF00', confidence: greenScore / (w * h / 3) };

    return { color: 'unknown', confidence: 0 };
}
