import { analyzeTrafficLightColor } from './trafficLightLogic';

function center(bbox) {
    return [bbox[0] + bbox[2] / 2, bbox[1] + bbox[3] / 2];
}

function bboxDistance(a, b) {
    const [ax, ay] = center(a);
    const [bx, by] = center(b);
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function bboxOverlap(a, b) {
    const [ax, ay, aw, ah] = a;
    const [bx, by, bw, bh] = b;
    return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
}

function avgDim(bbox) {
    return (bbox[2] + bbox[3]) / 2;
}

const SEVERITY = {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
};

const VEHICLE_CLASSES = ['Vehicle', 'Truck', 'Bus', 'Van', 'Motorcycle', 'Emergency-Vehicle'];
const VRU_CLASSES = ['Pedestrian', 'Cyclist', 'Scooter', 'Animal'];
const ROAD_USER_CLASSES = [...VEHICLE_CLASSES, 'Pedestrian', 'Cyclist'];

let lastTrafficLightState = null;
let lastTrafficLightTime = -10;
let lastHighDensityTime = -10;
let recentNewTrackIds = new Set();

export function resetADASDetector() {
    lastTrafficLightState = null;
    lastTrafficLightTime = -10;
    lastHighDensityTime = -10;
    recentNewTrackIds = new Set();
}

export function detectADASEvents({ tracks, rawPredictions, timestamp, video, frameWidth, frameHeight }) {
    const events = [];
    const proximityThreshold = Math.min(frameWidth, frameHeight) * 0.12;

    const vehicles = tracks.filter(t => VEHICLE_CLASSES.includes(t.class));
    const vulnerable = tracks.filter(t => VRU_CLASSES.includes(t.class));

    for (let i = 0; i < vehicles.length; i++) {
        for (let j = i + 1; j < vehicles.length; j++) {
            const dist = bboxDistance(vehicles[i].bbox, vehicles[j].bbox);
            const avgSize = (avgDim(vehicles[i].bbox) + avgDim(vehicles[j].bbox)) / 2;
            if (dist < avgSize * 1.3) {
                events.push({
                    id: Date.now() + Math.random(),
                    type: 'NEAR_MISS',
                    time: timestamp,
                    note: `Close following: ${vehicles[i].class} #${vehicles[i].id} / ${vehicles[j].class} #${vehicles[j].id} (${Math.round(dist)}px)`,
                    severity: SEVERITY.WARNING,
                    adasType: 'PROXIMITY_VEHICLE'
                });
            }
        }
    }

    for (const veh of vehicles) {
        for (const vru of vulnerable) {
            const dist = bboxDistance(veh.bbox, vru.bbox);
            if (bboxOverlap(veh.bbox, vru.bbox)) {
                events.push({
                    id: Date.now() + Math.random(),
                    type: 'PEDESTRIAN',
                    time: timestamp,
                    note: `${vru.class} #${vru.id} overlapping ${veh.class} #${veh.id}`,
                    severity: SEVERITY.CRITICAL,
                    adasType: 'VRU_COLLISION_RISK'
                });
            } else if (dist < proximityThreshold) {
                events.push({
                    id: Date.now() + Math.random(),
                    type: 'PEDESTRIAN',
                    time: timestamp,
                    note: `${vru.class} #${vru.id} near ${veh.class} #${veh.id} (${Math.round(dist)}px)`,
                    severity: SEVERITY.WARNING,
                    adasType: 'VRU_PROXIMITY'
                });
            }
        }
    }

    const trafficLightPreds = rawPredictions.filter(p => p.class === 'traffic light' && p.score > 0.4);
    if (video && trafficLightPreds.length > 0) {
        for (const tl of trafficLightPreds) {
            const result = analyzeTrafficLightColor(video, tl.bbox);
            if (result.color !== 'unknown' && result.confidence > 0.02) {
                if (result.color !== lastTrafficLightState && (timestamp - lastTrafficLightTime) > 2) {
                    events.push({
                        id: Date.now() + Math.random(),
                        type: result.color === 'red' ? 'SYSTEM_EVENT' : 'DETECTION',
                        time: timestamp,
                        note: `Traffic light: ${result.color} (${Math.round(result.confidence * 100)}%)`,
                        severity: result.color === 'red' ? SEVERITY.WARNING : SEVERITY.INFO,
                        adasType: 'TRAFFIC_LIGHT_CHANGE',
                        trafficLightColor: result.color
                    });
                    lastTrafficLightState = result.color;
                    lastTrafficLightTime = timestamp;
                }
            }
        }
    }

    const roadUsers = tracks.filter(t => ROAD_USER_CLASSES.includes(t.class));
    if (roadUsers.length >= 6 && (timestamp - lastHighDensityTime) > 5) {
        events.push({
            id: Date.now() + Math.random(),
            type: 'SYSTEM_EVENT',
            time: timestamp,
            note: `High traffic density: ${roadUsers.length} road users in frame`,
            severity: SEVERITY.INFO,
            adasType: 'HIGH_DENSITY'
        });
        lastHighDensityTime = timestamp;
    }

    for (const track of tracks) {
        if (track.missedFrames === 0 && !recentNewTrackIds.has(track.id) && track.score > 0.7) {
            recentNewTrackIds.add(track.id);
            events.push({
                id: Date.now() + Math.random(),
                type: 'DETECTION',
                time: timestamp,
                note: `${track.class} #${track.id} detected (${Math.round(track.score * 100)}%)`,
                severity: SEVERITY.INFO,
                adasType: 'NEW_OBJECT'
            });
        }
    }

    return events;
}

export function getTrafficLightStates(rawPredictions, video) {
    if (!video) return [];
    return rawPredictions
        .filter(p => p.class === 'traffic light' && p.score > 0.4)
        .map(tl => {
            const result = analyzeTrafficLightColor(video, tl.bbox);
            return {
                bbox: tl.bbox,
                color: result.color,
                hex: result.hex || '#888888',
                confidence: result.confidence,
                score: tl.score
            };
        });
}
