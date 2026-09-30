const btn = document.querySelector('#note-btn');
const modal = document.querySelector('#note-modal');
const closeBtn = document.querySelector('#note-close');
const topBtn = document.querySelector('#top-btn');
 
function openNote() {
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));
  btn.classList.remove('pulse');
}
function closeNote() {
  modal.classList.remove('open');
  setTimeout(() => { modal.hidden = true; }, 350);
}
 
if (btn && modal) {
  btn.addEventListener('click', openNote);
  closeBtn?.addEventListener('click', closeNote);
  // Cerrar tocando fuera de la tarjeta o con Escape
  modal.addEventListener('click', (e) => { if (e.target === modal) closeNote(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeNote(); });
}
 
// Volver al inicio (en el final la rueda del mouse acerca/aleja el 3D)
topBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));