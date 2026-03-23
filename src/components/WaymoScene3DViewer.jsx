import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Camera, Radar, RotateCcw, Route } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getLidarColor } from '../utils/waymo/constants';
import { getLidarBoxCorners } from '../utils/waymo/lidar';
import { transformPointToWorld } from '../utils/waymo/pose';
import { extractLidarSensors, getVehicleViewModes, getVehicleViewPreset } from '../utils/waymo/sceneView';

const COLOR_CACHE = new Map();

function getThreeColor(colorValue) {
    if (COLOR_CACHE.has(colorValue)) {
        return COLOR_CACHE.get(colorValue);
    }

    const color = new THREE.Color(colorValue);
    COLOR_CACHE.set(colorValue, color);
    return color;
}

function disposeObject3D(object) {
    if (!object) {
        return;
    }

    object.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }

        if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
        } else if (child.material) {
            child.material.dispose();
        }

        if (child.material?.map) {
            child.material.map.dispose();
        }
    });
}

function createTextSprite(text, colorValue) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(2, 6, 23, 0.85)';
    context.beginPath();
    context.roundRect(10, 12, 236, 56, 18);
    context.fill();
    context.strokeStyle = colorValue;
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = '#e2e8f0';
    context.font = '600 26px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.6, 1, 1);
    return sprite;
}

function buildVehicleModel(lidarSensors) {
    const group = new THREE.Group();

    const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 2.16, 1.2),
        new THREE.MeshStandardMaterial({
            color: '#f8fafc',
            metalness: 0.22,
            roughness: 0.48
        })
    );
    chassis.position.set(0, 0, 0.78);
    group.add(chassis);

    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 1.7, 0.92),
        new THREE.MeshStandardMaterial({
            color: '#cbd5e1',
            metalness: 0.18,
            roughness: 0.4
        })
    );
    cabin.position.set(-0.1, 0, 1.52);
    group.add(cabin);

    const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 1.55, 0.52),
        new THREE.MeshStandardMaterial({
            color: '#60a5fa',
            transparent: true,
            opacity: 0.4,
            metalness: 0.05,
            roughness: 0.12
        })
    );
    windshield.position.set(0.72, 0, 1.55);
    windshield.rotation.y = Math.PI / 18;
    group.add(windshield);

    const wheelOffsets = [
        [1.42, 1.04, 0.38],
        [1.42, -1.04, 0.38],
        [-1.32, 1.04, 0.38],
        [-1.32, -1.04, 0.38]
    ];
    for (const [x, y, z] of wheelOffsets) {
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.36, 0.36, 0.28, 20),
            new THREE.MeshStandardMaterial({
                color: '#0f172a',
                roughness: 0.88
            })
        );
        wheel.position.set(x, y, z);
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
    }

    const bumperGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 1.8, 0.24),
        new THREE.MeshStandardMaterial({
            color: '#22d3ee',
            emissive: '#0ea5e9',
            emissiveIntensity: 0.8
        })
    );
    bumperGlow.position.set(2.28, 0, 0.75);
    group.add(bumperGlow);

    lidarSensors.forEach((sensor) => {
        const color = getThreeColor(sensor.color);
        const mount = new THREE.Mesh(
            sensor.laserName === 1
                ? new THREE.CylinderGeometry(0.18, 0.18, 0.2, 20)
                : new THREE.SphereGeometry(0.14, 18, 18),
            new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.3
            })
        );
        mount.position.set(sensor.localPosition.x, sensor.localPosition.y, sensor.localPosition.z);
        if (sensor.laserName === 1) {
            mount.rotation.x = Math.PI / 2;
        }
        group.add(mount);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.23, 18, 18),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.16
            })
        );
        glow.position.copy(mount.position);
        group.add(glow);

        const label = createTextSprite(`lidar_${sensor.label.toLowerCase().replace(/\s+/g, '_')}`, sensor.color);
        if (label) {
            label.position.set(sensor.localPosition.x, sensor.localPosition.y, sensor.localPosition.z + 0.55);
            group.add(label);
        }
    });

    return group;
}

