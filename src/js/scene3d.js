import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 
// ---------- VALORES QUE CONTROLA EL SCROLL ----------
export const state = {
  camZ: 10,         // distancia de la cámara
  camY: 0,          // altura de la cámara
  planetY: 1.1,     // altura del planeta
  planetScale: 1,   // tamaño del planeta + anillos
  spin: 0,          // giro extra del planeta con el scroll
  ringTilt: 0,      // inclinación extra de los anillos
  carProgress: 0,   // 0 → 1: recorrido de los carros en la escena 2
  glow: 1,          // intensidad de anillos y aura
  enter: 1,         // 0 → 1: animación de entrada al abrir la página
  photos: 1,        // 0 → 1: visibilidad de las fotos que giran alrededor del planeta
  photoSize: 1,     // tamaño de las fotos según la escena (más pequeñas cuando la cámara se acerca)
  scatter: 0,       // 0 → 1: las fotos y corazones se abren en espiral y se van (al llegar al mensaje)
};
 
// Copia suavizada de `state`: persigue a `state` poco a poco
// (esto hace que el movimiento se sienta cinematográfico)
const view = { ...state };
const SMOOTH_KEYS = ['camZ', 'camY', 'planetY', 'planetScale', 'spin', 'ringTilt', 'carProgress', 'glow', 'photos', 'scatter', 'photoSize'];
 
// ---------- MODELO 3D OPCIONAL ----------
// Si pones un .glb en src/assets/models/ se usa en vez del carro dibujado.
const MODEL_LENGTH = 3.2;    // largo del carro en la escena
const MODEL_ROTATION_Y = 0;  // gíralo aquí si tu modelo mira hacia otro lado (ej: Math.PI / 2)
const modelFiles = import.meta.glob('../assets/models/*.{glb,gltf}', {
  eager: true, query: '?url', import: 'default',
});
const MODEL_URL = Object.values(modelFiles)[0];
 
// ---------- BASE ----------
const canvas = document.querySelector('#scene3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x02030a, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 0, state.camZ);
 
// ---------- LUCES ----------
scene.add(new THREE.AmbientLight(0x3a4a7a, 0.6));
 
const blueLight = new THREE.PointLight(0x3aa0ff, 60, 30);
blueLight.position.set(2.5, 2.5, 4);
scene.add(blueLight);
 
const purpleLight = new THREE.PointLight(0x9a4dff, 50, 30);
purpleLight.position.set(-3, -1.5, 3.5);
scene.add(purpleLight);
 
// Luz para que los carros se vean bien
const keyLight = new THREE.DirectionalLight(0xdfe8ff, 1.6);
keyLight.position.set(3, 5, 8);
scene.add(keyLight);
 
// ---------- ESTRELLAS ----------
function makeStars(count, spread, size, opacity) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
    pos[i * 3 + 2] = -10 - Math.random() * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xbcd4ff, size, transparent: true, opacity, depthWrite: false,
  }));
  scene.add(pts);
  return pts;
}
const starsFar = makeStars(1800, 160, 0.12, 0.6);
const starsNear = makeStars(400, 90, 0.2, 0.9);
 
// ---------- PLANETA ----------
const planetGroup = new THREE.Group();
scene.add(planetGroup);
 
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(1.6, 96, 96),
  new THREE.MeshStandardMaterial({ color: 0x04050b, roughness: 0.3, metalness: 0.7 }),
);
planetGroup.add(planet);
 
// Aura: brillo en el borde del planeta (efecto "fresnel")
const auraMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x3d7dff) }, uStrength: { value: 1 } },
  vertexShader: /* glsl */`
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    uniform float uStrength;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float f = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
      gl_FragColor = vec4(uColor, f * uStrength);
    }`,
  transparent: true, blending: THREE.AdditiveBlending,
  side: THREE.BackSide, depthWrite: false,
});
const aura = new THREE.Mesh(new THREE.SphereGeometry(1.95, 64, 64), auraMat);
planetGroup.add(aura);
 
// ---------- ANILLOS ----------
const ringsGroup = new THREE.Group();
ringsGroup.rotation.x = -1.2;   // inclinados como en la referencia
planetGroup.add(ringsGroup);
 
