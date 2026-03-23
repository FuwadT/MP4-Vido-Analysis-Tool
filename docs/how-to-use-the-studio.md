# How To Use ADAS Simulation Studio

This guide is intentionally short and practical. If you only want the easiest demo, start with **Waymo Cloud simulation**.

## Fast Navigation

- Use the left nav to switch workspaces.
- Use `Ctrl+K` to open the command palette.
- Use the top command bar to switch dataset, scenario, build alias, model alias, and layout.

## Best Demo: Waymo Cloud Simulation

### Before you open the app

Start the backend:

```powershell
$env:WAYMO_LOCAL_DATA_ROOT="C:\Users\PC\Desktop\waymo_data"
npm run cloud:dev
```

Start the frontend:

```bash
npm run dev
```

## Open A Scenario

1. Open [http://127.0.0.1:5173](http://127.0.0.1:5173)
2. Click `Data Explorer`
3. Keep `Waymo scenario replay` selected
4. Click `Cloud simulation`
5. Leave the API field blank
6. Click `Refresh Scenarios`
7. Click `Open scenario`

Why leave the API field blank?

- In local development, the frontend uses the built-in `/api` proxy.
- This avoids manual URL entry and reduces CORS mistakes.

## What You Are Looking At

When a Waymo scenario opens, the screen is organized like this:

### Left rail

- scenario summary
- speed, distance, duration, and object counts
- location, weather, and sensor status
- visible objects in the selected view
- annotation editor for the selected object

### Top-left main panel

- LiDAR bird&apos;s-eye view
- good for quick ego-relative understanding

### Top-right main panel

- selected camera with overlays
- camera wall for fast switching between views

### Bottom main panel

- 3D ego-follow world scene
- useful for trajectory, point cloud, and scene motion review

### Bottom controls

- frame stepping
- play/pause
- frame scrubber

## Local Simulation

Use `Local simulation` when you want to open files directly from your machine.

### Open a Waymo Parquet folder

1. Go to `Data Explorer`
2. Choose `Waymo scenario replay`
3. Click `Local simulation`
4. Click `Open Waymo Folder`

Best results come from folders that include:

- `vehicle_pose`
- `camera_image`
- `lidar`
- `lidar_box`
- `camera_box`
- `camera_to_lidar_box_association`

### Open an E2E TFRecord

1. Go to `Data Explorer`
2. Choose `Waymo scenario replay`
3. Click `Local simulation`
4. Click `Open E2E TFRecord`

This path is best for:

- camera footage
- ego trajectory
- intent metadata

It is not the same as the full Parquet perception workflow.

## MP4 Review

1. Go to `Data Explorer`
2. Switch to `MP4 incident review`
3. Upload a clip
4. Wait for the CV models to load
5. Use the overlays and timeline to inspect the event

## Scenario Studio

Use this workspace when you want to move from replay into scenario editing.

Good uses:

- duplicate a scenario variant
- add or remove actors
- adjust spawn poses and notes
- edit routes and events
- create a scenario seed from a prompt plan
- promote a replay segment into an editable scenario

## Simulation Runs

Use `Simulation Runs` when you want to:

- launch a persisted exploratory, regression, or hypothesis run
- compare two runs side by side
- inspect artifacts, metric deltas, intervention changes, and provenance gaps

## Validation

Use `Validation` to review:

- requirements
- metrics
- run history
- findings
- ODD coverage

Today this is foundation/scaffolding, not a full production validation backend.

## Build And Model Switching

Use `Models & Builds` and the top command bar selectors to switch:

- build alias
- model alias
- layout preset

The app records provenance so runs can be traced to:

- dataset source
- scenario
- build alias and version
- model alias and version
- honesty label

## Prompt Copilot

The copilot is structured-first:

1. enter a prompt
2. click `Preview`
3. inspect the structured payload
4. click `Apply`

Useful prompts:

- `Create a near-miss cut-in scenario on an urban arterial at dusk.`
- `Mutate this scene to heavy rain and move the pedestrian 1.5 seconds earlier.`
- `Generate a validation suite for unprotected left turns in medium traffic.`
- `Compare stable vs candidate build on this scenario and show object-tracking regressions.`
- `Create a high-severity finding from this replay for the late brake onset.`

## Honesty Rules

Treat outputs differently depending on where they came from:

### Observed-from-log

Real captured sensor data. This is the strongest evidence in the current app.

### Simulated

Counterfactual or replay outputs driven by models, assumptions, or scenario mutations.

### Generated

Hypothesis-level outputs such as future world-model or monocular surround completion. These are not validation-grade ground truth by default.

## Troubleshooting

### No cloud scenarios appear

Check:

1. The backend is running
2. `WAYMO_LOCAL_DATA_ROOT` points to your Waymo folder
3. The API base URL field is blank for local proxy mode
4. You clicked `Refresh Scenarios`

### The simulation does not show up

Check:

1. You opened a scenario card after refreshing
2. The backend health endpoint responds at [http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health)
3. The frontend is running at [http://127.0.0.1:5173](http://127.0.0.1:5173)

### Loading feels slow

This app still does meaningful camera and LiDAR work in the browser. The cloud path is the faster demo path because the backend handles segment discovery and frame serving.
