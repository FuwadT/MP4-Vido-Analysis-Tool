import React, { memo, useMemo, useState } from 'react';
import { Database, Download, Tags, Target } from 'lucide-react';
import { formatTimestampMicros } from '../utils/waymo/normalize';

function tagsToString(tags) {
    return Array.isArray(tags) ? tags.join(', ') : '';
}

export const WaymoAnnotationsSidebar = memo(function WaymoAnnotationsSidebar({
    segmentId,
    availableComponents,
    stats,
    currentObjects,
    objectCatalog,
    selectedObject,
    annotation,
    onSelectObject,
    onUpdateAnnotation,
    onExportAnnotations,
    frameTimestamp
}) {
    const [searchQuery, setSearchQuery] = useState('');

    const visibleObjects = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return currentObjects;
        }

        return currentObjects.filter((item) => {
            return item.objectId.toLowerCase().includes(query) || item.label.toLowerCase().includes(query);
        });
    }, [currentObjects, searchQuery]);

    return (
        <aside className="w-[360px] min-w-[320px] border-l border-slate-800 bg-slate-950/95 flex flex-col">
            <div className="p-4 border-b border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-400">Waymo Segment</div>
                        <div className="text-sm font-semibold text-slate-100 break-all">{segmentId || 'No segment selected'}</div>
                        <div className="text-xs text-slate-400 mt-1">
                            {frameTimestamp ? `Timestamp ${formatTimestampMicros(frameTimestamp)}` : 'No frame loaded'}
                        </div>
                    </div>
                    <button
                        onClick={onExportAnnotations}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                    >
                        <Download size={14} />
                        Export
                    </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300 space-y-2">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold">
                        <Database size={14} />
                        Components
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {availableComponents.map((component) => (
                            <span key={component} className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
                                {component}
                            </span>
                        ))}
                    </div>
                </div>

                {stats && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300 space-y-2">
                        <div className="text-slate-100 font-semibold">Segment Metadata</div>
                        <div>Time of day: {stats.timeOfDay}</div>
                        <div>Weather: {stats.weather}</div>
                        <div>Location: {stats.location}</div>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-4 border-b border-slate-800 space-y-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Filter current frame objects"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="text-xs text-slate-400">
                        Frame objects: {currentObjects.length} | Catalog size: {objectCatalog.length}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-3 space-y-2">
                        {visibleObjects.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500 text-center">
                                No objects available for this frame.
                            </div>
                        ) : visibleObjects.map((item) => {
                            const isActive = selectedObject?.annotationKey === item.annotationKey;
                            return (
                                <button
                                    key={item.annotationKey}
                                    onClick={() => onSelectObject?.(item.annotationKey)}
                                    className={`w-full text-left rounded-2xl border px-3 py-3 transition-colors ${isActive ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/70 hover:bg-slate-900'}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="font-semibold text-slate-100 truncate">{item.label}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-400 truncate">{item.objectId}</span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        {item.tags.length > 0 ? item.tags.join(', ') : 'No tags yet'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-800 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <Target size={16} />
                    Annotation Editor
                </div>

                {selectedObject ? (
                    <>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300 space-y-2">
                            <div className="text-slate-100 font-semibold">{selectedObject.label}</div>
                            <div>ID: {selectedObject.objectId}</div>
                            <div>Status: {annotation?.status || 'unreviewed'}</div>
                        </div>

                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Review status</span>
                            <select
                                value={annotation?.status || 'unreviewed'}
                                onChange={(event) => onUpdateAnnotation?.({ status: event.target.value })}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                            >
                                <option value="unreviewed">Unreviewed</option>
                                <option value="validated">Validated</option>
                                <option value="needs-follow-up">Needs Follow-up</option>
                                <option value="ignore">Ignore</option>
                            </select>
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Tags</span>
                            <div className="relative">
                                <Tags size={14} className="absolute left-3 top-3 text-slate-500" />
                                <input
                                    type="text"
                                    value={tagsToString(annotation?.tags)}
                                    onChange={(event) => onUpdateAnnotation?.({
                                        tags: event.target.value
                                            .split(',')
                                            .map(tag => tag.trim())
                                            .filter(Boolean)
                                    })}
                                    placeholder="vehicle, occluded, edge-case"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs text-slate-400">Notes</span>
                            <textarea
                                value={annotation?.notes || ''}
                                onChange={(event) => onUpdateAnnotation?.({ notes: event.target.value })}
                                rows={4}
                                placeholder="Add review notes for this object or frame."
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                            />
                        </label>
                    </>
                ) : (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500 text-center">
                        Select an object in the current frame to tag it.
                    </div>
                )}
            </div>
        </aside>
    );
});
