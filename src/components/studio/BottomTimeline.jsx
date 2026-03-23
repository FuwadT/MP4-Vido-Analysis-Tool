import React from 'react';
import { Bookmark, Clock3, ShieldAlert } from 'lucide-react';
import { PanelCard } from './PanelCard';

export function BottomTimeline({ scenario, runs }) {
  const timelineEvents = scenario?.events || [];
  const recentRuns = runs.slice(0, 3);

  return (
    <PanelCard
      eyebrow="Timeline"
      title="Playback, bookmarks, and failures"
      subtitle="This rail is shared across the studio so operators can jump from logged events to scenario variants and validation findings."
      className="mt-4"
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
            <Clock3 size={14} />
            Event strip
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {timelineEvents.map((event) => (
              <div key={event.id} className="min-w-[180px] rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-sm font-semibold text-slate-100">{event.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {event.startTimeSeconds.toFixed(1)}s - {event.endTimeSeconds.toFixed(1)}s
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[24px] border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              <Bookmark size={14} />
              Bookmarks
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">Jump to cut-in onset</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">Open counterfactual dusk-rain variant</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              <ShieldAlert size={14} />
              Recent failures
            </div>
            <div className="mt-3 space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="text-sm font-semibold text-slate-100">{run.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{run.status} / {run.findings.length} findings</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}
