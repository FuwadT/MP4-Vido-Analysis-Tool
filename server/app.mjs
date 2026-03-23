import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { Storage } from '@google-cloud/storage';
import { loadServerConfig } from './config.mjs';
import { createSegmentRegistry } from './segmentRegistry.mjs';
import { createWaymoCloudSession } from './waymoCloudSession.mjs';
import { discoverLocalSegmentIds } from './localSegmentDiscovery.mjs';
import { createStudioStore } from './studioStore.mjs';
import { sanitizeOptionalStudioId, sanitizeStudioId } from './studioIds.mjs';
import {
    BUILD_PROFILES,
    COMPATIBILITY_MATRIX,
    DATASET_ASSETS,
    DATA_ADAPTERS,
    HONESTY_GUIDELINES,
    LOG_SESSIONS,
    MODEL_PROFILES,
    SENSOR_PROFILES,
    SENSOR_RIGS,
    STUDIO_NAV_ITEMS,
    VALIDATION_METRICS,
    VALIDATION_REQUIREMENTS
} from '../src/studio/data/seedData.js';
import { buildCompareSummary } from '../src/studio/domain/compareRuns.js';
import { searchStudioResources } from '../src/studio/domain/commandPalette.js';
import { createScenarioSeedFromReplayContext, createVariantFromScenarioMutation, duplicateScenarioDefinition } from '../src/studio/domain/scenarioAuthoring.js';
import { createFinding, createValidationSuite, RUN_STATUSES } from '../src/studio/domain/models.js';
import { createQueuedRun, finalizeRunArtifacts, transitionValidationRun } from '../src/studio/domain/runState.js';
import { buildValidationSummary, createValidationHtmlReport, createValidationJsonReport } from '../src/studio/domain/validation.js';

const KNOWN_COMPONENTS = [
    'vehicle_pose',
    'camera_calibration',
    'camera_image',
    'camera_box',
    'camera_to_lidar_box_association',
    'lidar_calibration',
    'lidar_box',
    'lidar',
    'lidar_camera_projection',
    'stats'
];
const DEFAULT_CLOUD_LIDAR_MAX_POINTS = 6000;
const CORS_OPTIONS = {
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};

function resolveConfig(overrides = {}) {
    return {
        ...loadServerConfig(),
        ...overrides
    };
}

function asyncHandler(handler) {
    return function wrappedHandler(request, response, next) {
        Promise.resolve(handler(request, response, next)).catch(next);
    };
}

function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sendJson(response, payload, statusCode = 200) {
    response.status(statusCode);
    response.type('application/json');
    response.send(JSON.stringify(payload, (_key, value) => {
        if (typeof value === 'bigint') {
            return Number(value);
        }

        if (value instanceof Map) {
            return Object.fromEntries(value.entries());
        }

        if (value instanceof Set) {
            return Array.from(value.values());
        }

        return value;
    }));
}

function upsertById(items, nextItem) {
    const nextItems = Array.isArray(items) ? [...items] : [];
    const existingIndex = nextItems.findIndex((item) => item.id === nextItem.id);

    if (existingIndex >= 0) {
        nextItems[existingIndex] = nextItem;
        return nextItems;
    }

    return [nextItem, ...nextItems];
}

function buildStudioActions() {
    return [
        {
            id: 'action-open-data-explorer',
            label: 'Open Data Explorer',
            description: 'Switch to synchronized replay and inspection.',
            tags: ['navigation', 'replay'],
            action: { kind: 'navigate', nav: 'data-explorer' }
        },
        {
            id: 'action-open-scenario-studio',
            label: 'Open Scenario Studio',
            description: 'Refine actors, routes, triggers, and variants.',
            tags: ['navigation', 'scenario'],
            action: { kind: 'navigate', nav: 'scenario-studio' }
        },
        {
            id: 'action-open-validation',
            label: 'Open Validation',
            description: 'Inspect requirement traceability and export reports.',
            tags: ['navigation', 'validation'],
            action: { kind: 'navigate', nav: 'validation' }
        }
    ];
}

