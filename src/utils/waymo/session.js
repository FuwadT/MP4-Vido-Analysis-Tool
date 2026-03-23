import { buildAssociationMaps, buildObjectCatalog, createObjectUrlMap, getAvailableBoxComponent, normalizeStatsRow, revokeObjectUrlMap } from './normalize';
import { buildLidarPointCloud } from './lidar';
import { createLidarWorkerClient } from './lidarWorkerClient';
import { buildCameraFrameIndex, buildFrameIndex, buildFrameIndexFromRows, openParquetFile, readAllRows, readCameraFrameRows, readFrameRows } from './parquet';
import { buildEgoTrajectory, buildPoseLookup, getPoseAtTimestamp } from './pose';

const FRAME_CACHE_LIMIT = 8;

const CAMERA_IMAGE_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.camera_name',
    '[CameraImageComponent].image'
];

const LIDAR_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.laser_name',
    '[LiDARComponent].range_image_return1.values',
    '[LiDARComponent].range_image_return1.shape'
];

const STATS_COLUMNS = [
    'key.segment_context_name',
    '[StatsComponent].time_of_day',
    '[StatsComponent].location',
    '[StatsComponent].weather',
    '[StatsComponent].lidar_object_counts.types',
    '[StatsComponent].lidar_object_counts.counts'
];

const LIDAR_BOX_INDEX_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.laser_object_id',
    '[LiDARBoxComponent].type'
];

const LIDAR_BOX_FRAME_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.laser_object_id',
    '[LiDARBoxComponent].type',
    '[LiDARBoxComponent].box.center.x',
    '[LiDARBoxComponent].box.center.y',
    '[LiDARBoxComponent].box.center.z',
    '[LiDARBoxComponent].box.size.x',
    '[LiDARBoxComponent].box.size.y',
    '[LiDARBoxComponent].box.size.z',
    '[LiDARBoxComponent].box.heading'
];

const CAMERA_BOX_INDEX_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.camera_name',
    'key.camera_object_id',
    'key.laser_object_id',
    '[CameraBoxComponent].type',
    '[ProjectedLiDARBoxComponent].type',
    '[LiDARCameraSyncedBoxComponent].type'
];

const CAMERA_BOX_FRAME_COLUMNS = [
    'key.frame_timestamp_micros',
    'key.camera_name',
    'key.camera_object_id',
    'key.laser_object_id',
    '[CameraBoxComponent].type',
    '[CameraBoxComponent].box.center.x',
    '[CameraBoxComponent].box.center.y',
    '[CameraBoxComponent].box.size.x',
    '[CameraBoxComponent].box.size.y',
    '[ProjectedLiDARBoxComponent].type',
    '[ProjectedLiDARBoxComponent].box.center.x',
    '[ProjectedLiDARBoxComponent].box.center.y',
    '[ProjectedLiDARBoxComponent].box.size.x',
    '[ProjectedLiDARBoxComponent].box.size.y',
    '[LiDARCameraSyncedBoxComponent].type',
    '[LiDARCameraSyncedBoxComponent].box.center.x',
    '[LiDARCameraSyncedBoxComponent].box.center.y',
    '[LiDARCameraSyncedBoxComponent].box.size.x',
    '[LiDARCameraSyncedBoxComponent].box.size.y'
];

const ASSOCIATION_COLUMNS = [
    'key.camera_object_id',
    'key.laser_object_id'
];

function compareBigIntLike(a, b) {
    if (a === b) {
        return 0;
    }

    return a > b ? 1 : -1;
}

function uniqueSortedTimestamps(rows) {
    const values = new Set();
    for (const row of rows || []) {
        if (row['key.frame_timestamp_micros'] !== undefined) {
            values.add(row['key.frame_timestamp_micros']);
        }
    }

    return Array.from(values).sort(compareBigIntLike);
}

function cleanupFrame(frame) {
    if (frame) {
        frame.isDisposed = true;
    }

    revokeObjectUrlMap(frame?.imageUrls);
}

