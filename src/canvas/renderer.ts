import Matter from 'matter-js';
import {
  INNER_TANK_BOTTOM,
  INNER_TANK_LEFT,
  INNER_TANK_RIGHT,
  INNER_TANK_TOP,
  INNER_TANK_WIDTH,
  PhysicsWorld,
  WAVE_COLUMN_COUNT,
} from '../physics/engine';
import {
  FLUID_PRESETS,
  MATERIAL_PRESETS,
  PIXELS_PER_METER,
  TANK_WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Vec2,
} from '../physics/types';

export interface RenderOverlayState {
  pendingPolygonPoints: Vec2[];
  hoverPoint: Vec2 | null;
  activeTool: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  color: string,
  label: string
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;

  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(11, Math.max(7, len * 0.25));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shaft
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x - Math.cos(angle) * (headLen * 0.65), to.y - Math.sin(angle) * (headLen * 0.65));
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLen * Math.cos(angle - Math.PI / 6),
    to.y - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - headLen * Math.cos(angle + Math.PI / 6),
    to.y - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Crisp haloed label clamped inside viewport bounds
  if (label) {
    ctx.direction = 'ltr';
    ctx.font = '600 11px "IBM Plex Mono", "Vazirmatn", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rawX = to.x + Math.cos(angle) * 14;
    const rawY = to.y + Math.sin(angle) * 14;
    const isNearBottom = rawY > INNER_TANK_BOTTOM - 8;
    const labelX = Math.max(
      INNER_TANK_LEFT + 34,
      Math.min(INNER_TANK_RIGHT - 34, isNearBottom ? to.x + 36 : rawX)
    );
    const labelY = Math.max(22, Math.min(INNER_TANK_BOTTOM - 12, rawY));
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeText(label, labelX, labelY);
    ctx.fillStyle = color;
    ctx.fillText(label, labelX, labelY);
  }
  ctx.restore();
}

function forceToArrowPixels(forceN: number): number {
  if (forceN < 0.2) return 0;
  // Scientific compressed scale so 10N..3000N stay readable within 18px..86px
  return Math.min(86, 16 + Math.log10(1 + forceN * 0.45) * 23);
}

export function renderPhysicsScene(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld,
  overlay: RenderOverlayState
): void {
  ctx.save();
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 1. Clean laboratory backdrop
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 2. Coordinate grid (every 0.5m = 75px, minor 0.25m)
  if (world.config.showGrid) {
    drawCoordinateGrid(ctx);
  }

  // 3. Draw Rigid Bodies (behind water translucency for realistic submerged look)
  const bodies = world.getDynamicBodies();
  for (const body of bodies) {
    drawRigidBody(ctx, world, body, body.id === world.selectedBodyId);
  }

  // 4. Draw Water / Fluid Tank Interior with Waves, Refraction & Displacement
  if (world.config.baseWaterFraction > 0.001) {
    drawFluidVolume(ctx, world);
  }

  // 5. Draw Water Droplets (poured water & splash droplets)
  drawWaterDroplets(ctx, world);

  // 6. Draw Tank Walls & Graduated Scale Ticks
  drawTankWalls(ctx);

  // 7. Draw Force & Velocity Vectors above water so they stay crisp & readable
  if (world.config.showForceVectors || world.config.showVelocityVector) {
    drawBodyVectors(ctx, world, bodies);
  }

  // 8. Draw Interactive Spring Scale (Dynamometer)
  if (world.config.showScale) {
    drawSpringScale(ctx, world);
  }

  // 9. Draw Draggable Metric Ruler
  if (world.config.showRuler) {
    drawMetricRuler(ctx, world);
  }

  // 10. Custom Polygon Vertex Drawing Guide
  if (overlay.activeTool === 'spawn-polygon' && overlay.pendingPolygonPoints.length > 0) {
    drawPendingPolygon(ctx, overlay.pendingPolygonPoints, overlay.hoverPoint);
  }

  ctx.restore();
}

