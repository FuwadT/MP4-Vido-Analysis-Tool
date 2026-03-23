import fs from 'node:fs/promises';
import path from 'node:path';

function buildManifestFileName(segmentId) {
    return `${segmentId}.json`;
}

async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function listLocalManifestFiles(dirPath) {
    try {
        await ensureDirectory(dirPath);
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => path.join(dirPath, entry.name));
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

export function createSegmentRegistry(config, { storageClient }) {
    const {
        storageBucket,
        manifestPrefix,
        localManifestDir,
        uploadPrefix
    } = config;

    function buildManifestObjectName(segmentId) {
        return `${manifestPrefix.replace(/\/$/, '')}/${buildManifestFileName(segmentId)}`;
    }

    function createUploadedSourceMap(segmentId, components) {
        const componentNames = Array.from(new Set(components || [])).sort();
        const sources = {};

        for (const component of componentNames) {
            sources[component] = `gs://${storageBucket}/${uploadPrefix.replace(/\/$/, '')}/${segmentId}/${component}/${segmentId}.parquet`;
        }

        return sources;
    }

    async function saveManifest(manifest) {
        const payload = JSON.stringify(manifest, null, 2);

        if (storageBucket) {
            const file = storageClient.bucket(storageBucket).file(buildManifestObjectName(manifest.segmentId));
            await file.save(payload, {
                contentType: 'application/json',
                resumable: false
            });
            return manifest;
        }

        await ensureDirectory(localManifestDir);
        await fs.writeFile(path.join(localManifestDir, buildManifestFileName(manifest.segmentId)), payload);
        return manifest;
    }

    async function getManifest(segmentId) {
        if (storageBucket) {
            const file = storageClient.bucket(storageBucket).file(buildManifestObjectName(segmentId));
            const [exists] = await file.exists();
            if (!exists) {
                return null;
            }

            const [buffer] = await file.download();
            return JSON.parse(buffer.toString('utf8'));
        }

        const filePath = path.join(localManifestDir, buildManifestFileName(segmentId));

        try {
            const raw = await fs.readFile(filePath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }

            throw error;
        }
    }

    async function listManifests() {
        if (storageBucket) {
            const [files] = await storageClient.bucket(storageBucket).getFiles({
                prefix: `${manifestPrefix.replace(/\/$/, '')}/`
            });

            const manifests = [];

            for (const file of files) {
                if (!file.name.endsWith('.json')) {
                    continue;
                }

                const [buffer] = await file.download();
                manifests.push(JSON.parse(buffer.toString('utf8')));
            }

            return manifests.sort((left, right) => left.segmentId.localeCompare(right.segmentId));
        }

        const manifestPaths = await listLocalManifestFiles(localManifestDir);
        const manifests = await Promise.all(manifestPaths.map(async (manifestPath) => {
            const raw = await fs.readFile(manifestPath, 'utf8');
            return JSON.parse(raw);
        }));

        return manifests.sort((left, right) => left.segmentId.localeCompare(right.segmentId));
    }

    async function createSignedUploadTargets(segmentId, components, options = {}) {
        if (!storageBucket) {
            throw new Error('WAYMO_STORAGE_BUCKET must be set before signed upload URLs can be created.');
        }

        const expiresInMinutes = Number(options.expiresInMinutes || 30);
        const expires = Date.now() + (expiresInMinutes * 60 * 1000);
        const componentNames = Array.from(new Set(components || [])).sort();

        if (componentNames.length === 0) {
            throw new Error('At least one component is required to create upload URLs.');
        }

        const uploads = await Promise.all(componentNames.map(async (component) => {
            const objectName = `${uploadPrefix.replace(/\/$/, '')}/${segmentId}/${component}/${segmentId}.parquet`;
            const file = storageClient.bucket(storageBucket).file(objectName);
            const [uploadUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'write',
                expires,
                contentType: 'application/octet-stream'
            });

            return {
                component,
                objectName,
                sourceUri: `gs://${storageBucket}/${objectName}`,
                uploadUrl
            };
        }));

        return {
            segmentId,
            bucketName: storageBucket,
            expiresAt: new Date(expires).toISOString(),
            uploads
        };
    }

    return {
        createUploadedSourceMap,
        createSignedUploadTargets,
        getManifest,
        listManifests,
        saveManifest
    };
}
