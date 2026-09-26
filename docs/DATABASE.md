# Database status

## Current application

The current Multi-Robot Task Negotiation Engine does not use a database for the simulator. The API keeps the warehouse, robots, tasks, conflicts, and event stream in memory.

This is intentional for the demonstration:

- Startup is simple.
- Commands return immediately.
- The fleet can be reset or resized without migrations.
- The API can demonstrate negotiation and recovery behavior without user accounts or persistent data.

## Database files currently present

The workspace includes a reusable database package:

```text
lib/db/
├── drizzle.config.ts
├── src/index.ts
└── src/schema/index.ts
```

The schema export is currently empty, and there are no simulation migrations or seed files. `DATABASE_URL` is only needed if future work adds tables and starts importing the database package from the API.

## Suggested persistence model for a future release

If simulation state needs to survive restarts or support multiple operators, add tables for:

- `warehouses`
- `robots`
- `robot_routes`
- `tasks`
- `task_events`
- `conflicts`
- `simulation_runs`

The event stream should be stored as append-only task and system events, while current robot positions can be updated at a lower frequency or reconstructed from a simulation run.

## Important behavior

Restarting the API resets the demo state. No production database migration is required for the current deployed application.