function buildTrajectoryGeometry(trajectory) {
    if (!trajectory?.length) {
        return null;
    }

    const positions = new Float32Array(trajectory.length * 3);
    trajectory.forEach((sample, index) => {
        const destinationIndex = index * 3;
        positions[destinationIndex] = sample.x;
        positions[destinationIndex + 1] = sample.y;
        positions[destinationIndex + 2] = sample.z || 0;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

function pushSegment(positions, from, to) {
    positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
}

function buildDetectionLines(detections, egoPose, selectedAnnotationKey, cameraLinkedObjectIds) {
    if (!detections?.length || !egoPose?.transform) {
        return null;
    }

    const positions = [];
    const colors = [];

    for (const detection of detections) {
        const halfHeight = (detection.height || 0) / 2;
        const bottomZ = (detection.centerZ || 0) - halfHeight;
        const topZ = (detection.centerZ || 0) + halfHeight;
        const baseCorners = getLidarBoxCorners(detection).map((corner) => transformPointToWorld(egoPose.transform, {
            x: corner.x,
            y: corner.y,
            z: bottomZ
        }));
        const topCorners = getLidarBoxCorners(detection).map((corner) => transformPointToWorld(egoPose.transform, {
            x: corner.x,
            y: corner.y,
            z: topZ
        }));

        if (baseCorners.some((point) => !point) || topCorners.some((point) => !point)) {
            continue;
        }

        const isSelected = detection.annotationKey === selectedAnnotationKey;
        const isCameraLinked = cameraLinkedObjectIds?.has?.(detection.objectId);
        const color = getThreeColor(
            isSelected
                ? '#f8fafc'
                : isCameraLinked
                    ? '#38bdf8'
                    : detection.color
        );

        for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
            const nextIndex = (cornerIndex + 1) % 4;
            pushSegment(positions, baseCorners[cornerIndex], baseCorners[nextIndex]);
            pushSegment(positions, topCorners[cornerIndex], topCorners[nextIndex]);
            pushSegment(positions, baseCorners[cornerIndex], topCorners[cornerIndex]);

            for (let repeat = 0; repeat < 6; repeat += 1) {
                colors.push(color.r, color.g, color.b);
            }
        }
    }

    if (positions.length === 0) {
        return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

function buildPointCloudGroups(pointCloud, egoPose) {
    if (!pointCloud?.points?.length || !egoPose?.transform) {
        return [];
    }

    const groups = new Map();
    const rawPoints = pointCloud.points;
    const pointStride = pointCloud.pointStride || 4;
    const pointCount = typeof rawPoints[0] === 'number'
        ? Math.floor(rawPoints.length / pointStride)
        : rawPoints.length;

    if (pointCount === 0) {
        return [];
    }

    if (typeof rawPoints[0] === 'number') {
        for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
            const sourceIndex = pointIndex * pointStride;
            const laserName = Number(rawPoints[sourceIndex + 3] || 0);
            const worldPoint = transformPointToWorld(egoPose.transform, {
                x: rawPoints[sourceIndex],
                y: rawPoints[sourceIndex + 1],
                z: rawPoints[sourceIndex + 2]
            });

            if (!worldPoint || !laserName) {
                continue;
            }

            const group = groups.get(laserName) || [];
            group.push(worldPoint.x, worldPoint.y, worldPoint.z);
            groups.set(laserName, group);
        }
    } else {
        rawPoints.forEach((point) => {
            const laserName = Number(point.laserName || point.sensorId || 0);
            const worldPoint = transformPointToWorld(egoPose.transform, point);
            if (!worldPoint || !laserName) {
                return;
            }

            const group = groups.get(laserName) || [];
            group.push(worldPoint.x, worldPoint.y, worldPoint.z);
            groups.set(laserName, group);
        });
    }

    return Array.from(groups.entries()).map(([laserName, positions]) => {
        return {
            laserName,
            color: getLidarColor(laserName),
            positions,
            count: positions.length / 3
        };
    });
}

function toVector3(point, fallback = new THREE.Vector3()) {
    if (!point) {
        return fallback.clone();
    }

    return new THREE.Vector3(point.x || 0, point.y || 0, point.z || 0);
}

function formatCount(value) {
    return Number(value || 0).toLocaleString();
}

function ViewModeButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 ${active ? 'border-sky-400 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'}`}
        >
            {label}
        </button>
    );
}

export const WaymoScene3DViewer = memo(function WaymoScene3DViewer({
    trajectory,
    egoPose,
    pointCloud,
    detections,
    cameraLinkedObjectIds,
    selectedAnnotationKey,
    isLoading,
    lidarCalibrations = [],
    embedded = false,
    panelHeightClass = 'h-[420px] xl:h-[520px]'
}) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const egoPoseRef = useRef(egoPose);
    const animationFrameRef = useRef(0);
    const trajectoryObjectRef = useRef(null);
    const egoObjectRef = useRef(null);
    const detectionObjectRef = useRef(null);
    const pointCloudGroupRef = useRef(null);
    const viewStateRef = useRef({
        mode: 'chase',
        resetRequested: true
    });
    const [cameraMode, setCameraMode] = useState('chase');
    const [hiddenSensors, setHiddenSensors] = useState(() => new Set());
    const roadLevel = 0;

    useEffect(() => {
        egoPoseRef.current = egoPose;
    }, [egoPose]);

    const sensorStats = useMemo(() => pointCloud?.sensorStats || [], [pointCloud]);
    const lidarSensors = useMemo(() => extractLidarSensors(lidarCalibrations), [lidarCalibrations]);
    const groupedPointClouds = useMemo(() => buildPointCloudGroups(pointCloud, egoPose), [egoPose, pointCloud]);
    const detectionGeometry = useMemo(() => {
        return buildDetectionLines(detections, egoPose, selectedAnnotationKey, cameraLinkedObjectIds);
    }, [cameraLinkedObjectIds, detections, egoPose, selectedAnnotationKey]);
    const trajectoryGeometry = useMemo(() => buildTrajectoryGeometry(trajectory), [trajectory]);
    const viewModes = useMemo(() => getVehicleViewModes(), []);

    const availableSensorIds = useMemo(() => {
        const ids = new Set();
        sensorStats.forEach((sensor) => ids.add(sensor.laserName));
        lidarSensors.forEach((sensor) => ids.add(sensor.laserName));
        groupedPointClouds.forEach((sensor) => ids.add(sensor.laserName));
        return Array.from(ids).sort((left, right) => left - right);
    }, [groupedPointClouds, lidarSensors, sensorStats]);
    const visibleSensors = useMemo(() => {
        if (availableSensorIds.length === 0) {
            return new Set();
        }

        return new Set(availableSensorIds.filter((sensorId) => !hiddenSensors.has(sensorId)));
    }, [availableSensorIds, hiddenSensors]);
    const sensorStatsById = useMemo(() => {
        return new Map(sensorStats.map((sensor) => [sensor.laserName, sensor]));
    }, [sensorStats]);
    const sensorChips = useMemo(() => {
        return availableSensorIds.map((sensorId) => {
            const calibration = lidarSensors.find((sensor) => sensor.laserName === sensorId);
            const stat = sensorStatsById.get(sensorId);
            const pointCloudGroup = groupedPointClouds.find((sensor) => sensor.laserName === sensorId);

            return {
                laserName: sensorId,
                label: stat?.label || calibration?.label || `LiDAR ${sensorId}`,
                color: stat?.color || calibration?.color || getLidarColor(sensorId),
                count: stat?.count || pointCloudGroup?.count || 0
            };
        });
    }, [availableSensorIds, groupedPointClouds, lidarSensors, sensorStatsById]);

    useEffect(() => {
        viewStateRef.current.mode = cameraMode;
        viewStateRef.current.resetRequested = true;
    }, [cameraMode]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#020617');
        scene.fog = new THREE.Fog('#020617', 50, 260);
        scene.up.set(0, 0, 1);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
        camera.up.set(0, 0, 1);
        camera.position.set(-16, -12, 9);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current = renderer;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minPolarAngle = 0.08;
        controls.maxPolarAngle = Math.PI / 2 - 0.08;
        controls.minDistance = 3;
        controls.maxDistance = 90;
        controls.screenSpacePanning = false;
        controls.target.set(0, 0, 1.5);
        controlsRef.current = controls;

        const groundGrid = new THREE.GridHelper(260, 26, '#334155', '#172033');
        groundGrid.rotation.x = Math.PI / 2;
        groundGrid.position.z = roadLevel + 0.02;
        scene.add(groundGrid);

        const roadPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(260, 260),
            new THREE.MeshStandardMaterial({
                color: '#08111f',
                roughness: 0.95,
                metalness: 0.02
            })
        );
        roadPlane.position.z = roadLevel - 0.02;
        scene.add(roadPlane);

        const ambientLight = new THREE.AmbientLight('#dbeafe', 1.1);
        const directionalLight = new THREE.DirectionalLight('#ffffff', 1.25);
        directionalLight.position.set(18, -12, 28);
        const rimLight = new THREE.DirectionalLight('#60a5fa', 0.8);
        rimLight.position.set(-16, 14, 10);
        scene.add(ambientLight, directionalLight, rimLight);

        const resize = () => {
            const width = container.clientWidth || 1;
            const height = container.clientHeight || 1;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        };

        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        const render = () => {
            animationFrameRef.current = window.requestAnimationFrame(render);

            const activeEgoPose = egoPoseRef.current;
            if (activeEgoPose && controlsRef.current && cameraRef.current) {
                const controlsInstance = controlsRef.current;
                const cameraInstance = cameraRef.current;
                const mode = viewStateRef.current.mode;
                const preset = getVehicleViewPreset(mode);
                const focusPoint = transformPointToWorld(activeEgoPose.transform, preset.targetOffset)
                    || { x: activeEgoPose.x, y: activeEgoPose.y, z: activeEgoPose.z + 1.6 };
                const focusVector = toVector3(focusPoint);

                if (mode === 'orbit') {
                    if (viewStateRef.current.resetRequested) {
                        const defaultCameraPoint = transformPointToWorld(activeEgoPose.transform, preset.cameraOffset)
                            || { x: activeEgoPose.x - 12, y: activeEgoPose.y - 10, z: activeEgoPose.z + 8 };
                        cameraInstance.position.copy(toVector3(defaultCameraPoint));
                        controlsInstance.target.copy(focusVector);
                        viewStateRef.current.resetRequested = false;
                    } else {
                        const offset = cameraInstance.position.clone().sub(controlsInstance.target);
                        const desiredTarget = focusVector;
                        const desiredPosition = desiredTarget.clone().add(offset);
                        controlsInstance.target.lerp(desiredTarget, preset.lerpAlpha);
                        cameraInstance.position.lerp(desiredPosition, preset.lerpAlpha);
                    }
                    controlsInstance.enabled = true;
                } else {
                    const desiredCameraPoint = transformPointToWorld(activeEgoPose.transform, preset.cameraOffset)
                        || { x: activeEgoPose.x - 12, y: activeEgoPose.y, z: activeEgoPose.z + 5 };
                    cameraInstance.position.lerp(toVector3(desiredCameraPoint), preset.lerpAlpha);
                    controlsInstance.target.lerp(focusVector, preset.lerpAlpha);
                    controlsInstance.enabled = false;
                    viewStateRef.current.resetRequested = false;
                }
            }

            controls.update();
            controls.target.z = Math.max(controls.target.z, roadLevel + 0.6);
            camera.position.z = Math.max(camera.position.z, roadLevel + 0.8);
            renderer.render(scene, camera);
        };

        render();

        return () => {
            window.cancelAnimationFrame(animationFrameRef.current);
            observer.disconnect();
            controls.dispose();
            renderer.dispose();
            scene.clear();
            container.removeChild(renderer.domElement);
        };
    }, []);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) {
            return;
        }

        if (trajectoryObjectRef.current) {
            scene.remove(trajectoryObjectRef.current);
            disposeObject3D(trajectoryObjectRef.current);
            trajectoryObjectRef.current = null;
        }

        if (!trajectoryGeometry) {
            return;
        }

        const material = new THREE.LineBasicMaterial({ color: '#38bdf8' });
        const line = new THREE.Line(trajectoryGeometry, material);
        scene.add(line);
        trajectoryObjectRef.current = line;
    }, [trajectoryGeometry]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) {
            return;
        }

        if (egoObjectRef.current) {
            scene.remove(egoObjectRef.current);
            disposeObject3D(egoObjectRef.current);
            egoObjectRef.current = null;
        }

        if (!egoPose) {
            return;
        }

        const vehicleModel = buildVehicleModel(lidarSensors);
        vehicleModel.position.set(egoPose.x, egoPose.y, egoPose.z || 0);
        vehicleModel.rotation.z = egoPose.yaw || 0;
        scene.add(vehicleModel);
        egoObjectRef.current = vehicleModel;
    }, [egoPose, lidarSensors]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) {
            return;
        }

        if (pointCloudGroupRef.current) {
            scene.remove(pointCloudGroupRef.current);
            disposeObject3D(pointCloudGroupRef.current);
            pointCloudGroupRef.current = null;
        }

        const visibleGroupEntries = groupedPointClouds.filter((group) => visibleSensors.has(group.laserName));
        if (visibleGroupEntries.length === 0) {
            return;
        }

        const group = new THREE.Group();
        visibleGroupEntries.forEach((entry) => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(entry.positions, 3));
            geometry.computeBoundingSphere();
            const points = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    color: entry.color,
                    size: 0.16,
                    transparent: true,
                    opacity: 0.92,
                    sizeAttenuation: true
                })
            );
            points.name = `lidar-${entry.laserName}`;
            group.add(points);
        });
        scene.add(group);
        pointCloudGroupRef.current = group;
    }, [groupedPointClouds, visibleSensors]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) {
            return;
        }

        if (detectionObjectRef.current) {
            scene.remove(detectionObjectRef.current);
            disposeObject3D(detectionObjectRef.current);
            detectionObjectRef.current = null;
        }

        if (!detectionGeometry) {
            return;
        }

        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95
        });
        const lines = new THREE.LineSegments(detectionGeometry, material);
        scene.add(lines);
        detectionObjectRef.current = lines;
    }, [detectionGeometry]);

    const pointCount = groupedPointClouds
        .filter((group) => visibleSensors.has(group.laserName))
        .reduce((sum, group) => sum + group.count, 0);
    const activePreset = getVehicleViewPreset(cameraMode);
    const isHoldingPreviousPointCloud = isLoading && Number(pointCloud?.renderedPointCount || 0) > 0;

    const content = (
        <div className={`relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/96 ${panelHeightClass}`}>
            <div ref={containerRef} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.06),transparent_38%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/85 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/90 to-transparent" />

            <div className="absolute left-3 top-3 right-3 flex flex-wrap items-start justify-between gap-3 md:left-4 md:top-4 md:right-4">
                <div className="pointer-events-none rounded-2xl border border-slate-700/80 bg-slate-950/88 px-3 py-2.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] md:px-4 md:py-3">
                    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-sky-300">
                        <Camera size={12} />
                        World scene
                    </div>
                    <div className="mt-1.5 text-base font-semibold text-slate-100 md:text-lg">Road-locked ego replay</div>
                    <div className="mt-1 text-xs text-slate-400 md:text-sm">{activePreset.description}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <div className="pointer-events-none rounded-2xl border border-slate-700/80 bg-slate-950/88 px-3 py-2.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] md:px-4 md:py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Visible points</div>
                        <div className="mt-1.5 text-lg font-semibold text-slate-100 md:text-xl">{formatCount(pointCount)}</div>
                    </div>
                    <div className="pointer-events-none rounded-2xl border border-slate-700/80 bg-slate-950/88 px-3 py-2.5 shadow-[0_18px_40px_rgba(2,6,23,0.35)] md:px-4 md:py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">3D detections</div>
                        <div className="mt-1.5 text-lg font-semibold text-slate-100 md:text-xl">{formatCount(detections?.length)}</div>
                    </div>
                </div>
            </div>

            <div className="absolute left-3 top-[92px] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 md:left-4 md:top-[104px] md:max-w-[calc(100%-2rem)]">
                {viewModes.map((mode) => (
                    <ViewModeButton
                        key={mode.id}
                        active={cameraMode === mode.id}
                        label={mode.label}
                        onClick={() => setCameraMode(mode.id)}
                    />
                ))}
                <button
                    type="button"
                    onClick={() => {
                        viewStateRef.current.resetRequested = true;
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-300 shadow-[0_12px_30px_rgba(2,6,23,0.3)] hover:border-slate-500"
                >
                    <RotateCcw size={12} />
                    Reset view
                </button>
            </div>

            <div className="absolute left-3 bottom-3 right-3 flex flex-wrap items-end justify-between gap-3 md:left-4 md:bottom-4 md:right-4">
                <div className="flex max-w-3xl flex-wrap gap-2">
                    <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1.5 text-xs text-slate-300 shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
                        <Route size={12} />
                        Trajectory path
                    </span>
                    <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1.5 text-xs text-slate-300 shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
                        <Radar size={12} />
                        Per-sensor LiDAR
                    </span>
                    <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1.5 text-xs text-slate-300 shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
                        <Box size={12} />
                        Live 3D boxes
                    </span>
                    {isHoldingPreviousPointCloud ? (
                        <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
                            Advancing LiDAR...
                        </span>
                    ) : null}
                </div>

                <div className="flex max-w-2xl flex-wrap justify-end gap-2">
                    {sensorChips.length > 0 ? sensorChips.map((sensor) => {
                        const isVisible = visibleSensors.has(sensor.laserName);
                        return (
                            <button
                                key={sensor.laserName}
                                type="button"
                                onClick={() => {
                                    setHiddenSensors((previous) => {
                                        const next = new Set(previous);
                                        if (visibleSensors.has(sensor.laserName)) {
                                            next.add(sensor.laserName);
                                        } else {
                                            next.delete(sensor.laserName);
                                        }
                                        return next;
                                    });
                                }}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-[0_12px_30px_rgba(2,6,23,0.28)] ${
                                    isVisible
                                        ? 'border-slate-600 bg-slate-950/90 text-slate-100'
                                        : 'border-slate-800 bg-slate-950/60 text-slate-500'
                                }`}
                            >
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sensor.color }} />
                                <span>{sensor.label}</span>
                                <span className="text-slate-400">{formatCount(sensor.count)}</span>
                            </button>
                        );
                    }) : (
                        <div className="pointer-events-none rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs text-slate-400 shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
                            Waiting for LiDAR sensor statistics...
                        </div>
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-slate-700 bg-slate-950/92 px-4 py-2 text-sm text-slate-300 shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
                        Transforming world scene...
                    </div>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return <div className="space-y-4">{content}</div>;
    }

    return (
        <section className="rounded-[28px] border border-slate-700 bg-slate-950/90 p-4 md:p-5">
            {content}
        </section>
    );
});
