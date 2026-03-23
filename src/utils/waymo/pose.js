function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeTransformMatrix(transform) {
    if (!Array.isArray(transform) || transform.length < 16) {
        return null;
    }

    const numeric = transform.map((value) => Number(value));
    return numeric.every((value) => Number.isFinite(value))
        ? numeric
        : null;
}

export function extractPoseFromTransform(transform, timestamp = null) {
    const matrix = normalizeTransformMatrix(transform);
    if (!matrix) {
        return null;
    }

    return {
        timestamp,
        transform: matrix,
        x: matrix[3],
        y: matrix[7],
        z: matrix[11],
        yaw: Math.atan2(matrix[4], matrix[0])
    };
}

export function buildPoseLookup(rows) {
    const lookup = new Map();

    for (const row of rows || []) {
        const timestamp = row?.['key.frame_timestamp_micros'];
        const pose = extractPoseFromTransform(
            row?.['[VehiclePoseComponent].world_from_vehicle.transform'],
            timestamp
        );

        if (timestamp !== undefined && pose) {
            lookup.set(timestamp, pose);
        }
    }

    return lookup;
}

export function getPoseAtTimestamp(poseLookup, timestamp) {
    if (!poseLookup || timestamp === undefined) {
        return null;
    }

    return poseLookup.get(timestamp) || null;
}

export function buildEgoTrajectory(rows, maxSamples = 480) {
    const samples = [];

    for (const row of rows || []) {
        const timestamp = row?.['key.frame_timestamp_micros'];
        const pose = extractPoseFromTransform(
            row?.['[VehiclePoseComponent].world_from_vehicle.transform'],
            timestamp
        );

        if (pose) {
            samples.push(pose);
        }
    }

    if (samples.length <= maxSamples) {
        return samples;
    }

    const step = Math.max(1, Math.ceil(samples.length / maxSamples));
    return samples.filter((_sample, index) => index % step === 0 || index === samples.length - 1);
}

export function transformPointToWorld(transform, point) {
    const matrix = normalizeTransformMatrix(transform);
    if (!matrix || !point) {
        return null;
    }

    const x = Number(point.x || 0);
    const y = Number(point.y || 0);
    const z = Number(point.z || 0);

    if (![x, y, z].every(isFiniteNumber)) {
        return null;
    }

    return {
        x: (matrix[0] * x) + (matrix[1] * y) + (matrix[2] * z) + matrix[3],
        y: (matrix[4] * x) + (matrix[5] * y) + (matrix[6] * z) + matrix[7],
        z: (matrix[8] * x) + (matrix[9] * y) + (matrix[10] * z) + matrix[11]
    };
}
