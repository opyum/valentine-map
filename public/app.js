// ============ MAP SETUP ============
const map = L.map('map').setView([46.603354, 1.888334], 5); // France center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// Pin icon for markers
const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// ============ FLOATING HEARTS ============
function createFloatingHearts() {
  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.getElementById('heartsBg');
  const hearts = ['&#10084;&#65039;', '&#128149;', '&#128151;', '&#128152;', '&#128153;', '&#128155;'];

  // Slower on mobile to reduce DOM churn
  const interval = window.innerWidth <= 480 ? 1500 : 800;

  let heartInterval = setInterval(spawnHeart, interval);

  function spawnHeart() {
    // Pause when tab is hidden
    if (document.hidden) return;

    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.innerHTML = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = Math.random() * 100 + '%';
    heart.style.fontSize = (15 + Math.random() * 20) + 'px';
    heart.style.animationDuration = (8 + Math.random() * 12) + 's';
    container.appendChild(heart);

    setTimeout(() => heart.remove(), 20000);
  }
}

createFloatingHearts();

// ============ LOAD PLACES ============
let allPlaces = [];
const markers = [];

async function loadPlaces() {
  try {
    const res = await fetch('/api/places');
    allPlaces = await res.json();
    renderMap();
    renderList();
  } catch (err) {
    console.error('Error loading places:', err);
    document.getElementById('placesList').innerHTML =
      '<p class="loading">Impossible de charger les souvenirs...</p>';
  }
}

function renderMap() {
  // Clear existing markers
  markers.forEach(m => map.removeLayer(m));
  markers.length = 0;

  if (allPlaces.length === 0) return;

  const bounds = [];

  allPlaces.forEach(place => {
    const marker = L.marker([place.latitude, place.longitude], {
      icon: pinIcon
    }).addTo(map);

    const photoHtml = place.photos.length > 0
      ? `<img src="/uploads/${place.photos[0].filename}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px;">`
      : '';

    const popupContent = `
      <div class="popup-title">${escapeHtml(place.name)}</div>
      <div class="popup-address">${escapeHtml(place.address)}</div>
      ${place.description ? `<div class="popup-desc">${escapeHtml(place.description).substring(0, 100)}${place.description.length > 100 ? '...' : ''}</div>` : ''}
      ${place.date_visited ? `<div class="popup-date">${escapeHtml(place.date_visited)}</div>` : ''}
      ${photoHtml}
      <button class="popup-btn" onclick="openDetail(${place.id})">Voir plus</button>
    `;

    marker.bindPopup(popupContent, { maxWidth: 250 });
    markers.push(marker);
    bounds.push([place.latitude, place.longitude]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }
}

function renderList() {
  const container = document.getElementById('placesList');

  if (allPlaces.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="heart-big">&#10084;&#65039;</div>
        <p>Nos souvenirs arrivent bientot...</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allPlaces.map(place => {
    const photosHtml = place.photos.slice(0, 4).map(photo =>
      `<img class="place-card-photo" src="/uploads/${photo.filename}" alt="${escapeHtml(photo.original_name || '')}" onclick="event.stopPropagation(); openPhoto('/uploads/${photo.filename}')">`
    ).join('');

    return `
      <div class="place-card" onclick="openDetail(${place.id}); flyToPlace(${place.latitude}, ${place.longitude})">
        <div class="place-card-header">
          <span class="place-card-heart">&#10084;&#65039;</span>
          <span class="place-card-name">${escapeHtml(place.name)}</span>
        </div>
        <div class="place-card-address">${escapeHtml(place.address)}</div>
        ${place.description ? `<div class="place-card-desc">${escapeHtml(place.description)}</div>` : ''}
        ${place.date_visited ? `<div class="place-card-date">${escapeHtml(place.date_visited)}</div>` : ''}
        ${photosHtml ? `<div class="place-card-photos">${photosHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ============ DETAIL PANEL ============
function openDetail(placeId) {
  const place = allPlaces.find(p => p.id === placeId);
  if (!place) return;

  const panel = document.getElementById('detailPanel');
  const content = document.getElementById('detailContent');

  const photosHtml = place.photos.map(photo =>
    `<img class="detail-photo" src="/uploads/${photo.filename}" alt="${escapeHtml(photo.original_name || '')}" onclick="openPhoto('/uploads/${photo.filename}')">`
  ).join('');

  content.innerHTML = `
    <h2>${escapeHtml(place.name)}</h2>
    <div class="detail-address">${escapeHtml(place.address)}</div>
    ${place.date_visited ? `<div class="detail-date">${escapeHtml(place.date_visited)}</div>` : ''}
    ${place.description ? `<div class="detail-desc">${escapeHtml(place.description)}</div>` : ''}
    ${photosHtml ? `<div class="detail-photos">${photosHtml}</div>` : '<p style="color:var(--text-light);font-style:italic;">Pas encore de photos</p>'}
  `;

  panel.classList.add('open');
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
}

function flyToPlace(lat, lng) {
  map.flyTo([lat, lng], 14, { duration: 1.5 });
}

// ============ PHOTO MODAL ============
function openPhoto(src) {
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('modalImage');
  img.src = src;
  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('photoModal').classList.remove('open');
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDetail();
  }
});

// Swipe right to close detail panel (mobile)
let touchStartX = 0;
const detailPanel = document.getElementById('detailPanel');
detailPanel.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
detailPanel.addEventListener('touchend', (e) => {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (diff > 80) closeDetail(); // swipe right = close
}, { passive: true });

// ============ UTILS ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ INIT ============
loadPlaces();
