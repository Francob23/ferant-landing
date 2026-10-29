import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import LOGO from './ferant-logo-shape.js';

const container = document.getElementById('heroLogo3d');

const supportsWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
};

if (container && supportsWebGL()) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 5, 2);
  const rim = new THREE.DirectionalLight(0xebe717, 2.4);
  rim.position.set(-4, 1, -3);
  scene.add(key, rim);

  const toShapes = list => list.map(({ o, h }) => {
    const shape = new THREE.Shape(o.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = h.map(pts => new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  });

  const BLOCK_DEPTH = 0.36;
  const LETTER_DEPTH = BLOCK_DEPTH + 0.14;

  const blockGeo = new THREE.ExtrudeGeometry(toShapes(LOGO.block), {
    depth: BLOCK_DEPTH, curveSegments: 1,
    bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.025, bevelSegments: 4,
  });
  blockGeo.translate(0, 0, -BLOCK_DEPTH / 2);

  // Letters fill the block's holes and stand proud on both faces.
  const letterGeo = new THREE.ExtrudeGeometry(toShapes(LOGO.letters), {
    depth: LETTER_DEPTH, curveSegments: 1,
    bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.01, bevelSegments: 3,
  });
  letterGeo.translate(0, 0, -LETTER_DEPTH / 2);

  const blockMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8e226, roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.15,
  });
  const letterMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.25, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1,
  });

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(new THREE.Mesh(blockGeo, blockMat), new THREE.Mesh(letterGeo, letterMat));
  tilt.add(spin);
  scene.add(tilt);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  container.appendChild(renderer.domElement);
  resize();
  container.classList.add('is-3d');

  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Each cycle: one full eased turn, then a calm hold facing front with a gentle sway.
  const CYCLE = 7;
  const SPIN = 1.8;
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let running = false;
  let visible = true;
  let rafId = 0;
  let startedAt = 0;

  const frame = () => {
    if (!running) return;
    const t = (performance.now() - startedAt) / 1000;
    const c = t % CYCLE;

    const turn = c < SPIN ? easeInOutCubic(c / SPIN) * Math.PI * 2 : 0;
    const settle = c < SPIN ? 0 : Math.min((c - SPIN) / 0.8, 1);
    spin.rotation.y = turn + Math.sin(t * 0.9) * 0.28 * settle;
    spin.rotation.x = -0.12 + Math.sin(t * 0.7) * 0.06;
    spin.position.y = Math.sin(t * 1.3) * 0.06;

    tilt.rotation.y += (pointer.x * 0.35 - tilt.rotation.y) * 0.06;
    tilt.rotation.x += (pointer.y * 0.25 - tilt.rotation.x) * 0.06;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || reducedMotion || !visible || document.hidden) return;
    running = true;
    startedAt = performance.now();
    rafId = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  if (reducedMotion) {
    spin.rotation.set(-0.15, 0.4, 0);
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(container);

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  window.addEventListener('resize', () => {
    resize();
    if (!running) renderer.render(scene, camera);
  }, { passive: true });

  start();
}
