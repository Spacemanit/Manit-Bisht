import * as THREE from "three";
import { createBlackHole } from "./black-hole.js";
import { createStars } from "./starfield.js";
import {
  BLACK_HOLE_STOP_ZOOM,
  CONSOLE_APPEAR,
  CONSOLE_TYPED,
  CONSOLE_DISAPPEAR,
} from "./thresholds.js";
import { createPlanets } from "./planets.js";

//create scene, camera, and renderer
const mainCanvas = document.querySelector("#three-canvas");
const consoleCanvas = document.querySelector("#console-canvas");

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 5;
var currentScroll = window.scrollY;

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

// -------------------------------console text-------------------------------
function addConsole() {
  const fullText = `root@system:~# initializing protocol...\n[OK] Created console.\n[OK] Established link with human\n> System online. Hello Manit\n> I have been waiting for you to enter\n> You are now...\n> ${ageChronos.years} years, ${ageChronos.months} months, ${ageChronos.days} days old\n\n> Exiting into outer space...`;
  const lines = fullText.split("\n");

  const customScale = 1;

  consoleCanvas.width = window.innerWidth * customScale;
  consoleCanvas.height = window.innerHeight * customScale;

  // 2. Lock the physical display dimensions using absolute CSS layout styling
  consoleCanvas.style.width = window.innerWidth + "px";
  consoleCanvas.style.height = window.innerHeight + "px";

  const ctx = consoleCanvas.getContext("2d");
  ctx.scale(customScale, customScale);
  ctx.clearRect(0, 0, consoleCanvas.width, consoleCanvas.height);

  const scrollTriggerPoint = CONSOLE_APPEAR; // The scroll position at which the console starts to appear
  const maxScroll = CONSOLE_TYPED; // The maximum scroll position for the console to be fully visible
  const remainingScrollSpace = maxScroll - scrollTriggerPoint;
  const currentScrollPastTrigger = currentScroll - scrollTriggerPoint;

  const scrollPercent =
    remainingScrollSpace > 0
      ? currentScrollPastTrigger / remainingScrollSpace
      : 0;

  const totalChars = fullText.length;
  const visibleCharsCount = Math.floor(scrollPercent * totalChars);

  ctx.fillStyle = "#00ff66";
  ctx.font = '25px "DeadCRT", monospace';

  let charCounter = 0;
  let startX = 40;
  let startY = 60;
  const lineHeight = 30;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (charCounter >= visibleCharsCount) break;
    const lineRemaining = visibleCharsCount - charCounter;

    if (lineRemaining >= line.length) {
      // The current line is fully unlocked by the user's scroll depth
      ctx.fillText(line, startX, startY + i * lineHeight);
      charCounter += line.length + 1; // The +1 accounts for the split line break index
    } else {
      // The line is in the process of being typed out letter-by-letter
      const partialLine = line.substring(0, lineRemaining);
      ctx.fillText(partialLine, startX, startY + i * lineHeight);

      // Draw a standard flashing console underscore cursor at the current typing boundary
      // Uses system timestamps to toggle visibility automatically
      if (Math.floor(Date.now() / 400) % 3 === 0) {
        const textWidth = ctx.measureText(partialLine).width;
        ctx.fillText("|", startX + textWidth, startY + i * lineHeight);
      }
      break; // Exit the loop early since subsequent line items are still hidden
    }
  }
}
// -------------------------------console text ends--------------------------
const { mesh: blackhole, sky: blackholeSky } = createBlackHole();
scene.add(blackhole);

const planets = createPlanets();
scene.add(planets);

// -------------------------------star field---------------------------------
// const stars = createStars();
// // Add to scene at root level and set renderOrder so it draws in front of the black hole quad
// stars.renderOrder = 1;
// scene.add(stars);
// -------------------------------star field ends----------------------------

function updateBlackHoleScale() {
  const minScale = 0.3;
  const maxScale = 5;
  let zoomProgress;
  let textZoomProgress;
  let cameraZ = 5;

  if (currentScroll < CONSOLE_DISAPPEAR) {
    cameraZ = 5;
    zoomProgress = THREE.MathUtils.clamp(
      currentScroll / BLACK_HOLE_STOP_ZOOM,
      0,
      1
    );
    textZoomProgress = zoomProgress;
  } else {
    const scrollOutPercent = THREE.MathUtils.clamp(
      (currentScroll - CONSOLE_DISAPPEAR) / BLACK_HOLE_STOP_ZOOM,
      0,
      1
    );
    // Pull the camera back from z = 5 to z = 12 with smooth cubic easing
    const eased = scrollOutPercent * scrollOutPercent * (3 - 2 * scrollOutPercent);
    cameraZ = 5 + 7 * eased;

    zoomProgress = 1 - scrollOutPercent;
    textZoomProgress = 1;
  }

  camera.position.z = cameraZ;
  const newScale = minScale + zoomProgress * (maxScale - minScale);
  blackhole.scale.setScalar(newScale);
  blackhole.material.uniforms.uZoomProgress.value = textZoomProgress;
}
// Apply the same scale mapping on load, including restored scroll positions.
updateBlackHoleScale();
window.addEventListener("scroll", () => {
  currentScroll = Math.max(0, window.scrollY);
  updateBlackHoleScale();
}, { passive: true });

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  // Only manipulate the black hole after it loads
  if (blackhole) {
    if (currentScroll < BLACK_HOLE_STOP_ZOOM) {
      blackhole.rotation.y = reducedMotion.matches ? 0 : mouse.x * 0.2;
      blackhole.rotation.x = 0.45 - (reducedMotion.matches ? 0 : mouse.y * 0.2);
    } else {
      blackhole.rotation.x = 0.45;
    }
    blackhole.material.uniforms.uTime.value = reducedMotion.matches ? 0 : (now / 1000) % 10000;

    // Show black hole at beginning and after console disappears
    blackhole.visible =
      currentScroll < BLACK_HOLE_STOP_ZOOM || currentScroll >= CONSOLE_DISAPPEAR;
    // stars.visible = blackhole.visible;
    scene.background = blackhole.visible ? blackholeSky : null;

    // stars.rotation.y = blackhole.rotation.y;
    // stars.rotation.x = blackhole.rotation.x;
  }

  // Console is visible only between appear threshold and disappear threshold
  if (currentScroll >= CONSOLE_APPEAR && currentScroll < CONSOLE_DISAPPEAR) {
    consoleCanvas.style.display = "block";
    addConsole();
  } else {
    consoleCanvas.style.display = "none";
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
  setRenderSize();
});
