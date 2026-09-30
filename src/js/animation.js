import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { state } from './scene3d.js';
import { playFinale, setFinaleInteractive } from './finale.js';
import { heartsFx } from './hearts.js';
 
gsap.registerPlugin(ScrollTrigger);
 
// ---------- ENTRADA (empieza cuando tocan "Toca para abrir") ----------
const entrada = gsap.timeline({ paused: true })
  .fromTo(state, { enter: 0 }, { enter: 1, duration: 2.4, ease: 'power3.out' }, 0)
  .from('.intro-small', { y: 20, opacity: 0, duration: 1.2, ease: 'power2.out' }, 0.8)
  .from('.intro-big', { y: 30, opacity: 0, duration: 1.4, ease: 'power2.out' }, 1.2)
  .from('.scroll-hint', { opacity: 0, duration: 1 }, 1.8);
state.enter = 0; // el planeta espera detrás de la pantalla de entrada
window.addEventListener('experience-start', () => entrada.play(), { once: true });
 
// ---------- 3D SEGÚN EL SCROLL ----------
// Cada ScrollTrigger mide cuánto has avanzado en una sección (0 → 1).
const stIntro = ScrollTrigger.create({ trigger: '#intro', start: 'top top', end: 'bottom top' });
const stMomentos = ScrollTrigger.create({ trigger: '#momentos', start: 'top top', end: 'bottom bottom' });
const stMensaje = ScrollTrigger.create({ trigger: '#mensaje', start: 'top bottom', end: 'center center' });
const stRecuerdos = ScrollTrigger.create({ trigger: '#fotos', start: 'top bottom', end: 'top top' });
 
const lerp = gsap.utils.interpolate;
 
// Calcula TODO el estado 3D a partir de la posición del scroll.
// Así, subas o bajes, el planeta siempre queda donde debe.
function update3D() {
  const a = stIntro.progress;     // escena 1 → 2
  const b = stMomentos.progress;  // escena 2 (carros)
  const c = stMensaje.progress;   // escena 3
  const d = stRecuerdos.progress; // entrada a "Nuestros recuerdos"
 
  const portrait = window.innerWidth < window.innerHeight; // celular vertical
  // En celular la cámara se acerca menos, para que el planeta y las fotos quepan
  state.camZ = lerp(10, portrait ? 9.2 : 7.5, a);
  const upMore = portrait ? 4.5 : 2.6; // en celular sube más
  state.planetY = (c > 0 ? lerp(-0.1, 2.6, c) : lerp(1.1, -0.1, a)) + lerp(0, upMore, d);
  // FASE 1 de "Nuestros recuerdos": el planeta baja su intensidad y se aleja hacia arriba
  state.planetScale = lerp(1, 0.55, c) * lerp(1, 0.8, d);
  state.glow = lerp(1, 0.55, c) * lerp(1, 0.25, d);
  state.spin = lerp(0, 1.2, a) + lerp(0, 2.8, b);
  state.ringTilt = lerp(0, 0.25, b) + lerp(0, 0.25, c);
  state.carProgress = b;          // los carros cruzan (ver CAR_SETUP en scene3d.js)
  // Fotos y corazones: se quedan girando durante los carros y, al llegar
  // al mensaje, se abren en espiral, suben y se desvanecen.
  state.photos = 1;
  state.scatter = c;
  state.photoSize = lerp(1, 0.72, a); // más pequeñas cuando la cámara se acerca
}
gsap.ticker.add(update3D); // se recalcula en cada cuadro
 
// ---------- TEXTOS DE LA ESCENA 1 ----------
gsap.to('.intro-text', {
  y: -80, opacity: 0, ease: 'none',
  scrollTrigger: { trigger: '#intro', start: 'top top', end: '60% top', scrub: 1 },
});
 
// ---------- TEXTOS DE LA ESCENA 2 (sección fija de 350vh) ----------
gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: { trigger: '#momentos', start: 'top top', end: 'bottom bottom', scrub: 1 },
})
  .fromTo('.moment-1', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.08 }, 0.02)
  .to('.moment-1', { opacity: 0, y: -30, duration: 0.08 }, 0.28)
  .fromTo('.moment-2', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.08 }, 0.36)
  .to('.moment-2', { opacity: 0, y: -30, duration: 0.08 }, 0.6)
  .fromTo('.moment-3', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.08 }, 0.68)
  .to('.moment-3', { opacity: 0, y: -30, duration: 0.08 }, 0.92)
  .to({}, { duration: 0.08 }, 0.92); // la línea de tiempo dura exactamente 1
 
// ---------- TEXTO DE LA ESCENA 3 ----------
gsap.from('.mensaje-box', {
  y: 60, opacity: 0, ease: 'none',
  scrollTrigger: { trigger: '#mensaje', start: 'top 70%', end: 'center center', scrub: 1 },
});
 
// ---------- ESCENA 4: "MEMORIA REVELÁNDOSE" ----------
// Toda la secuencia está unida al scroll (scrub): si subes, se devuelve.
// Los números (0.02, 0.18, ...) son el momento de la escena: 0 = empieza, 1 = termina.
const rec = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: { trigger: '#fotos', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
});
const num = (el, key) => parseFloat(el.dataset[key]) || 0;
// En pantallas pequeñas el heart burst se abre menos para no salirse
const spread = () => Math.min(1, window.innerWidth / 640);
 
