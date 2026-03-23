import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, FileArchive, FolderOpen, Gauge, Image as ImageIcon, Layers3, LoaderCircle, MapPinned, RefreshCw, Route, Sparkles } from 'lucide-react';
import { WaymoPlaybackControls } from './WaymoPlaybackControls';
import { WaymoImageViewer } from './WaymoImageViewer';
import { WaymoLidarViewer } from './WaymoLidarViewer';
import { WaymoScene3DViewer } from './WaymoScene3DViewer';
import { WaymoAnnotationsSidebar } from './WaymoAnnotationsSidebar';
import { WaymoOperatorConsole } from './WaymoOperatorConsole';
import { WaymoE2EDashboard } from './WaymoE2EDashboard';
import { CAMERA_NAMES, CAMERA_ORDER, REQUIRED_WAYMO_COMPONENTS, getCameraLabel } from '../utils/waymo/constants';
import { describeSegments, scanWaymoFiles } from '../utils/waymo/folderScan';
import { formatFrameCounter, formatTimestampMicros, normalizeCameraDetections, normalizeLidarDetections } from '../utils/waymo/normalize';
import { createWaymoDatasetSession } from '../utils/waymo/session';
import { createWaymoE2ESession } from '../utils/waymo/e2eSession';
import { createWaymoCloudSession, listWaymoCloudSegments, registerWaymoCloudLocalSegment } from '../utils/waymo/cloudSession';

const ANNOTATION_STORAGE_PREFIX = 'waymo_annotations_';
const WAYMO_TFRECORD_PATTERN = /\.tfrecord(?:[-.].+)?$/i;
const SIMULATION_MODE_STORAGE_KEY = 'waymo_simulation_mode';
const CLOUD_API_STORAGE_KEY = 'waymo_cloud_api_base_url';
const DEFAULT_CLOUD_API_BASE_URL = import.meta.env.VITE_WAYMO_CLOUD_API_URL || '';
const PLAYBACK_INTERVAL_MS = 80;

function loadStoredAnnotations(segmentId) {
    try {
        const raw = localStorage.getItem(`${ANNOTATION_STORAGE_PREFIX}${segmentId}`);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Failed to load stored Waymo annotations', error);
        return {};
    }
}

function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function isWaymoTfrecordFile(file) {
    return Boolean(file?.name && WAYMO_TFRECORD_PATTERN.test(file.name));
}

function getPreferredCamera(availableCameras) {
    return CAMERA_ORDER.find(cameraName => availableCameras.includes(cameraName))
        || availableCameras[0]
        || CAMERA_NAMES.FRONT;
}

function cloneFrameForState(frame) {
    if (!frame) {
        return frame;
    }

    return {
        ...frame,
        imageUrls: frame.imageUrls instanceof Map ? new Map(frame.imageUrls) : frame.imageUrls
    };
}

function mergeFrameForDisplay(nextFrame, previousFrame = null) {
    if (!nextFrame) {
        return nextFrame;
    }

    const previousImageUrls = previousFrame?.imageUrls instanceof Map ? previousFrame.imageUrls : null;
    const nextImageUrls = nextFrame.imageUrls instanceof Map ? new Map(nextFrame.imageUrls) : new Map();

    if (previousImageUrls) {
        for (const [cameraName, imageUrl] of previousImageUrls.entries()) {
            if (!nextImageUrls.has(cameraName)) {
                nextImageUrls.set(cameraName, imageUrl);
            }
        }
    }

    const shouldHoldPreviousLidar = (
        previousFrame?.lidarPointCloud
        && nextFrame?.hasLidar
        && !nextFrame?.lidarPointCloud
        && nextFrame?.lidarStatus !== 'ready'
    );

    return {
        ...nextFrame,
        imageUrls: nextImageUrls,
        lidarPointCloud: shouldHoldPreviousLidar ? previousFrame.lidarPointCloud : nextFrame.lidarPointCloud,
        lidarStatus: shouldHoldPreviousLidar ? 'loading' : nextFrame.lidarStatus
    };
}

function getInitialSimulationMode() {
    try {
        const stored = localStorage.getItem(SIMULATION_MODE_STORAGE_KEY);
        return stored === 'cloud' ? 'cloud' : 'local';
    } catch {
        return 'local';
    }
}

function getInitialCloudApiBaseUrl() {
    const defaultBaseUrl = (() => {
        if (DEFAULT_CLOUD_API_BASE_URL) {
            return DEFAULT_CLOUD_API_BASE_URL;
        }

        if (typeof window !== 'undefined') {
            const { hostname } = window.location;
            if (hostname === '127.0.0.1' || hostname === 'localhost') {
                return '';
            }
        }

        return '';
    })();

    try {
        return localStorage.getItem(CLOUD_API_STORAGE_KEY) || defaultBaseUrl;
    } catch {
        return defaultBaseUrl;
    }
}

function buildLoadingMessage(status, loadProgress) {
    if (status === 'indexing-tfrecord') {
        const loadedBytes = loadProgress?.loadedBytes || 0;
        const totalBytes = loadProgress?.totalBytes || 0;
        const recordCount = loadProgress?.recordCount || 0;
        const percent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

        return `Indexing raw TFRecord... ${percent}% (${recordCount} frames found)`;
    }

    if (status === 'loading' || status === 'loading-frame') {
        return 'Loading Waymo data...';
    }

    return '';
}

function formatCloudSourceType(sourceType) {
    if (!sourceType) {
        return 'Cloud source';
    }

    return String(sourceType)
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((token) => token[0].toUpperCase() + token.slice(1))
        .join(' ');
}

function getScenarioTitle(segment) {
    return segment?.scenario?.title || 'Waymo driving scenario';
}

function getScenarioSummary(segment) {
    return segment?.scenario?.summary || 'Open the scenario to review the synchronized ego-view cameras and LiDAR stream.';
}

function getScenarioTags(segment) {
    return segment?.scenario?.tags || [];
}

function getScenarioMetricValue(segment, key) {
    const value = segment?.scenario?.metrics?.[key];
    if (!(Number.isFinite(value) && value >= 0)) {
        return 'N/A';
    }

    if (key === 'durationSeconds') {
        return `${Math.round(value)}s`;
    }

    if (key === 'distanceMeters') {
        return `${Math.round(value)}m`;
    }

    if (key === 'avgSpeedMps') {
        return `${Math.round(value * 2.23694)} mph`;
    }

    if (key === 'totalObjectCount') {
        return Math.round(value).toLocaleString();
    }

    return String(value);
}

function getCloudSegmentOptionLabel(segment) {
    const title = getScenarioTitle(segment);
    const frameCount = Number(segment?.totalFrames || 0);
    return frameCount > 0
        ? `${title} - ${segment.segmentId} (${frameCount} frames)`
        : `${title} - ${segment.segmentId}`;
}

