import * as THREE from 'three';

export interface ProceduralTexturePack {
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  brushedMetalRoughness: THREE.CanvasTexture;
  brickAlbedo: THREE.CanvasTexture;
  brickBump: THREE.CanvasTexture;
  iceBump: THREE.CanvasTexture;
  labBenchAlbedo: THREE.CanvasTexture;
  causticMap: THREE.CanvasTexture;
  rulerScaleMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTexturePack(
  maxAnisotropy: number
): ProceduralTexturePack {
  // 1. Wood Grain Albedo + Bump
  const [woodColC, woodColCtx] = makeCanvas(512, 512);
  const [woodBumpC, woodBumpCtx] = makeCanvas(512, 512);

  woodColCtx.fillStyle = '#c8935a';
  woodColCtx.fillRect(0, 0, 512, 512);
  woodBumpCtx.fillStyle = '#808080';
  woodBumpCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 3) {
    const wave = Math.sin(y * 0.08) * 14 + Math.sin(y * 0.023) * 28;
    const tone = (Math.sin(y * 0.14 + wave * 0.05) + 1) * 0.5;
    woodColCtx.strokeStyle =
      tone > 0.5 ? 'rgba(130, 74, 28, 0.28)' : 'rgba(235, 194, 140, 0.22)';
    woodColCtx.lineWidth = 1.5 + (y % 5) * 0.25;
    woodColCtx.beginPath();
    woodColCtx.moveTo(0, y);
    woodColCtx.bezierCurveTo(170, y + wave * 0.3, 340, y - wave * 0.3, 512, y);
    woodColCtx.stroke();

    const bVal = Math.round(110 + tone * 45);
    woodBumpCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
    woodBumpCtx.lineWidth = 2;
    woodBumpCtx.beginPath();
    woodBumpCtx.moveTo(0, y);
    woodBumpCtx.bezierCurveTo(170, y + wave * 0.3, 340, y - wave * 0.3, 512, y);
    woodBumpCtx.stroke();
  }

