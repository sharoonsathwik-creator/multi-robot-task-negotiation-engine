# Multi-Robot Task Negotiation Engine

An interactive autonomous warehouse command center that demonstrates fleet coordination, negotiation, collision avoidance, battery-aware scheduling, and failure recovery.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/multi-robot-engine/src/App.tsx` — dashboard shell, warehouse map, robot POV, controls, and live query/mutation wiring
- `artifacts/multi-robot-engine/src/index.css` — command-center theme and warehouse visualization styles
- `artifacts/api-server/src/routes/simulation.ts` — in-memory fleet simulator and command state machine
- `lib/api-spec/openapi.yaml` — source of truth for simulation snapshot and command contracts

## Architecture decisions

- The first release keeps simulation state in the API process so the dashboard can demonstrate decentralized behaviors without requiring a database or user account.
- The browser polls snapshots at a short interval; operator commands mutate the same simulator state and return the updated snapshot immediately.
- The map uses a CSS/SVG isometric scene instead of a heavy 3D runtime so 500 visible robot markers stay responsive in the preview.

## Product

The app presents two delivery warehouse prototypes with live fleet stats, animated robot positions, task and event feeds, conflict/deadlock injection, battery charging and task reassignment, robot failure recovery, local autonomy, controller failover, and selected-robot POV mode.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The generated React client uses `Headers.entries()`, so its package TypeScript config must include `dom.iterable`.
- Simulation state resets when the API workflow restarts; this is intentional for a live demo surface.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
