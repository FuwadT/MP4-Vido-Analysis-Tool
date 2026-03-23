import { describe, expect, it } from 'vitest';
import { buildFrameIndexFromRows } from './parquet';

describe('waymo parquet helpers', () => {
    it('builds timestamp row ranges from lightweight key rows', () => {
        const index = buildFrameIndexFromRows([
            { 'key.frame_timestamp_micros': 1000n },
            { 'key.frame_timestamp_micros': 1000n },
            { 'key.frame_timestamp_micros': 2000n },
            { 'key.frame_timestamp_micros': 3000n },
            { 'key.frame_timestamp_micros': 3000n }
        ]);

        expect(index.byTimestamp.get(1000n)).toEqual({ rowStart: 0, rowEnd: 2 });
        expect(index.byTimestamp.get(2000n)).toEqual({ rowStart: 2, rowEnd: 3 });
        expect(index.byTimestamp.get(3000n)).toEqual({ rowStart: 3, rowEnd: 5 });
    });
});
