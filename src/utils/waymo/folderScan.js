import { KNOWN_COMPONENTS, REQUIRED_WAYMO_COMPONENTS } from './constants';

function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/');
}

function getRelativePath(file) {
    return normalizePath(file.webkitRelativePath || file.relativePath || file.path || file.name);
}

export function scanWaymoFiles(fileList) {
    const segments = new Map();
    const files = Array.from(fileList || []);

    for (const file of files) {
        const relativePath = getRelativePath(file);
        const parts = relativePath.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1] || file.name;

        if (!fileName || !fileName.endsWith('.parquet')) {
            continue;
        }

        const component = parts.find(part => KNOWN_COMPONENTS.has(part));
        if (!component) {
            continue;
        }

        const segmentId = fileName.replace(/\.parquet$/i, '');
        if (!segments.has(segmentId)) {
            segments.set(segmentId, new Map());
        }

        segments.get(segmentId).set(component, file);
    }

    return segments;
}

export function describeSegments(segmentMap) {
    return Array.from(segmentMap.entries())
        .map(([segmentId, components]) => {
            const componentNames = Array.from(components.keys()).sort();
            const missingRequired = REQUIRED_WAYMO_COMPONENTS.filter(name => !components.has(name));

            return {
                segmentId,
                components,
                componentNames,
                missingRequired,
                isUsable: missingRequired.length === 0
            };
        })
        .sort((a, b) => a.segmentId.localeCompare(b.segmentId));
}
