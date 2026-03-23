import { describe, expect, it } from 'vitest';
import { describeSegments, scanWaymoFiles } from './folderScan';

function createMockFile(name, webkitRelativePath) {
    return { name, webkitRelativePath };
}

describe('scanWaymoFiles', () => {
    it('groups parquet files into segments by component folder', () => {
        const files = [
            createMockFile('segment-001.parquet', 'waymo_data/vehicle_pose/segment-001.parquet'),
            createMockFile('segment-001.parquet', 'waymo_data/camera_image/segment-001.parquet'),
            createMockFile('segment-001.parquet', 'waymo_data/camera_box/segment-001.parquet'),
            createMockFile('segment-002.parquet', 'waymo_data/vehicle_pose/segment-002.parquet')
        ];

        const segments = scanWaymoFiles(files);

        expect(segments.size).toBe(2);
        expect(segments.get('segment-001').has('camera_image')).toBe(true);
        expect(segments.get('segment-001').has('camera_box')).toBe(true);
        expect(segments.get('segment-002').has('vehicle_pose')).toBe(true);
    });

    it('marks segments usable only when required components are present', () => {
        const files = [
            createMockFile('segment-001.parquet', 'waymo_data/vehicle_pose/segment-001.parquet'),
            createMockFile('segment-001.parquet', 'waymo_data/camera_image/segment-001.parquet'),
            createMockFile('segment-002.parquet', 'waymo_data/vehicle_pose/segment-002.parquet')
        ];

        const described = describeSegments(scanWaymoFiles(files));

        expect(described.find(item => item.segmentId === 'segment-001').isUsable).toBe(true);
        expect(described.find(item => item.segmentId === 'segment-002').missingRequired).toEqual(['camera_image']);
    });
});
