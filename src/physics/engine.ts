import Matter from 'matter-js';
import {
  areaPxToVolumeM3,
  computeBuoyancyForceN,
  computeCircleSubmersion,
  computeDisplacedWaterRisePx,
  computeFluidDragForceN,
  computePolygonAreaAndCentroid,
  computePolygonSubmersion,
  stepWaveColumns,
  type WaveColumn,
} from './fluidMath';
import { SCENARIOS, type ScenarioBodySpec } from './scenarios';
import {
  FLUID_PRESETS,
  MATERIAL_PRESETS,
  PIXELS_PER_METER,
  SLAB_DEPTH_M,
  TANK_WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type BodyTelemetry,
  type MaterialId,
  type ScenarioId,
  type ShapeKind,
  type SimulationConfig,
  type SimulationStats,
  type Vec2,
} from './types';

export interface SimBodyMeta {
  id: number;
  labelFa: string;
  shape: ShapeKind;
  materialId: MaterialId;
  density: number;
  scale: number;
  baseWidthPx?: number;
  baseHeightPx?: number;
  baseRadiusPx?: number;
  baseVertices?: Vec2[];
  lastVolumeLiters: number;
  lastSubmergedVolumeLiters: number;
  lastSubmergedFraction: number;
  prevSubmergedFraction: number;
  lastSubmergedCentroid: Vec2;
  lastGravityN: number;
  lastBuoyancyN: number;
  lastDragVecN: Vec2;
  lastNetForceVecN: Vec2;
  lastVelocityMs: Vec2;
}

export interface WaterDroplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSplash: boolean;
}

export interface RulerState {
  x: number;
  y: number;
  angleRad: number;
  lengthPx: number;
}

export interface ScaleState {
  x: number;
  y: number;
  attachedBodyId: number | null;
}

export const INNER_TANK_LEFT = TANK_WALL_THICKNESS;
export const INNER_TANK_RIGHT = WORLD_WIDTH - TANK_WALL_THICKNESS;
export const INNER_TANK_WIDTH = INNER_TANK_RIGHT - INNER_TANK_LEFT;
export const INNER_TANK_TOP = 16;
export const INNER_TANK_BOTTOM = WORLD_HEIGHT - TANK_WALL_THICKNESS;
export const INNER_TANK_HEIGHT = INNER_TANK_BOTTOM - INNER_TANK_TOP;
export const WAVE_COLUMN_COUNT = 92;

const FIXED_DT_MS = 1000 / 60;
const FIXED_DT_SEC = 1 / 60;
const FORCE_TO_MATTER = PIXELS_PER_METER * 1e-6;

