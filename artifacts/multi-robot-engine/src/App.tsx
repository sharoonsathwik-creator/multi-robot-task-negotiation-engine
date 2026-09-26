import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bot,
  ChevronDown,
  CircleDot,
  Clock3,
  Command,
  Crosshair,
  Factory,
  Gauge,
  Layers3,
  LocateFixed,
  Maximize2,
  Menu,
  MessageSquareWarning,
  Pause,
  Play,
  Power,
  Radio,
  RotateCcw,
  Route as RouteIcon,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Target,
  TerminalSquare,
  TrafficCone,
  TriangleAlert,
  Wifi,
  X,
  ZoomIn,
  ZoomOut,
  Zap,
} from 'lucide-react';
import {
  getGetSimulationSnapshotQueryKey,
  getHealthCheckQueryKey,
  useGetSimulationSnapshot,
  useHealthCheck,
  useSendSimulationCommand,
} from '@workspace/api-client-react';
import type {
  Conflict,
  Robot,
  SimulationCommandInput,
  SimulationSnapshot,
  Task,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';

const queryClient = new QueryClient();

type CommandAction = SimulationCommandInput['action'];
type Tone = 'green' | 'red' | 'yellow' | 'sky' | 'slate';

const colorForType = (type: string): Tone => {
  const value = type.toLowerCase();
  if (value.includes('lift') || value.includes('heavy')) return 'red';
  if (value.includes('scan') || value.includes('inspect')) return 'yellow';
  if (value.includes('clean')) return 'sky';
  if (value.includes('tug') || value.includes('carry')) return 'sky';
  return 'green';
};

const toneClass: Record<Tone, string> = {
  green: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/25',
  red: 'text-rose-300 bg-rose-400/10 border-rose-300/25',
  yellow: 'text-amber-200 bg-amber-400/10 border-amber-300/25',
  sky: 'text-sky-300 bg-sky-400/10 border-sky-300/25',
  slate: 'text-slate-300 bg-slate-400/10 border-slate-300/20',
};

const toneHex: Record<Tone, string> = {
  green: '#55d8a1',
  red: '#f1766d',
  yellow: '#e9c65c',
  sky: '#65c9ee',
  slate: '#9aaab3',
};

type MapPoint = { x: number; y: number };

const warehousePaths: MapPoint[][] = [
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

const mapPointString = (points: MapPoint[]) => points.map((point) => `${point.x},${point.y}`).join(' ');

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const displayValue = (value: string | number | undefined, fallback = '—') =>
  value === undefined || value === '' ? fallback : value;

function MetricTile({
  label,
  value,
  sub,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden border-r border-[hsl(var(--border)/.65)] px-4 py-3 last:border-r-0 hover:bg-[hsl(var(--elevate-1))]">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
        <span className={tone === 'slate' ? 'text-muted-foreground' : toneClass[tone].split(' ')[0]}>{icon}</span>
        <span data-testid={`label-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <strong className="font-mono text-[25px] font-medium leading-none tracking-[-.06em] text-foreground" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
          {value}
        </strong>
        {sub && <span className="pb-0.5 text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function StatusPill({ label, tone = 'slate', pulse = false }: { label: string; tone?: Tone; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-medium uppercase tracking-[.1em] ${toneClass[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pulse ? 'pulse-dot' : ''}`} style={{ backgroundColor: toneHex[tone] }} />
      {label}
    </span>
  );
}

function SkeletonDashboard() {
  return (
    <div className="grid min-h-[560px] animate-pulse gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="rounded-lg border border-border bg-card/70" />
      <div className="space-y-3">
        <div className="h-52 rounded-lg border border-border bg-card/70" />
        <div className="h-64 rounded-lg border border-border bg-card/70" />
      </div>
    </div>
  );
}

function WarehouseMap({
  snapshot,
  selectedRobot,
  onSelectRobot,
  povActive,
  showLabels,
  showLanes,
  mapExpanded,
  locatePulse,
  onLocate,
  onToggleExpand,
}: {
  snapshot: SimulationSnapshot;
  selectedRobot?: Robot;
  onSelectRobot: (id: string) => void;
  povActive?: boolean;
  showLabels: boolean;
  showLanes: boolean;
  mapExpanded: boolean;
  locatePulse: boolean;
  onLocate: () => void;
  onToggleExpand: () => void;
}) {
  const { robots, conflicts } = snapshot;
  const visibleRobots = robots.length > 0 ? robots : [];
  const prototypeTwo = snapshot.warehouse.model.includes('Prototype 2');
  const selectedRobotIndex = selectedRobot ? Math.max(0, Number(selectedRobot.id.replace(/\D/g, '')) - 1) : 0;
  const selectedPath = selectedRobot ? warehousePaths[selectedRobotIndex % warehousePaths.length] : undefined;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const clampZoom = (value: number) => Math.min(2.8, Math.max(0.75, Number(value.toFixed(2))));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((value) => clampZoom(value + (event.deltaY < 0 ? 0.15 : -0.15)));
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + event.clientX - dragStart.current.x,
      y: dragStart.current.panY + event.clientY - dragStart.current.y,
    });
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className={`warehouse-stage relative min-h-[500px] overflow-hidden rounded-lg border border-[hsl(var(--border)/.8)] p-3 sm:min-h-[610px] ${prototypeTwo ? 'prototype-two' : ''} ${povActive ? 'pov-active' : ''} ${mapExpanded ? 'map-expanded' : ''}`}>
      <div className="pointer-events-none absolute inset-x-5 top-4 z-10 flex items-start justify-between">
        <div>
          <p className="mono-label text-emerald-200/70">Spatial command view</p>
          <p className="mt-1 text-xs text-muted-foreground">Live occupancy / route negotiation</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 pulse-dot" />
          <span className="font-mono">{snapshot.warehouse.dimensions || '96m × 64m'}</span>
        </div>
      </div>
      {povActive && selectedRobot && (
        <div className="absolute left-5 top-14 z-20 flex items-center gap-2 rounded border border-sky-300/40 bg-sky-300/10 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-sky-100">
          <Crosshair size={13} className="text-sky-300" /> POV link · {selectedRobot.id} · navigation feed
        </div>
      )}
      <div
        className={`warehouse-viewport absolute inset-x-[8%] bottom-[8%] top-[16%] [perspective:850px] ${dragging ? 'is-dragging' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={resetView}
        aria-label="Interactive warehouse map. Drag to pan, scroll to zoom, double click to reset."
      >
        <div
          className="warehouse-floor absolute inset-0 overflow-hidden rounded-[3px] border border-emerald-200/20"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotateX(58deg) rotateZ(-28deg) scale(${1.09 * zoom})`,
          }}
        >
          {prototypeTwo && (
            <div className="prototype-two-walls pointer-events-none absolute inset-0" aria-label="Prototype 2 safety walls">
              <div className="warehouse-wall absolute left-[18%] top-[12%] h-[5%] w-[57%]" />
              <div className="warehouse-wall absolute left-[18%] top-[12%] h-[54%] w-[4%]" />
              <div className="warehouse-wall absolute left-[75%] top-[12%] h-[54%] w-[4%]" />
              <div className="warehouse-wall absolute left-[18%] top-[62%] h-[5%] w-[61%]" />
              <div className="warehouse-wall absolute left-[38%] top-[35%] h-[5%] w-[26%]" />
              <div className="warehouse-wall absolute left-[48%] top-[35%] h-[28%] w-[4%]" />
              <div className="warehouse-wall absolute left-[82%] top-[38%] h-[30%] w-[4%]" />
            </div>
          )}
          <div className="warehouse-zone absolute left-[7%] top-[10%] h-[18%] w-[21%] rounded-sm">
          </div>
          <div className="warehouse-zone absolute bottom-[9%] right-[7%] h-[19%] w-[23%] rounded-sm">
          </div>
          <div className="warehouse-zone absolute left-[29%] top-[34%] h-[8%] w-[13%] rounded-sm opacity-70" />
          <div className="warehouse-zone absolute left-[53%] top-[34%] h-[8%] w-[13%] rounded-sm opacity-70" />
          <div className="warehouse-zone absolute bottom-[10%] left-[9%] h-[9%] w-[17%] rounded-sm opacity-70" />
          <div className="warehouse-zone absolute bottom-[10%] left-[39%] h-[9%] w-[17%] rounded-sm opacity-70" />
          <div className="warehouse-zone absolute bottom-[10%] left-[61%] h-[9%] w-[14%] rounded-sm opacity-70" />
          <div className="absolute left-[38%] top-[12%] h-[75%] w-[1px] bg-amber-300/25" />
          <div className="absolute left-[66%] top-[12%] h-[75%] w-[1px] bg-amber-300/25" />
          {[0, 1, 2, 3, 4, 5].map((rack) => (
            <div key={`rack-a-${rack}`} className="warehouse-rack absolute left-[28%] h-[7%] w-[14%] rounded-sm" style={{ top: `${18 + rack * 12}%` }} />
          ))}
          {[0, 1, 2, 3, 4].map((rack) => (
            <div key={`rack-b-${rack}`} className="warehouse-rack absolute left-[53%] h-[7%] w-[13%] rounded-sm" style={{ top: `${24 + rack * 13}%` }} />
          ))}
          {[0, 1, 2].map((dock) => (
            <div key={`dock-${dock}`} className="absolute bottom-[9%] left-[9%] h-[5%] w-[12%] border border-sky-300/35 bg-sky-300/10" style={{ transform: `translateX(${dock * 125}%)` }} />
          ))}
          {showLanes && <svg className="warehouse-lane-overlay pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="warehouse-lane-arrow" markerWidth="3.5" markerHeight="3.5" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#86d9bd" />
              </marker>
              <marker id="warehouse-selected-arrow" markerWidth="4.5" markerHeight="4.5" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f3cc61" />
              </marker>
            </defs>
            {warehousePaths.map((path, index) => (
              <polyline
                key={`warehouse-path-${index}`}
                points={mapPointString(path)}
                fill="none"
                className="warehouse-lane"
                markerMid="url(#warehouse-lane-arrow)"
                markerEnd="url(#warehouse-lane-arrow)"
              />
            ))}
          </svg>}
          {showLanes && selectedRobot && selectedPath && (
            <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={mapPointString(selectedPath)}
                fill="none"
                stroke={toneHex[colorForType(selectedRobot.type)]}
                strokeWidth="0.85"
                className="route-line"
                markerMid="url(#warehouse-selected-arrow)"
                markerEnd="url(#warehouse-selected-arrow)"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {showLanes && prototypeTwo && (
            <div className="pointer-events-none absolute left-[19%] top-[70%] z-[2] rounded-sm border border-amber-200/30 bg-slate-950/50 px-2 py-1 font-mono text-[7px] uppercase tracking-[.14em] text-amber-100/80">
              wall-aware route network · 48 units
            </div>
          )}
          {showLabels && <>
            <div className="warehouse-label warehouse-hologram absolute left-[8%] top-[13%]">Inbound</div>
            <div className="warehouse-label warehouse-hologram absolute left-[29%] top-[36%]">Storage A</div>
            <div className="warehouse-label warehouse-hologram absolute left-[53%] top-[36%]">Storage B</div>
            <div className="warehouse-label warehouse-hologram absolute left-[12%] top-[48%]">Quality Check</div>
            <div className="warehouse-label warehouse-hologram absolute left-[9%] bottom-[12%]">Dock 4</div>
            <div className="warehouse-label warehouse-hologram absolute left-[40%] bottom-[12%]">Packing</div>
            <div className="warehouse-label warehouse-hologram absolute left-[62%] bottom-[12%]">Charge 03</div>
            <div className="warehouse-label warehouse-hologram absolute right-[8%] bottom-[13%]">Return Room 2</div>
            <div className="warehouse-label warehouse-hologram absolute right-[9%] top-[48%]">Outbound</div>
          </>}
          {visibleRobots.map((robot, index) => {
            const tone = colorForType(robot.type);
            const x = Math.min(91, Math.max(7, robot.x || 10 + (index * 17) % 82));
            const y = Math.min(90, Math.max(8, robot.y || 18 + (index * 21) % 65));
            const active = robot.id === snapshot.selectedRobotId;
            const glow = active
              ? `0 0 0 2px #f3cc61, 0 0 0 5px rgba(239, 200, 90, .24), 0 0 14px ${toneHex[tone]}`
              : `0 0 0 1px rgba(6, 15, 20, .72), 0 0 8px ${toneHex[tone]}aa`;
            return (
              <button
                key={robot.id}
                type="button"
                className={`robot-token absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${active ? 'selected' : ''}`}
                style={{ left: `${x}%`, top: `${y}%`, backgroundColor: toneHex[tone], boxShadow: glow }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRobot(robot.id);
                }}
                data-testid={`button-select-robot-${robot.id}`}
                aria-label={`Select ${robot.id}`}
                title={`${robot.id} · ${robot.status}`}
              />
            );
          })}
          {conflicts.slice(0, 3).map((conflict, index) => (
            <div
              className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-300/60 bg-rose-400/15 text-rose-200"
              key={conflict.id}
              style={{ left: `${31 + index * 23}%`, top: `${42 + (index % 2) * 17}%` }}
              title={`${conflict.robotA} / ${conflict.robotB}`}
            >
              <TriangleAlert size={13} />
            </div>
          ))}
          {locatePulse && selectedRobot && (
            <div
              className="map-locate-target absolute z-30"
              style={{ left: `${Math.min(91, Math.max(7, selectedRobot.x))}%`, top: `${Math.min(90, Math.max(8, selectedRobot.y))}%` }}
              aria-label={`Centered on ${selectedRobot.id}`}
            >
              <LocateFixed size={26} />
            </div>
          )}
        </div>
      </div>
      <div className="absolute left-4 top-12 z-20 flex items-center gap-1 rounded border border-border bg-[hsl(var(--card)/.9)] p-1 shadow-lg" data-testid="map-zoom-controls">
        <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-[hsl(var(--elevate-1))] hover:text-foreground" onClick={() => setZoom((value) => clampZoom(value + 0.2))} aria-label="Zoom in" title="Zoom in" data-testid="button-map-zoom-in"><ZoomIn size={14} /></button>
        <span className="min-w-[42px] text-center font-mono text-[10px] text-emerald-200">{Math.round(zoom * 100)}%</span>
        <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-[hsl(var(--elevate-1))] hover:text-foreground" onClick={() => setZoom((value) => clampZoom(value - 0.2))} aria-label="Zoom out" title="Zoom out" data-testid="button-map-zoom-out"><ZoomOut size={14} /></button>
        <button type="button" className="rounded px-1.5 py-1.5 text-[9px] uppercase tracking-wider text-muted-foreground hover:bg-[hsl(var(--elevate-1))] hover:text-foreground" onClick={resetView} title="Reset map view" data-testid="button-map-reset-view">Reset</button>
      </div>
      <div className="pointer-events-none absolute bottom-12 right-4 z-20 rounded border border-border/80 bg-[hsl(var(--card)/.78)] px-2.5 py-2 text-[9px] leading-relaxed text-muted-foreground shadow-lg">
        <span className="text-emerald-200">DRAG</span> pan · <span className="text-emerald-200">SCROLL</span> zoom · <span className="text-emerald-200">DOUBLE CLICK</span> reset
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
        {(['green', 'red', 'yellow', 'sky'] as Tone[]).map((tone) => (
          <span key={tone} className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: toneHex[tone] }} />
            {tone === 'green' ? 'standard' : tone === 'red' ? 'heavy lift' : tone === 'yellow' ? 'inspection' : 'tug / carry'}
          </span>
        ))}
        <span className="ml-auto font-mono text-muted-foreground/70">N↑ / 10 m grid</span>
      </div>
      <div className="absolute right-4 top-12 z-10 flex flex-col gap-1.5">
        <button className="rounded border border-border bg-[hsl(var(--card)/.88)] p-2 text-muted-foreground hover:text-foreground" type="button" onClick={onLocate} data-testid="button-map-locate" title="Center selected robot" aria-label="Center selected robot">
          <LocateFixed size={14} />
        </button>
        <button className="rounded border border-border bg-[hsl(var(--card)/.88)] p-2 text-muted-foreground hover:text-foreground" type="button" onClick={onToggleExpand} data-testid="button-map-expand" title={mapExpanded ? 'Close expanded spatial view' : 'Expand spatial view'} aria-label={mapExpanded ? 'Close expanded spatial view' : 'Expand spatial view'}>
          {mapExpanded ? <X size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}

