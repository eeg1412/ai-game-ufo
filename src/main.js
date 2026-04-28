import * as THREE from "three";
import * as CANNON from "cannon-es";
import "./styles.css";
import boxBackUrl from "./assets/figure-box/back.webp";
import boxBottomUrl from "./assets/figure-box/bottom.webp";
import boxFrontUrl from "./assets/figure-box/front.webp";
import boxLeftUrl from "./assets/figure-box/left.webp";
import boxRightUrl from "./assets/figure-box/right.webp";
import boxTopUrl from "./assets/figure-box/top.webp";
import cabinetPanelUrl from "./assets/kawaii-textures/cabinet-panel.webp";
import cushionFloorUrl from "./assets/kawaii-textures/cushion-floor.webp";
import giftWrapUrl from "./assets/kawaii-textures/gift-wrap.webp";
import mintMetalUrl from "./assets/kawaii-textures/mint-metal.webp";

const canvas = document.querySelector("#scene");
const scoreEl = document.querySelector("#score");
const playsEl = document.querySelector("#plays");
const statusEl = document.querySelector("#status");
const dropButton = document.querySelector("#drop");
const resetButton = document.querySelector("#reset");
const strengthInput = document.querySelector("#strength");
const strengthValue = document.querySelector("#strengthValue");
const cameraFollowInput = document.querySelector("#cameraFollow");

const bounds = { xMin: -3.15, xMax: 3.15, zMin: -1.55, zMax: 2.12 };
const chute = new THREE.Vector3(-2.92, 0.46, -1.82);
const clawHomeY = 3.42;
const clawLowY = 1.46;
const pointer = { x: 0.55, z: 1.05 };
const heldKeys = new Set();
const heldButtons = new Set();

let score = 0;
let plays = 8;
let state = "ready";
let phaseTime = 0;
let activePrize = null;
let cameraYaw = 0;

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff3e7);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
camera.position.set(-4.4, 4.45, -6.9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const physics = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
  allowSleep: true,
});
physics.broadphase = new CANNON.SAPBroadphase(physics);
physics.defaultContactMaterial.friction = 0.42;
physics.defaultContactMaterial.restitution = 0.04;
physics.solver.iterations = 12;
physics.solver.tolerance = 0.001;

const physicsMaterials = {
  prize: new CANNON.Material("figure-box"),
  cabinet: new CANNON.Material("cabinet"),
  chute: new CANNON.Material("chute"),
  claw: new CANNON.Material("claw"),
};

physics.addContactMaterial(
  new CANNON.ContactMaterial(physicsMaterials.prize, physicsMaterials.prize, {
    friction: 0.74,
    restitution: 0.015,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 7,
    frictionEquationStiffness: 1e7,
  }),
);
physics.addContactMaterial(
  new CANNON.ContactMaterial(physicsMaterials.prize, physicsMaterials.cabinet, {
    friction: 0.82,
    restitution: 0.01,
  }),
);
physics.addContactMaterial(
  new CANNON.ContactMaterial(physicsMaterials.prize, physicsMaterials.chute, {
    friction: 0.36,
    restitution: 0.01,
  }),
);
physics.addContactMaterial(
  new CANNON.ContactMaterial(physicsMaterials.prize, physicsMaterials.claw, {
    friction: 0.18,
    restitution: 0,
  }),
);

const world = new THREE.Group();
const trolley = new THREE.Group();
const clawHead = new THREE.Group();
const targetRing = new THREE.Group();
const clawArms = [];
const clawBodies = [];
const prizes = [];
const staticBodies = [];
const pickupBody = new CANNON.Body({
  mass: 0,
  type: CANNON.Body.KINEMATIC,
  material: physicsMaterials.claw,
});
const textureLoader = new THREE.TextureLoader();
let figureBoxFaceMaterials = null;

scene.add(world);
physics.addBody(pickupBody);

const materials = {
  dark: makeTexturedMaterial(cabinetPanelUrl, {
    color: 0xfff0dc,
    roughness: 0.7,
    repeat: [2.2, 1.5],
  }),
  metal: makeTexturedMaterial(mintMetalUrl, {
    color: 0xe4fff8,
    metalness: 0.38,
    roughness: 0.36,
    repeat: [1.8, 1.8],
  }),
  yellow: makeTexturedMaterial(giftWrapUrl, {
    color: 0xffefd2,
    metalness: 0.04,
    roughness: 0.5,
    repeat: [1.5, 1.5],
  }),
  rubber: new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.82,
    metalness: 0.02,
  }),
  rail: makeTexturedMaterial(mintMetalUrl, {
    color: 0xc8fff5,
    metalness: 0.44,
    roughness: 0.3,
    repeat: [2, 1],
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xe8fbff,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    roughness: 0.03,
    transmission: 0.08,
    thickness: 0.14,
    side: THREE.DoubleSide,
  }),
  floor: makeTexturedMaterial(cushionFloorUrl, {
    color: 0xfff4e8,
    roughness: 0.9,
    repeat: [3.2, 2.4],
  }),
  chute: makeTexturedMaterial(mintMetalUrl, {
    color: 0xd5fff6,
    roughness: 0.4,
    metalness: 0.25,
    repeat: [1.5, 1],
  }),
  blackPlastic: new THREE.MeshStandardMaterial({
    color: 0x05070b,
    roughness: 0.7,
    metalness: 0.02,
  }),
};

const glowMaterials = {
  tube: new THREE.MeshBasicMaterial({ color: 0xffffdf }),
  panel: new THREE.MeshBasicMaterial({
    color: 0xfff0c4,
    transparent: true,
    opacity: 0.62,
  }),
  bulbWarm: new THREE.MeshBasicMaterial({ color: 0xffd47a }),
  bulbPink: new THREE.MeshBasicMaterial({ color: 0xff9bb8 }),
  bulbMint: new THREE.MeshBasicMaterial({ color: 0xa7f8e0 }),
  signBack: new THREE.MeshBasicMaterial({
    color: 0xffb45f,
    transparent: true,
    opacity: 0.55,
  }),
};

const lampMaterials = {
  housing: new THREE.MeshStandardMaterial({
    color: 0xfff7e8,
    roughness: 0.42,
    metalness: 0.08,
  }),
  socket: new THREE.MeshStandardMaterial({
    color: 0xf2c17a,
    roughness: 0.36,
    metalness: 0.42,
  }),
  diffuser: new THREE.MeshBasicMaterial({
    color: 0xfff4cf,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  }),
};

function makeTexturedMaterial(url, options = {}) {
  const {
    repeat = [1, 1],
    color = 0xffffff,
    roughness = 0.6,
    metalness = 0.02,
    transparent = false,
    opacity = 1,
  } = options;
  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness,
    metalness,
    transparent,
    opacity,
  });
}

init();
animate();

