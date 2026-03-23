const DEFAULT_VIEWPORT = Object.freeze({
    minForward: -24,
    maxForward: 68,
    minLateral: -30,
    maxLateral: 30
});

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSample(sample) {
    return {
        x: toNumber(sample?.x),
        y: toNumber(sample?.y),
        z: toNumber(sample?.z),
        yaw: Number.isFinite(Number(sample?.yaw)) ? Number(sample.yaw) : null
    };
}

export function findNearestTrajectoryIndex(trajectory = [], egoPose) {
    if (!egoPose || !Array.isArray(trajectory) || trajectory.length === 0) {
        return -1;
    }

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    trajectory.forEach((sample, index) => {
        const normalized = normalizeSample(sample);
        const distance = Math.hypot(normalized.x - toNumber(egoPose.x), normalized.y - toNumber(egoPose.y));
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });

    return bestIndex;
}

export function estimateEgoHeading(trajectory = [], egoPose) {
    if (Number.isFinite(Number(egoPose?.yaw))) {
        return Number(egoPose.yaw);
    }

    const nearestIndex = findNearestTrajectoryIndex(trajectory, egoPose);
    if (nearestIndex < 0) {
        return 0;
    }

    for (let offset = 1; offset < trajectory.length; offset += 1) {
        const previous = trajectory[nearestIndex - offset];
        const next = trajectory[nearestIndex + offset];
        const from = previous ? normalizeSample(previous) : normalizeSample(trajectory[nearestIndex]);
        const to = next ? normalizeSample(next) : normalizeSample(trajectory[nearestIndex]);
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (Math.hypot(dx, dy) > 0.5) {
            return Math.atan2(dy, dx);
        }
    }

    return 0;
}

export function worldToEgoFrame(point, egoPose, heading = estimateEgoHeading([], egoPose)) {
    if (!point || !egoPose) {
        return null;
    }

    const dx = toNumber(point.x) - toNumber(egoPose.x);
    const dy = toNumber(point.y) - toNumber(egoPose.y);
    const cosHeading = Math.cos(heading);
    const sinHeading = Math.sin(heading);

    return {
        forward: (dx * cosHeading) + (dy * sinHeading),
        lateral: (-dx * sinHeading) + (dy * cosHeading),
        z: toNumber(point.z)
    };
}

function normalizeLocalTrajectory(trajectory = [], egoPose, viewport, heading) {
    return trajectory
        .map((sample, index) => {
            const normalized = normalizeSample(sample);
            const local = worldToEgoFrame(normalized, egoPose, heading);
            return {
                index,
                ...normalized,
                ...local
            };
        })
        .filter((sample) => (
            sample.forward >= (viewport.minForward - 12)
            && sample.forward <= (viewport.maxForward + 12)
            && sample.lateral >= (viewport.minLateral - 16)
            && sample.lateral <= (viewport.maxLateral + 16)
        ));
}

function isSpatialObject(object) {
    if (!object) {
        return false;
    }

    if (Number.isFinite(Number(object.centerZ))) {
        return true;
    }

    const centerX = Number(object.centerX);
    const centerY = Number(object.centerY);
    return Number.isFinite(centerX)
        && Number.isFinite(centerY)
        && Math.abs(centerX) <= 120
        && Math.abs(centerY) <= 120;
}

function normalizeSpatialObjects(currentObjects = []) {
    return currentObjects
        .filter(isSpatialObject)
        .map((object) => ({
            id: object.annotationKey || object.objectId || `${object.label}-${Math.random()}`,
            label: object.label || 'Object',
            color: object.color || '#94a3b8',
            forward: toNumber(object.centerX),
            lateral: toNumber(object.centerY),
            observed: true
        }))
        .filter((object) => (
            object.forward >= (DEFAULT_VIEWPORT.minForward - 20)
            && object.forward <= (DEFAULT_VIEWPORT.maxForward + 20)
            && object.lateral >= (DEFAULT_VIEWPORT.minLateral - 20)
            && object.lateral <= (DEFAULT_VIEWPORT.maxLateral + 20)
        ));
}

