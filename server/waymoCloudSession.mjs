import { buildAssociationMaps, buildObjectCatalog, getAvailableBoxComponent, normalizeStatsRow } from '../shared/waymo/normalize.js';
import { buildLidarPointCloud } from '../shared/waymo/lidar.js';
import { buildCameraFrameIndex, buildFrameIndex, buildFrameIndexFromRows, readAllRows, readCameraFrameRows, readFrameRows } from '../shared/waymo/parquet.js';
import { buildEgoTrajectory, buildPoseLookup, getPoseAtTimestamp } from '../shared/waymo/pose.js';
import { openParquetSource } from './parquetSources.mjs';
import { buildScenarioSummary } from './scenarioSummary.mjs';

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

function toSerializableAssociations(associations) {
    return {
        cameraToLidar: Object.fromEntries(associations.cameraToLidar.entries()),
        lidarToCamera: Object.fromEntries(
            Array.from(associations.lidarToCamera.entries()).map(([lidarObjectId, cameraObjectIds]) => {
                return [lidarObjectId, Array.from(cameraObjectIds)];
            })
        )
    };
}

function toBuffer(value) {
    if (Buffer.isBuffer(value)) {
        return value;
    }

    if (value instanceof Uint8Array) {
        return Buffer.from(value);
    }

    if (value instanceof ArrayBuffer) {
        return Buffer.from(value);
    }

    return null;
}

function normalizeMaxPoints(maxPoints) {
    const numeric = Number(maxPoints);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 6000;
    }

    return Math.floor(numeric);
}

