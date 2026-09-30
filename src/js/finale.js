import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
 
// ---------- 1. PERSONALIZA AQUÍ ----------
const MESSAGES = [
  'Mi lugar favorito eres tú ✨♥️',
  'Contigo todo es más bonito 🌙💖',
  'Eres mi casualidad más bonita 💫♥️',
  'Mi persona favorita, siempre tú 🥰✨',
  'Contigo hasta el caos tiene sentido ♥️',
  'Eres mi calma en medio del ruido 🌷✨',
  'Te elegiría en todas mis vidas 💞',
];
const TEXT_COUNT = 150;  // cuántos mensajes flotan en el espacio
const CAR_COUNT = 40;    // cuántos carros vuelan
const FONT = '"Indie Flower", "Segoe Print", cursive';
 
// Cámara y movimiento
const VIEW = {
  startDistance: 6,     // la cámara empieza DENTRO de la nube (cerca del agujero)
  endDistance: 24,      // y se aleja hasta aquí (más grande = más lejos)
  minDistance: 3.5,     // lo más cerca que se puede acercar el usuario
  maxDistance: 60,      // lo más lejos que se puede alejar el usuario
  introSeconds: 6,      // duración del alejamiento inicial
  startHeight: 0.15,    // al inicio casi de canto (0 = de canto, 1 = desde arriba)
  endHeight: 0.55,      // al final, mirando más desde arriba
  autoRotate: true,     // gira sola lentamente cuando nadie la toca
  autoRotateSpeed: 0.35,
  fieldRadius: 34,      // tamaño de la nube de mensajes y carros
  clearRadius: 6,       // espacio vacío alrededor del agujero negro (sin mensajes)
  holeSize: 1,          // tamaño del agujero negro + disco
  diskTilt: 0.12,       // inclinación del disco
};
 
// Tus imágenes de carros (PNG con fondo transparente, vistos de lado,
// mirando hacia la DERECHA) en: src/assets/images/cars/
// Si la carpeta está vacía se usan carros dibujados por código.
const carFiles = import.meta.glob('../assets/images/cars/*.{png,webp}', {
  eager: true, query: '?url', import: 'default',
});
const CAR_URLS = Object.values(carFiles);
 
// ---------- 2. ESTADO ----------
let renderer, scene, camera, controls, hole, disk, lensRing, glow, section, holder;
const floaters = [];
let visible = false;
let lastTime = performance.now();
let elapsed = 0;
let intro = { playing: false, t: 0, done: false };
let wantInteractive = false; // true cuando la sección final ocupa la pantalla
const tmpV = new THREE.Vector3();
const camRight = new THREE.Vector3();
const diskNormal = new THREE.Vector3();
 
// ---------- 3. TEXTURAS DIBUJADAS EN CANVAS ----------
function textTexture(text, px) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${px}px ${FONT}`;
  const pad = px * 0.6;
  c.width = Math.ceil(ctx.measureText(text).width + pad * 2);
  c.height = Math.ceil(px * 1.7);
  ctx.font = `${px}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(90,180,255,0.9)';
  ctx.shadowBlur = px * 0.25;
  ctx.fillStyle = '#eef6ff';
  ctx.fillText(text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}
 