function computeConvexHull(points: Vec2[]): Vec2[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export class PhysicsWorld {
  public engine: Matter.Engine;
  public walls: Matter.Body[] = [];
  public metaMap = new Map<number, SimBodyMeta>();
  public config: SimulationConfig;
  public waveColumns: WaveColumn[] = [];
  public droplets: WaterDroplet[] = [];
  public simTimeSec = 0;
  public currentDisplacedRisePx = 0;
  public selectedBodyId: number | null = null;
  public ruler: RulerState = {
    x: 90,
    y: 120,
    angleRad: 0,
    lengthPx: 300, // 2.0 m
  };
  public scale: ScaleState = {
    x: 480,
    y: 96,
    attachedBodyId: null,
  };

  private dragConstraint: Matter.Constraint | null = null;
  private scaleConstraint: Matter.Constraint | null = null;
  private spawnCounter = 0;

  constructor(initialScenario: ScenarioId = 'buoyancy') {
    this.engine = Matter.Engine.create({
      positionIterations: 8,
      velocityIterations: 6,
    });
    this.config = this.createDefaultConfig(initialScenario);
    this.initWaveColumns();
    this.loadScenario(initialScenario);
  }

  private createDefaultConfig(scenarioId: ScenarioId): SimulationConfig {
    const scenario = SCENARIOS[scenarioId];
    const fluid = FLUID_PRESETS[scenario.fluidId];
    return {
      scenarioId,
      gravity: scenario.gravity,
      fluidId: scenario.fluidId,
      fluidDensity: fluid.density,
      fluidViscosity: fluid.viscosityMultiplier,
      airResistance: scenario.airResistance,
      baseWaterFraction: scenario.baseWaterFraction,
      showForceVectors: scenario.showForceVectors,
      showVelocityVector: scenario.showVelocityVector,
      showGrid: true,
      showWaterRefLine: true,
      showRuler: false,
      showScale: false,
      showStopwatch: false,
      timeScale: 1,
    };
  }

  private initWaveColumns(): void {
    this.waveColumns = Array.from({ length: WAVE_COLUMN_COUNT }, () => ({
      height: 0,
      targetHeight: 0,
      velocity: 0,
    }));
  }

  private createTankWalls(): void {
    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.5,
      restitution: 0.4,
      label: 'tank-wall',
    };

    const floor = Matter.Bodies.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT - TANK_WALL_THICKNESS / 2,
      WORLD_WIDTH,
      TANK_WALL_THICKNESS,
      wallOpts
    );
    const leftWall = Matter.Bodies.rectangle(
      TANK_WALL_THICKNESS / 2,
      WORLD_HEIGHT / 2,
      TANK_WALL_THICKNESS,
      WORLD_HEIGHT * 2,
      wallOpts
    );
    const rightWall = Matter.Bodies.rectangle(
      WORLD_WIDTH - TANK_WALL_THICKNESS / 2,
      WORLD_HEIGHT / 2,
      TANK_WALL_THICKNESS,
      WORLD_HEIGHT * 2,
      wallOpts
    );
    const ceiling = Matter.Bodies.rectangle(
      WORLD_WIDTH / 2,
      -40,
      WORLD_WIDTH,
      80,
      wallOpts
    );

    this.walls = [floor, leftWall, rightWall, ceiling];
    Matter.Composite.add(this.engine.world, this.walls);
  }

  public loadScenario(scenarioId: ScenarioId): void {
    const scenario = SCENARIOS[scenarioId];
    const fluid = FLUID_PRESETS[scenario.fluidId];

    // Preserve user visualization & tool toggles while applying scenario physics
    const prevShowGrid = this.config.showGrid;
    const prevShowWaterRef = this.config.showWaterRefLine;

    this.config = {
      ...this.createDefaultConfig(scenarioId),
      fluidDensity: fluid.density,
      fluidViscosity: fluid.viscosityMultiplier,
      showGrid: prevShowGrid,
      showWaterRefLine: prevShowWaterRef,
    };

    this.resetWorldBodies();
    this.simTimeSec = 0;
    this.currentDisplacedRisePx = 0;
    this.droplets = [];
    this.initWaveColumns();

    for (const spec of scenario.bodies) {
      this.spawnFromSpec(spec);
    }

    // Select first non-static dynamic body by default so inspector is immediately informative
    const bodies = this.getDynamicBodies();
    const firstMovable = bodies.find((b) => !b.isStatic) ?? bodies[0];
    this.selectedBodyId = firstMovable ? firstMovable.id : null;
  }

  public clearDynamicBodies(): void {
    this.detachScale();
    this.endDrag();
    const all = Matter.Composite.allBodies(this.engine.world);
    for (const body of all) {
      if (!this.walls.includes(body)) {
        Matter.Composite.remove(this.engine.world, body);
        this.metaMap.delete(body.id);
      }
    }
    this.selectedBodyId = null;
    this.currentDisplacedRisePx = 0;
  }

  private resetWorldBodies(): void {
    this.detachScale();
    this.endDrag();
    Matter.Composite.clear(this.engine.world, false);
    this.metaMap.clear();
    this.spawnCounter = 0;
    this.createTankWalls();
  }

  public getDynamicBodies(): Matter.Body[] {
    return Matter.Composite.allBodies(this.engine.world).filter(
      (b) => !this.walls.includes(b)
    );
  }

  public getBaseWaterSurfaceY(): number {
    return INNER_TANK_BOTTOM - this.config.baseWaterFraction * INNER_TANK_HEIGHT;
  }

  public getWaterSurfaceY(): number {
    if (this.config.baseWaterFraction <= 0.001) {
      return INNER_TANK_BOTTOM + 20;
    }
    return Math.max(
      INNER_TANK_TOP + 24,
      this.getBaseWaterSurfaceY() - this.currentDisplacedRisePx
    );
  }

  public getWaveSurfaceYAtX(x: number): number {
    const baseSurface = this.getWaterSurfaceY();
    if (this.config.baseWaterFraction <= 0.001) return baseSurface;
    const t = Math.max(0, Math.min(1, (x - INNER_TANK_LEFT) / INNER_TANK_WIDTH));
    const idxFloat = t * (WAVE_COLUMN_COUNT - 1);
    const i0 = Math.floor(idxFloat);
    const i1 = Math.min(WAVE_COLUMN_COUNT - 1, i0 + 1);
    const frac = idxFloat - i0;
    const h =
      this.waveColumns[i0].height * (1 - frac) +
      this.waveColumns[i1].height * frac;
    return baseSurface + h;
  }

  public spawnFromSpec(spec: ScenarioBodySpec): Matter.Body {
    const mat = MATERIAL_PRESETS[spec.materialId];
    this.spawnCounter += 1;

    const commonOpts: Matter.IChamferableBodyDefinition = {
      isStatic: Boolean(spec.isStatic),
      restitution: mat.restitution,
      friction: mat.friction,
      frictionAir: this.config.airResistance,
      angle: spec.angleRad ?? 0,
    };

    let body: Matter.Body;
    let baseWidthPx: number | undefined;
    let baseHeightPx: number | undefined;
    let baseRadiusPx: number | undefined;
    let baseVertices: Vec2[] | undefined;

    if (spec.shape === 'circle') {
      const r = spec.radius ?? 34;
      baseRadiusPx = r;
      body = Matter.Bodies.circle(spec.x, spec.y, r, commonOpts);
    } else if (spec.shape === 'ramp') {
      const w = spec.width ?? 220;
      const h = spec.height ?? 110;
      baseWidthPx = w;
      baseHeightPx = h;
      const rampVerts = [
        { x: -w / 2, y: h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: -h / 2 },
      ];
      baseVertices = rampVerts;
      body = Matter.Bodies.fromVertices(spec.x, spec.y, [rampVerts], {
        ...commonOpts,
        isStatic: spec.isStatic ?? true,
      });
    } else if (spec.shape === 'polygon') {
      const rawVerts = spec.vertices ?? [
        { x: 0, y: -38 },
        { x: 38, y: -10 },
        { x: 24, y: 34 },
        { x: -24, y: 34 },
        { x: -38, y: -10 },
      ];
      const hull = computeConvexHull(rawVerts);
      baseVertices = hull;
      body = Matter.Bodies.fromVertices(spec.x, spec.y, [hull], commonOpts);
    } else {
      const w = spec.width ?? 72;
      const h = spec.height ?? 72;
      baseWidthPx = w;
      baseHeightPx = h;
      body = Matter.Bodies.rectangle(spec.x, spec.y, w, h, commonOpts);
    }

    const areaPx2 = this.computeBodyAreaPx2(body, spec.shape, baseRadiusPx);
    const volumeM3 = areaPxToVolumeM3(areaPx2, PIXELS_PER_METER, SLAB_DEPTH_M);
    const massKg = Math.max(0.1, volumeM3 * mat.density);

    if (!body.isStatic) {
      Matter.Body.setMass(body, massKg);
    } else {
      body.restitution = mat.restitution;
      body.friction = mat.friction;
    }

    if (spec.velocityMs && !body.isStatic) {
      const vxMatter = (spec.velocityMs.x * PIXELS_PER_METER) / 60;
      const vyMatter = (spec.velocityMs.y * PIXELS_PER_METER) / 60;
      Matter.Body.setVelocity(body, { x: vxMatter, y: vyMatter });
    }

    const meta: SimBodyMeta = {
      id: body.id,
      labelFa: spec.labelFa,
      shape: spec.shape,
      materialId: spec.materialId,
      density: mat.density,
      scale: 1,
      baseWidthPx,
      baseHeightPx,
      baseRadiusPx,
      baseVertices,
      lastVolumeLiters: volumeM3 * 1000,
      lastSubmergedVolumeLiters: 0,
      lastSubmergedFraction: 0,
      prevSubmergedFraction: 0,
      lastSubmergedCentroid: { ...body.position },
      lastGravityN: massKg * this.config.gravity,
      lastBuoyancyN: 0,
      lastDragVecN: { x: 0, y: 0 },
      lastNetForceVecN: { x: 0, y: massKg * this.config.gravity },
      lastVelocityMs: spec.velocityMs ?? { x: 0, y: 0 },
    };

    this.metaMap.set(body.id, meta);
    Matter.Composite.add(this.engine.world, body);
    return body;
  }

  public spawnInteractiveShape(
    shape: ShapeKind,
    x: number,
    y: number,
    materialId: MaterialId,
    customWorldVertices?: Vec2[]
  ): Matter.Body {
    const clampedX = Math.max(INNER_TANK_LEFT + 45, Math.min(INNER_TANK_RIGHT - 45, x));
    const clampedY = Math.max(INNER_TANK_TOP + 45, Math.min(INNER_TANK_BOTTOM - 45, y));
    const mat = MATERIAL_PRESETS[materialId];
    const index = this.spawnCounter + 1;

    if (shape === 'polygon' && customWorldVertices && customWorldVertices.length >= 3) {
      const hull = computeConvexHull(customWorldVertices);
      const { centroid } = computePolygonAreaAndCentroid(hull);
      const localVerts = hull.map((v) => ({
        x: v.x - centroid.x,
        y: v.y - centroid.y,
      }));
      const body = this.spawnFromSpec({
        shape: 'polygon',
        materialId,
        x: centroid.x,
        y: centroid.y,
        vertices: localVerts,
        labelFa: `چندضلعی ${mat.nameFa} ${index}`,
      });
      this.selectedBodyId = body.id;
      return body;
    }

    const labelPrefix =
      shape === 'circle'
        ? 'کره'
        : shape === 'ramp'
        ? 'سطح شیب‌دار'
        : shape === 'polygon'
        ? 'چندضلعی'
        : 'مکعب';

    const body = this.spawnFromSpec({
      shape,
      materialId,
      x: clampedX,
      y: clampedY,
      width: shape === 'ramp' ? 210 : 72,
      height: shape === 'ramp' ? 105 : 72,
      radius: 34,
      isStatic: shape === 'ramp',
      labelFa: `${labelPrefix} ${mat.nameFa} ${index}`,
    });
    this.selectedBodyId = body.id;
    return body;
  }

  private computeBodyAreaPx2(
    body: Matter.Body,
    shape: ShapeKind,
    radiusPx?: number
  ): number {
    if (shape === 'circle' && radiusPx) {
      return Math.PI * radiusPx * radiusPx;
    }
    return computePolygonAreaAndCentroid(body.vertices).area;
  }

  public updateBodyMaterial(bodyId: number, materialId: MaterialId): void {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta) return;

    const preset = MATERIAL_PRESETS[materialId];
    meta.materialId = materialId;
    meta.density = preset.density;
    body.restitution = preset.restitution;
    body.friction = preset.friction;

    const areaPx2 = this.computeBodyAreaPx2(
      body,
      meta.shape,
      meta.baseRadiusPx ? meta.baseRadiusPx * meta.scale : undefined
    );
    const volM3 = areaPxToVolumeM3(areaPx2, PIXELS_PER_METER, SLAB_DEPTH_M);
    const massKg = Math.max(0.1, volM3 * meta.density);
    if (!body.isStatic) {
      Matter.Body.setMass(body, massKg);
    }
    meta.lastVolumeLiters = volM3 * 1000;
  }

  public updateBodyDensity(bodyId: number, densityKgM3: number): void {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta) return;

    meta.materialId = 'custom';
    meta.density = Math.max(100, Math.min(22000, densityKgM3));

    const areaPx2 = this.computeBodyAreaPx2(
      body,
      meta.shape,
      meta.baseRadiusPx ? meta.baseRadiusPx * meta.scale : undefined
    );
    const volM3 = areaPxToVolumeM3(areaPx2, PIXELS_PER_METER, SLAB_DEPTH_M);
    const massKg = Math.max(0.1, volM3 * meta.density);
    if (!body.isStatic) {
      Matter.Body.setMass(body, massKg);
    }
    meta.lastVolumeLiters = volM3 * 1000;
  }

  public updateBodyMassDirect(bodyId: number, targetMassKg: number): void {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta || body.isStatic) return;

    const safeMass = Math.max(0.2, Math.min(5000, targetMassKg));
    const volM3 = Math.max(1e-5, meta.lastVolumeLiters / 1000);
    meta.materialId = 'custom';
    meta.density = safeMass / volM3;
    Matter.Body.setMass(body, safeMass);
  }

  public updateBodyScale(bodyId: number, newScale: number): void {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta) return;

    const clamped = Math.max(0.55, Math.min(1.85, newScale));
    const ratio = clamped / meta.scale;
    if (Math.abs(ratio - 1) < 1e-4) return;

    const wasStatic = body.isStatic;
    if (wasStatic) {
      Matter.Body.setStatic(body, false);
    }
    Matter.Body.scale(body, ratio, ratio);
    meta.scale = clamped;

    const areaPx2 = this.computeBodyAreaPx2(
      body,
      meta.shape,
      meta.baseRadiusPx ? meta.baseRadiusPx * meta.scale : undefined
    );
    const volM3 = areaPxToVolumeM3(areaPx2, PIXELS_PER_METER, SLAB_DEPTH_M);
    const massKg = Math.max(0.1, volM3 * meta.density);
    Matter.Body.setMass(body, massKg);
    if (wasStatic) {
      Matter.Body.setStatic(body, true);
    }
    meta.lastVolumeLiters = volM3 * 1000;
  }

  public updateBodyRestitution(bodyId: number, restitution: number): void {
    const body = this.findBody(bodyId);
    if (!body) return;
    body.restitution = Math.max(0, Math.min(1, restitution));
  }

  public updateBodyFriction(bodyId: number, friction: number): void {
    const body = this.findBody(bodyId);
    if (!body) return;
    body.friction = Math.max(0, Math.min(1, friction));
  }

  public updateBodyAngleDeg(bodyId: number, angleDeg: number): void {
    const body = this.findBody(bodyId);
    if (!body) return;
    Matter.Body.setAngle(body, (angleDeg * Math.PI) / 180);
  }

  public toggleBodyStatic(bodyId: number): void {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta) return;

    const savedRestitution = body.restitution;
    const savedFriction = body.friction;

    if (body.isStatic) {
      Matter.Body.setStatic(body, false);
      const areaPx2 = this.computeBodyAreaPx2(
        body,
        meta.shape,
        meta.baseRadiusPx ? meta.baseRadiusPx * meta.scale : undefined
      );
      const volM3 = areaPxToVolumeM3(areaPx2, PIXELS_PER_METER, SLAB_DEPTH_M);
      Matter.Body.setMass(body, Math.max(0.1, volM3 * meta.density));
    } else {
      if (this.scale.attachedBodyId === bodyId) {
        this.detachScale();
      }
      Matter.Body.setStatic(body, true);
    }

    body.restitution = savedRestitution;
    body.friction = savedFriction;
  }

  public dropBodyFromTop(bodyId: number): void {
    const body = this.findBody(bodyId);
    if (!body || body.isStatic) return;
    Matter.Body.setPosition(body, { x: body.position.x, y: 110 });
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
  }

  public deleteBody(bodyId: number): void {
    const body = this.findBody(bodyId);
    if (!body) return;
    if (this.scale.attachedBodyId === bodyId) {
      this.detachScale();
    }
    Matter.Composite.remove(this.engine.world, body);
    this.metaMap.delete(bodyId);
    if (this.selectedBodyId === bodyId) {
      const next = this.getDynamicBodies()[0];
      this.selectedBodyId = next ? next.id : null;
    }
  }

  public pourWaterAt(x: number, y: number): void {
    const clampedX = Math.max(INNER_TANK_LEFT + 16, Math.min(INNER_TANK_RIGHT - 16, x));
    const clampedY = Math.max(INNER_TANK_TOP + 12, Math.min(this.getWaterSurfaceY() - 10, y));
    for (let i = 0; i < 3; i++) {
      this.droplets.push({
        x: clampedX + (Math.random() - 0.5) * 14,
        y: clampedY + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.5 + Math.random() * 1.8,
        radius: 3 + Math.random() * 2.5,
        isSplash: false,
      });
    }
  }

  public findBodyAtPoint(pt: Vec2): Matter.Body | null {
    const bodies = this.getDynamicBodies();
    // Check top-most (last added) first
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (Matter.Bounds.contains(b.bounds, pt)) {
        if (Matter.Vertices.contains(b.vertices, pt)) {
          return b;
        }
      }
    }
    return null;
  }

  public startDrag(pt: Vec2, isPaused: boolean): number | null {
    const body = this.findBodyAtPoint(pt);
    if (!body) return null;
    this.selectedBodyId = body.id;

    if (body.isStatic || isPaused) {
      return body.id;
    }

    this.dragConstraint = Matter.Constraint.create({
      pointA: { x: pt.x, y: pt.y },
      bodyB: body,
      pointB: { x: pt.x - body.position.x, y: pt.y - body.position.y },
      stiffness: 0.16,
      damping: 0.25,
      length: 0,
    });
    Matter.Composite.add(this.engine.world, this.dragConstraint);
    return body.id;
  }

  public moveDrag(pt: Vec2, isPaused: boolean): void {
    const clamped: Vec2 = {
      x: Math.max(INNER_TANK_LEFT + 20, Math.min(INNER_TANK_RIGHT - 20, pt.x)),
      y: Math.max(INNER_TANK_TOP + 20, Math.min(INNER_TANK_BOTTOM - 20, pt.y)),
    };

    if (this.dragConstraint) {
      this.dragConstraint.pointA = clamped;
      return;
    }

    if (isPaused && this.selectedBodyId !== null) {
      const body = this.findBody(this.selectedBodyId);
      if (body && !body.isStatic) {
        Matter.Body.setPosition(body, clamped);
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
      }
    }
  }

  public endDrag(): void {
    if (this.dragConstraint) {
      Matter.Composite.remove(this.engine.world, this.dragConstraint);
      this.dragConstraint = null;
    }
  }

  public attachScaleToBody(bodyId: number): void {
    const body = this.findBody(bodyId);
    if (!body || body.isStatic) return;
    this.detachScale();
    this.scale.attachedBodyId = bodyId;
    const hookPoint = this.getScaleHookPoint();
    this.scaleConstraint = Matter.Constraint.create({
      pointA: hookPoint,
      bodyB: body,
      pointB: { x: 0, y: 0 },
      length: 36,
      stiffness: 0.35,
      damping: 0.25,
    });
    Matter.Composite.add(this.engine.world, this.scaleConstraint);
  }

  public detachScale(): void {
    if (this.scaleConstraint) {
      Matter.Composite.remove(this.engine.world, this.scaleConstraint);
      this.scaleConstraint = null;
    }
    this.scale.attachedBodyId = null;
  }

  public getScaleHookPoint(): Vec2 {
    return { x: this.scale.x, y: this.scale.y + 72 };
  }

  public moveScale(x: number, y: number): void {
    this.scale.x = Math.max(INNER_TANK_LEFT + 44, Math.min(INNER_TANK_RIGHT - 44, x));
    this.scale.y = Math.max(INNER_TANK_TOP + 34, Math.min(INNER_TANK_BOTTOM - 120, y));
    if (this.scaleConstraint) {
      this.scaleConstraint.pointA = this.getScaleHookPoint();
    }
  }

  public step(subSteps = 1): void {
    const subDtMs = (FIXED_DT_MS * this.config.timeScale) / subSteps;
    const subDtSec = (FIXED_DT_SEC * this.config.timeScale) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.simTimeSec += subDtSec;

      // Sync Matter gravity scale to SI m/s²
      this.engine.gravity.x = 0;
      this.engine.gravity.y = this.config.gravity;
      this.engine.gravity.scale = FORCE_TO_MATTER;

      const hasFluid = this.config.baseWaterFraction > 0.001;
      const waterSurfaceY = this.getWaterSurfaceY();
      let totalSubmergedAreaPx2 = 0;

      const dynamicBodies = this.getDynamicBodies();
      for (const body of dynamicBodies) {
        body.frictionAir = this.config.airResistance;
        const meta = this.metaMap.get(body.id);
        if (!meta) continue;

        const velMatter = Matter.Body.getVelocity(body);
        const velMs: Vec2 = {
          x: (velMatter.x * 60) / PIXELS_PER_METER,
          y: (velMatter.y * 60) / PIXELS_PER_METER,
        };
        meta.lastVelocityMs = velMs;

        const gravityForceN = body.isStatic ? 0 : body.mass * this.config.gravity;
        meta.lastGravityN = gravityForceN;

        if (!hasFluid || body.isStatic) {
          meta.lastSubmergedFraction = 0;
          meta.lastSubmergedVolumeLiters = 0;
          meta.lastBuoyancyN = 0;
          meta.lastDragVecN = { x: 0, y: 0 };
          meta.lastNetForceVecN = { x: 0, y: gravityForceN };
          continue;
        }

        // Compute exact submersion geometry at body's horizontal wave surface
        const localWaterY = this.getWaveSurfaceYAtX(body.position.x);
        const effWaterY = 0.7 * waterSurfaceY + 0.3 * localWaterY;

        const sub =
          meta.shape === 'circle' && meta.baseRadiusPx
            ? computeCircleSubmersion(
                body.position,
                meta.baseRadiusPx * meta.scale,
                effWaterY
              )
            : computePolygonSubmersion(body.vertices, effWaterY);

        totalSubmergedAreaPx2 += sub.submergedAreaPx2;

        const totalVolM3 = areaPxToVolumeM3(
          sub.totalAreaPx2,
          PIXELS_PER_METER,
          SLAB_DEPTH_M
        );
        const subVolM3 = areaPxToVolumeM3(
          sub.submergedAreaPx2,
          PIXELS_PER_METER,
          SLAB_DEPTH_M
        );

        meta.lastVolumeLiters = totalVolM3 * 1000;
        meta.lastSubmergedVolumeLiters = subVolM3 * 1000;
        meta.lastSubmergedFraction = sub.submergedFraction;
        meta.lastSubmergedCentroid = sub.submergedCentroid;

        // Trigger surface wave splash when crossing or plunging through surface
        const crossedSurface =
          (meta.prevSubmergedFraction < 0.04 && sub.submergedFraction >= 0.04) ||
          (meta.prevSubmergedFraction > 0.04 && sub.submergedFraction <= 0.04);
        if (crossedSurface && Math.abs(velMs.y) > 0.35) {
          this.disturbWaves(
            body.bounds.min.x,
            body.bounds.max.x,
            Math.max(-14, Math.min(14, velMs.y * 2.2))
          );
          if (velMs.y > 1.3) {
            this.spawnSplashDroplets(body.position.x, waterSurfaceY, velMs.y);
          }
        } else if (
          sub.submergedFraction > 0.02 &&
          sub.submergedFraction < 0.96 &&
          Math.abs(velMs.y) > 0.4
        ) {
          this.disturbWaves(
            body.bounds.min.x,
            body.bounds.max.x,
            Math.max(-3.5, Math.min(3.5, velMs.y * 0.45))
          );
        }
        meta.prevSubmergedFraction = sub.submergedFraction;

        // Archimedes buoyancy force applied at center of buoyancy (creates authentic restoring torque)
        const buoyancyN = computeBuoyancyForceN(
          this.config.fluidDensity,
          subVolM3,
          this.config.gravity
        );
        meta.lastBuoyancyN = buoyancyN;

        if (buoyancyN > 0) {
          Matter.Body.applyForce(body, sub.submergedCentroid, {
            x: 0,
            y: -buoyancyN * FORCE_TO_MATTER,
          });
        }

        // Hydrodynamic linear + quadratic drag + angular damping in fluid
        const charLenM =
          Math.sqrt(sub.totalAreaPx2) / PIXELS_PER_METER;
        const dragVecN = computeFluidDragForceN(
          velMs,
          sub.submergedFraction,
          charLenM,
          SLAB_DEPTH_M,
          this.config.fluidDensity,
          this.config.fluidViscosity
        );
        meta.lastDragVecN = dragVecN;

        if (sub.submergedFraction > 0) {
          Matter.Body.applyForce(body, body.position, {
            x: dragVecN.x * FORCE_TO_MATTER,
            y: dragVecN.y * FORCE_TO_MATTER,
          });
          // Rotational fluid damping
          const angDamp = Math.max(
            0.86,
            1 - 0.045 * sub.submergedFraction * Math.min(3, this.config.fluidViscosity)
          );
          Matter.Body.setAngularVelocity(body, body.angularVelocity * angDamp);
        }

        meta.lastNetForceVecN = {
          x: dragVecN.x,
          y: gravityForceN - buoyancyN + dragVecN.y,
        };
      }

      // Smoothly update displaced water level
      const targetRise = hasFluid
        ? computeDisplacedWaterRisePx(
            totalSubmergedAreaPx2,
            INNER_TANK_WIDTH,
            INNER_TANK_HEIGHT * 0.45
          )
        : 0;
      this.currentDisplacedRisePx += (targetRise - this.currentDisplacedRisePx) * 0.22;

      // Update wave columns and water droplets
      stepWaveColumns(this.waveColumns);
      this.stepDroplets(subDtSec, waterSurfaceY);

      Matter.Engine.update(this.engine, subDtMs);

      // Update scale attachment hook check if scale is visible
      if (this.config.showScale && this.scale.attachedBodyId !== null) {
        const attached = this.findBody(this.scale.attachedBodyId);
        if (!attached) {
          this.detachScale();
        }
      }
    }
  }

  private disturbWaves(minX: number, maxX: number, impulseVel: number): void {
    const startIdx = Math.max(
      0,
      Math.floor(((minX - INNER_TANK_LEFT) / INNER_TANK_WIDTH) * (WAVE_COLUMN_COUNT - 1))
    );
    const endIdx = Math.min(
      WAVE_COLUMN_COUNT - 1,
      Math.ceil(((maxX - INNER_TANK_LEFT) / INNER_TANK_WIDTH) * (WAVE_COLUMN_COUNT - 1))
    );
    for (let i = startIdx; i <= endIdx; i++) {
      this.waveColumns[i].velocity += impulseVel;
    }
  }

  private spawnSplashDroplets(x: number, waterY: number, impactSpeedMs: number): void {
    const count = Math.min(8, Math.floor(impactSpeedMs * 1.8));
    for (let i = 0; i < count; i++) {
      this.droplets.push({
        x: x + (Math.random() - 0.5) * 28,
        y: waterY - 4,
        vx: (Math.random() - 0.5) * 4.5,
        vy: -(2.0 + Math.random() * Math.min(5, impactSpeedMs * 0.9)),
        radius: 2 + Math.random() * 2,
        isSplash: true,
      });
    }
  }

  private stepDroplets(dtSec: number, waterSurfaceY: number): void {
    const gPx = this.config.gravity * PIXELS_PER_METER;
    const nextDroplets: WaterDroplet[] = [];

    for (const d of this.droplets) {
      d.vy += (gPx * dtSec) / 60;
      d.x += d.vx;
      d.y += d.vy;

      if (d.x < INNER_TANK_LEFT + 4 || d.x > INNER_TANK_RIGHT - 4) {
        d.vx *= -0.5;
        d.x = Math.max(INNER_TANK_LEFT + 4, Math.min(INNER_TANK_RIGHT - 4, d.x));
      }

      const hitWater = d.y >= waterSurfaceY && d.vy > 0;
      const hitFloor = d.y >= INNER_TANK_BOTTOM - 2;

      if (hitWater || hitFloor) {
        if (!d.isSplash) {
          // Poured water adds real fluid volume to the tank!
          this.config.baseWaterFraction = Math.min(
            0.84,
            this.config.baseWaterFraction + 0.0014
          );
          this.disturbWaves(d.x - 10, d.x + 10, 1.8);
        } else {
          this.disturbWaves(d.x - 6, d.x + 6, 0.8);
        }
        continue;
      }

      nextDroplets.push(d);
    }

    this.droplets = nextDroplets;
  }

  public findBody(id: number): Matter.Body | null {
    return (
      this.getDynamicBodies().find((b) => b.id === id) ?? null
    );
  }

  public getBodyTelemetry(bodyId: number): BodyTelemetry | null {
    const body = this.findBody(bodyId);
    const meta = this.metaMap.get(bodyId);
    if (!body || !meta) return null;

    const speedMs = Math.hypot(meta.lastVelocityMs.x, meta.lastVelocityMs.y);
    const netForceMagN = Math.hypot(meta.lastNetForceVecN.x, meta.lastNetForceVecN.y);
    const posM: Vec2 = {
      x: (body.position.x - INNER_TANK_LEFT) / PIXELS_PER_METER,
      y: (INNER_TANK_BOTTOM - body.position.y) / PIXELS_PER_METER,
    };

    let stateFa: BodyTelemetry['stateFa'] = 'در هوا';
    if (body.isStatic) {
      stateFa = 'روی بستر / ثابت';
    } else if (meta.lastSubmergedFraction >= 0.96) {
      stateFa = 'غوطه‌ور در سیال';
    } else if (meta.lastSubmergedFraction > 0.02) {
      stateFa = 'شناور';
    }

    return {
      id: body.id,
      labelFa: meta.labelFa,
      shape: meta.shape,
      materialId: meta.materialId,
      density: meta.density,
      mass: body.isStatic ? 0 : body.mass,
      volumeLiters: meta.lastVolumeLiters,
      submergedVolumeLiters: meta.lastSubmergedVolumeLiters,
      submergedFraction: meta.lastSubmergedFraction,
      restitution: body.restitution,
      friction: body.friction,
      isStatic: body.isStatic,
      scale: meta.scale,
      speedMs,
      velocityMs: meta.lastVelocityMs,
      positionM: posM,
      angleDeg: ((body.angle * 180) / Math.PI) % 360,
      gravityForceN: meta.lastGravityN,
      buoyancyForceN: meta.lastBuoyancyN,
      dragForceN: Math.hypot(meta.lastDragVecN.x, meta.lastDragVecN.y),
      netForceN: meta.lastNetForceVecN,
      netForceMagN,
      stateFa,
    };
  }

  public getStats(): SimulationStats {
    const hasFluid = this.config.baseWaterFraction > 0.001;
    const baseHeightPx = hasFluid
      ? this.config.baseWaterFraction * INNER_TANK_HEIGHT
      : 0;
    const baseWaterLevelM = baseHeightPx / PIXELS_PER_METER;
    const waterLevelM = hasFluid
      ? (INNER_TANK_BOTTOM - this.getWaterSurfaceY()) / PIXELS_PER_METER
      : 0;

    const tankWidthM = INNER_TANK_WIDTH / PIXELS_PER_METER;
    const waterVolumeLiters = baseWaterLevelM * tankWidthM * SLAB_DEPTH_M * 1000;

    let displacedVolumeLiters = 0;
    for (const meta of this.metaMap.values()) {
      displacedVolumeLiters += meta.lastSubmergedVolumeLiters;
    }

    let scaleReadingN = 0;
    let scaleAttachedLabel: string | null = null;
    if (this.scale.attachedBodyId !== null) {
      const attachedMeta = this.metaMap.get(this.scale.attachedBodyId);
      if (attachedMeta) {
        scaleAttachedLabel = attachedMeta.labelFa;
        scaleReadingN = Math.max(
          0,
          attachedMeta.lastGravityN - attachedMeta.lastBuoyancyN
        );
      }
    }

    const scaleReadingKg =
      this.config.gravity > 0.05 ? scaleReadingN / this.config.gravity : 0;

    return {
      simTimeSec: this.simTimeSec,
      bodyCount: this.getDynamicBodies().length,
      waterLevelM,
      baseWaterLevelM,
      waterVolumeLiters,
      displacedVolumeLiters,
      scaleReadingN,
      scaleReadingKg,
      scaleAttachedLabel,
    };
  }
}
