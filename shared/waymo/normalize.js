import { BOX_TYPES, OPTIONAL_BOX_COMPONENTS, getBoxTypeLabel } from './constants.js';

const CAMERA_BOX_PREFIXES = [
    '[CameraBoxComponent]',
    '[ProjectedLiDARBoxComponent]',
    '[LiDARCameraSyncedBoxComponent]'
];

function hasValue(value) {
    return value !== null && value !== undefined;
}

function firstValue(row, keys) {
    for (const key of keys) {
        if (hasValue(row[key])) {
            return row[key];
        }
    }
    return undefined;
}

function firstNumber(row, keys, fallback = 0) {
    const value = firstValue(row, keys);
    return typeof value === 'number' ? value : fallback;
}

function firstString(row, keys, fallback = '') {
    const value = firstValue(row, keys);
    return typeof value === 'string' ? value : fallback;
}

function getBoxPrefix(row) {
    return CAMERA_BOX_PREFIXES.find((prefix) => hasValue(row[`${prefix}.type`])) || CAMERA_BOX_PREFIXES[0];
}

function compareBigIntLike(a, b) {
    if (a === b) {
        return 0;
    }

    return a > b ? 1 : -1;
}

export function normalizeStatsRow(row) {
    if (!row) {
        return null;
    }

    const types = row['[StatsComponent].lidar_object_counts.types'] || [];
    const counts = row['[StatsComponent].lidar_object_counts.counts'] || [];
    const objectCounts = {};

    types.forEach((type, index) => {
        objectCounts[getBoxTypeLabel(type)] = counts[index] || 0;
    });

    return {
        segmentId: firstString(row, ['key.segment_context_name']),
        timeOfDay: firstString(row, ['[StatsComponent].time_of_day'], 'Unknown'),
        location: firstString(row, ['[StatsComponent].location'], 'Unknown'),
        weather: firstString(row, ['[StatsComponent].weather'], 'Unknown'),
        objectCounts
    };
}

export function buildAssociationMaps(rows) {
    const cameraToLidar = new Map();
    const lidarToCamera = new Map();

    for (const row of rows || []) {
        const cameraObjectId = firstString(row, ['key.camera_object_id']);
        const lidarObjectId = firstString(row, ['key.laser_object_id']);
        if (!cameraObjectId || !lidarObjectId) {
            continue;
        }

        cameraToLidar.set(cameraObjectId, lidarObjectId);

        if (!lidarToCamera.has(lidarObjectId)) {
            lidarToCamera.set(lidarObjectId, new Set());
        }

        lidarToCamera.get(lidarObjectId).add(cameraObjectId);
    }

    return { cameraToLidar, lidarToCamera };
}

export function buildObjectCatalog(lidarRows, cameraRows) {
    const catalog = new Map();

    for (const row of lidarRows || []) {
        const objectId = firstString(row, ['key.laser_object_id']);
        const timestamp = row['key.frame_timestamp_micros'];
        if (!objectId || !hasValue(timestamp)) {
            continue;
        }

        if (!catalog.has(objectId)) {
            catalog.set(objectId, {
                id: objectId,
                label: getBoxTypeLabel(firstNumber(row, ['[LiDARBoxComponent].type'], BOX_TYPES.UNKNOWN)),
                type: firstNumber(row, ['[LiDARBoxComponent].type'], BOX_TYPES.UNKNOWN),
                firstTimestamp: timestamp,
                lastTimestamp: timestamp,
                detections: 0,
                source: 'lidar'
            });
        }

        const entry = catalog.get(objectId);
        entry.detections += 1;
        if (compareBigIntLike(timestamp, entry.firstTimestamp) < 0) {
            entry.firstTimestamp = timestamp;
        }
        if (compareBigIntLike(timestamp, entry.lastTimestamp) > 0) {
            entry.lastTimestamp = timestamp;
        }
    }

    for (const row of cameraRows || []) {
        const objectId = firstString(row, ['key.camera_object_id']);
        const timestamp = row['key.frame_timestamp_micros'];
        if (!objectId || !hasValue(timestamp) || catalog.has(objectId)) {
            continue;
        }

        const prefix = getBoxPrefix(row);
        const type = firstNumber(row, [`${prefix}.type`], BOX_TYPES.UNKNOWN);
        catalog.set(objectId, {
            id: objectId,
            label: getBoxTypeLabel(type),
            type,
            firstTimestamp: timestamp,
            lastTimestamp: timestamp,
            detections: 1,
            source: 'camera'
        });
    }

    return Array.from(catalog.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function getAvailableBoxComponent(componentNames) {
    return OPTIONAL_BOX_COMPONENTS.find((component) => componentNames.includes(component)) || null;
}
