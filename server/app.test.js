import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startStudioServer } from './app.mjs';

async function fetchJson(baseUrl, relativePath, options = {}) {
  const response = await fetch(`${baseUrl}${relativePath}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  return { response, payload };
}

describe('studio api', () => {
  let serverHandle;
  let baseUrl = '';

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adas-studio-'));
    serverHandle = await startStudioServer({
      configOverrides: {
        port: 0,
        studioStoreFile: path.join(tempDir, 'studio-store.json'),
        localManifestDir: path.join(tempDir, 'cloud-manifests'),
        localDataRoot: ''
      },
      serveStatic: false
    });
    baseUrl = `http://127.0.0.1:${serverHandle.port}`;
  });

  afterAll(async () => {
    await serverHandle?.close();
  });

  it('creates findings and persists them through bootstrap', async () => {
    const { response } = await fetchJson(baseUrl, '/api/studio/findings', {
      method: 'POST',
      body: {
        title: 'Operator finding',
        description: 'Created in api test.',
        severity: 'medium',
        linkedScenarioId: 'scenario-urban-cut-in'
      }
    });

    expect(response.ok).toBe(true);

    const { payload } = await fetchJson(baseUrl, '/api/studio/bootstrap');
    expect(payload.studio.findings.some((finding) => finding.title === 'Operator finding')).toBe(true);
  });

  it('creates and updates runs with persisted status', async () => {
    const created = await fetchJson(baseUrl, '/api/studio/runs', {
      method: 'POST',
      body: {
        label: 'API test run',
        runType: 'exploratory',
        scenarioId: 'scenario-urban-cut-in',
        scenarioVariantId: 'variant-baseline',
        buildAlias: 'stable',
        modelAlias: 'default'
      }
    });

    expect(created.response.ok).toBe(true);
    const runId = created.payload.run.id;

    const updated = await fetchJson(baseUrl, `/api/studio/runs/${runId}`, {
      method: 'PATCH',
      body: { status: 'canceled' }
    });

    expect(updated.payload.run.status).toBe('canceled');

    const bootstrap = await fetchJson(baseUrl, '/api/studio/bootstrap');
    expect(bootstrap.payload.studio.runs.some((run) => run.id === runId && run.status === 'canceled')).toBe(true);
  });

  it('saves layouts and returns them from bootstrap', async () => {
    const created = await fetchJson(baseUrl, '/api/studio/layouts', {
      method: 'POST',
      body: {
        name: 'API layout',
        description: 'Saved in api test.',
        optimizedFor: 'triage',
        panelOrder: ['runs-queue', 'runs-compare']
      }
    });

    expect(created.response.ok).toBe(true);

    const bootstrap = await fetchJson(baseUrl, '/api/studio/bootstrap');
    expect(bootstrap.payload.studio.savedLayouts.some((layout) => layout.name === 'API layout')).toBe(true);
  });

  it('creates validation suites and persists them through bootstrap', async () => {
    const created = await fetchJson(baseUrl, '/api/studio/validation/suites', {
      method: 'POST',
      body: {
        name: 'API suite',
        description: 'Created in api test.',
        requirementIds: ['req-left-turn'],
        scenarioIds: ['scenario-unprotected-left'],
        passCriteria: ['collisionFree']
      }
    });

    expect(created.response.ok).toBe(true);

    const bootstrap = await fetchJson(baseUrl, '/api/studio/bootstrap');
    expect(bootstrap.payload.studio.validationSuites.some((suite) => suite.name === 'API suite')).toBe(true);
  });
});
