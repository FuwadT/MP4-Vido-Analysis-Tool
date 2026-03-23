import { buildLidarPointCloud } from './lidar';

let calibrations = [];

self.onmessage = (event) => {
    const { id, type, payload } = event.data || {};

    try {
        if (type === 'init') {
            calibrations = Array.isArray(payload?.calibrations) ? payload.calibrations : [];
            self.postMessage({ id, type: 'ready' });
            return;
        }

        if (type === 'build') {
            const pointCloud = buildLidarPointCloud({
                rows: payload?.rows,
                calibrations,
                maxPoints: payload?.maxPoints,
                includeSecondReturn: payload?.includeSecondReturn
            });

            self.postMessage({
                id,
                type: 'result',
                payload: pointCloud
            });
        }
    } catch (error) {
        self.postMessage({
            id,
            type: 'error',
            payload: {
                message: error instanceof Error ? error.message : 'LiDAR worker failed.'
            }
        });
    }
};
