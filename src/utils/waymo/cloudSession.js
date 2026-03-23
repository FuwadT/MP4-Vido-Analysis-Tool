const FRAME_CACHE_LIMIT = 8;
const DEFAULT_CLOUD_LIDAR_MAX_POINTS = 6000;

function normalizeApiBaseUrl(apiBaseUrl = '') {
    return String(apiBaseUrl || '').trim().replace(/\/$/, '');
}

function resolveApiUrl(path, apiBaseUrl = '') {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedBase = normalizeApiBaseUrl(apiBaseUrl);
    if (normalizedBase) {
        return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        return new URL(path, window.location.origin).toString();
    }

    return path;
}

function toAssociationMaps(rawAssociations) {
    return {
        cameraToLidar: new Map(Object.entries(rawAssociations?.cameraToLidar || {})),
        lidarToCamera: new Map(
            Object.entries(rawAssociations?.lidarToCamera || {}).map(([lidarObjectId, cameraObjectIds]) => {
                return [lidarObjectId, new Set(cameraObjectIds || [])];
            })
        )
    };
}

function toImageUrlMap(imageUrls, apiBaseUrl) {
    return new Map(
        Object.entries(imageUrls || {}).map(([cameraName, imageUrl]) => {
            return [Number(cameraName), resolveApiUrl(imageUrl, apiBaseUrl)];
        })
    );
}

function uniqueSortedCameraNames(cameraNames) {
    return Array.from(
        new Set((cameraNames || []).map((cameraName) => Number(cameraName)).filter((cameraName) => !Number.isNaN(cameraName)))
    ).sort((left, right) => left - right);
}

