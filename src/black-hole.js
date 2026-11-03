import * as THREE from "three";
import fragmentShader from "./shaders/cosmogon-black-hole.frag.glsl?raw";

// Browser port of ashvyagni/Cosmogon (MIT OR Apache-2.0).
// Shader/defaults: render/shaders/black_hole.wgsl and render/stellar.rs.
// Sky recipe: render/sky.rs, with browser-friendly seeded noise and PRNG.
// https://github.com/ashvyagni/cosmogon/tree/86c25027ec31957fee698744ee909ece29e429dd
const HOLE_BOUND = 60;
const SCHWARZSCHILD_RADIUS = 0.35;

// Realistic star color palette (spectral classes matching starfield.js)
const STAR_COLORS = [
  [0.6, 0.7, 1.0],   // blue-white (hot O/B stars)
  [0.75, 0.85, 1.0],  // pale blue (A stars)
  [1.0, 1.0, 1.0],    // white (F stars)
  [1.0, 0.95, 0.8],   // warm white (G stars, like the Sun)
  [1.0, 0.85, 0.6],   // pale orange (K stars)
  [1.0, 0.65, 0.4],   // orange-red (M stars)
];

function createStarfield(size = 1024, starCount = 4000) {
  const faces = [];
  const canvases = [];
  const contexts = [];

  for (let face = 0; face < 6; face++) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#020208";
    ctx.fillRect(0, 0, size, size);
    canvases.push(canvas);
    contexts.push(ctx);
  }

  // Draw natural point stars with soft radial glows matching starfield.js
  for (let i = 0; i < starCount; i++) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(1 - z * z);
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const dz = z;

    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(dz);
    let face, ma, uc, vc;
    if (ax >= ay && ax >= az) {
      face = x > 0 ? 0 : 1; ma = ax; uc = x > 0 ? -dz : dz; vc = -y;
    } else if (ay >= az) {
      face = y > 0 ? 2 : 3; ma = ay; uc = x; vc = y > 0 ? dz : -dz;
    } else {
      face = dz > 0 ? 4 : 5; ma = az; uc = dz > 0 ? x : -x; vc = -y;
    }

    const sx = ((uc / ma + 1) * 0.5) * size;
    const sy = ((vc / ma + 1) * 0.5) * size;

    const tint = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    const brightness = 0.2 + Math.random() * 0.6;
    const starRadius = Math.random() < 0.85 ? (0.8 + Math.random() * 1.2) : (2.0 + Math.random() * 1.8);

    const ctx = contexts[face];
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, starRadius * 2.5);
    const rInt = Math.round(tint[0] * 255);
    const gInt = Math.round(tint[1] * 255);
    const bInt = Math.round(tint[2] * 255);
    grad.addColorStop(0, `rgba(${rInt}, ${gInt}, ${bInt}, ${brightness})`);
    grad.addColorStop(0.3, `rgba(${rInt}, ${gInt}, ${bInt}, ${brightness * 0.7})`);
    grad.addColorStop(1, `rgba(${rInt}, ${gInt}, ${bInt}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, starRadius * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let face = 0; face < 6; face++) {
    faces.push(canvases[face]);
  }

  const sky = new THREE.CubeTexture(faces);
  sky.colorSpace = THREE.SRGBColorSpace;
  sky.needsUpdate = true;
  return sky;
}

function createWarpTextTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = "16px";
    }
    ctx.font = '400 190px "Michroma", sans-serif';
    ctx.shadowColor = "rgba(255, 220, 180, 0)";
    ctx.shadowBlur = 22;

    // Top half (v in [0.5, 1.0]): left word "MANIT" — right-aligned so inner 'T' sits at u = 0.96
    ctx.textAlign = "right";
    ctx.fillText("MANIT", canvas.width * 0.96, 256);
    // Bottom half (v in [0.0, 0.5]): right word "BISHT" — left-aligned so inner 'B' sits at u = 0.04
    ctx.textAlign = "left";
    ctx.fillText("BISHT", canvas.width * 0.04, 768);

    texture.needsUpdate = true;
  }

  draw();
  if (document.fonts) {
    document.fonts.load('400 190px "Michroma"').then(draw).catch(() => {});
    document.fonts.ready.then(draw).catch(() => {});
  }

  return texture;
}

export function createBlackHole() {
  const sky = createStarfield();
  const textTexture = createWarpTextTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCamera: { value: new THREE.Vector3() },
      uDiskNormal: { value: new THREE.Vector3(0, 1, 0) },
      uParams: { value: new THREE.Vector3(HOLE_BOUND, 3, 14) },
      uBrightness: { value: 2.5 },
      uTime: { value: 0 },
      uSky: { value: sky },
      uText: { value: textTexture },
      uZoomProgress: { value: 0 },
      uAspect: { value: window.innerWidth / window.innerHeight },
      uRadius: { value: SCHWARZSCHILD_RADIUS },
    },
    vertexShader: `
      uniform float uRadius;
      varying vec3 vHolePosition;
      void main() {
        vHolePosition = position / uRadius;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    // One face is discarded by the shader; avoid Three.js' two transparency passes.
    forceSinglePass: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(HOLE_BOUND * SCHWARZSCHILD_RADIUS, 48, 32),
    material,
  );
  mesh.name = "Cosmogon black hole";
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(material.uniforms.uCamera.value);
    mesh.worldToLocal(material.uniforms.uCamera.value).divideScalar(SCHWARZSCHILD_RADIUS);
  };
  return { mesh, sky };
}
