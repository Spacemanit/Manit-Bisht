import * as THREE from "three";

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
// 1. 3D GRAVITATIONAL FUNNEL GEOMETRY
// ---------------------------------------------------------------------------

function createFunnelGeometry(rimRadius = 14.0, throatRadius = 2.8, depth = 24.0, radialSegs = 72, heightSegs = 72) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= heightSegs; i++) {
    const v = i / heightSegs; // 0 = wide outer space rim, 1 = singularity throat
    // Flamm's paraboloid-style steepening curvature
    const z = -v * depth;
    const r = throatRadius + (rimRadius - throatRadius) * Math.pow(1.0 - v, 2.6);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < heightSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      const c = (i + 1) * (radialSegs + 1) + (j + 1);
      const d = i * (radialSegs + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// 2. GRAVITATIONALLY LENSED STARFIELD FUNNEL (No neon colors, pure space)
// ---------------------------------------------------------------------------

export function createWormholeEntrance(skyTexture) {
  const group = new THREE.Group();
  group.name = "WormholeEntrance";

  const funnelGeo = createFunnelGeometry(14.0, 2.8, 24.0, 72, 72);

  // Shader: Bends the actual background starfield through gravitational curvature
  const funnelMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHover: { value: 0 },
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
      uniform float uHover;
      uniform samplerCube uSky;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        // vUv.x: polar angle [0, 1]
        // vUv.y: depth down the funnel [0 = rim, 1 = singularity throat]
        float depth = vUv.y;
        float theta = vUv.x * 6.28318;

        vec3 rayDir = normalize(vWorldPos - cameraPosition);
        vec3 N = normalize(vNormal);

        // 1. Gravitational Deflection Vector:
        // As rays plunge deeper into the gravity well, light curves inward toward the central axis
        vec3 inwardAxis = normalize(vec3(-vWorldPos.xy, 0.0));
        float bendStrength = pow(depth, 1.6) * 1.8 + uHover * 0.3;

        // Frame-dragging swirl around the singularity throat
        float swirl = depth * 6.0 - uTime * 0.8;
        float cosS = cos(swirl);
        float sinS = sin(swirl);
        mat2 dragMatrix = mat2(cosS, -sinS, sinS, cosS);

        vec3 deflectedRay = normalize(rayDir + inwardAxis * bendStrength);
        deflectedRay.xy = mix(deflectedRay.xy, dragMatrix * deflectedRay.xy, depth * 0.7);

        // Sample the actual celestial starfield along the gravitationally bent ray!
        vec3 stars = textureCube(uSky, normalize(deflectedRay)).rgb;

        // Gravitational lens magnification & shearing of stars along the funnel
        float shearFactor = 1.0 + depth * 1.5;
        stars *= shearFactor;

        // Singularity Event Horizon Absorption:
        // Inside the innermost throat (depth > 0.95), all light is swallowed into pure black
        float eventHorizon = smoothstep(0.93, 0.985, depth);
        stars *= (1.0 - eventHorizon);

        // Subtle gravitational redshift/blueshift (subtle warm/cool shift, strictly realistic)
        float dopplerShift = 1.0 + 0.15 * sin(theta + uTime * 0.5);
        stars *= vec3(dopplerShift * 0.97, dopplerShift, dopplerShift * 1.03);

        // Faint rim atmosphere / subtle hover glow
        float rimGlow = smoothstep(0.15, 0.0, depth) * (0.15 + uHover * 0.35);
        stars += vec3(0.8, 0.9, 1.0) * rimGlow;

        // Discard inside singularity hole
        if (depth > 0.99) discard;

        gl_FragColor = vec4(stars, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const funnelMesh = new THREE.Mesh(funnelGeo, funnelMat);
  funnelMesh.name = "WormholeFunnelMesh";
  // Pitch funnel 38° towards camera so we look down into the throat
  funnelMesh.rotation.x = 0.66;
  group.add(funnelMesh);

  // Click target cone matching funnel mouth
  const hitGeo = new THREE.ConeGeometry(13.5, 18.0, 16);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.rotation.x = 0.66 + Math.PI;
  hitMesh.position.z = -8.0;
  hitMesh.name = "WormholeHitTarget";
  group.add(hitMesh);

  group.position.set(0, 0, 0);

  return {
    group,
    funnelMesh,
    hitMesh,
    update: (time, hoverVal) => {
      funnelMat.uniforms.uTime.value = time;
      funnelMat.uniforms.uHover.value = hoverVal;
      // Gentle gravitational precession around funnel axis
      funnelMesh.rotation.z = time * 0.05;
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
// 4. MINIMALIST FROSTED GLASS ACHIEVEMENT PANELS (Crisp & Clean)
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_DATA = [
  {
    t: 0.16,
    tag: "SPECIALIZATION // 01",
    title: "3D Graphics & Shaders",
    desc: "Raymarching Schwarzschild geodesics, custom GLSL pipelines, WebGL/Three.js math physics, and real-time GPU particle simulations.",
  },
  {
    t: 0.38,
    tag: "ENGINEERING // 02",
    title: "Full-Stack Architecture",
    desc: "High-throughput real-time distributed platforms, performant microservices, reactive event pipelines, and secure cloud infrastructures.",
  },
  {
    t: 0.62,
    tag: "PERFORMANCE // 03",
    title: "Real-Time Optimization",
    desc: "Zero-allocation animation loops, multi-threaded worker offloading, GPU geometry instancing, and sub-millisecond latency tuning.",
  },
  {
    t: 0.84,
    tag: "INNOVATION // 04",
    title: "Creative Engineering",
    desc: "Award-winning prototyper, hackathon victor, open-source contributor, bridging cinematic audiovisuals with resilient code.",
  },
];

function createGlassAchievementCardTexture(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  // Smoked semi-transparent dark space glass
  ctx.fillStyle = "rgba(4, 6, 12, 0.92)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Minimalist soft glass border (subtle, no harsh white lines)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Subtle corner brackets
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 3;
  const bLen = 32;
  // Top-left
  ctx.beginPath(); ctx.moveTo(16, 16 + bLen); ctx.lineTo(16, 16); ctx.lineTo(16 + bLen, 16); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(canvas.width - 16 - bLen, 16); ctx.lineTo(canvas.width - 16, 16); ctx.lineTo(canvas.width - 16, 16 + bLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(16, canvas.height - 16 - bLen); ctx.lineTo(16, canvas.height - 16); ctx.lineTo(16 + bLen, canvas.height - 16); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(canvas.width - 16 - bLen, canvas.height - 16); ctx.lineTo(canvas.width - 16, canvas.height - 16); ctx.lineTo(canvas.width - 16, canvas.height - 16 - bLen); ctx.stroke();

  // Tag
  ctx.fillStyle = "#94a3b8";
  ctx.font = '600 26px "DeadCRT", monospace';
  ctx.fillText(item.tag, 55, 78);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 48px "Michroma", sans-serif';
  ctx.fillText(item.title, 55, 168);

  // Clean glass divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(55, 208);
  ctx.lineTo(canvas.width - 55, 208);
  ctx.stroke();

  // Description text
  ctx.fillStyle = "#e2e8f0";
  ctx.font = '400 32px "Michroma", sans-serif';
  const words = item.desc.split(" ");
  let line = "";
  let y = 280;
  const lineHeight = 48;
  const maxWidth = canvas.width - 110;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, 55, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 55, y);

  // Status indicator
  ctx.fillStyle = "#38bdf8";
  ctx.font = '400 24px "DeadCRT", monospace';
  ctx.fillText("● VERIFIED RECORD // ACTIVE", 55, 530);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
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

  // Mount Minimalist Glass Achievement Cards on Walls
  const cards = [];
  for (let idx = 0; idx < ACHIEVEMENTS_DATA.length; idx++) {
    const item = ACHIEVEMENTS_DATA[idx];
    const cardTex = createGlassAchievementCardTexture(item);
    const cardGeo = new THREE.PlaneGeometry(8.2, 4.6);
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
    },
  };
}