function buildStudioBootstrap(snapshot) {
    return {
        registries: {
            navItems: STUDIO_NAV_ITEMS,
            datasetAssets: DATASET_ASSETS,
            logSessions: LOG_SESSIONS,
            buildProfiles: BUILD_PROFILES,
            modelProfiles: MODEL_PROFILES,
            sensorProfiles: SENSOR_PROFILES,
            sensorRigs: SENSOR_RIGS,
            validationRequirements: VALIDATION_REQUIREMENTS,
            validationMetrics: VALIDATION_METRICS,
            compatibilityMatrix: COMPATIBILITY_MATRIX,
            honestyGuidelines: HONESTY_GUIDELINES,
            dataAdapters: DATA_ADAPTERS
        },
        studio: snapshot
    };
}

function createRunRuntime(studioStore) {
    const timers = new Map();

    function clearRunTimers(runId) {
        const active = timers.get(runId) || [];
        active.forEach((timerId) => clearTimeout(timerId));
        timers.delete(runId);
    }

    function scheduleRunLifecycle(run, options = {}) {
        clearRunTimers(run.id);

        const preparingTimer = setTimeout(async () => {
            await studioStore.update((data) => {
                data.runs = data.runs.map((item) => (
                    item.id === run.id ? transitionValidationRun(item, RUN_STATUSES.PREPARING) : item
                ));
                return data;
            });
        }, options.preparingDelayMs ?? 150);

        const runningTimer = setTimeout(async () => {
            await studioStore.update((data) => {
                data.runs = data.runs.map((item) => (
                    item.id === run.id ? transitionValidationRun(item, RUN_STATUSES.RUNNING) : item
                ));
                return data;
            });
        }, options.runningDelayMs ?? 450);

        const completeTimer = setTimeout(async () => {
            await studioStore.update((data) => {
                data.runs = data.runs.map((item) => {
                    if (item.id !== run.id) {
                        return item;
                    }

                    return finalizeRunArtifacts(item, {
                        variantLabel: options.variantLabel
                    });
                });
                return data;
            });
        }, options.completeDelayMs ?? 950);

        timers.set(run.id, [preparingTimer, runningTimer, completeTimer]);
    }

    return {
        scheduleRunLifecycle,
        cancelRun(runId) {
            clearRunTimers(runId);
        },
        dispose() {
            for (const runId of timers.keys()) {
                clearRunTimers(runId);
            }
        }
    };
}

function createSessionManager(config, { storageClient, registry }) {
    const sessionCache = new Map();
    const cacheOrder = [];

    function touch(segmentId) {
        const existing = cacheOrder.indexOf(segmentId);
        if (existing >= 0) {
            cacheOrder.splice(existing, 1);
        }

        cacheOrder.push(segmentId);
    }

    async function trim() {
        while (cacheOrder.length > config.openSessionLimit) {
            const evictedSegmentId = cacheOrder.shift();
            if (!evictedSegmentId) {
                break;
            }

            const session = sessionCache.get(evictedSegmentId);
            sessionCache.delete(evictedSegmentId);
            if (session) {
                await session.dispose();
            }
        }
    }

    return {
        async getSession(segmentId) {
            const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
            const cached = sessionCache.get(safeSegmentId);
            if (cached) {
                touch(safeSegmentId);
                return cached;
            }

            const manifest = await registry.getManifest(safeSegmentId);
            if (!manifest) {
                return null;
            }

            const session = await createWaymoCloudSession(safeSegmentId, manifest.sources, {
                storageClient,
                frameCacheLimit: config.frameCacheLimit
            });

            sessionCache.set(safeSegmentId, session);
            touch(safeSegmentId);
            await trim();
            return session;
        },
        invalidate(segmentId) {
            const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
            const session = sessionCache.get(safeSegmentId);
            if (session) {
                void session.dispose();
            }

            sessionCache.delete(safeSegmentId);
            const existing = cacheOrder.indexOf(safeSegmentId);
            if (existing >= 0) {
                cacheOrder.splice(existing, 1);
            }
        },
        async disposeAll() {
            await Promise.all(Array.from(sessionCache.values()).map((session) => session.dispose()));
            sessionCache.clear();
            cacheOrder.length = 0;
        }
    };
}

