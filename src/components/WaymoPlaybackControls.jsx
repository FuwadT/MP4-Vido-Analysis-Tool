import React, { memo } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

export const WaymoPlaybackControls = memo(function WaymoPlaybackControls({
    currentFrameIndex,
    totalFrames,
    isPlaying,
    onSeek,
    onTogglePlay,
    onStep
}) {
    return (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onStep?.(-1)}
                    className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100"
                    aria-label="Previous frame"
                >
                    <SkipBack size={18} />
                </button>
                <button
                    onClick={onTogglePlay}
                    className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                    aria-label={isPlaying ? 'Pause dataset playback' : 'Play dataset playback'}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                    onClick={() => onStep?.(1)}
                    className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100"
                    aria-label="Next frame"
                >
                    <SkipForward size={18} />
                </button>
            </div>

            <div className="flex-1 min-w-[240px] flex items-center gap-3">
                <span className="text-xs text-slate-400 w-24 text-right">
                    Frame {currentFrameIndex + 1}
                </span>
                <input
                    type="range"
                    min="0"
                    max={Math.max(totalFrames - 1, 0)}
                    step="1"
                    value={Math.min(currentFrameIndex, Math.max(totalFrames - 1, 0))}
                    onChange={(event) => onSeek?.(Number(event.target.value))}
                    className="flex-1 h-1 rounded-lg appearance-none bg-slate-700 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400"
                    aria-label="Seek frame"
                />
                <span className="text-xs text-slate-400 w-20">{totalFrames} total</span>
            </div>
        </div>
    );
});