// Carro genérico de respaldo (silueta deportiva de lado)
function drawnCarTexture(body, stripe) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 180;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.ellipse(256, 160, 220, 12, 0, 0, Math.PI * 2); g.fill();
  const grad = g.createLinearGradient(0, 50, 0, 150);
  grad.addColorStop(0, body[0]); grad.addColorStop(1, body[1]);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(30, 120); g.lineTo(40, 95); g.quadraticCurveTo(120, 80, 190, 72);
  g.quadraticCurveTo(250, 38, 330, 42); g.quadraticCurveTo(400, 60, 440, 82);
  g.quadraticCurveTo(495, 90, 492, 118); g.lineTo(486, 140); g.lineTo(40, 142);
  g.closePath(); g.fill();
  g.fillRect(28, 78, 40, 8); g.fillRect(48, 84, 8, 18);
  g.fillStyle = '#10141f';
  g.beginPath(); g.moveTo(210, 75); g.quadraticCurveTo(255, 48, 320, 50);
  g.quadraticCurveTo(370, 60, 395, 80); g.closePath(); g.fill();
  g.fillStyle = stripe;
  g.beginPath(); g.moveTo(120, 108); g.lineTo(470, 100); g.lineTo(468, 112); g.lineTo(118, 120); g.fill();
  g.fillStyle = '#fff6c8'; g.fillRect(476, 98, 14, 7);
  for (const x of [130, 400]) {
    g.fillStyle = '#0b0b0f'; g.beginPath(); g.arc(x, 138, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9aa3b5'; g.beginPath(); g.arc(x, 138, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2f3a'; g.beginPath(); g.arc(x, 138, 6, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: c.width / c.height };
}
 
// Copia de la textura en espejo (para los carros que van a la izquierda).
// Ojo: a los sprites no se les puede dar escala negativa, por eso usamos esto.
function mirrored(tex) {
  const t = tex.clone();
  t.repeat.x = -1;
  t.offset.x = 1;
  t.needsUpdate = true;
  return t;
}
 
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(120,200,255,0.9)');
  r.addColorStop(0.35, 'rgba(40,120,255,0.35)');
  r.addColorStop(1, 'rgba(0,20,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
 
// ---------- 4. AGUJERO NEGRO ----------
const diskVertex = /* glsl */`
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
 
// Disco de acreción: anillos concéntricos, centro blanco, borde azul
const diskFragment = /* glsl */`
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  varying vec2 vPos;
  void main() {
    float r = length(vPos);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float a = atan(vPos.y, vPos.x);
    float bands = 0.72 + 0.28 * sin(r * 38.0 - uTime * 1.6);
    float swirl = 0.85 + 0.15 * sin(a * 3.0 + r * 6.0 - uTime * 0.8);
    vec3 hot  = vec3(0.92, 0.98, 1.0);
    vec3 cyan = vec3(0.18, 0.70, 1.0);
    vec3 deep = vec3(0.05, 0.35, 1.0);
    vec3 col = mix(hot, cyan, smoothstep(0.0, 0.35, t));
    col = mix(col, deep, smoothstep(0.45, 1.0, t));
    float alpha = smoothstep(0.0, 0.04, t) * pow(1.0 - t, 1.0);
    gl_FragColor = vec4(col * bands * swirl * 1.35, alpha * uOpacity);
  }`;
 
function buildBlackHole() {
  hole = new THREE.Group();
  hole.scale.setScalar(VIEW.holeSize);
  scene.add(hole);
 
  // Halo grande (siempre de frente a la cámara)
  glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.8,
  }));
  glow.scale.set(14, 14, 1);
  hole.add(glow);
 
  // Esfera negra (tapa lo que pasa por detrás)
  hole.add(new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  ));
 
  // Disco acostado (como los anillos de Saturno)
  const inner = 1.25, outer = 4.4;
  disk = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 256, 1),
    new THREE.ShaderMaterial({
      vertexShader: diskVertex, fragmentShader: diskFragment,
      uniforms: { uTime: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer }, uOpacity: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  disk.rotation.x = -Math.PI / 2 + VIEW.diskTilt;
  hole.add(disk);
 
  // Anillo "lente": siempre mira a la cámara; brilla cuando ves el disco de canto
  lensRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.75, 256, 1),
    new THREE.ShaderMaterial({
      vertexShader: diskVertex, fragmentShader: diskFragment,
      uniforms: { uTime: { value: 0 }, uInner: { value: 1.0 }, uOuter: { value: 1.75 }, uOpacity: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  hole.add(lensRing);
}
 
// ---------- 5. ESTRELLAS (una esfera lejana alrededor de todo) ----------
function buildStars() {
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    tmpV.randomDirection().multiplyScalar(90 + Math.random() * 60);
    pos[i * 3] = tmpV.x; pos[i * 3 + 1] = tmpV.y; pos[i * 3 + 2] = tmpV.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x9fc8ff, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false, fog: false,
  })));
}
 
// ---------- 6. NUBE 3D DE MENSAJES Y CARROS ----------
// Punto al azar dentro de la nube, pero fuera de la zona despejada
function randomPointInField(target) {
  const r = VIEW.clearRadius + Math.cbrt(Math.random()) * (VIEW.fieldRadius - VIEW.clearRadius);
  target.randomDirection().multiplyScalar(r);
  target.y *= 0.55; // la nube es más ancha que alta
  return target;
}
 
function addFloater(tex, aspect, height, velocity, isCar) {
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(height * aspect, height, 1);
  randomPointInField(s.position);
  s.userData = { velocity, isCar, texRight: tex, texLeft: isCar ? mirrored(tex) : null };
  scene.add(s);
  floaters.push(s);
}
 
async function buildFloaters() {
  try { await document.fonts.load(`40px ${FONT}`); } catch (e) { /* sigue con la de respaldo */ }
 
  for (let i = 0; i < TEXT_COUNT; i++) {
    const text = MESSAGES[i % MESSAGES.length];
    const big = Math.random() < 0.15;
    const { tex, aspect } = textTexture(text, big ? 72 : 48);
    const h = big ? 1.1 : 0.45 + Math.random() * 0.45;
    // Los mensajes van a la deriva muy despacio
    const vel = new THREE.Vector3().randomDirection().multiplyScalar(0.1 + Math.random() * 0.2);
    addFloater(tex, aspect, h, vel, false);
  }
 
  let carTex = [];
  if (CAR_URLS.length) {
    const loader = new THREE.TextureLoader();
    carTex = await Promise.all(CAR_URLS.map((u) => loader.loadAsync(u).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      return { tex: t, aspect: t.image.width / t.image.height };
    })));
  } else {
    carTex = [
      drawnCarTexture(['#ff3b2f', '#b3120c'], '#ffd23f'),
      drawnCarTexture(['#f4f6fb', '#b9c0cf'], '#e8342b'),
      drawnCarTexture(['#2f7bff', '#123f9c'], '#ffffff'),
    ];
  }
  for (let i = 0; i < CAR_COUNT; i++) {
    const { tex, aspect } = carTex[i % carTex.length];
    const h = 0.9 + Math.random() * 1.1;
    // Los carros vuelan casi horizontales y rápido
    const dir = new THREE.Vector3(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.15, Math.random() * 2 - 1).normalize();
    addFloater(tex, aspect, h, dir.multiplyScalar(2.5 + Math.random() * 3.5), true);
  }
}
 
function updateFloaters(dt) {
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); // derecha de la pantalla
  for (const s of floaters) {
    const { velocity, isCar, texRight, texLeft } = s.userData;
    s.position.addScaledVector(velocity, dt);
 
    // Si sale de la nube, reaparece por el lado contrario
    if (s.position.length() > VIEW.fieldRadius) {
      s.position.multiplyScalar(-0.95);
    }
    // Si entra a la zona del agujero negro, lo empujamos hacia afuera
    const d = s.position.length();
    if (!isCar && d < VIEW.clearRadius) {
      s.position.multiplyScalar(VIEW.clearRadius / Math.max(d, 0.001));
    }
 
    // El carro mira hacia donde avanza en la pantalla
    if (isCar) s.material.map = velocity.dot(camRight) >= 0 ? texRight : texLeft;
  }
}
 
// ---------- 7. INTRO: alejamiento cinematográfico ----------
// Posición de la cámara para una distancia y una altura (0 = de canto, 1 = desde arriba)
function cameraOrbitPosition(distance, height, angle, target) {
  const elev = height * Math.PI / 2 * 0.9;
  return target.set(
    Math.sin(angle) * Math.cos(elev) * distance,
    Math.sin(elev) * distance,
    Math.cos(angle) * Math.cos(elev) * distance,
  );
}
 
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
 
export function playFinale() {
  if (!controls || intro.done || intro.playing) return;
  intro.playing = true;
  intro.t = 0;
  controls.enabled = false;
}
 
// Activa o desactiva el control con mouse/dedos
export function setFinaleInteractive(on) {
  if (!controls) return;
  wantInteractive = on;
  controls.enabled = on && intro.done;
  renderer.domElement.style.touchAction = controls.enabled ? 'none' : 'pan-y';
}
 
// ---------- 8. BUCLE ----------
function animate() {
  requestAnimationFrame(animate);
  if (!visible) return; // no gasta GPU cuando no se ve
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;
 
  // Intro: de cerca y de canto → lejos y desde arriba, dando media vuelta
  if (intro.playing) {
    intro.t = Math.min(1, intro.t + dt / VIEW.introSeconds);
    const k = easeInOut(intro.t);
    cameraOrbitPosition(
      THREE.MathUtils.lerp(VIEW.startDistance, VIEW.endDistance, k),
      THREE.MathUtils.lerp(VIEW.startHeight, VIEW.endHeight, k),
      k * Math.PI * 0.6,
      camera.position,
    );
    camera.lookAt(0, 0, 0);
    if (intro.t >= 1) {
      intro.playing = false;
      intro.done = true;
      setFinaleInteractive(wantInteractive);
      holder.classList.add('is-interactive'); // muestra la ayuda "arrastra para girar"
    }
  } else if (intro.done) {
    controls.update(dt); // giro, zoom, inercia y auto-rotación
  }
 
  // Niebla según la distancia: lo lejano se desvanece
  const dist = camera.position.length();
  scene.fog.near = dist * 0.5;
  scene.fog.far = dist + VIEW.fieldRadius * 1.3;
 
  // Disco y brillo
  disk.rotation.z += dt * 0.08;
  disk.material.uniforms.uTime.value = elapsed;
  lensRing.material.uniforms.uTime.value = elapsed;
  lensRing.quaternion.copy(camera.quaternion);
  diskNormal.set(0, 0, 1).applyQuaternion(disk.quaternion);
  tmpV.copy(camera.position).normalize();
  lensRing.material.uniforms.uOpacity.value = (1 - Math.abs(diskNormal.dot(tmpV))) * 0.9;
  glow.material.opacity = 0.65 + Math.sin(elapsed * 1.5) * 0.1;
 
  updateFloaters(dt);
  renderer.render(scene, camera);
}
 
function onResize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
 
// ---------- 9. INICIO ----------
function init() {
  section = document.querySelector('#final');
  holder = document.querySelector('.final-sticky');
  if (!section || !holder) return;
 
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000004, 1);
  renderer.domElement.classList.add('final-canvas');
  holder.prepend(renderer.domElement);
 
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000004, 10, 60);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  cameraOrbitPosition(VIEW.startDistance, VIEW.startHeight, 0, camera.position);
  camera.lookAt(0, 0, 0);
 
  // Controles: arrastrar = girar, rueda / pellizcar = acercar o alejar
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = VIEW.minDistance;
  controls.maxDistance = VIEW.maxDistance;
  controls.autoRotate = VIEW.autoRotate;
  controls.autoRotateSpeed = VIEW.autoRotateSpeed;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.enabled = false;
  renderer.domElement.style.touchAction = 'pan-y';
 
  // Mientras la tocan, se detiene el giro automático
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { controls.autoRotate = VIEW.autoRotate; });
 
  onResize();
  window.addEventListener('resize', onResize);
 
  buildStars();
  buildBlackHole();
  buildFloaters();
 
  // Solo renderiza cuando la sección está en pantalla
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) lastTime = performance.now();
  }).observe(section);
 
  animate();
}
 
init();