function RobotDetail({ robot, onCommand, povActive, onTogglePov }: { robot?: Robot; onCommand: (action: CommandAction, robotId?: string) => void; povActive: boolean; onTogglePov: () => void }) {
  if (!robot) {
    return (
      <div className="flex min-h-[245px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-6 text-center">
        <Crosshair className="mb-3 text-muted-foreground" size={22} />
        <p className="text-sm text-foreground">Select a robot in the spatial view</p>
        <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">Telemetry, route intent, and controls will appear here.</p>
      </div>
    );
  }
  const tone = colorForType(robot.type);
  return (
    <div className="rounded-lg border border-border bg-card/80 p-4 live-reveal" data-testid={`panel-robot-detail-${robot.id}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded border ${toneClass[tone]}`}><Bot size={20} /></div>
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">{robot.id}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{robot.type} platform</p>
          </div>
        </div>
        <StatusPill label={robot.status || 'unknown'} tone={robot.status?.toLowerCase().includes('fail') ? 'red' : tone} pulse />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border/70 py-3">
        <div><p className="mono-label text-muted-foreground">Battery</p><p className="mt-1 font-mono text-sm text-foreground">{robot.battery}%</p></div>
        <div><p className="mono-label text-muted-foreground">Velocity</p><p className="mt-1 font-mono text-sm text-foreground">{robot.speed} m/s</p></div>
        <div><p className="mono-label text-muted-foreground">Health</p><p className="mt-1 font-mono text-sm text-foreground">{robot.health}%</p></div>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Current assignment</span><span className="font-mono text-foreground">{displayValue(robot.taskId, 'unassigned')}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Destination</span><span className="max-w-[150px] truncate text-right text-foreground">{displayValue(robot.destination, 'standby')}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Position</span><span className="font-mono text-foreground">{robot.x.toFixed(1)} / {robot.y.toFixed(1)}</span></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className={`flex flex-1 items-center justify-center gap-2 rounded border px-2 py-2 text-[10px] uppercase tracking-wider ${povActive ? 'border-sky-300/50 bg-sky-400/20 text-sky-100' : 'border-sky-300/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20'}`} onClick={onTogglePov} data-testid={`button-pov-robot-${robot.id}`}>
          <Crosshair size={13} /> {povActive ? 'Exit POV' : 'Enter POV'}
        </button>
        <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded border border-emerald-300/25 bg-emerald-400/10 px-2 py-2 text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-400/20" onClick={() => onCommand('reassign_task', robot.id)} data-testid={`button-reassign-robot-${robot.id}`}>
          <RouteIcon size={13} /> Reassign
        </button>
        <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-300/30 bg-amber-400/10 px-2 py-2 text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-400/20" onClick={() => onCommand('send_to_charge', robot.id)} data-testid={`button-charge-robot-${robot.id}`}>
          <BatteryCharging size={13} /> Charge
        </button>
        <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded border border-rose-300/30 bg-rose-400/10 px-2 py-2 text-[10px] uppercase tracking-wider text-rose-200 hover:bg-rose-400/20" onClick={() => onCommand('fail_robot', robot.id)} data-testid={`button-fail-robot-${robot.id}`}>
          <Power size={13} /> Fail
        </button>
      </div>
    </div>
  );
}

