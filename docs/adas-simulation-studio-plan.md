# ADAS Simulation Studio Plan

## Purpose

This repo is being extended from a dual-purpose MP4/Waymo viewer into an ADAS replay, scenario authoring, compare, and validation studio.

The goal is not a greenfield rewrite. The existing strengths remain the core:

- `src/components/VideoAnnotation.jsx`
- `src/components/WaymoDatasetStudio.jsx`
- `src/components/WaymoScene3DViewer.jsx`
- `server/index.mjs` and `server/app.mjs`
- `src/utils/waymo/*`

This pass moves the repo from architecture-heavy scaffolding toward an operator-grade vertical slice.

## Research Anchors

The product direction continues to follow public product patterns from:

- Applied Intuition Data Explorer
  - intelligent ingestion, event search, log triage, and scenario export from logs
- Applied Intuition Log Sim
  - deterministic replay, issue reproduction, and counterfactual re-simulation
- Applied Intuition Validation Toolset
  - requirements traceability, scalable scenario execution, and evidence-backed V&V
- Applied Intuition Test Suites
  - reusable logical scenarios, parameter sweeps, routes, and pass/fail criteria
- Applied Intuition Sensor Sim
  - physics-grounded, hardware-specific sensor simulation
- Applied Intuition Copilot
  - structured prompt-driven workflows across data, search, and simulation
- Foxglove
  - panel-based observability, saved layouts, raw message inspection, and MCAP-centered workflows
- Webviz / Worldview
  - browser-native, layout-driven operator replay
- Dewesoft ADAS testing
  - synchronized sensor replay, map annotations, georeferenced measurements, and automated reporting
- dSPACE AURELION
  - sensor-specific realism, failure injection hooks, ground-truth overlays, and standards-aligned world setup
- MathWorks Automated Driving / RoadRunner
  - scenario generation from logs, reusable variants, protocol-style validation, and standards-based interchange
- ZF Visual
  - dense multi-view operator UX with synchronized graphs and environment views
- Waymo World Model announcement from February 6, 2026
  - language control, scene layout control, driving action control, generated camera + LiDAR, dashcam conversion, and scalable rollout

## Platform Layers

### Data ingestion layer

Implemented now:

- Waymo Parquet
- Waymo E2E TFRecord
- MP4 uploads

Partially implemented:

- cloud-backed Waymo segment discovery and replay

Future:

- MCAP normalization
- ROS bag adapters
- live bridge / publish-back

### Canonical scene and scenario layer

Implemented now in `src/studio/domain/models.js`:

- dataset, log session, scenario, variant, actor, route, event, annotation, tag
- validation requirement, validation metric, validation run, validation suite
- build profile, model profile, playback layout
- world-model request/output contracts
- provenance with evidence type and honesty labeling

### Simulation execution layer

Implemented now:

- persisted run creation
- run lifecycle state machine
- stored artifacts, findings, and provenance
- compare summary generation

Partially implemented:

- operator compare workflow in the UI

Stubbed:

- distributed replay backplane
- large-scale CI execution
- closed-loop simulation engine abstraction

### Evaluation and validation layer

Implemented now:

- requirement summaries from real run/finding data
- reusable validation suites
- run history
- findings queue
- JSON / HTML validation report export

Partially implemented:

- evidence-driven coverage dashboard

Stubbed:

- formal observer execution contracts
- CI regression gates
- requirement coverage heatmaps

### Visualization and interaction layer

Implemented now:

- unified studio shell
- command bar + command palette
- save/duplicate/reset/reorder layout management
- operator-style Waymo replay surface
- scenario authoring surface
- compare and validation workspaces

Partially implemented:

- drag-reorder layout management

Stubbed:

- full dock/resize panel engine
- layout sharing/import/export
- shared topic/message-path variable system across panels

### Prompt and copilot orchestration layer

Implemented now:

- structured prompt parsing
- preview-before-apply workflow
- prompt actions that create or drive:
  - scenario seeds
  - scenario mutations
  - log search plans
  - validation suites
  - compare mode
  - layout selection
  - replay findings

Partially implemented:

- rule-based parser with structured slots and action plans

Future:

- model-backed intent parsing
- tool-using copilot orchestration

### Build and model registry layer

Implemented now:

- build aliases
- model aliases
- compatibility matrix
- provenance capture in runs

