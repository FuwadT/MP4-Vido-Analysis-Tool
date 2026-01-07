import React, { useState, memo } from 'react';
import {
    Car,
    MapPin,
    Cloud,
    Sun,
    CloudRain,
    CloudSnow,
    CloudFog,
    Gauge,
    Activity,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Save,
    FileText
} from 'lucide-react';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import {
    validateGPSCoordinates,
    validateSpeed,
    validateAcceleration,
    validateSteeringAngle,
    validateRequiredFields
} from '../utils/validation';

const INCIDENT_TYPES = [
    'Collision',
    'Near Miss',
    'Hard Brake',
    'Pedestrian Interaction',
    'False Positive',
    'Edge Case',
    'System Failure',
    'Other'
];

const WEATHER_CONDITIONS = [
    { value: 'clear', label: 'Clear', icon: Sun },
    { value: 'rain', label: 'Rain', icon: CloudRain },
    { value: 'snow', label: 'Snow', icon: CloudSnow },
    { value: 'fog', label: 'Fog', icon: CloudFog },
    { value: 'cloudy', label: 'Cloudy', icon: Cloud }
];

const LIGHTING_CONDITIONS = [
    'Daylight',
    'Dusk',
    'Dawn',
    'Night',
    'Artificial Lighting'
];

const ROAD_CONDITIONS = [
    'Dry',
    'Wet',
    'Icy',
    'Snow Covered',
    'Debris Present'
];

const AUTOPILOT_MODES = [
    'Full Self-Driving',
    'Autopilot',
    'Lane Keeping',
    'Adaptive Cruise',
    'Manual',
    'Driver Override'
];

