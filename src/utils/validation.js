// Validation utilities for metadata fields

export const validateGPSCoordinates = (value) => {
    if (!value) return null;
    const gpsRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    if (!gpsRegex.test(value)) {
        return 'Invalid format. Use: latitude, longitude (e.g., 37.7749, -122.4194)';
    }

    const [lat, lon] = value.split(',').map(s => parseFloat(s.trim()));
    if (lat < -90 || lat > 90) {
        return 'Latitude must be between -90 and 90';
    }
    if (lon < -180 || lon > 180) {
        return 'Longitude must be between -180 and 180';
    }

    return null;
};

export const validateSpeed = (value) => {
    if (!value) return null;
    const speed = parseFloat(value);
    if (isNaN(speed)) {
        return 'Must be a number';
    }
    if (speed < 0) {
        return 'Speed cannot be negative';
    }
    if (speed > 200) {
        return 'Speed seems unusually high. Please verify.';
    }
    return null;
};

export const validateAcceleration = (value) => {
    if (!value) return null;
    const accel = parseFloat(value);
    if (isNaN(accel)) {
        return 'Must be a number';
    }
    if (Math.abs(accel) > 20) {
        return 'Acceleration seems unusually high. Please verify.';
    }
    return null;
};

export const validateSteeringAngle = (value) => {
    if (!value) return null;
    const angle = parseFloat(value);
    if (isNaN(angle)) {
        return 'Must be a number';
    }
    if (Math.abs(angle) > 720) {
        return 'Steering angle seems unusually large. Please verify.';
    }
    return null;
};

export const REQUIRED_FIELDS = ['incidentType', 'severity', 'description'];

export const validateRequiredFields = (metadata) => {
    const missing = REQUIRED_FIELDS.filter(field => {
        const value = metadata[field];
        return !value || (typeof value === 'string' && value.trim() === '');
    });

    if (missing.length > 0) {
        const fieldNames = {
            incidentType: 'Incident Type',
            severity: 'Severity',
            description: 'Description'
        };
        return `Please fill required fields: ${missing.map(f => fieldNames[f]).join(', ')}`;
    }

    return null;
};