function makeRing(radius, tube, color, opacity) {
  const ring = new THREE.Group();
  // núcleo brillante
  ring.add(new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 16, 200),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
  ));
  // resplandor alrededor
  const glowMesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube * 4, 16, 200),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: opacity * 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  ring.add(glowMesh);
  ring.userData.baseOpacity = opacity;
  ringsGroup.add(ring);
  return ring;
}
const ringBlue = makeRing(2.35, 0.045, 0x3fc3ff, 1);
const ringPurple = makeRing(2.7, 0.035, 0x8a5cff, 0.95);
const ringSoft = makeRing(3.05, 0.02, 0x4a8cff, 0.5);
const rings = [ringBlue, ringPurple, ringSoft];
 
// ---------- FOTOS QUE GIRAN ALREDEDOR DEL PLANETA ----------
// Pon tus fotos en: src/assets/images/planet/  (recomendado: 5 fotos)
// Si la carpeta está vacía se muestran 5 marcos de ejemplo.
const ORBIT = {
  maxPhotos: 8,       // cuántas fotos como máximo
  radius: 5.2,        // qué tan lejos del planeta giran (computador)
  radiusMobile: 2.8,  // lo mismo en celular
  photoHeight: 1.45,  // alto de cada foto (computador)
  photoHeightMobile: 1.05, // alto de cada foto (celular)
  speed: 0.18,        // velocidad de giro (negativo = al otro lado)
  tilt: 0.14,         // inclinación de la órbita (0 = plana)
};
 
const orbitFiles = import.meta.glob('../assets/images/planet/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', {
  eager: true, query: '?url', import: 'default',
});
const ORBIT_URLS = Object.entries(orbitFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url)
  .slice(0, ORBIT.maxPhotos);
 
const orbitGroup = new THREE.Group();   // la órbita inclinada
orbitGroup.rotation.x = ORBIT.tilt;
planetGroup.add(orbitGroup);
const orbitPhotos = [];
 
// Brillo suave alrededor de cada foto
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(90,150,255,1)';
  g.shadowBlur = 40;
  g.fillStyle = 'rgba(90,150,255,1)';
  g.fillRect(56, 56, 144, 144);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
const HALO_TEX = haloTexture();
 
// Marco de ejemplo (cuando todavía no hay fotos)
function placeholderTexture(n) {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 500;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 400, 500);
  grad.addColorStop(0, '#1b2a6b'); grad.addColorStop(1, '#5a2a8a');
  g.fillStyle = grad; g.fillRect(0, 0, 400, 500);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.textAlign = 'center';
  g.font = '90px sans-serif'; g.fillText('📷', 200, 240);
  g.font = '34px sans-serif'; g.fillText(`Foto ${n}`, 200, 320);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
 
function addOrbitPhoto(tex, aspect, index, total) {
  const h = 1;             // tamaño base; se escala en updateOrbitPhotos
  const w = h * aspect;
  const card = new THREE.Group();
 
  // Marco blanco con brillo (detrás de la foto)
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.12, h + 0.12),
    new THREE.MeshBasicMaterial({ color: 0xe6eeff, transparent: true }),
  );
  frame.position.z = -0.01;
  card.add(frame);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry((w + 0.12) * 1.8, (h + 0.12) * 1.8),
    new THREE.MeshBasicMaterial({
      map: HALO_TEX, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  halo.position.z = -0.02;
  card.add(halo);
 
  // La foto
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  card.add(photo);
 
  card.userData = { angle: (index / total) * Math.PI * 2, mats: [frame.material, photo.material], halo: halo.material };
  orbitGroup.add(card);
  orbitPhotos.push(card);
}
 
if (ORBIT_URLS.length) {
  const loader = new THREE.TextureLoader();
  ORBIT_URLS.forEach((url, i) => {
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      addOrbitPhoto(tex, tex.image.width / tex.image.height, i, ORBIT_URLS.length);
    });
  });
} else {
  for (let i = 0; i < 5; i++) addOrbitPhoto(placeholderTexture(i + 1), 0.8, i, 5);
}
 