async function buildLocalSources(localDataRoot, segmentId) {
    const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');

    if (!localDataRoot) {
        throw new Error('WAYMO_LOCAL_DATA_ROOT is not configured.');
    }

    const sources = {};

    for (const component of KNOWN_COMPONENTS) {
        const filePath = path.join(localDataRoot, component, `${safeSegmentId}.parquet`);
        try {
            await fs.access(filePath);
            sources[component] = filePath;
        } catch {
            // Ignore missing components. The session validator will use the files that exist.
        }
    }

    if (!sources.vehicle_pose || !sources.camera_image) {
        throw new Error(`Local segment ${safeSegmentId} is missing required components under ${localDataRoot}.`);
    }

    return sources;
}

async function ensureDiscoveredLocalManifests(config, registry) {
    if (!config.localDataRoot) {
        return await registry.listManifests();
    }

    const existingManifests = await registry.listManifests();
    const manifestsBySegmentId = new Map(existingManifests.map((manifest) => [manifest.segmentId, manifest]));
    const discoveredSegmentIds = await discoverLocalSegmentIds(config.localDataRoot);

    for (const rawSegmentId of discoveredSegmentIds) {
        const segmentId = sanitizeStudioId(rawSegmentId, 'segmentId');

        if (manifestsBySegmentId.has(segmentId)) {
            continue;
        }

        const timestamp = new Date().toISOString();
        const manifest = {
            version: 1,
            segmentId,
            sourceType: 'local',
            sources: await buildLocalSources(config.localDataRoot, segmentId),
            createdAt: timestamp,
            updatedAt: timestamp
        };

        await registry.saveManifest(manifest);
        manifestsBySegmentId.set(segmentId, manifest);
    }

    return Array.from(manifestsBySegmentId.values()).sort((left, right) => left.segmentId.localeCompare(right.segmentId));
}

function buildBucketSources(bucketName, prefix, segmentId, components) {
    const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
    const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
    const componentNames = Array.from(new Set((components || KNOWN_COMPONENTS))).sort();
    const sources = {};

    for (const component of componentNames) {
        const objectName = [normalizedPrefix, component, `${safeSegmentId}.parquet`]
            .filter(Boolean)
            .join('/');
        sources[component] = `gs://${bucketName}/${objectName}`;
    }

    return sources;
}