rec
  // FASE 2 — nube romántica: aparecen, suben despacio con un leve vaivén y se van
  .fromTo('.rec-ambient > span',
    { opacity: 0, y: 40, scale: 0.6 },
    { opacity: (i, el) => num(el, 'o'), y: -20, scale: 1, stagger: 0.012, duration: 0.1, ease: 'power1.out' }, 0.02)
  .to('.rec-ambient > span',
    { opacity: 0, y: -120, x: (i, el) => num(el, 'drift'), scale: 0.8, stagger: 0.012, duration: 0.16 }, 0.16)
 
  // FASE 3 — título
  .fromTo('.rec-title',
    { opacity: 0, y: 30, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1, duration: 0.1, ease: 'power2.out' }, 0.16)
 
  // FASE 4 — destello central corto
  .fromTo('.rec-flash', { opacity: 0, scale: 0.3 }, { opacity: 0.9, scale: 1, duration: 0.04, ease: 'power2.out' }, 0.29)
  .to('.rec-flash', { opacity: 0, scale: 1.5, duration: 0.05 }, 0.33)
 
  // FASE 5 — la foto entra desde abajo con un pequeño rebote (0.70 → 1.05 → 0.98 → 1)
  .fromTo('.rec-photo',
    { opacity: 0, scale: 0.7, y: 120, rotation: -8, xPercent: -50, yPercent: -50 },
    { opacity: 1, scale: 1.05, y: -6, rotation: -2.5, xPercent: -50, yPercent: -50, duration: 0.13, ease: 'power2.out' }, 0.32)
  .to('.rec-photo', { scale: 0.98, y: 2, rotation: -1.8, duration: 0.04, ease: 'sine.inOut' }, 0.45)
  .to('.rec-photo', { scale: 1, y: 0, rotation: -2, duration: 0.03, ease: 'sine.out' }, 0.49)
 
  // FASE 6 — heart burst desde detrás de la foto
  .fromTo('.rec-burst .m-heart',
    { x: 0, y: 0, scale: 0.3, rotation: 0, opacity: 0 },
    {
      x: (i, el) => num(el, 'x') * spread(), y: (i, el) => num(el, 'y') * spread(),
      rotation: (i, el) => num(el, 'r'), scale: (i, el) => num(el, 's'),
      opacity: 1, stagger: 0.004, duration: 0.05, ease: 'power2.out',
    }, 0.5)
  .to('.rec-burst .m-heart', {
    x: (i, el) => num(el, 'x') * 1.35 * spread(), y: (i, el) => num(el, 'y') * 1.35 * spread() - 20,
    rotation: (i, el) => num(el, 'r') * 2, opacity: 0, stagger: 0.004, duration: 0.08,
  }, 0.56)
 
  // LLUVIA DE CORAZONES (neón + hacia la pantalla): se enciende con la foto
  // y se apaga cuando el recuerdo se aleja
  .fromTo(heartsFx, { intensity: 0 }, { intensity: 1, duration: 0.14 }, 0.3)
  .to(heartsFx, { intensity: 0, duration: 0.12 }, 0.82)
 
  // FASE 9 — destellos alrededor de la foto (titilan solos mientras la foto está)
  .fromTo('.rec-sparkle', { opacity: 0 }, { opacity: 1, stagger: 0.02, duration: 0.04 }, 0.52)
 
  // FASE 7 — la foto queda flotando (animación CSS .rec-float); aquí solo se "sostiene"
 
  // SALIDA — el recuerdo se aleja
  .to('.rec-photo', { scale: 0.85, opacity: 0, y: -80, rotation: 4, duration: 0.16, ease: 'power1.in' }, 0.8)
  .to(['.rec-title', '.rec-sparkle'], { opacity: 0, duration: 0.12 }, 0.82)
  .to({}, { duration: 0.02 }, 0.98); // la línea de tiempo dura exactamente 1
 
// Más fotos (si hay más de una): aparecen al llegar
if (document.querySelector('.photo-card')) gsap.set('.photo-card', { opacity: 0 });
ScrollTrigger.batch('.photo-card', {
  start: 'top 85%',
  onEnter: (els) => gsap.fromTo(els,
    { y: 60, opacity: 0, rotate: () => gsap.utils.random(-4, 4) },
    { y: 0, opacity: 1, rotate: () => gsap.utils.random(-2, 2), stagger: 0.12, duration: 0.9, ease: 'power3.out' }),
});
 
// ---------- ESCENA FINAL ----------
// Al llegar al final empieza el alejamiento en 3D y se activa
// el control con mouse / dedos. Si subes, se desactiva para poder hacer scroll.
ScrollTrigger.create({
  trigger: '#final',
  start: 'top 2%',
  end: 'bottom top',
  onEnter: () => { playFinale(); setFinaleInteractive(true); },
  onEnterBack: () => setFinaleInteractive(true),
  onLeaveBack: () => setFinaleInteractive(false),
});
 
// El título aparece al entrar
gsap.from('.final-title', {
  y: -40, opacity: 0, duration: 1.2, ease: 'power2.out',
  scrollTrigger: { trigger: '#final', start: 'top 40%' },
});
 
// ---------- INDICADOR "DESLIZA" ----------
// Se ve al principio y se esconde al llegar al final
ScrollTrigger.create({
  trigger: '#final', start: 'top 80%',
  toggleClass: { targets: '.scroll-hint', className: 'is-hidden' },
});
 
// Recalcular posiciones cuando cargan las fotos y fuentes
window.addEventListener('load', () => ScrollTrigger.refresh());