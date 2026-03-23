# ADAS Simulation Studio

This repo is now a browser-based ADAS replay, scenario authoring, compare, and validation studio built on top of the original MP4 review and Waymo dataset tooling.

The current operator-grade vertical slice supports:

- synchronized Waymo camera, LiDAR, ego-pose, and 3D replay
- MP4 incident review with browser-side CV
- persisted findings, bookmarks, scenarios, layouts, runs, and validation suites
- a command palette for quick-open and action launch
- replay-to-finding, replay-to-bookmark, and replay-to-scenario promotion
- build/model alias switching with run provenance
- reusable validation suites and report export

It does **not** claim a full production simulator, a complete world model, or standards-complete OpenSCENARIO/OpenDRIVE export. Those remain explicit roadmap items.

## What Is Functional Now

### Data Explorer

- Waymo local replay from Parquet folders
- Waymo cloud-backed replay through the local backend
- raw Waymo E2E TFRecord review
- operator-style replay surface with:
  - left diagnostics rail
  - LiDAR bird's-eye view
  - camera wall
  - 3D ego-follow scene
  - measurement tiles
  - map panel
  - trend graph
  - playback controls
- replay-context finding creation, bookmarking, and scenario extraction

### Scenario Studio

- scenario library browser
- bird's-eye scene editor
- actor list and actor inspector
- route waypoint editing
- trigger/event editing
- parameter sweep editing
- scenario duplication
- variant duplication
- prompt-authored scenario seed creation

### Simulation Runs

- persisted run creation
- run state machine:
  - `queued`
  - `preparing`
  - `running`
  - `completed`
  - `failed`
  - `canceled`
- persisted artifacts and provenance
- operational compare summary for two runs

### Validation

- requirements traceability
- metrics registry
- reusable validation suites
- run history
- findings queue
- JSON and HTML validation report export

### Studio Shell

- unified shell with left navigation and command bar
- command palette with `Ctrl+K` / `Cmd+K`
- save, duplicate, reset, and reorder layout workflows
- build/model/layout selectors
- compare mode toggle

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Start the frontend

```bash
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

### 3. Start the backend

If your Waymo Parquet data is located at `C:\Users\PC\Desktop\waymo_data`:

```powershell
$env:WAYMO_LOCAL_DATA_ROOT="C:\Users\PC\Desktop\waymo_data"
npm run cloud:dev
```

Backend:

```text
http://127.0.0.1:8080
```

Health:

```text
http://127.0.0.1:8080/api/health
```

## Fastest Demo Flow

1. Open [http://127.0.0.1:5173](http://127.0.0.1:5173)
2. Press `Ctrl+K` and type `Data Explorer`, or use the left nav
3. Keep `Waymo scenario replay` selected
4. Switch to `Cloud simulation`
5. Leave the `Cloud API base URL` blank for local proxy mode
6. Click `Refresh Scenarios`
7. Open a scenario card
8. Use the replay toolbar to scrub frames
9. Click `Create finding`, `Bookmark frame`, or `Promote to scenario`

## Operator Workflows

### Query-first replay review

Use the command palette to open:

- datasets
- scenarios
- runs
- findings
- layouts
- common actions

The command palette is backed by the studio API and falls back to local search if the backend is unavailable.

### Replay to finding

1. Open a Waymo scenario in `Data Explorer`
2. Scrub to the frame of interest
3. Select an object or keep the frame context
4. Click `Create finding`
5. Open `Validation` to review the persisted finding and linked evidence

### Replay to scenario seed

1. Open a Waymo scenario in `Data Explorer`
2. Move to the relevant replay window
3. Click `Promote to scenario`
4. Open `Scenario Studio` to refine route, actors, events, and variants

### Scenario to run

1. Open `Scenario Studio`
2. Adjust actors, route, events, or variant sweeps
3. Click `Launch run`
4. Open `Simulation Runs` to watch the run lifecycle and inspect artifacts

### Compare two runs

1. Open `Simulation Runs`
2. Pick left and right runs
3. Enable compare mode if you want it to remain sticky in the shell
4. Inspect metric deltas, finding deltas, intervention changes, and provenance gaps

### Validation suite flow

1. Open `Validation`
2. Review requirements and reusable suites
3. Launch or compare runs from the same scenario family
4. Export the HTML report when you need a quick evidence package

## Prompt Copilot

The copilot is **structured-first**, not chat-only.

Prompt flow:

1. enter a prompt
2. preview the structured plan
3. inspect the payload
4. apply it

Supported actions now:

- create a scenario seed
- mutate the active scenario
- launch a log search plan
- create a validation suite
- open compare mode
- select a layout
- create a finding from replay context

Examples:

- `Create a near-miss cut-in scenario on an urban arterial at dusk.`
- `Mutate this scene to heavy rain and move the pedestrian 1.5 seconds earlier.`
- `Generate a validation suite for unprotected left turns in medium traffic.`
- `Compare stable vs candidate build on this scenario and show object-tracking regressions.`
- `Create a high-severity finding from this replay for the late brake onset.`

## Honesty Boundaries

The studio distinguishes:

- `Observed-from-log evidence`
- `Physics-simulated counterfactual`
- `Generated hypothesis`

Interpretation rules:

- observed sensor playback is the strongest evidence in the current repo
- simulated runs are useful for replay and regression, but still depend on assumptions
- generated/world-model outputs remain experimental and must not be treated as validation-grade ground truth by default
- front-dashcam-to-surround reconstruction is scenario bootstrapping or hypothesis generation unless corroborated by richer observations

## What Is Partial

- layout management supports save, duplicate, reset, and drag-reorder; it is not yet a full Foxglove-style dock/resize engine
- compare mode is operational for run artifacts and metrics; fully synchronized dual replay surfaces remain a next step
- Scenario Studio supports authoring foundations; standards export is still a mapping seam, not a full exporter
- validation is evidence-driven now, but not yet a large-scale CI/SIL/HIL execution backplane

## What Is Stubbed Or Experimental

- `src/studio/world-model/adapter.js`
- standards-complete OpenSCENARIO / OpenDRIVE export
- MCAP normalization/export
- full radar simulation and failure injection
- real controllable world-model camera/LiDAR synthesis

## Useful Docs

- [How to use the studio](docs/how-to-use-the-studio.md)
- [Architecture and roadmap](docs/adas-simulation-studio-plan.md)

## Verification

```bash
npm run lint
npm test
npm run build
```