export async function createStudioApp(options = {}) {
    const config = resolveConfig(options.configOverrides);
    const storageClient = options.storageClient || new Storage();
    const registry = options.registry || createSegmentRegistry(config, { storageClient });
    const sessionManager = createSessionManager(config, { storageClient, registry });
    const studioStore = options.studioStore || createStudioStore(config);
    const runRuntime = createRunRuntime(studioStore);
    const app = express();

    if (config.enableCors) {
        app.use(cors(CORS_OPTIONS));
    }

    app.use(express.json({ limit: '4mb' }));

    app.get('/api/health', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, {
            ok: true,
            service: 'waymo-cloud-runner',
            storageBucket: config.storageBucket || null,
            studio: {
                scenarioCount: snapshot.scenarios.length,
                runCount: snapshot.runs.length,
                findingCount: snapshot.findings.length
            }
        });
    }));

    app.get('/api/studio/bootstrap', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, buildStudioBootstrap(snapshot));
    }));

    app.get('/api/studio/search', asyncHandler(async (request, response) => {
        const snapshot = await studioStore.getSnapshot();
        const query = String(request.query.q || '');
        const results = searchStudioResources({
            datasetAssets: DATASET_ASSETS,
            scenarios: snapshot.scenarios,
            runs: snapshot.runs,
            findings: snapshot.findings,
            layouts: snapshot.savedLayouts,
            actions: buildStudioActions()
        }, query);

        sendJson(response, { results });
    }));

    app.get('/api/studio/scenarios', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { scenarios: snapshot.scenarios });
    }));

    app.post('/api/studio/scenarios', asyncHandler(async (request, response) => {
        if (!isObject(request.body)) {
            response.status(400).json({ error: 'Scenario payload is required.' });
            return;
        }

        const scenario = request.body;
        if (!scenario.id || !scenario.name) {
            response.status(400).json({ error: 'Scenario `id` and `name` are required.' });
            return;
        }

        sanitizeStudioId(scenario.id, 'scenarioId');
        const snapshot = await studioStore.update((data) => {
            data.scenarios = upsertById(data.scenarios, {
                ...scenario,
                updatedAt: new Date().toISOString()
            });
            return data;
        });

        sendJson(response, { scenario: snapshot.scenarios.find((item) => item.id === scenario.id) }, 201);
    }));

    app.patch('/api/studio/scenarios/:scenarioId', asyncHandler(async (request, response) => {
        const scenarioId = sanitizeStudioId(request.params.scenarioId, 'scenarioId');
        const patch = request.body || {};
        const snapshot = await studioStore.update((data) => {
            data.scenarios = data.scenarios.map((scenario) => (
                scenario.id === scenarioId
                    ? { ...scenario, ...patch, updatedAt: new Date().toISOString() }
                    : scenario
            ));
            return data;
        });

        sendJson(response, { scenario: snapshot.scenarios.find((item) => item.id === scenarioId) });
    }));

    app.post('/api/studio/scenarios/:scenarioId/duplicate', asyncHandler(async (request, response) => {
        const scenarioId = sanitizeStudioId(request.params.scenarioId, 'scenarioId');
        let duplicatedId = '';

        const snapshot = await studioStore.update((data) => {
            const source = data.scenarios.find((item) => item.id === scenarioId);
            if (!source) {
                throw new Error(`Unknown scenario ${scenarioId}.`);
            }

            const duplicated = duplicateScenarioDefinition(source);
            duplicatedId = duplicated.id;
            data.scenarios = upsertById(data.scenarios, duplicated);
            return data;
        });

        sendJson(response, { scenario: snapshot.scenarios.find((item) => item.id === duplicatedId) }, 201);
    }));

    app.post('/api/studio/scenarios/:scenarioId/variants', asyncHandler(async (request, response) => {
        const scenarioId = sanitizeStudioId(request.params.scenarioId, 'scenarioId');
        const mutationPlan = request.body || {};
        let nextVariant = null;

        await studioStore.update((data) => {
            data.scenarios = data.scenarios.map((scenario) => {
                if (scenario.id !== scenarioId) {
                    return scenario;
                }

                nextVariant = createVariantFromScenarioMutation(scenario, mutationPlan);
                return {
                    ...scenario,
                    variants: [...(scenario.variants || []), nextVariant],
                    updatedAt: new Date().toISOString()
                };
            });
            return data;
        });

        sendJson(response, { variant: nextVariant }, 201);
    }));

    app.post('/api/studio/scenarios/extract', asyncHandler(async (request, response) => {
        const scenario = createScenarioSeedFromReplayContext(request.body || {});
        const snapshot = await studioStore.update((data) => {
            data.scenarios = upsertById(data.scenarios, scenario);
            return data;
        });

        sendJson(response, { scenario: snapshot.scenarios.find((item) => item.id === scenario.id) }, 201);
    }));

    app.get('/api/studio/findings', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { findings: snapshot.findings });
    }));

    app.post('/api/studio/findings', asyncHandler(async (request, response) => {
        const finding = createFinding({
            ...request.body,
            provenance: request.body?.provenance
        });
        const snapshot = await studioStore.update((data) => {
            data.findings = upsertById(data.findings, finding);
            return data;
        });

        sendJson(response, { finding: snapshot.findings.find((item) => item.id === finding.id) }, 201);
    }));

    app.patch('/api/studio/findings/:findingId', asyncHandler(async (request, response) => {
        const findingId = sanitizeStudioId(request.params.findingId, 'findingId');
        const patch = request.body || {};
        const snapshot = await studioStore.update((data) => {
            data.findings = data.findings.map((finding) => (
                finding.id === findingId
                    ? { ...finding, ...patch, updatedAt: new Date().toISOString() }
                    : finding
            ));
            return data;
        });

        sendJson(response, { finding: snapshot.findings.find((item) => item.id === findingId) });
    }));

    app.get('/api/studio/bookmarks', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { bookmarks: snapshot.bookmarks });
    }));

    app.post('/api/studio/bookmarks', asyncHandler(async (request, response) => {
        const bookmark = {
            ...request.body,
            id: request.body?.id || `bookmark-${Date.now()}`,
            createdAt: new Date().toISOString()
        };

        sanitizeStudioId(bookmark.id, 'bookmarkId');
        const snapshot = await studioStore.update((data) => {
            data.bookmarks = upsertById(data.bookmarks, bookmark);
            return data;
        });

        sendJson(response, { bookmark: snapshot.bookmarks.find((item) => item.id === bookmark.id) }, 201);
    }));

    app.get('/api/studio/runs', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { runs: snapshot.runs });
    }));

    app.post('/api/studio/runs', asyncHandler(async (request, response) => {
        const payload = request.body || {};
        const run = createQueuedRun({
            id: payload.id || `run-${Date.now()}`,
            label: payload.label || `${payload.buildAlias || 'stable'} / ${payload.modelAlias || 'default'} / ${payload.runType || 'exploratory'}`,
            runType: payload.runType || 'exploratory',
            scenarioId: sanitizeOptionalStudioId(payload.scenarioId, 'scenarioId'),
            scenarioVariantId: sanitizeOptionalStudioId(payload.scenarioVariantId, 'scenarioVariantId'),
            buildAlias: payload.buildAlias || 'stable',
            modelAlias: payload.modelAlias || 'default',
            oddSlices: Array.isArray(payload.oddSlices) ? payload.oddSlices : [],
            provenance: payload.provenance
        });

        const snapshot = await studioStore.update((data) => {
            data.runs = upsertById(data.runs, run);
            return data;
        });

        runRuntime.scheduleRunLifecycle(run, {
            variantLabel: payload.variantLabel
        });
        sendJson(response, { run: snapshot.runs.find((item) => item.id === run.id) }, 201);
    }));

    app.patch('/api/studio/runs/:runId', asyncHandler(async (request, response) => {
        const runId = sanitizeStudioId(request.params.runId, 'runId');
        const patch = request.body || {};
        const snapshot = await studioStore.update((data) => {
            data.runs = data.runs.map((run) => {
                if (run.id !== runId) {
                    return run;
                }

                if (patch.status && patch.status !== run.status) {
                    return transitionValidationRun({ ...run, ...patch }, patch.status, {
                        transitionedAt: new Date().toISOString()
                    });
                }

                return {
                    ...run,
                    ...patch
                };
            });
            return data;
        });

        if (patch.status === RUN_STATUSES.CANCELED) {
            runRuntime.cancelRun(runId);
        }

        sendJson(response, { run: snapshot.runs.find((item) => item.id === runId) });
    }));

    app.get('/api/studio/compare', asyncHandler(async (request, response) => {
        const leftRunId = sanitizeOptionalStudioId(request.query.leftRunId, 'leftRunId');
        const rightRunId = sanitizeOptionalStudioId(request.query.rightRunId, 'rightRunId');
        const snapshot = await studioStore.getSnapshot();
        const leftRun = snapshot.runs.find((item) => item.id === leftRunId);
        const rightRun = snapshot.runs.find((item) => item.id === rightRunId);
        sendJson(response, { summary: buildCompareSummary(leftRun, rightRun) });
    }));

    app.get('/api/studio/layouts', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { layouts: snapshot.savedLayouts });
    }));

    app.post('/api/studio/layouts', asyncHandler(async (request, response) => {
        const payload = request.body || {};
        const layout = {
            ...payload,
            id: payload.id || `layout-${Date.now()}`,
            updatedAt: new Date().toISOString()
        };

        sanitizeStudioId(layout.id, 'layoutId');
        const snapshot = await studioStore.update((data) => {
            data.savedLayouts = upsertById(data.savedLayouts, layout);
            return data;
        });

        sendJson(response, { layout: snapshot.savedLayouts.find((item) => item.id === layout.id) }, 201);
    }));

    app.patch('/api/studio/layouts/:layoutId', asyncHandler(async (request, response) => {
        const layoutId = sanitizeStudioId(request.params.layoutId, 'layoutId');
        const patch = request.body || {};
        const snapshot = await studioStore.update((data) => {
            data.savedLayouts = data.savedLayouts.map((layout) => (
                layout.id === layoutId
                    ? { ...layout, ...patch, updatedAt: new Date().toISOString() }
                    : layout
            ));
            return data;
        });

        sendJson(response, { layout: snapshot.savedLayouts.find((item) => item.id === layoutId) });
    }));

    app.get('/api/studio/validation/suites', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, { suites: snapshot.validationSuites });
    }));

    app.post('/api/studio/validation/suites', asyncHandler(async (request, response) => {
        const suite = createValidationSuite(request.body || {});
        const snapshot = await studioStore.update((data) => {
            data.validationSuites = upsertById(data.validationSuites, suite);
            return data;
        });

        sendJson(response, { suite: snapshot.validationSuites.find((item) => item.id === suite.id) }, 201);
    }));

    app.patch('/api/studio/validation/suites/:suiteId', asyncHandler(async (request, response) => {
        const suiteId = sanitizeStudioId(request.params.suiteId, 'suiteId');
        const patch = request.body || {};
        const snapshot = await studioStore.update((data) => {
            data.validationSuites = data.validationSuites.map((suite) => (
                suite.id === suiteId
                    ? { ...suite, ...patch, updatedAt: new Date().toISOString() }
                    : suite
            ));
            return data;
        });

        sendJson(response, { suite: snapshot.validationSuites.find((item) => item.id === suiteId) });
    }));

    app.get('/api/studio/validation/summary', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, {
            summary: buildValidationSummary({
                runs: snapshot.runs,
                requirements: VALIDATION_REQUIREMENTS,
                metrics: VALIDATION_METRICS,
                findings: snapshot.findings
            })
        });
    }));

    app.get('/api/studio/validation/report.json', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        sendJson(response, createValidationJsonReport({
            runs: snapshot.runs,
            requirements: VALIDATION_REQUIREMENTS,
            metrics: VALIDATION_METRICS,
            findings: snapshot.findings
        }));
    }));

    app.get('/api/studio/validation/report.html', asyncHandler(async (_request, response) => {
        const snapshot = await studioStore.getSnapshot();
        response.type('text/html');
        response.send(createValidationHtmlReport({
            runs: snapshot.runs,
            requirements: VALIDATION_REQUIREMENTS,
            metrics: VALIDATION_METRICS,
            findings: snapshot.findings
        }));
    }));

    app.get('/api/cloud/segments', asyncHandler(async (_request, response) => {
    const manifests = await ensureDiscoveredLocalManifests(config, registry);
    const segments = [];

    for (const manifest of manifests) {
        let scenario = null;
        let stats = null;
        let totalFrames = null;
        let availableComponents = Object.keys(manifest.sources || {}).sort();
        let availableCameras = [];

        try {
            const session = await sessionManager.getSession(manifest.segmentId);
            if (session) {
                const summary = session.getSummary();
                scenario = summary.scenario || null;
                stats = summary.stats || null;
                totalFrames = summary.totalFrames || 0;
                availableComponents = summary.availableComponents || availableComponents;
                availableCameras = summary.availableCameras || [];
            }
        } catch (error) {
            console.error(`Failed to enrich segment ${manifest.segmentId}`, error);
        }

        segments.push({
            segmentId: manifest.segmentId,
            sourceType: manifest.sourceType,
            createdAt: manifest.createdAt,
            updatedAt: manifest.updatedAt,
            totalFrames,
            availableComponents,
            availableCameras,
            stats,
            scenario
        });
    }

    sendJson(response, { segments });
}));

    app.post('/api/cloud/segments/register', asyncHandler(async (request, response) => {
        const { segmentId, sources, sourceType = 'manual' } = request.body || {};

    if (!segmentId || !isObject(sources)) {
        response.status(400).json({ error: '`segmentId` and a `sources` object are required.' });
        return;
    }

        const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
        const timestamp = new Date().toISOString();
        const existing = await registry.getManifest(safeSegmentId);
        const manifest = {
            version: 1,
            segmentId: safeSegmentId,
            sourceType,
            sources,
            createdAt: existing?.createdAt || timestamp,
            updatedAt: timestamp
        };

        await registry.saveManifest(manifest);
        sessionManager.invalidate(safeSegmentId);
        sendJson(response, { manifest }, 201);
    }));

