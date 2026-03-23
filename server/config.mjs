import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, '..');

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveDefaultLocalDataRoot(explicitValue, repoRoot) {
    if (explicitValue) {
        return path.resolve(explicitValue);
    }

    const candidates = [
        path.resolve(repoRoot, '..', 'waymo_data'),
        path.resolve(repoRoot, 'data', 'waymo_data'),
        path.resolve(repoRoot, 'data', 'waymo', 'perception')
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

export function loadServerConfig() {
    return {
        repoRoot,
        port: parseNumber(process.env.PORT, 8080),
        distDir: path.resolve(repoRoot, 'dist'),
        localManifestDir: process.env.WAYMO_LOCAL_MANIFEST_DIR
            ? path.resolve(process.env.WAYMO_LOCAL_MANIFEST_DIR)
            : path.resolve(repoRoot, 'data', 'cloud-manifests'),
        localDataRoot: resolveDefaultLocalDataRoot(process.env.WAYMO_LOCAL_DATA_ROOT, repoRoot),
        storageBucket: process.env.WAYMO_STORAGE_BUCKET || '',
        manifestPrefix: process.env.WAYMO_MANIFEST_PREFIX || 'cloud-manifests',
        uploadPrefix: process.env.WAYMO_UPLOAD_PREFIX || 'waymo-segments',
        openSessionLimit: parseNumber(process.env.WAYMO_OPEN_SESSION_LIMIT, 3),
        frameCacheLimit: parseNumber(process.env.WAYMO_SERVER_FRAME_CACHE_LIMIT, 6),
        enableCors: process.env.WAYMO_ENABLE_CORS !== 'false',
        studioStoreFile: process.env.ADAS_STUDIO_STORE_FILE
            ? path.resolve(process.env.ADAS_STUDIO_STORE_FILE)
            : path.resolve(repoRoot, 'data', 'studio', 'studio-store.json')
    };
}
