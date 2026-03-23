function resolveApiUrl(path) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }

  return path;
}

async function fetchJson(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Studio API request failed (${response.status}).`;

    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parsing failure and use the default message.
    }

    throw new Error(message);
  }

  return response.json();
}

export function getStudioBootstrap() {
  return fetchJson('/api/studio/bootstrap');
}

export function searchStudio(query) {
  return fetchJson(`/api/studio/search?q=${encodeURIComponent(query)}`);
}

export function createStudioRun(payload) {
  return fetchJson('/api/studio/runs', { method: 'POST', body: payload });
}

export function updateStudioRun(runId, patch) {
  return fetchJson(`/api/studio/runs/${encodeURIComponent(runId)}`, { method: 'PATCH', body: patch });
}

export function createStudioFinding(payload) {
  return fetchJson('/api/studio/findings', { method: 'POST', body: payload });
}

export function updateStudioFinding(findingId, patch) {
  return fetchJson(`/api/studio/findings/${encodeURIComponent(findingId)}`, { method: 'PATCH', body: patch });
}

export function saveStudioScenario(payload) {
  return fetchJson('/api/studio/scenarios', { method: 'POST', body: payload });
}

export function updateStudioScenario(scenarioId, patch) {
  return fetchJson(`/api/studio/scenarios/${encodeURIComponent(scenarioId)}`, { method: 'PATCH', body: patch });
}

export function duplicateStudioScenario(scenarioId) {
  return fetchJson(`/api/studio/scenarios/${encodeURIComponent(scenarioId)}/duplicate`, { method: 'POST', body: {} });
}

export function createScenarioVariant(scenarioId, payload) {
  return fetchJson(`/api/studio/scenarios/${encodeURIComponent(scenarioId)}/variants`, { method: 'POST', body: payload });
}

export function extractScenarioFromReplay(payload) {
  return fetchJson('/api/studio/scenarios/extract', { method: 'POST', body: payload });
}

export function saveStudioLayout(payload) {
  return fetchJson('/api/studio/layouts', { method: 'POST', body: payload });
}

export function updateStudioLayout(layoutId, patch) {
  return fetchJson(`/api/studio/layouts/${encodeURIComponent(layoutId)}`, { method: 'PATCH', body: patch });
}

export function createBookmark(payload) {
  return fetchJson('/api/studio/bookmarks', { method: 'POST', body: payload });
}

export function saveValidationSuite(payload) {
  return fetchJson('/api/studio/validation/suites', { method: 'POST', body: payload });
}

export function updateValidationSuite(suiteId, patch) {
  return fetchJson(`/api/studio/validation/suites/${encodeURIComponent(suiteId)}`, { method: 'PATCH', body: patch });
}

export function getValidationSummary() {
  return fetchJson('/api/studio/validation/summary');
}

export function getCompareSummary(leftRunId, rightRunId) {
  const params = new URLSearchParams();
  params.set('leftRunId', leftRunId);
  params.set('rightRunId', rightRunId);
  return fetchJson(`/api/studio/compare?${params.toString()}`);
}

export function getValidationReportJson() {
  return fetchJson('/api/studio/validation/report.json');
}

export function getValidationReportHtmlUrl() {
  return resolveApiUrl('/api/studio/validation/report.html');
}