app.post('/api/cloud/segments/register-bucket', asyncHandler(async (request, response) => {
    const { segmentId, bucketName, prefix = '', components = KNOWN_COMPONENTS } = request.body || {};

    if (!segmentId || !bucketName) {
        response.status(400).json({ error: '`segmentId` and `bucketName` are required.' });
        return;
    }

        const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
        const sources = buildBucketSources(bucketName, prefix, safeSegmentId, components);
        const timestamp = new Date().toISOString();
        const existing = await registry.getManifest(safeSegmentId);
        const manifest = {
            version: 1,
            segmentId: safeSegmentId,
            sourceType: 'bucket',
            sources,
            createdAt: existing?.createdAt || timestamp,
            updatedAt: timestamp
        };

        await registry.saveManifest(manifest);
        sessionManager.invalidate(safeSegmentId);
        sendJson(response, { manifest }, 201);
    }));

app.post('/api/cloud/segments/register-local', asyncHandler(async (request, response) => {
    const { segmentId } = request.body || {};

    if (!segmentId) {
        response.status(400).json({ error: '`segmentId` is required.' });
        return;
    }

        const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
        const sources = await buildLocalSources(config.localDataRoot, safeSegmentId);
        const timestamp = new Date().toISOString();
        const existing = await registry.getManifest(safeSegmentId);
        const manifest = {
            version: 1,
            segmentId: safeSegmentId,
            sourceType: 'local',
            sources,
            createdAt: existing?.createdAt || timestamp,
            updatedAt: timestamp
        };

        await registry.saveManifest(manifest);
        sessionManager.invalidate(safeSegmentId);
        sendJson(response, { manifest }, 201);
    }));

