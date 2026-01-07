import React, { useState, useRef, useEffect } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Zap, 
  Car, 
  Users, 
  StopCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  X
} from 'lucide-react';

const EVENT_TYPES = {
  COLLISION: { label: 'Collision', icon: AlertTriangle, color: 'bg-red-500', severity: 'critical' },
  NEAR_MISS: { label: 'Near Miss', icon: AlertCircle, color: 'bg-orange-500', severity: 'warning' },
  HARD_BRAKE: { label: 'Hard Brake', icon: StopCircle, color: 'bg-yellow-500', severity: 'warning' },
  DETECTION: { label: 'Object Detection', icon: Car, color: 'bg-blue-500', severity: 'info' },
  PEDESTRIAN: { label: 'Pedestrian', icon: Users, color: 'bg-purple-500', severity: 'warning' },
  SYSTEM_EVENT: { label: 'System Event', icon: Zap, color: 'bg-green-500', severity: 'info' },
  CUSTOM: { label: 'Custom', icon: Info, color: 'bg-gray-500', severity: 'info' }
};

export function IncidentTimeline({ 
  currentTime, 
  duration, 
  onSeek, 
  events = [],
  onAddEvent,
  onRemoveEvent,
  onUpdateEvent,
  tracks = [],
  playbackSpeed = 1,
  onPlaybackSpeedChange
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventType, setNewEventType] = useState('DETECTION');
  const [newEventNote, setNewEventNote] = useState('');
  const timelineRef = useRef(null);

  // Format time as MM:SS.ms
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms}`;
  };

  // Calculate position percentage
  const getPositionPercent = (time) => {
    return (time / duration) * 100;
  };

  // Handle click on timeline to seek
  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    onSeek(newTime);
  };

  // Add event at current time
  const handleAddEvent = () => {
    if (onAddEvent) {
      onAddEvent({
        id: Date.now(),
        type: newEventType,
        time: currentTime,
        note: newEventNote || EVENT_TYPES[newEventType].label,
        severity: EVENT_TYPES[newEventType].severity
      });
      setNewEventNote('');
      setShowAddEvent(false);
    }
  };

  // Quick jump to critical moments
  const jumpToFirstDetection = () => {
    const firstDetection = events.find(e => e.type === 'DETECTION');
    if (firstDetection) onSeek(firstDetection.time);
  };

  const jumpToClosestApproach = () => {
    // Find event with highest severity or closest to collision
    const criticalEvent = events
      .filter(e => e.severity === 'critical' || e.severity === 'warning')
      .sort((a, b) => a.time - b.time)[0];
    if (criticalEvent) onSeek(criticalEvent.time);
  };

  const jumpToNextEvent = () => {
    const nextEvent = events.find(e => e.time > currentTime + 0.1);
    if (nextEvent) onSeek(nextEvent.time);
  };

  const jumpToPrevEvent = () => {
    const prevEvents = events.filter(e => e.time < currentTime - 0.1);
    const prevEvent = prevEvents[prevEvents.length - 1];
    if (prevEvent) onSeek(prevEvent.time);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 p-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Incident Timeline
          </h3>
          <span className="text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback Speed Control */}
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded">
            <span className="text-xs text-gray-400">Speed:</span>
            {[0.25, 0.5, 1, 2].map(speed => (
              <button
                key={speed}
                onClick={() => onPlaybackSpeedChange && onPlaybackSpeedChange(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Add Event Button */}
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            title="Add event marker"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Add Event Form */}
          {showAddEvent && (
            <div className="bg-gray-750 p-3 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
                >
                  {Object.entries(EVENT_TYPES).map(([key, type]) => (
                    <option key={key} value={key}>{type.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newEventNote}
                  onChange={(e) => setNewEventNote(e.target.value)}
                  placeholder="Event note (optional)"
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500"
                />
                <button
                  onClick={handleAddEvent}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors"
                >
                  Add at {formatTime(currentTime)}
                </button>
                <button
                  onClick={() => setShowAddEvent(false)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Quick Jump Buttons */}
          <div className="p-3 bg-gray-750 border-b border-gray-700 flex gap-2 flex-wrap">
            <button
              onClick={jumpToPrevEvent}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
              disabled={!events.some(e => e.time < currentTime - 0.1)}
            >
              ← Previous Event
            </button>
            <button
              onClick={jumpToNextEvent}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
              disabled={!events.some(e => e.time > currentTime + 0.1)}
            >
              Next Event →
            </button>
            <button
              onClick={jumpToFirstDetection}
              className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white transition-colors"
              disabled={!events.some(e => e.type === 'DETECTION')}
            >
              First Detection
            </button>
            <button
              onClick={jumpToClosestApproach}
              className="px-3 py-1 bg-orange-700 hover:bg-orange-600 rounded text-xs text-white transition-colors"
              disabled={!events.some(e => e.severity === 'critical' || e.severity === 'warning')}
            >
              Critical Moment
            </button>
          </div>

          {/* Timeline Visualization */}
          <div className="p-4">
            <div className="relative">
              {/* Time labels */}
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>0:00</span>
                <span>{formatTime(duration / 2)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Timeline bar */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-12 bg-gray-700 rounded-lg cursor-pointer overflow-visible"
              >
                {/* Progress bar */}
                <div
                  className="absolute top-0 left-0 h-full bg-blue-600 opacity-30 rounded-l-lg transition-all"
                  style={{ width: `${getPositionPercent(currentTime)}%` }}
                />

                {/* Event markers */}
                {events.map((event) => {
                  const EventIcon = EVENT_TYPES[event.type]?.icon || Info;
                  const eventColor = EVENT_TYPES[event.type]?.color || 'bg-gray-500';
                  
                  return (
                    <div
                      key={event.id}
                      className="absolute top-0 h-full flex items-center"
                      style={{ left: `${getPositionPercent(event.time)}%` }}
                    >
                      <div className="relative group">
                        <div className={`${eventColor} p-1.5 rounded-full shadow-lg border-2 border-gray-800 cursor-pointer hover:scale-110 transition-transform`}>
                          <EventIcon size={14} className="text-white" />
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-xl border border-gray-700">
                            <div className="font-bold">{event.note}</div>
                            <div className="text-gray-400">{formatTime(event.time)}</div>
                            {onRemoveEvent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveEvent(event.id);
                                }}
                                className="mt-1 text-red-400 hover:text-red-300 text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
                  style={{ left: `${getPositionPercent(currentTime)}%` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-3 h-3 bg-white rounded-full border-2 border-gray-800" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-3 bg-white rounded-full border-2 border-gray-800" />
                </div>
              </div>

              {/* Time ticks */}
              <div className="relative h-2 mt-1">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 w-px h-2 bg-gray-600"
                    style={{ left: `${i * 10}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Event List */}
          {events.length > 0 && (
            <div className="p-3 bg-gray-750 border-t border-gray-700 max-h-40 overflow-y-auto">
              <div className="text-xs text-gray-400 uppercase font-bold mb-2">Events</div>
              <div className="space-y-1">
                {events
                  .sort((a, b) => a.time - b.time)
                  .map((event) => {
                    const EventIcon = EVENT_TYPES[event.type]?.icon || Info;
                    const eventColor = EVENT_TYPES[event.type]?.color || 'bg-gray-500';
                    
                    return (
                      <div
                        key={event.id}
                        onClick={() => onSeek(event.time)}
                        className="flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                      >
                        <div className={`${eventColor} p-1 rounded`}>
                          <EventIcon size={12} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">{event.note}</div>
                          <div className="text-xs text-gray-400">{formatTime(event.time)}</div>
                        </div>
                        {onRemoveEvent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveEvent(event.id);
                            }}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                          >
                            <X size={12} className="text-gray-400" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
