import {
    parquetMetadataAsync,
    parquetReadObjects,
    cachedAsyncBuffer
} from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

export function asyncBufferFromFile(file) {
    return {
        byteLength: file.size,
        slice(start, end) {
            return file.slice(start, end).arrayBuffer();
        }
    };
}

export async function openParquetFile(component, file) {
    const buffer = cachedAsyncBuffer(asyncBufferFromFile(file));
    const metadata = await parquetMetadataAsync(buffer);

    let offset = 0;
    const rowGroups = metadata.row_groups.map((rowGroup) => {
        const numRows = Number(rowGroup.num_rows);
        const group = {
            rowStart: offset,
            rowEnd: offset + numRows,
            numRows
        };
        offset += numRows;
        return group;
    });

    return {
        component,
        file,
        buffer,
        metadata,
        rowGroups,
        numRows: offset
    };
}

export function readAllRows(parquetFile, columns, options = {}) {
    return parquetReadObjects({
        file: parquetFile.buffer,
        metadata: parquetFile.metadata,
        columns,
        compressors,
        rowFormat: 'object',
        utf8: options.utf8
    });
}

export function readRowRange(parquetFile, rowStart, rowEnd, columns, options = {}) {
    return parquetReadObjects({
        file: parquetFile.buffer,
        metadata: parquetFile.metadata,
        columns,
        compressors,
        rowStart,
        rowEnd,
        rowFormat: 'object',
        utf8: options.utf8
    });
}

export function buildFrameIndexFromRows(rows = []) {
    const byTimestamp = new Map();

    for (let index = 0; index < rows.length; index += 1) {
        const timestamp = rows[index]['key.frame_timestamp_micros'];
        if (timestamp == null) {
            continue;
        }

        const existing = byTimestamp.get(timestamp);
        if (existing) {
            existing.rowEnd = index + 1;
        } else {
            byTimestamp.set(timestamp, { rowStart: index, rowEnd: index + 1 });
        }
    }

    return {
        byTimestamp
    };
}

export async function buildFrameIndex(parquetFile, keyColumns = ['key.segment_context_name', 'key.frame_timestamp_micros']) {
    const rows = await readAllRows(parquetFile, keyColumns);
    return buildFrameIndexFromRows(rows);
}

export async function buildCameraFrameIndex(parquetFile) {
    const rows = await readAllRows(parquetFile, ['key.frame_timestamp_micros', 'key.camera_name']);
    const byTimestamp = new Map();
    const byTimestampCamera = new Map();

    for (let index = 0; index < rows.length; index += 1) {
        const timestamp = rows[index]['key.frame_timestamp_micros'];
        const cameraName = rows[index]['key.camera_name'];
        if (timestamp == null) {
            continue;
        }

        const frameEntry = byTimestamp.get(timestamp);
        if (frameEntry) {
            frameEntry.rowEnd = index + 1;
            if (cameraName != null && !frameEntry.cameraNames.includes(cameraName)) {
                frameEntry.cameraNames.push(cameraName);
            }
        } else {
            byTimestamp.set(timestamp, {
                rowStart: index,
                rowEnd: index + 1,
                cameraNames: cameraName == null ? [] : [cameraName]
            });
        }

        if (cameraName == null) {
            continue;
        }

        let cameraMap = byTimestampCamera.get(timestamp);
        if (!cameraMap) {
            cameraMap = new Map();
            byTimestampCamera.set(timestamp, cameraMap);
        }

        const cameraEntry = cameraMap.get(cameraName);
        if (cameraEntry) {
            cameraEntry.rowEnd = index + 1;
        } else {
            cameraMap.set(cameraName, {
                rowStart: index,
                rowEnd: index + 1
            });
        }
    }

    return {
        byTimestamp,
        byTimestampCamera
    };
}

export async function readFrameRows(parquetFile, frameIndex, timestamp, columns, options = {}) {
    const range = frameIndex.byTimestamp.get(timestamp);
    if (!range) {
        return [];
    }

    return readRowRange(parquetFile, range.rowStart, range.rowEnd, columns, options);
}

export async function readCameraFrameRows(parquetFile, frameIndex, timestamp, cameraNames, columns, options = {}) {
    if (!Array.isArray(cameraNames) || cameraNames.length === 0) {
        return readFrameRows(parquetFile, frameIndex, timestamp, columns, options);
    }

    const cameraMap = frameIndex.byTimestampCamera.get(timestamp);
    if (!cameraMap) {
        return [];
    }

    const rowBatches = await Promise.all(
        Array.from(new Set(cameraNames))
            .map((cameraName) => cameraMap.get(cameraName))
            .filter(Boolean)
            .map((range) => readRowRange(parquetFile, range.rowStart, range.rowEnd, columns, options))
    );

    return rowBatches.flat();
}
