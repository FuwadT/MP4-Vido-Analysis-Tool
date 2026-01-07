import React, { useState, useRef, useEffect } from 'react';
import { CanvasOverlay } from './CanvasOverlay';
import { Controls } from './Controls';
import { IncidentTimeline } from './IncidentTimeline';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { SimpleTracker } from '../utils/tracker';
import { analyzeTrafficLightColor } from '../utils/trafficLightLogic';
import { loadClassifier, getDetailedClass } from '../utils/detailClassifier';
import { mapCocoToSchema, refineSchemaTag } from '../utils/schemaMapper';
import { TrackSidebar } from './TrackSidebar';
import yaml from 'js-yaml';

export function VideoAnnotation() {
    const [videoSrc, setVideoSrc] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);

    // AI State
    const [model, setModel] = useState(null);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [predictions, setPredictions] = useState([]); // Raw predictions OR Tracked objects
    const [uniqueTracks, setUniqueTracks] = useState([]); // All unique tracks found {id, class, color}

    // Phase 3: Offline Analysis State
    const [analysisMode, setAnalysisMode] = useState('idle'); // 'idle' | 'analyzing' | 'done'
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisResults, setAnalysisResults] = useState([]); // Array of { timestamp, predictions }

    // Phase 9: Advanced Analysis State
    const [analysisStart, setAnalysisStart] = useState(0);
    const [analysisEnd, setAnalysisEnd] = useState(null); // null means full curation
    const [isAnalysisPaused, setIsAnalysisPaused] = useState(false);

    // Settings
    const [minConfidence, setMinConfidence] = useState(0.5);

    // Incident Timeline State
    const [events, setEvents] = useState([]);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Incident Metadata State
    const [metadata, setMetadata] = useState({});

    // Auto-save State
    const [lastSaved, setLastSaved] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Keyboard Shortcuts State
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const requestRef = useRef();

    // Tracker reference - persist across renders
    const trackerRef = useRef(new SimpleTracker());
    // Ref for isAnalysisPaused to be accessible inside the async loop without stale closures
    const isAnalysisPausedRef = useRef(isAnalysisPaused);
    useEffect(() => {
        isAnalysisPausedRef.current = isAnalysisPaused;
    }, [isAnalysisPaused]);

    // Start/End handling
    const displayPredictions = predictions;

    // Load Models on Mount
    useEffect(() => {
        async function load() {
            setIsModelLoading(true);
            try {
                await tf.ready();
                const [loadedCoco, loadedMobile] = await Promise.all([
                    cocoSsd.load(),
                    loadClassifier()
                ]);
                setModel(loadedCoco);
                console.log('Models loaded');
            } catch (err) {
                console.error('Failed to load models', err);
            } finally {
                setIsModelLoading(false);
            }
        }
        load();
    }, []);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setPredictions([]);
            setUniqueTracks([]);
            setAnalysisMode('idle');
            setAnalysisResults([]);
            setAnalysisStart(0);
            setAnalysisEnd(null); // Reset end time
            trackerRef.current.reset();
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const time = videoRef.current.currentTime;
        setCurrentTime(time);

        // If we have analysis results, use them instead of live detection
        if (analysisMode === 'done' || (analysisMode === 'idle' && analysisResults.length > 0)) {
            // Find nearest frame
            // Simple approach: find first frame where timestamp >= currentTime - epsilon
            const frame = analysisResults.find(f => Math.abs(f.timestamp - time) < 0.2);
            if (frame) {
                setPredictions(frame.predictions);
            } else {
                setPredictions([]);
            }
        }
    };

    const runFullAnalysis = async () => {
        if (!videoRef.current || !model) return;

        setAnalysisMode('analyzing');
        setAnalysisProgress(0);
        setIsAnalysisPaused(false);
        setAnalysisResults([]);
        setPredictions([]);
        trackerRef.current.reset();

        const video = videoRef.current;
        const duration = video.duration;

        // Use user range or default to full
        const startTime = analysisStart || 0;
        const endTime = analysisEnd || duration;

        const step = 0.1; // 100ms steps

        video.pause();
        setIsPlaying(false);

        const results = [];

        // Helper to seek and wait
        const seekTo = (t) => new Promise(resolve => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = t;
        });

        // Helper to wait while paused
        const checkPause = async () => {
            while (isAnalysisPausedRef.current) {
                await new Promise(r => setTimeout(r, 200));
            }
        };

        for (let t = startTime; t < endTime; t += step) {
            // Check pause (using ref mechanism would be cleaner for interrupt, but reading state in loop in React is tricky due to closure)
            // We need a ref for the pause state to read it inside the loop correctly without restarting
            // Actually, we can just use a simple state check if we use a ref, let's assume we implement the ref below.
            // For now, simple check:
            // (NOTE: React state inside async loop won't update unless we re-read. We need a Ref for pause state)
            if (isAnalysisPausedRef.current) {
                await checkPause();
            }

            await seekTo(t);
            setCurrentTime(t);

            // Detect
            const rawPreds = await model.detect(video);

            // Filter & Map (Schema Enforcement)
            let validPreds = [];
            for (let p of rawPreds) {
                if (p.score < minConfidence) continue;
                const mappedClass = mapCocoToSchema(p.class);
                if (mappedClass) {
                    validPreds.push({ ...p, class: mappedClass });
                }
            }

            // Track - PASS TIMESTAMP
            const tracks = trackerRef.current.update(validPreds, t);

            // Post-Process: Detailed Classification (Stage 2)
            for (let track of tracks) {
                // Optimization: Only run mobilenet if we haven't already refined it to a specific leaf node
                const needsRefinement = ['Vehicle', 'Truck', 'Motorcycle', 'Scooter'].includes(track.class) && track.score > 0.6;
                const hasNotBenRefined = !track.finalizedSchema;

                if (needsRefinement && hasNotBenRefined) {
                    const detail = await getDetailedClass(video, track.bbox);
                    if (detail) {
                        const refinedTag = refineSchemaTag(track.class, detail);
                        if (refinedTag !== track.class) {
                            track.class = refinedTag;
                        }
                        track.finalizedSchema = true;
                    }
                }
            }

            // Store (deep copy tracks to avoid reference issues)
            const tracksCopy = JSON.parse(JSON.stringify(tracks));
            results.push({
                timestamp: t,
                predictions: tracksCopy
            });

            // Update UI occasionally
            setPredictions(tracks);
            setAnalysisProgress(Math.round(((t - startTime) / (endTime - startTime)) * 100));

            // Collect unique tracks
            setUniqueTracks(prev => {
                const newTracks = [...prev];
                tracks.forEach(t => {
                    const existingIndex = newTracks.findIndex(ut => ut.id === t.id);
                    if (existingIndex === -1) {
                        // Pass metadata
                        newTracks.push({
                            id: t.id,
                            class: t.class,
                            color: t.color,
                            firstSeen: t.firstSeen,
                            maxScore: t.maxScore
                        });
                    } else if (newTracks[existingIndex].class !== t.class) {
                        newTracks[existingIndex].class = t.class;
                    } else {
                        // Update score metadata if better ? (Ideally track max in tracker)
                        // The tracker object tracks maxScore, so we should trust it, but we need to update the LIST state.
                        // For now, let's just stick to initial metadata or update if needed.
                        newTracks[existingIndex].maxScore = Math.max(newTracks[existingIndex].maxScore || 0, t.maxScore || 0);
                    }
                });
                return newTracks;
            });

            // Small yield to let UI update and VIDEO frame paint
            await new Promise(r => requestAnimationFrame(r));
        }

        setAnalysisResults(results);
        setAnalysisMode('done');
        setAnalysisProgress(100);
        video.currentTime = startTime; // Reset to start
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Event Management
    const handleAddEvent = (event) => {
        setEvents(prev => [...prev, event]);
    };

    const handleRemoveEvent = (eventId) => {
        setEvents(prev => prev.filter(e => e.id !== eventId));
    };

    const handleUpdateEvent = (eventId, updates) => {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
    };

    // Playback Speed Control
    const handlePlaybackSpeedChange = (speed) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
    };

    // Keyboard Shortcuts Handler
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Ignore shortcuts when typing in inputs/textareas
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Prevent default for handled shortcuts
            const preventDefault = () => e.preventDefault();

            switch (e.key) {
                case ' ': // Space - Play/Pause
                    preventDefault();
                    togglePlay();
                    break;

                case 'ArrowRight': // Right arrow - Forward
                    preventDefault();
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Right - Next event
                        const nextEvent = events.find(ev => ev.time > currentTime + 0.1);
                        if (nextEvent) handleSeek(nextEvent.time);
                    } else if (e.shiftKey) {
                        // Shift+Right - Forward 1 second
                        handleSeek(Math.min(currentTime + 1, duration));
                    } else {
                        // Right - Forward 0.1 second (1 frame)
                        handleSeek(Math.min(currentTime + 0.1, duration));
                    }
                    break;

                case 'ArrowLeft': // Left arrow - Backward
                    preventDefault();
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Left - Previous event
                        const prevEvents = events.filter(ev => ev.time < currentTime - 0.1);
                        const prevEvent = prevEvents[prevEvents.length - 1];
                        if (prevEvent) handleSeek(prevEvent.time);
                    } else if (e.shiftKey) {
                        // Shift+Left - Backward 1 second
                        handleSeek(Math.max(currentTime - 1, 0));
                    } else {
                        // Left - Backward 0.1 second (1 frame)
                        handleSeek(Math.max(currentTime - 0.1, 0));
                    }
                    break;

                case 'Home': // Jump to start
                    preventDefault();
                    handleSeek(0);
                    break;

                case 'End': // Jump to end
                    preventDefault();
                    handleSeek(duration);
                    break;

                case '+': // Increase speed
                case '=': // Also handle = key (same key as +)
                    preventDefault();
                    const newSpeedUp = Math.min(playbackSpeed * 1.25, 2);
                    handlePlaybackSpeedChange(newSpeedUp);
                    break;

                case '-': // Decrease speed
                case '_': // Also handle _ key (same key as -)
                    preventDefault();
                    const newSpeedDown = Math.max(playbackSpeed * 0.8, 0.25);
                    handlePlaybackSpeedChange(newSpeedDown);
                    break;

                case '0': // Reset to 1x speed
                    preventDefault();
                    handlePlaybackSpeedChange(1);
                    break;

                case 'm': // Add marker
                case 'M':
                    preventDefault();
                    // Trigger add event UI
                    // This will be handled by IncidentTimeline component
                    break;

                case '1': // Quick add: Collision
                case '2': // Quick add: Near Miss
                case '3': // Quick add: Hard Brake
                case '4': // Quick add: Detection
                case '5': // Quick add: Pedestrian
                case '6': // Quick add: System Event
                case '7': // Quick add: Custom
                    preventDefault();
                    const eventTypes = ['COLLISION', 'NEAR_MISS', 'HARD_BRAKE', 'DETECTION', 'PEDESTRIAN', 'SYSTEM_EVENT', 'CUSTOM'];
                    const typeIndex = parseInt(e.key) - 1;
                    if (typeIndex >= 0 && typeIndex < eventTypes.length) {
                        const eventType = eventTypes[typeIndex];
                        const EVENT_LABELS = {
                            COLLISION: 'Collision',
                            NEAR_MISS: 'Near Miss',
                            HARD_BRAKE: 'Hard Brake',
                            DETECTION: 'Object Detection',
                            PEDESTRIAN: 'Pedestrian',
                            SYSTEM_EVENT: 'System Event',
                            CUSTOM: 'Custom'
                        };
                        handleAddEvent({
                            id: Date.now(),
                            type: eventType,
                            time: currentTime,
                            note: EVENT_LABELS[eventType],
                            severity: eventType === 'COLLISION' ? 'critical' : eventType === 'NEAR_MISS' || eventType === 'HARD_BRAKE' || eventType === 'PEDESTRIAN' ? 'warning' : 'info'
                        });
                    }
                    break;

                case 's': // Ctrl+S - Save metadata
                case 'S':
                    if (e.ctrlKey || e.metaKey) {
                        preventDefault();
                        handleMetadataSave(metadata);
                    }
                    break;

                case 'e': // Ctrl+E - Export report
                case 'E':
                    if (e.ctrlKey || e.metaKey) {
                        preventDefault();
                        handleExportReport();
                    }
                    break;

                case '?': // Show shortcuts help
                    preventDefault();
                    setShowShortcutsHelp(true);
                    break;

                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentTime, duration, isPlaying, playbackSpeed, events, metadata]);

    // Apply playback speed when video loads
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackSpeed;
        }
    }, [videoSrc, playbackSpeed]);

    // Metadata Management
    const handleMetadataUpdate = (updatedMetadata) => {
        setMetadata(updatedMetadata);
    };

    const handleMetadataSave = (metadataToSave) => {
        setMetadata(metadataToSave);
        // Could also trigger auto-save to localStorage or backend here
        console.log('Metadata saved:', metadataToSave);
    };

    // Auto-save effect
    useEffect(() => {
        const autoSaveInterval = setInterval(() => {
            if (metadata && Object.keys(metadata).length > 0) {
                setIsSaving(true);
                // Save to localStorage as backup
                try {
                    localStorage.setItem('incident_metadata_autosave', JSON.stringify({
                        metadata,
                        events,
                        timestamp: new Date().toISOString()
                    }));
                    setLastSaved(new Date());
                } catch (e) {
                    console.error('Auto-save failed:', e);
                }
                setTimeout(() => setIsSaving(false), 500);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(autoSaveInterval);
    }, [metadata, events]);

    const handleExportReport = () => {
        // Generate comprehensive incident report
        const report = {
            metadata,
            events,
            tracks: uniqueTracks,
            analysisResults: analysisResults.length > 0 ? {
                totalFrames: analysisResults.length,
                startTime: analysisStart,
                endTime: analysisEnd || duration
            } : null,
            exportedAt: new Date().toISOString()
        };

        try {
            const dataStr = JSON.stringify(report, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `incident_report_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export report:', e);
            alert('Failed to export report');
        }
    };

    const handleSeek = (time) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);

            if (analysisMode === 'done') {
                // Look up frame
                const frame = analysisResults.find(f => Math.abs(f.timestamp - time) < 0.2);
                if (frame) {
                    setPredictions(frame.predictions);
                }
            } else {
                setPredictions([]);
                trackerRef.current.reset();
            }
        }
    };

    // Live Detection Loop (Hybrid: Only run if NOT analyzed)
    const detectFrame = async () => {
        if (analysisMode === 'analyzing' || analysisMode === 'done') return; // Disable live if analyzing or done

        if (videoRef.current && model && videoRef.current.readyState === 4) {
            // 1. Detect
            const rawPreds = await model.detect(videoRef.current);

            // 2. Filter & Map (Schema Enforcement)
            let validPreds = [];
            for (let p of rawPreds) {
                if (p.score < minConfidence) continue;
                const mappedClass = mapCocoToSchema(p.class);
                if (mappedClass) {
                    validPreds.push({ ...p, class: mappedClass });
                }
            }

            // 3. Update Tracker
            const tracks = trackerRef.current.update(validPreds);
            setPredictions(tracks); // Update state with TRACKS

            // 4. Update stats - Schema already enforced by mapCocoToSchema
            if (tracks.length > 0) {
                setUniqueTracks(prev => {
                    const newTracks = [...prev];
                    tracks.forEach(t => {
                        const existingIndex = newTracks.findIndex(ut => ut.id === t.id);
                        if (existingIndex === -1) {
                            newTracks.push({ id: t.id, class: t.class, color: t.color });
                        } else if (newTracks[existingIndex].class !== t.class) {
                            newTracks[existingIndex].class = t.class;
                        }
                    });
                    return newTracks;
                });
            }
        }

        if (isPlaying) {
            requestRef.current = requestAnimationFrame(detectFrame);
        }
    };

    // --- Persistence (Memory) ---
    const saveAnalysis = () => {
        if (analysisResults.length === 0) {
            alert("No analysis data to save! Run 'Analyze Full Video' first.");
            return;
        }
        // Use YAML dump
        try {
            const dataStr = yaml.dump(analysisResults);
            const blob = new Blob([dataStr], { type: "text/yaml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "video_analysis_memory.yaml";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("Failed to save as YAML");
        }
    };

    const loadAnalysis = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Use YAML load
                const data = yaml.load(e.target.result);

                if (!Array.isArray(data)) {
                    throw new Error("Invalid YAML format: Root must be an array");
                }

                setAnalysisResults(data);
                // Assuming setIsAnalysisDone is a state setter for analysisMode === 'done'
                // If not, you might need to set analysisMode('done') directly
                setAnalysisMode('done');

                // Re-populate unique tracks list from the loaded data
                const unique = new Map();
                data.forEach(frame => {
                    frame.predictions.forEach(p => {
                        if (p.id) {
                            if (!unique.has(p.id)) {
                                unique.set(p.id, {
                                    id: p.id,
                                    class: p.class,
                                    color: p.color || '#00FF00',
                                    firstSeen: p.firstSeen || 0,
                                    maxScore: p.maxScore || p.score || 0
                                });
                            } else {
                                // Update label if newer is more specific
                                const existing = unique.get(p.id);
                                if (p.class !== existing.class) {
                                    existing.class = p.class;
                                }
                                // Update maxScore if available in this frame
                                if (p.maxScore > (existing.maxScore || 0)) {
                                    existing.maxScore = p.maxScore;
                                }
                                // Keep earliest firstSeen (should be correct by order, but safe to verify)
                                if (p.firstSeen !== undefined && (existing.firstSeen === undefined || p.firstSeen < existing.firstSeen)) {
                                    existing.firstSeen = p.firstSeen;
                                }
                            }
                        }
                    });
                });

                setUniqueTracks(Array.from(unique.values()));
                alert("Memory Loaded! The AI remembers this video (YAML).");
            } catch (err) {
                console.error(err);
                alert("Failed to load memory file. Ensure it is a valid YAML file.");
            }
        };
        reader.readAsText(file);
    };

    // --- Teaching (Learning) ---
    const renameTrack = (trackId, currentLabel) => {
        const newLabel = prompt(`Teach AI: Rename '${currentLabel}' (ID #${trackId}) to:`, currentLabel);
        if (!newLabel || newLabel === currentLabel) return;

        // 1. Update Analysis History
        const updatedHistory = analysisResults.map(frame => ({
            ...frame,
            predictions: frame.predictions.map(p => {
                if (p.id === trackId) {
                    return { ...p, class: newLabel, detailedLabel: newLabel };
                }
                return p;
            })
        }));
        setAnalysisResults(updatedHistory);

        // 2. Update Live List (uniqueTracks)
        setUniqueTracks(prev => prev.map(t =>
            t.id === trackId ? { ...t, class: newLabel } : t
        ));

        // 3. Update Current Frame (if paused)
        setPredictions(prev => prev.map(p =>
            p.id === trackId ? { ...p, class: newLabel } : p
        ));
    };

    // --- State Management for Detection ---
    // Trigger detection (Live)
    useEffect(() => {
        // If minConfidence changes, we might want to re-evaluate uniqueTags? 
        // No, uniqueTags is historical. We just affect future detection logging.

        if (isPlaying && analysisMode === 'idle') {
            detectFrame();
        } else {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, minConfidence, model, analysisMode]); // Re-run if model loads while playing

    // Also run once when video is paused but we might be seeking or just loaded
    // To show tags on the current static frame.
    useEffect(() => {
        if (!isPlaying && videoRef.current && model && analysisMode === 'idle') {
            // Debounce slightly to allow seek to finish render
            const timer = setTimeout(() => detectFrame(), 200);
            return () => clearTimeout(timer);
        }
    }, [currentTime, model, isPlaying, analysisMode]);

    // Force update unique tags if threshold rises above existing logs?
    // Ideally we would store all raw detections and filter 'uniqueTags' on the fly too, but that's expensive memory-wise.
    // We'll accept that uniqueTags might contain past low-confidence items.


    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                {!videoSrc ? (
                    <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-lg">
                        <h2 className="text-2xl font-bold mb-4">Upload Video to Auto-Analyze</h2>
                        {isModelLoading ? (
                            <div className="text-blue-400 animate-pulse">Loading AI Model...</div>
                        ) : (
                            <div className="text-green-400 mb-4">AI Model Ready</div>
                        )}
                        <input
                            type="file"
                            accept="video/mp4,video/webm"
                            onChange={handleFileChange}
                            disabled={isModelLoading}
                            className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                cursor-pointer
              "
                        />
                        <button
                            onClick={() => setShowShortcutsHelp(true)}
                            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors flex items-center gap-2 mx-auto"
                        >
                            <span className="font-mono">⌨️</span>
                            View Keyboard Shortcuts (Press ?)
                        </button>
                    </div>
                ) : (
                    <div className="w-full max-w-4xl flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-gray-800 p-3 rounded">
                            <div className="flex items-center gap-4 w-full">
                                <div className="flex flex-col gap-2 mb-0 w-full">
                                    {analysisMode !== 'analyzing' ? (
                                        <div className="flex gap-4 items-end">
                                            {/* Range Inputs */}
                                            <div className="flex gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Start (s)</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        value={analysisStart}
                                                        onChange={(e) => setAnalysisStart(Number(e.target.value))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">End (s)</label>
                                                    <input
                                                        type="number"
                                                        className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        value={analysisEnd === null ? duration : analysisEnd}
                                                        onChange={(e) => setAnalysisEnd(Number(e.target.value))}
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={runFullAnalysis}
                                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-900/50"
                                            >
                                                {analysisMode === 'done' ? 'Re-Analyze Range' : 'Analyze Range'}
                                                {isModelLoading && <span className="text-xs opacity-75">(Loading AI...)</span>}
                                            </button>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveAnalysis}
                                                    disabled={analysisMode !== 'done'}
                                                    className={`px-4 py-2 text-sm font-medium rounded border ${analysisMode === 'done' ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-white' : 'bg-gray-800 text-gray-500 border-gray-800 cursor-not-allowed'}`}
                                                >
                                                    Save This Session
                                                </button>
                                                <label>
                                                    <span className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded border bg-gray-700 hover:bg-gray-600 border-gray-600 text-white cursor-pointer">
                                                        Load Session
                                                    </span>
                                                    <input type="file" onChange={loadAnalysis} accept=".yaml,.yml,.json" className="hidden" />
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        // Analyzing Controls (Pause)
                                        <div className="w-full flex items-center justify-between">
                                            <span className="text-purple-400 font-bold animate-pulse">ANALYZING VIDEO... DO NOT CLOSE.</span>
                                            <button
                                                onClick={() => setIsAnalysisPaused(!isAnalysisPaused)}
                                                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-bold"
                                            >
                                                {isAnalysisPaused ? "RESUME" : "PAUSE"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {analysisMode === 'done' && (
                                    <div className="text-green-400 font-bold flex items-center gap-2 whitespace-nowrap">
                                        ✓ Ready
                                        <button onClick={() => setAnalysisMode('idle')} className="text-xs text-gray-400 underline ml-2">Reset</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div ref={containerRef} className="relative shadow-2xl rounded-lg overflow-hidden max-h-[70vh] aspect-video bg-black group">
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                className="w-full h-full object-contain"
                                crossOrigin="anonymous"
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => setIsPlaying(false)}
                            />
                            <CanvasOverlay
                                width={containerRef.current?.clientWidth || 800}
                                height={containerRef.current?.clientHeight || 450}
                                videoWidth={videoRef.current?.videoWidth || 0}
                                videoHeight={videoRef.current?.videoHeight || 0}
                                predictions={displayPredictions}
                            />

                            {/* HUD LAYER */}
                            {analysisMode === 'analyzing' && (
                                <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 bg-black/20">
                                    {/* Scan Line - Hide if Paused? */}
                                    <div className={`scan-line ${isAnalysisPaused ? 'opacity-0' : ''}`}></div>

                                    {/* Top Info */}
                                    <div className="flex justify-between items-start font-mono text-green-400 text-sm">
                                        <div className="bg-black/50 p-2 rounded">
                                            {isAnalysisPaused ? "SYSTEM PAUSED" : "SYSTEM ANALYZING..."}<br />
                                            <span className="text-white">FRAME: {currentTime.toFixed(2)}s</span>
                                        </div>
                                        <div className={`bg-black/50 p-2 rounded ${isAnalysisPaused ? '' : 'animate-pulse'}`}>
                                            [{isAnalysisPaused ? " PAUSED " : " RECORDING "}]
                                        </div>
                                    </div>

                                    {/* Bottom Info / Progress */}
                                    <div className="w-full bg-black/50 p-2 rounded font-mono">
                                        <div className="text-green-400 mb-1 flex justify-between">
                                            <span>PROGRESS</span>
                                            <span>{analysisProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-green-900">
                                            <div
                                                className={`h-full bg-green-500 shadow-[0_0_10px_#00ff00] transition-all duration-300`}
                                                style={{ width: `${analysisProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="w-full space-y-3">
                            <IncidentTimeline
                                currentTime={currentTime}
                                duration={duration}
                                onSeek={handleSeek}
                                events={events}
                                onAddEvent={handleAddEvent}
                                onRemoveEvent={handleRemoveEvent}
                                onUpdateEvent={handleUpdateEvent}
                                tracks={uniqueTracks}
                                playbackSpeed={playbackSpeed}
                                onPlaybackSpeedChange={handlePlaybackSpeedChange}
                            />
                            <Controls
                                isPlaying={isPlaying}
                                onTogglePlay={togglePlay}
                                currentTime={currentTime}
                                duration={duration}
                                onSeek={handleSeek}
                                minConfidence={minConfidence}
                                onConfidenceChange={setMinConfidence}
                            />
                        </div>
                    </div>
                )}
            </div>

            <TrackSidebar
                tracks={uniqueTracks}
                onRename={(track) => renameTrack(track.id, track.class)}
                onSeek={handleSeek}
                currentTime={currentTime}
                metadata={metadata}
                onMetadataUpdate={handleMetadataUpdate}
                onMetadataSave={handleMetadataSave}
                onExportReport={handleExportReport}
                isSaving={isSaving}
                lastSaved={lastSaved}
            />

            {/* Keyboard Shortcuts Help Modal */}
            {showShortcutsHelp && (
                <KeyboardShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
            )}
        </div>
    );
}
