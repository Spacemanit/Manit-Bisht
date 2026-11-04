import * as THREE from "three";
import fragmentShader from "./shaders/white-hole.frag.glsl?raw";

const HOLE_BOUND = 60;
const SCHWARZSCHILD_RADIUS = 0.35;

// Realistic spectral classes for the dense white hole starfield
const STAR_COLORS = [
  [0.65, 0.75, 1.0],  // Hot O/B blue-white
  [0.80, 0.90, 1.0],  // Pale sapphire A-class
  [1.0, 1.0, 1.0],    // Pure diamond white F-class
  [1.0, 0.96, 0.85],  // Solar warm white G-class
  [1.0, 0.86, 0.65],  // Pale amber K-class
  [1.0, 0.68, 0.45],  // Warm reddish M-class
];

// Rich, hyper-dense celestial starfield (14,000 stars — over 3.5x denser than initial space)
function createDenseStarfield(size = 1024, starCount = 14000) {
  const faces = [];
  const canvases = [];
  const contexts = [];

  for (let face = 0; face < 6; face++) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Deep cosmic void with subtle stellar dust wash
    ctx.fillStyle = "#01020a";
    ctx.fillRect(0, 0, size, size);

    // Subtle cosmic nebula cloud patches in the background
    const nebGrad = ctx.createRadialGradient(
      size * (0.3 + 0.4 * Math.random()),
      size * (0.3 + 0.4 * Math.random()),
      size * 0.1,
      size * 0.5,
      size * 0.5,
      size * 0.6
    );
    nebGrad.addColorStop(0, "rgba(25, 35, 75, 0.18)");
    nebGrad.addColorStop(0.5, "rgba(15, 20, 50, 0.08)");
    nebGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, size, size);

    canvases.push(canvas);
    contexts.push(ctx);
  }

  // Draw 14,000 natural point stars with varied brightness and soft radial glows
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
    const brightness = 0.2 + Math.random() * 0.75;
    // Layered star sizes: majority fine celestial dust, punctuated by brilliant stellar jewels
    const starRadius = Math.random() < 0.88
      ? (0.6 + Math.random() * 1.0)
      : (1.8 + Math.random() * 1.6);

    const ctx = contexts[face];
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, starRadius * 2.4);
    const rInt = Math.round(tint[0] * 255);
    const gInt = Math.round(tint[1] * 255);
    const bInt = Math.round(tint[2] * 255);
    grad.addColorStop(0, `rgba(${rInt}, ${gInt}, ${bInt}, ${brightness})`);
    grad.addColorStop(0.3, `rgba(${rInt}, ${gInt}, ${bInt}, ${brightness * 0.65})`);
    grad.addColorStop(1, `rgba(${rInt}, ${gInt}, ${bInt}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, starRadius * 2.4, 0, Math.PI * 2);
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
    ctx.shadowColor = "rgba(220, 240, 255, 0.45)";
    ctx.shadowBlur = 24;

    // Top half (MANIT)
    ctx.textAlign = "right";
    ctx.fillText("MANIT", canvas.width * 0.96, 256);
    // Bottom half (BISHT)
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

export function createWhiteHole() {
  const sky = createDenseStarfield();
  const textTexture = createWarpTextTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCamera: { value: new THREE.Vector3() },
      uDiskNormal: { value: new THREE.Vector3(0, 1, 0) },
      uParams: { value: new THREE.Vector3(HOLE_BOUND, 3, 14) },
      uBrightness: { value: 2.6 },
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
    forceSinglePass: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(HOLE_BOUND * SCHWARZSCHILD_RADIUS, 48, 32),
    material,
  );
  mesh.name = "Cosmogon white hole";
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(material.uniforms.uCamera.value);
    mesh.worldToLocal(material.uniforms.uCamera.value).divideScalar(SCHWARZSCHILD_RADIUS);
  };
  return { mesh, sky };
}
