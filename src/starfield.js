import * as THREE from "three";

// Generate a soft circular glow texture so stars look round, not boxy
function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 15);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.2)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Realistic star color palette (spectral classes)
const STAR_COLORS = [
  [0.6, 0.7, 1.0],   // blue-white (hot O/B stars)
  [0.75, 0.85, 1.0],  // pale blue (A stars)
  [1.0, 1.0, 1.0],    // white (F stars)
  [1.0, 0.95, 0.8],   // warm white (G stars, like the Sun)
  [1.0, 0.85, 0.6],   // pale orange (K stars)
  [1.0, 0.65, 0.4],   // orange-red (M stars)
];

export function createStars(count = 2000) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Distribute stars in a spherical shell around the origin
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 8 + Math.random() * 40;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Pick a random star color, weighted towards white/warm tones
    const tint = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    // Vary brightness per star so some are dim and some are bright
    const brightness = 0.4 + Math.random() * 0.6;
    colors[i * 3]     = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    map: createStarTexture(),
    vertexColors: true,         // use the per-vertex colors array
    blending: THREE.AdditiveBlending, // glow adds to background light
    depthWrite: false,          // prevents z-fighting artifacts
  });

  return new THREE.Points(geometry, material);
}