function init() {
  addLights();
  buildCabinet();
  buildPhysicsCabinet();
  buildTargetRing();
  buildClaw();
  spawnPrizes();
  bindControls();
  resize();
  updateHud();
  window.addEventListener("resize", resize);
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x6c4a50, 1.05));

  const key = new THREE.DirectionalLight(0xfff1d6, 0.85);
  key.position.set(3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  scene.add(key);
}

function buildCabinet() {
  world.add(box(7.4, 0.32, 5.4, materials.floor, 0, 0.05, 0.25));
  world.add(
    box(7.6, 4.8, 0.16, materials.dark, 0, 2.45, 2.92),
    box(7.7, 0.28, 5.6, materials.dark, 0, 5, 0.2),
    box(0.18, 4.8, 5.6, materials.dark, -3.9, 2.45, 0.2),
    box(0.18, 4.8, 5.6, materials.dark, 3.9, 2.45, 0.2),
    box(7.36, 3.45, 0.08, materials.glass, 0, 2.85, -2.5),
    box(0.08, 3.9, 4.98, materials.glass, -3.72, 2.64, 0.2),
    box(0.08, 3.9, 4.98, materials.glass, 3.72, 2.64, 0.2),
  );

  [
    [-3.82, 2.58, -2.58, 0.16, 4.9, 0.16],
    [3.82, 2.58, -2.58, 0.16, 4.9, 0.16],
    [-3.82, 2.58, 2.94, 0.16, 4.9, 0.16],
    [3.82, 2.58, 2.94, 0.16, 4.9, 0.16],
    [0, 4.96, -2.58, 7.7, 0.16, 0.16],
    [0, 4.96, 2.94, 7.7, 0.16, 0.16],
  ].forEach(([x, y, z, sx, sy, sz]) => world.add(box(sx, sy, sz, materials.metal, x, y, z)));

  world.add(
    box(6.8, 0.12, 0.12, materials.rail, 0, 4.45, 2.23),
    box(6.8, 0.12, 0.12, materials.rail, 0, 4.45, -1.72),
    box(0.12, 0.12, 4.05, materials.rail, -3.18, 4.45, 0.25),
    box(0.12, 0.12, 4.05, materials.rail, 3.18, 4.45, 0.25),
  );

  buildCabinetLighting();
  buildPrizeOutlet();

  world.add(box(4.25, 0.52, 0.12, materials.yellow, 0, 4.76, -2.66));
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 0.45),
    new THREE.MeshBasicMaterial({ map: makeLabelTexture("SUPER CLAW"), transparent: true }),
  );
  sign.position.set(0, 4.77, -2.745);
  world.add(sign);
}

function buildCabinetLighting() {
  world.add(ceilingGlowPanel(0, 4.72, 0.15));
}

function ceilingGlowPanel(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(6.45, 0.12, 4.45), lampMaterials.housing);
  housing.position.y = 0.055;
  housing.castShadow = true;
  housing.receiveShadow = true;

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(6.12, 0.04, 4.08), lampMaterials.diffuser);
  diffuser.position.y = -0.035;

  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.05, 4.0),
    glowMaterials.panel,
  );
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = -0.06;

  const light = new THREE.RectAreaLight(0xffffd8, 6.2, 6.05, 4.0);
  light.position.set(0, -0.09, 0);
  light.rotation.x = -Math.PI / 2;

  group.add(housing, diffuser, glowPlane, light);
  return group;
}

function buildPhysicsCabinet() {
  addStaticBox(7.3, 0.3, 5.25, 0, 0.06, 0.25);
  addStaticBox(7.4, 4.2, 0.18, 0, 2.25, 2.78);
  addStaticBox(0.18, 4.2, 5.25, -3.62, 2.25, 0.15);
  addStaticBox(0.18, 4.2, 5.25, 3.62, 2.25, 0.15);
  addStaticBox(5.42, 1.1, 0.18, 0.9, 0.72, -2.38);

  addStaticBox(1.26, 0.08, 1.34, chute.x, 0.42, -2.05, -0.26, 0, 0, physicsMaterials.chute);
  addStaticBox(0.08, 0.28, 1.18, chute.x - 0.68, 0.54, -2.05, -0.26, 0, 0, physicsMaterials.chute);
  addStaticBox(0.08, 0.28, 1.18, chute.x + 0.68, 0.54, -2.05, -0.26, 0, 0, physicsMaterials.chute);
  addStaticBox(1.42, 0.12, 0.7, chute.x, 0.16, -2.86, -0.08, 0, 0, physicsMaterials.chute);
  addStaticBox(1.42, 0.22, 0.1, chute.x, 0.28, -3.19, 0, 0, 0, physicsMaterials.chute);
  addStaticBox(0.1, 0.2, 0.68, chute.x - 0.72, 0.28, -2.86, 0, 0, 0, physicsMaterials.chute);
  addStaticBox(0.1, 0.2, 0.68, chute.x + 0.72, 0.28, -2.86, 0, 0, 0, physicsMaterials.chute);
}

function buildPrizeOutlet() {
  const outlet = new THREE.Group();
  outlet.position.set(chute.x, 0, -2.57);

  const cavity = box(1.28, 0.72, 0.12, materials.blackPlastic, 0, 0.62, -0.02);
  const backShadow = box(1.02, 0.44, 0.06, materials.dark, 0, 0.62, -0.09);
  const topFrame = box(1.52, 0.16, 0.18, materials.yellow, 0, 1.06, 0);
  const bottomFrame = box(1.52, 0.16, 0.18, materials.yellow, 0, 0.18, 0);
  const leftFrame = box(0.16, 0.88, 0.18, materials.yellow, -0.76, 0.62, 0);
  const rightFrame = box(0.16, 0.88, 0.18, materials.yellow, 0.76, 0.62, 0);

  const doorFlap = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.32, 0.035),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.48,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
    }),
  );
  doorFlap.position.set(0, 0.66, -0.16);
  doorFlap.rotation.x = -0.22;
  doorFlap.castShadow = true;
  doorFlap.receiveShadow = true;

  const tray = box(1.42, 0.12, 0.7, materials.metal, 0, 0.08, -0.24);
  tray.rotation.x = -0.08;
  const trayFront = box(1.42, 0.22, 0.1, materials.metal, 0, 0.18, -0.62);
  const trayLeft = box(0.1, 0.18, 0.66, materials.metal, -0.71, 0.18, -0.28);
  const trayRight = box(0.1, 0.18, 0.66, materials.metal, 0.71, 0.18, -0.28);

  const innerRamp = box(1.18, 0.08, 1.25, materials.chute, 0, 0.38, 0.52);
  innerRamp.rotation.x = -0.28;
  const rampRailLeft = box(0.08, 0.22, 1.12, materials.yellow, -0.62, 0.5, 0.52);
  rampRailLeft.rotation.x = -0.28;
  const rampRailRight = box(0.08, 0.22, 1.12, materials.yellow, 0.62, 0.5, 0.52);
  rampRailRight.rotation.x = -0.28;

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 28), materials.metal);
  handle.position.set(0, 0.77, -0.2);
  handle.scale.set(1.65, 0.55, 0.45);
  handle.castShadow = true;
  handle.receiveShadow = true;

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.18),
    new THREE.MeshBasicMaterial({ map: makeSmallLabelTexture("PRIZE OUT"), transparent: true }),
  );
  sign.position.set(0, 1.08, -0.1);

  outlet.add(
    cavity,
    backShadow,
    topFrame,
    bottomFrame,
    leftFrame,
    rightFrame,
    doorFlap,
    tray,
    trayFront,
    trayLeft,
    trayRight,
    innerRamp,
    rampRailLeft,
    rampRailRight,
    handle,
    sign,
  );
  world.add(outlet);
}

