# QA Process

This document defines the quality gate for the current repository, which combines:

- MP4 browser-side ADAS analysis
- Waymo Parquet session review
- Waymo end-to-end TFRecord review
- Local/cloud Waymo segment APIs
- Dataset ingestion and LiDAR/camera playback utilities
- CLI utilities for E2E shard sampling

The goal is to make QA repeatable, evidence-based, and tied to the actual surface area of the repo rather than a generic checklist.

## Scope

The QA process covers:

- Frontend rendering and interaction in `src/`
- Backend APIs in `server/`
- Waymo dataset decoding and playback in `src/utils/waymo/`
- MP4 analysis and event detection in `src/utils/`
- CLI entry points in `scripts/`
- Build, lint, test, and audit workflows

The process does not assume a separate staging environment. It is intended to work locally first, then scale to CI and release gates.

## Current Validation Baseline

Commands run during this review:

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

Observed results:

- `npm run test` passed: 5 test files, 14 tests.
- `npm run build` passed, but emitted a large bundle warning and an upstream `eval` warning from `@protobufjs/inquire`.
- `npm run lint` initially failed on two issues and was then re-run after a small cleanup:
  - `src/components/WaymoE2EDashboard.jsx` had an unused `Icon` binding in `SensorCard`.
  - `vite.config.js` used `process` without an explicit Node import.
- `npm audit --omit=dev` reported 12 vulnerabilities, including high-severity issues in transitive dependencies.

## Security Review Methodology

Use this workflow for every release candidate and for any backend, dependency, or file-path related change:

1. Review all code paths that accept untrusted input.
2. Trace how those inputs are used in filesystem paths, storage object names, URLs, shell commands, and signed upload targets.
3. Inspect CORS, auth, and proxy boundaries.
4. Run `npm audit` and review whether findings are direct or transitive, runtime or dev-only, and whether there is a breaking upgrade path.
5. Check for committed generated assets, logs, samples, and other data that may leak private content or create supply-chain noise.
6. Record a severity, exploitability, and remediation plan for every finding.

### Security Findings

#### High: path traversal through segment IDs in local manifest persistence

Affected files:

- `server/segmentRegistry.mjs`
- `server/index.mjs`

Why it matters:

- `segmentId` is concatenated into local manifest filenames and local source paths without normalization or validation.
- `saveManifest()` writes to `path.join(localManifestDir, `${segmentId}.json`)`.
- `getManifest()` reads the same path.
- `buildLocalSources()` resolves component files with `path.join(localDataRoot, component, `${segmentId}.parquet`)`.

Risk:

- A crafted `segmentId` containing path separators can escape the intended directory structure.
- In local mode this can cause unauthorized reads or writes outside the manifest or dataset root.

Recommended fix:

- Enforce an allowlist for `segmentId` values before any filesystem use.
- Reject path separators and reserved path traversal tokens.
- Prefer a canonical segment ID parser shared by both frontend and backend.

#### Medium: unauthenticated write-capable backend surface

Affected files:

- `server/index.mjs`
- `server/segmentRegistry.mjs`

Why it matters:

- The backend exposes register, upload-plan, and frame-access APIs without auth.
- `app.use(cors(CORS_OPTIONS))` allows broad browser-origin access when enabled.
- `POST /api/cloud/uploads/signed-urls` can mint write URLs for Cloud Storage once the backend is pointed at a bucket.

Risk:

- If the service is exposed beyond a trusted local network, an attacker can register manifests, create upload targets, and access decoded segment data.

Recommended fix:

- Keep this service behind local-only or authenticated deployment boundaries.
- Add API auth or signed-session gating before any internet-exposed deployment.
- Document that CORS is a convenience for local development, not a production security boundary.

#### Medium: repository hygiene risk from generated artifacts and sample data

Observed in working tree:

- `.playwright-cli/`
- `output/`
- `sample-waymo-e2e.tfrecord-00000-of-00266`

Risk:

- Generated screenshots, session logs, and sample datasets can leak internal state or bloat the repository.
- They also increase the chance that QA or CI snapshots become noisy and non-reproducible.

Recommended fix:

- Keep generated artifacts out of source control unless they are intentional fixtures.
- Expand `.gitignore` and `.dockerignore` only after confirming the files are not needed as test fixtures.

#### Low: dependency supply-chain risk

Affected by `npm audit --omit=dev`:

- `@tootallnate/once`
- `http-proxy-agent`
- `fast-xml-parser`
- `minimatch`
- `tar`
- `@mapbox/node-pre-gyp`
- `canvas`

Risk:

- These are transitive issues in the current dependency graph.
- Some fixes require breaking upgrades, so blind auto-fix is not safe.

Recommended fix:

- Track these in dependency upgrade work rather than ignoring them.
- Re-run `npm audit` after each dependency bump.
- Promote any runtime dependency fix that can be landed without destabilizing the Waymo or visualization stacks.

## Defect Testing Methodology

Use this sequence when validating changes:

1. Start with static checks: lint, build, and dependency audit.
2. Run unit tests for utility modules and parsers.
3. Smoke-test any updated UI path in the browser.
4. For backend changes, exercise the API with both valid and invalid inputs.
5. For dataset changes, confirm empty, partial, and large input behavior.
6. Verify that error messages are specific enough for operator debugging.

### Defects Found in This Review

#### Lint defect: unused binding in `WaymoE2EDashboard`

File:

- `src/components/WaymoE2EDashboard.jsx`

Symptom:

- ESLint reported `Icon` as unused in `SensorCard`.

Status:

- Fixed by renaming the destructured component binding to `IconComponent`.

#### Lint defect: Node global not recognized in Vite config

File:

- `vite.config.js`

Symptom:

- ESLint reported `process` as undefined.

Status:

- Fixed by explicitly importing `process` from `node:process`.

#### Build regression risk: large client bundle

File:

- `dist/assets/index-Dx9ue-uF.js` produced by the build

Symptom:

- Vite warned that the main bundle is larger than 500 kB after minification.

Status:

- Not a functional defect yet, but it is a regression risk and should be tracked.

### Defect Triage Rules

- `P0`: data loss, code execution, auth bypass, or broken core workflow.
- `P1`: user-blocking regression in MP4, Waymo, backend API, or dataset loading.
- `P2`: partial workflow breakage, large performance regression, or intermittent failure.
- `P3`: visual polish, warning noise, or non-blocking cleanup.

## Regression Matrix

Run the following matrix before release and after any change touching the listed area.

### Frontend

- App shell mode switching between MP4 and Waymo workspaces.
- Camera playback, timeline scrubbing, object selection, and overlays.
- Keyboard shortcuts and help modal.
- Empty-state rendering for missing data.
- Responsive layout at common desktop widths and narrow laptop widths.
- Error states when the backend is offline.

### MP4 Flow

- MP4 upload and playback.
- Object detection and tracking.
- Event detection and incident timeline.
- Session save/load.
- Manual labeling or annotation correction.
- Pause/resume and frame-by-frame stepping.

### Waymo Dataset Flow

- Local Parquet segment discovery.
- Partial segments with missing optional components.
- Camera rendering.
- LiDAR point cloud rendering.
- Ego trajectory display.
- Annotation sidebar and metadata panels.

### Waymo E2E Flow

- TFRecord shard loading.
- Frame indexing and seeking.
- Camera image display from raw shard data.
- Trajectory and scenario metadata display.
- Large shard behavior and partial sample behavior.

### Backend and Cloud APIs

- `/api/health`
- `/api/cloud/segments`
- `/api/cloud/segments/register`
- `/api/cloud/segments/register-bucket`
- `/api/cloud/segments/register-local`
- `/api/cloud/uploads/signed-urls`
- `/api/cloud/segments/:segmentId`
- `/api/cloud/segments/:segmentId/frames/:frameIndex`
- `/api/cloud/segments/:segmentId/frames/:frameIndex/cameras/:cameraName`
- `/api/cloud/segments/:segmentId/frames/:frameIndex/lidar`

