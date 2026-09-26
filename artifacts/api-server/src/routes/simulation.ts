import { Router, type IRouter } from "express";
import {
  GetSimulationSnapshotResponse,
  SendSimulationCommandBody,
  SendSimulationCommandResponse,
} from "@workspace/api-zod";

type Robot = {
  id: string;
  type: string;
  status: string;
  battery: number;
  x: number;
  y: number;
  speed: number;
  taskId: string;
  destination: string;
  route: string[];
  health: number;
};

type Task = {
  id: string;
  priority: string;
  status: string;
  assignedRobot: string;
  pickup: string;
  destination: string;
  eta: number;
  capability: string;
};

type Event = {
  id: string;
  time: string;
  type: string;
  message: string;
};

type Conflict = {
  id: string;
  robotA: string;
  robotB: string;
  distance: number;
  eta: number;
  resolution: string;
  severity: string;
};

type SimulationState = {
  warehouse: {
    model: string;
    dimensions: string;
    controllerOnline: boolean;
    localAutonomy: boolean;
    isRunning: boolean;
    elapsedSeconds: number;
  };
  robots: Robot[];
  tasks: Task[];
  events: Event[];
  conflicts: Conflict[];
  selectedRobotId: string;
  completed: number;
  deadlocks: number;
  eventSequence: number;
  taskSequence: number;
  conflictSequence: number;
};

type SimulationCommand = {
  action:
    | "start"
    | "pause"
    | "reset"
    | "add_task"
    | "fail_robot"
    | "create_conflict"
    | "create_deadlock"
    | "disable_communication"
    | "controller_offline"
    | "restore_controller"
    | "send_to_charge"
    | "reassign_task"
    | "set_fleet_size"
    | "select_robot"
    | "set_model";
  robotId?: string | null;
  fleetSize?: number | null;
  model?: string | null;
};

type MapPoint = { x: number; y: number };

const dimensions =
  "378m × 156m × 48m | 48,000 m² footprint | 6,714 m² arena";
const robotTypes = ["TRANSPORT", "LIFT", "CLEANING", "INSPECTION", "HEAVY"];
const destinations = ["Dock 4", "Packing", "Storage A", "Storage B", "Charge 03"];
const statuses = ["MOVING", "MOVING", "PICKING", "DELIVERING", "NEGOTIATING"];
const routeNames = [
  ["A12", "B4", "Dock 4"],
  ["C3", "A8", "Packing"],
  ["D6", "B2", "Storage B"],
  ["E2", "C7", "Dock 2"],
];

const laneRoutes: MapPoint[][] = [
  [
    { x: 8, y: 74 }, { x: 22, y: 74 }, { x: 22, y: 53 }, { x: 40, y: 53 },
    { x: 40, y: 29 }, { x: 63, y: 29 }, { x: 63, y: 50 }, { x: 91, y: 50 },
  ],
  [
    { x: 9, y: 25 }, { x: 27, y: 25 }, { x: 27, y: 42 }, { x: 48, y: 42 },
    { x: 48, y: 17 }, { x: 75, y: 17 }, { x: 75, y: 34 }, { x: 91, y: 34 },
  ],
  [
    { x: 9, y: 86 }, { x: 30, y: 86 }, { x: 30, y: 67 }, { x: 50, y: 67 },
    { x: 50, y: 86 }, { x: 72, y: 86 }, { x: 72, y: 63 }, { x: 91, y: 63 },
  ],
  [
    { x: 12, y: 48 }, { x: 31, y: 48 }, { x: 31, y: 31 }, { x: 55, y: 31 },
    { x: 55, y: 53 }, { x: 81, y: 53 }, { x: 81, y: 73 }, { x: 91, y: 73 },
  ],
];

const movementRateForModel = (model: string) =>
  model.includes("Prototype 2") ? 0.08 : 0.18;

const positionOnLane = (
  robotIndex: number,
  elapsedSeconds: number,
  movementRate = 0.18,
) => {
  const lane = laneRoutes[robotIndex % laneRoutes.length];
  const phase = ((elapsedSeconds * movementRate + robotIndex * 0.37) % lane.length + lane.length) % lane.length;
  const segment = Math.floor(phase);
  const progress = phase - segment;
  const current = lane[segment];
  const next = lane[(segment + 1) % lane.length];
  return {
    x: Number((current.x + (next.x - current.x) * progress).toFixed(2)),
    y: Number((current.y + (next.y - current.y) * progress).toFixed(2)),
  };
};

