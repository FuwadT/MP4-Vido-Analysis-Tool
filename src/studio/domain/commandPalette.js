function scoreMatch(label, query) {
  const safeLabel = String(label || '').toLowerCase();
  const safeQuery = String(query || '').toLowerCase().trim();

  if (!safeQuery) {
    return 0;
  }

  if (safeLabel === safeQuery) {
    return 100;
  }

  if (safeLabel.startsWith(safeQuery)) {
    return 80;
  }

  if (safeLabel.includes(safeQuery)) {
    return 60;
  }

  return 0;
}

function pushMatches(target, items, type, mapItem, query) {
  for (const item of items || []) {
    const mapped = mapItem(item);
    const score = Math.max(
      scoreMatch(mapped.label, query),
      scoreMatch(mapped.subtitle, query),
      ...(mapped.tags || []).map((tag) => scoreMatch(tag, query))
    );

    if (!query || score > 0) {
      target.push({
        ...mapped,
        type,
        score
      });
    }
  }
}

export function searchStudioResources(resources, query = '') {
  const results = [];

  pushMatches(results, resources.datasetAssets, 'dataset', (item) => ({
    id: item.id,
    label: item.name,
    subtitle: `${item.sourceType} / ${item.split}`,
    tags: item.tags,
    action: { kind: 'open-dataset', id: item.id }
  }), query);

  pushMatches(results, resources.scenarios, 'scenario', (item) => ({
    id: item.id,
    label: item.name,
    subtitle: `${item.family} / ${item.tags.slice(0, 3).join(', ')}`,
    tags: item.tags,
    action: { kind: 'open-scenario', id: item.id }
  }), query);

  pushMatches(results, resources.runs, 'run', (item) => ({
    id: item.id,
    label: item.label,
    subtitle: `${item.status} / ${item.buildAlias} / ${item.modelAlias}`,
    tags: item.oddSlices,
    action: { kind: 'open-run', id: item.id }
  }), query);

  pushMatches(results, resources.findings, 'finding', (item) => ({
    id: item.id,
    label: item.title,
    subtitle: `${item.severity} / ${item.status}`,
    tags: item.tags,
    action: { kind: 'open-finding', id: item.id }
  }), query);

  pushMatches(results, resources.layouts, 'layout', (item) => ({
    id: item.id,
    label: item.name,
    subtitle: item.description,
    tags: [item.optimizedFor].filter(Boolean),
    action: { kind: 'select-layout', id: item.id }
  }), query);

  pushMatches(results, resources.actions, 'action', (item) => ({
    id: item.id,
    label: item.label,
    subtitle: item.description,
    tags: item.tags,
    action: item.action
  }), query);

  return results
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 18);
}