function ConflictFeed({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <div className="rounded-lg border border-border bg-card/80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2"><MessageSquareWarning size={15} className="text-amber-200" /><h2 className="text-xs font-semibold uppercase tracking-[.12em]">Negotiation queue</h2></div>
        <span className="font-mono text-[10px] text-muted-foreground">{conflicts.length.toString().padStart(2, '0')} open</span>
      </div>
      <div className="divide-y divide-border/70">
        {conflicts.length === 0 ? (
          <div className="px-4 py-8 text-center"><ShieldCheck className="mx-auto mb-2 text-emerald-300/70" size={20} /><p className="text-xs text-muted-foreground">No route conflicts in queue</p></div>
        ) : conflicts.slice(0, 4).map((conflict) => (
          <div className="px-4 py-3" key={conflict.id} data-testid={`row-conflict-${conflict.id}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-foreground">{conflict.robotA} <span className="text-muted-foreground">↔</span> {conflict.robotB}</span><StatusPill label={conflict.severity} tone={conflict.severity.toLowerCase().includes('high') ? 'red' : 'yellow'} /></div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{conflict.resolution}</span><span className="font-mono">{conflict.distance}m / {conflict.eta}s</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventStream({ events }: { events: SimulationSnapshot['events'] }) {
  return (
    <div className="rounded-lg border border-border bg-card/80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Activity size={15} className="text-sky-300" /><h2 className="text-xs font-semibold uppercase tracking-[.12em]">Event stream</h2></div><span className="mono-label text-muted-foreground">last 06</span></div>
      <div className="max-h-[268px] divide-y divide-border/60 overflow-auto">
        {events.length === 0 ? <p className="px-4 py-8 text-center text-xs text-muted-foreground">Awaiting telemetry events.</p> : events.slice(0, 6).map((event) => (
          <div className="flex gap-3 px-4 py-3" key={event.id} data-testid={`event-${event.id}`}>
            <span className="pt-0.5 font-mono text-[10px] text-muted-foreground">{event.time}</span>
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-emerald-300">{event.type}</p><p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{event.message}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskRail({ tasks, onCommand }: { tasks: Task[]; onCommand: (action: CommandAction, robotId?: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card/80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Target size={15} className="text-emerald-300" /><h2 className="text-xs font-semibold uppercase tracking-[.12em]">Mission ledger</h2></div><button className="text-[10px] uppercase tracking-wider text-emerald-300 hover:text-emerald-200" type="button" onClick={() => onCommand('add_task')} data-testid="button-add-task">+ Queue task</button></div>
      <div className="max-h-[294px] divide-y divide-border/60 overflow-auto">
        {tasks.length === 0 ? <p className="px-4 py-8 text-center text-xs text-muted-foreground">No missions staged.</p> : tasks.slice(0, 7).map((task) => (
          <div className="group px-4 py-3 hover:bg-[hsl(var(--elevate-1))]" key={task.id} data-testid={`row-task-${task.id}`}>
            <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-foreground">{task.id}</span><span className={`text-[10px] uppercase tracking-wider ${task.priority.toLowerCase().includes('high') ? 'text-amber-200' : 'text-muted-foreground'}`}>{task.priority}</span></div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px]"><span className="truncate text-muted-foreground">{task.pickup} <span className="px-1 text-emerald-300">→</span> {task.destination}</span><StatusPill label={task.status} tone={task.status.toLowerCase().includes('complete') ? 'green' : task.status.toLowerCase().includes('fail') ? 'red' : 'sky'} /></div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{task.assignedRobot || 'awaiting assignment'}</span><span>ETA {task.eta}m</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandBar({ snapshot, onCommand, pending }: { snapshot: SimulationSnapshot; onCommand: (action: CommandAction, robotId?: string) => void; pending: boolean }) {
  const running = snapshot.warehouse.isRunning;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/80 p-2">
      <button className={`flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider ${running ? 'bg-amber-300/15 text-amber-200 hover:bg-amber-300/25' : 'bg-emerald-300/15 text-emerald-200 hover:bg-emerald-300/25'}`} type="button" onClick={() => onCommand(running ? 'pause' : 'start')} disabled={pending} data-testid="button-toggle-simulation">
        {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause fleet' : 'Start simulation'}
      </button>
      <button className="flex items-center gap-2 rounded border border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:bg-[hsl(var(--elevate-1))] hover:text-foreground" type="button" onClick={() => onCommand('reset')} disabled={pending} data-testid="button-reset-simulation"><RotateCcw size={14} /> Reset</button>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
      <button className="flex items-center gap-2 rounded border border-rose-300/25 px-3 py-2 text-xs uppercase tracking-wider text-rose-200 hover:bg-rose-400/10" type="button" onClick={() => onCommand('create_conflict')} disabled={pending} data-testid="button-create-conflict"><TrafficCone size={14} /> Inject conflict</button>
      <button className="flex items-center gap-2 rounded border border-amber-300/25 px-3 py-2 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-400/10" type="button" onClick={() => onCommand('create_deadlock')} disabled={pending} data-testid="button-create-deadlock"><AlertTriangle size={14} /> Test deadlock</button>
      <button className="flex items-center gap-2 rounded border border-sky-300/25 px-3 py-2 text-xs uppercase tracking-wider text-sky-200 hover:bg-sky-400/10" type="button" onClick={() => onCommand('disable_communication')} disabled={pending} data-testid="button-disable-communication"><Radio size={14} /> Mesh loss</button>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground md:block">Controller</span>
        <button type="button" className="hidden rounded border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground sm:block" onClick={() => onCommand(snapshot.warehouse.controllerOnline ? 'controller_offline' : 'restore_controller')} disabled={pending} data-testid="button-toggle-controller">
          {snapshot.warehouse.controllerOnline ? 'Take offline' : 'Restore'}
        </button>
        <StatusPill label={snapshot.warehouse.controllerOnline ? 'online' : 'offline'} tone={snapshot.warehouse.controllerOnline ? 'green' : 'red'} pulse />
      </div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const { data: snapshot, isLoading, isError, refetch } = useGetSimulationSnapshot({
    query: { queryKey: getGetSimulationSnapshotQueryKey(), refetchInterval: 1000 },
  });
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 10000 } });
  const command = useSendSimulationCommand();
  const [selectedRobotId, setSelectedRobotId] = useState<string>();
  const [mobileNav, setMobileNav] = useState(false);
  const [mode, setMode] = useState('Delivery Warehouse Prototype 1');
  const [povRobotId, setPovRobotId] = useState<string>();
  const [toastMessage, setToastMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLanes, setShowLanes] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [locatePulse, setLocatePulse] = useState(false);
  const [location] = useLocation();
  const labMode = location === '/simulation';

  useEffect(() => {
    if (snapshot?.selectedRobotId) setSelectedRobotId(snapshot.selectedRobotId);
    if (snapshot?.warehouse.model) setMode(snapshot.warehouse.model);
  }, [snapshot?.selectedRobotId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const selectedRobot = useMemo(() => snapshot?.robots.find((robot) => robot.id === selectedRobotId), [snapshot?.robots, selectedRobotId]);
  const onCommand = (action: CommandAction, robotId?: string) => {
    const data: SimulationCommandInput = { action, robotId: robotId ?? null };
    command.mutate({ data }, {
      onSuccess: (next) => {
        queryClient.setQueryData(getGetSimulationSnapshotQueryKey(), next);
        if (next.selectedRobotId) setSelectedRobotId(next.selectedRobotId);
        setToastMessage(`${action.replaceAll('_', ' ')} acknowledged`);
      },
      onError: () => setToastMessage('Command rejected. Check controller link.'),
    });
  };
  const selectRobot = (id: string) => {
    setSelectedRobotId(id);
    onCommand('select_robot', id);
  };
  const changeMode = (nextMode: string) => {
    setMode(nextMode);
    command.mutate(
      { data: { action: 'set_model', model: nextMode, robotId: null, fleetSize: null } },
      {
        onSuccess: (next) => {
          queryClient.setQueryData(getGetSimulationSnapshotQueryKey(), next);
          setToastMessage(`${nextMode} loaded`);
        },
        onError: () => setToastMessage('Prototype mode could not be loaded.'),
      },
    );
  };
  const locateSelectedRobot = () => {
    if (!selectedRobot) {
      setToastMessage('Select a robot before centering the map.');
      return;
    }
    setLocatePulse(true);
    setToastMessage(`Map centered on ${selectedRobot.id}`);
    window.setTimeout(() => setLocatePulse(false), 1800);
  };

  if (isLoading) return <AppShell mobileNav={mobileNav} setMobileNav={setMobileNav}><SkeletonDashboard /></AppShell>;
  if (isError || !snapshot) return (
    <AppShell mobileNav={mobileNav} setMobileNav={setMobileNav}>
      <div className="flex min-h-[560px] items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/[.04] p-8 text-center">
        <div><TriangleAlert className="mx-auto mb-3 text-rose-300" size={26} /><h2 className="text-lg font-semibold">Simulation link unavailable</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">The command center could not read the current fleet snapshot.</p><button type="button" onClick={() => refetch()} className="mt-5 rounded bg-emerald-300/15 px-4 py-2 text-xs uppercase tracking-wider text-emerald-200 hover:bg-emerald-300/25" data-testid="button-retry-snapshot">Retry connection</button></div>
      </div>
    </AppShell>
  );

  return (
    <AppShell mobileNav={mobileNav} setMobileNav={setMobileNav}>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
           <div className="flex items-center gap-2"><span className="mono-label text-emerald-300">{labMode ? 'Simulation lab / scenario validation' : 'Operations / live mission control'}</span><span className="h-1 w-1 rounded-full bg-emerald-300 pulse-dot" /></div>
           <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-foreground sm:text-3xl">{labMode ? 'Simulation lab' : 'Fleet coordination'} <span className="text-muted-foreground/70">{labMode ? 'test the system.' : 'at a glance.'}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="prototype-mode">Prototype mode</label>
           <select id="prototype-mode" value={mode} onChange={(event) => changeMode(event.target.value)} className="rounded border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-emerald-300/60" data-testid="select-prototype-mode">
            <option>Delivery Warehouse Prototype 1</option>
            <option>Delivery Warehouse Prototype 2</option>
          </select>
           <div className="relative">
             <button className={`rounded border p-2 ${settingsOpen ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200' : 'border-border text-muted-foreground hover:text-foreground'}`} type="button" onClick={() => setSettingsOpen((open) => !open)} title="Simulation settings" aria-label="Open simulation settings" aria-expanded={settingsOpen} data-testid="button-simulation-settings"><SlidersHorizontal size={15} /></button>
             {settingsOpen && (
               <div className="absolute right-0 top-11 z-40 w-64 rounded-lg border border-border bg-[hsl(var(--card))] p-3 shadow-2xl" data-testid="panel-simulation-settings">
                 <div className="mb-3 flex items-start justify-between gap-3"><div><p className="mono-label text-emerald-300">Display settings</p><p className="mt-1 text-xs text-muted-foreground">Tune the spatial command view.</p></div><button type="button" onClick={() => setSettingsOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close simulation settings" data-testid="button-close-settings"><X size={14} /></button></div>
                 <div className="space-y-2">
                   <button type="button" onClick={() => setShowLabels((visible) => !visible)} className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-xs text-foreground hover:bg-[hsl(var(--elevate-1))]" data-testid="button-toggle-map-labels"><span>Hologram labels</span><StatusPill label={showLabels ? 'on' : 'off'} tone={showLabels ? 'green' : 'slate'} /></button>
                   <button type="button" onClick={() => setShowLanes((visible) => !visible)} className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-xs text-foreground hover:bg-[hsl(var(--elevate-1))]" data-testid="button-toggle-map-lanes"><span>Route arrows</span><StatusPill label={showLanes ? 'on' : 'off'} tone={showLanes ? 'green' : 'slate'} /></button>
                   <button type="button" onClick={() => { setShowLabels(true); setShowLanes(true); }} className="w-full rounded border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-300/20" data-testid="button-reset-map-display">Restore map display</button>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>
      <CommandBar snapshot={snapshot} onCommand={onCommand} pending={command.isPending} />
      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card/70 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Fleet" value={snapshot.fleet.total} sub={`${snapshot.fleet.working} active`} icon={<Bot size={13} />} tone="green" />
        <MetricTile label="Working" value={snapshot.fleet.working} sub={`${snapshot.fleet.utilization}% util`} icon={<Gauge size={13} />} tone="sky" />
        <MetricTile label="Charging" value={snapshot.fleet.charging} sub={`${snapshot.fleet.lowBattery} low`} icon={<BatteryCharging size={13} />} tone="yellow" />
        <MetricTile label="Negotiating" value={snapshot.fleet.negotiating} sub="route bids" icon={<RouteIcon size={13} />} tone="green" />
        <MetricTile label="Conflicts" value={snapshot.fleet.conflicts} sub={`${snapshot.fleet.deadlocks} deadlocks`} icon={<AlertTriangle size={13} />} tone="red" />
        <MetricTile label="Completed" value={snapshot.fleet.completed} sub={`${snapshot.fleet.tasks} total tasks`} icon={<ShieldCheck size={13} />} tone="sky" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_310px]">
         <div className="min-w-0"><WarehouseMap snapshot={{ ...snapshot, selectedRobotId: selectedRobotId ?? snapshot.selectedRobotId }} selectedRobot={selectedRobot} onSelectRobot={selectRobot} povActive={povRobotId === selectedRobot?.id} showLabels={showLabels} showLanes={showLanes} mapExpanded={mapExpanded} locatePulse={locatePulse} onLocate={locateSelectedRobot} onToggleExpand={() => setMapExpanded((expanded) => !expanded)} /></div>
         <div className="space-y-3"><RobotDetail robot={selectedRobot} onCommand={onCommand} povActive={povRobotId === selectedRobot?.id} onTogglePov={() => setPovRobotId((current) => current === selectedRobot?.id ? undefined : selectedRobot?.id)} /><ConflictFeed conflicts={snapshot.conflicts} /></div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><TaskRail tasks={snapshot.tasks} onCommand={onCommand} /><EventStream events={snapshot.events} /></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 bg-card/40 px-4 py-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><ServerCog size={12} /> {snapshot.warehouse.localAutonomy ? 'Local autonomy armed' : 'Local autonomy unavailable'}</span><span className="flex items-center gap-1.5"><Clock3 size={12} /> {formatDuration(snapshot.warehouse.elapsedSeconds)} elapsed</span></div>
        <span className="font-mono">{health?.status ?? 'health pending'} · {mode.replace('Delivery Warehouse ', '')}</span>
      </div>
      {toastMessage && <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded border border-emerald-300/30 bg-[hsl(var(--card))] px-4 py-3 text-xs text-emerald-100 shadow-xl" data-testid="status-command-toast"><CircleDot size={14} className="text-emerald-300" /> {toastMessage}<button type="button" onClick={() => setToastMessage('')} className="ml-2 text-muted-foreground hover:text-foreground" data-testid="button-dismiss-toast"><X size={14} /></button></div>}
    </AppShell>
  );
}

function AppShell({ children, mobileNav, setMobileNav }: { children: ReactNode; mobileNav: boolean; setMobileNav: (value: boolean) => void }) {
  const [location] = useLocation();
  const navClass = (active: boolean) => active
    ? 'flex items-center gap-3 rounded bg-sidebar-accent px-3 py-2.5 text-sm text-sidebar-foreground'
    : 'flex items-center gap-3 rounded px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground';
  return (
    <div className="command-shell noise-layer min-h-[100dvh] text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 w-[242px] border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
           <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-5"><Link href="/" className="flex items-center gap-3" data-testid="link-home"><span className="flex h-8 w-8 items-center justify-center rounded bg-rose-400/15 text-rose-300 ring-1 ring-rose-300/35"><CircleDot size={18} strokeWidth={2.5} /></span><span><strong className="block text-sm tracking-tight text-sidebar-foreground">AKATSUKI<span className="text-rose-300">/</span>OPS</strong><span className="mono-label text-[8px] text-muted-foreground">autonomous systems</span></span></Link><button className="text-muted-foreground lg:hidden" type="button" onClick={() => setMobileNav(false)} data-testid="button-close-navigation"><X size={18} /></button></div>
           <div className="px-4 py-5"><div className="mb-2 px-2 mono-label text-muted-foreground">Command surfaces</div><nav className="space-y-1"><Link href="/" onClick={() => setMobileNav(false)} className={navClass(location === '/')} data-testid="link-operations"><Activity size={15} className="text-emerald-300" /> Live operations</Link><Link href="/simulation" onClick={() => setMobileNav(false)} className={navClass(location === '/simulation')} data-testid="link-simulation"><Layers3 size={15} /> Simulation lab</Link></nav></div>
          <div className="mx-4 border-t border-sidebar-border pt-5"><div className="mb-3 px-2 mono-label text-muted-foreground">Network posture</div><div className="space-y-2 rounded border border-sidebar-border bg-sidebar-accent/50 p-3"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-muted-foreground"><Wifi size={13} /> Mesh link</span><span className="font-mono text-emerald-300">99.98%</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-700/50"><div className="h-full w-[92%] rounded-full bg-emerald-300/80" /></div><div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground"><span>3 controllers</span><span>12 ms RTT</span></div></div></div>
          <div className="mt-auto border-t border-sidebar-border p-4"><div className="flex items-center gap-3 rounded px-2 py-2"><div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 text-xs text-sky-200">MO</div><div className="min-w-0"><p className="truncate text-xs text-sidebar-foreground">Mara Okafor</p><p className="text-[10px] text-muted-foreground">Shift lead · Bay 04</p></div><ChevronDown size={14} className="ml-auto text-muted-foreground" /></div></div>
        </div>
      </aside>
      {mobileNav && <button className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden" type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} data-testid="button-navigation-backdrop" />}
      <main className="min-h-[100dvh] lg:pl-[242px]"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-[hsl(var(--background)/.91)] px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button className="text-muted-foreground lg:hidden" type="button" onClick={() => setMobileNav(true)} data-testid="button-open-navigation"><Menu size={20} /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Factory size={14} className="text-emerald-300" /><span>North Annex / Warehouse 04</span><span className="text-border">/</span><span className="font-mono text-[10px]">NAX-04</span></div></div><div className="flex items-center gap-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 pulse-dot" /> system nominal</div><div className="hidden items-center gap-2 border-l border-border pl-4 text-[10px] text-muted-foreground sm:flex"><TerminalSquare size={13} /> OPS-07</div></div></header><div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-7">{children}</div></main>
    </div>
  );
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={Dashboard} /><Route path="/simulation" component={Dashboard} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;