const clockTime = () =>
  new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const createRobots = (
  count: number,
  model = "Delivery Warehouse Prototype 1",
): Robot[] =>
  Array.from({ length: count }, (_, index) => {
    const id = `R${String(index + 1).padStart(3, "0")}`;
    const type = robotTypes[index % robotTypes.length];
    const route = routeNames[index % routeNames.length];
    const isPrototypeTwo = model.includes("Prototype 2");
    const position = positionOnLane(index, 128, movementRateForModel(model));
    return {
      id,
      type,
      status: statuses[index % statuses.length],
      battery: 63 + ((index * 17) % 35),
      x: position.x,
      y: position.y,
      speed: Number(
        (isPrototypeTwo
          ? 0.35 + ((index * 7) % 8) / 10
          : 1.2 + ((index * 7) % 12) / 10
        ).toFixed(1),
      ),
      taskId: `T${String((index % 18) + 1).padStart(2, "0")}`,
      destination: destinations[index % destinations.length],
      route,
      health: 92 + ((index * 3) % 9),
    };
  });

const createTasks = (count: number): Task[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `T${String(index + 1).padStart(2, "0")}`,
    priority: index % 5 === 0 ? "HIGH" : index % 3 === 0 ? "MEDIUM" : "NORMAL",
    status: index < 4 ? "IN PROGRESS" : index % 4 === 0 ? "QUEUED" : "IN PROGRESS",
    assignedRobot: `R${String((index % 18) + 1).padStart(3, "0")}`,
    pickup: ["Storage A", "Inbound", "Quality Check", "Return Room 2"][index % 4],
    destination: destinations[index % destinations.length],
    eta: 18 + ((index * 11) % 54),
    capability: ["Transport", "Lift", "Inspection", "Heavy"][index % 4],
  }));

const newState = (fleetSize = 500): SimulationState => ({
  warehouse: {
    model: "Delivery Warehouse Prototype 1",
    dimensions,
    controllerOnline: true,
    localAutonomy: false,
    isRunning: true,
    elapsedSeconds: 128,
  },
  robots: createRobots(fleetSize),
  tasks: createTasks(24),
  events: [
    {
      id: "E-005",
      time: "10:42:31",
      type: "SYSTEM",
      message: "Fleet controller online · 500 agents synchronized",
    },
    {
      id: "E-004",
      time: "10:42:26",
      type: "TASK",
      message: "T73 reassigned to R034 · battery-aware scheduling",
    },
    {
      id: "E-003",
      time: "10:42:21",
      type: "RECOVERY",
      message: "Deadlock recovered · alternate route reserved",
    },
    {
      id: "E-002",
      time: "10:42:15",
      type: "NEGOTIATION",
      message: "R221 granted right-of-way at Junction C4",
    },
    {
      id: "E-001",
      time: "10:42:12",
      type: "TASK",
      message: "R127 assigned T42 · capability and proximity match",
    },
  ],
  conflicts: [
    {
      id: "C-01",
      robotA: "R127",
      robotB: "R221",
      distance: 1.4,
      eta: 2.2,
      resolution: "R221 WAIT",
      severity: "HIGH",
    },
  ],
  selectedRobotId: "R127",
  completed: 812,
  deadlocks: 2,
  eventSequence: 5,
  taskSequence: 24,
  conflictSequence: 1,
});

let state = newState();

const addEvent = (type: string, message: string) => {
  state.eventSequence += 1;
  state.events = [
    {
      id: `E-${String(state.eventSequence).padStart(3, "0")}`,
      time: clockTime(),
      type,
      message,
    },
    ...state.events,
  ].slice(0, 12);
};

const nextRobot = (predicate: (robot: Robot) => boolean) =>
  state.robots.find(predicate) ?? state.robots[0];

const reassignTask = (robot: Robot, reason: string) => {
  const task = state.tasks.find((item) => item.assignedRobot === robot.id);
  if (!task) return;
  const replacement = nextRobot(
    (candidate) =>
      candidate.id !== robot.id &&
      candidate.health > 60 &&
      candidate.battery > 35 &&
      candidate.status !== "FAILED" &&
      candidate.status !== "CHARGING",
  );
  if (!replacement) return;
  task.assignedRobot = replacement.id;
  task.status = "REASSIGNED";
  replacement.taskId = task.id;
  replacement.status = "REROUTING";
  addEvent("TASK", `${task.id} reassigned ${robot.id} → ${replacement.id} · ${reason}`);
};

