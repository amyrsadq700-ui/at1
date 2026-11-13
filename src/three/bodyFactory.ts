import Matter from 'matter-js';
import * as THREE from 'three';
import type { SimBodyMeta } from '../physics/engine';
import { PIXELS_PER_METER, type MaterialId } from '../physics/types';
import type { ProceduralTexturePack } from './proceduralTextures';

const BODY_Z_DEPTH = 0.44; // meters in 3D

function createPbrMaterialForId(
  materialId: MaterialId,
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean
): THREE.MeshPhysicalMaterial {
  switch (materialId) {
    case 'wood':
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: textures.woodAlbedo,
        bumpMap: textures.woodBump,
        bumpScale: 0.014,
        roughness: 0.74,
        metalness: 0.0,
        clearcoat: 0.12,
        clearcoatRoughness: 0.6,
      });
    case 'ice':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdcf4ff,
        bumpMap: textures.iceBump,
        bumpScale: 0.012,
        roughness: 0.14,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        ior: 1.31,
        transmission: isSoftwareGl ? 0 : 0.72,
        transparent: true,
        opacity: isSoftwareGl ? 0.72 : 1.0,
        thickness: 0.45,
        attenuationColor: new THREE.Color(0x7dd3fc),
        attenuationDistance: 1.2,
      });
    case 'rubber':
      return new THREE.MeshPhysicalMaterial({
        color: 0x334155,
        roughness: 0.86,
        metalness: 0.0,
        clearcoat: 0.05,
      });
    case 'brick':
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: textures.brickAlbedo,
        bumpMap: textures.brickBump,
        bumpScale: 0.025,
        roughness: 0.9,
        metalness: 0.0,
      });
    case 'aluminum':
      return new THREE.MeshPhysicalMaterial({
        color: 0xdbe2ea,
        roughnessMap: textures.brushedMetalRoughness,
        roughness: 0.3,
        metalness: 0.92,
        anisotropy: 0.7,
        anisotropyRotation: 0,
      });
    case 'steel':
      return new THREE.MeshPhysicalMaterial({
        color: 0x8b99ab,
        roughnessMap: textures.brushedMetalRoughness,
        roughness: 0.24,
        metalness: 0.96,
        anisotropy: 0.85,
        anisotropyRotation: 0.2,
      });
    case 'gold':
      return new THREE.MeshPhysicalMaterial({
        color: 0xf7c948,
        roughnessMap: textures.brushedMetalRoughness,
        roughness: 0.18,
        metalness: 0.98,
        anisotropy: 0.85,
        anisotropyRotation: 0.1,
      });
    default:
      return new THREE.MeshPhysicalMaterial({
        color: 0x6366f1,
        roughness: 0.38,
        metalness: 0.18,
        clearcoat: 0.55,
        clearcoatRoughness: 0.2,
      });
  }
}

function createAccentTrimMaterial(materialId: MaterialId): THREE.MeshStandardMaterial {
  if (materialId === 'wood') {
    return new THREE.MeshStandardMaterial({
      color: 0x5c3a1e,
      roughness: 0.44,
      metalness: 0.05,
    });
  }
  if (materialId === 'steel' || materialId === 'gold' || materialId === 'aluminum') {
    return new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.62,
      metalness: 0.35,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.78,
  });
}

function enableShadows(group: THREE.Object3D, castShadows: boolean): void {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = castShadows;
      child.receiveShadow = true;
    }
  });
}