Test cases to include:

- Missing `segmentId`
- Malformed JSON
- Invalid frame index
- Out-of-range frame index
- Missing local data root
- Missing optional components
- Invalid or malicious `segmentId`
- Oversized `maxPoints`
- Expired or malformed upload settings

### CLI

- `npm run waymo:e2e:list`
- `npm run waymo:e2e:sample`
- Local shard sample creation
- Remote shard sample creation
- Cleanup of raw downloads
- Missing `gsutil` or `gcloud`

### Data Ingestion and Decoding

- Parquet decode with camera, LiDAR, and stats tables.
- TFRecord indexing and per-frame record lookup.
- Empty dataset roots.
- Mixed-quality or partially complete datasets.
- Large data volume and memory pressure.

### Edge Cases

- Segment IDs with punctuation or traversal-like content.
- Missing camera images but present pose data.
- Missing LiDAR but valid camera frames.
- Empty manifests directory.
- Corrupt JSON manifest files.
- Unsupported or unexpected component names.
- Cross-origin browser requests when CORS is enabled.

## Automated Checks

Use these automated checks in CI:

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

Recommended additions:

- Add API-level tests for `server/index.mjs`.
- Add path-safety tests for manifest and dataset discovery helpers.
- Add browser smoke tests for the two workspace modes.
- Add regression tests for invalid `segmentId` and invalid frame requests.
- Add fixture-based tests for malformed JSON manifests.

## Manual Test Suites

### Smoke Suite

- Launch the app.
- Switch between MP4 and Waymo workspaces.
- Confirm the home mode persists after refresh.
- Confirm the backend proxy is reachable or that offline error messages are clear.

### Operator Suite

- Load a local Waymo segment.
- Scrub through frames.
- Open camera views and LiDAR.
- Confirm annotations and metadata are visible.
- Exercise the compare or alternate-layout UI, if present.

### Negative Suite

- Start the backend without `WAYMO_LOCAL_DATA_ROOT`.
- Request a nonexistent segment.
- Request a frame outside the available range.
- Use a malicious `segmentId` containing path separators.
- Post malformed JSON to the register endpoints.

### Security Suite

- Confirm no private datasets are accessible from unauthorized networks.
- Confirm signed upload URLs are only generated in trusted environments.
- Confirm generated artifacts are not shipped unless intended.
- Confirm dependency updates are reviewed with `npm audit`.

## Release Gates

Release is blocked if any of the following are true:

- `npm run lint` fails.
- `npm run test` fails.
- `npm run build` fails.
- A high-severity security issue has no documented mitigation or exception.
- A core workflow regression is found in MP4, Waymo, backend, or CLI paths.
- Path traversal, auth bypass, or data exfiltration risks are unresolved.

Release can proceed with a waiver only if:

- The issue is non-blocking.
- The owner has documented the risk.
- The regression or vulnerability has a short-term mitigation plan.
- The waiver is time-boxed.

## Priority Guidance

- Fix security issues before feature work when they expose files, credentials, or datasets.
- Fix P0/P1 functional defects before merge.
- Fix P2 issues before release if they affect operator trust or large datasets.
- Track P3 issues in a cleanup queue.

## Current Gaps

- There is no authenticated production deployment boundary yet.
- Browser-level end-to-end tests are not present.
- API tests are not present.
- The dependency audit includes transitive issues that require careful upgrade planning.
- Build output size should be reduced or code-split in a follow-up.

## References in This Repo

- Frontend app shell: `src/App.jsx`
- MP4 workflow: `src/components/VideoAnnotation.jsx`
- Waymo dataset workflow: `src/components/WaymoDatasetStudio.jsx`
- Waymo E2E workflow: `src/components/WaymoE2EDashboard.jsx`
- Backend entry point: `server/index.mjs`
- Backend segment registry: `server/segmentRegistry.mjs`
- Local segment discovery: `server/localSegmentDiscovery.mjs`
- Vite config: `vite.config.js`
