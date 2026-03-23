import { getLidarColor, getLidarLabel } from './constants.js';

const RANGE_IMAGE_PREFIX = '[LiDARComponent].range_image_return';
const DEFAULT_POINT_LIMIT = 28000;
const FULL_ROTATION_RADIANS = Math.PI * 2;
const calibrationLookupCache = new WeakMap();
const POINT_STRIDE = 4;

function hasArrayValues(value) {
    return Array.isArray(value) && value.length > 0;
}

function buildLinearInclinations(rowCount, min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || rowCount <= 0) {
        return [];
    }

    return Array.from({ length: rowCount }, (_, index) => {
        const t = rowCount === 1 ? 0 : index / (rowCount - 1);
        return min + ((max - min) * t);
    });
}

function getBeamInclinations(calibration, rowCount) {
    const explicit = calibration?.['[LiDARCalibrationComponent].beam_inclination.values'];
    const values = hasArrayValues(explicit)
        ? explicit.slice(0, rowCount)
        : buildLinearInclinations(
            rowCount,
            calibration?.['[LiDARCalibrationComponent].beam_inclination.min'],
            calibration?.['[LiDARCalibrationComponent].beam_inclination.max']
        );

    return values.slice().reverse();
}

function getTransformMatrix(calibration) {
    const transform = calibration?.['[LiDARCalibrationComponent].extrinsic.transform'];
    if (!hasArrayValues(transform) || transform.length < 16) {
        return null;
    }

    return [
        transform.slice(0, 4),
        transform.slice(4, 8),
        transform.slice(8, 12)
    ];
}

function getCalibrationLookup(calibrations) {
    if (!Array.isArray(calibrations) || calibrations.length === 0) {
        return new Map();
    }

    const cached = calibrationLookupCache.get(calibrations);
    if (cached) {
        return cached;
    }

    const lookup = new Map();

    for (const calibration of calibrations) {
        const laserName = Number(calibration?.['key.laser_name']);
        if (!laserName) {
            continue;
        }

        lookup.set(laserName, {
            calibration,
            matrix: getTransformMatrix(calibration),
            inclinationsByRowCount: new Map()
        });
    }

    calibrationLookupCache.set(calibrations, lookup);
    return lookup;
}

function getCachedBeamInclinations(entry, rowCount) {
    const cached = entry?.inclinationsByRowCount.get(rowCount);
    if (cached) {
        return cached;
    }

    const inclinations = getBeamInclinations(entry?.calibration, rowCount);
    entry?.inclinationsByRowCount.set(rowCount, inclinations);
    return inclinations;
}

function transformPoint(matrix, x, y, z) {
    return {
        x: (matrix[0][0] * x) + (matrix[0][1] * y) + (matrix[0][2] * z) + matrix[0][3],
        y: (matrix[1][0] * x) + (matrix[1][1] * y) + (matrix[1][2] * z) + matrix[1][3],
        z: (matrix[2][0] * x) + (matrix[2][1] * y) + (matrix[2][2] * z) + matrix[2][3]
    };
}

function getRangeImage(row, returnIndex) {
    const values = row?.[`${RANGE_IMAGE_PREFIX}${returnIndex}.values`];
    const shape = row?.[`${RANGE_IMAGE_PREFIX}${returnIndex}.shape`];
    if (!hasArrayValues(values) || !hasArrayValues(shape) || shape.length < 3) {
        return null;
    }

    return { values, shape };
}

function createEmptyPointCloud() {
    return {
        points: [],
        pointStride: POINT_STRIDE,
        renderedPointCount: 0,
        sensorStats: [],
        bounds: {
            minX: -40,
            maxX: 40,
            minY: -40,
            maxY: 40,
            minZ: -4,
            maxZ: 4
        },
        sampleStride: 1,
        returnMode: 'return1'
    };
}

function updateBounds(bounds, point) {
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxY = Math.max(bounds.maxY, point.y);
    bounds.minZ = Math.min(bounds.minZ, point.z);
    bounds.maxZ = Math.max(bounds.maxZ, point.z);
}

function roundPointCoordinate(value) {
    return Math.round(value * 1000) / 1000;
}

function createSensorStats(counts) {
    return Array.from(counts.entries())
        .map(([laserName, count]) => ({
            laserName,
            label: getLidarLabel(laserName),
            color: getLidarColor(laserName),
            count
        }))
        .sort((left, right) => right.count - left.count);
}

export function buildLidarPointCloud({
    rows,
    calibrations,
    maxPoints = DEFAULT_POINT_LIMIT,
    includeSecondReturn = false
}) {
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(calibrations) || calibrations.length === 0) {
        return createEmptyPointCloud();
    }

    const calibrationByLaser = getCalibrationLookup(calibrations);
    const returnIndices = includeSecondReturn ? [1, 2] : [1];
    const totalCells = rows.reduce((sum, row) => {
        return sum + returnIndices.reduce((subtotal, returnIndex) => {
            const shape = row?.[`${RANGE_IMAGE_PREFIX}${returnIndex}.shape`];
            if (!hasArrayValues(shape) || shape.length < 2) {
                return subtotal;
            }

            return subtotal + (shape[0] * shape[1]);
        }, 0);
    }, 0);

    const sampleStride = totalCells > maxPoints
        ? Math.max(1, Math.ceil(Math.sqrt(totalCells / maxPoints)))
        : 1;

    const points = [];
    const sensorCounts = new Map();
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity
    };

    for (const row of rows) {
        const laserName = Number(row?.['key.laser_name']);
        const calibration = calibrationByLaser.get(laserName);
        const matrix = calibration?.matrix;
        if (!matrix) {
            continue;
        }

        for (const returnIndex of returnIndices) {
            const rangeImage = getRangeImage(row, returnIndex);
            if (!rangeImage) {
                continue;
            }

            const [rowCount, columnCount, channelCount] = rangeImage.shape;
            const inclinations = getCachedBeamInclinations(calibration, rowCount);
            if (inclinations.length === 0) {
                continue;
            }

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex += sampleStride) {
                const inclination = inclinations[rowIndex];
                const cosInclination = Math.cos(inclination);
                const sinInclination = Math.sin(inclination);

                for (let columnIndex = 0; columnIndex < columnCount; columnIndex += sampleStride) {
                    const valueIndex = ((rowIndex * columnCount) + columnIndex) * channelCount;
                    const range = Number(rangeImage.values[valueIndex]);
                    if (!(range > 0)) {
                        continue;
                    }

                    const azimuth = Math.PI - (((columnIndex + 0.5) / columnCount) * FULL_ROTATION_RADIANS);
                    const sensorPoint = {
                        x: range * Math.cos(azimuth) * cosInclination,
                        y: range * Math.sin(azimuth) * cosInclination,
                        z: range * sinInclination
                    };
                    const point = transformPoint(matrix, sensorPoint.x, sensorPoint.y, sensorPoint.z);

                    points.push(
                        roundPointCoordinate(point.x),
                        roundPointCoordinate(point.y),
                        roundPointCoordinate(point.z),
                        laserName
                    );
                    sensorCounts.set(laserName, (sensorCounts.get(laserName) || 0) + 1);
                    updateBounds(bounds, point);
                }
            }
        }
    }

    if (points.length === 0) {
        return createEmptyPointCloud();
    }

    return {
        points,
        pointStride: POINT_STRIDE,
        renderedPointCount: points.length / POINT_STRIDE,
        sensorStats: createSensorStats(sensorCounts),
        bounds,
        sampleStride,
        returnMode: includeSecondReturn ? 'dual-return' : 'return1'
    };
}