function inferIntersection(scenario, localTrajectory) {
    const summaryText = [
        scenario?.title,
        scenario?.summary,
        scenario?.behaviorLabel,
        ...(scenario?.tags || [])
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const routeSpread = localTrajectory.reduce((maxSpread, sample) => {
        return Math.max(maxSpread, Math.abs(sample.lateral));
    }, 0);
    const hasTurnText = /\b(turn|intersection|urban|stop)\b/.test(summaryText);

    return hasTurnText || routeSpread > 8;
}

function buildDashedLineSegments(forwardStart, forwardEnd, lateral, dashLength = 5, gap = 4) {
    const segments = [];
    for (let cursor = forwardStart; cursor < forwardEnd; cursor += dashLength + gap) {
        segments.push({
            from: { forward: cursor, lateral },
            to: { forward: Math.min(cursor + dashLength, forwardEnd), lateral }
        });
    }
    return segments;
}

export function buildInferredRoadContext({ trajectory = [], egoPose, scenario = {}, currentObjects = [], selectedObject = null }) {
    const viewport = { ...DEFAULT_VIEWPORT };
    const heading = estimateEgoHeading(trajectory, egoPose);
    const localTrajectory = normalizeLocalTrajectory(trajectory, egoPose, viewport, heading);
    const intersection = inferIntersection(scenario, localTrajectory);
    const roadHalfWidth = intersection ? 9.5 : 8.2;
    const curbOffset = roadHalfWidth + 2.7;
    const intersectionCenter = intersection ? 16 : null;
    const spatialObjects = normalizeSpatialObjects(currentObjects);
    const selectedSpatialObject = isSpatialObject(selectedObject)
        ? {
            forward: toNumber(selectedObject.centerX),
            lateral: toNumber(selectedObject.centerY)
        }
        : null;

    const laneSegments = [
        ...buildDashedLineSegments(viewport.minForward, viewport.maxForward, 0),
        ...buildDashedLineSegments(viewport.minForward, viewport.maxForward, -3.6),
        ...buildDashedLineSegments(viewport.minForward, viewport.maxForward, 3.6)
    ];

    const signals = intersection
        ? [
            { id: 'signal-left', forward: intersectionCenter + 2, lateral: -curbOffset + 0.8, label: 'Signal', observed: false },
            { id: 'signal-right', forward: intersectionCenter + 2, lateral: curbOffset - 0.8, label: 'Signal', observed: false }
        ]
        : [];

    const signs = intersection
        ? [
            { id: 'stop-sign', forward: intersectionCenter - 3, lateral: -curbOffset + 0.6, label: 'Stop', observed: false }
        ]
        : [];

    return {
        viewport,
        heading,
        roadHalfWidth,
        curbOffset,
        localTrajectory,
        laneSegments,
        mainRoadEdges: [
            { from: { forward: viewport.minForward, lateral: -roadHalfWidth }, to: { forward: viewport.maxForward, lateral: -roadHalfWidth } },
            { from: { forward: viewport.minForward, lateral: roadHalfWidth }, to: { forward: viewport.maxForward, lateral: roadHalfWidth } }
        ],
        curbLines: [
            { from: { forward: viewport.minForward, lateral: -curbOffset }, to: { forward: viewport.maxForward, lateral: -curbOffset } },
            { from: { forward: viewport.minForward, lateral: curbOffset }, to: { forward: viewport.maxForward, lateral: curbOffset } }
        ],
        crossStreet: intersection
            ? {
                centerForward: intersectionCenter,
                halfDepth: 8,
                halfWidth: 24
            }
            : null,
        crosswalks: intersection
            ? [
                { id: 'crosswalk-near', forward: intersectionCenter - 5.5, width: roadHalfWidth * 2 + 2 },
                { id: 'crosswalk-far', forward: intersectionCenter + 5.5, width: roadHalfWidth * 2 + 2 }
            ]
            : [],
        stopLine: intersection
            ? { forward: intersectionCenter - 7 }
            : null,
        signals,
        signs,
        spatialObjects,
        selectedSpatialObject,
        honestyLabel: 'Inferred road context',
        honestySummary: 'Curbs, lane markings, intersection geometry, and roadside controls are inferred from ego motion and scene context because this replay does not expose a georeferenced HD map.'
    };
}
