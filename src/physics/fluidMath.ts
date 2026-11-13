import type { Vec2 } from './types';

export interface SubmergedPolygonResult {
  totalAreaPx2: number;
  submergedAreaPx2: number;
  submergedFraction: number;
  submergedCentroid: Vec2;
}

export interface WaveColumn {
  height: number; // offset from equilibrium waterSurfaceY (positive = downward in screen coords, negative = upward)
  targetHeight: number;
  velocity: number;
}

/**
 * Computes signed area and centroid of a closed 2D polygon using the shoelace formula.
 * Works for clockwise or counter-clockwise vertex ordering.
 */
export function computePolygonAreaAndCentroid(vertices: Vec2[]): {
  area: number;
  centroid: Vec2;
} {
  const n = vertices.length;
  if (n < 3) {
    return { area: 0, centroid: vertices[0] ?? { x: 0, y: 0 } };
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % n];
    const cross = p0.x * p1.y - p1.x * p0.y;
    twiceArea += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }

  const area = Math.abs(twiceArea) * 0.5;
  if (area < 1e-6) {
    let avgX = 0;
    let avgY = 0;
    for (const v of vertices) {
      avgX += v.x;
      avgY += v.y;
    }
    return { area: 0, centroid: { x: avgX / n, y: avgY / n } };
  }

  const factor = 1 / (3 * twiceArea);
  return {
    area,
    centroid: { x: cx * factor, y: cy * factor },
  };
}

/**
 * Clips a polygon against the half-plane y >= waterSurfaceY (screen coordinates where +y is down).
 * Returns the submerged polygon vertices.
 */
export function clipPolygonBelowWater(
  vertices: Vec2[],
  waterSurfaceY: number
): Vec2[] {
  const n = vertices.length;
  if (n < 3) return [];

  const output: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const current = vertices[i];
    const prev = vertices[(i + n - 1) % n];

    const currentInside = current.y >= waterSurfaceY;
    const prevInside = prev.y >= waterSurfaceY;

    if (currentInside !== prevInside) {
      const dy = current.y - prev.y;
      const t = Math.abs(dy) < 1e-9 ? 0 : (waterSurfaceY - prev.y) / dy;
      output.push({
        x: prev.x + t * (current.x - prev.x),
        y: waterSurfaceY,
      });
    }

    if (currentInside) {
      output.push({ x: current.x, y: current.y });
    }
  }

  return output;
}

/**
 * Computes exact submerged area, fraction, and center of buoyancy for an arbitrary polygon
 * against a water surface at `waterSurfaceY` (in screen coordinates, +y down).
 */
export function computePolygonSubmersion(
  vertices: Vec2[],
  waterSurfaceY: number
): SubmergedPolygonResult {
  const full = computePolygonAreaAndCentroid(vertices);
  if (full.area <= 1e-6) {
    return {
      totalAreaPx2: 0,
      submergedAreaPx2: 0,
      submergedFraction: 0,
      submergedCentroid: full.centroid,
    };
  }

  const clipped = clipPolygonBelowWater(vertices, waterSurfaceY);
  if (clipped.length < 3) {
    return {
      totalAreaPx2: full.area,
      submergedAreaPx2: 0,
      submergedFraction: 0,
      submergedCentroid: full.centroid,
    };
  }

  const sub = computePolygonAreaAndCentroid(clipped);
  const clampedArea = Math.min(sub.area, full.area);
  return {
    totalAreaPx2: full.area,
    submergedAreaPx2: clampedArea,
    submergedFraction: Math.max(0, Math.min(1, clampedArea / full.area)),
    submergedCentroid: sub.centroid,
  };
}

/**
 * Exact analytic submerged area and centroid for a circle of radius `r` centered at `center`
 * below horizontal line `waterSurfaceY` (screen coordinates, +y down).
 */
export function computeCircleSubmersion(
  center: Vec2,
  radius: number,
  waterSurfaceY: number
): SubmergedPolygonResult {
  const totalArea = Math.PI * radius * radius;
  if (radius <= 0) {
    return {
      totalAreaPx2: 0,
      submergedAreaPx2: 0,
      submergedFraction: 0,
      submergedCentroid: center,
    };
  }

  const bottomY = center.y + radius;
  const topY = center.y - radius;

  // Completely above water
  if (waterSurfaceY >= bottomY) {
    return {
      totalAreaPx2: totalArea,
      submergedAreaPx2: 0,
      submergedFraction: 0,
      submergedCentroid: { ...center },
    };
  }

  // Completely submerged
  if (waterSurfaceY <= topY) {
    return {
      totalAreaPx2: totalArea,
      submergedAreaPx2: totalArea,
      submergedFraction: 1,
      submergedCentroid: { ...center },
    };
  }

  // Partially submerged circular segment of height h from bottom
  const h = bottomY - waterSurfaceY; // 0 < h < 2r
  const d = radius - h; // signed distance from circle center down to water surface (-r < d < r)
  const clampedRatio = Math.max(-1, Math.min(1, d / radius));
  const theta = 2 * Math.acos(clampedRatio); // central angle in radians (0 .. 2π)

  const submergedArea = 0.5 * radius * radius * (theta - Math.sin(theta));
  const submergedFraction = Math.max(0, Math.min(1, submergedArea / totalArea));

  // Centroid of circular segment relative to circle center (downward offset along +y)
  // Standard formula: y_bar from center = (4 * r * sin^3(theta/2)) / (3 * (theta - sin(theta)))
  const sinHalf = Math.sin(theta * 0.5);
  const denom = 3 * (theta - Math.sin(theta));
  const offsetFromCenterY =
    denom > 1e-6 ? (4 * radius * sinHalf * sinHalf * sinHalf) / denom : 0;

  return {
    totalAreaPx2: totalArea,
    submergedAreaPx2: submergedArea,
    submergedFraction,
    submergedCentroid: {
      x: center.x,
      y: center.y + offsetFromCenterY,
    },
  };
}