function buildTargetRing() {
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 10, 56), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.245;
  const crossA = box(0.62, 0.018, 0.018, ringMaterial, 0, 0.245, 0);
  const crossB = box(0.018, 0.018, 0.62, ringMaterial, 0, 0.245, 0);
  targetRing.add(ring, crossA, crossB);
  world.add(targetRing);
}

function buildClaw() {
  trolley.position.set(pointer.x, 4.5, pointer.z);

  const carriage = box(0.82, 0.24, 0.68, materials.metal, 0, 0, 0);
  const motorRail = box(0.38, 0.18, 0.82, materials.yellow, 0, -0.22, 0);
  trolley.add(carriage, motorRail);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 14), materials.metal);
  cable.name = "cable";
  cable.position.y = -0.55;
  cable.castShadow = true;
  trolley.add(cable);

  clawHead.position.y = -1.08;

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.38, 32), materials.yellow);
  motor.rotation.x = Math.PI / 2;
  motor.castShadow = true;
  motor.receiveShadow = true;
  const lowerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.12, 36), materials.metal);
  lowerPlate.position.y = -0.26;
  lowerPlate.castShadow = true;
  lowerPlate.receiveShadow = true;
  const centerBolt = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), materials.rubber);
  centerBolt.position.y = -0.34;
  centerBolt.castShadow = true;
  clawHead.add(motor, lowerPlate, centerBolt);

  for (let i = 0; i < 3; i += 1) {
    const arm = new THREE.Group();
    const angle = (i / 3) * Math.PI * 2;
    arm.rotation.y = angle;
    arm.userData.angle = angle;

    const hingeBase = box(0.22, 0.14, 0.24, materials.yellow, 0, -0.28, 0.34);
    const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 18), materials.metal);
    hingePin.position.set(0, -0.28, 0.34);
    hingePin.rotation.z = Math.PI / 2;
    hingePin.castShadow = true;

    const finger = makeClawFinger();
    finger.name = "finger";
    finger.position.set(0, -0.28, 0.34);
    finger.rotation.x = -0.18;
    finger.userData.openAngle = -0.2;
    finger.userData.closedAngle = 0.2;

    arm.add(hingeBase, hingePin, finger);
    clawHead.add(arm);
    clawArms.push(arm);

    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(0.22),
    });
    body.collisionResponse = false;
    physics.addBody(body);
    clawBodies.push(body);
  }

  trolley.add(clawHead);
  world.add(trolley);
}

function makeClawFinger() {
  const finger = new THREE.Group();
  const sideOffset = 0.055;
  const upperStart = new THREE.Vector3(0, 0, 0);
  const upperEnd = new THREE.Vector3(0, -0.46, 0.38);
  const lowerEnd = new THREE.Vector3(0, -0.92, 0.24);

  [-sideOffset, sideOffset].forEach((x) => {
    const start = upperStart.clone();
    const elbow = upperEnd.clone();
    const tip = lowerEnd.clone();
    start.x = x;
    elbow.x = x;
    tip.x = x;
    finger.add(cylinderBetween(start, elbow, 0.028, materials.metal, 12));
    finger.add(cylinderBetween(elbow, tip, 0.032, materials.metal, 12));
  });

  const elbowPin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 18), materials.yellow);
  elbowPin.position.copy(upperEnd);
  elbowPin.rotation.z = Math.PI / 2;
  elbowPin.castShadow = true;
  elbowPin.receiveShadow = true;

  const hookCurve = new THREE.CatmullRomCurve3([
    lowerEnd.clone(),
    new THREE.Vector3(0, -1.03, 0.14),
    new THREE.Vector3(0, -1.0, -0.04),
  ]);
  const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 18, 0.04, 12, false), materials.metal);
  hook.castShadow = true;
  hook.receiveShadow = true;

  const rubberTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), materials.rubber);
  rubberTip.position.set(0, -1, -0.06);
  rubberTip.scale.set(1, 0.72, 1.25);
  rubberTip.castShadow = true;
  rubberTip.receiveShadow = true;

  const innerPad = box(0.12, 0.22, 0.045, materials.rubber, 0, -0.78, 0.18);
  innerPad.rotation.x = 0.35;

  finger.add(elbowPin, hook, rubberTip, innerPad);
  return finger;
}

function cylinderBetween(start, end, radius, material, radialSegments = 16) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments),
    material,
  );
  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function spawnPrizes() {
  releaseActivePrize();
  prizes.forEach(({ mesh, body }) => {
    world.remove(mesh);
    physics.removeBody(body);
  });
  prizes.length = 0;
  activePrize = null;

  const colors = [0xef4444, 0x38bdf8, 0xa3e635, 0xf97316, 0xf9a8d4, 0x8b5cf6, 0x14b8a6, 0xfacc15, 0xe2e8f0];
  createPrizePileLayout().forEach((placement, i) => {
    const prize = createPrize(i % 4, colors[i % colors.length], i);
    prize.mesh.position.set(placement.x, placement.y, placement.z);
    prize.body.position.set(placement.x, placement.y, placement.z);
    prize.body.quaternion.setFromEuler(placement.rx, placement.ry, placement.rz);
    prize.mesh.quaternion.set(
      prize.body.quaternion.x,
      prize.body.quaternion.y,
      prize.body.quaternion.z,
      prize.body.quaternion.w,
    );
    prizes.push(prize);
    world.add(prize.mesh);
    physics.addBody(prize.body);
  });
}