export function buildCompositeBodyMesh(
  body: Matter.Body,
  meta: SimBodyMeta,
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean,
  castShadows: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = `sim-body-${body.id}`;
  group.userData.bodyId = body.id;

  const primaryMat = createPbrMaterialForId(meta.materialId, textures, isSoftwareGl);
  const trimMat = createAccentTrimMaterial(meta.materialId);

  if (meta.shape === 'circle' && meta.baseRadiusPx) {
    const r = (meta.baseRadiusPx * meta.scale) / PIXELS_PER_METER;
    // 1. Primary sphere
    const sphereGeo = new THREE.SphereGeometry(r, 32, 24);
    const sphere = new THREE.Mesh(sphereGeo, primaryMat);
    sphere.userData.bodyId = body.id;
    group.add(sphere);

    // 2. Equatorial calibrated seam ring
    const seamGeo = new THREE.TorusGeometry(r * 0.995, Math.max(0.01, r * 0.045), 10, 36);
    const seam = new THREE.Mesh(seamGeo, trimMat);
    seam.rotation.x = Math.PI / 2;
    seam.userData.bodyId = body.id;
    group.add(seam);

    // 3. Calibration meridian pin / polar caps (for clear rolling feedback)
    const capGeo = new THREE.CylinderGeometry(r * 0.22, r * 0.26, r * 2.04, 16);
    const cap = new THREE.Mesh(capGeo, trimMat);
    cap.rotation.z = Math.PI / 2;
    cap.userData.bodyId = body.id;
    group.add(cap);
  } else if (meta.shape === 'box') {
    const w = ((meta.baseWidthPx ?? 72) * meta.scale) / PIXELS_PER_METER;
    const h = ((meta.baseHeightPx ?? 72) * meta.scale) / PIXELS_PER_METER;
    const d = BODY_Z_DEPTH;

    // 1. Chamfered/beveled core via ExtrudeGeometry
    const hw = w * 0.5 - 0.015;
    const hh = h * 0.5 - 0.015;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: d - 0.03,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    extrudeGeo.center();
    const core = new THREE.Mesh(extrudeGeo, primaryMat);
    core.userData.bodyId = body.id;
    group.add(core);

    // 2. Top & bottom structural collar bands
    const bandGeo = new THREE.BoxGeometry(w * 1.01, Math.min(0.04, h * 0.14), d * 1.015);
    const topBand = new THREE.Mesh(bandGeo, trimMat);
    topBand.position.y = h * 0.34;
    topBand.userData.bodyId = body.id;
    group.add(topBand);

    const botBand = new THREE.Mesh(bandGeo, trimMat);
    botBand.position.y = -h * 0.34;
    botBand.userData.bodyId = body.id;
    group.add(botBand);

    // 3. Calibration center boss / lifting eyelet
    const bossGeo = new THREE.CylinderGeometry(0.045, 0.055, d * 1.06, 18);
    const boss = new THREE.Mesh(bossGeo, trimMat);
    boss.rotation.x = Math.PI / 2;
    boss.userData.bodyId = body.id;
    group.add(boss);
  } else {
    // Polygon or Ramp: build exact beveled ExtrudeGeometry from local body vertices!
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    const shape = new THREE.Shape();

    const localPts = body.vertices.map((v) => {
      const dx = (v.x - body.position.x) / PIXELS_PER_METER;
      const dy = -(v.y - body.position.y) / PIXELS_PER_METER; // +Y up
      return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos,
      };
    });

    if (localPts.length >= 3) {
      shape.moveTo(localPts[0].x, localPts[0].y);
      for (let i = 1; i < localPts.length; i++) {
        shape.lineTo(localPts[i].x, localPts[i].y);
      }
      shape.closePath();
    }

    const depth = meta.shape === 'ramp' ? 0.72 : BODY_Z_DEPTH;
    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 0.024,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    extrudeGeo.translate(0, 0, -(depth - 0.024) * 0.5);
    const polyMesh = new THREE.Mesh(extrudeGeo, primaryMat);
    polyMesh.userData.bodyId = body.id;
    group.add(polyMesh);

    if (meta.shape === 'ramp') {
      // Secondary machined structural side rails + base anti-slip pad
      const w = ((meta.baseWidthPx ?? 220) * meta.scale) / PIXELS_PER_METER;
      const h = ((meta.baseHeightPx ?? 110) * meta.scale) / PIXELS_PER_METER;
      const basePadGeo = new THREE.BoxGeometry(w * 0.96, 0.035, depth * 1.03);
      const basePad = new THREE.Mesh(basePadGeo, trimMat);
      basePad.position.set(0, -h * 0.32, 0);
      basePad.userData.bodyId = body.id;
      group.add(basePad);

      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, depth * 1.06, 16);
      const pin = new THREE.Mesh(pinGeo, trimMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(-w * 0.16, -h * 0.08, 0);
      pin.userData.bodyId = body.id;
      group.add(pin);
    } else {
      // Calibration stud on polygon center
      const studGeo = new THREE.CylinderGeometry(0.04, 0.04, depth * 1.05, 16);
      const stud = new THREE.Mesh(studGeo, trimMat);
      stud.rotation.x = Math.PI / 2;
      stud.userData.bodyId = body.id;
      group.add(stud);
    }
  }

  // Selection highlight halo (toggled visible when selected)
  const effectiveDepth = meta.shape === 'ramp' ? 0.72 : BODY_Z_DEPTH;
  const approxRadius =
    meta.shape === 'circle' && meta.baseRadiusPx
      ? (meta.baseRadiusPx * meta.scale) / PIXELS_PER_METER
      : Math.max(
          ((meta.baseWidthPx ?? 72) * meta.scale) / PIXELS_PER_METER,
          ((meta.baseHeightPx ?? 72) * meta.scale) / PIXELS_PER_METER
        ) * 0.45;
  const haloInner = Math.max(0.18, approxRadius * 0.95);
  const haloOuter = haloInner + 0.032;
  const haloGeo = new THREE.RingGeometry(haloInner, haloOuter, 36);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x0284c7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.name = 'selection-halo';
  halo.position.z = effectiveDepth * 0.54;
  halo.visible = false;
  group.add(halo);

  enableShadows(group, castShadows);
  return group;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
}
