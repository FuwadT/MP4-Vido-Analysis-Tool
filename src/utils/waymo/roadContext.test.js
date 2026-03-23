import { describe, expect, it } from 'vitest';
import { buildInferredRoadContext, estimateEgoHeading, findNearestTrajectoryIndex, worldToEgoFrame } from './roadContext';

describe('waymo road context helpers', () => {
    const trajectory = [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 0, y: 20 },
        { x: 6, y: 30 }
    ];

    it('finds the nearest trajectory sample and estimates heading', () => {
        const egoPose = { x: 0, y: 12, yaw: Math.PI / 2 };

        expect(findNearestTrajectoryIndex(trajectory, egoPose)).toBe(1);
        expect(estimateEgoHeading(trajectory, egoPose)).toBeCloseTo(Math.PI / 2, 4);
    });

    it('projects world coordinates into the ego frame', () => {
        const egoPose = { x: 0, y: 0, yaw: Math.PI / 2 };
        const local = worldToEgoFrame({ x: 0, y: 12 }, egoPose, egoPose.yaw);

        expect(local.forward).toBeCloseTo(12, 4);
        expect(local.lateral).toBeCloseTo(0, 4);
    });

    it('builds an ego-follow inferred road context with roadway markers', () => {
        const context = buildInferredRoadContext({
            trajectory,
            egoPose: { x: 0, y: 12, yaw: Math.PI / 2 },
            scenario: { title: 'Left-turn scenario', tags: ['urban'] },
            currentObjects: [{ annotationKey: 'lidar-1', label: 'Vehicle', color: '#f97316', centerX: 12, centerY: 2, centerZ: 0.5 }]
        });

        expect(context.localTrajectory.length).toBeGreaterThan(0);
        expect(context.crossStreet).not.toBeNull();
        expect(context.signals.length).toBeGreaterThan(0);
        expect(context.spatialObjects).toHaveLength(1);
    });
});