function createPrizePileLayout() {
  const rows = [
    { count: 7, xStart: -2.38, z: -0.54, y: 0.53, spacing: 0.78 },
    { count: 7, xStart: -2.52, z: 0.1, y: 0.53, spacing: 0.78 },
    { count: 6, xStart: -2.08, z: 0.74, y: 0.54, spacing: 0.82 },
    { count: 5, xStart: -1.65, z: 1.36, y: 0.54, spacing: 0.83 },
    { count: 3, xStart: -0.82, z: 0.42, y: 0.76, spacing: 0.82 },
  ];
  const layout = [];
  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < row.count; col += 1) {
      const seed = rowIndex * 31 + col * 7;
      const x = row.xStart + col * row.spacing + seededNoise(seed) * 0.06;
      const z = row.z + seededNoise(seed + 2) * 0.08;
      const isTopLayer = row.y > 0.8;
      layout.push({
        x,
        y: row.y + seededNoise(seed + 4) * (isTopLayer ? 0.025 : 0.012),
        z,
        rx: seededNoise(seed + 8) * (isTopLayer ? 0.14 : 0.055),
        ry: seededNoise(seed + 11) * 0.34,
        rz: seededNoise(seed + 14) * (isTopLayer ? 0.18 : 0.08),
      });
    }
  });
  return layout;
}

function createPrize(type, color, seed) {
  const group = new THREE.Group();
  const width = 0.38;
  const height = 0.58;
  const depth = 0.22;
  const faceMaterials = getFigureBoxFaceMaterials();
  const windowMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdff7ff,
    transparent: true,
    opacity: 0.34,
    roughness: 0.03,
    metalness: 0,
    transmission: 0.24,
    thickness: 0.08,
    depthWrite: false,
  });

  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    faceMaterials,
  );
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;

  const frontWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.58, height * 0.42),
    windowMaterial,
  );
  frontWindow.position.set(0, -0.01, depth / 2 + 0.004);
  frontWindow.castShadow = false;
  frontWindow.receiveShadow = false;

  const figureSilhouette = createFigureSilhouette(seed, type);
  figureSilhouette.position.set(0, -0.02, depth / 2 + 0.001);

  const hanger = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.58, 0.08, depth * 0.74),
    faceMaterials[2],
  );
  hanger.position.y = height / 2 + 0.04;
  hanger.castShadow = true;
  hanger.receiveShadow = true;

  const hangHole = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.009, 8, 24),
    materials.blackPlastic,
  );
  hangHole.position.set(0, height / 2 + 0.044, depth / 2 + 0.004);
  hangHole.scale.set(1.7, 0.75, 1);
  hangHole.castShadow = true;

  const priceSticker = createPriceSticker(seed);
  priceSticker.position.set(width * 0.27, -height * 0.36, depth / 2 + 0.006);

  group.add(boxMesh, figureSilhouette, frontWindow, hanger, hangHole, priceSticker);

  group.children.forEach((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });

  const body = new CANNON.Body({
    mass: 0.82 + pseudoRandom(seed + 13) * 0.38,
    position: new CANNON.Vec3(0, 1, 0),
    material: physicsMaterials.prize,
    linearDamping: 0.35,
    angularDamping: 0.45,
    allowSleep: true,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.7,
  });
  body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
  body.addShape(
    new CANNON.Box(new CANNON.Vec3((width * 0.58) / 2, 0.04, (depth * 0.74) / 2)),
    new CANNON.Vec3(0, height / 2 + 0.04, 0),
  );
  body.userData = { caught: false, originalMass: body.mass };
  return { mesh: group, body, radius: 0.34 };
}

function getFigureBoxFaceMaterials() {
  if (figureBoxFaceMaterials) return figureBoxFaceMaterials;

  const faceUrls = {
    right: boxRightUrl,
    left: boxLeftUrl,
    top: boxTopUrl,
    bottom: boxBottomUrl,
    front: boxFrontUrl,
    back: boxBackUrl,
  };
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const makeMaterial = (url) => {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.02,
    });
  };

  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z.
  figureBoxFaceMaterials = [
    makeMaterial(faceUrls.right),
    makeMaterial(faceUrls.left),
    makeMaterial(faceUrls.top),
    makeMaterial(faceUrls.bottom),
    makeMaterial(faceUrls.front),
    makeMaterial(faceUrls.back),
  ];
  return figureBoxFaceMaterials;
}

function createFigureBoxMaterial(color, type, seed) {
  const texture = createFigureBoxCoverTexture(color, type, seed);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.02,
  });
}

function createFigureBoxSideMaterial(color, seed) {
  const base = new THREE.Color(color);
  const sideColor = base.clone().lerp(new THREE.Color(0xffffff), 0.18);
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const ctx = textureCanvas.getContext("2d");
  ctx.fillStyle = `#${sideColor.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = -256; y < 256; y += 42) {
    ctx.save();
    ctx.translate(0, y);
    ctx.rotate(-0.55);
    ctx.fillRect(-20, 0, 360, 12);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(17,24,39,0.14)";
  ctx.font = "900 34px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`#${String(seed + 1).padStart(2, "0")}`, 128, 144);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.03,
  });
}

function createFigureBoxCoverTexture(color, type, seed) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 768;
  const ctx = textureCanvas.getContext("2d");
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const dark = base.clone().lerp(new THREE.Color(0x111827), 0.35);
  const accent = paletteAccent(seed);
  const title = figureTitle(type, seed);
  const number = String(seed + 1).padStart(2, "0");

  const gradient = ctx.createLinearGradient(0, 0, 512, 768);
  gradient.addColorStop(0, `#${light.getHexString()}`);
  gradient.addColorStop(0.55, `#${base.getHexString()}`);
  gradient.addColorStop(1, `#${dark.getHexString()}`);
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, 512, 768, 24);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 18;
  for (let x = -680; x < 620; x += 92) {
    ctx.beginPath();
    ctx.moveTo(x, 820);
    ctx.lineTo(x + 740, -40);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  roundRect(ctx, 42, 72, 428, 558, 28);
  ctx.fill();

  ctx.fillStyle = "rgba(7,17,29,0.9)";
  roundRect(ctx, 64, 96, 384, 56, 18);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = "900 34px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FIGURE BOX", 256, 124);

  ctx.fillStyle = "#111827";
  ctx.font = "900 58px Segoe UI, Arial";
  ctx.fillText(title, 256, 682);

  ctx.fillStyle = `#${dark.getHexString()}`;
  roundRect(ctx, 54, 646, 96, 64, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Segoe UI, Arial";
  ctx.fillText(`#${number}`, 102, 678);

  drawCoverCharacter(ctx, type, seed, accent);

  ctx.strokeStyle = "rgba(17,24,39,0.22)";
  ctx.lineWidth = 8;
  roundRect(ctx, 42, 72, 428, 558, 28);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(312, 92);
  ctx.lineTo(448, 92);
  ctx.lineTo(210, 620);
  ctx.lineTo(122, 620);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function drawCoverCharacter(ctx, type, seed, accent) {
  const cx = 256;
  const cy = 352;
  const suit = type === 0 ? "#111827" : type === 1 ? "#334155" : type === 2 ? "#5b21b6" : "#0f766e";
  const skin = ["#ffe0bd", "#ffd1dc", "#fde68a", "#dbeafe"][type % 4];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.22;
  drawStar(ctx, -136, -150, 34);
  drawStar(ctx, 124, -122, 24);
  drawStar(ctx, 150, 112, 30);
  ctx.globalAlpha = 1;

  ctx.fillStyle = suit;
  roundRect(ctx, -78, 46, 156, 144, 34);
  ctx.fill();

  ctx.fillStyle = accent;
  roundRect(ctx, -48, 74, 96, 30, 10);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -54, 78, 86, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  if (type === 0) {
    ctx.arc(0, -108, 78, Math.PI, Math.PI * 2);
    ctx.rect(-78, -108, 156, 38);
  } else if (type === 1) {
    ctx.ellipse(0, -118, 88, 42, 0, 0, Math.PI * 2);
    ctx.rect(-70, -120, 140, 42);
  } else if (type === 2) {
    ctx.moveTo(-78, -78);
    ctx.quadraticCurveTo(0, -166, 78, -78);
    ctx.lineTo(54, -36);
    ctx.quadraticCurveTo(0, -78, -54, -36);
    ctx.closePath();
  } else {
    ctx.arc(-36, -110, 34, 0, Math.PI * 2);
    ctx.arc(36, -110, 34, 0, Math.PI * 2);
    ctx.rect(-72, -114, 144, 58);
  }
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(-28, -56, 8, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(28, -56, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -26, 22, 0.14 * Math.PI, 0.86 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = suit;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(-78, 90);
  ctx.lineTo(-132, 136);
  ctx.moveTo(78, 90);
  ctx.lineTo(132, 136);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = "900 28px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(figureSeries(seed), 0, 234);
  ctx.restore();
}

function createFigureSilhouette(seed, type) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 320;
  const ctx = textureCanvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 320);
  ctx.save();
  ctx.translate(128, 158);
  drawMiniFigure(ctx, type, seed);
  ctx.restore();
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.28), material);
}

