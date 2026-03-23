const HEADER_BYTES = 12;
const FOOTER_BYTES = 4;
const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024;
const INDEX_CACHE_LIMIT = 8;
const tfrecordIndexCache = new Map();

export function getTFRecordIndexCacheKey(file) {
    return [
        file?.name || 'unnamed',
        Number(file?.size || 0),
        Number(file?.lastModified || 0)
    ].join(':');
}

function cacheTFRecordIndex(cacheKey, records) {
    if (!cacheKey) {
        return;
    }

    if (tfrecordIndexCache.has(cacheKey)) {
        tfrecordIndexCache.delete(cacheKey);
    }

    tfrecordIndexCache.set(cacheKey, records);

    while (tfrecordIndexCache.size > INDEX_CACHE_LIMIT) {
        const oldestKey = tfrecordIndexCache.keys().next().value;
        tfrecordIndexCache.delete(oldestKey);
    }
}

function readLengthFromHeader(headerBytes) {
    const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
    const length = Number(view.getBigUint64(0, true));

    if (!Number.isSafeInteger(length)) {
        throw new Error('Encountered a TFRecord record larger than the browser can safely address.');
    }

    return length;
}

async function readChunk(file, start, size) {
    return new Uint8Array(await file.slice(start, start + size).arrayBuffer());
}

export async function indexTFRecordFile(file, options = {}) {
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const cacheKey = options.cacheKey ?? getTFRecordIndexCacheKey(file);
    const cached = options.disableCache ? null : tfrecordIndexCache.get(cacheKey);

    if (cached) {
        if (onProgress) {
            onProgress({
                loadedBytes: file.size,
                totalBytes: file.size,
                recordCount: cached.length,
                fromCache: true
            });
        }

        return cached;
    }

    const records = [];

    let offset = 0;

    while (offset < file.size) {
        const chunk = await readChunk(file, offset, chunkSize);
        if (chunk.byteLength === 0) {
            break;
        }

        let cursor = 0;

        while (cursor + HEADER_BYTES <= chunk.byteLength) {
            const header = chunk.subarray(cursor, cursor + HEADER_BYTES);
            const payloadLength = readLengthFromHeader(header);
            const payloadOffset = offset + cursor + HEADER_BYTES;
            const nextOffset = payloadOffset + payloadLength + FOOTER_BYTES;

            if (nextOffset > file.size) {
                throw new Error(`Invalid TFRecord structure near byte ${offset + cursor}.`);
            }

            records.push({
                index: records.length,
                payloadOffset,
                payloadLength
            });

            cursor = nextOffset - offset;

            if (onProgress && (records.length === 1 || records.length % 200 === 0 || nextOffset >= file.size)) {
                onProgress({
                    loadedBytes: Math.min(nextOffset, file.size),
                    totalBytes: file.size,
                    recordCount: records.length
                });
            }

            if (cursor > chunk.byteLength) {
                break;
            }
        }

        if (cursor === 0) {
            throw new Error(`Unable to read a complete TFRecord header near byte ${offset}.`);
        }

        offset += cursor;
    }

    if (records.length === 0) {
        throw new Error('No TFRecord records were found in the selected file.');
    }

    cacheTFRecordIndex(cacheKey, records);
    return records;
}

export async function readTFRecordPayload(file, recordIndexEntry) {
    return new Uint8Array(
        await file
            .slice(recordIndexEntry.payloadOffset, recordIndexEntry.payloadOffset + recordIndexEntry.payloadLength)
            .arrayBuffer()
    );
}
