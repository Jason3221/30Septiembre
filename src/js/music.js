const START_DELAY = 2000; // 2 segundos después de tocar
const VOLUME = 0.7;       // volumen final (0 a 1)
const FADE_MS = 2500;     // el volumen sube suave en 2.5 s
 
const songs = import.meta.glob('../assets/music/*.mp3', {
  eager: true, query: '?url', import: 'default',
});
const SONG_URL = Object.values(songs)[0];
 
const screen = document.querySelector('#start-screen');
const startBtn = document.querySelector('#start-btn');
 
let audio = null;
if (SONG_URL) {
  audio = new Audio(SONG_URL);
  audio.loop = true;
  audio.preload = 'auto';
}
 
// Sube el volumen poco a poco (en iPhone el volumen no se puede cambiar; suena normal)
function fadeIn() {
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS);
    try { audio.volume = VOLUME * k; } catch (e) { /* iPhone */ }
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}
 
function start() {
  if (audio) {
    // 1) "Desbloquea" el audio en el mismo toque (obligatorio en celulares)
    audio.volume = 0;
    audio.play()
      .then(() => { audio.pause(); audio.currentTime = 0; })
      .catch(() => {});
    // 2) A los 2 segundos empieza de verdad
    setTimeout(() => {
      audio.currentTime = 0;
      audio.play().then(fadeIn).catch((err) => console.warn('No se pudo reproducir:', err));
    }, START_DELAY);
  }
 
  // Quita la pantalla de entrada y arranca las animaciones
  screen?.classList.add('hide');
  document.body.classList.remove('locked');
  window.dispatchEvent(new Event('experience-start'));
}
 
if (screen && startBtn) {
  document.body.classList.add('locked');
  window.scrollTo(0, 0);
  startBtn.addEventListener('click', start, { once: true });
} else {
  // Sin pantalla de entrada: arranca directo (la música puede ser bloqueada)
  window.addEventListener('load', () => window.dispatchEvent(new Event('experience-start')));
}