const tmpQuat = new THREE.Quaternion();
function updateOrbitPhotos(elapsed) {
  const mobile = camera.aspect < 1;
  // Transición de salida: giran más rápido en espiral, se van hacia el fondo
  // del espacio subiendo, se hacen pequeñas y se desvanecen
  const sc = view.scatter;
  const out = THREE.MathUtils.smoothstep(sc, 0.2, 0.9);
  const radius = (mobile ? ORBIT.radiusMobile : ORBIT.radius) * (1 + sc * 0.6);
  const size = (mobile ? ORBIT.photoHeightMobile : ORBIT.photoHeight) * view.photoSize * (1 - sc * 0.55);
  const fade = view.photos * state.enter * (1 - out);
  orbitGroup.visible = fade > 0.01;
  if (!orbitGroup.visible) return;
  orbitGroup.position.set(0, sc * 2.2, -sc * 9);
 
  // Cancelamos la rotación de los padres para que la foto mire a la cámara
  orbitGroup.getWorldQuaternion(tmpQuat).invert();
 
  for (const card of orbitPhotos) {
    const a = card.userData.angle + elapsed * ORBIT.speed + view.spin * 0.3 + sc * 2.5;
    card.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    card.quaternion.copy(tmpQuat).multiply(camera.quaternion);
    // Un poco más pequeñas cuando pasan por detrás (profundidad)
    const depth = (Math.sin(a) + 1) / 2;          // 0 = atrás, 1 = adelante
    card.scale.setScalar(size * (0.8 + depth * 0.3));
    for (const m of card.userData.mats) m.opacity = fade;
    card.userData.halo.opacity = 0.6 * fade;
  }
}
 
// ---------- CORAZONES ALREDEDOR DEL PLANETA ----------
const HEARTS = {
  orbitCount: 10,     // corazones 3D que giran alrededor del planeta
  orbitRadius: 2.9,   // distancia al planeta
  orbitSpeed: -0.3,   // velocidad (negativo = al contrario de las fotos)
  size: 0.22,         // tamaño de los corazones 3D
  sparkles: 70,       // corazoncitos brillantes que suben flotando
  color: 0xff3d7f,    // color principal (rosado)
};
 
// Forma de corazón
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0.5, 0.5);
  s.bezierCurveTo(0.5, 0.5, 0.4, 0, 0, 0);
  s.bezierCurveTo(-0.6, 0, -0.6, 0.7, -0.6, 0.7);
  s.bezierCurveTo(-0.6, 1.1, -0.3, 1.54, 0.5, 1.9);
  s.bezierCurveTo(1.2, 1.54, 1.6, 1.1, 1.6, 0.7);
  s.bezierCurveTo(1.6, 0.7, 1.6, 0, 1.0, 0);
  s.bezierCurveTo(0.7, 0, 0.5, 0.5, 0.5, 0.5);
  return s;
}
const heartGeo = new THREE.ExtrudeGeometry(heartShape(), {
  depth: 0.4, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 6, curveSegments: 24,
});
heartGeo.center();
heartGeo.rotateZ(Math.PI); // la forma viene al revés
 
const heartMat = new THREE.MeshStandardMaterial({
  color: HEARTS.color, emissive: 0xff1f5a, emissiveIntensity: 0.55,
  metalness: 0.3, roughness: 0.3, transparent: true,
});
 
const heartsOrbit = new THREE.Group();
heartsOrbit.rotation.x = -0.35;  // órbita inclinada al lado contrario de las fotos
planetGroup.add(heartsOrbit);
const orbitHearts = [];
for (let i = 0; i < HEARTS.orbitCount; i++) {
  const h = new THREE.Mesh(heartGeo, heartMat);
  h.scale.setScalar(HEARTS.size * (0.7 + Math.random() * 0.6));
  h.userData = { angle: (i / HEARTS.orbitCount) * Math.PI * 2, bob: Math.random() * 6 };
  heartsOrbit.add(h);
  orbitHearts.push(h);
}
 
// Luz rosada para que los corazones brillen
const pinkLight = new THREE.PointLight(0xff4d8d, 25, 12);
pinkLight.position.set(0, 1, 3);
planetGroup.add(pinkLight);
 
// Corazoncitos brillantes (sprites) que suben alrededor del planeta
function heartSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 70);
  g.shadowColor = 'rgba(255,80,150,1)';
  g.shadowBlur = 24;
  g.fillStyle = '#ff6fa5';
  g.beginPath();
  g.moveTo(0, 22);
  g.bezierCurveTo(-40, -6, -24, -38, 0, -18);
  g.bezierCurveTo(24, -38, 40, -6, 0, 22);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const sparkleTex = heartSpriteTexture();
