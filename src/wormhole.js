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
  const BOUND_RADIUS = 18.0;

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
      varying vec3 vWorldPos;
      void main() {
        vec4 worldP = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldP.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldP;
      }
    `,
    fragmentShader: `
      uniform vec3 uCamera;
      uniform samplerCube uSky;
      uniform samplerCube uDestSky;
      uniform float uRadius;
      uniform float uBound;
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        vec3 cam = uCamera;
        float camDist = length(cam);
        bool insideBound = camDist < uBound;

        // Discard near face if camera is inside bounding sphere; discard far face if outside
        if (insideBound == gl_FrontFacing) discard;

        vec3 dir = normalize(vWorldPos - cam);

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

          // Seamless edge fade into deep space
          alpha = 1.0 - smoothstep(uBound * 0.78, uBound * 0.96, b);
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
    update: (time, _hoverVal = 0) => {
      sphereMat.uniforms.uTime.value = time;
      sphereMesh.rotation.y = time * 0.02;
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
