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

export const OPTIONAL_BOX_COMPONENTS = ['camera_box', 'projected_lidar_box', 'lidar_camera_synced_box'];

export const LIDAR_LABELS = {
    1: 'Top',
    2: 'Front',
    3: 'Side Left',
    4: 'Side Right',
    5: 'Rear'
};

export const LIDAR_COLORS = {
    1: '#22c55e',
    2: '#38bdf8',
    3: '#f97316',
    4: '#facc15',
    5: '#e879f9'
};

export function getBoxTypeLabel(type) {
    return BOX_TYPE_LABELS[type] || BOX_TYPE_LABELS[BOX_TYPES.UNKNOWN];
}

export function getLidarLabel(lidarName) {
    return LIDAR_LABELS[lidarName] || `LiDAR ${lidarName}`;
}

export function getLidarColor(lidarName) {
    return LIDAR_COLORS[lidarName] || '#94a3b8';
}