const sparkles = [];
for (let i = 0; i < HEARTS.sparkles; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sparkleTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const size = 0.12 + Math.random() * 0.22;
  sp.scale.set(size, size, 1);
  sp.position.set((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 7, -3 + Math.random() * 5);
  sp.userData = { speed: 0.15 + Math.random() * 0.35, phase: Math.random() * 6, base: 0.4 + Math.random() * 0.6 };
  planetGroup.add(sp);
  sparkles.push(sp);
}
 
function updateHearts(elapsed, dt) {
  // Misma transición que las fotos, pero los corazones salen hacia arriba como burbujas
  const sc = view.scatter;
  const out = THREE.MathUtils.smoothstep(sc, 0.3, 1);
  const fade = view.photos * state.enter * (1 - out);
  heartsOrbit.visible = fade > 0.01;
  heartMat.opacity = fade;
  pinkLight.intensity = 25 * fade;
  heartsOrbit.position.set(0, sc * 3.2, -sc * 5);
  const r = HEARTS.orbitRadius * (1 + sc * 1.2);
  for (const h of orbitHearts) {
    const a = h.userData.angle + elapsed * HEARTS.orbitSpeed - sc * 3;
    h.position.set(Math.cos(a) * r, Math.sin(elapsed * 1.5 + h.userData.bob) * 0.12, Math.sin(a) * r);
    h.rotation.y = elapsed * 1.2 + h.userData.bob;
    // latido suave
    const beat = 1 + Math.max(0, Math.sin(elapsed * 3 + h.userData.bob)) * 0.12;
    h.scale.setScalar(HEARTS.size * beat);
  }
  for (const sp of sparkles) {
    sp.visible = fade > 0.01;
    sp.position.y += sp.userData.speed * dt * (1 + sc * 8); // suben más rápido al irse
    sp.position.x += Math.sin(elapsed + sp.userData.phase) * 0.002;
    if (sp.position.y > 4) sp.position.y = -4;
    // titilan
    sp.material.opacity = fade * sp.userData.base * (0.6 + 0.4 * Math.sin(elapsed * 2 + sp.userData.phase));
  }
}
 
// ---------- CARROS ----------
// Carro deportivo hecho con geometrías (se usa si no hay modelo .glb)
function buildCar(bodyColor, accentColor) {
  const car = new THREE.Group();
 
  // Perfil lateral de la carrocería (mirando hacia +X)
  const s = new THREE.Shape();
  s.moveTo(-1.6, 0.15);
  s.lineTo(-1.62, 0.55);
  s.quadraticCurveTo(-1.3, 0.72, -0.6, 0.75);
  s.quadraticCurveTo(-0.2, 1.15, 0.45, 1.1);
  s.quadraticCurveTo(0.9, 0.95, 1.2, 0.7);
  s.quadraticCurveTo(1.65, 0.62, 1.66, 0.35);
  s.lineTo(1.6, 0.15);
  s.lineTo(-1.6, 0.15);
 
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3,
  });
  bodyGeo.translate(0, 0, -0.75);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: bodyColor, metalness: 0.6, roughness: 0.25,
  }));
  car.add(body);
 
  // Vidrios
  const g = new THREE.Shape();
  g.moveTo(-0.45, 0.8);
  g.quadraticCurveTo(-0.1, 1.08, 0.45, 1.04);
  g.quadraticCurveTo(0.8, 0.92, 1.0, 0.78);
  g.lineTo(-0.45, 0.8);
  const glassGeo = new THREE.ExtrudeGeometry(g, { depth: 1.56, bevelEnabled: false });
  glassGeo.translate(0, 0, -0.78);
  car.add(new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
    color: 0x0a1020, metalness: 0.9, roughness: 0.05,
  })));
 
  // Franja decorativa
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.07, 1.62),
    new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.25 }),
  );
  stripe.position.set(0.05, 0.5, 0);
  car.add(stripe);
 
  // Alerón
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.05, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  wing.position.set(-1.45, 0.9, 0);
  car.add(wing);
 
  // Faros (adelante) y luces traseras
  const lightGeo = new THREE.BoxGeometry(0.06, 0.1, 0.35);
  for (const z of [-0.5, 0.5]) {
    const head = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xfff4c8 }));
    head.position.set(1.68, 0.45, z);
    car.add(head);
    const tail = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    tail.position.set(-1.66, 0.5, z);
    car.add(tail);
  }
 
  // Ruedas
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 28);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 6);
  rimGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.8 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8c2d8, metalness: 0.9, roughness: 0.2 });
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.78, 0.78]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(tireGeo, tireMat));
      w.add(new THREE.Mesh(rimGeo, rimMat));
      w.position.set(x, 0.2, z);
      car.add(w);
      wheels.push(w);
    }
  }
 
  car.userData.wheels = wheels;
  return car;
}
 
