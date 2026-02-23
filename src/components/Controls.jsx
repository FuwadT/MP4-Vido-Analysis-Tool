import React, { memo } from 'react';
import { Play, Pause, Square } from 'lucide-react';

export const Controls = memo(function Controls({ isPlaying, onTogglePlay, currentTime, duration, onSeek, minConfidence, onConfidenceChange }) {
    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} `;
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex items-center gap-4">
            <button
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors text-white"
            >
                {isPlaying ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>

            <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10 text-right" aria-label="Current time">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    aria-label="Seek video"
                    aria-valuemin="0"
                    aria-valuemax={duration || 100}
                    aria-valuenow={currentTime}
                    aria-valuetext={formatTime(currentTime)}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-xs text-gray-400 w-10" aria-label="Total duration">{formatTime(duration)}</span>
            </div>

            <div className="flex flex-col w-32 ml-4">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Confidence</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={(minConfidence || 0.5) * 100}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={(minConfidence || 0.5) * 100}
                        aria-valuetext={`${Math.round((minConfidence || 0.5) * 100)}%`}
                        onChange={(e) => onConfidenceChange && onConfidenceChange(parseFloat(e.target.value) / 100)}
                        className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-xs text-green-400 w-8">{Math.round((minConfidence || 0.5) * 100)}%</span>
                </div>
            </div>
        </div>
    );
});
