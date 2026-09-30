const files = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}', {
  eager: true, query: '?url', import: 'default',
});
 
const memoryImg = document.querySelector('#memory-img');
const memoryCap = document.querySelector('#memory-cap');
const grid = document.querySelector('#photo-grid');
const moreSection = document.querySelector('#mas-fotos');
 
// Convierte la ruta en un texto bonito
function captionFrom(path) {
  const name = path.split('/').pop().replace(/\.[^.]+$/, '');
  return name.replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ');
}
 
const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
 
// 1) Recuerdo principal
if (memoryImg) {
  if (entries.length) {
    const [path, url] = entries[0];
    memoryImg.src = url;
    memoryImg.alt = captionFrom(path);
    if (memoryCap) memoryCap.textContent = captionFrom(path);
  } else if (memoryCap) {
    memoryCap.textContent = '📷 Pon tu foto en src/assets/images/';
  }
}
 
// 2) El resto de fotos (si hay)
if (grid) {
  for (const [path, url] of entries.slice(1)) {
    const fig = document.createElement('figure');
    fig.className = 'photo-card';
    const img = document.createElement('img');
    img.src = url;
    img.alt = captionFrom(path);
    img.loading = 'lazy';
    const cap = document.createElement('figcaption');
    cap.textContent = captionFrom(path);
    fig.append(img, cap);
    grid.append(fig);
  }
  if (moreSection && entries.length <= 1) moreSection.hidden = true;
}