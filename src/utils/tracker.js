export class SimpleTracker {
    constructor(iouThreshold = 0.3, maxMissedFrames = 5) {
        this.tracks = []; // { id, bbox, class, score, missedFrames, color }
        this.nextId = 1;
        this.iouThreshold = iouThreshold;
        this.maxMissedFrames = maxMissedFrames;
    }

    // Calculate Intersection over Union
    iou(bbox1, bbox2) {
        const [x1, y1, w1, h1] = bbox1;
        const [x2, y2, w2, h2] = bbox2;

        const xi1 = Math.max(x1, x2);
        const yi1 = Math.max(y1, y2);
        const xi2 = Math.min(x1 + w1, x2 + w2);
        const yi2 = Math.min(y1 + h1, y2 + h2);

        const interWidth = Math.max(0, xi2 - xi1);
        const interHeight = Math.max(0, yi2 - yi1);
        const interArea = interWidth * interHeight;

        const area1 = w1 * h1;
        const area2 = w2 * h2;
        const unionArea = area1 + area2 - interArea;

        return unionArea === 0 ? 0 : interArea / unionArea;
    }

    update(detections, timestamp = 0) {
        // detection: { bbox: [x, y, w, h], class, score }

        // 1. Mark all tracks as potential missing
        this.tracks.forEach(t => t.missedFrames++);

        // 2. Compute IoU matrix
        const matches = []; // [{ trackIdx, detIdx, iou }]

        this.tracks.forEach((track, tIdx) => {
            detections.forEach((det, dIdx) => {
                // Only match same class
                if (track.class === det.class) {
                    const score = this.iou(track.bbox, det.bbox);
                    if (score > this.iouThreshold) {
                        matches.push({ tIdx, dIdx, score });
                    }
                }
            });
        });

        // Sort matches by IoU score descending
        matches.sort((a, b) => b.score - a.score);

        const usedTracks = new Set();
        const usedDets = new Set();

        // 3. Assign matches
        matches.forEach(m => {
            if (usedTracks.has(m.tIdx) || usedDets.has(m.dIdx)) return;

            // Found a match!
            const track = this.tracks[m.tIdx];
            const det = detections[m.dIdx];

            // Update track with new measurement
            track.bbox = det.bbox;
            track.score = det.score; // current confidence
            track.maxScore = Math.max(track.maxScore || 0, det.score); // Track all-time high confidence
            track.missedFrames = 0; // Reset missed counter

            usedTracks.add(m.tIdx);
            usedDets.add(m.dIdx);
        });

        // 4. Create new tracks for unmatched detections
        detections.forEach((det, i) => {
            if (!usedDets.has(i)) {
                this.tracks.push({
                    id: this.nextId++,
                    bbox: det.bbox,
                    class: det.class,
                    score: det.score,
                    maxScore: det.score,
                    firstSeen: timestamp,
                    missedFrames: 0,
                    // Assign a random color for ID persistence visualization
                    color: `hsl(${Math.random() * 360}, 100%, 50%)`
                });
            }
        });

        // 5. Prune dead tracks
        this.tracks = this.tracks.filter(t => t.missedFrames <= this.maxMissedFrames);

        return this.tracks;
    }

    reset() {
        this.tracks = [];
        this.nextId = 1;
    }
}
