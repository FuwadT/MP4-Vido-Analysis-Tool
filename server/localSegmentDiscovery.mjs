import fs from 'node:fs/promises';
import path from 'node:path';

async function listSegmentIdsForComponent(localDataRoot, component) {
    const componentDir = path.join(localDataRoot, component);

    try {
        const entries = await fs.readdir(componentDir, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.parquet'))
            .map((entry) => entry.name.replace(/\.parquet$/i, ''));
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

export async function discoverLocalSegmentIds(localDataRoot) {
    if (!localDataRoot) {
        return [];
    }

    const [poseSegmentIds, cameraSegmentIds] = await Promise.all([
        listSegmentIdsForComponent(localDataRoot, 'vehicle_pose'),
        listSegmentIdsForComponent(localDataRoot, 'camera_image')
    ]);

    const cameraSet = new Set(cameraSegmentIds);
    return poseSegmentIds
        .filter((segmentId) => cameraSet.has(segmentId))
        .sort((left, right) => left.localeCompare(right));
}
