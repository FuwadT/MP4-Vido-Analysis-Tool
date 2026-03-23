import { describe, expect, it } from 'vitest';
import { buildAssociationMaps, buildObjectCatalog, getImageDimensions, normalizeCameraDetections, normalizeLidarDetections } from './normalize';

describe('waymo normalize helpers', () => {
    it('normalizes camera detections and preserves annotation state', () => {
        const associations = buildAssociationMaps([
            { 'key.camera_object_id': 'cam-1', 'key.laser_object_id': 'laser-9' }
        ]);

        const detections = normalizeCameraDetections({
            rows: [{
                'key.camera_name': 1,
                'key.camera_object_id': 'cam-1',
                '[CameraBoxComponent].type': 1,
                '[CameraBoxComponent].box.center.x': 100,
                '[CameraBoxComponent].box.center.y': 80,
                '[CameraBoxComponent].box.size.x': 50,
                '[CameraBoxComponent].box.size.y': 30
            }],
            selectedCamera: 1,
            segmentId: 'segment-a',
            timestamp: 1000n,
            annotations: {
                'segment-a:1000:1:cam-1': {
                    status: 'validated',
                    tags: ['reviewed'],
                    notes: 'looks good'
                }
            },
            associations
        });

        expect(detections).toHaveLength(1);
        expect(detections[0].lidarObjectId).toBe('laser-9');
        expect(detections[0].status).toBe('validated');
        expect(detections[0].tags).toEqual(['reviewed']);
    });

    it('builds an object catalog from lidar rows and normalizes lidar detections', () => {
        const lidarRows = [{
            'key.frame_timestamp_micros': 1000n,
            'key.laser_object_id': 'laser-9',
            '[LiDARBoxComponent].type': 2,
            '[LiDARBoxComponent].box.center.x': 1,
            '[LiDARBoxComponent].box.center.y': 2,
            '[LiDARBoxComponent].box.center.z': 3,
            '[LiDARBoxComponent].box.size.x': 4,
            '[LiDARBoxComponent].box.size.y': 5,
            '[LiDARBoxComponent].box.size.z': 6,
            '[LiDARBoxComponent].box.heading': 0.1
        }];

        const catalog = buildObjectCatalog(lidarRows, []);
        const detections = normalizeLidarDetections({
            rows: lidarRows,
            segmentId: 'segment-a',
            timestamp: 1000n,
            annotations: {}
        });

        expect(catalog).toHaveLength(1);
        expect(catalog[0].id).toBe('laser-9');
        expect(detections[0].label).toBe('Pedestrian');
        expect(detections[0].heading).toBe(0.1);
    });

    it('reads camera dimensions from raw E2E calibration objects', () => {
        const dimensions = getImageDimensions(1, [
            { name: 1, width: 1920, height: 1280 }
        ]);

        expect(dimensions).toEqual({ width: 1920, height: 1280 });
    });
});
