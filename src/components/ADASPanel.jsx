import React, { useMemo, memo } from 'react';
import { TriangleAlert, Eye, Shield, Zap, CarFront, Users, Activity } from 'lucide-react';

const EVENT_CONFIG = {
    PROXIMITY_VEHICLE: { label: 'Close Following', icon: CarFront, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    VRU_COLLISION_RISK: { label: 'Collision Risk', icon: TriangleAlert, color: 'text-red-400', bg: 'bg-red-900/30' },
    VRU_PROXIMITY: { label: 'VRU Proximity', icon: Users, color: 'text-orange-400', bg: 'bg-orange-900/30' },
    TRAFFIC_LIGHT_CHANGE: { label: 'Traffic Light', icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
    HIGH_DENSITY: { label: 'High Density', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    NEW_OBJECT: { label: 'New Detection', icon: Zap, color: 'text-green-400', bg: 'bg-green-900/30' },
};

function formatTime(t) {
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}.${Math.round((t % 1) * 10)}`;
}

export const ADASPanel = memo(function ADASPanel({ events = [], onSeek }) {
    const adasEvents = useMemo(() => events.filter(e => e.adasType), [events]);

    const stats = useMemo(() => {
        const counts = {};
        for (const e of adasEvents) counts[e.adasType] = (counts[e.adasType] || 0) + 1;
        return counts;
    }, [adasEvents]);

    const riskScore = useMemo(() => {
        let score = 0;
        for (const e of adasEvents) {
            if (e.severity === 'critical') score += 15;
            else if (e.severity === 'warning') score += 5;
            else score += 1;
        }
        return Math.min(100, score);
    }, [adasEvents]);

    const riskColor = riskScore > 70 ? 'text-red-400' : riskScore > 30 ? 'text-yellow-400' : 'text-green-400';
    const riskLabel = riskScore > 70 ? 'HIGH RISK' : riskScore > 30 ? 'MODERATE' : 'LOW RISK';
    const riskBarColor = riskScore > 70 ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : riskScore > 30 ? 'bg-yellow-500 shadow-[0_0_6px_#eab308]' : 'bg-green-500 shadow-[0_0_6px_#22c55e]';

    const criticalCount = adasEvents.filter(e => e.severity === 'critical').length;
    const warningCount = adasEvents.filter(e => e.severity === 'warning').length;

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 bg-gray-800/50 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${riskColor}`} />
                        <span className="text-sm font-bold text-gray-300">ADAS RISK SCORE</span>
                    </div>
                    <span className={`text-2xl font-mono font-bold ${riskColor}`}>{riskScore}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold tracking-wider ${riskColor}`}>{riskLabel}</span>
                    <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 rounded-full ${riskBarColor}`} style={{ width: `${riskScore}%` }} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-700">
                <div className="text-center p-2 bg-red-900/20 rounded">
                    <div className="text-lg font-bold text-red-400">{criticalCount}</div>
                    <div className="text-[10px] text-red-400/70 uppercase tracking-wider">Critical</div>
                </div>
                <div className="text-center p-2 bg-yellow-900/20 rounded">
                    <div className="text-lg font-bold text-yellow-400">{warningCount}</div>
                    <div className="text-[10px] text-yellow-400/70 uppercase tracking-wider">Warning</div>
                </div>
                <div className="text-center p-2 bg-blue-900/20 rounded">
                    <div className="text-lg font-bold text-blue-400">{adasEvents.length}</div>
                    <div className="text-[10px] text-blue-400/70 uppercase tracking-wider">Total</div>
                </div>
            </div>

            <div className="p-3 border-b border-gray-700 space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Breakdown</div>
                {adasEvents.length === 0 ? (
                    <div className="text-center text-gray-500 text-xs py-4">
                        No events yet. Run analysis to generate events.
                    </div>
                ) : (
                    Object.entries(EVENT_CONFIG).map(([type, cfg]) => {
                        const count = stats[type] || 0;
                        if (count === 0) return null;
                        const Icon = cfg.icon;
                        return (
                            <div key={type} className={`flex items-center justify-between px-2 py-1.5 rounded ${cfg.bg}`}>
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                    <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                                </div>
                                <span className={`text-xs font-mono font-bold ${cfg.color}`}>{count}</span>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2 px-1">Event Log</div>
                {adasEvents.length === 0 ? (
                    <div className="text-center text-gray-600 text-xs mt-6">-</div>
                ) : (
                    [...adasEvents].sort((a, b) => a.time - b.time).map((event, idx) => {
                        const cfg = EVENT_CONFIG[event.adasType] || EVENT_CONFIG.NEW_OBJECT;
                        const Icon = cfg.icon;
                        return (
                            <button
                                key={idx}
                                onClick={() => onSeek?.(event.time)}
                                className="w-full text-left px-2 py-2 rounded hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-600 flex items-start gap-2"
                            >
                                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                                        <span className="text-[10px] text-gray-500 font-mono">{formatTime(event.time)}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate">{event.note}</div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
});
