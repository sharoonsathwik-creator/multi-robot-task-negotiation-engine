# Multi-Robot Task Negotiation Engine

An interactive autonomous warehouse command center for coordinating robot fleets, negotiating shared routes, recovering from deadlocks, and monitoring live task telemetry.

## Live deployment

**Website:** [Open the deployed Multi-Robot Task Negotiation Engine](https://multi-robot-task-negotiation-engine--sharoonsathu.replit.app)

The current deployment is public and uses an autoscale target. The simulator intentionally keeps its state in API memory, so a server restart resets the demo state.

## Problem statement

Large delivery warehouses need to coordinate many mobile robots while handling:

- Competing task assignments
- Shared lanes and right-of-way conflicts
- Deadlocks and blocked routes
- Low battery and charging decisions
- Robot failures and communication loss
- Operator visibility into live fleet health

Traditional static dashboards do not show how these decisions affect robot movement or how an operator can intervene.

## Solution

This project provides a live operator control surface for a simulated autonomous warehouse. The browser polls a typed API snapshot, renders the warehouse as an interactive isometric map, and sends operator commands back to the simulator.

The simulator includes two warehouse prototypes:

- **Delivery Warehouse Prototype 1:** large 500-robot fleet view
- **Delivery Warehouse Prototype 2:** reduced 48-robot fleet with slower movement, walls, wall-aware route visualization, zoom, pan, and 3D-style spatial presentation

## Implemented features

### Fleet and warehouse operations

- Live fleet totals, utilization, charging, negotiating, conflict, and completion metrics
- 500 simulated robots in Prototype 1
- 48 simulated robots in Prototype 2
- Named warehouse zones including Inbound, Storage A/B, Quality Check, Packing, Charge 03, Dock 4, Outbound, and Return Room 2
- Directional lane arrows and shared route geometry
- Smooth robot movement and highlighted robot markers
- Selected-robot telemetry panel with position, battery, speed, health, task, and destination

### Interactive spatial map

- Robot selection by clicking markers
- Robot route highlight
- Zoom in, zoom out, and reset controls
- Mouse-wheel zoom
- Drag-to-pan
- Double-click map reset
- Locate selected robot
- Full-screen map mode
- Holographic zone labels
- Prototype 2 walls, partitions, floor grid, and wall-aware route network

### Task negotiation and recovery

- Queue a new task
- Reassign a robot task
- Battery-aware charging
- Robot failure simulation and task recovery
- Conflict injection
- Deadlock injection and automatic recovery
- Communication mesh loss with local autonomy
- Controller offline and restore flows
- Periodic task progress events with destination and ETA updates

### Simulation controls

- Start and pause simulation
- Reset simulation
- Switch between warehouse prototypes
- Toggle hologram labels
- Toggle route arrows
- Enter and exit selected robot POV
- Live negotiation queue
- Live event stream
- Mobile navigation support

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Wouter
- **UI:** Tailwind CSS v4, Lucide React, custom CSS/SVG spatial visualization
- **Data fetching:** TanStack React Query
- **Backend:** Node.js, Express 5, TypeScript
- **Validation:** OpenAPI 3.1, Orval-generated React hooks, Zod schemas
- **Workspace:** pnpm monorepo
- **Build:** Vite for the web artifact, esbuild for the API bundle
- **Database package:** Drizzle ORM/PostgreSQL scaffold; not used by the current in-memory simulator
- **Deployment:** Replit artifact deployment with a public autoscale deployment

## Project structure

```text
.
├── artifacts/
│   ├── multi-robot-engine/
│   │   ├── src/App.tsx                 # Dashboard, map, controls, robot POV
│   │   ├── src/index.css               # Command-center theme and map styling
│   │   ├── .replit-artifact/artifact.toml
│   │   └── package.json
│   ├── api-server/
│   │   ├── src/routes/simulation.ts     # In-memory simulator and command state machine
│   │   ├── src/routes/health.ts
│   │   ├── src/app.ts
│   │   └── package.json
│   └── mockup-sandbox/                  # Design/component preview artifact
├── lib/
│   ├── api-spec/openapi.yaml            # API source of truth
│   ├── api-client-react/                # Generated React client
│   ├── api-zod/                         # Generated Zod schemas
│   └── db/                              # Empty Drizzle/PostgreSQL scaffold
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DATABASE.md
├── screenshots/
│   └── prototype-2-warehouse-map.jpg
├── .env.example
├── .gitignore
└── README.md
```

## Setup instructions

### Prerequisites

- Node.js 20+ (the Replit workspace currently uses Node.js 24)
- pnpm

### Install dependencies

```bash
pnpm install
```

### Configure environment

Copy the example environment file if you are running outside the managed Replit workflows:

```bash
cp .env.example .env
```

The frontend Vite server requires `PORT` and `BASE_PATH`. The API server requires `PORT`. Replit's artifact workflows inject the correct values automatically.

### Run the API server

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### Run the frontend

In a second terminal:

```bash
PORT=24671 BASE_PATH=/ pnpm --filter @workspace/multi-robot-engine run dev
```

For the Replit preview, use the configured workflows:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/multi-robot-engine run dev
```

### Verify the project

```bash
pnpm run typecheck
pnpm run build
```

Useful direct checks:

```bash
curl http://localhost:8080/api/healthz
curl http://localhost:8080/api/simulation/snapshot
```

## API documentation

The OpenAPI source is in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml). A human-readable endpoint guide is in [`docs/API.md`](docs/API.md).

Main endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/healthz` | API health status |
| `GET` | `/api/simulation/snapshot` | Current warehouse, fleet, robot, task, event, and conflict state |
| `POST` | `/api/simulation/command` | Apply a simulation or operator command and return the updated snapshot |

## Database status

The current application does not persist simulation state. The API owns an in-memory state object so the demo remains responsive and self-contained. No simulation tables, migrations, or sample database data are required for the deployed experience.

The reusable Drizzle package is located at [`lib/db`](lib/db). It currently contains an empty schema export and can be extended if persistence is added later. See [`docs/DATABASE.md`](docs/DATABASE.md).

## Screenshots

- [Prototype 2 interactive warehouse map](screenshots/prototype-2-warehouse-map.jpg)
- [Simulation Lab with live task events](screenshots/simulation-lab-events.jpg)

The screenshots show the reduced 48-robot fleet, isometric warehouse map, walls, lane arrows, robot telemetry, negotiation queue, mission ledger, and live task events.

## Team

- **Project owner / product direction:** project owner
- **Implementation and integration:** Replit Agent

Replace the project-owner placeholder with the final team member names before external submission if a named team roster is required.

## Documentation

- [Architecture and data flow](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Database status and migration plan](docs/DATABASE.md)

## License

This project is maintained as a private workspace artifact. Add the intended distribution license before publishing the source outside the workspace.