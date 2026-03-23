import React from 'react';
import clsx from 'clsx';

function orderPanels(panels, panelOrder = []) {
  if (!Array.isArray(panelOrder) || panelOrder.length === 0) {
    return panels;
  }

  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const ordered = panelOrder
    .map((panelId) => byId.get(panelId))
    .filter(Boolean);
  const remaining = panels.filter((panel) => !panelOrder.includes(panel.id));

  return [...ordered, ...remaining];
}

export function WorkspaceGrid({ layout, panels, onReorder }) {
  const orderedPanels = orderPanels(panels, layout?.panelOrder);

  const handleDrop = (event, targetId) => {
    if (!onReorder) {
      return;
    }

    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/panel-id');
    if (!sourceId || sourceId === targetId) {
      return;
    }

    const nextOrder = orderedPanels.map((panel) => panel.id);
    const sourceIndex = nextOrder.indexOf(sourceId);
    const targetIndex = nextOrder.indexOf(targetId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, sourceId);
    onReorder(nextOrder);
  };

  return (
    <div className={clsx(layout?.gridClassName || 'grid grid-cols-1 gap-4 xl:grid-cols-12')}>
      {orderedPanels.map((panel) => (
        <div
          key={panel.id}
          className={clsx(layout?.slots?.[panel.slot] || panel.className || 'xl:col-span-6')}
          draggable={Boolean(onReorder)}
          onDragStart={(event) => {
            if (!onReorder) {
              return;
            }

            event.dataTransfer.setData('text/panel-id', panel.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(event) => {
            if (onReorder) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => handleDrop(event, panel.id)}
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
}