function computePoseSpeedMps(currentPose, previousPose) {
    if (!currentPose || !previousPose) {
        return null;
    }

    const currentTimestamp = Number(currentPose.timestamp || 0);
    const previousTimestamp = Number(previousPose.timestamp || 0);
    const dtSeconds = (currentTimestamp - previousTimestamp) / 1_000_000;
    if (!(Number.isFinite(dtSeconds) && dtSeconds > 0)) {
        return null;
    }

    const dx = Number(currentPose.x || 0) - Number(previousPose.x || 0);
    const dy = Number(currentPose.y || 0) - Number(previousPose.y || 0);
    return Math.sqrt((dx * dx) + (dy * dy)) / dtSeconds;
}

function computeObjectDistanceMeters(object) {
    if (!object) {
        return null;
    }

    const x = Number(object.centerX || 0);
    const y = Number(object.centerY || 0);
    const z = Number(object.centerZ || 0);
    return Math.sqrt((x * x) + (y * y) + (z * z));
}

export function WaymoDatasetStudio({
    embedded = false,
    presentation = 'default',
    onReplayContextChange = null,
    onCreateFindingRequest = null,
    onCreateBookmarkRequest = null,
    onPromoteScenarioRequest = null,
    recentFindings = []
}) {
    const folderInputRef = useRef(null);
    const tfrecordInputRef = useRef(null);
    const filesBySegmentRef = useRef(new Map());
    const sessionRef = useRef(null);
    const requestIdRef = useRef(0);
    const currentFrameIndexRef = useRef(0);
    const cloudBootstrapKeyRef = useRef('');
    const previousPoseRef = useRef(null);
    const frameObjectHistoryRef = useRef(new Map());

    const [simulationMode, setSimulationMode] = useState(getInitialSimulationMode);
    const [cloudApiBaseUrl, setCloudApiBaseUrl] = useState(getInitialCloudApiBaseUrl);
    const [cloudSegments, setCloudSegments] = useState([]);
    const [cloudSegmentDraft, setCloudSegmentDraft] = useState('');
    const [isRefreshingCloudSegments, setIsRefreshingCloudSegments] = useState(false);
    const [isRegisteringCloudSegment, setIsRegisteringCloudSegment] = useState(false);
    const [segments, setSegments] = useState([]);
    const [selectedSegmentId, setSelectedSegmentId] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(null);
    const [selectedCamera, setSelectedCamera] = useState(CAMERA_NAMES.FRONT);
    const [isPlaying, setIsPlaying] = useState(false);
    const [annotations, setAnnotations] = useState({});
    const [selectedObjectKey, setSelectedObjectKey] = useState(null);
    const [sessionSummary, setSessionSummary] = useState(null);
    const [loadProgress, setLoadProgress] = useState(null);

    useEffect(() => {
        if (folderInputRef.current) {
            folderInputRef.current.setAttribute('webkitdirectory', '');
            folderInputRef.current.setAttribute('directory', '');
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(SIMULATION_MODE_STORAGE_KEY, simulationMode);
        } catch {
            // Ignore storage write failures.
        }
    }, [simulationMode]);

    useEffect(() => {
        try {
            localStorage.setItem(CLOUD_API_STORAGE_KEY, cloudApiBaseUrl);
        } catch {
            // Ignore storage write failures.
        }
    }, [cloudApiBaseUrl]);

    useEffect(() => {
        cloudBootstrapKeyRef.current = '';
    }, [cloudApiBaseUrl, simulationMode]);

    const isStructuredSession = sessionSummary?.kind === 'parquet' || sessionSummary?.kind === 'cloud';
    const isCloudSession = sessionSummary?.kind === 'cloud';
    const isE2ESession = sessionSummary?.kind === 'e2e';
    const isOperatorPresentation = presentation === 'operator';

    const clearActiveSession = useCallback((nextStatus = 'idle') => {
        requestIdRef.current += 1;
        currentFrameIndexRef.current = 0;

        if (sessionRef.current) {
            sessionRef.current.dispose();
            sessionRef.current = null;
        }

        setStatus(nextStatus);
        setError('');
        setLoadProgress(null);
        setSessionSummary(null);
        setSelectedSegmentId('');
        setCurrentFrameIndex(0);
        setCurrentFrame(null);
        setSelectedCamera(CAMERA_NAMES.FRONT);
        setIsPlaying(false);
        setAnnotations({});
        setSelectedObjectKey(null);
    }, []);

    const currentCameraDetections = useMemo(() => {
        if (!isStructuredSession || !sessionSummary || !currentFrame) {
            return [];
        }

        return normalizeCameraDetections({
            rows: currentFrame.cameraRows,
            selectedCamera,
            segmentId: sessionSummary.segmentId,
            timestamp: currentFrame.timestamp,
            annotations,
            associations: sessionSummary.associations
        });
    }, [annotations, currentFrame, isStructuredSession, selectedCamera, sessionSummary]);

    const currentLidarDetections = useMemo(() => {
        if (!isStructuredSession || !sessionSummary || !currentFrame) {
            return [];
        }

        return normalizeLidarDetections({
            rows: currentFrame.lidarRows,
            segmentId: sessionSummary.segmentId,
            timestamp: currentFrame.timestamp,
            annotations
        });
    }, [annotations, currentFrame, isStructuredSession, sessionSummary]);

    const currentObjects = useMemo(() => {
        if (!isStructuredSession) {
            return [];
        }

        return currentCameraDetections.length > 0 ? currentCameraDetections : currentLidarDetections;
    }, [currentCameraDetections, currentLidarDetections, isStructuredSession]);

    const cameraLinkedLidarObjectIds = useMemo(() => {
        return new Set(
            currentCameraDetections
                .map((detection) => detection.lidarObjectId)
                .filter(Boolean)
        );
    }, [currentCameraDetections]);

    const selectableCameras = useMemo(() => {
        const rawCameras = currentFrame?.availableCameras?.length
            ? currentFrame.availableCameras
            : sessionSummary?.availableCameras || [];

        if (rawCameras.length === 0) {
            return CAMERA_ORDER;
        }

        const known = CAMERA_ORDER.filter(cameraName => rawCameras.includes(cameraName));
        const extras = rawCameras.filter(cameraName => !CAMERA_ORDER.includes(cameraName));
        return [...known, ...extras];
    }, [currentFrame, sessionSummary]);

    const resolvedSelectedObjectKey = useMemo(() => {
        if (selectedObjectKey && currentObjects.some(item => item.annotationKey === selectedObjectKey)) {
            return selectedObjectKey;
        }

        return currentObjects[0]?.annotationKey || null;
    }, [currentObjects, selectedObjectKey]);

    const selectedObject = useMemo(() => {
        return currentObjects.find(item => item.annotationKey === resolvedSelectedObjectKey) || null;
    }, [currentObjects, resolvedSelectedObjectKey]);

    const selectedAnnotation = useMemo(() => {
        return selectedObject ? annotations[selectedObject.annotationKey] || {} : null;
    }, [annotations, selectedObject]);
    const measurements = useMemo(() => {
        const previousPose = previousPoseRef.current;
        const previousObjects = frameObjectHistoryRef.current.get(currentFrameIndex - 1) || new Map();
        const previousObject = selectedObject?.objectId ? previousObjects.get(selectedObject.objectId) : null;
        const relativeDistanceMeters = computeObjectDistanceMeters(selectedObject);
        let relativeSpeedMps = null;

        if (selectedObject && previousObject && currentFrame?.timestamp && previousObject.timestamp) {
            const dtSeconds = (Number(currentFrame.timestamp) - Number(previousObject.timestamp)) / 1_000_000;
            if (Number.isFinite(dtSeconds) && dtSeconds > 0) {
                const currentDistance = computeObjectDistanceMeters(selectedObject);
                const previousDistance = Math.sqrt(
                    (previousObject.centerX * previousObject.centerX)
                    + (previousObject.centerY * previousObject.centerY)
                    + (previousObject.centerZ * previousObject.centerZ)
                );
                relativeSpeedMps = (currentDistance - previousDistance) / dtSeconds;
            }
        }

        return {
            egoSpeedMps: computePoseSpeedMps(currentFrame?.egoPose, previousPose),
            relativeDistanceMeters,
            relativeSpeedMps,
            eventDurationSeconds: Number(sessionSummary?.scenario?.metrics?.durationSeconds || 0) || null,
            worldX: Number(currentFrame?.egoPose?.x || 0),
            worldY: Number(currentFrame?.egoPose?.y || 0)
        };
    }, [currentFrame, currentFrameIndex, selectedObject, sessionSummary]);

    const usableLocalSegments = useMemo(() => {
        return segments.filter(segment => segment.isUsable);
    }, [segments]);

    const cloudSegmentOptions = useMemo(() => {
        const seen = new Set();
        const options = [];

        for (const segment of cloudSegments) {
            if (!segment?.segmentId || seen.has(segment.segmentId)) {
                continue;
            }

            seen.add(segment.segmentId);
            options.push(segment);
        }

        if (selectedSegmentId && !seen.has(selectedSegmentId)) {
            options.unshift({
                segmentId: selectedSegmentId,
                sourceType: isCloudSession ? 'current' : 'cloud'
            });
        }

        return options;
    }, [cloudSegments, isCloudSession, selectedSegmentId]);

    const structuredSegmentOptions = simulationMode === 'cloud' ? cloudSegmentOptions : usableLocalSegments;
    const selectedCloudSegment = useMemo(() => {
        if (simulationMode !== 'cloud') {
            return null;
        }

        return cloudSegmentOptions.find((segment) => segment.segmentId === selectedSegmentId) || null;
    }, [cloudSegmentOptions, selectedSegmentId, simulationMode]);

    const loadFrame = useCallback(async (frameIndex, sessionOverride = null, options = {}) => {
        const session = sessionOverride || sessionRef.current;
        if (!session) {
            return;
        }

        const clampedFrameIndex = Math.max(0, Math.min(frameIndex, session.totalFrames - 1));
        const primaryCamera = options.primaryCamera ?? selectedCamera;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const supportsStructuredStreaming = session.kind === 'parquet' || session.kind === 'cloud';
        const skipLidar = options.skipLidar === true;
        const skipPrefetch = options.skipPrefetch === true;
        const suppressLoadingState = options.suppressLoadingState === true;

        if (!suppressLoadingState) {
            setStatus(previous => (previous === 'indexing-tfrecord' ? previous : 'loading-frame'));
        }

        try {
            const frame = supportsStructuredStreaming
                ? await session.getFrame(clampedFrameIndex, {
                    cameraNames: primaryCamera ? [primaryCamera] : [],
                    includeLidar: false
                })
                : await session.getFrame(clampedFrameIndex);
            if (requestIdRef.current !== requestId) {
                return;
            }

            currentFrameIndexRef.current = clampedFrameIndex;
            setCurrentFrameIndex(clampedFrameIndex);
            setCurrentFrame((previous) => cloneFrameForState(mergeFrameForDisplay(frame, previous)));
            setSelectedCamera((previous) => {
                if (frame?.imageUrls?.has?.(previous)) {
                    return previous;
                }

                return getPreferredCamera(frame?.availableCameras || session.availableCameras || []) || previous;
            });
            setStatus('ready');

            if (supportsStructuredStreaming) {
                const resolvedCamera = frame?.imageUrls?.has?.(primaryCamera)
                    ? primaryCamera
                    : getPreferredCamera(frame?.availableCameras || session.availableCameras || []);

                if (resolvedCamera && !skipPrefetch) {
                    session.prefetchFrame(clampedFrameIndex + 1, {
                        cameraNames: [resolvedCamera],
                        includeLidar: false
                    });
                    session.prefetchFrame(clampedFrameIndex - 1, {
                        cameraNames: [resolvedCamera],
                        includeLidar: false
                    });

                    if (typeof session.ensureFrameLidarPointCloud === 'function' && !skipLidar) {
                        void session.ensureFrameLidarPointCloud(clampedFrameIndex + 1).catch(() => {});
                    }
                }

                if (frame?.hasLidar && !skipLidar) {
                    void session.ensureFrameLidarPointCloud(clampedFrameIndex)
                        .then((pointCloud) => {
                            if (
                                requestIdRef.current !== requestId
                                || sessionRef.current !== session
                                || currentFrameIndexRef.current !== clampedFrameIndex
                            ) {
                                return;
                            }

                            setCurrentFrame((previous) => {
                                if (!previous || previous.frameIndex !== clampedFrameIndex) {
                                    return previous;
                                }

                                return cloneFrameForState({
                                    ...previous,
                                    lidarPointCloud: pointCloud,
                                    lidarStatus: 'ready'
                                });
                            });
                        })
                        .catch((lidarError) => {
                            console.error(lidarError);
                        });
                }
            }
        } catch (frameError) {
            console.error(frameError);
            setStatus('error');
            setError(frameError instanceof Error ? frameError.message : 'Failed to load frame.');
        }
    }, [selectedCamera]);

    const loadSegment = useCallback(async (segmentId) => {
        const fileMap = filesBySegmentRef.current.get(segmentId);
        if (!fileMap) {
            return;
        }

        clearActiveSession('loading');
        setSelectedSegmentId(segmentId);

        try {
            const session = await createWaymoDatasetSession(segmentId, fileMap);
            const parquetSession = { kind: 'parquet', ...session };

            sessionRef.current = parquetSession;
            setSessionSummary(parquetSession);
            setAnnotations(loadStoredAnnotations(segmentId));
            const preferredCamera = getPreferredCamera(parquetSession.availableCameras || []);
            setSelectedCamera(preferredCamera);
            await loadFrame(0, parquetSession, { primaryCamera: preferredCamera });
        } catch (segmentError) {
            console.error(segmentError);
            setStatus('error');
            setError(segmentError instanceof Error ? segmentError.message : 'Failed to open segment.');
        }
    }, [clearActiveSession, loadFrame]);

    const loadCloudSegment = useCallback(async (segmentId) => {
        const normalizedSegmentId = String(segmentId || '').trim();
        if (!normalizedSegmentId) {
            return;
        }

        clearActiveSession('loading');
        setSelectedSegmentId(normalizedSegmentId);

        try {
            const session = await createWaymoCloudSession(normalizedSegmentId, {
                apiBaseUrl: cloudApiBaseUrl
            });

            sessionRef.current = session;
            setSessionSummary(session);
            setAnnotations(loadStoredAnnotations(normalizedSegmentId));
            const preferredCamera = getPreferredCamera(session.availableCameras || []);
            setSelectedCamera(preferredCamera);
            await loadFrame(0, session, { primaryCamera: preferredCamera });
        } catch (segmentError) {
            console.error(segmentError);
            setStatus('error');
            setError(segmentError instanceof Error ? segmentError.message : 'Failed to open cloud segment.');
        }
    }, [clearActiveSession, cloudApiBaseUrl, loadFrame]);

    const refreshCloudSegments = useCallback(async ({ autoLoad = false, preferredSegmentId = '' } = {}) => {
        setIsRefreshingCloudSegments(true);
        setError('');

        try {
            const nextSegments = await listWaymoCloudSegments({
                apiBaseUrl: cloudApiBaseUrl
            });

            setCloudSegments(nextSegments);

            if (!autoLoad) {
                return nextSegments;
            }

            const desiredSegmentId = preferredSegmentId || selectedSegmentId;
            const fallbackSegmentId = nextSegments[0]?.segmentId || '';
            const segmentToLoad = nextSegments.some(segment => segment.segmentId === desiredSegmentId)
                ? desiredSegmentId
                : fallbackSegmentId;

            if (segmentToLoad) {
                await loadCloudSegment(segmentToLoad);
            }

            return nextSegments;
        } catch (cloudError) {
            setStatus('error');
            setError(cloudError instanceof Error ? cloudError.message : 'Failed to refresh cloud segments.');
            return [];
        } finally {
            setIsRefreshingCloudSegments(false);
        }
    }, [cloudApiBaseUrl, loadCloudSegment, selectedSegmentId]);

    const loadTfrecord = useCallback(async (file) => {
        clearActiveSession('indexing-tfrecord');
        setSelectedSegmentId(file.name);
        setSegments([]);

        try {
            const session = await createWaymoE2ESession(file, {
                onIndexProgress: (progress) => {
                    setLoadProgress(progress);
                    setStatus('indexing-tfrecord');
                }
            });

            sessionRef.current = session;
            setSessionSummary(session);
            setSelectedCamera(getPreferredCamera(session.availableCameras || []));
            setLoadProgress(null);
            await loadFrame(0, session);
        } catch (tfrecordError) {
            console.error(tfrecordError);
            setStatus('error');
            setError(tfrecordError instanceof Error ? tfrecordError.message : 'Failed to open TFRecord shard.');
        }
    }, [clearActiveSession, loadFrame]);

    const handleRegisterCloudLocalSegment = useCallback(async () => {
        const normalizedSegmentId = cloudSegmentDraft.trim();
        if (!normalizedSegmentId) {
            setStatus('error');
            setError('Enter a segment id to register from the cloud backend local data root.');
            return;
        }

        setIsRegisteringCloudSegment(true);
        setError('');

        try {
            await registerWaymoCloudLocalSegment(normalizedSegmentId, {
                apiBaseUrl: cloudApiBaseUrl
            });
            await refreshCloudSegments({
                autoLoad: true,
                preferredSegmentId: normalizedSegmentId
            });
        } catch (registerError) {
            console.error(registerError);
            setStatus('error');
            setError(registerError instanceof Error ? registerError.message : 'Failed to register cloud segment.');
        } finally {
            setIsRegisteringCloudSegment(false);
        }
    }, [cloudApiBaseUrl, cloudSegmentDraft, refreshCloudSegments]);

    useEffect(() => {
        if (!selectedSegmentId || !isStructuredSession) {
            return undefined;
        }

        try {
            localStorage.setItem(`${ANNOTATION_STORAGE_PREFIX}${selectedSegmentId}`, JSON.stringify(annotations));
        } catch (storageError) {
            console.error('Failed to store Waymo annotations', storageError);
        }

        return undefined;
    }, [annotations, isStructuredSession, selectedSegmentId]);

    useEffect(() => {
        if (!currentFrame) {
            return undefined;
        }

        const objectSnapshot = new Map(
            currentObjects
                .filter((item) => item.objectId)
                .map((item) => [
                    item.objectId,
                    {
                        timestamp: currentFrame.timestamp,
                        centerX: Number(item.centerX || 0),
                        centerY: Number(item.centerY || 0),
                        centerZ: Number(item.centerZ || 0)
                    }
                ])
        );
        frameObjectHistoryRef.current.set(currentFrame.frameIndex, objectSnapshot);
        if (frameObjectHistoryRef.current.size > 12) {
            const oldestKey = Array.from(frameObjectHistoryRef.current.keys()).sort((left, right) => left - right)[0];
            frameObjectHistoryRef.current.delete(oldestKey);
        }

        return undefined;
    }, [currentFrame, currentObjects]);

    useEffect(() => {
        if (!currentFrame?.egoPose) {
            return undefined;
        }

        const previousPose = previousPoseRef.current;
        previousPoseRef.current = currentFrame.egoPose;

        if (!onReplayContextChange || !sessionSummary) {
            return undefined;
        }

        onReplayContextChange({
            frameIndex: currentFrameIndex,
            timestampMicros: currentFrame.timestamp,
            segmentId: sessionSummary.segmentId,
            scenarioTitle: sessionSummary?.scenario?.title,
            cameraName: selectedCamera,
            selectedObject,
            selectedAnnotation,
            measurements: {
                ...measurements,
                egoSpeedMps: computePoseSpeedMps(currentFrame.egoPose, previousPose)
            },
            provenance: {
                evidenceType: sessionSummary.kind === 'cloud' ? 'observed' : 'observed',
                honestyLabel: 'Observed-from-log evidence'
            },
            eventWindowSeconds: {
                start: 0,
                end: Number(sessionSummary?.scenario?.metrics?.durationSeconds || 0) || 0
            },
            egoTrajectory: sessionSummary.egoTrajectory || [],
            tags: sessionSummary?.scenario?.tags || []
        });

        return undefined;
    }, [
        currentFrame,
        currentFrameIndex,
        measurements,
        onReplayContextChange,
        selectedAnnotation,
        selectedCamera,
        selectedObject,
        sessionSummary
    ]);

    useEffect(() => {
        if (!isPlaying || !sessionSummary) {
            return undefined;
        }

        let cancelled = false;
        let timerId = 0;

        const tick = async () => {
            const startedAt = performance.now();
            const next = currentFrameIndexRef.current + 1 >= sessionSummary.totalFrames ? 0 : currentFrameIndexRef.current + 1;
            await loadFrame(next, null, {
                skipLidar: true,
                skipPrefetch: true,
                suppressLoadingState: true
            });

            if (cancelled) {
                return;
            }

            const elapsed = performance.now() - startedAt;
            timerId = window.setTimeout(tick, Math.max(0, PLAYBACK_INTERVAL_MS - elapsed));
        };

        timerId = window.setTimeout(tick, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timerId);
        };
    }, [isPlaying, loadFrame, sessionSummary]);

    useEffect(() => {
        if (isPlaying || !currentFrame?.hasLidar || currentFrame?.lidarPointCloud) {
            return undefined;
        }

        const session = sessionRef.current;
        if (!session || (session.kind !== 'parquet' && session.kind !== 'cloud')) {
            return undefined;
        }

        let cancelled = false;
        const frameIndex = currentFrame.frameIndex;

        void session.ensureFrameLidarPointCloud(frameIndex)
            .then((pointCloud) => {
                if (cancelled || sessionRef.current !== session || currentFrameIndexRef.current !== frameIndex) {
                    return;
                }

                setCurrentFrame((previous) => {
                    if (!previous || previous.frameIndex !== frameIndex) {
                        return previous;
                    }

                    return cloneFrameForState({
                        ...previous,
                        lidarPointCloud: pointCloud,
                        lidarStatus: 'ready'
                    });
                });
            })
            .catch((lidarError) => {
                console.error(lidarError);
            });

        return () => {
            cancelled = true;
        };
    }, [currentFrame, isPlaying]);

    useEffect(() => {
        if (simulationMode !== 'cloud' || cloudSegments.length > 0 || isRefreshingCloudSegments) {
            return;
        }

        const bootstrapKey = `${simulationMode}:${cloudApiBaseUrl}`;
        if (cloudBootstrapKeyRef.current === bootstrapKey) {
            return;
        }

        cloudBootstrapKeyRef.current = bootstrapKey;
        void refreshCloudSegments();
    }, [cloudApiBaseUrl, cloudSegments.length, isRefreshingCloudSegments, refreshCloudSegments, simulationMode]);

    const selectableCameraKey = selectableCameras.join(',');

    useEffect(() => {
        if (!embedded || !isOperatorPresentation || !isStructuredSession || !currentFrame) {
            return undefined;
        }

        const session = sessionRef.current;
        if (!session || (session.kind !== 'parquet' && session.kind !== 'cloud')) {
            return undefined;
        }

        const frameIndex = currentFrame.frameIndex;
        const missingCameras = selectableCameras.filter((cameraName) => !currentFrame.imageUrls?.has?.(cameraName));
        if (missingCameras.length === 0) {
            return undefined;
        }

        let cancelled = false;

        void session.ensureFrameCameraImages(frameIndex, missingCameras)
            .then((frame) => {
                if (
                    cancelled
                    || !frame
                    || sessionRef.current !== session
                    || currentFrameIndexRef.current !== frameIndex
                ) {
                    return;
                }

                setCurrentFrame((previous) => {
                    if (!previous || previous.frameIndex !== frameIndex) {
                        return previous;
                    }

                    return cloneFrameForState(frame);
                });
            })
            .catch((cameraError) => {
                console.error(cameraError);
            });

        return () => {
            cancelled = true;
        };
    }, [currentFrame, embedded, isOperatorPresentation, isStructuredSession, selectableCameraKey, selectableCameras]);

    useEffect(() => {
        return () => {
            if (sessionRef.current) {
                sessionRef.current.dispose();
            }
        };
    }, []);

    const handleFolderSelection = useCallback(async (event) => {
        const segmentMap = scanWaymoFiles(event.target.files);
        const descriptors = describeSegments(segmentMap);
        filesBySegmentRef.current = segmentMap;
        setSegments(descriptors);
        setError('');
        setLoadProgress(null);
        event.target.value = '';

        const firstUsable = descriptors.find(item => item.isUsable);
        if (!firstUsable) {
            clearActiveSession('error');
            setError(`No usable Waymo segment found. Required components: ${REQUIRED_WAYMO_COMPONENTS.join(', ')}`);
            return;
        }

        await loadSegment(firstUsable.segmentId);
    }, [clearActiveSession, loadSegment]);

    const handleTfrecordSelection = useCallback(async (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        const file = selectedFiles.find(isWaymoTfrecordFile) || selectedFiles[0] || null;
        event.target.value = '';

        if (!file) {
            setStatus('error');
            setError('No TFRecord file was selected.');
            return;
        }

        if (!isWaymoTfrecordFile(file)) {
            setStatus('error');
            setError('Select a raw Waymo shard named like `*.tfrecord` or `*.tfrecord-00000-of-*`.');
            return;
        }

        await loadTfrecord(file);
    }, [loadTfrecord]);

    const handleUpdateAnnotation = useCallback((updates) => {
        if (!isStructuredSession || !resolvedSelectedObjectKey) {
            return;
        }

        setAnnotations((previous) => ({
            ...previous,
            [resolvedSelectedObjectKey]: {
                ...(previous[resolvedSelectedObjectKey] || {}),
                ...updates,
                updatedAt: new Date().toISOString()
            }
        }));
    }, [isStructuredSession, resolvedSelectedObjectKey]);

    const handleExportAnnotations = useCallback(() => {
        if (!isStructuredSession || !sessionSummary) {
            return;
        }

        downloadJson(`${sessionSummary.segmentId}_annotations.json`, {
            segmentId: sessionSummary.segmentId,
            exportedAt: new Date().toISOString(),
            availableComponents: sessionSummary.availableComponents,
            stats: sessionSummary.stats,
            annotations
        });
    }, [annotations, isStructuredSession, sessionSummary]);

    const handleSelectCamera = useCallback(async (cameraName) => {
        setSelectedCamera(cameraName);

        const session = sessionRef.current;
        const frameIndex = currentFrameIndexRef.current;
        if (!session || (session.kind !== 'parquet' && session.kind !== 'cloud')) {
            return;
        }

        try {
            const frame = await session.ensureFrameCameraImages(frameIndex, [cameraName]);
            if (!frame || sessionRef.current !== session || currentFrameIndexRef.current !== frameIndex) {
                return;
            }

            setCurrentFrame((previous) => {
                if (!previous || previous.frameIndex !== frameIndex) {
                    return previous;
                }

                return cloneFrameForState(frame);
            });

            session.prefetchFrame(frameIndex + 1, {
                cameraNames: [cameraName],
                includeLidar: false
            });
        } catch (cameraError) {
            console.error(cameraError);
        }
    }, []);

    const handleSimulationModeChange = useCallback((nextMode) => {
        if (nextMode === simulationMode) {
            return;
        }

        clearActiveSession('idle');
        setSimulationMode(nextMode);
    }, [clearActiveSession, simulationMode]);

    const frameLabel = sessionSummary
        ? formatFrameCounter(currentFrameIndex, sessionSummary.totalFrames)
        : 'No dataset loaded';

    const activeImageUrl = currentFrame?.imageUrls?.get(selectedCamera) || null;
    const calibrations = currentFrame?.cameraCalibrations || sessionSummary?.cameraCalibrations || [];
    const loadingMessage = buildLoadingMessage(status, loadProgress);
    const simulationLabel = simulationMode === 'cloud' ? 'Cloud simulation' : 'Local simulation';
    const workspaceEyebrow = isOperatorPresentation ? 'Scenario Explorer' : 'Dataset Workspace';
    const workspaceTitle = isOperatorPresentation ? 'Waymo scenario replay' : 'Waymo Open Dataset Viewer';
    const workspaceDescription = simulationMode === 'cloud'
        ? (
            isOperatorPresentation
                ? 'Open a backend-backed Waymo scenario and inspect ego-view cameras, LiDAR, and 3D motion in one operator layout.'
                : 'Stream registered Waymo Parquet segments through the cloud API while keeping the same camera, LiDAR, and annotation workflow.'
        )
        : (
            isOperatorPresentation
                ? 'Load a local Waymo folder or raw E2E TFRecord and inspect the scenario with synchronized camera, LiDAR, and playback panels.'
                : 'Open local Waymo Parquet folders or raw end-to-end TFRecord shards directly in the browser.'
        );
    const operatorSessionView = (
        <WaymoOperatorConsole
            simulationMode={simulationMode}
            simulationLabel={simulationLabel}
            sessionSummary={sessionSummary}
            structuredSegmentOptions={structuredSegmentOptions}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={(segmentId) => {
                if (simulationMode === 'cloud') {
                    void loadCloudSegment(segmentId);
                } else {
                    void loadSegment(segmentId);
                }
            }}
            currentFrame={currentFrame}
            currentFrameIndex={currentFrameIndex}
            isPlaying={isPlaying}
            onSeek={loadFrame}
            onTogglePlay={() => setIsPlaying((previous) => !previous)}
            onStep={(delta) => loadFrame(currentFrameIndex + delta)}
            selectedCamera={selectedCamera}
            selectableCameras={selectableCameras}
            onSelectCamera={handleSelectCamera}
            activeImageUrl={activeImageUrl}
            calibrations={calibrations}
            currentCameraDetections={currentCameraDetections}
            currentLidarDetections={currentLidarDetections}
            currentObjects={currentObjects}
            lidarCalibrations={sessionSummary?.lidarCalibrations || []}
            selectedObject={selectedObject}
            selectedAnnotation={selectedAnnotation}
            selectedAnnotationKey={resolvedSelectedObjectKey}
            onSelectObject={setSelectedObjectKey}
            onUpdateAnnotation={handleUpdateAnnotation}
            onExportAnnotations={handleExportAnnotations}
            cameraLinkedLidarObjectIds={cameraLinkedLidarObjectIds}
            loadingMessage={loadingMessage}
            error={error}
            measurements={measurements}
            recentFindings={recentFindings}
            onCreateFinding={() => onCreateFindingRequest?.({ replayContext: {
                frameIndex: currentFrameIndex,
                timestampMicros: currentFrame?.timestamp,
                segmentId: sessionSummary?.segmentId,
                cameraName: selectedCamera,
                selectedObject,
                measurements,
                provenance: {
                    evidenceType: 'observed',
                    honestyLabel: 'Observed-from-log evidence'
                },
                eventWindowSeconds: {
                    start: 0,
                    end: Number(sessionSummary?.scenario?.metrics?.durationSeconds || 0) || 0
                },
                egoTrajectory: sessionSummary?.egoTrajectory || [],
                tags: sessionSummary?.scenario?.tags || []
            } })}
            onCreateBookmark={() => onCreateBookmarkRequest?.('Replay bookmark created from Waymo operator console.')}
            onPromoteScenario={() => onPromoteScenarioRequest?.()}
        />
    );

    const outerContainerClass = embedded
        ? 'h-full text-slate-100'
        : 'min-h-screen px-4 pb-4 pt-24 text-slate-100';
    const innerContainerClass = embedded
        ? 'flex h-full min-h-[960px] w-full overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950/95 shadow-[0_30px_80px_rgba(2,6,23,0.45)]'
        : 'mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1880px] overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950/95 shadow-[0_30px_80px_rgba(2,6,23,0.45)]';
    const showWorkspaceHeader = !(isOperatorPresentation && isStructuredSession && sessionSummary);

    return (
        <div className={outerContainerClass}>
            <div className={innerContainerClass}>
                <div className="flex-1 flex flex-col min-w-0">
                {showWorkspaceHeader ? (
                <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
                    <div className="px-6 py-4 flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="text-[11px] uppercase tracking-[0.32em] text-emerald-400">{workspaceEyebrow}</div>
                            <h1 className="text-2xl font-semibold">{workspaceTitle}</h1>
                            <p className="text-sm text-slate-400 mt-1">{workspaceDescription}</p>
                        </div>

                        <div className="flex max-w-full flex-col items-end gap-3">
                            <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
                                <button
                                    onClick={() => handleSimulationModeChange('local')}
                                    className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${simulationMode === 'local' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    Local simulation
                                </button>
                                <button
                                    onClick={() => handleSimulationModeChange('cloud')}
                                    className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${simulationMode === 'cloud' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    Cloud simulation
                                </button>
                            </div>

                            {simulationMode === 'local' ? (
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <button
                                        onClick={() => folderInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                                    >
                                        <FolderOpen size={16} />
                                        Open Waymo Folder
                                    </button>
                                    <button
                                        onClick={() => tfrecordInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                                    >
                                        <FileArchive size={16} />
                                        Open E2E TFRecord
                                    </button>
                                    <input
                                        ref={folderInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFolderSelection}
                                        accept=".parquet"
                                    />
                                    <input
                                        ref={tfrecordInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleTfrecordSelection}
                                    />
                                </div>
                            ) : (
                                <div className="flex max-w-full flex-col items-end gap-3">
                                    <div className="flex max-w-full flex-wrap items-center justify-end gap-3">
                                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-right">
                                            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Connection</div>
                                            <div className="mt-1 text-sm font-medium text-slate-100">
                                                {cloudApiBaseUrl ? cloudApiBaseUrl : 'Local /api proxy'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => refreshCloudSegments()}
                                            disabled={isRefreshingCloudSegments}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <RefreshCw size={16} className={isRefreshingCloudSegments ? 'animate-spin' : ''} />
                                            Refresh Scenarios
                                        </button>
                                    </div>

                                    <details className="w-full max-w-[420px] rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                                            Advanced connection settings
                                        </summary>
                                        <div className="mt-4 space-y-3">
                                            <label className="flex flex-col gap-1 text-left">
                                                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Cloud API base URL</span>
                                                <input
                                                    value={cloudApiBaseUrl}
                                                    onChange={(event) => setCloudApiBaseUrl(event.target.value)}
                                                    placeholder="Leave blank to use the local /api proxy"
                                                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                                                />
                                            </label>
                                            <div className="text-xs leading-6 text-slate-400">
                                                Local development works best with this field blank. The Vite app will proxy `/api` to the local backend automatically.
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                ) : null}

                {!sessionSummary ? (
                    <div className="flex-1 flex items-center justify-center p-10">
                        <div className="max-w-5xl w-full rounded-[28px] border border-slate-800 bg-slate-900/70 p-8">
                            <div className="flex items-center gap-3 text-emerald-400 mb-4">
                                {simulationMode === 'cloud' ? <Cloud size={22} /> : <Layers3 size={22} />}
                                <span className="text-sm font-semibold uppercase tracking-[0.28em]">{simulationLabel}</span>
                            </div>

                            {simulationMode === 'local' ? (
                                <>
                                    <h2 className="text-3xl font-semibold text-slate-100">Choose a Waymo dataset format to inspect</h2>
                                    <p className="text-slate-400 mt-3 leading-7">
                                        The local workspace supports both component folders from Waymo&apos;s Parquet exports and raw
                                        end-to-end driving TFRecord shards with embedded camera footage.
                                    </p>

                                    <div className="grid md:grid-cols-2 gap-4 mt-8">
                                        <div className="rounded-[24px] border border-emerald-500/30 bg-emerald-500/10 p-6">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-300">Parquet folder</div>
                                            <div className="mt-3 text-2xl font-semibold text-slate-100">Human annotation workspace</div>
                                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                                Open a component folder with `vehicle_pose`, `camera_image`, and optional box tables to review
                                                synchronized frames and export your own object annotations.
                                            </p>
                                            <div className="mt-5 grid gap-2 text-sm text-slate-300">
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">Required: vehicle_pose + camera_image</div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">Best experience: camera_box + camera_to_lidar_box_association</div>
                                            </div>
                                        </div>

                                        <div className="rounded-[24px] border border-blue-500/30 bg-blue-500/10 p-6">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-blue-300">Raw TFRecord</div>
                                            <div className="mt-3 text-2xl font-semibold text-slate-100">E2E driving shard viewer</div>
                                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                                Open raw files like `test_...tfrecord-00000-of-00266` from the Waymo end-to-end driving dataset
                                                and inspect embedded camera frames, intent, and ego trajectories without preprocessing.
                                            </p>
                                            <div className="mt-5 grid gap-2 text-sm text-slate-300">
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">Supports official `E2EDFrame` shards</div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">Raw E2E files do not include Parquet box tables for object tagging</div>
                                            </div>
                                        </div>
                                    </div>

                                    {segments.length > 0 && (
                                        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                            <div className="text-sm font-semibold text-slate-100 mb-3">Discovered Parquet segments</div>
                                            <div className="space-y-2">
                                                {segments.map((segment) => (
                                                    <button
                                                        key={segment.segmentId}
                                                        onClick={() => segment.isUsable && loadSegment(segment.segmentId)}
                                                        className={`w-full text-left rounded-xl border px-3 py-3 ${segment.isUsable ? 'border-slate-700 hover:bg-slate-900' : 'border-red-500/30 text-slate-500'}`}
                                                    >
                                                        <div className="font-medium">{segment.segmentId}</div>
                                                        <div className="text-xs mt-1">
                                                            {segment.isUsable
                                                                ? segment.componentNames.join(', ')
                                                                : `Missing required components: ${segment.missingRequired.join(', ')}`}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <h2 className="text-3xl font-semibold text-slate-100">Browse cloud scenarios from the ego vehicle view</h2>
                                    <p className="text-slate-400 mt-3 leading-7">
                                        Cloud simulation keeps the same review workflow, but now the app discovers available segments,
                                        summarizes what the ego vehicle is doing, and lets users open a scenario directly into the camera
                                        and LiDAR viewer.
                                    </p>

                                    <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
                                        <div className="rounded-[24px] border border-sky-500/30 bg-sky-500/10 p-6">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.24em] text-sky-300">Scenario library</div>
                                                    <div className="mt-2 text-2xl font-semibold text-slate-100">Available ego-driving scenarios</div>
                                                </div>
                                                <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-sky-200">
                                                    {cloudSegmentOptions.length} available
                                                </div>
                                            </div>
                                            {cloudSegmentOptions.length > 0 ? (
                                                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                                                    {cloudSegmentOptions.map((segment) => (
                                                        <button
                                                            key={segment.segmentId}
                                                            onClick={() => loadCloudSegment(segment.segmentId)}
                                                            className="w-full rounded-[24px] border border-slate-800 bg-slate-950/70 px-5 py-5 text-left hover:bg-slate-900"
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                                                                        <Sparkles size={12} />
                                                                        {segment?.scenario?.behaviorLabel || 'Ego scenario'}
                                                                    </div>
                                                                    <div className="mt-3 text-xl font-semibold text-slate-100">
                                                                        {getScenarioTitle(segment)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs uppercase tracking-[0.2em] text-sky-300">
                                                                    {formatCloudSourceType(segment.sourceType)}
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 text-sm leading-7 text-slate-300">
                                                                {getScenarioSummary(segment)}
                                                            </div>

                                                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                                                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                                                        <Route size={12} />
                                                                        Distance
                                                                    </div>
                                                                    <div className="mt-1 text-base font-semibold text-slate-100">{getScenarioMetricValue(segment, 'distanceMeters')}</div>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                                                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                                                        <Gauge size={12} />
                                                                        Avg speed
                                                                    </div>
                                                                    <div className="mt-1 text-base font-semibold text-slate-100">{getScenarioMetricValue(segment, 'avgSpeedMps')}</div>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Frames</div>
                                                                    <div className="mt-1 text-base font-semibold text-slate-100">{segment.totalFrames || 'N/A'}</div>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                                                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                                                        <MapPinned size={12} />
                                                                        Location
                                                                    </div>
                                                                    <div className="mt-1 text-base font-semibold text-slate-100">{segment?.stats?.location || 'Unknown'}</div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 flex flex-wrap gap-2">
                                                                {getScenarioTags(segment).slice(0, 6).map((tag) => (
                                                                    <span
                                                                        key={`${segment.segmentId}-${tag}`}
                                                                        className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                                                                <div className="truncate text-slate-500">{segment.segmentId}</div>
                                                                <div className="font-semibold text-sky-200">Open scenario</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm leading-7 text-slate-300">
                                                    No cloud scenarios were found yet. Keep the API base URL blank for local development,
                                                    make sure the backend is running, and use `Refresh Scenarios` to auto-discover the
                                                    segments under `WAYMO_LOCAL_DATA_ROOT`.
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-[24px] border border-slate-800 bg-slate-950/60 p-6">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">How this works</div>
                                            <div className="mt-3 text-2xl font-semibold text-slate-100">One-stop scenario review</div>
                                            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                                    1. The backend discovers compatible Waymo segments from your local dataset root or cloud registry.
                                                </div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                                    2. Each segment is summarized into a scenario card so users can tell what the ego vehicle is doing before opening it.
                                                </div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                                    3. Opening a scenario streams the synchronized camera view, LiDAR capture, and labeling workspace in one place.
                                                </div>
                                            </div>

                                            <details className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                                                    Manual segment registration
                                                </summary>
                                                <p className="mt-3 text-sm leading-7 text-slate-300">
                                                    This is only needed for unusual developer workflows. Most users can rely on auto-discovery.
                                                </p>
                                                <label className="mt-4 flex flex-col gap-2">
                                                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Segment id</span>
                                                    <input
                                                        value={cloudSegmentDraft}
                                                        onChange={(event) => setCloudSegmentDraft(event.target.value)}
                                                        placeholder="10017090168044687777_6380_000_6400_000"
                                                        className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                                                    />
                                                </label>
                                                <button
                                                    onClick={handleRegisterCloudLocalSegment}
                                                    disabled={isRegisteringCloudSegment}
                                                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {isRegisteringCloudSegment ? <LoaderCircle size={16} className="animate-spin" /> : <Cloud size={16} />}
                                                    Register and open manually
                                                </button>
                                            </details>
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                ) : isStructuredSession ? (
                    isOperatorPresentation ? operatorSessionView : (
                    <div className="flex-1 min-h-0 flex">
                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${simulationMode === 'cloud' ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'}`}>
                                        {simulationLabel}
                                    </div>
                                    <select
                                        value={selectedSegmentId}
                                        onChange={(event) => {
                                            if (simulationMode === 'cloud') {
                                                void loadCloudSegment(event.target.value);
                                            } else {
                                                void loadSegment(event.target.value);
                                            }
                                        }}
                                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                                    >
                                        {structuredSegmentOptions.map((segment) => (
                                            <option key={segment.segmentId} value={segment.segmentId}>
                                                {simulationMode === 'cloud' ? getCloudSegmentOptionLabel(segment) : segment.segmentId}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="text-sm text-slate-400">{frameLabel}</div>
                                    {currentFrame && (
                                        <div className="text-sm text-slate-400">
                                            {formatTimestampMicros(currentFrame.timestamp)}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                        {selectableCameras.map((cameraName) => (
                                            <button
                                                key={cameraName}
                                                onClick={() => handleSelectCamera(cameraName)}
                                                className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${selectedCamera === cameraName ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
                                            >
                                                {getCameraLabel(cameraName)}
                                            </button>
                                        ))}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 p-4 md:p-6 flex flex-col gap-4 overflow-auto">
                                {simulationMode === 'cloud' && (selectedCloudSegment?.scenario || sessionSummary?.scenario) && (
                                    <div className="shrink-0 rounded-[24px] border border-sky-500/30 bg-sky-500/10 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="max-w-3xl">
                                                <div className="text-[11px] uppercase tracking-[0.24em] text-sky-300">Scenario overview</div>
                                                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                                                    {sessionSummary?.scenario?.title || getScenarioTitle(selectedCloudSegment)}
                                                </h2>
                                                <p className="mt-3 text-sm leading-7 text-slate-300">
                                                    {sessionSummary?.scenario?.summary || getScenarioSummary(selectedCloudSegment)}
                                                </p>
                                            </div>

                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Distance</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-100">
                                                        {getScenarioMetricValue(sessionSummary, 'distanceMeters')}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Avg speed</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-100">
                                                        {getScenarioMetricValue(sessionSummary, 'avgSpeedMps')}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Duration</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-100">
                                                        {getScenarioMetricValue(sessionSummary, 'durationSeconds')}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Objects</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-100">
                                                        {getScenarioMetricValue(sessionSummary, 'totalObjectCount')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {(sessionSummary?.scenario?.tags || getScenarioTags(selectedCloudSegment)).slice(0, 8).map((tag) => (
                                                <span
                                                    key={`scenario-tag-${tag}`}
                                                    className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-300"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-sm text-slate-400 shrink-0">
                                    {loadingMessage ? (
                                        <>
                                            <LoaderCircle size={16} className="animate-spin" />
                                            {loadingMessage}
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon size={16} />
                                            Reviewing {getCameraLabel(selectedCamera)}
                                            <span className="text-slate-600">/</span>
                                            <span>{simulationLabel}</span>
                                        </>
                                    )}
                                </div>

                                <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
                                    <div className="min-w-0">
                                        <WaymoScene3DViewer
                                            trajectory={sessionSummary?.egoTrajectory}
                                            egoPose={currentFrame?.egoPose}
                                            pointCloud={currentFrame?.lidarPointCloud}
                                            lidarCalibrations={sessionSummary?.lidarCalibrations || []}
                                            detections={currentLidarDetections}
                                            cameraLinkedObjectIds={cameraLinkedLidarObjectIds}
                                            selectedAnnotationKey={resolvedSelectedObjectKey}
                                            isLoading={currentFrame?.lidarStatus === 'loading'}
                                        />
                                    </div>

                                    <div className="min-w-0 xl:h-full">
                                        <div className="h-[clamp(320px,48vh,560px)] xl:h-full shrink-0">
                                            <WaymoImageViewer
                                                imageUrl={activeImageUrl}
                                                cameraName={selectedCamera}
                                                calibrations={calibrations}
                                                detections={currentCameraDetections}
                                                selectedAnnotationKey={resolvedSelectedObjectKey}
                                                onSelectDetection={setSelectedObjectKey}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    <WaymoPlaybackControls
                                        currentFrameIndex={currentFrameIndex}
                                        totalFrames={sessionSummary.totalFrames}
                                        isPlaying={isPlaying}
                                        onSeek={loadFrame}
                                        onTogglePlay={() => setIsPlaying(previous => !previous)}
                                        onStep={(delta) => loadFrame(currentFrameIndex + delta)}
                                    />
                                </div>

                                {(currentFrame?.hasLidar || currentFrame?.lidarPointCloud?.renderedPointCount > 0 || currentLidarDetections.length > 0) && (
                                    <div className="shrink-0">
                                        <WaymoLidarViewer
                                            pointCloud={currentFrame?.lidarPointCloud}
                                            isLoading={currentFrame?.lidarStatus === 'loading'}
                                            detections={currentLidarDetections}
                                            selectedAnnotationKey={currentCameraDetections.length === 0 ? resolvedSelectedObjectKey : null}
                                            onSelectDetection={currentCameraDetections.length === 0 ? setSelectedObjectKey : undefined}
                                        />
                                    </div>
                                )}

                                {isStructuredSession && currentCameraDetections.length === 0 && currentLidarDetections.length > 0 && (
                                    <div className="shrink-0 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                                        This segment does not expose camera-space boxes for the selected view, but LiDAR track objects are still available for tagging in the sidebar.
                                    </div>
                                )}

                                {isE2ESession && !activeImageUrl && (
                                    <div className="shrink-0 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                                        The current E2E frame does not contain an image for this camera. Try another available camera view.
                                    </div>
                                )}

                                {error && (
                                    <div className="shrink-0 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>

                        <WaymoAnnotationsSidebar
                            segmentId={selectedSegmentId}
                            availableComponents={sessionSummary.availableComponents}
                            stats={sessionSummary.stats}
                            currentObjects={currentObjects}
                            objectCatalog={sessionSummary.objectCatalog}
                            selectedObject={selectedObject}
                            annotation={selectedAnnotation}
                            onSelectObject={setSelectedObjectKey}
                            onUpdateAnnotation={handleUpdateAnnotation}
                            onExportAnnotations={handleExportAnnotations}
                            frameTimestamp={currentFrame?.timestamp}
                        />
                    </div>
                    )
                ) : (
                    <WaymoE2EDashboard
                        sessionSummary={sessionSummary}
                        currentFrame={currentFrame}
                        selectedCamera={selectedCamera}
                        selectableCameras={selectableCameras}
                        onSelectCamera={setSelectedCamera}
                        currentFrameIndex={currentFrameIndex}
                        isPlaying={isPlaying}
                        onSeek={loadFrame}
                        onTogglePlay={() => setIsPlaying(previous => !previous)}
                        onStep={(delta) => loadFrame(currentFrameIndex + delta)}
                        loadingMessage={loadingMessage}
                        error={error}
                    />
                )}
                </div>
            </div>
        </div>
    );
}
