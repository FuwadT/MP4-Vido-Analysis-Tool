import {
    BOX_TYPES,
    CAMERA_ORDER,
    CAMERA_RESOLUTION,
    OPTIONAL_BOX_COMPONENTS,
    getBoxTypeColor,
    getBoxTypeLabel
} from './constants.js';

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
    return CAMERA_BOX_PREFIXES.find(prefix => hasValue(row[`${prefix}.box.center.x`])) || CAMERA_BOX_PREFIXES[0];
}

function compareBigIntLike(a, b) {
    if (a === b) {
        return 0;
    }

    return a > b ? 1 : -1;
}

export function formatTimestampMicros(timestamp) {
    if (!hasValue(timestamp)) {
        return '0.000';
    }

    const micros = typeof timestamp === 'bigint' ? timestamp : BigInt(timestamp);
    const totalMs = Number(micros / 1000n);
    const seconds = totalMs / 1000;
    return `${seconds.toFixed(3)}s`;
}

export function formatFrameCounter(currentFrameIndex, totalFrames) {
    return `Frame ${currentFrameIndex + 1} / ${totalFrames || 0}`;
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

export function groupRowsByTimestamp(rows) {
    const grouped = new Map();

    for (const row of rows || []) {
        const timestamp = row['key.frame_timestamp_micros'];
        if (!hasValue(timestamp)) {
            continue;
        }

        if (!grouped.has(timestamp)) {
            grouped.set(timestamp, []);
        }

        grouped.get(timestamp).push(row);
    }

    return grouped;
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

    return Array.from(catalog.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getAvailableBoxComponent(componentNames) {
    return OPTIONAL_BOX_COMPONENTS.find(component => componentNames.includes(component)) || null;
}

export function normalizeCameraDetections({
    rows,
    selectedCamera,
    segmentId,
    timestamp,
    annotations,
    associations
}) {
    return (rows || [])
        .filter(row => row['key.camera_name'] === selectedCamera)
        .map((row) => {
            const prefix = getBoxPrefix(row);
            const type = firstNumber(row, [`${prefix}.type`], BOX_TYPES.UNKNOWN);
            const cameraObjectId = firstString(row, ['key.camera_object_id', 'key.laser_object_id']);
            const lidarObjectId = associations.cameraToLidar.get(cameraObjectId) || firstString(row, ['key.laser_object_id']);
            const annotationKey = `${segmentId}:${String(timestamp)}:${selectedCamera}:${cameraObjectId || lidarObjectId || 'unknown'}`;

            return {
                annotationKey,
                objectId: cameraObjectId || lidarObjectId || 'unknown',
                cameraObjectId: cameraObjectId || null,
                lidarObjectId: lidarObjectId || null,
                cameraName: selectedCamera,
                type,
                label: getBoxTypeLabel(type),
                color: getBoxTypeColor(type),
                centerX: firstNumber(row, [`${prefix}.box.center.x`]),
                centerY: firstNumber(row, [`${prefix}.box.center.y`]),
                width: firstNumber(row, [`${prefix}.box.size.x`]),
                height: firstNumber(row, [`${prefix}.box.size.y`]),
                notes: annotations[annotationKey]?.notes || '',
                tags: annotations[annotationKey]?.tags || [],
                status: annotations[annotationKey]?.status || 'unreviewed'
            };
        })
        .filter(box => box.width > 0 && box.height > 0);
}

export function normalizeLidarDetections({ rows, segmentId, timestamp, annotations }) {
    return (rows || []).map((row) => {
        const type = firstNumber(row, ['[LiDARBoxComponent].type'], BOX_TYPES.UNKNOWN);
        const objectId = firstString(row, ['key.laser_object_id']);
        const annotationKey = `${segmentId}:${String(timestamp)}:lidar:${objectId || 'unknown'}`;

        return {
            annotationKey,
            objectId: objectId || 'unknown',
            type,
            label: getBoxTypeLabel(type),
            color: getBoxTypeColor(type),
            centerX: firstNumber(row, ['[LiDARBoxComponent].box.center.x']),
            centerY: firstNumber(row, ['[LiDARBoxComponent].box.center.y']),
            centerZ: firstNumber(row, ['[LiDARBoxComponent].box.center.z']),
            length: firstNumber(row, ['[LiDARBoxComponent].box.size.x']),
            width: firstNumber(row, ['[LiDARBoxComponent].box.size.y']),
            height: firstNumber(row, ['[LiDARBoxComponent].box.size.z']),
            heading: firstNumber(row, ['[LiDARBoxComponent].box.heading']),
            notes: annotations[annotationKey]?.notes || '',
            tags: annotations[annotationKey]?.tags || [],
            status: annotations[annotationKey]?.status || 'unreviewed'
        };
    });
}

export function getImageDimensions(cameraName, calibrations) {
    const calibration = (calibrations || []).find((row) => {
        const parquetCameraName = row?.['key.camera_name'];
        const protoCameraName = row?.name;
        return parquetCameraName === cameraName || protoCameraName === cameraName;
    });
    if (calibration) {
        const width = calibration['[CameraCalibrationComponent].width'] ?? calibration.width;
        const height = calibration['[CameraCalibrationComponent].height'] ?? calibration.height;
        if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
            return { width, height };
        }
    }

    return CAMERA_RESOLUTION[cameraName] || CAMERA_RESOLUTION[CAMERA_ORDER[0]];
}

export function createObjectUrlMap(imageRows) {
    const images = new Map();

    for (const row of imageRows || []) {
        const cameraName = row['key.camera_name'];
        const imageData = row['[CameraImageComponent].image'];
        if (!hasValue(cameraName) || !imageData) {
            continue;
        }

        let bytes = null;
        if (imageData instanceof Uint8Array) {
            bytes = imageData;
        } else if (imageData instanceof ArrayBuffer) {
            bytes = new Uint8Array(imageData);
        }

        if (!bytes) {
            continue;
        }

        const blob = new Blob([bytes], { type: 'image/jpeg' });
        images.set(cameraName, URL.createObjectURL(blob));
    }

    return images;
}

export function revokeObjectUrlMap(imageMap) {
    for (const url of imageMap?.values?.() || []) {
        URL.revokeObjectURL(url);
    }
}