// Cada carro: su carril (y, z), dirección, y en qué parte del scroll cruza.
// z > 0 pasa DELANTE del planeta, z < 0 pasa DETRÁS.
const CAR_SETUP = [
  { body: 0xe8232e, accent: 0xffc93a, y: -2.7, z: 0.5,  dir: 1,  start: 0.00, end: 0.45, scale: 0.6 },
  { body: 0xf2f4fa, accent: 0xe8232e, y: -0.9, z: -4.5, dir: -1, start: 0.25, end: 0.70, scale: 0.75 },
  { body: 0x2a6bff, accent: 0xffffff, y: -2.1, z: 2.0,  dir: 1,  start: 0.50, end: 0.95, scale: 0.55 },
];
 
const cars = CAR_SETUP.map((cfg) => {
  const holder = new THREE.Group();          // se mueve por la escena
  const model = buildCar(cfg.body, cfg.accent);
  holder.add(model);
  holder.scale.setScalar(cfg.scale);
  holder.rotation.y = cfg.dir === 1 ? 0 : Math.PI;
  holder.position.set(-50, cfg.y, cfg.z);    // fuera de pantalla al inicio
  holder.visible = false;
  holder.userData = { cfg, model, lastX: null };
  scene.add(holder);
  return holder;
});
 
// Imágenes de carros (PNG con fondo transparente, de lado, mirando a la DERECHA)
// en src/assets/images/cars/ → se usan aquí y en la escena final.
// Prioridad: modelo .glb > imágenes PNG > carros dibujados por código.
const carImageFiles = import.meta.glob('../assets/images/cars/*.{png,webp}', {
  eager: true, query: '?url', import: 'default',
});
const CAR_IMAGE_URLS = Object.values(carImageFiles);
 
if (!MODEL_URL && CAR_IMAGE_URLS.length) {
  const loader = new THREE.TextureLoader();
  CAR_IMAGE_URLS.forEach((url, i) => loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const aspect = tex.image.width / tex.image.height;
    // Cada carro de la escena usa una imagen (se repiten si hay pocas)
    cars.forEach((holder, k) => {
      if (k % CAR_IMAGE_URLS.length !== i) return;
      const w = MODEL_LENGTH, h = MODEL_LENGTH / aspect;
      // La imagen mira a la derecha; si el carro va a la izquierda, usamos una copia en espejo
      let map = tex;
      if (holder.userData.cfg.dir !== 1) {
        map = tex.clone();
        map.repeat.x = -1;
        map.offset.x = 1;
        map.needsUpdate = true;
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
      sprite.scale.set(w, h, 1);
      sprite.position.y = h / 2;
      holder.remove(holder.userData.model);
      const wrap = new THREE.Group();
      wrap.add(sprite);
      wrap.userData.wheels = [];
      holder.add(wrap);
      holder.userData.model = wrap;
    });
  }));
}
 
// Si hay un modelo .glb, reemplaza los carros dibujados
if (MODEL_URL) {
  new GLTFLoader().load(MODEL_URL, (gltf) => {
    const base = gltf.scene;
    // Centrar y escalar el modelo para que mida MODEL_LENGTH
    const box = new THREE.Box3().setFromObject(base);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    base.position.sub(center);
    base.position.y += size.y / 2;
    const wrapper = new THREE.Group();
    wrapper.add(base);
    wrapper.scale.setScalar(MODEL_LENGTH / Math.max(size.x, size.z));
    wrapper.rotation.y = MODEL_ROTATION_Y;
 
    cars.forEach((holder) => {
      holder.remove(holder.userData.model);
      const clone = wrapper.clone(true);
      clone.userData.wheels = [];
      holder.add(clone);
      holder.userData.model = clone;
    });
  }, undefined, (err) => console.warn('No se pudo cargar el modelo:', err));
}
 
