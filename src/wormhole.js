import * as THREE from "three";
import { FLASH_PEAK_START, WHITE_HOLE_REVEAL_END } from "./thresholds.js";

// Realistic star spectral color palette (matching black-hole.js / starfield.js)
const STAR_COLORS = [
  [0.70, 0.82, 1.0],  // O/B blue-white
  [0.85, 0.92, 1.0],  // A pale blue
  [1.0, 1.0, 1.0],    // F pure white
  [1.0, 0.96, 0.88],  // G solar warm white
  [1.0, 0.85, 0.65],  // K pale orange
  [1.0, 0.68, 0.45],  // M reddish amber
];

// ---------------------------------------------------------------------------
// 1. INTERSTELLAR 3D SPHERICAL WORMHOLE (Morris-Thorne / Ellis Spacetime Metric)
// ---------------------------------------------------------------------------
// A traversable wormhole in 3D space is a spherical crystal lens (as in Christopher Nolan's Interstellar).
// Light passing outside the spherical throat bends gravitationally around the rim,
// creating an Einstein ring of our galaxy (Universe A).
// Inside the spherical aperture, light from the destination galaxy (Universe B) passes through the throat,
// magnified and refracted into concentric circles.

export function createWormholeEntrance(skyTexture, destSkyTexture = null) {
  const group = new THREE.Group();
  group.name = "WormholeEntrance";

  const THROAT_RADIUS = 5.6;
  const BOUND_RADIUS = 50.0;

  const sphereGeo = new THREE.SphereGeometry(BOUND_RADIUS, 64, 48);

  const sphereMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamera: { value: new THREE.Vector3() },
      uSky: { value: skyTexture },
      uDestSky: { value: destSkyTexture || skyTexture },
      uRadius: { value: THROAT_RADIUS },
      uBound: { value: BOUND_RADIUS },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uCamera;
      uniform samplerCube uSky;
      uniform samplerCube uDestSky;
      uniform float uRadius;
      uniform float uBound;
      uniform float uTime;
      varying vec3 vLocalPos;

      void main() {
        vec3 cam = uCamera;
        float camDist = length(cam);
        bool insideBound = camDist < uBound;

        // Discard near face if camera is inside bounding sphere; discard far face if outside
        if (insideBound == gl_FrontFacing) discard;

        vec3 dir = normalize(vLocalPos - cam);

        // Distance along ray to point of closest approach to center (0, 0, 0)
        float t_closest = -dot(cam, dir);

        if (t_closest <= 0.0) {
          gl_FragColor = textureCube(uSky, dir);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        vec3 pClosest = cam + dir * t_closest;
        float b = length(pClosest); // Impact parameter
        vec3 uPerp = b > 1e-5 ? pClosest / b : vec3(0.0, 1.0, 0.0);

        vec3 finalColor = vec3(0.0);
        float alpha = 1.0;
        float r0 = uRadius;

        if (camDist < r0) {
          // Camera has penetrated the throat sphere into Universe B
          vec3 rayB = normalize(vec3(dir.x, dir.y, -dir.z));
          finalColor = textureCube(uDestSky, rayB).rgb;
          alpha = 1.0;
        } else if (b < r0) {
          // Ray traverses through the throat into Universe B (Interstellar other galaxy)
          float halfChord = sqrt(max(0.0, r0 * r0 - b * b));
          float tHit = t_closest - halfChord;
          vec3 pHit = cam + dir * tHit;

          float beta = b / r0; // [0, 1)

          // Curvature refraction across the negative spatial throat
          float thetaBend = asin(beta) + 0.45 * (beta / sqrt(max(1.0 - beta * beta, 0.04)));
          vec3 rayB = normalize(dir * cos(thetaBend * 0.5) + uPerp * sin(thetaBend * 0.5));
          vec3 sampleB = normalize(vec3(rayB.x, rayB.y, -rayB.z));
          vec3 colorB = textureCube(uDestSky, sampleB).rgb;

          // Gravitational lens magnification near the throat rim
          float magB = 1.0 + 0.85 * pow(beta, 3.0);
          colorB *= magB;

          // Razor-sharp luminous Einstein ring at the limb
          float limbDist = r0 - b;
          float caustic = exp(-pow(limbDist / 0.09, 2.0));
          vec3 causticCol = vec3(0.92, 0.96, 1.05) * caustic * 2.4;

          finalColor = colorB + causticCol;
          alpha = 1.0;
        } else {
          // Ray passes outside throat into Universe A (gravitationally bent background stars)
          float beta = b / r0; // [1, inf)

          // Gravitational deflection angle for Ellis metric
          float deltaTheta = 0.80 * (r0 / b) / sqrt(max(beta * beta - 0.98, 0.02));
          float deflAngle = min(deltaTheta, 1.45);

          // Subtle physical chromatic dispersion
          vec3 rayR = normalize(dir - uPerp * sin(deflAngle * 1.018));
          vec3 rayG = normalize(dir - uPerp * sin(deflAngle * 1.000));
          vec3 rayB = normalize(dir - uPerp * sin(deflAngle * 0.982));

          vec3 colorA = vec3(
            textureCube(uSky, rayR).r,
            textureCube(uSky, rayG).g,
            textureCube(uSky, rayB).b
          );

          // Tangential magnification of stars near the outer Einstein ring
          float magA = 1.0 + 0.75 / ((beta - 1.0) * 4.5 + 0.22);
          colorA *= clamp(magA, 1.0, 3.2);

          // Caustic Einstein ring at the limb
          float limbDist = b - r0;
          float caustic = exp(-pow(limbDist / 0.09, 2.0));
          vec3 causticCol = vec3(0.92, 0.96, 1.05) * caustic * 2.4;

          finalColor = colorA + causticCol;
          alpha = insideBound ? 1.0 : (1.0 - smoothstep(uBound * 0.78, uBound * 0.96, b));
        }

        gl_FragColor = vec4(finalColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  sphereMesh.name = "InterstellarSphericalWormhole";
  group.add(sphereMesh);

  sphereMesh.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(sphereMat.uniforms.uCamera.value);
    sphereMesh.worldToLocal(sphereMat.uniforms.uCamera.value);
  };

  const hitGeo = new THREE.SphereGeometry(THROAT_RADIUS, 16, 16);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.name = "WormholeHitTarget";
  group.add(hitMesh);

  group.position.set(0, 0, 0);

  return {
    group,
    sphereMesh,
    funnelMesh: sphereMesh, // Alias for backward compatibility
    hitMesh,
    update: (time, rotX = 0, rotY = 0) => {
      sphereMat.uniforms.uTime.value = time;
      sphereMesh.rotation.x = rotX;
      sphereMesh.rotation.y = rotY;
    },
  };
}

// ---------------------------------------------------------------------------
// 3. WORMHOLE 3D SPLINE CURVE (Smooth Cosmic Trajectory)
// ---------------------------------------------------------------------------

export function createWormholeCurve() {
  const points = [
    new THREE.Vector3(0, 0, 0),         // Entrance throat
    new THREE.Vector3(0, 0, -60),        // Plunge into curved spacetime
    new THREE.Vector3(28, -18, -150),    // Right downward bank
    new THREE.Vector3(55, 16, -250),     // Smooth corkscrew rise
    new THREE.Vector3(22, 50, -360),     // Apex loop
    new THREE.Vector3(-35, 32, -480),    // Portside dive
    new THREE.Vector3(-65, -14, -600),   // Deep left drop
    new THREE.Vector3(-28, -50, -720),   // Trough
    new THREE.Vector3(35, -26, -840),    // Climbing right turn
    new THREE.Vector3(48, 18, -960),     // Level banking
    new THREE.Vector3(18, 35, -1080),    // Final alignment
    new THREE.Vector3(0, 0, -1200),      // Exit threshold
  ];
  return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
}

// ---------------------------------------------------------------------------
// 4. MINIMALIST OPTICAL GLASS ACHIEVEMENT PANELS (Architectural Overhaul)
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_DATA = [
  {
    t: 0.17,
    index: "01",
    year: "2023",
    category: "Astrophysics · Honours",
    title: "IAAC Gold Medalist",
    subtitle: "International Astronomy and Astrophysics Competition",
    desc: "Awarded Final Round Gold Medalist out of thousands of global entrants. Solved advanced problems in celestial mechanics, Keplerian orbital dynamics, and spectroscopic analysis.",
    chips: ["Astrophysics", "Orbital Mechanics", "Global Gold Medal", "Python"],
  },
  {
    t: 0.38,
    index: "02",
    year: "2025",
    category: "Higher Education",
    title: "B.Tech Computer Science",
    subtitle: "Vellore Institute of Technology (VIT Vellore)",
    desc: "Maintaining a 9.0 / 10 CGPA. Core specialization in Data Structures, Algorithms, Operating Systems, Database Management Systems, and Distributed Computing.",
    chips: ["CGPA 9.0 / 10", "Algorithms", "Operating Systems", "VIT Vellore"],
  },
  {
    t: 0.62,
    index: "03",
    year: "2026",
    category: "Real-Time Systems",
    title: "the-button",
    subtitle: "Distributed Real-Time WebSocket Platform",
    desc: "High-concurrency global state platform inspired by Reddit's legendary experiment. Features sub-millisecond WebSocket state synchronization, atomic counter logic, and dynamic client rendering.",
    chips: ["React", "Node.js", "Express", "Socket.IO", "WebSockets"],
  },
  {
    t: 0.84,
    index: "04",
    year: "2026",
    category: "Fintech Platform",
    title: "SPNT Expense Tracker",
    subtitle: "Personal Ledger & Financial Pattern Analytics",
    desc: "Full-stack personal expense suite designed with an architectural e-ink aesthetic. Delivers automated monthly spending breakdown, persistent Atlas cloud storage, and decoupled cloud deployment.",
    chips: ["React", "Node.js", "MongoDB Atlas", "Vercel", "REST APIs"],
  },
];

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

function createGlassAchievementCardTexture(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 920;
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const pad = 24;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  const cornerR = 32;

  // 1. Deep Obsidian Optical Glass Surface
  drawRoundedRectPath(ctx, pad, pad, cardW, cardH, cornerR);
  const bgGrad = ctx.createLinearGradient(0, pad, 0, pad + cardH);
  bgGrad.addColorStop(0.0, "rgba(13, 16, 26, 0.94)");
  bgGrad.addColorStop(1.0, "rgba(6, 8, 14, 0.97)");
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // 2. Subtle Starlight Specular Sheen (top-center refraction)
  ctx.save();
  drawRoundedRectPath(ctx, pad, pad, cardW, cardH, cornerR);
  ctx.clip();
  const topSheen = ctx.createRadialGradient(W / 2, pad, 10, W / 2, pad, 500);
  topSheen.addColorStop(0.0, "rgba(255, 255, 255, 0.08)");
  topSheen.addColorStop(0.5, "rgba(180, 210, 255, 0.03)");
  topSheen.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = topSheen;
  ctx.fillRect(pad, pad, cardW, cardH);
  ctx.restore();

  // 3. Precision Beveled Rim (Linear Gradient Stroke)
  drawRoundedRectPath(ctx, pad, pad, cardW, cardH, cornerR);
  const borderGrad = ctx.createLinearGradient(pad, pad, pad + cardW, pad + cardH);
  borderGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.32)"); // crisp top-left highlight
  borderGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.12)");
  borderGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.04)"); // muted bottom-right
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 4. Subtle Inner Inset Line for Glass Refraction Depth
  drawRoundedRectPath(ctx, pad + 6, pad + 6, cardW - 12, cardH - 12, cornerR - 4);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // 5. Header: Index Capsule + Category Label + Year Badge
  // 5a. Index capsule [ 01 ]
  drawRoundedRectPath(ctx, 76, 72, 64, 38, 8);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 19px system-ui, -apple-system, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.index, 76 + 32, 72 + 19);

  // 5b. Category Label
  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = '600 21px system-ui, -apple-system, sans-serif';
  if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
  ctx.fillText(item.category.toUpperCase(), 158, 72 + 19);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // 5c. Year Capsule Badge (Upper Right)
  const badgeW = 110;
  const badgeH = 40;
  const badgeX = W - 76 - badgeW;
  const badgeY = 70;
  drawRoundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 20);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 21px system-ui, -apple-system, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(item.year, badgeX + badgeW / 2, badgeY + badgeH / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // 6. Title
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 54px "Michroma", sans-serif';
  ctx.fillText(item.title, 76, 186);

  // 7. Subtitle
  ctx.fillStyle = "#94a3b8";
  ctx.font = '500 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(item.subtitle, 76, 236);

  // 8. Editorial Hairline Divider
  const divGrad = ctx.createLinearGradient(76, 274, W - 76, 274);
  divGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.04)");
  divGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.14)");
  divGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.14)");
  divGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.04)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(76, 274);
  ctx.lineTo(W - 76, 274);
  ctx.stroke();

  // 9. Narrative Body Text
  ctx.fillStyle = "#e2e8f0";
  ctx.font = '400 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const words = item.desc.split(" ");
  let line = "";
  let y = 344;
  const lineHeight = 50;
  const maxWidth = W - 152;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, 76, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 76, y);

  // 10. Capability & Tech Chips (Footer Row)
  if (item.chips && item.chips.length > 0) {
    let chipX = 76;
    const chipY = H - 100;
    const chipH = 40;

    ctx.font = '500 20px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = "middle";

    for (let c = 0; c < item.chips.length; c++) {
      const chipText = item.chips[c];
      const textMetrics = ctx.measureText(chipText);
      const chipW = textMetrics.width + 32;

      drawRoundedRectPath(ctx, chipX, chipY, chipW, chipH, 20);
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText(chipText, chipX + chipW / 2, chipY + chipH / 2);

      chipX += chipW + 12;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// ---------------------------------------------------------------------------
// 4.5. FLOATING OFFICIAL TECH LOGO SPRITES (Direct Vector SVG Assets)
// ---------------------------------------------------------------------------

export const TECH_LOGOS = [
  { name: "C", file: "c.svg" },
  { name: "C++", file: "cpp.svg" },
  { name: "C#", file: "csharp.svg" },
  { name: "Java", file: "java.svg" },
  { name: "Python", file: "python.svg" },
  { name: "MySQL", file: "mysql.svg" },
  { name: "MongoDB", file: "mongodb.svg" },
  { name: "Javascript", file: "javascript.svg" },
  { name: "HTML", file: "html.svg" },
  { name: "Typescript", file: "typescript.svg" },
  { name: "CSS", file: "css.svg" },
  { name: "TailwindCSS", file: "tailwindcss.svg" },
  { name: "ReactJS", file: "react.svg" },
  { name: "NodeJS", file: "nodejs.svg" },
  { name: "Express", file: "express.svg" },
  { name: "Git", file: "git.svg" },
  { name: "Github", file: "github.svg" },
  { name: "VScode", file: "vscode.svg" },
  { name: "Linux", file: "linux.svg" },
  { name: "Arch Linux", file: "archlinux.svg" },
  { name: "CachyOS", file: "cachyos.svg" },
  { name: "Windows", file: "windows.svg" },
  { name: "Vercel", file: "vercel.svg" },
  { name: "Render", file: "render.svg" },
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Soft circular radial gradient texture for subtle cosmic debris dots (no square blocks)
function createDebrisDotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.2, "rgba(232, 244, 255, 0.85)");
  grad.addColorStop(0.5, "rgba(180, 215, 255, 0.30)");
  grad.addColorStop(0.8, "rgba(140, 180, 240, 0.06)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ---------------------------------------------------------------------------
// 5. WORMHOLE TUNNEL: GRAVITATIONALLY BENT STARFIELD CORRIDOR
// ---------------------------------------------------------------------------

export function createWormholeTunnel(curve, skyTexture) {
  const group = new THREE.Group();
  group.name = "WormholeTunnel";

  const radius = 8.5;
  const tubeGeo = new THREE.TubeGeometry(curve, 420, radius, 48, false);

  // Shader: Pure deep black space with stars gravitationally bent along the tunnel walls
  // No artificial white lines - only the authentic celestial cosmos gravitationally lensed
  const tubeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSpeed: { value: 1.0 },
      uSky: { value: skyTexture },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldP = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldP.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldP;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      uniform float uSpeed;
      uniform samplerCube uSky;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        // Light ray from camera to curved throat wall
        vec3 rayDir = normalize(vWorldPos - cameraPosition);
        vec3 N = normalize(vNormal);

        // Frame-dragging swirl along curved spacetime
        float swirl = vUv.y * 14.0 - uTime * 0.5 * uSpeed;
        float cs = cos(swirl * 0.25);
        float sn = sin(swirl * 0.25);
        mat2 swirlMat = mat2(cs, -sn, sn, cs);

        // Gravitational deflection: ray bends along geodesic curvature of the throat
        vec3 deflectedRay = reflect(rayDir, N);
        deflectedRay.xy = swirlMat * deflectedRay.xy;

        // Sample authentic background celestial starfield along bent geodesic
        vec3 starLight = textureCube(uSky, normalize(deflectedRay)).rgb;

        // Subtle gravitational chromatic dispersion (subtle spectral split at bending edges)
        vec3 starR = textureCube(uSky, normalize(deflectedRay + N * 0.015)).rgb;
        vec3 starB = textureCube(uSky, normalize(deflectedRay - N * 0.015)).rgb;
        vec3 lensedSky = vec3(starR.r, starLight.g, starB.b);

        // Deep cosmos contrast: deep pitch black space, luminous natural stars
        vec3 col = pow(lensedSky, vec3(1.15)) * 2.2;

        // Subtle stardust speckles on the wall (soft, isotropic, zero streak lines)
        vec2 dustUv = vec2(vUv.x * 240.0, vUv.y * 480.0);
        float dustSeed = hash2(floor(dustUv));
        if (dustSeed > 0.985) {
          float speck = pow((dustSeed - 0.985) / 0.015, 2.0);
          col += vec3(0.85, 0.92, 1.0) * speck * 0.35;
        }

        // White Light Flare at Exit (as progress reaches exit threshold > 0.92)
        float exitFlare = smoothstep(0.92, 0.998, vUv.y) * smoothstep(0.85, 1.0, uProgress);
        col = mix(col, vec3(1.4, 1.38, 1.35), exitFlare);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
  });

  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tubeMesh);

  // Subtle 3D Cosmic Debris Dots inside the tunnel volume
  const particleCount = 2400;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);

  const DEBRIS_PALETTE = [
    [0.90, 0.95, 1.00], // icy starlight white
    [0.80, 0.88, 1.00], // pale sapphire
    [0.95, 0.92, 0.84], // warm silica dust
    [0.72, 0.82, 0.92], // cosmic silver
    [0.62, 0.72, 0.86], // deep void blue
  ];

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
    const binormal = tangent.clone().cross(normal).normalize();

    const r = Math.random() * (radius * 0.85);
    const ang = Math.random() * Math.PI * 2;
    const offset = normal.clone().multiplyScalar(Math.cos(ang) * r)
      .add(binormal.clone().multiplyScalar(Math.sin(ang) * r));

    particlePos[i * 3] = pt.x + offset.x;
    particlePos[i * 3 + 1] = pt.y + offset.y;
    particlePos[i * 3 + 2] = pt.z + offset.z;

    const baseCol = DEBRIS_PALETTE[Math.floor(Math.random() * DEBRIS_PALETTE.length)];
    // Subtle per-particle brightness variation for natural depth
    const brightness = 0.35 + Math.random() * 0.55;
    particleColors[i * 3] = baseCol[0] * brightness;
    particleColors[i * 3 + 1] = baseCol[1] * brightness;
    particleColors[i * 3 + 2] = baseCol[2] * brightness;
  }

  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.32,
    sizeAttenuation: true,
    map: createDebrisDotTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // Floating Tech Logos drifting among cosmic debris in random order
  const logoSprites = [];
  const shuffledTech = shuffleArray(TECH_LOGOS);
  const totalLogos = shuffledTech.length;
  const textureLoader = new THREE.TextureLoader();
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : "./";

  for (let idx = 0; idx < totalLogos; idx++) {
    const item = shuffledTech[idx];
    const tex = textureLoader.load(`${baseUrl}tech-icons/${item.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Distribute along tunnel curve between t = 0.05 and 0.94
    const baseT = 0.05 + (idx / totalLogos) * 0.89;
    const jitter = (Math.random() - 0.5) * 0.02;
    let t = THREE.MathUtils.clamp(baseT + jitter, 0.04, 0.95);

    // Keep clear of achievement cards
    for (const card of ACHIEVEMENTS_DATA) {
      if (Math.abs(t - card.t) < 0.025) {
        t += (t >= card.t ? 0.03 : -0.03);
      }
    }
    t = THREE.MathUtils.clamp(t, 0.04, 0.95);

    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(tangent.dot(up)) > 0.9) up.set(1, 0, 0);
    const normal = up.clone().cross(tangent).normalize();
    const binormal = tangent.clone().cross(normal).normalize();

    // Random radial position floating between 2.8 and 5.5 units from center
    const r = 2.8 + Math.random() * 2.7;
    const ang = Math.random() * Math.PI * 2;
    const offset = normal.clone().multiplyScalar(Math.cos(ang) * r)
      .add(binormal.clone().multiplyScalar(Math.sin(ang) * r));

    const pos = pt.clone().add(offset);

    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.9, 1.9, 1.0);
    sprite.position.copy(pos);
    group.add(sprite);

    logoSprites.push({
      sprite,
      basePos: pos.clone(),
      driftAxis: binormal.clone().multiplyScalar(Math.random() > 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.8,
    });
  }

  // Mount Minimalist Glass Achievement Cards on Walls
  const cards = [];
  for (let idx = 0; idx < ACHIEVEMENTS_DATA.length; idx++) {
    const item = ACHIEVEMENTS_DATA[idx];
    const cardTex = createGlassAchievementCardTexture(item);
    const cardGeo = new THREE.PlaneGeometry(8.4, 4.83);
    const cardMat = new THREE.MeshBasicMaterial({
      map: cardTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cardMesh = new THREE.Mesh(cardGeo, cardMat);

    const pt = curve.getPointAt(item.t);
    const tangent = curve.getTangentAt(item.t).normalize();
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(tangent.dot(up)) > 0.9) up.set(1, 0, 0);
    const normal = up.clone().cross(tangent).normalize();
    const binormal = tangent.clone().cross(normal).normalize();

    // Alternate left/right offset from center line for dynamic pacing
    const sideSign = (idx % 2 === 0) ? 1.0 : -1.0;
    const cardOffset = normal.clone().multiplyScalar(sideSign * radius * 0.44)
      .add(binormal.clone().multiplyScalar(0.35));
    cardMesh.position.copy(pt).add(cardOffset);

    // Angle card upstream towards oncoming traveler so it is visible and readable far in advance
    const upstreamTarget = pt.clone().sub(tangent.clone().multiplyScalar(15.0));
    cardMesh.lookAt(upstreamTarget);

    group.add(cardMesh);
    cards.push({ mesh: cardMesh, t: item.t });
  }

  return {
    group,
    curve,
    cards,
    update: (time, progress, speedVal = 1.0) => {
      tubeMat.uniforms.uTime.value = time;
      tubeMat.uniforms.uProgress.value = progress;
      tubeMat.uniforms.uSpeed.value = speedVal;

      // Weightless floating drift of tech logos
      for (let i = 0; i < logoSprites.length; i++) {
        const item = logoSprites[i];
        const drift = Math.sin(time * item.speed + item.phase) * 0.22;
        item.sprite.position.copy(item.basePos).addScaledVector(item.driftAxis, drift);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 6. WHITE HOLE LOGO SPLASH (Cosmic Ejection Burst)
// ---------------------------------------------------------------------------
// When the white hole appears, all tech logos violently and elegantly splash
// outward from the singularity core toward the screen and drift in space.

export function createWhiteHoleLogoSplash() {
  const group = new THREE.Group();
  group.name = "WhiteHoleLogoSplash";
  group.visible = false;

  const textureLoader = new THREE.TextureLoader();
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : "./";

  const shuffled = shuffleArray(TECH_LOGOS);
  const total = shuffled.length;
  const splashSprites = [];

  for (let i = 0; i < total; i++) {
    const item = shuffled[i];
    const tex = textureLoader.load(`${baseUrl}tech-icons/${item.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Distribute into 2 radial layers for deep cinematic spread
    const isOuter = i >= 10;
    const ringIndex = isOuter ? i - 10 : i;
    const ringCount = isOuter ? 14 : 10;
    const angle = (ringIndex / ringCount) * Math.PI * 2 + (isOuter ? 0.22 : 0.0) + (Math.random() - 0.5) * 0.25;

    // Dispersal distance
    const distR = isOuter ? 8.5 + Math.random() * 4.5 : 4.2 + Math.random() * 3.5;

    // Target coordinates: spread across 16:9 viewport
    const targetX = Math.cos(angle) * distR * 1.35;
    const targetY = Math.sin(angle) * distR * 0.95;
    // Splash forward towards the camera (camera pulls back to z = 16.67, white hole at z = 0)
    const targetZ = 1.5 + Math.random() * 7.5;

    const baseScale = 0.4 + Math.random() * 0.45;

    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.001, 0.001, 1.0);
    sprite.position.set(0, 0, 0);
    group.add(sprite);

    splashSprites.push({
      sprite,
      mat: spriteMat,
      targetX,
      targetY,
      targetZ,
      baseScale,
      seed: Math.random() * 100,
      burstDelay: Math.random() * 0.12,
    });
  }

  function update(scroll, time, mouse) {
    if (scroll < FLASH_PEAK_START) {
      group.visible = false;
      return;
    }

    group.visible = true;

    // Progress: 0.0 at FLASH_PEAK_START (16800) -> 1.0 at WHITE_HOLE_REVEAL_END (19200)
    const rawProgress = (scroll - FLASH_PEAK_START) / (WHITE_HOLE_REVEAL_END - FLASH_PEAK_START);
    const progress = THREE.MathUtils.clamp(rawProgress, 0.0, 1.0);

    for (let i = 0; i < splashSprites.length; i++) {
      const item = splashSprites[i];
      const p = THREE.MathUtils.clamp((progress - item.burstDelay) / (1.0 - item.burstDelay), 0.0, 1.0);

      // Fast explosive burst with smooth settling
      const eased = 1.0 - Math.pow(1.0 - p, 3.2);

      // Weightless zero-g drift
      const driftX = Math.sin(time * 1.2 + item.seed) * 0.22;
      const driftY = Math.cos(time * 1.0 + item.seed * 1.3) * 0.22;

      // Mouse parallax
      const mouseParallaxX = (mouse ? mouse.x : 0) * 0.45 * (item.targetZ / 10.0);
      const mouseParallaxY = (mouse ? mouse.y : 0) * 0.35 * (item.targetZ / 10.0);

      item.sprite.position.x = (item.targetX * eased) + (driftX * eased) + (mouseParallaxX * eased);
      item.sprite.position.y = (item.targetY * eased) + (driftY * eased) + (mouseParallaxY * eased);
      item.sprite.position.z = item.targetZ * eased;

      const currentScale = item.baseScale * Math.min(1.0, eased * 1.5);
      item.sprite.scale.set(currentScale, currentScale, 1.0);
      item.mat.opacity = Math.min(1.0, eased * 2.2);
    }
  }

  return { group, update };
}