function drawCoordinateGrid(ctx: CanvasRenderingContext2D): void {
  const minorStep = PIXELS_PER_METER * 0.25; // 0.25 m = 37.5 px
  const majorStep = PIXELS_PER_METER * 0.5; // 0.50 m = 75 px

  ctx.save();
  // Minor lines
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = INNER_TANK_LEFT; x <= INNER_TANK_RIGHT; x += minorStep) {
    ctx.moveTo(x, INNER_TANK_TOP);
    ctx.lineTo(x, INNER_TANK_BOTTOM);
  }
  for (let y = INNER_TANK_BOTTOM; y >= INNER_TANK_TOP; y -= minorStep) {
    ctx.moveTo(INNER_TANK_LEFT, y);
    ctx.lineTo(INNER_TANK_RIGHT, y);
  }
  ctx.stroke();

  // Major 0.5m lines
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = INNER_TANK_LEFT; x <= INNER_TANK_RIGHT; x += majorStep) {
    ctx.moveTo(x, INNER_TANK_TOP);
    ctx.lineTo(x, INNER_TANK_BOTTOM);
  }
  for (let y = INNER_TANK_BOTTOM; y >= INNER_TANK_TOP; y -= majorStep) {
    ctx.moveTo(INNER_TANK_LEFT, y);
    ctx.lineTo(INNER_TANK_RIGHT, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTankWalls(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Structural glass/laboratory wall frames
  ctx.fillStyle = '#E2E8F0';
  // Left wall
  ctx.fillRect(0, 0, TANK_WALL_THICKNESS, WORLD_HEIGHT);
  // Right wall
  ctx.fillRect(WORLD_WIDTH - TANK_WALL_THICKNESS, 0, TANK_WALL_THICKNESS, WORLD_HEIGHT);
  // Bottom floor
  ctx.fillRect(0, WORLD_HEIGHT - TANK_WALL_THICKNESS, WORLD_WIDTH, TANK_WALL_THICKNESS);

  // Inner crisp glass borders
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(INNER_TANK_LEFT, 0);
  ctx.lineTo(INNER_TANK_LEFT, INNER_TANK_BOTTOM);
  ctx.lineTo(INNER_TANK_RIGHT, INNER_TANK_BOTTOM);
  ctx.lineTo(INNER_TANK_RIGHT, 0);
  ctx.stroke();

  // Vertical Meter Scale Graduation on Left Glass Wall
  ctx.direction = 'ltr';
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.25;
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const maxM = Math.floor(
    (INNER_TANK_BOTTOM - INNER_TANK_TOP) / PIXELS_PER_METER / 0.5
  ) * 0.5;

  for (let m = 0; m <= maxM + 0.01; m += 0.25) {
    const y = INNER_TANK_BOTTOM - m * PIXELS_PER_METER;
    const isHalf = Math.abs((m * 2) - Math.round(m * 2)) < 0.01;
    const tickLen = isHalf ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(INNER_TANK_LEFT, y);
    ctx.lineTo(INNER_TANK_LEFT + tickLen, y);
    ctx.stroke();

    if (isHalf && m > 0) {
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(`${m.toFixed(1)}m`, INNER_TANK_LEFT + 12, y);
    }
  }

  // Horizontal floor meter ticks
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let m = 0.5; m <= 5.5; m += 0.5) {
    const x = INNER_TANK_LEFT + m * PIXELS_PER_METER;
    if (x >= INNER_TANK_RIGHT - 10) break;
    ctx.beginPath();
    ctx.moveTo(x, INNER_TANK_BOTTOM);
    ctx.lineTo(x, INNER_TANK_BOTTOM + 7);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.fillText(`${m.toFixed(1)}m`, x, INNER_TANK_BOTTOM + 10);
  }

  ctx.restore();
}

function drawRigidBody(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld,
  body: Matter.Body,
  isSelected: boolean
): void {
  const meta = world.metaMap.get(body.id);
  if (!meta) return;
  const preset = MATERIAL_PRESETS[meta.materialId];

  ctx.save();

  // Clip path to body geometry
  ctx.beginPath();
  if (meta.shape === 'circle' && meta.baseRadiusPx) {
    ctx.arc(
      body.position.x,
      body.position.y,
      meta.baseRadiusPx * meta.scale,
      0,
      Math.PI * 2
    );
  } else {
    const verts = body.vertices;
    if (verts.length > 0) {
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }
      ctx.closePath();
    }
  }

  // Fill with material-appropriate shading
  if (meta.materialId === 'steel' || meta.materialId === 'aluminum' || meta.materialId === 'gold') {
    const grad = ctx.createLinearGradient(
      body.bounds.min.x,
      body.bounds.min.y,
      body.bounds.max.x,
      body.bounds.max.y
    );
    grad.addColorStop(0, preset.accentColor);
    grad.addColorStop(0.5, preset.fillColor);
    grad.addColorStop(1, preset.strokeColor);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = preset.fillColor;
  }
  ctx.fill();

  // Internal crisp vector pattern (wood grain, ice sheen, brick joints)
  ctx.save();
  ctx.clip();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  if (meta.materialId === 'wood') {
    ctx.strokeStyle = 'rgba(120, 65, 22, 0.22)';
    ctx.lineWidth = 1.5;
    for (let y = -70; y <= 70; y += 10) {
      ctx.beginPath();
      ctx.moveTo(-120, y);
      ctx.bezierCurveTo(-40, y + 3, 40, y - 3, 120, y);
      ctx.stroke();
    }
  } else if (meta.materialId === 'ice') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3;
    for (let x = -90; x <= 90; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, -90);
      ctx.lineTo(x + 35, 90);
      ctx.stroke();
    }
  } else if (meta.materialId === 'brick') {
    ctx.strokeStyle = 'rgba(255, 235, 225, 0.28)';
    ctx.lineWidth = 1.5;
    for (let y = -60; y <= 60; y += 16) {
      ctx.beginPath();
      ctx.moveTo(-100, y);
      ctx.lineTo(100, y);
      ctx.stroke();
    }
  }

  // Rotation spoke on circles for visual angular feedback
  if (meta.shape === 'circle' && meta.baseRadiusPx) {
    const r = meta.baseRadiusPx * meta.scale;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r - 3, 0);
    ctx.stroke();
  }

  // Subtle hatching if pinned/static ramp
  if (body.isStatic && meta.shape === 'ramp') {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 1.5;
    for (let x = -180; x <= 180; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, -120);
      ctx.lineTo(x - 60, 120);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Crisp outer contour
  ctx.strokeStyle = isSelected ? '#0284C7' : preset.strokeColor;
  ctx.lineWidth = isSelected ? 3 : 1.75;
  ctx.stroke();

  // Selection ring & center marker
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0284C7';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Clean material/mass badge inside larger bodies
  if (meta.shape !== 'ramp') {
    const massLabel = body.isStatic ? 'ثابت' : `${body.mass.toFixed(1)} kg`;
    ctx.direction = body.isStatic ? 'rtl' : 'ltr';
    ctx.font = '600 11px "IBM Plex Mono", "Vazirmatn", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeText(massLabel, body.position.x, body.position.y + (meta.shape === 'circle' ? 12 : 0));
    ctx.fillStyle = '#0F172A';
    ctx.fillText(massLabel, body.position.x, body.position.y + (meta.shape === 'circle' ? 12 : 0));
  }

  ctx.restore();
}

