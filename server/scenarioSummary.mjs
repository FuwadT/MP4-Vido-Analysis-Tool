function clampHeadingDelta(delta) {
    let next = delta;

    while (next > Math.PI) {
        next -= Math.PI * 2;
    }

    while (next < -Math.PI) {
        next += Math.PI * 2;
    }

    return next;
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatDistance(distanceMeters) {
    return `${Math.round(distanceMeters)} m`;
}

function formatDuration(durationSeconds) {
    return `${Math.round(durationSeconds)} s`;
}

function formatSpeedMph(speedMps) {
    return `${Math.round(speedMps * 2.23694)} mph`;
}

function sumObjectCounts(objectCounts) {
    return Object.values(objectCounts || {}).reduce((sum, value) => {
        return sum + Number(value || 0);
    }, 0);
}

function extractPoseSamples(poseRows) {
    return (poseRows || [])
        .map((row) => {
            const transform = row?.['[VehiclePoseComponent].world_from_vehicle.transform'];
            const timestamp = Number(row?.['key.frame_timestamp_micros']);

            if (!Array.isArray(transform) || transform.length < 12 || !Number.isFinite(timestamp)) {
                return null;
            }

            return {
                timestamp,
                x: Number(transform[3]),
                y: Number(transform[7]),
                z: Number(transform[11])
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.timestamp - right.timestamp);
}

function buildMotionProfile(poseRows) {
    const samples = extractPoseSamples(poseRows);
    if (samples.length < 2) {
        return {
            durationSeconds: 0,
            distanceMeters: 0,
            avgSpeedMps: 0,
            maxSpeedMps: 0,
            signedHeadingChange: 0,
            absoluteHeadingChange: 0,
            stopMoments: 0
        };
    }

    let distanceMeters = 0;
    let maxSpeedMps = 0;
    let signedHeadingChange = 0;
    let absoluteHeadingChange = 0;
    let stopMoments = 0;
    let lastHeading = null;

    for (let index = 1; index < samples.length; index += 1) {
        const previous = samples[index - 1];
        const current = samples[index];
        const dt = (current.timestamp - previous.timestamp) / 1e6;
        if (!(dt > 0)) {
            continue;
        }

        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        const segmentDistance = Math.hypot(dx, dy);
        const speedMps = segmentDistance / dt;

        distanceMeters += segmentDistance;
        maxSpeedMps = Math.max(maxSpeedMps, speedMps);

        if (speedMps < 0.75) {
            stopMoments += 1;
        }

        if (segmentDistance > 0.05) {
            const heading = Math.atan2(dy, dx);
            if (lastHeading != null) {
                const headingDelta = clampHeadingDelta(heading - lastHeading);
                signedHeadingChange += headingDelta;
                absoluteHeadingChange += Math.abs(headingDelta);
            }
            lastHeading = heading;
        }
    }

    const durationSeconds = Math.max((samples[samples.length - 1].timestamp - samples[0].timestamp) / 1e6, 0);
    const avgSpeedMps = durationSeconds > 0 ? distanceMeters / durationSeconds : 0;

    return {
        durationSeconds: round(durationSeconds),
        distanceMeters: round(distanceMeters),
        avgSpeedMps: round(avgSpeedMps),
        maxSpeedMps: round(maxSpeedMps),
        signedHeadingChange: round(signedHeadingChange, 3),
        absoluteHeadingChange: round(absoluteHeadingChange, 3),
        stopMoments
    };
}

function inferBehaviorLabel(motionProfile) {
    const {
        distanceMeters,
        avgSpeedMps,
        maxSpeedMps,
        signedHeadingChange,
        absoluteHeadingChange,
        stopMoments
    } = motionProfile;

    if (distanceMeters < 8 || avgSpeedMps < 0.8) {
        return 'Standstill or creep';
    }

    if (stopMoments >= 8 && avgSpeedMps < 5) {
        return 'Stop-and-go traffic';
    }

    if (absoluteHeadingChange > 1.15) {
        return signedHeadingChange >= 0 ? 'Extended left turn' : 'Extended right turn';
    }

    if (absoluteHeadingChange > 0.45) {
        return signedHeadingChange >= 0 ? 'Curving left drive' : 'Curving right drive';
    }

    if (maxSpeedMps > 12) {
        return 'Cruising segment';
    }

    if (avgSpeedMps < 5) {
        return 'Low-speed urban maneuver';
    }

    return 'Forward driving segment';
}

function inferScenarioTitle(behaviorLabel, stats) {
    const location = String(stats?.location || '').toLowerCase();

    if (behaviorLabel === 'Standstill or creep') {
        return 'Stationary or slow-roll scenario';
    }

    if (behaviorLabel === 'Stop-and-go traffic') {
        return 'Stop-and-go scenario';
    }

    if (behaviorLabel.includes('left turn')) {
        return 'Left-turn scenario';
    }

    if (behaviorLabel.includes('right turn')) {
        return 'Right-turn scenario';
    }

    if (location.includes('san francisco')) {
        return 'Urban San Francisco drive';
    }

    if (behaviorLabel === 'Cruising segment') {
        return 'Cruising scenario';
    }

    if (behaviorLabel === 'Low-speed urban maneuver') {
        return 'Low-speed urban scenario';
    }

    return 'Forward driving scenario';
}

function buildScenarioSummaryText({
    behaviorLabel,
    motionProfile,
    stats,
    hasLidar,
    hasCamera,
    totalObjectCount
}) {
    const parts = [
        `${behaviorLabel} over ${formatDistance(motionProfile.distanceMeters)} in ${formatDuration(motionProfile.durationSeconds)}.`,
        `Average speed ${formatSpeedMph(motionProfile.avgSpeedMps)} with a peak near ${formatSpeedMph(motionProfile.maxSpeedMps)}.`
    ];

    if (stats?.location && stats.location !== 'Unknown') {
        parts.push(`Location: ${stats.location}.`);
    }

    if (stats?.timeOfDay && stats.timeOfDay !== 'Unknown') {
        parts.push(`Time of day: ${stats.timeOfDay}.`);
    }

    if (stats?.weather && stats.weather !== 'Unknown') {
        parts.push(`Weather: ${stats.weather}.`);
    }

    if (totalObjectCount > 0) {
        parts.push(`Segment-level lidar object count: ${totalObjectCount}.`);
    }

    parts.push(hasCamera && hasLidar
        ? 'Cameras and LiDAR are both available.'
        : hasCamera
            ? 'Camera footage is available.'
            : 'LiDAR-only scenario.');

    return parts.join(' ');
}

function buildScenarioTags({ behaviorLabel, stats, hasLidar, hasCamera, totalObjectCount }) {
    const tags = [
        behaviorLabel,
        stats?.location,
        stats?.timeOfDay,
        stats?.weather,
        hasCamera ? 'camera' : null,
        hasLidar ? 'lidar' : null,
        totalObjectCount > 0 ? `${totalObjectCount} objects` : null
    ];

    return Array.from(new Set(tags.filter(Boolean)));
}

export function buildScenarioSummary({
    poseRows,
    stats,
    totalFrames,
    availableCameras,
    availableComponents
}) {
    const motionProfile = buildMotionProfile(poseRows);
    const behaviorLabel = inferBehaviorLabel(motionProfile);
    const title = inferScenarioTitle(behaviorLabel, stats);
    const hasLidar = (availableComponents || []).includes('lidar');
    const hasCamera = (availableComponents || []).includes('camera_image');
    const totalObjectCount = sumObjectCounts(stats?.objectCounts);

    return {
        title,
        behaviorLabel,
        summary: buildScenarioSummaryText({
            behaviorLabel,
            motionProfile,
            stats,
            hasLidar,
            hasCamera,
            totalObjectCount
        }),
        tags: buildScenarioTags({
            behaviorLabel,
            stats,
            hasLidar,
            hasCamera,
            totalObjectCount
        }),
        metrics: {
            totalFrames,
            distanceMeters: motionProfile.distanceMeters,
            durationSeconds: motionProfile.durationSeconds,
            avgSpeedMps: motionProfile.avgSpeedMps,
            maxSpeedMps: motionProfile.maxSpeedMps,
            totalObjectCount
        }
    };
}
