import { describe, it, expect, beforeEach } from 'vitest';
import { detectADASEvents, resetADASDetector } from './adasEventDetector';

describe('ADAS Event Detector', () => {
    beforeEach(() => {
        resetADASDetector();
    });

    it('detects proximity between vehicles', () => {
        const tracks = [
            { id: 1, class: 'Vehicle', bbox: [100, 100, 100, 100], score: 0.9, missedFrames: 0 },
            { id: 2, class: 'Vehicle', bbox: [150, 100, 100, 100], score: 0.9, missedFrames: 0 }
        ];

        const events = detectADASEvents({
            tracks,
            rawPredictions: [],
            timestamp: 1.0,
            frameWidth: 1920,
            frameHeight: 1080
        });

        expect(events.some(e => e.adasType === 'PROXIMITY_VEHICLE')).toBe(true);
    });

    it('detects VRU collision risk on overlap', () => {
        const tracks = [
            { id: 1, class: 'Vehicle', bbox: [500, 500, 200, 150], score: 0.9, missedFrames: 0 },
            { id: 3, class: 'Pedestrian', bbox: [550, 550, 50, 100], score: 0.8, missedFrames: 0 }
        ];

        const events = detectADASEvents({
            tracks,
            rawPredictions: [],
            timestamp: 2.5,
            frameWidth: 1920,
            frameHeight: 1080
        });

        expect(events.some(e => e.adasType === 'VRU_COLLISION_RISK')).toBe(true);
    });

    it('detects high traffic density', () => {
        const tracks = Array.from({ length: 7 }, (_, i) => ({
            id: i + 10,
            class: 'Vehicle',
            bbox: [10 * i, 10 * i, 50, 50],
            score: 0.8,
            missedFrames: 0
        }));

        const events = detectADASEvents({
            tracks,
            rawPredictions: [],
            timestamp: 3.0,
            frameWidth: 1920,
            frameHeight: 1080
        });

        expect(events.some(e => e.adasType === 'HIGH_DENSITY')).toBe(true);
    });

    it('is robust against missing video/canvas elements', () => {
        const call = () => detectADASEvents({
            tracks: [],
            rawPredictions: [{ class: 'traffic light', bbox: [100, 100, 50, 100], score: 0.9 }],
            timestamp: 4.0,
            frameWidth: 1920,
            frameHeight: 1080,
            video: null
        });

        expect(call).not.toThrow();
    });
});