function drawMiniFigure(ctx, type, seed) {
  const suit = type === 0 ? "#1f2937" : type === 1 ? "#0e7490" : type === 2 ? "#7c3aed" : "#047857";
  const skin = "#fde7c8";
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 108, 54, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit;
  roundRect(ctx, -42, 10, 84, 96, 24);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -48, 48, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(0, -82, 48, Math.PI, Math.PI * 2);
  ctx.rect(-48, -84, 96, 26);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(-17, -48, 5, 0, Math.PI * 2);
  ctx.arc(17, -48, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -28, 12, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

function createPriceSticker(seed) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 96;
  const ctx = textureCanvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 96);
  ctx.fillStyle = "#facc15";
  roundRect(ctx, 8, 18, 112, 60, 14);
  ctx.fill();
  ctx.strokeStyle = "#231200";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#231200";
  ctx.font = "900 24px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RARE", 64, 48);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.065),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
}

function figureTitle(type, seed) {
  const titles = ["NOVA", "MOKO", "RINA", "KAI", "LUNA", "TOBI"];
  return titles[(type + seed) % titles.length];
}

function figureSeries(seed) {
  const series = ["CITY HERO", "DREAM POP", "MECHA MINI", "STAR CLUB"];
  return series[seed % series.length];
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createPlushMaterial(color, type, seed) {
  const texture = createPlushTexture(color, type, seed);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(type === 2 ? 1.2 : 1.6, type === 2 ? 1.2 : 1.05);

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 0.86,
    metalness: 0.02,
  });
}

function createPlushTexture(color, type, seed) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 512;
  const ctx = textureCanvas.getContext("2d");
  const base = new THREE.Color(color);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.28);
  const dark = base.clone().lerp(new THREE.Color(0x111827), 0.22);
  const accent = paletteAccent(seed);

  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, `#${light.getHexString()}`);
  gradient.addColorStop(0.58, `#${base.getHexString()}`);
  gradient.addColorStop(1, `#${dark.getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let y = -40; y < 560; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y + seededNoise(seed + y) * 8);
    for (let x = 0; x <= 512; x += 32) {
      ctx.lineTo(x, y + Math.sin((x + seed * 17) * 0.035) * 5);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (type === 0) {
    drawPolkaDots(ctx, seed, accent);
  } else if (type === 1) {
    drawDiagonalStripes(ctx, accent);
  } else if (type === 2) {
    drawGiftPattern(ctx, accent);
  } else {
    drawStarPattern(ctx, seed, accent);
  }

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 900; i += 1) {
    const n = pseudoRandom(seed * 97 + i * 11);
    const x = pseudoRandom(seed * 31 + i * 7) * 512;
    const y = pseudoRandom(seed * 43 + i * 5) * 512;
    ctx.fillStyle = n > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(textureCanvas);
}

function createFaceDecal(seed, width, height) {
  const texture = createFaceTexture(seed);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  face.castShadow = false;
  face.receiveShadow = false;
  return face;
}

function createFaceTexture(seed) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 192;
  const ctx = textureCanvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 192);

  const eyeY = 78 + seededNoise(seed + 4) * 4;
  const mouthY = 116 + seededNoise(seed + 6) * 4;
  const eyeGap = 48 + seededNoise(seed + 8) * 4;

  ctx.fillStyle = "rgba(255, 168, 188, 0.82)";
  ctx.beginPath();
  ctx.ellipse(83, 104, 18, 9, -0.08, 0, Math.PI * 2);
  ctx.ellipse(173, 104, 18, 9, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.ellipse(128 - eyeGap, eyeY, 9, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(128 + eyeGap, eyeY, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(124 - eyeGap, eyeY - 5, 3, 0, Math.PI * 2);
  ctx.arc(124 + eyeGap, eyeY - 5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (seed % 3 === 0) {
    ctx.arc(128, mouthY, 14, 0.12 * Math.PI, 0.88 * Math.PI);
  } else if (seed % 3 === 1) {
    ctx.moveTo(116, mouthY);
    ctx.quadraticCurveTo(128, mouthY + 14, 140, mouthY);
  } else {
    ctx.moveTo(118, mouthY);
    ctx.lineTo(138, mouthY);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(17, 24, 39, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(91, 58);
  ctx.quadraticCurveTo(101, 50, 112, 58);
  ctx.moveTo(144, 58);
  ctx.quadraticCurveTo(155, 50, 166, 58);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function drawPolkaDots(ctx, seed, accent) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.36;
  for (let y = 28; y < 512; y += 74) {
    for (let x = 28; x < 512; x += 74) {
      const ox = seededNoise(seed + x + y) * 8;
      ctx.beginPath();
      ctx.arc(x + ox, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDiagonalStripes(ctx, accent) {
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 18;
  for (let x = -520; x < 620; x += 74) {
    ctx.beginPath();
    ctx.moveTo(x, 540);
    ctx.lineTo(x + 540, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGiftPattern(ctx, accent) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.38;
  for (let y = 0; y < 512; y += 96) {
    ctx.fillRect(0, y + 40, 512, 16);
  }
  for (let x = 0; x < 512; x += 96) {
    ctx.fillRect(x + 40, 0, 16, 512);
  }
  ctx.globalAlpha = 1;
}

function drawStarPattern(ctx, seed, accent) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 26; i += 1) {
    const x = pseudoRandom(seed * 19 + i * 5) * 512;
    const y = pseudoRandom(seed * 23 + i * 7) * 512;
    drawStar(ctx, x, y, 10 + pseudoRandom(seed + i) * 8);
  }
  ctx.globalAlpha = 1;
}

function drawStar(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function paletteAccent(seed) {
  const accents = ["#ffffff", "#ffe4e6", "#fef3c7", "#d9f99d", "#bae6fd", "#ddd6fe"];
  return accents[Math.floor(pseudoRandom(seed + 101) * accents.length)];
}

function bindControls() {
  new Map([
    ["forward", "forward"],
    ["back", "back"],
    ["left", "left"],
    ["right", "right"],
  ]).forEach((direction, id) => {
    const button = document.querySelector(`#${id}`);
    const press = (event) => {
      event.preventDefault();
      heldButtons.add(direction);
    };
    const release = () => heldButtons.delete(direction);
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
  });

  dropButton.addEventListener("click", startDrop);
  resetButton.addEventListener("click", () => {
    score = 0;
    plays = 8;
    pointer.x = 0.55;
    pointer.z = 1.05;
    setState("ready", "移动爪子");
    spawnPrizes();
    updateHud();
  });
  strengthInput.addEventListener("input", () => {
    strengthValue.textContent = `${strengthInput.value}%`;
  });

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    heldKeys.add(event.key.toLowerCase());
    if (event.key === " " && state === "ready") startDrop();
    if (event.key.toLowerCase() === "r") resetButton.click();
  });
  window.addEventListener("keyup", (event) => heldKeys.delete(event.key.toLowerCase()));
}

