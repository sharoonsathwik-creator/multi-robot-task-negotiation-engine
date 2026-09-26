# API reference

The canonical API contract is [`lib/api-spec/openapi.yaml`](../lib/api-spec/openapi.yaml). The generated React hooks and Zod schemas are derived from that file.

Base path:

```text
/api
```

## `GET /healthz`

Returns a basic service health status.

Example response:

```json
{
  "status": "ok"
}
```

## `GET /simulation/snapshot`

Returns the current complete simulation snapshot.

The response includes:

- `warehouse`: active prototype, dimensions, controller state, autonomy state, running state, and elapsed time
- `fleet`: aggregate robot and task metrics
- `robots`: robot telemetry and route metadata
- `tasks`: task assignments, status, pickup, destination, ETA, and capability
- `events`: newest-first event stream
- `conflicts`: active route negotiations
- `selectedRobotId`: current selected robot

Example request:

```bash
curl http://localhost:8080/api/simulation/snapshot
```

## `POST /simulation/command`

Applies an operator command and returns the updated `SimulationSnapshot`.

### Request body

```json
{
  "action": "select_robot",
  "robotId": "R001",
  "fleetSize": null,
  "model": null
}
```

`robotId`, `fleetSize`, and `model` are optional for actions that do not use them. The accepted actions are:

| Action | Effect | Optional fields |
| --- | --- | --- |
| `start` | Resume the simulation | — |
| `pause` | Pause robot movement | — |
| `reset` | Recreate the current fleet state | `fleetSize` |
| `add_task` | Queue a high-priority task | — |
| `fail_robot` | Fail the selected robot and recover its task | `robotId` |
| `create_conflict` | Inject a route negotiation | `robotId` |
| `create_deadlock` | Create a temporary waiting cycle and recover it | — |
| `disable_communication` | Enable local autonomy mode | — |
| `controller_offline` | Take the central controller offline | — |
| `restore_controller` | Restore central control | — |
| `send_to_charge` | Route a robot to charge | `robotId` |
| `reassign_task` | Reassign the robot's active task | `robotId` |
| `set_fleet_size` | Resize between 50 and 500 robots | `fleetSize` |
| `select_robot` | Change the selected robot | `robotId` |
| `set_model` | Load Prototype 1 or Prototype 2 | `model` |

### Prototype model values

```text
Delivery Warehouse Prototype 1
Delivery Warehouse Prototype 2
```

Selecting Prototype 2 automatically creates a 48-robot fleet, applies slower route motion, and emits an event explaining the reduced fleet and wall-aware routing.

### Examples

Select a robot:

```bash
curl -X POST http://localhost:8080/api/simulation/command \
  -H 'content-type: application/json' \
  --data '{"action":"select_robot","robotId":"R001"}'
```

Switch to Prototype 2:

```bash
curl -X POST http://localhost:8080/api/simulation/command \
  -H 'content-type: application/json' \
  --data '{"action":"set_model","model":"Delivery Warehouse Prototype 2"}'
```

Inject a conflict:

```bash
curl -X POST http://localhost:8080/api/simulation/command \
  -H 'content-type: application/json' \
  --data '{"action":"create_conflict","robotId":"R001"}'
```

## Validation and errors

The API validates command bodies with the generated Zod schema. Invalid command bodies return:

```http
400 Bad Request
```

```json
{
  "error": "Invalid simulation command"
}
```

## Generated client

The frontend imports generated hooks from `@workspace/api-client-react`, including:

- `useGetSimulationSnapshot`
- `useHealthCheck`
- `useSendSimulationCommand`

If the OpenAPI contract changes, regenerate the client and Zod packages before updating frontend callers.