export const MetadataPanel = memo(function MetadataPanel({
    metadata = {},
    onUpdate,
    onSave,
    onExportReport,
    isSaving = false,
    lastSaved = null
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [localMetadata, setLocalMetadata] = useState({
        // Incident Classification
        incidentType: metadata.incidentType || '',
        severity: metadata.severity || 3,
        description: metadata.description || '',

        // Vehicle Telemetry
        speed: metadata.speed || '',
        acceleration: metadata.acceleration || '',
        steeringAngle: metadata.steeringAngle || '',
        brakeStatus: metadata.brakeStatus || '',

        // Environmental Conditions
        weather: metadata.weather || 'clear',
        lighting: metadata.lighting || 'Daylight',
        roadCondition: metadata.roadCondition || 'Dry',

        // Location Data
        gpsCoordinates: metadata.gpsCoordinates || '',
        streetName: metadata.streetName || '',
        intersectionType: metadata.intersectionType || '',

        // System State
        autopilotMode: metadata.autopilotMode || '',
        driverIntervention: metadata.driverIntervention || false,
        sensorStatus: metadata.sensorStatus || '',

        // Root Cause Analysis
        rootCause: metadata.rootCause || '',
        contributingFactors: metadata.contributingFactors || '',
        recommendations: metadata.recommendations || ''
    });

    const [validationErrors, setValidationErrors] = useState({});

    const handleChange = (field, value) => {
        const updated = { ...localMetadata, [field]: value };
        setLocalMetadata(updated);

        // Real-time validation
        const errors = { ...validationErrors };

        // Validate specific fields
        if (field === 'gpsCoordinates') {
            const error = validateGPSCoordinates(value);
            if (error) errors.gpsCoordinates = error;
            else delete errors.gpsCoordinates;
        } else if (field === 'speed') {
            const error = validateSpeed(value);
            if (error) errors.speed = error;
            else delete errors.speed;
        } else if (field === 'acceleration') {
            const error = validateAcceleration(value);
            if (error) errors.acceleration = error;
            else delete errors.acceleration;
        } else if (field === 'steeringAngle') {
            const error = validateSteeringAngle(value);
            if (error) errors.steeringAngle = error;
            else delete errors.steeringAngle;
        }

        setValidationErrors(errors);

        if (onUpdate) {
            onUpdate(updated);
        }
    };

    const handleSave = () => {
        // Validate required fields before saving
        const requiredError = validateRequiredFields(localMetadata);
        if (requiredError) {
            alert(requiredError);
            return;
        }

        // Check for any validation errors
        if (Object.keys(validationErrors).length > 0) {
            alert('Please fix validation errors before saving.');
            return;
        }

        if (onSave) {
            onSave(localMetadata);
        }
    };

    const getSeverityColor = (severity) => {
        if (severity >= 4) return 'text-red-500';
        if (severity >= 3) return 'text-orange-500';
        if (severity >= 2) return 'text-yellow-500';
        return 'text-green-500';
    };

    const getSeverityLabel = (severity) => {
        if (severity === 5) return 'Critical';
        if (severity === 4) return 'High';
        if (severity === 3) return 'Medium';
        if (severity === 2) return 'Low';
        return 'Minimal';
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 p-3 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse metadata panel" : "Expand metadata panel"}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                    </button>
                    <FileText size={18} className="text-blue-400" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Incident Metadata
                    </h3>
                    <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
                </div>

                <div className="flex items-center gap-2">
                    {onExportReport && (
                        <button
                            onClick={onExportReport}
                            aria-label="Export report"
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs text-white transition-colors flex items-center gap-1"
                        >
                            <FileText size={14} aria-hidden="true" />
                            Export Report
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        aria-label="Save metadata"
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition-colors flex items-center gap-1"
                    >
                        <Save size={14} aria-hidden="true" />
                        Save
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                    {/* Incident Classification */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle size={14} aria-hidden="true" />
                            Incident Classification
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="incidentType" className="text-xs text-gray-400 block mb-1">Incident Type</label>
                                <select
                                    id="incidentType"
                                    value={localMetadata.incidentType}
                                    onChange={(e) => handleChange('incidentType', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                                >
                                    <option value="">Select type...</option>
                                    {INCIDENT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="severity" className="text-xs text-gray-400 block mb-1">
                                    Severity: <span className={`font-bold ${getSeverityColor(localMetadata.severity)}`}>
                                        {getSeverityLabel(localMetadata.severity)}
                                    </span>
                                </label>
                                <input
                                    id="severity"
                                    type="range"
                                    min="1"
                                    max="5"
                                    aria-valuemin="1"
                                    aria-valuemax="5"
                                    aria-valuenow={localMetadata.severity}
                                    aria-valuetext={getSeverityLabel(localMetadata.severity)}
                                    value={localMetadata.severity}
                                    onChange={(e) => handleChange('severity', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1" aria-hidden="true">
                                    <span>1</span>
                                    <span>2</span>
                                    <span>3</span>
                                    <span>4</span>
                                    <span>5</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="text-xs text-gray-400 block mb-1">Description</label>
                            <textarea
                                id="description"
                                value={localMetadata.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                placeholder="Describe what happened..."
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 resize-none"
                                rows="2"
                            />
                        </div>
                    </div>

                    {/* Vehicle Telemetry */}
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Gauge size={14} aria-hidden="true" />
                            Vehicle Telemetry
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="speed" className="text-xs text-gray-400 block mb-1">Speed (mph)</label>
                                <input
                                    id="speed"
                                    type="number"
                                    value={localMetadata.speed}
                                    onChange={(e) => handleChange('speed', e.target.value)}
                                    placeholder="e.g., 35"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="acceleration" className="text-xs text-gray-400 block mb-1">Acceleration (m/s²)</label>
                                <input
                                    id="acceleration"
                                    type="number"
                                    value={localMetadata.acceleration}
                                    onChange={(e) => handleChange('acceleration', e.target.value)}
                                    placeholder="e.g., -2.5"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="steeringAngle" className="text-xs text-gray-400 block mb-1">Steering Angle (°)</label>
                                <input
                                    id="steeringAngle"
                                    type="number"
                                    value={localMetadata.steeringAngle}
                                    onChange={(e) => handleChange('steeringAngle', e.target.value)}
                                    placeholder="e.g., 15"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="brakeStatus" className="text-xs text-gray-400 block mb-1">Brake Status</label>
                                <input
                                    id="brakeStatus"
                                    type="text"
                                    value={localMetadata.brakeStatus}
                                    onChange={(e) => handleChange('brakeStatus', e.target.value)}
                                    placeholder="e.g., Applied"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Environmental Conditions */}
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Cloud size={14} aria-hidden="true" />
                            Environmental Conditions
                        </h4>

                        <div role="radiogroup" aria-label="Weather Condition" className="grid grid-cols-3 gap-2">
                            {/* eslint-disable-next-line no-unused-vars */}
                            {WEATHER_CONDITIONS.map(({ value, label, icon: WeatherIcon }) => (
                                <button
                                    key={value}
                                    role="radio"
                                    aria-checked={localMetadata.weather === value}
                                    aria-label={label}
                                    onClick={() => handleChange('weather', value)}
                                    className={`p-2 rounded border transition-colors flex flex-col items-center gap-1 ${localMetadata.weather === value
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                        }`}
                                >
                                    <WeatherIcon size={16} aria-hidden="true" />
                                    <span className="text-xs">{label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="lighting" className="text-xs text-gray-400 block mb-1">Lighting</label>
                                <select
                                    id="lighting"
                                    value={localMetadata.lighting}
                                    onChange={(e) => handleChange('lighting', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                                >
                                    {LIGHTING_CONDITIONS.map(condition => (
                                        <option key={condition} value={condition}>{condition}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="roadCondition" className="text-xs text-gray-400 block mb-1">Road Condition</label>
                                <select
                                    id="roadCondition"
                                    value={localMetadata.roadCondition}
                                    onChange={(e) => handleChange('roadCondition', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                                >
                                    {ROAD_CONDITIONS.map(condition => (
                                        <option key={condition} value={condition}>{condition}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Location Data */}
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <MapPin size={14} aria-hidden="true" />
                            Location Data
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="gpsCoordinates" className="text-xs text-gray-400 block mb-1">GPS Coordinates</label>
                                <input
                                    id="gpsCoordinates"
                                    type="text"
                                    value={localMetadata.gpsCoordinates}
                                    onChange={(e) => handleChange('gpsCoordinates', e.target.value)}
                                    placeholder="e.g., 37.7749, -122.4194"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label htmlFor="streetName" className="text-xs text-gray-400 block mb-1">Street Name</label>
                                <input
                                    id="streetName"
                                    type="text"
                                    value={localMetadata.streetName}
                                    onChange={(e) => handleChange('streetName', e.target.value)}
                                    placeholder="e.g., Main St & 1st Ave"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div className="col-span-2">
                                <label htmlFor="intersectionType" className="text-xs text-gray-400 block mb-1">Intersection Type</label>
                                <input
                                    id="intersectionType"
                                    type="text"
                                    value={localMetadata.intersectionType}
                                    onChange={(e) => handleChange('intersectionType', e.target.value)}
                                    placeholder="e.g., 4-way stop, Traffic light"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* System State */}
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Car size={14} aria-hidden="true" />
                            System State
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="autopilotMode" className="text-xs text-gray-400 block mb-1">Autopilot Mode</label>
                                <select
                                    id="autopilotMode"
                                    value={localMetadata.autopilotMode}
                                    onChange={(e) => handleChange('autopilotMode', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                                >
                                    <option value="">Select mode...</option>
                                    {AUTOPILOT_MODES.map(mode => (
                                        <option key={mode} value={mode}>{mode}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="sensorStatus" className="text-xs text-gray-400 block mb-1">Sensor Status</label>
                                <input
                                    id="sensorStatus"
                                    type="text"
                                    value={localMetadata.sensorStatus}
                                    onChange={(e) => handleChange('sensorStatus', e.target.value)}
                                    placeholder="e.g., All operational"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={localMetadata.driverIntervention}
                                        onChange={(e) => handleChange('driverIntervention', e.target.checked)}
                                        className="w-4 h-4 bg-gray-900 border-gray-700 rounded"
                                    />
                                    <span className="text-sm text-white">Driver Intervention Occurred</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Root Cause Analysis */}
                    <div className="space-y-3 border-t border-gray-700 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Activity size={14} aria-hidden="true" />
                            Root Cause Analysis
                        </h4>

                        <div>
                            <label htmlFor="rootCause" className="text-xs text-gray-400 block mb-1">Root Cause</label>
                            <textarea
                                id="rootCause"
                                value={localMetadata.rootCause}
                                onChange={(e) => handleChange('rootCause', e.target.value)}
                                placeholder="Primary cause of the incident..."
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 resize-none"
                                rows="2"
                            />
                        </div>

                        <div>
                            <label htmlFor="contributingFactors" className="text-xs text-gray-400 block mb-1">Contributing Factors</label>
                            <textarea
                                id="contributingFactors"
                                value={localMetadata.contributingFactors}
                                onChange={(e) => handleChange('contributingFactors', e.target.value)}
                                placeholder="Other factors that contributed..."
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 resize-none"
                                rows="2"
                            />
                        </div>

                        <div>
                            <label htmlFor="recommendations" className="text-xs text-gray-400 block mb-1">Recommendations</label>
                            <textarea
                                id="recommendations"
                                value={localMetadata.recommendations}
                                onChange={(e) => handleChange('recommendations', e.target.value)}
                                placeholder="Recommendations to prevent recurrence..."
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 resize-none"
                                rows="2"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