const updateTaskTelemetry = () => {
  if (state.warehouse.elapsedSeconds % 8 !== 0) return;

  const activeAssignments = state.tasks.filter((task) => {
    const robot = state.robots.find((candidate) => candidate.id === task.assignedRobot);
    return (
      robot &&
      !["FAILED", "OFFLINE", "CHARGING", "WAITING", "BLOCKED"].includes(
        robot.status,
      )
    );
  });
  if (activeAssignments.length === 0) return;

  const task =
    activeAssignments[
      Math.floor(state.warehouse.elapsedSeconds / 8) % activeAssignments.length
    ];
  const robot = state.robots.find(
    (candidate) => candidate.id === task.assignedRobot,
  );
  if (!robot) return;

  task.status = robot.status === "DELIVERING" ? "DELIVERING" : "IN TRANSIT";
  task.eta = Math.max(1, task.eta - 1);
  addEvent(
    "TASK",
    `${task.id} update · ${robot.id} ${task.status.toLowerCase()} to ${task.destination} · ETA ${task.eta}m`,
  );
};

const advanceRobots = () => {
  if (!state.warehouse.isRunning) return;
  state.warehouse.elapsedSeconds += 1;
  state.robots = state.robots.map((robot, index) => {
    if (
      ["FAILED", "OFFLINE", "CHARGING", "WAITING", "BLOCKED"].includes(
        robot.status,
      )
    ) {
      return robot;
    }
    const position = positionOnLane(
      index,
      state.warehouse.elapsedSeconds,
      movementRateForModel(state.warehouse.model),
    );
    const battery =
      state.warehouse.elapsedSeconds % 12 === 0
        ? Math.max(robot.battery - 1, 5)
        : robot.battery;
    let status = robot.status;
    if (battery <= 12) status = "CRITICAL BATTERY";
    else if (battery <= 22) status = "LOW BATTERY";
    return {
      ...robot,
      x: position.x,
      y: position.y,
      battery,
      status,
    };
  });
  updateTaskTelemetry();
};

const getStats = () => {
  const count = (status: string) =>
    state.robots.filter((robot) => robot.status === status).length;
  const working = state.robots.filter((robot) =>
    ["MOVING", "PICKING", "DELIVERING", "REROUTING"].includes(robot.status),
  ).length;
  const lowBattery = state.robots.filter(
    (robot) => robot.battery <= 22 && robot.status !== "CHARGING",
  ).length;
  return {
    total: state.robots.length,
    working,
    idle: count("IDLE"),
    charging: count("CHARGING"),
    lowBattery,
    failed: count("FAILED"),
    negotiating: count("NEGOTIATING"),
    conflicts: state.conflicts.length,
    deadlocks: state.deadlocks,
    tasks: 1240 + state.tasks.length - 24,
    completed: state.completed,
    utilization: Math.round((working / Math.max(state.robots.length, 1)) * 100),
  };
};

const snapshot = () =>
  GetSimulationSnapshotResponse.parse({
    warehouse: state.warehouse,
    fleet: getStats(),
    robots: state.robots,
    tasks: state.tasks,
    events: state.events,
    conflicts: state.conflicts,
    selectedRobotId: state.selectedRobotId,
  });

