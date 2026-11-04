import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

const windowsDim = new THREE.Vector2(window.innerWidth, window.innerHeight);

const ATMOSPHERE_RADIUS = 1.6; // shell radius relative to planet radius (1.0)

function createGlowMesh(radius, hexColor) {
  const glowGeo = new THREE.SphereGeometry(radius * ATMOSPHERE_RADIUS, 64, 64);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uIntensity: { value: 0.0 },
      uShellRadius: { value: ATMOSPHERE_RADIUS },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uShellRadius;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        // Closest distance of this view ray to the planet centre, in planet radii.
        float cosT = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
        float b = uShellRadius * sqrt(1.0 - cosT * cosT);
        // 0 at the planet surface (b = 1) -> 1 at the outer edge of the shell.
        float t = clamp((b - 1.0) / (uShellRadius - 1.0), 0.0, 1.0);
        // Brightest hugging the surface, fading smoothly to nothing: no hard edge.
        float density = pow(1.0 - t, 3.0);
        float alpha = density * uIntensity;
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(glowGeo, glowMat);
  mesh.renderOrder = 3;
  return mesh;
}

function attachGlow(mesh, hexColor) {
  const glowMesh = createGlowMesh(1.0, hexColor);
  mesh.add(glowMesh);
  mesh.userData.glow = glowMesh;
  mesh.userData.targetIntensity = 0.0;
  mesh.userData.currentIntensity = 0.0;
}

// City/ocean lights must only show on the night side. Fade the emissive map out
// wherever the surface faces the sun (view-space directional light direction).
function nightOnlyEmissive(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #if NUM_DIR_LIGHTS > 0
        float sunFacing = dot(normalize(normal), normalize(directionalLights[0].direction));
        totalEmissiveRadiance *= 1.0 - smoothstep(-0.12, 0.2, sunFacing);
      #endif`
    );
  };
}

function createCoruscant() {
  const diffuse = textureLoader.load('/planets/coruscant-diffuse.jpg');
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const bump = textureLoader.load('/planets/coruscant-bump.jpg');
  const cityLights = textureLoader.load('/planets/coruscant-lights.jpg');

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.05,
    roughness: 0.9,
    metalness: 0.0,
    // City lights glow on the dark side of the planet:
    emissiveMap: cityLights,
    emissive: new THREE.Color(0xffeedd),
    emissiveIntensity: 1.3,
  });
  nightOnlyEmissive(material);

  const mesh = new THREE.Mesh(geometry, material);
  attachGlow(mesh, 0xc49a7a); // warm terracotta city glow
  return mesh;
}

function createTatooine() {
  const diffuse = textureLoader.load('/planets/desert-diffuse.jpg');
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const bump = textureLoader.load('/planets/desert-bump.jpg');

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.05,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  attachGlow(mesh, 0xe2caa8); // soft golden desert dust glow
  return mesh;
}

function createMoon() {
  const diffuse = textureLoader.load('/planets/moon-diffuse.jpg');
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const normal = textureLoader.load('/planets/moon-normal.jpg');

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap: normal,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  attachGlow(mesh, 0x8a9da8); // muted cool silver/blue moon glow
  return mesh;
}

function createOceanPlanet() {
  const diffuse = textureLoader.load('/planets/oceanic-diffuse.jpg');
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const bump = textureLoader.load('/planets/oceanic-bump.jpg');
  const oceanLights = textureLoader.load('/planets/oceanic-lights.jpg');

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: diffuse,
    bumpMap: bump,
    bumpScale: 0.05,
    roughness: 0.9,
    metalness: 0.0,
    // Ocean lights glow on the dark side of the planet:
    emissiveMap: oceanLights,
    emissive: new THREE.Color(0x9fe0ff),
    emissiveIntensity: 1.3,
  });
  nightOnlyEmissive(material);

  const mesh = new THREE.Mesh(geometry, material);
  attachGlow(mesh, 0x2d8bb8); // deep oceanic azure glow
  return mesh;
}

export function createPlanets() {
  const group = new THREE.Group();
  const planetMeshes = [];

  // Soft cool sky fill + warm bounce so the night side is dim but never flat black
  const fill = new THREE.HemisphereLight(0x8fa8ff, 0x2a2018, 0.28);
  group.add(fill);

  // One warm key light for every planet (consistent shadow direction on all)
  const sunLight = new THREE.DirectionalLight(0xfff2e0, 2.0);
  sunLight.position.set(-14, 12, 30);
  group.add(sunLight);

  // 1. Coruscant: bottom horizon view below black hole (x = 0, large scale)
  const coruscant = createCoruscant();
  coruscant.position.set(0, -30, 28);
  coruscant.scale.setScalar(26);
  coruscant.rotation.set(0.5, 0.5, 0);
  group.add(coruscant);
  planetMeshes.push(coruscant);

  // 2. Tatooine / Desert: top right, small scale
  const tatooine = createTatooine();
  tatooine.position.set(13, 9, 22);
  tatooine.scale.setScalar(1.5);
  group.add(tatooine);
  planetMeshes.push(tatooine);

  // 3. Moon: top left, very small scale
  const moon = createMoon();
  moon.position.set(-13, 9, 24);
  moon.scale.setScalar(1);
  group.add(moon);
  planetMeshes.push(moon);

  // 4. Ocean planet: middle, small scale
  const oceanPlanet = createOceanPlanet();
  oceanPlanet.position.set(10, 1, 22);
  oceanPlanet.scale.setScalar(1.0);
  group.add(oceanPlanet);
  planetMeshes.push(oceanPlanet);

  return { group, planetMeshes };
}