function drawFluidVolume(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld
): void {
  const fluid = FLUID_PRESETS[world.config.fluidId];
  const waterSurfaceY = world.getWaterSurfaceY();
  const baseWaterSurfaceY = world.getBaseWaterSurfaceY();

  ctx.save();

  // Build smooth wave surface path
  const cols = world.waveColumns;
  const colStep = INNER_TANK_WIDTH / (WAVE_COLUMN_COUNT - 1);

  ctx.beginPath();
  ctx.moveTo(INNER_TANK_LEFT, INNER_TANK_BOTTOM);
  ctx.lineTo(INNER_TANK_LEFT, waterSurfaceY + cols[0].height);

  for (let i = 0; i < WAVE_COLUMN_COUNT - 1; i++) {
    const x0 = INNER_TANK_LEFT + i * colStep;
    const y0 = waterSurfaceY + cols[i].height;
    const x1 = INNER_TANK_LEFT + (i + 1) * colStep;
    const y1 = waterSurfaceY + cols[i + 1].height;
    const midX = (x0 + x1) * 0.5;
    const midY = (y0 + y1) * 0.5;
    ctx.quadraticCurveTo(x0, y0, midX, midY);
  }
  ctx.lineTo(
    INNER_TANK_RIGHT,
    waterSurfaceY + cols[WAVE_COLUMN_COUNT - 1].height
  );
  ctx.lineTo(INNER_TANK_RIGHT, INNER_TANK_BOTTOM);
  ctx.closePath();

  // Translucent depth-shaded fluid fill
  const waterGrad = ctx.createLinearGradient(0, waterSurfaceY, 0, INNER_TANK_BOTTOM);
  waterGrad.addColorStop(0, fluid.bodyTopColor);
  waterGrad.addColorStop(1, fluid.bodyBottomColor);
  ctx.fillStyle = waterGrad;
  ctx.fill();

  // Subtle internal refraction caustic ribbons
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = fluid.causticColor;
  ctx.lineWidth = 2;
  const phase = world.simTimeSec * 1.4;
  for (let band = 0; band < 4; band++) {
    const bandY = waterSurfaceY + 34 + band * 54;
    if (bandY > INNER_TANK_BOTTOM - 16) break;
    ctx.beginPath();
    for (let x = INNER_TANK_LEFT; x <= INNER_TANK_RIGHT; x += 28) {
      const waveOffset = Math.sin(x * 0.015 + phase + band * 1.3) * 5;
      if (x === INNER_TANK_LEFT) ctx.moveTo(x, bandY + waveOffset);
      else ctx.lineTo(x, bandY + waveOffset);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Crisp meniscus surface stroke
  ctx.beginPath();
  ctx.moveTo(INNER_TANK_LEFT, waterSurfaceY + cols[0].height);
  for (let i = 0; i < WAVE_COLUMN_COUNT - 1; i++) {
    const x0 = INNER_TANK_LEFT + i * colStep;
    const y0 = waterSurfaceY + cols[i].height;
    const x1 = INNER_TANK_LEFT + (i + 1) * colStep;
    const y1 = waterSurfaceY + cols[i + 1].height;
    const midX = (x0 + x1) * 0.5;
    const midY = (y0 + y1) * 0.5;
    ctx.quadraticCurveTo(x0, y0, midX, midY);
  }
  ctx.lineTo(
    INNER_TANK_RIGHT,
    waterSurfaceY + cols[WAVE_COLUMN_COUNT - 1].height
  );
  ctx.strokeStyle = fluid.surfaceColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Initial water reference line vs displaced water level indicator
  if (world.config.showWaterRefLine) {
    const rise = baseWaterSurfaceY - waterSurfaceY;
    if (rise > 2) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(INNER_TANK_LEFT, baseWaterSurfaceY);
      ctx.lineTo(INNER_TANK_RIGHT, baseWaterSurfaceY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '500 11px "Vazirmatn", sans-serif';
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'right';
      ctx.fillText('سطح اولیه', INNER_TANK_RIGHT - 10, baseWaterSurfaceY + 14);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawWaterDroplets(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld
): void {
  if (world.droplets.length === 0) return;
  const fluid = FLUID_PRESETS[world.config.fluidId];
  ctx.save();
  ctx.fillStyle = fluid.surfaceColor;
  for (const d of world.droplets) {
    ctx.globalAlpha = d.isSplash ? 0.55 : 0.78;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBodyVectors(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld,
  bodies: Matter.Body[]
): void {
  for (const body of bodies) {
    if (body.isStatic) continue;
    const meta = world.metaMap.get(body.id);
    if (!meta) continue;

    if (world.config.showForceVectors) {
      // Gravity Weight vector (Crimson Red, downward, clamped inside tank floor)
      if (meta.lastGravityN > 0.2) {
        const gLen = forceToArrowPixels(meta.lastGravityN);
        const endY = Math.min(INNER_TANK_BOTTOM - 4, body.position.y + gLen);
        drawArrow(
          ctx,
          body.position,
          { x: body.position.x, y: endY },
          '#DC2626',
          `Fg ${meta.lastGravityN.toFixed(0)}N`
        );
      }

      // Buoyancy vector (Emerald Green, upward from Center of Buoyancy)
      if (meta.lastBuoyancyN > 0.2) {
        const bLen = forceToArrowPixels(meta.lastBuoyancyN);
        const origin = meta.lastSubmergedCentroid;
        drawArrow(
          ctx,
          origin,
          { x: origin.x, y: origin.y - bLen },
          '#059669',
          `Fb ${meta.lastBuoyancyN.toFixed(0)}N`
        );
      }
    }

    if (world.config.showVelocityVector) {
      const speed = Math.hypot(meta.lastVelocityMs.x, meta.lastVelocityMs.y);
      if (speed > 0.08) {
        const vScale = Math.min(110, 14 + speed * 20);
        const ux = meta.lastVelocityMs.x / speed;
        const uy = meta.lastVelocityMs.y / speed;
        drawArrow(
          ctx,
          body.position,
          {
            x: body.position.x + ux * vScale,
            y: body.position.y + uy * vScale,
          },
          '#0284C7',
          `v ${speed.toFixed(1)}m/s`
        );
      }
    }
  }
}

function drawSpringScale(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld
): void {
  const { x, y, attachedBodyId } = world.scale;
  const hookPt = world.getScaleHookPoint();

  let readingN = 0;
  let attachedBody: Matter.Body | null = null;
  if (attachedBodyId !== null) {
    attachedBody = world.findBody(attachedBodyId);
    const meta = world.metaMap.get(attachedBodyId);
    if (meta) {
      readingN = Math.max(0, meta.lastGravityN - meta.lastBuoyancyN);
    }
  }

  ctx.save();

  // Cord to attached body
  if (attachedBody) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hookPt.x, hookPt.y + 8);
    ctx.lineTo(attachedBody.position.x, attachedBody.position.y);
    ctx.stroke();
  }

  // Top suspension ring
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y - 34, 9, 0, Math.PI * 2);
  ctx.stroke();

  // Scale housing body
  drawRoundedRect(ctx, x - 34, y - 24, 68, 78, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.75;
  ctx.stroke();

  // Digital scientific readout inside housing
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x - 27, y - 16, 54, 34);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 27, y - 16, 54, 34);

  ctx.direction = 'ltr';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${readingN.toFixed(1)} N`, x, y - 4);

  const kg = world.config.gravity > 0.05 ? readingN / world.config.gravity : 0;
  ctx.fillStyle = '#475569';
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.fillText(`${kg.toFixed(1)} kg`, x, y + 10);

  // Label at bottom of housing
  ctx.direction = 'rtl';
  ctx.fillStyle = '#0284C7';
  ctx.font = '600 10px "Vazirmatn", sans-serif';
  ctx.fillText('نیروسنج', x, y + 36);

  // Animated spring coil down to hook
  const stretch = attachedBody ? Math.min(14, 4 + Math.log10(1 + readingN) * 4) : 0;
  const springTop = y + 54;
  const springBottom = hookPt.y + stretch * 0.4;
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, springTop);
  const coils = 5;
  for (let i = 1; i <= coils; i++) {
    const cy = springTop + ((springBottom - springTop) * i) / (coils + 1);
    const cx = x + (i % 2 === 0 ? -6 : 6);
    ctx.lineTo(cx, cy);
  }
  ctx.lineTo(x, springBottom);
  ctx.stroke();

  // Hook J-shape
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, springBottom + 6, 6, -Math.PI / 2, Math.PI, false);
  ctx.stroke();

  ctx.restore();
}

function drawMetricRuler(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld
): void {
  const { x, y, angleRad, lengthPx } = world.ruler;
  const heightPx = 38;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Translucent scientific yellow-ivory ruler
  drawRoundedRect(ctx, 0, 0, lengthPx, heightPx, 4);
  ctx.fillStyle = 'rgba(254, 243, 199, 0.90)';
  ctx.fill();
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Metric ticks (each 0.1m = 15px, major 0.5m = 75px)
  const stepCm10 = PIXELS_PER_METER * 0.1; // 15 px = 10 cm
  ctx.direction = 'ltr';
  ctx.strokeStyle = '#78350F';
  ctx.fillStyle = '#78350F';
  ctx.font = '600 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const numSteps = Math.floor(lengthPx / stepCm10);
  for (let i = 0; i <= numSteps; i++) {
    const tx = i * stepCm10;
    const isMajor = i % 5 === 0;
    const tickH = isMajor ? 14 : 7;
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.lineTo(tx, tickH);
    ctx.stroke();

    if (isMajor) {
      const meters = (i * 0.1).toFixed(1);
      ctx.fillText(i === 0 ? '0' : `${meters}m`, tx + (i === 0 ? 6 : 0), 16);
    }
  }

  // Rotation knob at right end
  ctx.beginPath();
  ctx.arc(lengthPx - 14, heightPx / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawPendingPolygon(
  ctx: CanvasRenderingContext2D,
  points: Vec2[],
  hoverPoint: Vec2 | null
): void {
  ctx.save();
  ctx.strokeStyle = '#0284C7';
  ctx.fillStyle = 'rgba(2, 132, 199, 0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (hoverPoint) {
    ctx.lineTo(hoverPoint.x, hoverPoint.y);
  }
  if (points.length >= 3) {
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#059669' : '#0284C7';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
