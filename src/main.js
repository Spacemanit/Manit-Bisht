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
  WHITE_HOLE_HOLD_END,
  CONTACT_REVEAL_START,
  CONTACT_REVEAL_END,
  TOTAL_MAX_SCROLL,
  WHITE_HOLE_MAX_SCROLL,
} from "./thresholds.js";
import {
  createWormholeEntrance,
  createWormholeCurve,
  createWormholeTunnel,
  createWhiteHoleLogoSplash,
} from "./wormhole.js";

// Create scene, camera, and renderer
const mainCanvas = document.querySelector("#three-canvas");
const consoleCanvas = document.querySelector("#console-canvas");
const wormholeHud = document.querySelector("#wormhole-hud");
const hyperspaceFlash = document.querySelector("#hyperspace-flash");
const wormholeYearHud = document.querySelector("#wormhole-year-hud");
const yearHudValue = document.querySelector("#year-hud-value");
const yearHudFill = document.querySelector("#year-hud-fill");
const yearHudPip = document.querySelector("#year-hud-pip");
const contactSection = document.querySelector("#contact-section");
const backToTopBtn = document.querySelector("#back-to-top-btn");

if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

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
  const fullText = [
    "> initializing protocol...",
    "> established link with traveler",
    "> system online. Hello Manit",
    "> I have been waiting for you to enter",
    "> you are now...",
    `> ${ageChronos.years} years, ${ageChronos.months} months, ${ageChronos.days} days old`,
    "> exiting into outer space...",
  ].join("\n");
  const lines = fullText.split("\n");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (consoleCanvas.width !== width * dpr || consoleCanvas.height !== height * dpr) {
    consoleCanvas.width = width * dpr;
    consoleCanvas.height = height * dpr;
    consoleCanvas.style.width = width + "px";
    consoleCanvas.style.height = height + "px";
  }

  const ctx = consoleCanvas.getContext("2d");
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

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
  ctx.font = '500 19px "JetBrains Mono", monospace';
  ctx.shadowColor = "rgba(0, 255, 102, 0.4)";
  ctx.shadowBlur = 8;

  let charCounter = 0;
  const startX = Math.max(32, Math.floor(width * 0.04));
  const startY = Math.max(50, Math.floor(height * 0.08));
  const lineHeight = 36;

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

      if (Math.floor(Date.now() / 350) % 2 === 0) {
        const textWidth = ctx.measureText(partialLine).width;
        ctx.fillText("█", startX + textWidth + 6, startY + i * lineHeight);
      }
      break;
    }
  }
  ctx.restore();
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

// White Hole Logo Splash (Tech Ejection Outburst)
const whiteHoleSplash = createWhiteHoleLogoSplash();
scene.add(whiteHoleSplash.group);

// Camera distances for Black Hole, Zoomout, and White Hole
const START_CAMERA_Z = 16.67;
const ZOOM_IN_CAMERA_Z = 0.7;
const PHASE2_FAR_Z = 36.0;

// ---------------------------------------------------------------------------
// UNIFIED BIDIRECTIONAL SCROLL ENGINE & WORMHOLE CARD AUTOSCROLL
// ---------------------------------------------------------------------------
let targetScroll = window.scrollY;
let currentScroll = window.scrollY;
let prevScroll = window.scrollY;

window.addEventListener("scroll", () => {
  targetScroll = Math.max(0, window.scrollY);
}, { passive: true });

// Wormhole Card Stops for Single-Scroll Autonavigation
const WORMHOLE_CARD_STOPS = [
  7200,   // Tunnel Entrance
  9000,   // Card 1: IAAC Gold Medalist 2023
  11200,  // Card 2: B.Tech Computer Science 2025
  13400,  // Card 3: the-button 2026
  15600,  // Card 4: SPNT Expense Tracker 2026
  16800,  // Exit threshold into White Hole
];

let isCardTransitioning = false;
let lastCardSnapTime = 0;
let cardAnimFrame = null;

function snapToCard(targetY, duration = 850) {
  if (cardAnimFrame) cancelAnimationFrame(cardAnimFrame);
  lastCardSnapTime = Date.now();
  isCardTransitioning = true;

  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1.0, elapsed / duration);
    // Smooth Quintic ease-in-out curve for cinematic camera glide
    const eased = progress < 0.5
      ? 16 * progress * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 5) / 2;

    const currentY = startY + distance * eased;
    window.scrollTo(0, currentY);
    targetScroll = currentY;

    if (progress < 1.0) {
      cardAnimFrame = requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
      targetScroll = targetY;
      isCardTransitioning = false;
      cardAnimFrame = null;
    }
  }

  cardAnimFrame = requestAnimationFrame(step);
}

function handleCardNavigation(direction) {
  const currentY = window.scrollY;

  // Downward navigation: advance to next card
  if (direction > 0) {
    for (let i = 0; i < WORMHOLE_CARD_STOPS.length; i++) {
      if (WORMHOLE_CARD_STOPS[i] > currentY + 60) {
        snapToCard(WORMHOLE_CARD_STOPS[i], 850);
        return true;
      }
    }
    // Past Card 4: advance into white hole emergence
    if (currentY >= 16750 && currentY < 17600) {
      snapToCard(17600, 750);
      return true;
    }
  } 
  // Upward navigation: rewind to previous card
  else if (direction < 0) {
    for (let i = WORMHOLE_CARD_STOPS.length - 1; i >= 0; i--) {
      if (WORMHOLE_CARD_STOPS[i] < currentY - 60) {
        snapToCard(WORMHOLE_CARD_STOPS[i], 850);
        return true;
      }
    }
  }
  return false;
}