app.post('/api/cloud/uploads/signed-urls', asyncHandler(async (request, response) => {
    const { segmentId, components, expiresInMinutes = 30 } = request.body || {};

    if (!segmentId || !Array.isArray(components) || components.length === 0) {
        response.status(400).json({ error: '`segmentId` and a non-empty `components` array are required.' });
        return;
    }

    const safeSegmentId = sanitizeStudioId(segmentId, 'segmentId');
    const uploadPlan = await registry.createSignedUploadTargets(safeSegmentId, components, { expiresInMinutes });
    const timestamp = new Date().toISOString();
    const existing = await registry.getManifest(safeSegmentId);
    const manifest = {
        version: 1,
        segmentId: safeSegmentId,
        sourceType: 'signed-upload',
        sources: registry.createUploadedSourceMap(safeSegmentId, components),
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp
    };

    await registry.saveManifest(manifest);
    sessionManager.invalidate(safeSegmentId);
    sendJson(response, {
        manifest,
        uploadPlan
    }, 201);
}));

app.get('/api/cloud/segments/:segmentId', asyncHandler(async (request, response) => {
    const session = await sessionManager.getSession(request.params.segmentId);

    if (!session) {
        response.status(404).json({ error: `Unknown segment ${request.params.segmentId}.` });
        return;
    }

    sendJson(response, session.getSummary());
}));