Future:

- immutable artifact registry
- deployment metadata
- Triton-style lifecycle control

## Current Operator Workflows

### Replay -> finding

Functional now:

1. open Waymo scenario replay
2. inspect synchronized camera, LiDAR, map, and 3D scene
3. create a finding tied to replay evidence
4. review it in Validation

### Replay -> scenario

Functional now:

1. open replay
2. promote the active replay context into Scenario Studio
3. preserve source linkage back to the observed log
4. edit route, actors, events, and variants

### Scenario -> run

Functional now:

1. choose scenario / variant / build / model
2. launch a run
3. persist provenance and artifacts
4. inspect it in Simulation Runs and Validation

### Run -> compare

Functional now:

1. pick two runs
2. compute metric deltas, finding deltas, intervention deltas, and provenance gaps
3. preserve compare mode in the shared shell

Partial:

- synchronized dual replay panes are not yet implemented

### Prompt -> structured work

Functional now:

1. write prompt
2. preview structured payload
3. apply to create a scenario, variant, suite, compare selection, layout selection, or finding

## Standards And Interop

Designed as first-class concepts:

- MCAP
- ASAM OpenSCENARIO
- ASAM OpenDRIVE

Current reality:

- internal seams exist for future mapping
- full import/export compliance is **not** implemented yet

## Sensor Realism Guidance

Current foundation includes sensor-profile and sensor-rig abstractions that separate:

- beam patterns
- intrinsics / extrinsics
- timing
- return modes
- calibration metadata
- hardware identities

Current example profiles include:

- Ouster OS0
- Ouster OS1
- Hesai AT128
- Waymo surround camera suite abstraction

Radar remains a placeholder at this stage.

## Dashcam To World Pipeline

Architected now as a future path:

1. ingest monocular dashcam video
2. estimate ego motion and coarse scene geometry
3. infer partial 3D scene state
4. optionally call a world-model adapter for novel views or surround completion
5. export a scenario seed with explicit uncertainty and provenance

Honesty boundary:

- monocular-to-surround is a scenario seed / hypothesis workflow, not validation-grade truth by default

## World Model Adapter Boundary

`src/studio/world-model/adapter.js` remains an explicit adapter contract only.

Implemented:

- request and output schema foundation
- provenance and uncertainty expectations

Not implemented:

- a real world model
- generated sensor synthesis backend
- scalable long-rollout inference

## Implemented In This Pass

### Implemented

- backend-backed studio bootstrap and persistence
- persisted scenarios, findings, bookmarks, layouts, runs, and validation suites
- command palette with search and quick-open actions
- replay-context finding and bookmark creation
- replay-context scenario extraction
- scenario route, event, actor, and sweep editing
- prompt-authored scenario seed creation
- prompt-authored validation suite creation
- compare summary from persisted run data
- validation summaries and report export from real run data
- tests for run state, validation aggregation, scenario mutation, command palette, compare workspace, validation workspace, and API persistence

### Partially implemented

- drag-reorder layout management
- compare mode as an operational run diff flow
- query-first replay review
- scenario authoring with standards-aware internal shape

### Stubbed

- MCAP export
- OpenSCENARIO export
- OpenDRIVE export
- radar visualization and physics
- failure injection execution
- full dual synchronized replay compare
- real world-model generation

### Future research

- controllable multi-sensor world models
- validation-grade sensor synthesis
- dashcam-to-surround completion with quantified uncertainty
- physically grounded camera/LiDAR generative residual modeling

## Feasibility And Honesty

### What this repo can do now

- replay real Waymo data
- review MP4 incidents
- extract and edit scenarios
- launch persisted runs
- compare run outputs
- generate validation summaries and export reports
- keep provenance attached to evidence

### What needs more infrastructure

- large-scale execution
- team-shared layout syncing
- standards export pipelines
- live robotics ingestion
- richer simulation backends

### What remains research frontier

- full world-model camera/LiDAR generation
- long controllable rollouts
- dashcam-to-surround reconstruction treated as reliable ground truth

### Observed vs simulated vs generated

- `observed`
  - recorded sensor evidence from logs or video
- `simulated`
  - counterfactual outputs driven by scenario mutation or replay assumptions
- `generated`
  - experimental world-model or inferred content

Generated or inferred regions must always retain uncertainty and provenance metadata.