// Mouse Wheel: single wheel action triggers smooth transit to the next/previous card
window.addEventListener("wheel", (e) => {
  const currentY = window.scrollY;

  // Active wormhole card snapping zone: from tunnel entry (7100) to exit (16900)
  if (currentY >= 7100 && currentY <= 16900) {
    if (Math.abs(e.deltaY) < 5) return; // ignore trackpad micro-jitter

    e.preventDefault();

    const now = Date.now();
    if (isCardTransitioning || now - lastCardSnapTime < 650) {
      return;
    }

    const direction = e.deltaY > 0 ? 1 : -1;
    handleCardNavigation(direction);
  }
}, { passive: false });

// Keyboard: Arrow keys, Page Up/Down, Spacebar
window.addEventListener("keydown", (e) => {
  const currentY = window.scrollY;
  if (currentY >= 7100 && currentY <= 16900) {
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      const now = Date.now();
      if (!isCardTransitioning && now - lastCardSnapTime > 650) {
        handleCardNavigation(1);
      }
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      const now = Date.now();
      if (!isCardTransitioning && now - lastCardSnapTime > 650) {
        handleCardNavigation(-1);
      }
    }
  }
});

// Touch swipe support for mobile
let touchStartY = 0;
window.addEventListener("touchstart", (e) => {
  if (e.touches.length > 0) {
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

window.addEventListener("touchend", (e) => {
  const currentY = window.scrollY;
  if (currentY >= 7100 && currentY <= 16900 && e.changedTouches.length > 0) {
    const deltaTouchY = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(deltaTouchY) > 40) {
      const now = Date.now();
      if (!isCardTransitioning && now - lastCardSnapTime > 650) {
        handleCardNavigation(deltaTouchY > 0 ? 1 : -1);
      }
    }
  }
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

  // White Hole Logo Splash Outburst:
  whiteHoleSplash.update(currentScroll, now / 1000, mouse);

  // Subtle HUD scroll prompt (only shown briefly in zoomout phase)
  if (wormholeHud) {
    const showHud = currentScroll >= 5200 && currentScroll < 6200;
    wormholeHud.style.display = showHud ? "block" : "none";
    wormholeHud.style.opacity = showHud ? "1" : "0";
  }

  // Right-Middle Year Progress Bar HUD in Wormhole Tunnel (7200 -> 16800px)
  if (wormholeYearHud) {
    const showYearHud = currentScroll >= WORMHOLE_TUNNEL_START && currentScroll < FLASH_PEAK_START;
    wormholeYearHud.style.display = showYearHud ? "block" : "none";
    wormholeYearHud.style.opacity = showYearHud ? "1" : "0";

    if (showYearHud) {
      const progress = getTunnelProgress(currentScroll); // 0.0 -> 1.0
      const pct = Math.min(100, Math.max(0, progress * 100));

      if (yearHudFill) yearHudFill.style.height = `${pct}%`;
      if (yearHudPip) yearHudPip.style.top = `${pct}%`;

      // Year milestones along the wormhole spline:
      // 2023: IAAC medal (t = 0.16)
      // 2025: B.Tech in VIT (t = 0.38)
      // 2026: the-button (t = 0.62) & SPNT (t = 0.84)
      let activeYear = "2023";
      if (progress >= 0.28 && progress < 0.50) {
        activeYear = "2025";
      } else if (progress >= 0.50) {
        activeYear = "2026";
      }

      if (yearHudValue) {
        yearHudValue.textContent = activeYear;
      }
    }
  }

  // 2. Camera Trajectory and Transit Phases
  if (contactSection && currentScroll < CONTACT_REVEAL_START) {
    contactSection.style.opacity = "0";
    contactSection.style.transform = "translateY(105%)";
    contactSection.style.pointerEvents = "none";
  }

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

    if (contactSection) {
      contactSection.style.opacity = "0";
      contactSection.style.transform = "translateY(105%)";
      contactSection.style.pointerEvents = "none";
    }

    // Camera pulls back to majestic home distance (16.67)
    const eased = t * t * (3 - 2 * t);
    const cameraZ = 5.0 + eased * (START_CAMERA_Z - 5.0);
    camera.position.set(0, 0, cameraZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 1.0 - eased;
  }

  // Phase G: White Hole Centerpiece Hold (19200 -> 20500px)
  else if (currentScroll < CONTACT_REVEAL_START) {
    if (hyperspaceFlash) {
      hyperspaceFlash.style.display = "none";
      hyperspaceFlash.style.opacity = "0";
    }

    if (contactSection) {
      contactSection.style.opacity = "0";
      contactSection.style.transform = "translateY(105%)";
      contactSection.style.pointerEvents = "none";
    }

    camera.position.set(0, 0, START_CAMERA_Z);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 0.0;
  }

  // Phase H: Camera Tilts Up & Contact Section Glides In (20500px -> 23000px+)
  else {
    if (hyperspaceFlash) {
      hyperspaceFlash.style.display = "none";
      hyperspaceFlash.style.opacity = "0";
    }

    const t = Math.min(1.0, (currentScroll - CONTACT_REVEAL_START) / (CONTACT_REVEAL_END - CONTACT_REVEAL_START));
    const eased = t * t * (3 - 2 * t);

    // Smoothly tilt camera down and look upward so the White Hole shifts to the upper sky
    camera.position.set(0, -eased * 4.2, START_CAMERA_Z);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, eased * 2.2, 0);
    whiteHole.material.uniforms.uZoomProgress.value = 0.0;

    if (contactSection) {
      contactSection.style.display = "block";
      contactSection.style.opacity = `${Math.min(1.0, eased * 1.5)}`;
      contactSection.style.transform = `translateY(${(1.0 - eased) * 105}%)`;
      contactSection.style.pointerEvents = eased > 0.4 ? "auto" : "none";
    }
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