function startDrop() {
  if (state !== "ready" || plays <= 0) return;
  plays -= 1;
  phaseTime = 0;
  activePrize = null;
  releaseActivePrize();
  setState("dropping", "下降中");
  updateHud();
}

function update(delta) {
  const fixed = 1 / 90;
  if (state === "ready") movePointer(delta);

  trolley.position.x = lerp(trolley.position.x, pointer.x, 0.22);
  trolley.position.z = lerp(trolley.position.z, pointer.z, 0.22);
  targetRing.position.set(pointer.x, 0, pointer.z);
  targetRing.visible = state === "ready";

  phaseTime += delta;
  updateStateMachine(delta);
  syncClawBodies(delta);
  stabilizeClawPrizeContacts();
  applyCarryForces(delta);
  physics.step(fixed, delta, 8);
  stabilizeCarriedPrize(delta);
  syncMeshes();
  updateClawVisual(delta);
  updateCamera(delta);
}

function movePointer(delta) {
  const speed = 2.6 * delta;
  if (heldKeys.has("arrowleft") || heldKeys.has("a") || heldButtons.has("left")) pointer.x += speed;
  if (heldKeys.has("arrowright") || heldKeys.has("d") || heldButtons.has("right")) pointer.x -= speed;
  if (heldKeys.has("arrowup") || heldKeys.has("w") || heldButtons.has("forward")) pointer.z += speed;
  if (heldKeys.has("arrowdown") || heldKeys.has("s") || heldButtons.has("back")) pointer.z -= speed;
  pointer.x = clamp(pointer.x, bounds.xMin, bounds.xMax);
  pointer.z = clamp(pointer.z, bounds.zMin, bounds.zMax);
}

function updateStateMachine(delta) {
  const highOffset = -1.08;
  const lowOffset = highOffset - (clawHomeY - clawLowY);

  if (state === "dropping") {
    const t = clamp(phaseTime / 1.55, 0, 1);
    clawHead.position.y = lerp(highOffset, lowOffset, easeInOut(t));
    if (t >= 1) {
      phaseTime = 0;
      tryAttachPrize();
      setState("grabbing", activePrize ? "夹住奖品" : "推开了");
    }
  } else if (state === "grabbing") {
    squeezeNearbyPrizes(delta);
    if (phaseTime > 0.55) {
      phaseTime = 0;
      setState("lifting", activePrize ? "带起奖品" : "空抓返回");
    }
  } else if (state === "lifting") {
    const t = clamp(phaseTime / 1.12, 0, 1);
    clawHead.position.y = lerp(lowOffset, highOffset, easeInOut(t));
    if (t >= 1) {
      phaseTime = 0;
      setState("returning", "送往出口");
    }
  } else if (state === "returning") {
    const target = chute;
    pointer.x = lerp(pointer.x, target.x, 0.035);
    pointer.z = lerp(pointer.z, target.z, 0.035);
    if (Math.hypot(pointer.x - target.x, pointer.z - target.z) < 0.08) {
      phaseTime = 0;
      if (activePrize) {
        releaseActivePrize(false);
        activePrize.body.velocity.set(0, -1.35, -0.55);
        activePrize.body.angularVelocity.set(0.16, 0.22, 0.08);
        setState("releasing", "释放奖品");
      } else {
        setState("releasing", "空爪释放");
      }
    }
  } else if (state === "releasing") {
    if (activePrize) {
      guidePrizeThroughOutlet(activePrize.body);
    }

    if (activePrize && isPrizeInCollectionTray(activePrize.body)) {
      collectActivePrize();
    } else if (!activePrize && phaseTime > 0.65) {
      setState(plays > 0 ? "ready" : "over", plays > 0 ? "移动爪子" : "次数用完");
      updateHud();
    } else if (phaseTime > 3.2) {
      activePrize = null;
      setState(plays > 0 ? "ready" : "over", plays > 0 ? "移动爪子" : "次数用完");
      updateHud();
    }
  } else if (state === "over") {
    clawHead.position.y = lerp(clawHead.position.y, -1.08, 0.08);
  }
}