app.get('/api/cloud/segments/:segmentId/frames/:frameIndex', asyncHandler(async (request, response) => {
    const session = await sessionManager.getSession(request.params.segmentId);

    if (!session) {
        response.status(404).json({ error: `Unknown segment ${request.params.segmentId}.` });
        return;
    }

    const frameIndex = Number(request.params.frameIndex);
    const rawCameraNames = request.query.camera;
    const cameraNames = Array.isArray(rawCameraNames)
        ? rawCameraNames
        : rawCameraNames != null
            ? [rawCameraNames]
            : [];
    const maxPoints = Number(request.query.maxPoints || DEFAULT_CLOUD_LIDAR_MAX_POINTS);
    const includeLidar = request.query.includeLidar === 'true';
    const frame = await session.getFrame(frameIndex, {
        cameraNames,
        includeLidar,
        maxPoints
    });

    if (!frame) {
        response.status(404).json({ error: `Frame ${request.params.frameIndex} is out of range.` });
        return;
    }

    sendJson(response, frame);
}));

app.get('/api/cloud/segments/:segmentId/frames/:frameIndex/cameras/:cameraName', asyncHandler(async (request, response) => {
    const session = await sessionManager.getSession(request.params.segmentId);

    if (!session) {
        response.status(404).json({ error: `Unknown segment ${request.params.segmentId}.` });
        return;
    }

    const imageBuffer = await session.getCameraImage(
        Number(request.params.frameIndex),
        Number(request.params.cameraName)
    );

    if (!imageBuffer) {
        response.status(404).json({ error: 'Camera image not found for the requested frame.' });
        return;
    }

    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('Cache-Control', 'private, max-age=60');
    response.send(imageBuffer);
}));

