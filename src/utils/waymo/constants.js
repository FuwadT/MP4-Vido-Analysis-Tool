export const CAMERA_NAMES = {
    FRONT: 1,
    FRONT_LEFT: 2,
    FRONT_RIGHT: 3,
    SIDE_LEFT: 4,
    SIDE_RIGHT: 5,
    REAR_LEFT: 6,
    REAR: 7,
    REAR_RIGHT: 8
};

export const CAMERA_LABELS = {
    [CAMERA_NAMES.FRONT]: 'Front',
    [CAMERA_NAMES.FRONT_LEFT]: 'Front Left',
    [CAMERA_NAMES.FRONT_RIGHT]: 'Front Right',
    [CAMERA_NAMES.SIDE_LEFT]: 'Side Left',
    [CAMERA_NAMES.SIDE_RIGHT]: 'Side Right',
    [CAMERA_NAMES.REAR_LEFT]: 'Rear Left',
    [CAMERA_NAMES.REAR]: 'Rear',
    [CAMERA_NAMES.REAR_RIGHT]: 'Rear Right'
};

export const CAMERA_RESOLUTION = {
    [CAMERA_NAMES.FRONT]: { width: 1920, height: 1280 },
    [CAMERA_NAMES.FRONT_LEFT]: { width: 1920, height: 1280 },
    [CAMERA_NAMES.FRONT_RIGHT]: { width: 1920, height: 1280 },
    [CAMERA_NAMES.SIDE_LEFT]: { width: 1920, height: 886 },
    [CAMERA_NAMES.SIDE_RIGHT]: { width: 1920, height: 886 },
    [CAMERA_NAMES.REAR_LEFT]: { width: 972, height: 587 },
    [CAMERA_NAMES.REAR]: { width: 972, height: 551 },
    [CAMERA_NAMES.REAR_RIGHT]: { width: 972, height: 587 }
};

export const CAMERA_ORDER = [
    CAMERA_NAMES.FRONT,
    CAMERA_NAMES.FRONT_LEFT,
    CAMERA_NAMES.FRONT_RIGHT,
    CAMERA_NAMES.SIDE_LEFT,
    CAMERA_NAMES.SIDE_RIGHT,
    CAMERA_NAMES.REAR_LEFT,
    CAMERA_NAMES.REAR,
    CAMERA_NAMES.REAR_RIGHT
];

export const LIDAR_NAMES = {
    TOP: 1,
    FRONT: 2,
    SIDE_LEFT: 3,
    SIDE_RIGHT: 4,
    REAR: 5
};

export const LIDAR_LABELS = {
    [LIDAR_NAMES.TOP]: 'Top',
    [LIDAR_NAMES.FRONT]: 'Front',
    [LIDAR_NAMES.SIDE_LEFT]: 'Side Left',
    [LIDAR_NAMES.SIDE_RIGHT]: 'Side Right',
    [LIDAR_NAMES.REAR]: 'Rear'
};

export const LIDAR_COLORS = {
    [LIDAR_NAMES.TOP]: '#22c55e',
    [LIDAR_NAMES.FRONT]: '#38bdf8',
    [LIDAR_NAMES.SIDE_LEFT]: '#f97316',
    [LIDAR_NAMES.SIDE_RIGHT]: '#facc15',
    [LIDAR_NAMES.REAR]: '#e879f9'
};

export const LIDAR_ORDER = [
    LIDAR_NAMES.TOP,
    LIDAR_NAMES.FRONT,
    LIDAR_NAMES.SIDE_LEFT,
    LIDAR_NAMES.SIDE_RIGHT,
    LIDAR_NAMES.REAR
];

export const BOX_TYPES = {
    UNKNOWN: 0,
    VEHICLE: 1,
    PEDESTRIAN: 2,
    SIGN: 3,
    CYCLIST: 4
};

export const BOX_TYPE_LABELS = {
    [BOX_TYPES.UNKNOWN]: 'Unknown',
    [BOX_TYPES.VEHICLE]: 'Vehicle',
    [BOX_TYPES.PEDESTRIAN]: 'Pedestrian',
    [BOX_TYPES.SIGN]: 'Sign',
    [BOX_TYPES.CYCLIST]: 'Cyclist'
};

export const BOX_TYPE_COLORS = {
    [BOX_TYPES.UNKNOWN]: '#94a3b8',
    [BOX_TYPES.VEHICLE]: '#f97316',
    [BOX_TYPES.PEDESTRIAN]: '#84cc16',
    [BOX_TYPES.SIGN]: '#e879f9',
    [BOX_TYPES.CYCLIST]: '#38bdf8'
};

export const KNOWN_COMPONENTS = new Set([
    'vehicle_pose',
    'lidar_calibration',
    'camera_calibration',
    'lidar_box',
    'lidar',
    'camera_image',
    'stats',
    'camera_box',
    'camera_to_lidar_box_association',
    'projected_lidar_box',
    'lidar_camera_projection',
    'lidar_pose',
    'lidar_camera_synced_box'
]);

export const REQUIRED_WAYMO_COMPONENTS = ['vehicle_pose', 'camera_image'];

export const OPTIONAL_BOX_COMPONENTS = ['camera_box', 'projected_lidar_box', 'lidar_camera_synced_box'];

export function getCameraLabel(cameraName) {
    return CAMERA_LABELS[cameraName] || `Camera ${cameraName}`;
}

export function getBoxTypeLabel(type) {
    return BOX_TYPE_LABELS[type] || BOX_TYPE_LABELS[BOX_TYPES.UNKNOWN];
}

export function getBoxTypeColor(type) {
    return BOX_TYPE_COLORS[type] || BOX_TYPE_COLORS[BOX_TYPES.UNKNOWN];
}

export function getLidarLabel(lidarName) {
    return LIDAR_LABELS[lidarName] || `LiDAR ${lidarName}`;
}

export function getLidarColor(lidarName) {
    return LIDAR_COLORS[lidarName] || '#94a3b8';
}
