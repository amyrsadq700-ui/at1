import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Sparkles, Sun } from 'lucide-react';
import { renderPhysicsScene } from './canvas/renderer';
import { CanvasToolbar, type ViewportMode } from './components/CanvasToolbar';
import { ControlDeck } from './components/ControlDeck';
import { FormulasModal } from './components/FormulasModal';
import { PlaybackBar } from './components/PlaybackBar';
import { StopwatchWidget } from './components/StopwatchWidget';
import { TopBar } from './components/TopBar';
import { PhysicsWorld } from './physics/engine';
import { SCENARIOS } from './physics/scenarios';
import {
  FLUID_PRESETS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type BodyTelemetry,
  type FluidId,
  type InteractionTool,
  type MaterialId,
  type ScenarioId,
  type ShapeKind,
  type SimulationConfig,
  type SimulationStats,
  type Vec2,
} from './physics/types';
import {
  PhysicsViewport3D,
  type CameraPreset3D,
  type LightingPreset3D,
  type RenderQuality3D,
} from './three/PhysicsViewport3D';

type PointerDragKind =
  | 'none'
  | 'body'
  | 'ruler-move'
  | 'ruler-rotate'
  | 'scale-move'
  | 'pour';

export default function App() {
  const worldRef = useRef<PhysicsWorld | null>(null);
  if (!worldRef.current) {
    worldRef.current = new PhysicsWorld('buoyancy');
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRunningRef = useRef(true);
  const activeToolRef = useRef<InteractionTool>('select');
  const spawnMaterialRef = useRef<MaterialId>('wood');
  const pendingPolygonRef = useRef<Vec2[]>([]);
  const hoverPointRef = useRef<Vec2 | null>(null);
  const dragKindRef = useRef<PointerDragKind>('none');
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const pointerPosRef = useRef<Vec2>({ x: 0, y: 0 });

  const [isRunning, setIsRunning] = useState(true);
  const [viewMode, setViewMode] = useState<ViewportMode>('2d');
  const viewModeRef = useRef<ViewportMode>('2d');
  const [cameraPreset3D, setCameraPreset3D] = useState<CameraPreset3D>('isometric');
  const [cameraTrigger3D, setCameraTrigger3D] = useState(0);
  const [lightingPreset3D, setLightingPreset3D] = useState<LightingPreset3D>('lab-day');
  const [renderQuality3D, setRenderQuality3D] = useState<RenderQuality3D>('ultra');
  const [activeTool, setActiveTool] = useState<InteractionTool>('select');
  const [spawnMaterial, setSpawnMaterial] = useState<MaterialId>('wood');
  const [config, setConfig] = useState<SimulationConfig>(() => ({
    ...worldRef.current!.config,
  }));
  const [stats, setStats] = useState<SimulationStats>(() =>
    worldRef.current!.getStats()
  );
  const [selectedBody, setSelectedBody] = useState<BodyTelemetry | null>(() => {
    const w = worldRef.current!;
    return w.selectedBodyId !== null ? w.getBodyTelemetry(w.selectedBodyId) : null;
  });
  const [pendingVertexCount, setPendingVertexCount] = useState(0);
  const [isFormulasOpen, setIsFormulasOpen] = useState(false);

  // Stopwatch state
  const [stopwatchSec, setStopwatchSec] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const stopwatchRunningRef = useRef(false);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'spawn-polygon') {
      pendingPolygonRef.current = [];
      setPendingVertexCount(0);
    }
  }, [activeTool]);

  useEffect(() => {
    spawnMaterialRef.current = spawnMaterial;
  }, [spawnMaterial]);

  useEffect(() => {
    stopwatchRunningRef.current = isStopwatchRunning;
  }, [isStopwatchRunning]);

  const syncUiFromWorld = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    setConfig({ ...world.config });
    setStats(world.getStats());
    setSelectedBody(
      world.selectedBodyId !== null
        ? world.getBodyTelemetry(world.selectedBodyId)
        : null
    );
  }, []);

  // Main 60 FPS simulation & render loop
  useEffect(() => {
    let rafId = 0;
    let lastUiSyncTime = performance.now();
    let lastStopwatchTick = performance.now();

    const frame = (now: number) => {
      const world = worldRef.current;
      if (world) {
        if (viewModeRef.current === '2d' && dragKindRef.current === 'pour') {
          world.pourWaterAt(pointerPosRef.current.x, pointerPosRef.current.y);
        }

        if (isRunningRef.current) {
          world.step(2);
          if (stopwatchRunningRef.current) {
            const dt = Math.min(0.05, (now - lastStopwatchTick) / 1000);
            setStopwatchSec((prev) => prev + dt * world.config.timeScale);
          }
        }
        lastStopwatchTick = now;

        const canvas = canvasRef.current;
        if (viewModeRef.current === '2d' && canvas) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetW = WORLD_WIDTH * dpr;
          const targetH = WORLD_HEIGHT * dpr;
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.scale(dpr, dpr);
            renderPhysicsScene(ctx, world, {
              pendingPolygonPoints: pendingPolygonRef.current,
              hoverPoint: hoverPointRef.current,
              activeTool: activeToolRef.current,
            });
            ctx.restore();
          }
        }

        if (now - lastUiSyncTime >= 85) {
          lastUiSyncTime = now;
          setStats(world.getStats());
          if (world.selectedBodyId !== null) {
            setSelectedBody(world.getBodyTelemetry(world.selectedBodyId));
          }
          // Sync baseWaterFraction if pouring droplets increased fluid volume
          setConfig((prev) =>
            Math.abs(prev.baseWaterFraction - world.config.baseWaterFraction) > 0.002
              ? { ...world.config }
              : prev
          );
        }
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isFormulasOpen) {
          setIsFormulasOpen(false);
        } else if (pendingPolygonRef.current.length > 0) {
          pendingPolygonRef.current = [];
          setPendingVertexCount(0);
        } else {
          setActiveTool('select');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const world = worldRef.current;
        if (world && world.selectedBodyId !== null) {
          world.deleteBody(world.selectedBodyId);
          syncUiFromWorld();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFormulasOpen, syncUiFromWorld]);

  const toWorldCoords = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  };

  const completePendingPolygon = useCallback(() => {
    const world = worldRef.current;
    const pts = pendingPolygonRef.current;
    if (!world || pts.length < 3) return;
    world.spawnInteractiveShape('polygon', 0, 0, spawnMaterialRef.current, pts);
    pendingPolygonRef.current = [];
    setPendingVertexCount(0);
    setActiveTool('select');
    syncUiFromWorld();
  }, [syncUiFromWorld]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = worldRef.current;
    if (!world) return;
    const pt = toWorldCoords(e);
    pointerPosRef.current = pt;

    // 1. Check Ruler interactions first (overlay instrument)
    if (world.config.showRuler) {
      const { x, y, angleRad, lengthPx } = world.ruler;
      const dx = pt.x - x;
      const dy = pt.y - y;
      const cos = Math.cos(-angleRad);
      const sin = Math.sin(-angleRad);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      if (Math.hypot(lx - (lengthPx - 14), ly - 19) <= 16) {
        dragKindRef.current = 'ruler-rotate';
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (lx >= 0 && lx <= lengthPx && ly >= 0 && ly <= 38) {
        dragKindRef.current = 'ruler-move';
        dragOffsetRef.current = { x: pt.x - x, y: pt.y - y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Check Spring Scale interactions
    if (world.config.showScale) {
      const { x, y, attachedBodyId } = world.scale;
      const hookPt = world.getScaleHookPoint();
      if (attachedBodyId !== null && Math.hypot(pt.x - hookPt.x, pt.y - hookPt.y) <= 16) {
        world.detachScale();
        syncUiFromWorld();
        return;
      }
      if (Math.abs(pt.x - x) <= 38 && pt.y >= y - 44 && pt.y <= y + 60) {
        dragKindRef.current = 'scale-move';
        dragOffsetRef.current = { x: pt.x - x, y: pt.y - y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 3. Tool-specific behaviors
    const tool = activeToolRef.current;
    if (tool === 'pour-water') {
      dragKindRef.current = 'pour';
      world.pourWaterAt(pt.x, pt.y);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'spawn-box') {
      world.spawnInteractiveShape('box', pt.x, pt.y, spawnMaterialRef.current);
      setActiveTool('select');
      syncUiFromWorld();
      return;
    }

    if (tool === 'spawn-circle') {
      world.spawnInteractiveShape('circle', pt.x, pt.y, spawnMaterialRef.current);
      setActiveTool('select');
      syncUiFromWorld();
      return;
    }

    if (tool === 'spawn-ramp') {
      world.spawnInteractiveShape('ramp', pt.x, pt.y, 'aluminum');
      setActiveTool('select');
      syncUiFromWorld();
      return;
    }

    if (tool === 'spawn-polygon') {
      const pts = pendingPolygonRef.current;
      if (pts.length >= 3 && Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= 18) {
        completePendingPolygon();
        return;
      }
      pendingPolygonRef.current = [...pts, pt];
      setPendingVertexCount(pendingPolygonRef.current.length);
      return;
    }

    // 4. Select & drag rigid body
    const hitId = world.startDrag(pt, !isRunningRef.current);
    if (hitId !== null) {
      dragKindRef.current = 'body';
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      world.selectedBodyId = null;
    }
    syncUiFromWorld();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = worldRef.current;
    if (!world) return;
    const pt = toWorldCoords(e);
    pointerPosRef.current = pt;
    hoverPointRef.current = pt;

    const kind = dragKindRef.current;
    if (kind === 'none') return;

    if (kind === 'ruler-move') {
      world.ruler.x = Math.max(0, Math.min(WORLD_WIDTH - 40, pt.x - dragOffsetRef.current.x));
      world.ruler.y = Math.max(0, Math.min(WORLD_HEIGHT - 30, pt.y - dragOffsetRef.current.y));
    } else if (kind === 'ruler-rotate') {
      world.ruler.angleRad = Math.atan2(pt.y - world.ruler.y, pt.x - world.ruler.x);
    } else if (kind === 'scale-move') {
      world.moveScale(pt.x - dragOffsetRef.current.x, pt.y - dragOffsetRef.current.y);
    } else if (kind === 'body') {
      world.moveDrag(pt, !isRunningRef.current);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const world = worldRef.current;
    if (!world) return;

    if (dragKindRef.current === 'body') {
      const draggedId = world.selectedBodyId;
      world.endDrag();

      // Snap-attach to Spring Scale if released near hook
      if (world.config.showScale && draggedId !== null) {
        const body = world.findBody(draggedId);
        const hookPt = world.getScaleHookPoint();
        if (
          body &&
          !body.isStatic &&
          Math.hypot(body.position.x - hookPt.x, body.position.y - hookPt.y) <= 44
        ) {
          world.attachScaleToBody(draggedId);
        }
      }
      syncUiFromWorld();
    }

    dragKindRef.current = 'none';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleSelectScenario = (id: ScenarioId) => {
    const world = worldRef.current;
    if (!world) return;
    world.loadScenario(id);
    setActiveTool('select');
    setIsRunning(true);
    syncUiFromWorld();
  };

  const handleResetScenario = () => {
    const world = worldRef.current;
    if (!world) return;
    world.loadScenario(world.config.scenarioId);
    setStopwatchSec(0);
    setIsStopwatchRunning(false);
    setIsRunning(true);
    syncUiFromWorld();
  };

  const handleClearObjects = () => {
    const world = worldRef.current;
    if (!world) return;
    world.clearDynamicBodies();
    syncUiFromWorld();
  };

  const handleStepForward = () => {
    const world = worldRef.current;
    if (!world) return;
    setIsRunning(false);
    world.step(2);
    if (stopwatchRunningRef.current) {
      setStopwatchSec((prev) => prev + (1 / 60) * world.config.timeScale);
    }
    syncUiFromWorld();
  };

  const handleToggleConfig = (
    key:
      | 'showForceVectors'
      | 'showVelocityVector'
      | 'showGrid'
      | 'showRuler'
      | 'showScale'
      | 'showStopwatch'
  ) => {
    const world = worldRef.current;
    if (!world) return;
    world.config[key] = !world.config[key];
    if (key === 'showScale' && !world.config.showScale) {
      world.detachScale();
    }
    syncUiFromWorld();
  };

  const handleUpdateConfig = (patch: Partial<SimulationConfig>) => {
    const world = worldRef.current;
    if (!world) return;
    Object.assign(world.config, patch);
    syncUiFromWorld();
  };

  const handleSelectFluid = (fluidId: FluidId) => {
    const world = worldRef.current;
    if (!world) return;
    const preset = FLUID_PRESETS[fluidId];
    world.config.fluidId = fluidId;
    world.config.fluidDensity = preset.density;
    world.config.fluidViscosity = preset.viscosityMultiplier;
    if (world.config.baseWaterFraction < 0.05) {
      world.config.baseWaterFraction = 0.4;
    }
    syncUiFromWorld();
  };

  const handleQuickSpawn = (shape: ShapeKind) => {
    const world = worldRef.current;
    if (!world) return;
    const offset = (Math.random() - 0.5) * 180;
    world.spawnInteractiveShape(shape, 480 + offset, 120, spawnMaterial);
    syncUiFromWorld();
  };

  const handleAttachScale = (bodyId: number) => {
    const world = worldRef.current;
    if (!world) return;
    world.config.showScale = true;
    if (world.scale.attachedBodyId === bodyId) {
      world.detachScale();
    } else {
      world.attachScaleToBody(bodyId);
    }
    syncUiFromWorld();
  };

  const activeScenarioDef = SCENARIOS[config.scenarioId];

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:h-screen lg:overflow-hidden"
      data-state={isRunning ? 'running' : 'paused'}
      data-scenario={config.scenarioId}
      data-body-count={stats.bodyCount}
    >
      <TopBar
        activeScenario={config.scenarioId}
        onSelectScenario={handleSelectScenario}
        onOpenFormulas={() => setIsFormulasOpen(true)}
      />

      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Primary Interactive Stage (~70% width on desktop) */}
        <section
          aria-label="صحنه شبیه‌سازی فیزیک"
          className="flex min-w-0 flex-1 flex-col bg-slate-50"
        >
          <CanvasToolbar
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            config={config}
            onToggleConfig={handleToggleConfig}
          />

          {/* Stage Info & 3D Rendering Controls Bar (never overlaps tank) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-900">
                {activeScenarioDef.titleFa}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-slate-600">
                {activeScenarioDef.subtitleFa}
              </span>
            </div>

            {viewMode === '3d' ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {/* Camera Angle Presets */}
                <div
                  role="group"
                  aria-label="زاویه دوربین سه‌بعدی"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5"
                >
                  <Camera className="mx-1 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  {(
                    [
                      ['isometric', 'سه‌بعدی'],
                      ['front', 'روبرو'],
                      ['top', 'بالا'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setCameraPreset3D(id);
                        setCameraTrigger3D((c) => c + 1);
                      }}
                      aria-pressed={cameraPreset3D === id}
                      className={`rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                        cameraPreset3D === id
                          ? 'bg-white text-sky-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Studio Lighting Presets */}
                <div
                  role="group"
                  aria-label="نورپردازی استودیو"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5"
                >
                  <Sun className="mx-1 h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                  {(
                    [
                      ['lab-day', 'نور روز'],
                      ['warm-studio', 'استودیو گرم'],
                      ['dramatic', 'نور متمرکز'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLightingPreset3D(id)}
                      aria-pressed={lightingPreset3D === id}
                      className={`rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                        lightingPreset3D === id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Render Quality Toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setRenderQuality3D((q) => (q === 'ultra' ? 'balanced' : 'ultra'))
                  }
                  aria-pressed={renderQuality3D === 'ultra'}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                    renderQuality3D === 'ultra'
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {renderQuality3D === 'ultra' ? 'رندر PBR حداکثر' : 'رندر متعادل'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                {config.baseWaterFraction > 0.001 && (
                  <>
                    <span>
                      حجم سیال:{' '}
                      <strong dir="ltr" className="inline-block font-mono-num text-slate-900">
                        {stats.waterVolumeLiters.toFixed(0)} L
                      </strong>
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>
                      چگالی سیال:{' '}
                      <strong dir="ltr" className="inline-block font-mono-num text-sky-700">
                        {Math.round(config.fluidDensity)} kg/m³
                      </strong>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Canvas / 3D Stage Viewport */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-4">
            {config.showStopwatch && (
              <div className="absolute top-5 left-5 z-10">
                <StopwatchWidget
                  elapsedSec={stopwatchSec}
                  isStopwatchRunning={isStopwatchRunning}
                  onToggleStopwatch={() =>
                    setIsStopwatchRunning((prev) => !prev)
                  }
                  onResetStopwatch={() => {
                    setIsStopwatchRunning(false);
                    setStopwatchSec(0);
                  }}
                />
              </div>
            )}

            {/* Polygon Drawing Helper Prompt */}
            {activeTool === 'spawn-polygon' && viewMode === '2d' && (
              <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-sky-300 bg-white/95 px-4 py-2 text-xs shadow-sm">
                <span className="font-medium text-slate-800">
                  برای رسم چندضلعی روی صحنه کلیک کنید ({pendingVertexCount} نقطه)
                </span>
                {pendingVertexCount >= 3 && (
                  <button
                    type="button"
                    onClick={completePendingPolygon}
                    className="rounded-md bg-sky-700 px-2.5 py-1 font-semibold text-white hover:bg-sky-800"
                  >
                    ساخت چندضلعی
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    pendingPolygonRef.current = [];
                    setPendingVertexCount(0);
                    setActiveTool('select');
                  }}
                  className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200"
                >
                  لغو
                </button>
              </div>
            )}

            {viewMode === '3d' ? (
              <div className="h-full w-full min-h-[380px]">
                <PhysicsViewport3D
                  worldRef={worldRef}
                  isRunning={isRunning}
                  activeTool={activeTool}
                  spawnMaterial={spawnMaterial}
                  cameraPreset={cameraPreset3D}
                  cameraTrigger={cameraTrigger3D}
                  lightingPreset={lightingPreset3D}
                  renderQuality={renderQuality3D}
                  onSelectTool={setActiveTool}
                  onSyncUi={syncUiFromWorld}
                />
              </div>
            ) : (
              /* Interactive 2D Physics Canvas */
              <canvas
                ref={canvasRef}
                data-testid="physics-canvas"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                onDoubleClick={() => {
                  if (
                    activeToolRef.current === 'spawn-polygon' &&
                    pendingPolygonRef.current.length >= 3
                  ) {
                    completePendingPolygon();
                  }
                }}
                className={`aspect-[960/600] max-h-full w-auto max-w-full rounded-lg border border-slate-300 bg-white shadow-xs touch-none ${
                  activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                }`}
              />
            )}
          </div>

          <PlaybackBar
            isRunning={isRunning}
            timeScale={config.timeScale}
            simTimeSec={stats.simTimeSec}
            onToggleRun={() => setIsRunning((prev) => !prev)}
            onStepForward={handleStepForward}
            onChangeTimeScale={(scale) => handleUpdateConfig({ timeScale: scale })}
            onClearObjects={handleClearObjects}
            onResetScenario={handleResetScenario}
          />
        </section>

        {/* Right / Side Control & Telemetry Deck (~360px on desktop) */}
        <div className="w-full shrink-0 lg:w-[360px] xl:w-[390px]">
          <ControlDeck
            config={config}
            stats={stats}
            selectedBody={selectedBody}
            spawnMaterial={spawnMaterial}
            onChangeSpawnMaterial={setSpawnMaterial}
            onQuickSpawn={handleQuickSpawn}
            onUpdateConfig={handleUpdateConfig}
            onSelectFluid={handleSelectFluid}
            onUpdateBodyMaterial={(id, mat) => {
              worldRef.current?.updateBodyMaterial(id, mat);
              syncUiFromWorld();
            }}
            onUpdateBodyDensity={(id, density) => {
              worldRef.current?.updateBodyDensity(id, density);
              syncUiFromWorld();
            }}
            onUpdateBodyMass={(id, mass) => {
              worldRef.current?.updateBodyMassDirect(id, mass);
              syncUiFromWorld();
            }}
            onUpdateBodyScale={(id, scale) => {
              worldRef.current?.updateBodyScale(id, scale);
              syncUiFromWorld();
            }}
            onUpdateBodyRestitution={(id, rest) => {
              worldRef.current?.updateBodyRestitution(id, rest);
              syncUiFromWorld();
            }}
            onUpdateBodyFriction={(id, fric) => {
              worldRef.current?.updateBodyFriction(id, fric);
              syncUiFromWorld();
            }}
            onUpdateBodyAngle={(id, deg) => {
              worldRef.current?.updateBodyAngleDeg(id, deg);
              syncUiFromWorld();
            }}
            onToggleBodyStatic={(id) => {
              worldRef.current?.toggleBodyStatic(id);
              syncUiFromWorld();
            }}
            onDropBodyFromTop={(id) => {
              worldRef.current?.dropBodyFromTop(id);
              syncUiFromWorld();
            }}
            onAttachScale={handleAttachScale}
            onDeleteBody={(id) => {
              worldRef.current?.deleteBody(id);
              syncUiFromWorld();
            }}
            isScaleAttachedToSelected={
              selectedBody !== null &&
              worldRef.current?.scale.attachedBodyId === selectedBody.id
            }
          />
        </div>
      </main>

      <FormulasModal
        isOpen={isFormulasOpen}
        onClose={() => setIsFormulasOpen(false)}
      />
    </div>
  );
}