function tryAttachPrize() {
  const strength = Number(strengthInput.value) / 100;
  const clawCenter = new CANNON.Vec3(trolley.position.x, clawLowY - 0.78, trolley.position.z);
  const candidates = prizes
    .filter((prize) => !prize.body.userData.caught)
    .map((prize) => ({
      prize,
      dist: prize.body.position.distanceTo(clawCenter),
    }))
    .filter((entry) => entry.dist < 0.82)
    .sort((a, b) => a.dist - b.dist);

  if (!candidates.length) return;
  const best = candidates[0];
  const centerBonus = clamp(1 - best.dist / 0.82, 0, 1);
  const massPenalty = best.prize.body.mass * 0.16;
  const chance = clamp(0.1 + strength * 0.72 + centerBonus * 0.3 - massPenalty, 0.06, 0.92);
  const roll = pseudoRandom(score * 17 + plays * 31 + Math.round(pointer.x * 100) + Math.round(pointer.z * 100));
  const caught = roll <= chance;

  candidates.forEach(({ prize }) => {
    if (caught && prize === best.prize) return;
    const away = prize.body.position.vsub(clawCenter);
    away.y = 0;
    if (away.lengthSquared() <= 0.001) return;
    away.normalize();
    prize.body.velocity.vadd(away.scale(0.12), prize.body.velocity);
    clampVec3Length(prize.body.velocity, 1.25);
    prize.body.angularVelocity.scale(0.72, prize.body.angularVelocity);
    prize.body.wakeUp();
  });

  if (!caught) return;

  activePrize = best.prize;
  prepareActivePrizeForCarry(activePrize);
}

function guidePrizeThroughOutlet(body) {
  if (body.position.y > 1.1 || body.position.z < -2.72) return;
  const target = new CANNON.Vec3(chute.x, 0.44, -2.52);
  const pull = target.vsub(body.position);
  pull.y = 0;
  if (pull.lengthSquared() > 0.001) {
    pull.normalize();
    body.applyForce(pull.scale(5.5), body.position);
  }
  body.applyForce(new CANNON.Vec3(0, -1.8, -4.8), body.position);
}

function isPrizeInCollectionTray(body) {
  return (
    Math.abs(body.position.x - chute.x) < 0.72 &&
    body.position.z < -2.58 &&
    body.position.z > -3.24 &&
    body.position.y < 0.62
  );
}

function collectActivePrize() {
  if (!activePrize || activePrize.body.userData.scored) return;
  score += 1;
  activePrize.body.userData.caught = true;
  activePrize.body.userData.scored = true;
  activePrize.body.linearDamping = 0.58;
  activePrize.body.angularDamping = 0.72;
  activePrize = null;
  setState(plays > 0 ? "ready" : "over", plays > 0 ? "移动爪子" : "次数用完");
  updateHud();
}

function squeezeNearbyPrizes(delta) {
  const center = new CANNON.Vec3(trolley.position.x, clawLowY - 0.78, trolley.position.z);
  prizes.forEach((prize) => {
    if (prize.body.userData.caught || prize.body.userData.carrying || prize === activePrize) return;
    const offset = prize.body.position.vsub(center);
    offset.y = 0;
    const dist = offset.length();
    if (dist > 0.86 || dist < 0.001) return;
    offset.normalize();
    const inward = offset.scale(-0.8 * delta);
    const upward = new CANNON.Vec3(0, 0.8 * delta, 0);
    prize.body.applyImpulse(inward.vadd(upward), prize.body.position);
    prize.body.wakeUp();
  });
}

function releaseActivePrize(clearReference = true) {
  if (activePrize) {
    activePrize.body.collisionResponse = true;
    activePrize.body.userData.carrying = false;
    activePrize.body.type = CANNON.Body.DYNAMIC;
    activePrize.body.mass = activePrize.body.userData.originalMass ?? 1;
    activePrize.body.updateMassProperties();
    activePrize.body.linearDamping = 0.35;
    activePrize.body.angularDamping = 0.45;
    activePrize.body.wakeUp();
  }
  if (clearReference) activePrize = null;
}

function prepareActivePrizeForCarry(prize) {
  prize.body.wakeUp();
  prize.body.collisionResponse = false;
  prize.body.userData.carrying = true;
  prize.body.userData.originalMass = prize.body.userData.originalMass ?? prize.body.mass;
  prize.body.userData.carryQuaternion = new CANNON.Quaternion(
    prize.body.quaternion.x,
    prize.body.quaternion.y,
    prize.body.quaternion.z,
    prize.body.quaternion.w,
  );
  prize.body.userData.carryYOffset = clamp(
    prize.body.position.y - pickupBody.position.y,
    -0.72,
    -0.56,
  );
  prize.body.type = CANNON.Body.KINEMATIC;
  prize.body.mass = 0;
  prize.body.updateMassProperties();
  prize.body.linearDamping = 0.86;
  prize.body.angularDamping = 0.98;
  prize.body.velocity.set(0, 0, 0);
  prize.body.angularVelocity.set(0, 0, 0);
}

function applyCarryForces(delta) {
  if (!activePrize || state === "releasing") return;

  const target = getCarryTarget();
  setCarriedPrizePose(activePrize.body, target, state === "grabbing" ? 0.52 : 0.78, delta, 1.65);
}

function stabilizeCarriedPrize(delta) {
  if (!activePrize || state === "releasing") return;

  const body = activePrize.body;
  const target = getCarryTarget();
  const offset = target.vsub(body.position);
  const distance = offset.length();
  setCarriedPrizePose(body, target, distance > 0.12 ? 0.9 : 0.62, delta, 1.15);
}

function setCarriedPrizePose(body, target, follow, delta, maxSpeed) {
  const previous = body.position.clone();
  body.position.x = lerp(body.position.x, target.x, follow);
  body.position.y = lerp(body.position.y, target.y, follow);
  body.position.z = lerp(body.position.z, target.z, follow);
  body.velocity.set(
    (body.position.x - previous.x) / Math.max(delta, 1 / 120),
    (body.position.y - previous.y) / Math.max(delta, 1 / 120),
    (body.position.z - previous.z) / Math.max(delta, 1 / 120),
  );
  clampVec3Length(body.velocity, maxSpeed);

  const carryQuaternion = body.userData.carryQuaternion;
  if (carryQuaternion) body.quaternion.copy(carryQuaternion);
  body.angularVelocity.set(0, 0, 0);
}

function getCarryTarget() {
  const yOffset = activePrize?.body.userData.carryYOffset ?? -0.66;
  return new CANNON.Vec3(
    pickupBody.position.x,
    pickupBody.position.y + yOffset,
    pickupBody.position.z,
  );
}

function syncClawBodies(delta) {
  const headWorld = new THREE.Vector3();
  clawHead.getWorldPosition(headWorld);
  moveKinematicBody(pickupBody, headWorld.x, headWorld.y - 0.22, headWorld.z, delta);
  pickupBody.quaternion.set(0, 0, 0, 1);

  clawBodies.forEach((body, index) => {
    const angle = (index / 3) * Math.PI * 2 + clawHead.rotation.y;
    const isClosed = state === "grabbing" || state === "lifting" || state === "returning";
    const close = isClosed ? (activePrize ? 0.36 : 0.3) : 0.54;
    const y = headWorld.y - 0.9;
    moveKinematicBody(
      body,
      headWorld.x + Math.sin(angle) * close,
      y,
      headWorld.z + Math.cos(angle) * close,
      delta,
    );
    body.quaternion.set(0, 0, 0, 1);
  });
}