function getAvailableCameraNames(cameraCalibrations, cameraImageIndex, timestamps) {
    if (cameraCalibrations.length > 0) {
        return Array.from(new Set(cameraCalibrations
            .map((row) => row?.['key.camera_name'])
            .filter((cameraName) => cameraName !== undefined && cameraName !== null)
        )).sort((left, right) => left - right);
    }

    const firstTimestamp = timestamps[0];
    return cameraImageIndex?.byTimestamp.get(firstTimestamp)?.cameraNames || [];
}

export async function createWaymoDatasetSession(segmentId, componentFiles) {
    const componentEntries = Array.from(componentFiles.entries());
    const parquetFiles = new Map(
        await Promise.all(componentEntries.map(async ([component, file]) => {
            return [component, await openParquetFile(component, file)];
        }))
    );

    const boxComponent = getAvailableBoxComponent(Array.from(parquetFiles.keys()));
    const [
        poseRows,
        cameraCalibrations,
        lidarCalibrations,
        lidarBoxIndexRows,
        cameraBoxIndexRows,
        associationRows,
        statsRows,
        cameraImageIndex,
        lidarIndex
    ] = await Promise.all([
        parquetFiles.has('vehicle_pose')
            ? readAllRows(parquetFiles.get('vehicle_pose'), ['key.frame_timestamp_micros', '[VehiclePoseComponent].world_from_vehicle.transform'])
            : Promise.resolve([]),
        parquetFiles.has('camera_calibration')
            ? readAllRows(parquetFiles.get('camera_calibration'))
            : Promise.resolve([]),
        parquetFiles.has('lidar_calibration')
            ? readAllRows(parquetFiles.get('lidar_calibration'))
            : Promise.resolve([]),
        parquetFiles.has('lidar_box')
            ? readAllRows(parquetFiles.get('lidar_box'), LIDAR_BOX_INDEX_COLUMNS)
            : Promise.resolve([]),
        boxComponent
            ? readAllRows(parquetFiles.get(boxComponent), CAMERA_BOX_INDEX_COLUMNS)
            : Promise.resolve([]),
        parquetFiles.has('camera_to_lidar_box_association')
            ? readAllRows(parquetFiles.get('camera_to_lidar_box_association'), ASSOCIATION_COLUMNS)
            : Promise.resolve([]),
        parquetFiles.has('stats')
            ? readAllRows(parquetFiles.get('stats'), STATS_COLUMNS)
            : Promise.resolve([]),
        parquetFiles.has('camera_image')
            ? buildCameraFrameIndex(parquetFiles.get('camera_image'))
            : Promise.resolve(null),
        parquetFiles.has('lidar')
            ? buildFrameIndex(parquetFiles.get('lidar'), ['key.frame_timestamp_micros'])
            : Promise.resolve(null)
    ]);

    const timestamps = uniqueSortedTimestamps(poseRows);

    const associations = buildAssociationMaps(associationRows);
    const lidarBoxIndex = buildFrameIndexFromRows(lidarBoxIndexRows);
    const cameraBoxIndex = buildFrameIndexFromRows(cameraBoxIndexRows);
    const objectCatalog = buildObjectCatalog(lidarBoxIndexRows, cameraBoxIndexRows);
    const stats = normalizeStatsRow(statsRows[0]);
    const poseLookup = buildPoseLookup(poseRows);
    const egoTrajectory = buildEgoTrajectory(poseRows);
    const frameCache = new Map();
    const cacheOrder = [];
    const pendingFrameLoads = new Map();
    const pendingDetectionLoads = new Map();
    const pendingCameraLoads = new Map();
    const pendingLidarLoads = new Map();
    const availableCameras = getAvailableCameraNames(cameraCalibrations, cameraImageIndex, timestamps);
    const lidarWorkerClient = createLidarWorkerClient(lidarCalibrations);

    function touchFrameCache(frameIndex) {
        const existingIndex = cacheOrder.indexOf(frameIndex);
        if (existingIndex >= 0) {
            cacheOrder.splice(existingIndex, 1);
        }

        cacheOrder.push(frameIndex);
    }

    function trimFrameCache() {
        while (cacheOrder.length > FRAME_CACHE_LIMIT) {
            const evictedIndex = cacheOrder.shift();
            if (evictedIndex === undefined) {
                break;
            }

            const evictedFrame = frameCache.get(evictedIndex);
            cleanupFrame(evictedFrame);
            frameCache.delete(evictedIndex);
        }
    }

    async function ensureBaseFrame(frameIndex) {
        const cached = frameCache.get(frameIndex);
        if (cached) {
            touchFrameCache(frameIndex);
            return cached;
        }

        const pending = pendingFrameLoads.get(frameIndex);
        if (pending) {
            return pending;
        }

        const timestamp = timestamps[frameIndex];
        if (timestamp === undefined) {
            return null;
        }

        const framePromise = Promise.resolve({
            frameIndex,
            timestamp,
            availableCameras: cameraImageIndex?.byTimestamp.get(timestamp)?.cameraNames || availableCameras,
            imageUrls: new Map(),
            cameraRows: [],
            lidarRows: [],
            egoPose: getPoseAtTimestamp(poseLookup, timestamp),
            hasLidar: lidarIndex?.byTimestamp.has(timestamp) || false,
            lidarStatus: lidarIndex?.byTimestamp.has(timestamp) ? 'idle' : 'unavailable',
            lidarPointCloud: null,
            detectionsLoaded: false,
            isDisposed: false
        }).then((frame) => {
            frameCache.set(frameIndex, frame);
            touchFrameCache(frameIndex);
            trimFrameCache();
            return frame;
        }).finally(() => {
            pendingFrameLoads.delete(frameIndex);
        });

        pendingFrameLoads.set(frameIndex, framePromise);
        return framePromise;
    }

    async function ensureFrameDetections(frameIndex) {
        const frame = await ensureBaseFrame(frameIndex);
        if (!frame || frame.detectionsLoaded) {
            return frame;
        }

        const pending = pendingDetectionLoads.get(frameIndex);
        if (pending) {
            await pending;
            return frame;
        }

        const loadPromise = Promise.all([
            parquetFiles.has('lidar_box')
                ? readFrameRows(
                    parquetFiles.get('lidar_box'),
                    lidarBoxIndex,
                    frame.timestamp,
                    LIDAR_BOX_FRAME_COLUMNS
                )
                : Promise.resolve([]),
            boxComponent
                ? readFrameRows(
                    parquetFiles.get(boxComponent),
                    cameraBoxIndex,
                    frame.timestamp,
                    CAMERA_BOX_FRAME_COLUMNS
                )
                : Promise.resolve([])
        ])
            .then(([lidarRows, cameraRows]) => {
                if (frame.isDisposed || frameCache.get(frameIndex) !== frame) {
                    return;
                }

                frame.lidarRows = lidarRows;
                frame.cameraRows = cameraRows;
                frame.detectionsLoaded = true;
            })
            .finally(() => {
                pendingDetectionLoads.delete(frameIndex);
            });

        pendingDetectionLoads.set(frameIndex, loadPromise);
        await loadPromise;
        touchFrameCache(frameIndex);
        trimFrameCache();
        return frame;
    }

    async function ensureFrameCameraImages(frameIndex, cameraNames = []) {
        const frame = await ensureBaseFrame(frameIndex);
        if (!frame || !cameraImageIndex || cameraNames.length === 0) {
            return frame;
        }

        const missingCameraNames = Array.from(new Set(cameraNames))
            .filter((cameraName) => frame.availableCameras.includes(cameraName))
            .filter((cameraName) => !frame.imageUrls.has(cameraName));

        if (missingCameraNames.length === 0) {
            return frame;
        }

        const loadKey = `${frameIndex}:${missingCameraNames.sort((left, right) => left - right).join(',')}`;
        const pending = pendingCameraLoads.get(loadKey);
        if (pending) {
            await pending;
            return frame;
        }

        const loadPromise = readCameraFrameRows(
            parquetFiles.get('camera_image'),
            cameraImageIndex,
            frame.timestamp,
            missingCameraNames,
            CAMERA_IMAGE_COLUMNS,
            { utf8: false }
        )
            .then((imageRows) => {
                const imageUrls = createObjectUrlMap(imageRows);
                if (frame.isDisposed || frameCache.get(frameIndex) !== frame) {
                    revokeObjectUrlMap(imageUrls);
                    return;
                }

                for (const [cameraName, imageUrl] of imageUrls.entries()) {
                    frame.imageUrls.set(cameraName, imageUrl);
                }
            })
            .finally(() => {
                pendingCameraLoads.delete(loadKey);
            });

        pendingCameraLoads.set(loadKey, loadPromise);
        await loadPromise;

        touchFrameCache(frameIndex);
        trimFrameCache();
        return frame;
    }

    async function ensureFrameLidarPointCloud(frameIndex) {
        const frame = await ensureBaseFrame(frameIndex);
        if (!frame) {
            return null;
        }

        if (frame.lidarPointCloud) {
            return frame.lidarPointCloud;
        }

        if (!frame.hasLidar) {
            frame.lidarStatus = 'unavailable';
            frame.lidarPointCloud = buildLidarPointCloud({ rows: [], calibrations: lidarCalibrations });
            return frame.lidarPointCloud;
        }

        const pending = pendingLidarLoads.get(frameIndex);
        if (pending) {
            return pending;
        }

        frame.lidarStatus = 'loading';

        const pointCloudPromise = readFrameRows(
            parquetFiles.get('lidar'),
            lidarIndex,
            frame.timestamp,
            LIDAR_COLUMNS
        )
            .then((lidarRangeRows) => {
                if (lidarWorkerClient) {
                    return lidarWorkerClient.buildPointCloud({ rows: lidarRangeRows });
                }

                return buildLidarPointCloud({
                    rows: lidarRangeRows,
                    calibrations: lidarCalibrations
                });
            })
            .then((pointCloud) => {
                if (frame.isDisposed || frameCache.get(frameIndex) !== frame) {
                    return pointCloud;
                }

                frame.lidarPointCloud = pointCloud;
                frame.lidarStatus = 'ready';
                touchFrameCache(frameIndex);
                trimFrameCache();
                return pointCloud;
            })
            .catch((error) => {
                frame.lidarStatus = 'error';
                throw error;
            })
            .finally(() => {
                pendingLidarLoads.delete(frameIndex);
            });

        pendingLidarLoads.set(frameIndex, pointCloudPromise);
        return pointCloudPromise;
    }

    async function getFrame(frameIndex, options = {}) {
        const frame = await ensureBaseFrame(frameIndex);
        if (!frame) {
            return null;
        }

        await ensureFrameDetections(frameIndex);

        if (Array.isArray(options.cameraNames) && options.cameraNames.length > 0) {
            await ensureFrameCameraImages(frameIndex, options.cameraNames);
        }

        if (options.includeLidar) {
            await ensureFrameLidarPointCloud(frameIndex);
        }

        touchFrameCache(frameIndex);
        trimFrameCache();
        return frame;
    }

    function prefetchFrame(frameIndex, options = {}) {
        if (frameIndex < 0 || frameIndex >= timestamps.length) {
            return;
        }

        void getFrame(frameIndex, options).catch(() => {});
    }

    function clearFrameCache() {
        for (const frame of frameCache.values()) {
            cleanupFrame(frame);
        }

        frameCache.clear();
        cacheOrder.length = 0;
        pendingFrameLoads.clear();
        pendingDetectionLoads.clear();
        pendingCameraLoads.clear();
        pendingLidarLoads.clear();
    }

    return {
        segmentId,
        availableComponents: Array.from(parquetFiles.keys()).sort(),
        timestamps,
        totalFrames: timestamps.length,
        availableCameras,
        cameraCalibrations,
        lidarCalibrations,
        associations,
        stats,
        egoTrajectory,
        boxComponent,
        objectCatalog,
        async getFrame(frameIndex, options = {}) {
            return getFrame(frameIndex, options);
        },
        async ensureFrameCameraImages(frameIndex, cameraNames = []) {
            return ensureFrameCameraImages(frameIndex, cameraNames);
        },
        async ensureFrameLidarPointCloud(frameIndex) {
            return ensureFrameLidarPointCloud(frameIndex);
        },
        prefetchFrame(frameIndex, options = {}) {
            prefetchFrame(frameIndex, options);
        },
        dispose() {
            clearFrameCache();
            lidarWorkerClient?.dispose();
        }
    };
}
