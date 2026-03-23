import { revokeObjectUrlMap } from './normalize';
import { loadWaymoE2EDFrameType } from './protoLoader';
import { indexTFRecordFile, readTFRecordPayload } from './tfrecord';

const FRAME_CACHE_LIMIT = 12;
const INTENT_LABELS = {
    0: 'Unknown',
    1: 'Go Straight',
    2: 'Go Left',
    3: 'Go Right'
};

function firstDefined(source, keys, fallback = undefined) {
    if (!source) {
        return fallback;
    }

    const candidates = Array.isArray(keys) ? keys : [keys];
    for (const key of candidates) {
        if (source[key] !== undefined && source[key] !== null) {
            return source[key];
        }
    }

    return fallback;
}

function toNumberArray(values) {
    return Array.isArray(values) ? values.map((value) => Number(value)) : [];
}

function toUint8Array(value) {
    if (value instanceof Uint8Array) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    if (typeof value === 'string') {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    }

    return null;
}

function normalizeTrajectoryStates(source) {
    if (!source) {
        return null;
    }

    const posX = toNumberArray(firstDefined(source, ['posX', 'pos_x'], []));
    const posY = toNumberArray(firstDefined(source, ['posY', 'pos_y'], []));
    const posZ = toNumberArray(firstDefined(source, ['posZ', 'pos_z'], []));
    const velX = toNumberArray(firstDefined(source, ['velX', 'vel_x'], []));
    const velY = toNumberArray(firstDefined(source, ['velY', 'vel_y'], []));
    const accelX = toNumberArray(firstDefined(source, ['accelX', 'accel_x'], []));
    const accelY = toNumberArray(firstDefined(source, ['accelY', 'accel_y'], []));

    return {
        posX,
        posY,
        posZ,
        velX,
        velY,
        accelX,
        accelY,
        pointCount: Math.max(posX.length, posY.length, posZ.length),
        preferenceScore: firstDefined(source, ['preferenceScore', 'preference_score'], null)
    };
}

function normalizeCalibrations(source) {
    return (source || []).map((calibration) => ({
        name: Number(firstDefined(calibration, 'name', 0)),
        width: Number(firstDefined(calibration, 'width', 0)),
        height: Number(firstDefined(calibration, 'height', 0))
    }));
}

function createImageUrlMap(images) {
    const imageUrls = new Map();

    for (const image of images || []) {
        const cameraName = Number(firstDefined(image, 'name', 0));
        const bytes = toUint8Array(firstDefined(image, 'image'));

        if (!cameraName || !bytes) {
            continue;
        }

        const blob = new Blob([bytes], { type: 'image/jpeg' });
        imageUrls.set(cameraName, URL.createObjectURL(blob));
    }

    return imageUrls;
}

function cleanupFrame(frame) {
    revokeObjectUrlMap(frame?.imageUrls);
}

function normalizeDecodedFrame(decoded, frameIndex, sourceFileName) {
    const frameData = firstDefined(decoded, 'frame', {});
    const context = firstDefined(frameData, 'context', {});
    const calibrations = normalizeCalibrations(firstDefined(context, ['cameraCalibrations', 'camera_calibrations'], []));
    const imageUrls = createImageUrlMap(firstDefined(frameData, 'images', []));
    const availableCameras = Array.from(imageUrls.keys());
    const intentValue = Number(firstDefined(decoded, 'intent', 0));

    return {
        kind: 'e2e',
        frameIndex,
        frameId: String(firstDefined(context, 'name', `${sourceFileName}:${frameIndex + 1}`)),
        timestamp: Number(firstDefined(frameData, ['timestampMicros', 'timestamp_micros'], 0)),
        cameraCalibrations: calibrations,
        imageUrls,
        availableCameras,
        pastStates: normalizeTrajectoryStates(firstDefined(decoded, ['pastStates', 'past_states'])),
        futureStates: normalizeTrajectoryStates(firstDefined(decoded, ['futureStates', 'future_states'])),
        preferenceTrajectories: (firstDefined(decoded, ['preferenceTrajectories', 'preference_trajectories'], []) || [])
            .map(normalizeTrajectoryStates)
            .filter(Boolean),
        intent: {
            value: intentValue,
            label: INTENT_LABELS[intentValue] || INTENT_LABELS[0]
        }
    };
}

export async function createWaymoE2ESession(file, options = {}) {
    const onIndexProgress = typeof options.onIndexProgress === 'function' ? options.onIndexProgress : null;
    const e2eFrameType = await loadWaymoE2EDFrameType();
    const recordIndex = await indexTFRecordFile(file, { onProgress: onIndexProgress });
    const frameCache = new Map();
    const cacheOrder = [];

    async function getFrame(frameIndex) {
        const clampedIndex = Math.max(0, Math.min(frameIndex, recordIndex.length - 1));
        const cached = frameCache.get(clampedIndex);
        if (cached) {
            return cached;
        }

        const payload = await readTFRecordPayload(file, recordIndex[clampedIndex]);
        const message = e2eFrameType.decode(payload);
        const decoded = e2eFrameType.toObject(message, {
            arrays: true,
            bytes: Uint8Array,
            defaults: false,
            enums: Number,
            longs: Number
        });

        const frame = normalizeDecodedFrame(decoded, clampedIndex, file.name);
        frameCache.set(clampedIndex, frame);
        cacheOrder.push(clampedIndex);

        while (cacheOrder.length > FRAME_CACHE_LIMIT) {
            const evictedIndex = cacheOrder.shift();
            if (evictedIndex === undefined) {
                break;
            }

            const evictedFrame = frameCache.get(evictedIndex);
            cleanupFrame(evictedFrame);
            frameCache.delete(evictedIndex);
        }

        return frame;
    }

    const firstFrame = await getFrame(0);

    return {
        kind: 'e2e',
        segmentId: file.name,
        sourceFileName: file.name,
        fileSize: file.size,
        availableComponents: ['raw_e2e_tfrecord'],
        totalFrames: recordIndex.length,
        cameraCalibrations: firstFrame.cameraCalibrations,
        availableCameras: firstFrame.availableCameras,
        async getFrame(frameIndex) {
            return getFrame(frameIndex);
        },
        dispose() {
            for (const frame of frameCache.values()) {
                cleanupFrame(frame);
            }

            frameCache.clear();
            cacheOrder.length = 0;
        }
    };
}
