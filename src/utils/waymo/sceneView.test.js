import { describe, expect, it } from 'vitest';
import { extractLidarSensors, getVehicleViewModes, getVehicleViewPreset } from './sceneView';
import { LIDAR_NAMES } from './constants';

describe('sceneView helpers', () => {
    it('extracts lidar sensor mount positions from calibration transforms', () => {
        const sensors = extractLidarSensors([
            {
                'key.laser_name': LIDAR_NAMES.TOP,
                '[LiDARCalibrationComponent].extrinsic.transform': [
                    1, 0, 0, 0.5,
                    0, 1, 0, 0.1,
                    0, 0, 1, 2.3,
                    0, 0, 0, 1
                ]
            },
            {
                'key.laser_name': LIDAR_NAMES.FRONT,
                '[LiDARCalibrationComponent].extrinsic.transform': [
                    1, 0, 0, 2.1,
                    0, 1, 0, 0.0,
                    0, 0, 1, 0.8,
                    0, 0, 0, 1
                ]
            }
        ]);

        expect(sensors).toHaveLength(2);
        expect(sensors[0]).toMatchObject({
            laserName: LIDAR_NAMES.TOP,
            localPosition: { x: 0.5, y: 0.1, z: 2.3 }
        });
        expect(sensors[1]).toMatchObject({
            laserName: LIDAR_NAMES.FRONT,
            localPosition: { x: 2.1, y: 0, z: 0.8 }
        });
    });

    it('returns stable vehicle camera presets', () => {
        expect(getVehicleViewPreset('driver')).toMatchObject({
            label: 'Driver',
            cameraOffset: { x: 1.8, y: 0, z: 1.7 }
        });
        expect(getVehicleViewPreset('missing')).toMatchObject({
            label: 'Chase'
        });
    });

    it('lists the supported simulator camera modes', () => {
        const modes = getVehicleViewModes().map((mode) => mode.id);
        expect(modes).toEqual(['chase', 'driver', 'top', 'orbit']);
    });
});