/**
 * Converts pixel area to physical volume in cubic meters (m³) using slab thickness.
 */
export function areaPxToVolumeM3(
  areaPx2: number,
  pixelsPerMeter: number,
  slabDepthM: number
): number {
  const areaM2 = areaPx2 / (pixelsPerMeter * pixelsPerMeter);
  return areaM2 * slabDepthM;
}

/**
 * Computes Archimedes buoyancy force in Newtons (upward magnitude).
 * F_b = rho_fluid * V_submerged * g
 */
export function computeBuoyancyForceN(
  fluidDensityKgM3: number,
  submergedVolumeM3: number,
  gravityMs2: number
): number {
  if (fluidDensityKgM3 <= 0 || submergedVolumeM3 <= 0 || gravityMs2 <= 0) {
    return 0;
  }
  return fluidDensityKgM3 * submergedVolumeM3 * gravityMs2;
}

/**
 * Computes water level rise (in pixels) inside a rectangular tank of inner width `tankWidthPx`
 * caused by `totalSubmergedAreaPx2`.
 */
export function computeDisplacedWaterRisePx(
  totalSubmergedAreaPx2: number,
  tankWidthPx: number,
  maxRisePx: number
): number {
  if (tankWidthPx <= 0 || totalSubmergedAreaPx2 <= 0) return 0;
  const rise = totalSubmergedAreaPx2 / tankWidthPx;
  return Math.max(0, Math.min(maxRisePx, rise));
}

/**
 * Computes hydrodynamic drag force in Newtons opposing velocity.
 * Combines linear Stokes-like damping and quadratic drag scaled by fluid density, viscosity, and submerged fraction.
 */
export function computeFluidDragForceN(
  velocityMs: Vec2,
  submergedFraction: number,
  charLengthM: number,
  slabDepthM: number,
  fluidDensityKgM3: number,
  viscosityMultiplier: number
): Vec2 {
  if (submergedFraction <= 0) {
    return { x: 0, y: 0 };
  }

  const speed = Math.hypot(velocityMs.x, velocityMs.y);
  if (speed < 1e-6) {
    return { x: 0, y: 0 };
  }

  const crossAreaM2 = Math.max(0.01, charLengthM * slabDepthM) * submergedFraction;
  const cd = 1.05;
  const quadMag = 0.5 * fluidDensityKgM3 * cd * crossAreaM2 * speed * speed;
  const linearMag = 18 * viscosityMultiplier * charLengthM * submergedFraction * speed;
  const totalMag = quadMag + linearMag;

  return {
    x: -(velocityMs.x / speed) * totalMag,
    y: -(velocityMs.y / speed) * totalMag,
  };
}

/**
 * Advances the 1D spring-coupled wave columns by one fixed step.
 * Uses Hooke's law restoration + neighbor height coupling for crisp realistic ripples.
 */
export function stepWaveColumns(
  columns: WaveColumn[],
  tension = 0.028,
  damping = 0.035,
  spread = 0.22
): void {
  const n = columns.length;
  if (n === 0) return;

  for (let i = 0; i < n; i++) {
    const col = columns[i];
    const x = col.height - col.targetHeight;
    const accel = -tension * x - damping * col.velocity;
    col.velocity += accel;
    col.height += col.velocity;
  }

  const leftDeltas = new Float64Array(n);
  const rightDeltas = new Float64Array(n);

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        leftDeltas[i] = spread * (columns[i].height - columns[i - 1].height);
        columns[i - 1].velocity += leftDeltas[i];
      }
      if (i < n - 1) {
        rightDeltas[i] = spread * (columns[i].height - columns[i + 1].height);
        columns[i + 1].velocity += rightDeltas[i];
      }
    }

    for (let i = 0; i < n; i++) {
      if (i > 0) columns[i - 1].height += leftDeltas[i];
      if (i < n - 1) columns[i + 1].height += rightDeltas[i];
    }
  }
}
