import { describe, expect, it } from 'vitest';
import { LIDAR_NAMES } from './constants';
import { buildLidarPointCloud, getLidarBoxCorners } from './lidar';

describe('buildLidarPointCloud', () => {
    it('projects a simple range image into vehicle coordinates', () => {
        const pointCloud = buildLidarPointCloud({
            rows: [{
                'key.laser_name': LIDAR_NAMES.TOP,
                '[LiDARComponent].range_image_return1.values': [10, 0.5, 0, -1],
                '[LiDARComponent].range_image_return1.shape': [1, 1, 4]
            }],
            calibrations: [{
                'key.laser_name': LIDAR_NAMES.TOP,
                '[LiDARCalibrationComponent].extrinsic.transform': [
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1
                ],
                '[LiDARCalibrationComponent].beam_inclination.min': 0,
                '[LiDARCalibrationComponent].beam_inclination.max': 0
            }],
            maxPoints: 10
        });

        expect(pointCloud.renderedPointCount).toBe(1);
        expect(pointCloud.pointStride).toBe(4);
        expect(pointCloud.points[0]).toBeCloseTo(10, 6);
        expect(pointCloud.points[1]).toBeCloseTo(0, 6);
        expect(pointCloud.points[2]).toBeCloseTo(0, 6);
        expect(pointCloud.points[3]).toBe(LIDAR_NAMES.TOP);
        expect(pointCloud.sensorStats).toEqual([
            expect.objectContaining({
                laserName: LIDAR_NAMES.TOP,
                count: 1
            })
        ]);
    });

    it('uses generated beam inclinations and applies translation', () => {
        const pointCloud = buildLidarPointCloud({
            rows: [{
                'key.laser_name': LIDAR_NAMES.FRONT,
                '[LiDARComponent].range_image_return1.values': [
                    2, 0, 0, -1,
                    -1, -1, -1, -1
                ],
                '[LiDARComponent].range_image_return1.shape': [2, 1, 4]
            }],
            calibrations: [{
                'key.laser_name': LIDAR_NAMES.FRONT,
                '[LiDARCalibrationComponent].extrinsic.transform': [
                    1, 0, 0, 1,
                    0, 1, 0, 2,
                    0, 0, 1, 3,
                    0, 0, 0, 1
                ],
                '[LiDARCalibrationComponent].beam_inclination.min': 0,
                '[LiDARCalibrationComponent].beam_inclination.max': Math.PI / 2
            }],
            maxPoints: 10
        });

        expect(pointCloud.renderedPointCount).toBe(1);
        expect(pointCloud.points[0]).toBeCloseTo(1, 6);
        expect(pointCloud.points[1]).toBeCloseTo(2, 6);
        expect(pointCloud.points[2]).toBeCloseTo(5, 6);
    });
});

describe('getLidarBoxCorners', () => {
    it('returns four rotated corners for a lidar box', () => {
        const corners = getLidarBoxCorners({
            centerX: 10,
            centerY: -2,
            length: 4,
            width: 2,
            heading: Math.PI / 2
        });

        expect(corners).toHaveLength(4);
        expect(corners[0].x).toBeCloseTo(9, 6);
        expect(corners[0].y).toBeCloseTo(0, 6);
        expect(corners[2].x).toBeCloseTo(11, 6);
        expect(corners[2].y).toBeCloseTo(-4, 6);
    });
});
