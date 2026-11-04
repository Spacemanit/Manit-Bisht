import * as THREE from "three";
import { createBlackHole } from "./black-hole.js";
import { createWhiteHole } from "./white-hole.js";
import {
  BLACK_HOLE_STOP_ZOOM,
  CONSOLE_APPEAR,
  CONSOLE_TYPED,
  CONSOLE_DISAPPEAR,
  WORMHOLE_ENTRANCE_VIEW,
  WORMHOLE_PLUNGE_END,
  WORMHOLE_TUNNEL_START,
  WORMHOLE_TUNNEL_END,
  FLASH_PEAK_START,
  FLASH_PEAK_END,
  WHITE_HOLE_REVEAL_END,
  WHITE_HOLE_MAX_SCROLL,
} from "./thresholds.js";
import {
  createWormholeEntrance,
  createWormholeCurve,
  createWormholeTunnel,
} from "./wormhole.js";

// Create scene, camera, and renderer
const mainCanvas = document.querySelector("#three-canvas");
const consoleCanvas = document.querySelector("#console-canvas");
const wormholeHud = document.querySelector("#wormhole-hud");
const hyperspaceFlash = document.querySelector("#hyperspace-flash");

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.z = 16.67;

const birthdate = new Date("2007-09-17");
const age = Date.now() - birthdate.getTime();

const ageChronos = {
  years: Math.floor(age / 1000 / 60 / 60 / 24 / 365.25),
  months: Math.floor((age / 1000 / 60 / 60 / 24 / 30.4375) % 12),
  days: Math.floor((age / 1000 / 60 / 60 / 24) % 30.4375),
};

const mouse = new THREE.Vector2();

window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

var renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: false });
function setRenderSize() {
  renderer.setPixelRatio(Math.min(
    window.devicePixelRatio || 1,
    1280 / Math.max(window.innerWidth, window.innerHeight),
  ));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
setRenderSize();
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---------------------------------------------------------------------------
// CONSOLE TEXT
// ---------------------------------------------------------------------------
function addConsole() {
  const fullText = `root@system:~# initializing protocol...\n[OK] Created console.\n[OK] Established link with human\n> System online. Hello Manit\n> I have been waiting for you to enter\n> You are now...\n> ${ageChronos.years} years, ${ageChronos.months} months, ${ageChronos.days} days old\n\n> Exiting into outer space...`;
  const lines = fullText.split("\n");

  const customScale = 1;

  consoleCanvas.width = window.innerWidth * customScale;
  consoleCanvas.height = window.innerHeight * customScale;

  consoleCanvas.style.width = window.innerWidth + "px";
  consoleCanvas.style.height = window.innerHeight + "px";

  const ctx = consoleCanvas.getContext("2d");
  ctx.scale(customScale, customScale);
  ctx.clearRect(0, 0, consoleCanvas.width, consoleCanvas.height);

  const scrollTriggerPoint = CONSOLE_APPEAR;
  const maxScroll = CONSOLE_TYPED;
  const remainingScrollSpace = maxScroll - scrollTriggerPoint;
  const currentScrollPastTrigger = currentScroll - scrollTriggerPoint;

  const scrollPercent =
    remainingScrollSpace > 0
      ? currentScrollPastTrigger / remainingScrollSpace
      : 0;

  const totalChars = fullText.length;
  const visibleCharsCount = Math.floor(scrollPercent * totalChars);

  ctx.fillStyle = "#00ff66";
  ctx.font = '25px Michroma, monospace';

  let charCounter = 0;
  let startX = 40;
  let startY = 60;
  const lineHeight = 30;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (charCounter >= visibleCharsCount) break;
    const lineRemaining = visibleCharsCount - charCounter;

    if (lineRemaining >= line.length) {
      ctx.fillText(line, startX, startY + i * lineHeight);
      charCounter += line.length + 1;
    } else {
      const partialLine = line.substring(0, lineRemaining);
      ctx.fillText(partialLine, startX, startY + i * lineHeight);

      if (Math.floor(Date.now() / 400) % 3 === 0) {
        const textWidth = ctx.measureText(partialLine).width;
        ctx.fillText("|", startX + textWidth, startY + i * lineHeight);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 3D SCENE MESHES
// ---------------------------------------------------------------------------
// Initial Black Hole & Standard Starfield
const { mesh: blackhole, sky: blackholeSky } = createBlackHole();
scene.add(blackhole);
scene.background = blackholeSky;

// Final White Hole & Dense Cosmic Starfield
const { mesh: whiteHole, sky: whiteHoleSky } = createWhiteHole();
scene.add(whiteHole);
whiteHole.visible = false;

// Interstellar 3D Spherical Wormhole Entrance (connecting our sky to destination galaxy sky)
const wormholeEntrance = createWormholeEntrance(blackholeSky, whiteHoleSky);
scene.add(wormholeEntrance.group);
wormholeEntrance.group.visible = false;

// Wormhole Hyperspace Spline Tunnel
const wormholeCurve = createWormholeCurve();
const wormholeTunnel = createWormholeTunnel(wormholeCurve, blackholeSky);
scene.add(wormholeTunnel.group);
wormholeTunnel.group.visible = false;

// Camera distances for Black Hole, Zoomout, and White Hole
const START_CAMERA_Z = 16.67;
const ZOOM_IN_CAMERA_Z = 0.7;
const PHASE2_FAR_Z = 36.0;

// ---------------------------------------------------------------------------
// UNIFIED BIDIRECTIONAL SCROLL ENGINE
// ---------------------------------------------------------------------------
let targetScroll = window.scrollY;
let currentScroll = window.scrollY;
let prevScroll = window.scrollY;

window.addEventListener("scroll", () => {
  targetScroll = Math.max(0, window.scrollY);
}, { passive: true });

// Keyframed progress curve with generous 1200px dwell windows around each achievement card.
function getTunnelProgress(scroll) {
  if (scroll <= WORMHOLE_TUNNEL_START) return 0.0;
  if (scroll >= WORMHOLE_TUNNEL_END) return 1.0;

  const K = [
    { s: 7200,  t: 0.00 },
    { s: 8400,  t: 0.13 }, // glide to card 1
    { s: 9600,  t: 0.19 }, // 1200px slow dwell right in front of Card 1 (t=0.16)
    { s: 10600, t: 0.34 }, // curve to card 2
    { s: 11800, t: 0.42 }, // 1200px slow dwell right in front of Card 2 (t=0.38)
    { s: 12800, t: 0.58 }, // curve to card 3
    { s: 14000, t: 0.66 }, // 1200px slow dwell right in front of Card 3 (t=0.62)
    { s: 15000, t: 0.80 }, // curve to card 4
    { s: 16200, t: 0.88 }, // 1200px slow dwell right in front of Card 4 (t=0.84)
    { s: 16800, t: 1.00 }, // glide to exit
  ];

  for (let i = 0; i < K.length - 1; i++) {
    if (scroll >= K[i].s && scroll <= K[i + 1].s) {
      const frac = (scroll - K[i].s) / (K[i + 1].s - K[i].s);
      const smoothFrac = frac * frac * (3 - 2 * frac); // Smoothstep Hermite
      return K[i].t + smoothFrac * (K[i + 1].t - K[i].t);
    }
  }
  return 1.0;
}

// ---------------------------------------------------------------------------
// ANIMATION LOOP
// ---------------------------------------------------------------------------
let lastFrameTime = performance.now();

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // Smooth inertial interpolation: eliminates jerky wheel ticks and gives a silky camera glide
  currentScroll = THREE.MathUtils.lerp(currentScroll, targetScroll, 0.085);

  // 1. Deterministic Visibilities & Backgrounds (100% reversible on backward scrolling)
  const isPhase1 = currentScroll < CONSOLE_DISAPPEAR;
  const isConsole = currentScroll >= CONSOLE_APPEAR && currentScroll < CONSOLE_DISAPPEAR;
  const isFunnel = currentScroll >= CONSOLE_DISAPPEAR && currentScroll < WORMHOLE_TUNNEL_START;
  const isTunnel = currentScroll >= WORMHOLE_PLUNGE_END - 300 && currentScroll < FLASH_PEAK_END;
  const isWhiteHole = currentScroll >= FLASH_PEAK_START;

  // Background and White Hole vs Black Hole selection
  if (isWhiteHole) {
    scene.background = whiteHoleSky;
    whiteHole.visible = true;
    blackhole.visible = false;

    whiteHole.rotation.y = reducedMotion.matches ? 0 : mouse.x * 0.2;
    whiteHole.rotation.x = 0.45 - (reducedMotion.matches ? 0 : mouse.y * 0.2);
    whiteHole.material.uniforms.uTime.value = reducedMotion.matches ? 0 : (now / 1000) % 10000;
  } else {
    scene.background = blackholeSky;
    whiteHole.visible = false;
    blackhole.visible = isPhase1;

    if (blackhole.visible) {
      blackhole.rotation.y = reducedMotion.matches ? 0 : mouse.x * 0.2;
      blackhole.rotation.x = 0.45 - (reducedMotion.matches ? 0 : mouse.y * 0.2);
      blackhole.material.uniforms.uTime.value = reducedMotion.matches ? 0 : (now / 1000) % 10000;
    }
  }

  // Console terminal canvas:
  if (isConsole) {
    consoleCanvas.style.display = "block";
    addConsole();
  } else {
    consoleCanvas.style.display = "none";
  }

  // Wormhole Entrance:
  wormholeEntrance.group.visible = isFunnel;
  if (wormholeEntrance.group.visible) {
    const rotY = reducedMotion.matches ? 0 : mouse.x * 0.2;
    const rotX = 0.45 - (reducedMotion.matches ? 0 : mouse.y * 0.2);
    wormholeEntrance.update(now / 1000, rotX, rotY);
  }

  // Wormhole Tunnel:
  wormholeTunnel.group.visible = isTunnel;

  // Subtle HUD scroll prompt (only shown briefly in zoomout phase)
  if (wormholeHud) {
    const showHud = currentScroll >= 5200 && currentScroll < 6200;
    wormholeHud.style.display = showHud ? "block" : "none";
    wormholeHud.style.opacity = showHud ? "1" : "0";
  }

  // 2. Camera Trajectory and Transit Phases

  // Phase A: Black Hole Approach & Singularity (0 -> 4500px)
  if (currentScroll < CONSOLE_DISAPPEAR) {
    let cameraZ;
    let zoomProgress;

    if (currentScroll < BLACK_HOLE_STOP_ZOOM) {
      zoomProgress = THREE.MathUtils.clamp(currentScroll / BLACK_HOLE_STOP_ZOOM, 0, 1);
      cameraZ = START_CAMERA_Z + zoomProgress * (ZOOM_IN_CAMERA_Z - START_CAMERA_Z);
    } else {
      zoomProgress = 1.0;
      cameraZ = ZOOM_IN_CAMERA_Z;
    }

    camera.position.set(0, 0, cameraZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    blackhole.material.uniforms.uZoomProgress.value = zoomProgress;

    if (hyperspaceFlash) hyperspaceFlash.style.display = "none";
  }

  // Phase B: Zoomout to reveal Wormhole Funnel in deep space (4500 -> 6000px)
  else if (currentScroll < WORMHOLE_ENTRANCE_VIEW) {
    const t = (currentScroll - CONSOLE_DISAPPEAR) / (WORMHOLE_ENTRANCE_VIEW - CONSOLE_DISAPPEAR);
    const eased = t * t * (3 - 2 * t);
    const cameraZ = ZOOM_IN_CAMERA_Z + eased * (PHASE2_FAR_Z - ZOOM_IN_CAMERA_Z);

    camera.position.set(0, 0, cameraZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);

    if (hyperspaceFlash) hyperspaceFlash.style.display = "none";
  }

  // Phase C: Plunge down funnel mouth into throat (6000 -> 7200px)
  else if (currentScroll < WORMHOLE_TUNNEL_START) {
    const t = (currentScroll - WORMHOLE_ENTRANCE_VIEW) / (WORMHOLE_TUNNEL_START - WORMHOLE_ENTRANCE_VIEW);
    const easeT = t * t * (3 - 2 * t);

    // Plunge camera from space view directly into throat entrance (0, 0, 0)
    const spacePos = new THREE.Vector3(0, 0, PHASE2_FAR_Z);
    const throatTarget = new THREE.Vector3(0, 0, 0);
    camera.position.lerpVectors(spacePos, throatTarget, easeT);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, -60.0);

    // Optical starlight flash near throat entry (6800 -> 7200)
    if (hyperspaceFlash) {
      if (t > 0.75) {
        hyperspaceFlash.style.display = "block";
        hyperspaceFlash.style.opacity = `${((t - 0.75) / 0.25) * 0.75}`;
      } else {
        hyperspaceFlash.style.display = "none";
        hyperspaceFlash.style.opacity = "0";
      }
    }
  }

  // Phase D: Wormhole Tunnel Hyperspace Flight (7200 -> 16800px)
  else if (currentScroll < FLASH_PEAK_START) {
    const progress = getTunnelProgress(currentScroll);

    // Optical flash fade-out as tunnel opens, and ramp-up approaching exit
    if (hyperspaceFlash) {
      if (progress < 0.04) {
        hyperspaceFlash.style.display = "block";
        hyperspaceFlash.style.opacity = `${(1.0 - progress / 0.04) * 0.75}`;
      } else if (currentScroll >= 16200) {
        const flashIn = (currentScroll - 16200) / (FLASH_PEAK_START - 16200);
        hyperspaceFlash.style.display = "block";
        hyperspaceFlash.style.opacity = `${flashIn}`;
      } else {
        hyperspaceFlash.style.display = "none";
        hyperspaceFlash.style.opacity = "0";
      }
    }

    // Sample position & tangent from the spline curve
    const currentPt = wormholeCurve.getPointAt(progress);
    const lookAheadT = Math.min(1.0, progress + 0.02);
    let lookTarget = wormholeCurve.getPointAt(lookAheadT);
    const tangent = wormholeCurve.getTangentAt(progress).normalize();

    // Natural banking / roll frame
    let worldUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(tangent.dot(worldUp)) > 0.9) worldUp.set(1, 0, 0);
    const right = tangent.clone().cross(worldUp).normalize();
    const smoothUp = right.clone().cross(tangent).normalize();

    // Gracefully frame oncoming achievement cards so they are unmissable
    if (wormholeTunnel.cards) {
      for (const card of wormholeTunnel.cards) {
        const deltaT = card.t - progress;
        // As camera approaches from 0.07 ahead to 0.015 past
        if (deltaT > -0.015 && deltaT < 0.07) {
          const w = Math.sin((deltaT + 0.015) / 0.085 * Math.PI);
          lookTarget.lerp(card.mesh.position, w * 0.45);
          break;
        }
      }
    }

    // Gentle responsive mouse sway
    const swayX = (mouse.x || 0) * 0.4;
    const swayY = (mouse.y || 0) * 0.4;
    const camPos = currentPt.clone()
      .add(right.clone().multiplyScalar(swayX))
      .add(smoothUp.clone().multiplyScalar(swayY));

    camera.position.copy(camPos);
    camera.up.copy(smoothUp);
    camera.lookAt(lookTarget);

    // Dynamic speed factor for subtle shader shear
    const velocity = Math.abs(currentScroll - prevScroll);
    prevScroll = currentScroll;
    const speedFactor = THREE.MathUtils.clamp(velocity * 0.03 + 0.6, 0.4, 2.5);

    wormholeTunnel.update(now / 1000, progress, speedFactor);
  }

  // Phase E: Peak Blinding Flash / Singularity Emergence (16800 -> 17600px)
  else if (currentScroll < FLASH_PEAK_END) {
    if (hyperspaceFlash) {
      hyperspaceFlash.style.display = "block";
      hyperspaceFlash.style.opacity = "1";
    }

    // Camera emerges from the White Hole singularity core
    const t = (currentScroll - FLASH_PEAK_START) / (FLASH_PEAK_END - FLASH_PEAK_START);
    const cameraZ = ZOOM_IN_CAMERA_Z + t * (5.0 - ZOOM_IN_CAMERA_Z);
    camera.position.set(0, 0, cameraZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 1.0;
  }

  // Phase F: Flash Dissolves & Camera Pulls Back to reveal White Hole (17600 -> 19200px)
  else if (currentScroll < WHITE_HOLE_REVEAL_END) {
    const t = (currentScroll - FLASH_PEAK_END) / (WHITE_HOLE_REVEAL_END - FLASH_PEAK_END);

    // Flash gently fades away
    if (hyperspaceFlash) {
      hyperspaceFlash.style.display = "block";
      hyperspaceFlash.style.opacity = `${Math.max(0, 1.0 - t)}`;
    }

    // Camera pulls back to majestic home distance (16.67)
    const eased = t * t * (3 - 2 * t);
    const cameraZ = 5.0 + eased * (START_CAMERA_Z - 5.0);
    camera.position.set(0, 0, cameraZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 1.0 - eased;
  }

  // Phase G: Home with the White Hole (19200px+)
  else {
    if (hyperspaceFlash) {
      hyperspaceFlash.style.display = "none";
      hyperspaceFlash.style.opacity = "0";
    }

    camera.position.set(0, 0, START_CAMERA_Z);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 0.0;
  }

  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  blackhole.material.uniforms.uAspect.value = width / height;
  whiteHole.material.uniforms.uAspect.value = width / height;
  setRenderSize();
});