async function fetchJson(path, options = {}) {
    const {
        apiBaseUrl = '',
        method = 'GET',
        body
    } = options;
    let response;

    try {
        response = await fetch(resolveApiUrl(path, apiBaseUrl), {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch {
        throw new Error('Unable to reach the cloud API. If you are running locally, leave the API base URL blank to use the built-in `/api` proxy or confirm the backend is running on http://127.0.0.1:8080.');
    }

    if (!response.ok) {
        let message = `Cloud request failed (${response.status}).`;

        try {
            const payload = await response.json();
            if (payload?.error) {
                message = payload.error;
            }
        } catch {
            try {
                const fallbackText = await response.text();
                if (fallbackText) {
                    message = fallbackText;
                }
            } catch {
                // Ignore secondary parsing failures.
            }
        }

        throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/application\/json/i.test(contentType)) {
        const fallbackText = await response.text().catch(() => '');
        if (/<(?:!doctype|html)/i.test(fallbackText)) {
            throw new Error('Cloud API returned HTML instead of JSON. Set the Cloud API base URL to your backend or enable the local `/api` proxy.');
        }

        throw new Error('Cloud API returned a non-JSON response.');
    }

    try {
        return await response.json();
    } catch {
        throw new Error('Cloud API returned invalid JSON. Verify the backend URL and proxy configuration.');
    }
}

function normalizeSummary(summary, apiBaseUrl) {
    return {
        ...summary,
        kind: 'cloud',
        apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
        availableCameras: uniqueSortedCameraNames(summary?.availableCameras),
        associations: toAssociationMaps(summary?.associations)
    };
}

function normalizeFrame(frame, apiBaseUrl) {
    return {
        ...frame,
        kind: 'cloud',
        availableCameras: uniqueSortedCameraNames(frame?.availableCameras),
        imageUrls: toImageUrlMap(frame?.imageUrls, apiBaseUrl),
        lidarStatus: frame?.lidarPointCloud
            ? 'ready'
            : frame?.hasLidar
                ? 'idle'
                : 'unavailable'
    };
}

function mergeFrames(targetFrame, nextFrame) {
    if (!targetFrame) {
        return nextFrame;
    }

    targetFrame.availableCameras = nextFrame.availableCameras?.length
        ? nextFrame.availableCameras
        : targetFrame.availableCameras;
    targetFrame.cameraRows = nextFrame.cameraRows || targetFrame.cameraRows || [];
    targetFrame.lidarRows = nextFrame.lidarRows || targetFrame.lidarRows || [];
    targetFrame.hasLidar = nextFrame.hasLidar ?? targetFrame.hasLidar;

    for (const [cameraName, imageUrl] of nextFrame.imageUrls.entries()) {
        targetFrame.imageUrls.set(cameraName, imageUrl);
    }

    if (nextFrame.lidarPointCloud) {
        targetFrame.lidarPointCloud = nextFrame.lidarPointCloud;
        targetFrame.lidarStatus = 'ready';
    } else if (targetFrame.lidarStatus !== 'ready') {
        targetFrame.lidarStatus = nextFrame.lidarStatus || targetFrame.lidarStatus;
    }

    return targetFrame;
}

function buildFrameRequestPath(segmentId, frameIndex, options = {}) {
    const params = new URLSearchParams();
    const cameraNames = uniqueSortedCameraNames(options.cameraNames);

    for (const cameraName of cameraNames) {
        params.append('camera', String(cameraName));
    }

    if (options.includeLidar) {
        params.set('includeLidar', 'true');
    }

    if (options.maxPoints) {
        params.set('maxPoints', String(options.maxPoints));
    }

    const queryString = params.toString();
    return `/api/cloud/segments/${encodeURIComponent(segmentId)}/frames/${frameIndex}${queryString ? `?${queryString}` : ''}`;
}

function buildLidarRequestPath(segmentId, frameIndex, maxPoints = DEFAULT_CLOUD_LIDAR_MAX_POINTS) {
    const params = new URLSearchParams();
    params.set('maxPoints', String(maxPoints));
    return `/api/cloud/segments/${encodeURIComponent(segmentId)}/frames/${frameIndex}/lidar?${params.toString()}`;
}

function touchCache(cacheOrder, frameIndex) {
    const existing = cacheOrder.indexOf(frameIndex);
    if (existing >= 0) {
        cacheOrder.splice(existing, 1);
    }

    cacheOrder.push(frameIndex);
}

function trimCache(frameCache, cacheOrder) {
    while (cacheOrder.length > FRAME_CACHE_LIMIT) {
        const evictedIndex = cacheOrder.shift();
        if (evictedIndex === undefined) {
            break;
        }

        frameCache.delete(evictedIndex);
    }
}

export async function listWaymoCloudSegments(options = {}) {
    const payload = await fetchJson('/api/cloud/segments', options);
    return payload?.segments || [];
}

export async function registerWaymoCloudLocalSegment(segmentId, options = {}) {
    const payload = await fetchJson('/api/cloud/segments/register-local', {
        ...options,
        method: 'POST',
        body: { segmentId }
    });

    return payload?.manifest || null;
}

export async function createWaymoCloudSession(segmentId, options = {}) {
    const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
    const summary = normalizeSummary(
        await fetchJson(`/api/cloud/segments/${encodeURIComponent(segmentId)}`, { apiBaseUrl }),
        apiBaseUrl
    );
    const frameCache = new Map();
    const cacheOrder = [];
    const pendingFrameLoads = new Map();
    const pendingLidarLoads = new Map();

    async function fetchFrame(frameIndex, requestOptions = {}) {
        const requestKey = JSON.stringify({
            frameIndex,
            cameraNames: uniqueSortedCameraNames(requestOptions.cameraNames),
            includeLidar: requestOptions.includeLidar === true,
            maxPoints: requestOptions.maxPoints || 0
        });
        const pending = pendingFrameLoads.get(requestKey);

        if (pending) {
            return pending;
        }

        const loadPromise = fetchJson(
            buildFrameRequestPath(segmentId, frameIndex, requestOptions),
            { apiBaseUrl }
        )
            .then((framePayload) => {
                const normalizedFrame = normalizeFrame(framePayload, apiBaseUrl);
                const cachedFrame = frameCache.get(frameIndex);
                const frame = mergeFrames(cachedFrame, normalizedFrame);

                frameCache.set(frameIndex, frame);
                touchCache(cacheOrder, frameIndex);
                trimCache(frameCache, cacheOrder);
                return frame;
            })
            .finally(() => {
                pendingFrameLoads.delete(requestKey);
            });

        pendingFrameLoads.set(requestKey, loadPromise);
        return loadPromise;
    }

    async function getFrame(frameIndex, requestOptions = {}) {
        const clampedFrameIndex = Math.max(0, Math.min(frameIndex, summary.totalFrames - 1));
        const cachedFrame = frameCache.get(clampedFrameIndex);
        const requiredCameraNames = uniqueSortedCameraNames(requestOptions.cameraNames);
        const needsCameraFetch = requiredCameraNames.some((cameraName) => !cachedFrame?.imageUrls?.has(cameraName));
        const needsLidarFetch = requestOptions.includeLidar && cachedFrame?.hasLidar && !cachedFrame?.lidarPointCloud;

        if (cachedFrame && !needsCameraFetch && !needsLidarFetch) {
            touchCache(cacheOrder, clampedFrameIndex);
            return cachedFrame;
        }

        return fetchFrame(clampedFrameIndex, {
            cameraNames: requiredCameraNames,
            includeLidar: requestOptions.includeLidar === true,
            maxPoints: requestOptions.maxPoints
        });
    }

    return {
        ...summary,
        async getFrame(frameIndex, requestOptions = {}) {
            return getFrame(frameIndex, requestOptions);
        },
        async ensureFrameCameraImages(frameIndex, cameraNames = []) {
            return getFrame(frameIndex, {
                cameraNames,
                includeLidar: false
            });
        },
        async ensureFrameLidarPointCloud(frameIndex, maxPoints) {
            const frame = frameCache.get(frameIndex);
            if (frame && frame.lidarPointCloud) {
                return frame.lidarPointCloud;
            }

            const clampedFrameIndex = Math.max(0, Math.min(frameIndex, summary.totalFrames - 1));
            const cachedFrame = frameCache.get(clampedFrameIndex);
            if (cachedFrame && cachedFrame.hasLidar === false) {
                return null;
            }

            const resolvedMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0
                ? Math.floor(maxPoints)
                : DEFAULT_CLOUD_LIDAR_MAX_POINTS;
            const requestKey = `${clampedFrameIndex}:${resolvedMaxPoints}`;
            const pending = pendingLidarLoads.get(requestKey);
            if (pending) {
                return pending;
            }

            const loadPromise = fetchJson(
                buildLidarRequestPath(segmentId, clampedFrameIndex, resolvedMaxPoints),
                { apiBaseUrl }
            )
                .then((pointCloud) => {
                    const nextFrame = frameCache.get(clampedFrameIndex);
                    if (nextFrame) {
                        nextFrame.lidarPointCloud = pointCloud;
                        nextFrame.lidarStatus = pointCloud ? 'ready' : 'unavailable';
                        touchCache(cacheOrder, clampedFrameIndex);
                    }

                    return pointCloud || null;
                })
                .finally(() => {
                    pendingLidarLoads.delete(requestKey);
                });

            pendingLidarLoads.set(requestKey, loadPromise);
            return loadPromise;
        },
        prefetchFrame(frameIndex, requestOptions = {}) {
            if (frameIndex < 0 || frameIndex >= summary.totalFrames) {
                return;
            }

            void getFrame(frameIndex, requestOptions).catch(() => {});
        },
        dispose() {
            frameCache.clear();
            cacheOrder.length = 0;
            pendingFrameLoads.clear();
            pendingLidarLoads.clear();
        }
    };
}