app.get('/api/cloud/segments/:segmentId/frames/:frameIndex/lidar', asyncHandler(async (request, response) => {
    const session = await sessionManager.getSession(request.params.segmentId);

    if (!session) {
        response.status(404).json({ error: `Unknown segment ${request.params.segmentId}.` });
        return;
    }

    const pointCloud = await session.getLidarPointCloud(
        Number(request.params.frameIndex),
        Number(request.query.maxPoints || DEFAULT_CLOUD_LIDAR_MAX_POINTS)
    );

    if (!pointCloud) {
        response.status(404).json({ error: 'LiDAR point cloud not found for the requested frame.' });
        return;
    }

    sendJson(response, pointCloud);
}));

    if (options.serveStatic !== false && await fs.stat(config.distDir).then(() => true).catch(() => false)) {
        app.use(express.static(config.distDir));
        app.get(/^\/(?!api\/).*/, (_request, response) => {
            response.sendFile(path.join(config.distDir, 'index.html'));
        });
    }

    app.use((error, _request, response, _next) => {
        console.error(error);
        sendJson(response, {
            error: error instanceof Error ? error.message : 'Unexpected server error.'
        }, 500);
    });

    return {
        app,
        config,
        studioStore,
        registry,
        sessionManager,
        async closeResources() {
            runRuntime.dispose();
            await sessionManager.disposeAll();
        }
    };
}

export async function startStudioServer(options = {}) {
    const created = await createStudioApp(options);

    const server = await new Promise((resolve) => {
        const startedServer = created.app.listen(created.config.port, () => {
            console.log(`Waymo cloud service listening on port ${created.config.port}`);
            resolve(startedServer);
        });
    });

    return {
        ...created,
        server,
        port: server.address().port,
        async close() {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
            await created.closeResources();
        }
    };
}