const applyCommand = (command: SimulationCommand) => {
  const selected = command.robotId
    ? state.robots.find((robot) => robot.id === command.robotId) ??
      nextRobot((robot) => robot.status !== "FAILED")
    : nextRobot((robot) => robot.status !== "FAILED");

  switch (command.action) {
    case "start":
      state.warehouse.isRunning = true;
      addEvent("SYSTEM", "Simulation resumed · route execution online");
      break;
    case "pause":
      state.warehouse.isRunning = false;
      addEvent("SYSTEM", "Simulation paused · fleet holding current state");
      break;
    case "reset":
      state = newState(command.fleetSize ?? state.robots.length);
      addEvent("SYSTEM", "Simulation reset · fleet state rehydrated");
      break;
    case "set_fleet_size": {
      const size = Math.min(500, Math.max(50, command.fleetSize ?? 500));
      const existing = new Map(state.robots.map((robot) => [robot.id, robot]));
      state.robots = createRobots(size).map((robot) => existing.get(robot.id) ?? robot);
      state.warehouse.isRunning = true;
      addEvent("SYSTEM", `Fleet resized to ${size} agents · topology recalculated`);
      break;
    }
    case "select_robot":
      if (selected) state.selectedRobotId = selected.id;
      break;
    case "set_model":
      if (
        command.model === "Delivery Warehouse Prototype 1" ||
        command.model === "Delivery Warehouse Prototype 2"
      ) {
        state.warehouse.model = command.model;
        const targetFleetSize = command.model === "Delivery Warehouse Prototype 2" ? 48 : 500;
        if (state.robots.length !== targetFleetSize) {
          state.robots = createRobots(targetFleetSize, command.model);
          state.selectedRobotId = state.robots[0]?.id ?? "";
        }
        addEvent("SYSTEM", `${command.model} loaded · spatial model synchronized`);
        if (command.model === "Delivery Warehouse Prototype 2") {
          addEvent("SYSTEM", "Prototype 2 reduced to 48 mobile units · wall-aware routes active");
        }
      }
      break;
    case "fail_robot":
      if (selected) {
        selected.status = "FAILED";
        selected.health = 0;
        selected.speed = 0;
        reassignTask(selected, "failure recovery");
        addEvent("FAILURE", `${selected.id} offline · unfinished mission recovery active`);
      }
      break;
    case "send_to_charge":
      if (selected) {
        selected.status = "CHARGING";
        reassignTask(selected, "battery reserve");
        addEvent("BATTERY", `${selected.id} routed to nearest charging station`);
      }
      break;
    case "create_conflict": {
      const robotA = selected ?? state.robots[0];
      const robotB = nextRobot((robot) => robot.id !== robotA?.id);
      if (robotA && robotB) {
        state.conflictSequence += 1;
        robotA.status = "NEGOTIATING";
        robotB.status = "WAITING";
        state.conflicts = [
          {
            id: `C-${String(state.conflictSequence).padStart(2, "0")}`,
            robotA: robotA.id,
            robotB: robotB.id,
            distance: 1.2,
            eta: 2.4,
            resolution: `${robotB.id} WAIT`,
            severity: "HIGH",
          },
          ...state.conflicts,
        ].slice(0, 4);
        addEvent(
          "NEGOTIATION",
          `Collision predicted · ${robotA.id} requests right-of-way from ${robotB.id}`,
        );
      }
      break;
    }
    case "create_deadlock": {
      const cycle = state.robots.filter((robot) => robot.status !== "FAILED").slice(0, 3);
      cycle.forEach((robot) => {
        robot.status = "WAITING";
      });
      state.deadlocks += 1;
      addEvent(
        "DEADLOCK",
        `Deadlock detected · ${cycle.map((robot) => robot.id).join(" → ")} → ${cycle[0]?.id ?? "R001"}`,
      );
      setTimeout(() => {
        cycle.forEach((robot, index) => {
          robot.status = index === 0 ? "REROUTING" : "MOVING";
        });
        addEvent("RECOVERY", "Deadlock recovered · alternate routes reserved");
      }, 2200);
      break;
    }
    case "disable_communication":
      state.warehouse.localAutonomy = true;
      addEvent("SYSTEM", "Communication degraded · local autonomy active");
      break;
    case "controller_offline":
      state.warehouse.controllerOnline = false;
      state.warehouse.localAutonomy = true;
      addEvent("FAILURE", "Central controller offline · peer-to-peer coordination active");
      break;
    case "restore_controller":
      state.warehouse.controllerOnline = true;
      state.warehouse.localAutonomy = false;
      addEvent("RECOVERY", "Controller restored · mission state synchronized");
      break;
    case "reassign_task": {
      const source = selected ?? state.robots[0];
      if (source) reassignTask(source, "operator command");
      break;
    }
    case "add_task": {
      state.taskSequence += 1;
      const assigned = nextRobot(
        (robot) => robot.status === "IDLE" || robot.status === "MOVING",
      );
      const task: Task = {
        id: `T${String(state.taskSequence).padStart(2, "0")}`,
        priority: "HIGH",
        status: "IN PROGRESS",
        assignedRobot: assigned?.id ?? "UNASSIGNED",
        pickup: "Quality Check",
        destination: "Dock 4",
        eta: 42,
        capability: "Transport",
      };
      state.tasks = [task, ...state.tasks].slice(0, 36);
      if (assigned) {
        assigned.taskId = task.id;
        assigned.status = "MOVING";
      }
      addEvent("TASK", `${task.id} created · ${task.assignedRobot} assigned by proximity`);
      break;
    }
  }
};

const router: IRouter = Router();

router.get("/simulation/snapshot", (_req, res) => {
  res.json(snapshot());
});

router.post("/simulation/command", (req, res) => {
  const parsed = SendSimulationCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid simulation command" });
    return;
  }
  applyCommand(parsed.data);
  res.json(SendSimulationCommandResponse.parse(snapshot()));
});

setInterval(advanceRobots, 1000);

export default router;