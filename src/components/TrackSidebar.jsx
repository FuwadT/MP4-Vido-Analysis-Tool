import React, { useState, useMemo, memo } from 'react';
import { Search, Filter, ArrowUpDown, Clock, Activity, Target, FileText } from 'lucide-react';
import { MetadataPanel } from './MetadataPanel';

export const TrackSidebar = memo(function TrackSidebar({ tracks, onRename, onSeek, metadata, onMetadataUpdate, onMetadataSave, onExportReport, isSaving, lastSaved }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('id'); // 'id', 'time', 'conf', 'class'
    const [filterClass, setFilterClass] = useState('All');
    const [activeTab, setActiveTab] = useState('tracks'); // 'tracks' or 'metadata'

    // Derived unique classes for filter dropdown
    const availableClasses = useMemo(() => {
        const classes = new Set(tracks.map(t => t.class));
        return ['All', ...Array.from(classes).sort()];
    }, [tracks]);

    // Filter and Sort Logic
    const displayedTracks = useMemo(() => {
        let result = [...tracks];

        // Filter by Class
        if (filterClass !== 'All') {
            result = result.filter(t => t.class === filterClass);
        }

        // Filter by Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.class.toLowerCase().includes(q) ||
                t.id.toString().includes(q)
            );
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'time') return a.firstSeen - b.firstSeen;
            if (sortBy === 'conf') return b.maxScore - a.maxScore;
            if (sortBy === 'class') return a.class.localeCompare(b.class);
            return a.id - b.id; // default ID
        });

        return result;
    }, [tracks, filterClass, searchQuery, sortBy]);

    return (
        <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
            {/* Header with Tabs */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div role="tablist" className="flex border-b border-gray-700">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'tracks'}
                        aria-label="Tracks Tab"
                        onClick={() => setActiveTab('tracks')}
                        className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'tracks'
                            ? 'bg-gray-900 text-white border-b-2 border-purple-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-750'
                            }`}
                    >
                        <Activity className="w-4 h-4" aria-hidden="true" />
                        Tracks
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full" aria-label={`${tracks.length} tracks`}>
                            {tracks.length}
                        </span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'metadata'}
                        aria-label="Metadata Tab"
                        onClick={() => setActiveTab('metadata')}
                        className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'metadata'
                            ? 'bg-gray-900 text-white border-b-2 border-purple-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-750'
                            }`}
                    >
                        <FileText className="w-4 h-4" aria-hidden="true" />
                        Metadata
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'tracks' ? (
                <>
                    {/* Controls */}
                    <div className="p-3 space-y-3 bg-gray-900/50">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Search tracks..."
                                aria-label="Search tracks"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            {/* Sort */}
                            <div className="relative flex-1">
                                <ArrowUpDown className="absolute left-2 top-2.5 w-3 h-3 text-gray-500" aria-hidden="true" />
                                <select
                                    aria-label="Sort tracks"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-2 py-2 text-xs text-gray-300 focus:outline-none appearance-none cursor-pointer hover:bg-gray-750"
                                >
                                    <option value="id">Sort: ID</option>
                                    <option value="time">Sort: Time</option>
                                    <option value="conf">Sort: Prob %</option>
                                    <option value="class">Sort: Name</option>
                                </select>
                            </div>

                            {/* Filter */}
                            <div className="relative flex-1">
                                <Filter className="absolute left-2 top-2.5 w-3 h-3 text-gray-500" aria-hidden="true" />
                                <select
                                    aria-label="Filter by class"
                                    value={filterClass}
                                    onChange={(e) => setFilterClass(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-2 py-2 text-xs text-gray-300 focus:outline-none appearance-none cursor-pointer hover:bg-gray-750"
                                >
                                    {availableClasses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2" role="list">
                        {displayedTracks.length === 0 ? (
                            <div className="text-center text-gray-500 text-sm mt-10">
                                No tracks found.
                            </div>
                        ) : (
                            displayedTracks.map(track => (
                                <div
                                    key={track.id}
                                    role="listitem"
                                    className="bg-gray-800/80 hover:bg-gray-700 p-3 rounded-lg group transition-all border border-transparent hover:border-gray-600"
                                >
                                    {/* Top Row: Color, ID, Class, Edit */}
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: track.color, boxShadow: `0 0 8px ${track.color}` }}></div>
                                            <span className="font-mono text-xs text-gray-400">#{track.id}</span>
                                            <span className="font-bold text-gray-100 text-sm">{track.class}</span>
                                        </div>
                                        <button
                                            aria-label={`Rename track ${track.id}`}
                                            onClick={() => onRename(track)}
                                            className="text-[10px] bg-gray-900 border border-gray-600 hover:bg-blue-600 hover:border-blue-500 text-gray-300 hover:text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                        >
                                            EDIT
                                        </button>
                                    </div>

                                    {/* Bottom Row: Metadata (Time, Score) with Seek Action */}
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Jump to track at ${track.firstSeen?.toFixed(1)} seconds`}
                                        className="flex justify-between items-center text-xs text-gray-400 bg-gray-900/50 p-2 rounded cursor-pointer hover:bg-gray-900 hover:text-purple-300 transition-colors"
                                        onClick={() => onSeek(track.firstSeen)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                onSeek(track.firstSeen);
                                            }
                                        }}
                                        title="Click to jump to this moment"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" aria-hidden="true" />
                                            <span>{track.firstSeen?.toFixed(1) || '0.0'}s</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Target className="w-3 h-3" aria-hidden="true" />
                                            <span>{Math.round((track.maxScore || track.score) * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-y-auto p-3">
                    <MetadataPanel
                        metadata={metadata}
                        onUpdate={onMetadataUpdate}
                        onSave={onMetadataSave}
                        onExportReport={onExportReport}
                        isSaving={isSaving}
                        lastSaved={lastSaved}
                    />
                </div>
            )}
        </div>
    );
});