// Ancho visible a la profundidad z (para que el carro entre y salga de pantalla)
function halfWidthAt(z) {
  const dist = camera.position.z - z;
  return Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * camera.aspect;
}
 
function updateCars() {
  for (const holder of cars) {
    const { cfg, model } = holder.userData;
    // Progreso local de este carro (0 = entra, 1 = sale)
    const t = (view.carProgress - cfg.start) / (cfg.end - cfg.start);
    if (t <= 0 || t >= 1) {
      holder.visible = false;
      holder.userData.lastX = null;
      continue;
    }
    holder.visible = true;
    const edge = halfWidthAt(cfg.z) + 3;
    const x = THREE.MathUtils.lerp(-edge, edge, t) * cfg.dir;
    holder.position.x = x;
    holder.position.y = cfg.y + Math.sin(t * 40) * 0.02; // pequeño rebote
 
    // Ruedas giran según cuánto avanzó
    if (holder.userData.lastX !== null) {
      const dx = Math.abs(x - holder.userData.lastX);
      for (const w of model.userData.wheels || []) w.rotation.z -= dx / 0.34;
    }
    holder.userData.lastX = x;
  }
}
 
// ---------- TAMAÑO DE PANTALLA ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // En celular (vertical) abrimos el ángulo para que quepan los anillos
  camera.fov = camera.aspect < 1 ? 75 : 50;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
onResize();
 
// ---------- PAUSA CUANDO SE VE LA ESCENA FINAL ----------
let paused = false;
const finalSection = document.querySelector('#final');
if (finalSection) {
  new IntersectionObserver(([e]) => {
    // Cuando el final cubre la pantalla, este fondo no se ve: lo pausamos
    paused = e.intersectionRatio > 0.99;
    canvas.style.opacity = e.isIntersecting ? '0' : '1';
  }, { threshold: [0, 0.99, 1] }).observe(finalSection);
}
 
// ---------- BUCLE ----------
let last = performance.now();
let elapsed = 0;
 
function animate() {
  requestAnimationFrame(animate);
  if (paused) { last = performance.now(); return; }
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;
 
  // Suavizado: `view` se acerca a `state` un poco cada cuadro
  const k = Math.min(1, dt * 4);
  for (const key of SMOOTH_KEYS) view[key] += (state[key] - view[key]) * k;
  const enter = state.enter;
 
  // Cámara
  camera.position.z = view.camZ + (1 - enter) * 4;
  camera.position.y = view.camY;
  camera.lookAt(0, view.camY * 0.5, 0);
 
  // Planeta: giro continuo + giro por scroll
  planetGroup.position.y = view.planetY;
  planetGroup.scale.setScalar(view.planetScale * (0.6 + 0.4 * enter));
  planet.rotation.y = elapsed * 0.08 + view.spin;
 
  // Anillos: giran cada uno a su ritmo
  ringsGroup.rotation.x = -1.2 + view.ringTilt;
  ringBlue.rotation.z = elapsed * 0.15 + view.spin;
  ringPurple.rotation.z = -elapsed * 0.1 - view.spin * 0.7;
  ringSoft.rotation.z = elapsed * 0.05;
  ringPurple.rotation.x = Math.sin(elapsed * 0.4) * 0.04;
 
  // Brillo que respira
  const pulse = 0.9 + Math.sin(elapsed * 1.4) * 0.1;
  const glow = view.glow * enter;
  auraMat.uniforms.uStrength.value = glow * pulse * 1.3;
  rings.forEach((r) => {
    r.children[0].material.opacity = r.userData.baseOpacity * glow;
    r.children[1].material.opacity = r.userData.baseOpacity * 0.18 * glow * pulse;
  });
 
  // Luces que orbitan un poco
  blueLight.position.x = 2.5 + Math.sin(elapsed * 0.5) * 0.8;
  purpleLight.position.y = -1.5 + Math.cos(elapsed * 0.4) * 0.6;
 
  // Estrellas con parallax suave
  starsFar.rotation.z = elapsed * 0.004;
  starsNear.position.y = -view.planetY * 0.4; // parallax con el scroll
 
  updateOrbitPhotos(elapsed);
  updateHearts(elapsed, dt);
  updateCars();
  renderer.render(scene, camera);
}
animate();