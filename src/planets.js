import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

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
    roughness: 0.8,
    metalness: 0.1,
    // City lights glow on the dark side of the planet:
    emissiveMap: cityLights,
    emissive: new THREE.Color(0xffeedd),
    emissiveIntensity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

export function createPlanets() {
  const group = new THREE.Group();

  // 1. Ambient light so the dark side isn't 100% pitch black
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  group.add(ambientLight);

  // 2. Directional light (like light from the accretion disk or a distant star)
  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
  sunLight.position.set(5, 3, 5);
  group.add(sunLight);

  // 3. Add Coruscant
  const coruscant = createCoruscant();
  coruscant.position.set(3, 1, 0); // position it where visible
  group.add(coruscant);

  return group;
}