import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parquetMetadataAsync,
    cachedAsyncBuffer
} from 'hyparquet';

function toArrayBuffer(value) {
    if (value instanceof ArrayBuffer) {
        return value;
    }

    const view = value instanceof Uint8Array ? value : new Uint8Array(value);
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function buildRowGroups(metadata) {
    let offset = 0;

    return metadata.row_groups.map((rowGroup) => {
        const numRows = Number(rowGroup.num_rows);
        const group = {
            rowStart: offset,
            rowEnd: offset + numRows,
            numRows
        };

        offset += numRows;
        return group;
    });
}

function parseGsUri(uri) {
    const withoutScheme = uri.slice('gs://'.length);
    const slashIndex = withoutScheme.indexOf('/');

    if (slashIndex < 0) {
        return {
            bucketName: withoutScheme,
            objectName: ''
        };
    }

    return {
        bucketName: withoutScheme.slice(0, slashIndex),
        objectName: withoutScheme.slice(slashIndex + 1)
    };
}

async function createLocalAsyncBuffer(filePath) {
    const stats = await fs.stat(filePath);
    const handle = await fs.open(filePath, 'r');

    return {
        byteLength: stats.size,
        async slice(start, end) {
            const resolvedStart = Math.max(0, start || 0);
            const resolvedEnd = Math.max(resolvedStart, end ?? stats.size);
            const length = Math.max(resolvedEnd - resolvedStart, 0);
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await handle.read(buffer, 0, length, resolvedStart);
            return toArrayBuffer(buffer.subarray(0, bytesRead));
        },
        async close() {
            await handle.close();
        }
    };
}

async function createGcsAsyncBuffer(storageClient, bucketName, objectName) {
    const file = storageClient.bucket(bucketName).file(objectName);
    const [metadata] = await file.getMetadata();
    const byteLength = Number(metadata.size || 0);

    return {
        byteLength,
        async slice(start, end) {
            const resolvedStart = Math.max(0, start || 0);
            const resolvedEnd = Math.max(resolvedStart, end ?? byteLength);
            if (resolvedEnd <= resolvedStart) {
                return new ArrayBuffer(0);
            }

            const [buffer] = await file.download({
                start: resolvedStart,
                end: resolvedEnd - 1
            });

            return toArrayBuffer(buffer);
        }
    };
}

export function parseSourceUri(sourceUri) {
    if (typeof sourceUri !== 'string' || sourceUri.length === 0) {
        throw new Error('Waymo source URI is required.');
    }

    if (sourceUri.startsWith('gs://')) {
        const { bucketName, objectName } = parseGsUri(sourceUri);
        if (!bucketName || !objectName) {
            throw new Error(`Invalid gs:// URI: ${sourceUri}`);
        }

        return {
            kind: 'gcs',
            bucketName,
            objectName,
            sourceUri
        };
    }

    if (sourceUri.startsWith('file://')) {
        return {
            kind: 'local',
            filePath: fileURLToPath(sourceUri),
            sourceUri
        };
    }

    return {
        kind: 'local',
        filePath: path.resolve(sourceUri),
        sourceUri
    };
}

export async function openParquetSource(component, sourceUri, { storageClient } = {}) {
    const parsedSource = parseSourceUri(sourceUri);
    const rawBuffer = parsedSource.kind === 'gcs'
        ? await createGcsAsyncBuffer(storageClient, parsedSource.bucketName, parsedSource.objectName)
        : await createLocalAsyncBuffer(parsedSource.filePath);
    const buffer = cachedAsyncBuffer(rawBuffer);
    const metadata = await parquetMetadataAsync(buffer);
    const rowGroups = buildRowGroups(metadata);
    const numRows = rowGroups[rowGroups.length - 1]?.rowEnd || 0;

    return {
        component,
        sourceUri,
        buffer,
        metadata,
        rowGroups,
        numRows,
        async close() {
            if (typeof rawBuffer.close === 'function') {
                await rawBuffer.close();
            }
        }
    };
}
