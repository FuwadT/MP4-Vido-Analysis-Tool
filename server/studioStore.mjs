import fs from 'node:fs/promises';
import path from 'node:path';
import {
  PLAYBACK_LAYOUTS,
  SCENARIOS,
  VALIDATION_METRICS,
  VALIDATION_REQUIREMENTS,
  VALIDATION_RUNS
} from '../src/studio/data/seedData.js';
import { createFinding, createValidationSuite } from '../src/studio/domain/models.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSeedFindings() {
  return VALIDATION_RUNS.flatMap((run) => {
    return (run.findings || []).map((finding) => createFinding({
      ...finding,
      linkedRunId: run.id,
      linkedScenarioId: run.scenarioId,
      linkedScenarioVariantId: run.scenarioVariantId,
      provenance: run.provenance
    }));
  });
}

function buildSeedSuites() {
  return [
    createValidationSuite({
      id: 'suite-urban-cut-in-regression',
      name: 'Urban cut-in regression suite',
      description: 'Reusable suite for near-miss cut-ins and replay regressions.',
      requirementIds: ['req-urban-cut-in'],
      scenarioIds: ['scenario-urban-cut-in'],
      variantIds: ['variant-baseline', 'variant-dusk-rain'],
      oddSlices: ['urban-arterial', 'vehicle-cut-in', 'daylight', 'heavy-rain'],
      passCriteria: ['collisionFree', 'minTtcSeconds', 'interventionCount'],
      provenance: {
        sourceLabel: 'Seeded validation suite'
      }
    })
  ];
}

function buildSeedLayouts() {
  return PLAYBACK_LAYOUTS.map((layout) => ({
    ...clone(layout),
    workspaceId: layout.optimizedFor || 'triage',
    panelOrder: [],
    isPreset: true,
    updatedAt: new Date().toISOString()
  }));
}

function buildInitialStudioData() {
  return {
    version: 1,
    scenarios: clone(SCENARIOS),
    runs: clone(VALIDATION_RUNS),
    findings: buildSeedFindings(),
    bookmarks: [],
    savedLayouts: buildSeedLayouts(),
    validationSuites: buildSeedSuites(),
    reports: []
  };
}

function normalizeStore(raw) {
  const seeded = buildInitialStudioData();
  const next = raw && typeof raw === 'object' ? raw : {};

  return {
    version: Number(next.version) || seeded.version,
    scenarios: Array.isArray(next.scenarios) && next.scenarios.length > 0 ? next.scenarios : seeded.scenarios,
    runs: Array.isArray(next.runs) && next.runs.length > 0 ? next.runs : seeded.runs,
    findings: Array.isArray(next.findings) ? next.findings : seeded.findings,
    bookmarks: Array.isArray(next.bookmarks) ? next.bookmarks : seeded.bookmarks,
    savedLayouts: Array.isArray(next.savedLayouts) && next.savedLayouts.length > 0 ? next.savedLayouts : seeded.savedLayouts,
    validationSuites: Array.isArray(next.validationSuites) && next.validationSuites.length > 0 ? next.validationSuites : seeded.validationSuites,
    reports: Array.isArray(next.reports) ? next.reports : seeded.reports
  };
}

export function createStudioStore(config) {
  const storeFile = config.studioStoreFile || path.resolve(config.repoRoot, 'data', 'studio', 'studio-store.json');
  let cached = null;
  let writeQueue = Promise.resolve();

  async function ensureLoaded() {
    if (cached) {
      return cached;
    }

    await fs.mkdir(path.dirname(storeFile), { recursive: true });

    try {
      const raw = await fs.readFile(storeFile, 'utf8');
      cached = normalizeStore(JSON.parse(raw));
    } catch {
      cached = buildInitialStudioData();
      await fs.writeFile(storeFile, JSON.stringify(cached, null, 2));
    }

    return cached;
  }

  async function persist(next) {
    cached = normalizeStore(next);
    writeQueue = writeQueue.then(() => fs.writeFile(storeFile, JSON.stringify(cached, null, 2)));
    await writeQueue;
    return clone(cached);
  }

  return {
    async getSnapshot() {
      const data = await ensureLoaded();
      return clone(data);
    },
    async update(mutator) {
      const current = await ensureLoaded();
      const proposed = await mutator(clone(current));
      return persist(proposed || current);
    },
    async saveReport(report) {
      return this.update((data) => {
        data.reports = [report, ...(data.reports || [])].slice(0, 50);
        return data;
      });
    },
    getRegistrySnapshot() {
      return {
        validationRequirements: clone(VALIDATION_REQUIREMENTS),
        validationMetrics: clone(VALIDATION_METRICS)
      };
    },
    filePath: storeFile
  };
}
