const CONFIG = {
  modo: 'ambos',      // 'ambos' | 'neon' | 'lluvia'
  neonCount: 38,      // cuántos corazones neón
  lluviaCount: 90,    // cuántos corazones vienen hacia la pantalla
  lluviaSpeed: 0.28,  // velocidad hacia la pantalla
  size: 1,            // tamaño general de los corazones (1 = normal, 1.5 = más grandes)
  maxSize: 80,        // tamaño máximo (px) para que nunca tapen la foto
};
 
// Lo que anima GSAP (0 = apagado, 1 = a tope)
export const heartsFx = { intensity: 0 };
 
const canvas = document.querySelector('#rec-hearts');
const section = document.querySelector('#fotos');
 
if (canvas && section) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let scale = 1; // los corazones crecen un poco en pantallas grandes
  let visible = false;
  let last = performance.now();
 
  // ---------- Dibujos base (se crean una sola vez) ----------
  function heartPath(g, s) {
    // corazón centrado en (0,0) de tamaño s
    g.beginPath();
    g.moveTo(0, s * 0.32);
    g.bezierCurveTo(-s * 0.55, -s * 0.05, -s * 0.38, -s * 0.52, 0, -s * 0.26);
    g.bezierCurveTo(s * 0.38, -s * 0.52, s * 0.55, -s * 0.05, 0, s * 0.32);
    g.closePath();
  }
 
  // Corazón de contorno neón
  function makeNeon() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 68);
    g.lineWidth = 5;
    g.strokeStyle = '#ff4fa3';
    g.shadowColor = '#ff2d8a';
    g.shadowBlur = 18;
    heartPath(g, 84);
    g.stroke();
    g.shadowBlur = 6;
    g.lineWidth = 2.5;
    g.strokeStyle = '#ffd1ea';
    heartPath(g, 84);
    g.stroke();
    return c;
  }
 
  // Corazón brillante (relleno con reflejo)
  function makeGlossy(c1, c2) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 68);
    const grad = g.createRadialGradient(-14, -22, 4, 0, 0, 60);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    g.fillStyle = grad;
    g.shadowColor = 'rgba(255, 40, 120, 0.6)';
    g.shadowBlur = 10;
    heartPath(g, 96);
    g.fill();
    // brillo blanco arriba a la izquierda
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(-18, -14, 9, 5, -0.6, 0, Math.PI * 2);
    g.fill();
    return c;
  }
 
  const NEON = makeNeon();
  const GLOSSY = [
    makeGlossy('#ff8fb3', '#d6164f'),
    makeGlossy('#ff9ad5', '#c2187a'),
    makeGlossy('#ffb3c6', '#e0245e'),
  ];
 
  // ---------- Partículas ----------
  const rand = (a, b) => a + Math.random() * (b - a);
 
  const neon = Array.from({ length: CONFIG.neonCount }, () => newNeon(true));
  function newNeon(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.1,
      size: rand(18, 58),
      speed: rand(0.03, 0.08),          // pantallas por segundo
      sway: rand(0.4, 1.4),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.35, 0.9),
      rot: rand(-0.3, 0.3),
    };
  }
 
  const rain = Array.from({ length: CONFIG.lluviaCount }, () => newRain(true));
  function newRain(anywhere) {
    return {
      x: rand(-1, 1),
      y: rand(-1, 1),
      z: anywhere ? rand(0.15, 1) : 1,  // 1 = lejos, 0 = en la pantalla
      base: rand(7, 16),
      img: GLOSSY[(Math.random() * GLOSSY.length) | 0],
      rot: rand(-0.5, 0.5),
      spin: rand(-0.6, 0.6),
    };
  }
 
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    scale = Math.max(0.8, Math.min(1.6, Math.min(W, H) / 560)) * CONFIG.size;
  }
  window.addEventListener('resize', resize);
  resize();
 
  // ---------- Bucle ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = heartsFx.intensity;
    if (!visible) return;
 
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (k <= 0.001) return;
 
    // 1) Neón flotando hacia arriba
    if (CONFIG.modo !== 'lluvia') {
      const count = Math.round(neon.length * k);
      for (let i = 0; i < neon.length; i++) {
        const p = neon[i];
        p.y -= p.speed * dt;
        p.phase += dt;
        if (p.y < -0.1) Object.assign(p, newNeon(false));
        if (i >= count) continue;
        const x = p.x * W + Math.sin(p.phase * p.sway) * 18;
        const y = p.y * H;
        ctx.save();
        ctx.globalAlpha = p.alpha * k;
        ctx.translate(x, y);
        ctx.rotate(p.rot + Math.sin(p.phase) * 0.1);
        const ns = p.size * scale;
        ctx.drawImage(NEON, -ns / 2, -ns / 2, ns, ns);
        ctx.restore();
      }
    }
 
    // 2) Lluvia de corazones hacia la pantalla
    if (CONFIG.modo !== 'neon') {
      const count = Math.round(rain.length * k);
      const cx = W / 2, cy = H * 0.56;           // sale desde detrás de la foto
      const f = Math.min(W, H) * 0.55;          // "lente"
      for (let i = 0; i < rain.length; i++) {
        const p = rain[i];
        p.z -= CONFIG.lluviaSpeed * dt * (0.6 + (1 - p.z));
        p.rot += p.spin * dt;
        const sx = cx + (p.x / p.z) * f;
        const sy = cy + (p.y / p.z) * f;
        const size = Math.min((p.base * scale) / p.z, CONFIG.maxSize * scale);
        if (p.z < 0.08 || sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) {
          Object.assign(p, newRain(false));
          continue;
        }
        if (i >= count) continue;
        // aparecen suave a lo lejos y se desvanecen al acercarse mucho
        const fadeIn = Math.min(1, (1 - p.z) * 4);
        const fadeOut = size >= CONFIG.maxSize * scale ? 0.45 : 1;
        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut * k;
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.drawImage(p.img, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }
  requestAnimationFrame(frame);
 
  // Solo dibuja cuando "Nuestros recuerdos" está en pantalla
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { resize(); last = performance.now(); }
  }).observe(section);
}

