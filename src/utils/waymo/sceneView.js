import { getLidarColor, getLidarLabel, LIDAR_ORDER } from './constants.js';

const VIEW_PRESETS = Object.freeze({
    chase: {
        label: 'Chase',
        description: 'Third-person follow camera behind the ego vehicle.',
        cameraOffset: { x: -12, y: 0, z: 5.4 },
        targetOffset: { x: 11, y: 0, z: 1.8 },
        lerpAlpha: 0.14
    },
    driver: {
        label: 'Driver',
        description: 'Front-seat driving view with forward focus.',
        cameraOffset: { x: 1.8, y: 0, z: 1.7 },
        targetOffset: { x: 24, y: 0, z: 1.6 },
        lerpAlpha: 0.18
    },
    top: {
        label: 'Top',
        description: 'Overhead inspection view locked to ego motion.',
        cameraOffset: { x: -1.5, y: 0, z: 25 },
        targetOffset: { x: 5, y: 0, z: 0.8 },
        lerpAlpha: 0.16
    },
    orbit: {
        label: 'Orbit',
        description: 'Free orbit around the moving ego vehicle.',
        cameraOffset: { x: -14, y: -10, z: 8 },
        targetOffset: { x: 3, y: 0, z: 1.5 },
        lerpAlpha: 0.16
    }
});

function toNumericTransform(transform) {
    if (!Array.isArray(transform) || transform.length < 16) {
        return null;
    }

    const numeric = transform.map((value) => Number(value));
    return numeric.every((value) => Number.isFinite(value)) ? numeric : null;
}

export function getVehicleViewPreset(mode = 'chase') {
    return VIEW_PRESETS[mode] || VIEW_PRESETS.chase;
}

export function getVehicleViewModes() {
    return Object.entries(VIEW_PRESETS).map(([id, preset]) => ({
        id,
        label: preset.label,
        description: preset.description
    }));
}

export function extractLidarSensors(calibrations = []) {
    return (calibrations || [])
        .map((calibration) => {
            const laserName = Number(calibration?.['key.laser_name']);
            const transform = toNumericTransform(calibration?.['[LiDARCalibrationComponent].extrinsic.transform']);
            if (!laserName || !transform) {
                return null;
            }

            return {
                laserName,
                label: getLidarLabel(laserName),
                color: getLidarColor(laserName),
                transform,
                localPosition: {
                    x: transform[3],
                    y: transform[7],
                    z: transform[11]
                }
            };
        })
        .filter(Boolean)
        .sort((left, right) => {
            const leftIndex = LIDAR_ORDER.indexOf(left.laserName);
            const rightIndex = LIDAR_ORDER.indexOf(right.laserName);
            return leftIndex - rightIndex;
        });
}