export async function createWaymoCloudSession(segmentId, sources, options = {}) {
    const {
        storageClient,
        frameCacheLimit = 6
    } = options;
    const sourceEntries = Object.entries(sources || {});
    const parquetFiles = new Map(
        await Promise.all(sourceEntries.map(async ([component, sourceUri]) => {
            return [component, await openParquetSource(component, sourceUri, { storageClient })];
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
    const availableComponents = Array.from(parquetFiles.keys()).sort();
    const associations = buildAssociationMaps(associationRows);
    const lidarBoxIndex = buildFrameIndexFromRows(lidarBoxIndexRows);
    const cameraBoxIndex = buildFrameIndexFromRows(cameraBoxIndexRows);
    const objectCatalog = buildObjectCatalog(lidarBoxIndexRows, cameraBoxIndexRows);
    const stats = normalizeStatsRow(statsRows[0]);
    const availableCameras = getAvailableCameraNames(cameraCalibrations, cameraImageIndex, timestamps);
    const poseLookup = buildPoseLookup(poseRows);
    const egoTrajectory = buildEgoTrajectory(poseRows);
    const scenario = buildScenarioSummary({
        poseRows,
        stats,
        totalFrames: timestamps.length,
        availableCameras,
        availableComponents
    });
    const frameCache = new Map();
    const cacheOrder = [];
    const pendingDetectionLoads = new Map();

    function touchFrame(frameIndex) {
        const existing = cacheOrder.indexOf(frameIndex);
        if (existing >= 0) {
            cacheOrder.splice(existing, 1);
        }

        cacheOrder.push(frameIndex);
    }

    function trimCache() {
        while (cacheOrder.length > frameCacheLimit) {
            const evictedIndex = cacheOrder.shift();
            if (evictedIndex === undefined) {
                break;
            }

            frameCache.delete(evictedIndex);
        }
    }

    function getFrameRecord(frameIndex) {
        const cached = frameCache.get(frameIndex);
        if (cached) {
            touchFrame(frameIndex);
            return cached;
        }

        const timestamp = timestamps[frameIndex];
        if (timestamp === undefined) {
            return null;
        }

        const record = {
            frameIndex,
            timestamp,
            availableCameras: cameraImageIndex?.byTimestamp.get(timestamp)?.cameraNames || availableCameras,
            cameraRows: [],
            lidarRows: [],
            egoPose: getPoseAtTimestamp(poseLookup, timestamp),
            hasLidar: lidarIndex?.byTimestamp.has(timestamp) || false,
            cameraImages: new Map(),
            lidarPointClouds: new Map(),
            detectionsLoaded: false
        };

        frameCache.set(frameIndex, record);
        touchFrame(frameIndex);
        trimCache();
        return record;
    }

    async function ensureFrameDetections(frameIndex) {
        const frame = getFrameRecord(frameIndex);
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
                frame.lidarRows = lidarRows;
                frame.cameraRows = cameraRows;
                frame.detectionsLoaded = true;
            })
            .finally(() => {
                pendingDetectionLoads.delete(frameIndex);
            });

        pendingDetectionLoads.set(frameIndex, loadPromise);
        await loadPromise;
        touchFrame(frameIndex);
        trimCache();
        return frame;
    }

    async function ensureCameraImage(frameIndex, cameraName) {
        const frame = getFrameRecord(frameIndex);
        if (!frame || !cameraImageIndex || !cameraName) {
            return null;
        }

        if (frame.cameraImages.has(cameraName)) {
            return frame.cameraImages.get(cameraName);
        }

        const imageRows = await readCameraFrameRows(
            parquetFiles.get('camera_image'),
            cameraImageIndex,
            frame.timestamp,
            [cameraName],
            CAMERA_IMAGE_COLUMNS,
            { utf8: false }
        );

        for (const row of imageRows) {
            const rowCameraName = row['key.camera_name'];
            const imageBuffer = toBuffer(row['[CameraImageComponent].image']);

            if (rowCameraName != null && imageBuffer) {
                frame.cameraImages.set(rowCameraName, imageBuffer);
            }
        }

        return frame.cameraImages.get(cameraName) || null;
    }

    async function ensureLidarPointCloud(frameIndex, maxPoints) {
        const frame = getFrameRecord(frameIndex);
        if (!frame) {
            return null;
        }

        const resolvedMaxPoints = normalizeMaxPoints(maxPoints);
        if (frame.lidarPointClouds.has(resolvedMaxPoints)) {
            return frame.lidarPointClouds.get(resolvedMaxPoints);
        }

        const lidarRangeRows = frame.hasLidar
            ? await readFrameRows(parquetFiles.get('lidar'), lidarIndex, frame.timestamp, LIDAR_COLUMNS)
            : [];

        const pointCloud = buildLidarPointCloud({
            rows: lidarRangeRows,
            calibrations: lidarCalibrations,
            maxPoints: resolvedMaxPoints
        });
        frame.lidarPointClouds.set(resolvedMaxPoints, pointCloud);

        return pointCloud;
    }

    function toFramePayload(frameIndex, frame, cameraNames, includeLidar, pointCloud) {
        const imageUrls = {};

        for (const cameraName of cameraNames) {
            if (frame.cameraImages.has(cameraName)) {
                imageUrls[cameraName] = `/api/cloud/segments/${encodeURIComponent(segmentId)}/frames/${frameIndex}/cameras/${cameraName}`;
            }
        }

        return {
            kind: 'cloud',
            frameIndex,
            timestamp: frame.timestamp,
            availableCameras: frame.availableCameras,
            cameraRows: frame.cameraRows,
            lidarRows: frame.lidarRows,
            egoPose: frame.egoPose,
            hasLidar: frame.hasLidar,
            imageUrls,
            lidarPointCloud: includeLidar ? pointCloud : null
        };
    }

    return {
        segmentId,
        availableComponents,
        totalFrames: timestamps.length,
        availableCameras,
        cameraCalibrations,
        lidarCalibrations,
        stats,
        egoTrajectory,
        boxComponent,
        objectCatalog,
        associations,
        scenario,
        getSummary() {
            return {
                kind: 'cloud',
                segmentId,
                availableComponents,
                totalFrames: timestamps.length,
                availableCameras,
                cameraCalibrations,
                lidarCalibrations,
                stats,
                egoTrajectory,
                boxComponent,
                objectCatalog,
                associations: toSerializableAssociations(associations),
                scenario
            };
        },
        async getFrame(frameIndex, options = {}) {
            const frame = getFrameRecord(frameIndex);
            if (!frame) {
                return null;
            }

            const cameraNames = Array.isArray(options.cameraNames)
                ? options.cameraNames.map((cameraName) => Number(cameraName)).filter((cameraName) => !Number.isNaN(cameraName))
                : [];
            const includeLidar = options.includeLidar === true;

            await ensureFrameDetections(frameIndex);
            await Promise.all(cameraNames.map((cameraName) => ensureCameraImage(frameIndex, cameraName)));
            const pointCloud = includeLidar
                ? await ensureLidarPointCloud(frameIndex, options.maxPoints)
                : null;

            return toFramePayload(frameIndex, frame, cameraNames, includeLidar, pointCloud);
        },
        async getCameraImage(frameIndex, cameraName) {
            return ensureCameraImage(frameIndex, Number(cameraName));
        },
        async getLidarPointCloud(frameIndex, maxPoints) {
            return ensureLidarPointCloud(frameIndex, maxPoints);
        },
        async dispose() {
            await Promise.all(
                Array.from(parquetFiles.values()).map((parquetFile) => {
                    return typeof parquetFile.close === 'function'
                        ? parquetFile.close()
                        : Promise.resolve();
                })
            );

            frameCache.clear();
            cacheOrder.length = 0;
            pendingDetectionLoads.clear();
        }
    };
}
