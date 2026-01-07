import React from 'react';
import { Check, Loader } from 'lucide-react';

export function AutoSaveIndicator({ isSaving, lastSaved }) {
    const formatRelativeTime = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 10) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    if (isSaving) {
        return (
            <div className="flex items-center gap-2 text-xs text-blue-400">
                <Loader className="animate-spin" size={12} />
                Saving...
            </div>
        );
    }

    if (lastSaved) {
        return (
            <div className="flex items-center gap-2 text-xs text-gray-400">
                <Check size={12} className="text-green-500" />
                Saved {formatRelativeTime(lastSaved)}
            </div>
        );
    }

    return null;
}
