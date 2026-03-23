import { describe, expect, it } from 'vitest';
import { getTFRecordIndexCacheKey, indexTFRecordFile, readTFRecordPayload } from './tfrecord';

function createTfRecord(payloadBytes) {
    const payload = Uint8Array.from(payloadBytes);
    const record = new Uint8Array(8 + 4 + payload.length + 4);
    const view = new DataView(record.buffer);

    view.setBigUint64(0, BigInt(payload.length), true);
    record.set(payload, 12);

    return record;
}

describe('TFRecord reader', () => {
    it('indexes and reads payloads across chunk boundaries', async () => {
        const firstPayload = [1, 2, 3, 4, 5, 6];
        const secondPayload = new Array(24).fill(0).map((_, index) => index + 10);
        const file = new File([
            createTfRecord(firstPayload),
            createTfRecord(secondPayload)
        ], 'sample.tfrecord');

        const records = await indexTFRecordFile(file, { chunkSize: 20 });
        const secondRecordPayload = await readTFRecordPayload(file, records[1]);

        expect(records).toHaveLength(2);
        expect(Array.from(secondRecordPayload)).toEqual(secondPayload);
    });

    it('throws when no records are present', async () => {
        const file = new File([], 'empty.tfrecord');

        await expect(indexTFRecordFile(file)).rejects.toThrow('No TFRecord records were found');
    });

    it('reuses a cached index for the same file signature', async () => {
        const file = new File([createTfRecord([1, 2, 3])], 'cached.tfrecord', {
            lastModified: 1234
        });

        const first = await indexTFRecordFile(file, { chunkSize: 20 });
        const second = await indexTFRecordFile(file, { chunkSize: 20 });

        expect(getTFRecordIndexCacheKey(file)).toBe('cached.tfrecord:19:1234');
        expect(second).toBe(first);
    });
});