function moveKinematicBody(body, x, y, z, delta) {
  const next = new CANNON.Vec3(x, y, z);
  const previous = body.userData?.previousPosition ?? body.position.clone();
  if (!body.userData) body.userData = {};
  body.velocity.set(
    (next.x - previous.x) / Math.max(delta, 1 / 120),
    (next.y - previous.y) / Math.max(delta, 1 / 120),
    (next.z - previous.z) / Math.max(delta, 1 / 120),
  );
  clampVec3Length(body.velocity, 3.8);
  body.position.copy(next);
  body.userData.previousPosition = next.clone();
}

function stabilizeClawPrizeContacts() {
  if (state !== "dropping" && state !== "grabbing") return;

  clawBodies.forEach((clawBody) => {
    prizes.forEach((prize) => {
      if (prize.body.userData.caught || prize.body.userData.carrying || prize === activePrize) return;
      const delta = prize.body.position.vsub(clawBody.position);
      const minDistance = prize.radius + 0.24;
      let distance = delta.length();
      if (distance >= minDistance) return;

      if (distance < 0.001) {
        delta.set(0, 1, 0);
        distance = 1;
      } else {
        delta.scale(1 / distance, delta);
      }

      const overlap = minDistance - distance;
      prize.body.position.vadd(delta.scale(overlap * 0.18), prize.body.position);
      const outwardSpeed = prize.body.velocity.dot(delta);
      if (outwardSpeed < 0.65) {
        prize.body.velocity.vadd(delta.scale((0.65 - outwardSpeed) * 0.08), prize.body.velocity);
      }
      clampVec3Length(prize.body.velocity, 1.65);
      clampVec3Length(prize.body.angularVelocity, 1.25);
      prize.body.wakeUp();
    });
  });
}

function clampVec3Length(vector, maxLength) {
  const length = vector.length();
  if (length <= maxLength || length === 0) return;
  vector.scale(maxLength / length, vector);
}

function syncMeshes() {
  prizes.forEach((prize) => {
    if (!prize.mesh.visible) return;
    prize.mesh.position.copy(prize.body.position);
    prize.mesh.quaternion.copy(prize.body.quaternion);
  });
}

function dampCarriedPrize(body) {
  body.velocity.x *= 0.92;
  body.velocity.z *= 0.92;
  body.angularVelocity.x *= 0.42;
  body.angularVelocity.y *= 0.42;
  body.angularVelocity.z *= 0.42;
  clampVec3Length(body.velocity, 1.9);
  clampVec3Length(body.angularVelocity, 0.9);
}

function updateClawVisual(delta) {
  const cable = trolley.getObjectByName("cable");
  const length = Math.abs(clawHead.position.y) - 0.16;
  cable.scale.y = Math.max(0.25, length);
  cable.position.y = -length / 2;

  const closeAmount =
    state === "grabbing" || state === "lifting" || state === "returning"
      ? activePrize
        ? 0.72
        : 0.92
      : 0;
  clawArms.forEach((arm, index) => {
    const finger = arm.getObjectByName("finger");
    if (finger) {
      const target = lerp(finger.userData.openAngle, finger.userData.closedAngle, closeAmount);
      finger.rotation.x = lerp(finger.rotation.x, target, 0.18);
    }
    arm.rotation.z = Math.sin(clock.elapsedTime * 2.2 + index) * 0.015;
  });
  trolley.rotation.y = Math.sin(clock.elapsedTime * 1.3) * 0.015;
  clawHead.rotation.y += delta * (state === "ready" ? 0.18 : 0.42);
}

function updateCamera(delta) {
  const isMobileView = window.innerWidth <= 760;
  if (cameraFollowInput.checked) {
    cameraYaw = lerp(cameraYaw, pointer.x * (isMobileView ? 0.03 : 0.045), 0.05);
  } else {
    cameraYaw += delta * 0.08;
  }
  const radius = isMobileView ? 9.35 : 8.15;
  const baseAngle = Math.PI + (isMobileView ? 0.44 : 0.56) + cameraYaw;
  const cameraHeight = isMobileView ? 5.2 : 4.55;
  camera.position.set(Math.sin(baseAngle) * radius, cameraHeight, Math.cos(baseAngle) * radius);

  const targetX = isMobileView ? lerp(-1.2, pointer.x * 0.2, 0.45) : pointer.x * 0.24;
  const targetY = isMobileView ? 1.25 : 1.68;
  const targetZ = isMobileView ? lerp(-1.0, pointer.z * 0.18, 0.35) : pointer.z * 0.22;
  camera.lookAt(targetX, targetY, targetZ);
}

function animate() {
  requestAnimationFrame(animate);
  update(Math.min(clock.getDelta(), 0.033));
  renderer.render(scene, camera);
}

function addStaticBox(width, height, depth, x, y, z, rotationX = 0, rotationY = 0, rotationZ = 0, material = physicsMaterials.cabinet) {
  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
    position: new CANNON.Vec3(x, y, z),
    material,
  });
  body.quaternion.setFromEuler(rotationX, rotationY, rotationZ);
  staticBodies.push(body);
  physics.addBody(body);
}

function updateHud(updateStatus = true) {
  scoreEl.textContent = String(score);
  playsEl.textContent = String(plays);
  if (updateStatus) {
    statusEl.textContent = getStatusLabel();
  }
  dropButton.disabled = state !== "ready" || plays <= 0;
  document.querySelectorAll(".dpad button").forEach((button) => {
    button.disabled = state !== "ready";
  });
}

function getStatusLabel() {
  const map = {
    ready: "移动爪子",
    dropping: "下降中",
    grabbing: activePrize ? "夹住奖品" : "空抓",
    lifting: activePrize ? "带起奖品" : "空爪上升",
    returning: "送往出口",
    releasing: activePrize ? "释放奖品" : "空爪释放",
    over: "次数用完",
  };
  return map[state] ?? "进行中";
}

function setState(nextState, label) {
  state = nextState;
  statusEl.textContent = label;
  dropButton.disabled = state !== "ready" || plays <= 0;
  document.querySelectorAll(".dpad button").forEach((button) => {
    button.disabled = state !== "ready";
  });
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.fov = width <= 760 ? 50 : 42;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function box(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeLabelTexture(text) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 1024;
  textureCanvas.height = 192;
  const ctx = textureCanvas.getContext("2d");
  ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  ctx.fillStyle = "#231200";
  ctx.font = "900 96px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, textureCanvas.width / 2, textureCanvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSmallLabelTexture(text) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 128;
  const ctx = textureCanvas.getContext("2d");
  ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  ctx.fillStyle = "#231200";
  ctx.font = "900 54px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, textureCanvas.width / 2, textureCanvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function seededNoise(seed) {
  return pseudoRandom(seed) * 2 - 1;
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