  // 2. Anisotropic Brushed Metal Roughness Map
  const [metalC, metalCtx] = makeCanvas(256, 256);
  metalCtx.fillStyle = '#606060';
  metalCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * 256;
    const v = Math.round(70 + Math.random() * 90);
    metalCtx.strokeStyle = `rgb(${v},${v},${v})`;
    metalCtx.lineWidth = 0.8 + Math.random() * 0.8;
    metalCtx.beginPath();
    metalCtx.moveTo(0, y);
    metalCtx.lineTo(256, y + (Math.random() - 0.5) * 2);
    metalCtx.stroke();
  }

  // 3. Brick Albedo + Bump
  const [brickColC, brickColCtx] = makeCanvas(256, 256);
  const [brickBumpC, brickBumpCtx] = makeCanvas(256, 256);
  brickColCtx.fillStyle = '#d6cfc7'; // mortar
  brickColCtx.fillRect(0, 0, 256, 256);
  brickBumpCtx.fillStyle = '#454545';
  brickBumpCtx.fillRect(0, 0, 256, 256);

  const rows = 4;
  const cols = 2;
  const rowH = 256 / rows;
  const colW = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset + 4;
      const by = r * rowH + 4;
      const bw = colW - 8;
      const bh = rowH - 8;
      const shade = 165 + ((r * 7 + c * 13) % 24);
      brickColCtx.fillStyle = `rgb(${shade}, ${Math.round(shade * 0.44)}, ${Math.round(
        shade * 0.36
      )})`;
      brickColCtx.fillRect(bx, by, bw, bh);
      brickBumpCtx.fillStyle = '#d4d4d4';
      brickBumpCtx.fillRect(bx, by, bw, bh);
    }
  }
  // Subtle mineral speckles
  for (let i = 0; i < 650; i++) {
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    brickColCtx.fillStyle =
      Math.random() > 0.5 ? 'rgba(60,20,15,0.14)' : 'rgba(255,220,200,0.12)';
    brickColCtx.fillRect(px, py, 2, 2);
  }

  // 4. Ice Crystalline Micro-Bump
  const [iceC, iceCtx] = makeCanvas(256, 256);
  iceCtx.fillStyle = '#888888';
  iceCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    const x0 = Math.random() * 256;
    const y0 = Math.random() * 256;
    const angle = Math.random() * Math.PI * 2;
    const len = 30 + Math.random() * 90;
    const val = Math.random() > 0.5 ? 210 : 60;
    iceCtx.strokeStyle = `rgba(${val},${val},${val},0.45)`;
    iceCtx.lineWidth = 1.2;
    iceCtx.beginPath();
    iceCtx.moveTo(x0, y0);
    iceCtx.lineTo(x0 + Math.cos(angle) * len, y0 + Math.sin(angle) * len);
    iceCtx.stroke();
  }

  // 5. Laboratory Bench Top Surface
  const [benchC, benchCtx] = makeCanvas(512, 512);
  benchCtx.fillStyle = '#e8edf3';
  benchCtx.fillRect(0, 0, 512, 512);
  benchCtx.strokeStyle = '#d7e0ea';
  benchCtx.lineWidth = 2;
  for (let g = 0; g <= 512; g += 64) {
    benchCtx.beginPath();
    benchCtx.moveTo(g, 0);
    benchCtx.lineTo(g, 512);
    benchCtx.stroke();
    benchCtx.beginPath();
    benchCtx.moveTo(0, g);
    benchCtx.lineTo(512, g);
    benchCtx.stroke();
  }

  // 6. Water Caustics Pattern
  const [causticC, causticCtx] = makeCanvas(256, 256);
  causticCtx.fillStyle = '#000000';
  causticCtx.fillRect(0, 0, 256, 256);
  causticCtx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
  causticCtx.lineWidth = 2.5;
  for (let i = 0; i < 28; i++) {
    const cx = (i * 53) % 256;
    const cy = (i * 97) % 256;
    const r = 18 + (i % 5) * 10;
    causticCtx.beginPath();
    causticCtx.ellipse(cx, cy, r * 1.4, r * 0.75, (i * 0.6) % Math.PI, 0, Math.PI * 2);
    causticCtx.stroke();
  }

  // 7. Tank Metric Graduation Strip
  const [scaleC, scaleCtx] = makeCanvas(128, 1024);
  scaleCtx.clearRect(0, 0, 128, 1024);
  scaleCtx.strokeStyle = '#334155';
  scaleCtx.fillStyle = '#1e293b';
  scaleCtx.font = '600 22px "IBM Plex Mono", monospace';
  scaleCtx.textAlign = 'left';
  scaleCtx.textBaseline = 'middle';

  const maxMeters = 3.6;
  for (let m = 0; m <= maxMeters; m += 0.25) {
    const y = 1024 - (m / maxMeters) * 1024;
    const isHalf = Math.abs(m * 2 - Math.round(m * 2)) < 0.01;
    scaleCtx.lineWidth = isHalf ? 4 : 2;
    scaleCtx.beginPath();
    scaleCtx.moveTo(0, y);
    scaleCtx.lineTo(isHalf ? 36 : 20, y);
    scaleCtx.stroke();
    if (isHalf && m > 0 && m < maxMeters) {
      scaleCtx.fillText(`${m.toFixed(1)}m`, 44, y);
    }
  }

  const woodAlbedo = configureTexture(new THREE.CanvasTexture(woodColC), true, maxAnisotropy);
  const woodBump = configureTexture(new THREE.CanvasTexture(woodBumpC), false, maxAnisotropy);
  const brushedMetalRoughness = configureTexture(
    new THREE.CanvasTexture(metalC),
    false,
    maxAnisotropy
  );
  const brickAlbedo = configureTexture(new THREE.CanvasTexture(brickColC), true, maxAnisotropy);
  const brickBump = configureTexture(new THREE.CanvasTexture(brickBumpC), false, maxAnisotropy);
  const iceBump = configureTexture(new THREE.CanvasTexture(iceC), false, maxAnisotropy);
  const labBenchAlbedo = configureTexture(
    new THREE.CanvasTexture(benchC),
    true,
    maxAnisotropy,
    4,
    4
  );
  const causticMap = configureTexture(
    new THREE.CanvasTexture(causticC),
    true,
    maxAnisotropy,
    3,
    1
  );
  const rulerScaleMap = new THREE.CanvasTexture(scaleC);
  rulerScaleMap.colorSpace = THREE.SRGBColorSpace;
  rulerScaleMap.anisotropy = maxAnisotropy;
  rulerScaleMap.needsUpdate = true;

  const allTextures = [
    woodAlbedo,
    woodBump,
    brushedMetalRoughness,
    brickAlbedo,
    brickBump,
    iceBump,
    labBenchAlbedo,
    causticMap,
    rulerScaleMap,
  ];

  return {
    woodAlbedo,
    woodBump,
    brushedMetalRoughness,
    brickAlbedo,
    brickBump,
    iceBump,
    labBenchAlbedo,
    causticMap,
    rulerScaleMap,
    dispose: () => {
      for (const t of allTextures) t.dispose();
    },
  };
}
