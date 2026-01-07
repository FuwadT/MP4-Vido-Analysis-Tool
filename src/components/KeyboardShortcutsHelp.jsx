import React from 'react';
import { X, Keyboard } from 'lucide-react';

export function KeyboardShortcutsHelp({ onClose }) {
    const shortcuts = [
        {
            category: 'Playback',
            items: [
                { keys: ['Space'], description: 'Play / Pause' },
                { keys: ['→'], description: 'Forward 0.1s (1 frame)' },
                { keys: ['←'], description: 'Backward 0.1s (1 frame)' },
                { keys: ['Shift', '→'], description: 'Forward 1 second' },
                { keys: ['Shift', '←'], description: 'Backward 1 second' },
                { keys: ['Home'], description: 'Jump to start' },
                { keys: ['End'], description: 'Jump to end' },
                { keys: ['+'], description: 'Increase playback speed' },
                { keys: ['-'], description: 'Decrease playback speed' },
                { keys: ['0'], description: 'Reset to 1x speed' },
            ]
        },
        {
            category: 'Event Markers',
            items: [
                { keys: ['M'], description: 'Add marker at current time' },
                { keys: ['1'], description: 'Quick add: Collision' },
                { keys: ['2'], description: 'Quick add: Near Miss' },
                { keys: ['3'], description: 'Quick add: Hard Brake' },
                { keys: ['4'], description: 'Quick add: Detection' },
                { keys: ['5'], description: 'Quick add: Pedestrian' },
                { keys: ['6'], description: 'Quick add: System Event' },
                { keys: ['7'], description: 'Quick add: Custom' },
                { keys: ['Ctrl', '→'], description: 'Next event marker' },
                { keys: ['Ctrl', '←'], description: 'Previous event marker' },
                { keys: ['Delete'], description: 'Remove selected event' },
            ]
        },
        {
            category: 'Navigation',
            items: [
                { keys: ['Tab'], description: 'Switch Tracks/Metadata tabs' },
                { keys: ['Ctrl', 'S'], description: 'Save metadata' },
                { keys: ['Ctrl', 'E'], description: 'Export report' },
                { keys: ['?'], description: 'Show this help' },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Keyboard size={24} className="text-blue-400" />
                        <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {shortcuts.map((section) => (
                        <div key={section.category}>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded hover:bg-gray-900 transition-colors"
                                    >
                                        <span className="text-sm text-gray-300">{item.description}</span>
                                        <div className="flex items-center gap-1">
                                            {item.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    {keyIdx > 0 && (
                                                        <span className="text-xs text-gray-500 mx-1">+</span>
                                                    )}
                                                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-700 text-white rounded border border-gray-600 shadow-sm min-w-[2rem] text-center">
                                                        {key}
                                                    </kbd>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-900 p-4 border-t border-gray-700 text-center">
                    <p className="text-xs text-gray-400">
                        Press <kbd className="px-2 py-0.5 bg-gray-700 rounded text-white">?</kbd> anytime to show this help
                    </p>
                </div>
            </div>
        </div>
    );
}
