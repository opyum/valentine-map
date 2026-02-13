// ============ MINI MAP ============
const miniMap = L.map('miniMap').setView([46.603354, 1.888334], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OSM',
  maxZoom: 19
}).addTo(miniMap);

let previewMarker = null;
const pinMarkers = []; // All existing place pins

// Custom pin icon (red pin)
const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// New/editing place marker (green)
const editPinIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function updatePreviewMarker(lat, lng) {
  if (previewMarker) miniMap.removeLayer(previewMarker);
  previewMarker = L.marker([lat, lng], { icon: editPinIcon }).addTo(miniMap);
  miniMap.setView([lat, lng], 14);
}

function renderPinsOnMap() {
  // Clear existing pins
  pinMarkers.forEach(m => miniMap.removeLayer(m));
  pinMarkers.length = 0;

  const editId = document.getElementById('editId').value;
  const bounds = [];

  allPlaces.forEach(place => {
    // Skip the place being edited (it has its own preview marker)
    if (editId && place.id === parseInt(editId)) return;

    const marker = L.marker([place.latitude, place.longitude], { icon: pinIcon })
      .addTo(miniMap)
      .bindPopup(`<strong>${escapeHtml(place.name)}</strong><br><small>${escapeHtml(place.address)}</small>`);

    pinMarkers.push(marker);
    bounds.push([place.latitude, place.longitude]);
  });

  // Fit map to show all pins (only if no preview marker is active)
  if (!previewMarker && bounds.length > 0) {
    miniMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }
}

// Update marker when lat/lng fields change
document.getElementById('latitude').addEventListener('change', syncMarker);
document.getElementById('longitude').addEventListener('change', syncMarker);

function syncMarker() {
  const lat = parseFloat(document.getElementById('latitude').value);
  const lng = parseFloat(document.getElementById('longitude').value);
  if (!isNaN(lat) && !isNaN(lng)) {
    updatePreviewMarker(lat, lng);
  }
}

// Click on mini map to set coordinates
miniMap.on('click', (e) => {
  document.getElementById('latitude').value = e.latlng.lat.toFixed(6);
  document.getElementById('longitude').value = e.latlng.lng.toFixed(6);
  updatePreviewMarker(e.latlng.lat, e.latlng.lng);
});

// ============ GEOCODING ============
async function geocodeAddress() {
  const address = document.getElementById('address').value.trim();
  if (!address) {
    showToast('Entrez une adresse d\'abord', 'error');
    return;
  }

  const status = document.getElementById('geocodeStatus');
  status.textContent = 'Recherche en cours...';
  status.style.color = 'var(--pink)';

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
      headers: { 'Accept-Language': 'fr' }
    });
    const data = await res.json();

    if (data.length === 0) {
      status.textContent = 'Adresse non trouvee. Essayez une formulation differente ou placez le marqueur manuellement sur la mini-carte.';
      status.style.color = 'var(--red)';
      return;
    }

    const { lat, lon, display_name } = data[0];
    document.getElementById('latitude').value = parseFloat(lat).toFixed(6);
    document.getElementById('longitude').value = parseFloat(lon).toFixed(6);
    updatePreviewMarker(parseFloat(lat), parseFloat(lon));

    status.textContent = `Trouve: ${display_name}`;
    status.style.color = 'var(--green)';
  } catch (err) {
    status.textContent = 'Erreur de geocodage. Verifiez votre connexion.';
    status.style.color = 'var(--red)';
  }
}

// ============ CRUD ============
let allPlaces = [];
let currentPhotoPlaceId = null;

async function loadPlaces() {
  try {
    const res = await fetch('/api/places');
    allPlaces = await res.json();
    renderAdminList();
    renderPinsOnMap();
  } catch (err) {
    console.error('Error loading places:', err);
  }
}

function renderAdminList() {
  const container = document.getElementById('adminPlacesList');
  document.getElementById('placeCount').textContent = allPlaces.length;

  if (allPlaces.length === 0) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:20px;">Aucun lieu pour le moment. Ajoutez votre premier souvenir !</p>';
    return;
  }

  container.innerHTML = allPlaces.map(place => `
    <div class="admin-place">
      <div class="admin-place-header">
        <span class="admin-place-name">${escapeHtml(place.name)}</span>
        <div class="admin-place-actions">
          <button class="btn btn-secondary btn-sm" onclick="managePhotos(${place.id})">Photos</button>
          <button class="btn btn-secondary btn-sm" onclick="editPlace(${place.id})">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deletePlace(${place.id})">Supprimer</button>
        </div>
      </div>
      <div class="admin-place-info">${escapeHtml(place.address)}${place.date_visited ? ' - ' + escapeHtml(place.date_visited) : ''}</div>
      <div class="admin-place-photos-count">${place.photos.length} photo(s)</div>
    </div>
  `).join('');
}

// ============ FORM HANDLING ============
document.getElementById('placeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const editId = document.getElementById('editId').value;
  const data = {
    name: document.getElementById('name').value.trim(),
    address: document.getElementById('address').value.trim(),
    description: document.getElementById('description').value.trim(),
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value),
    date_visited: document.getElementById('dateVisited').value.trim(),
    sort_order: parseInt(document.getElementById('sortOrder').value) || 0
  };

  if (!data.name || !data.address || isNaN(data.latitude) || isNaN(data.longitude)) {
    showToast('Remplissez tous les champs obligatoires et localisez l\'adresse', 'error');
    return;
  }

  try {
    const url = editId ? `/api/places/${editId}` : '/api/places';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Server error');

    const place = await res.json();
    showToast(editId ? 'Lieu modifie !' : 'Lieu ajoute !', 'success');

    // Show photo section for new places
    if (!editId) {
      showPhotoSection(place.id, place.name);
    }

    resetForm();
    loadPlaces();
  } catch (err) {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
});

function editPlace(id) {
  const place = allPlaces.find(p => p.id === id);
  if (!place) return;

  document.getElementById('editId').value = place.id;
  document.getElementById('name').value = place.name;
  document.getElementById('address').value = place.address;
  document.getElementById('description').value = place.description || '';
  document.getElementById('latitude').value = place.latitude;
  document.getElementById('longitude').value = place.longitude;
  document.getElementById('dateVisited').value = place.date_visited || '';
  document.getElementById('sortOrder').value = place.sort_order || 0;

  document.getElementById('formTitle').textContent = 'Modifier un lieu';
  document.getElementById('submitBtn').textContent = 'Enregistrer';
  document.getElementById('cancelBtn').style.display = 'inline-block';

  updatePreviewMarker(place.latitude, place.longitude);

  // Scroll to form
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deletePlace(id) {
  if (!confirm('Supprimer ce lieu et toutes ses photos ?')) return;

  try {
    await fetch(`/api/places/${id}`, { method: 'DELETE' });
    showToast('Lieu supprime', 'success');
    loadPlaces();

    // Hide photo section if viewing this place
    if (currentPhotoPlaceId === id) {
      document.getElementById('photoSection').style.display = 'none';
      currentPhotoPlaceId = null;
    }
  } catch (err) {
    showToast('Erreur lors de la suppression', 'error');
  }
}

function resetForm() {
  document.getElementById('placeForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formTitle').textContent = 'Ajouter un lieu';
  document.getElementById('submitBtn').textContent = 'Ajouter';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('geocodeStatus').textContent = '';
  document.getElementById('sortOrder').value = '0';

  if (previewMarker) {
    miniMap.removeLayer(previewMarker);
    previewMarker = null;
  }
  miniMap.setView([46.603354, 1.888334], 5);
}

// ============ PHOTO MANAGEMENT ============
function showPhotoSection(placeId, placeName) {
  currentPhotoPlaceId = placeId;
  document.getElementById('photoSection').style.display = 'block';
  document.getElementById('photoPlaceName').textContent = placeName;
  document.getElementById('photoInput').value = '';
  loadPhotos(placeId);
  document.getElementById('photoSection').scrollIntoView({ behavior: 'smooth' });
}

function managePhotos(id) {
  const place = allPlaces.find(p => p.id === id);
  if (!place) return;
  showPhotoSection(place.id, place.name);
}

async function loadPhotos(placeId) {
  try {
    const res = await fetch(`/api/places/${placeId}`);
    const place = await res.json();
    renderPhotos(place.photos);
  } catch (err) {
    console.error('Error loading photos:', err);
  }
}

function renderPhotos(photos) {
  const grid = document.getElementById('photoGrid');

  if (photos.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-light);font-style:italic;">Aucune photo. Uploadez-en !</p>';
    return;
  }

  grid.innerHTML = photos.map(photo => `
    <div class="photo-item">
      <img src="/uploads/${photo.filename}" alt="${escapeHtml(photo.original_name || '')}">
      <button class="photo-delete" onclick="deletePhoto(${photo.id})">&times;</button>
    </div>
  `).join('');
}

async function uploadPhotos() {
  const input = document.getElementById('photoInput');
  if (!input.files.length) {
    showToast('Selectionnez des photos d\'abord', 'error');
    return;
  }

  if (!currentPhotoPlaceId) {
    showToast('Aucun lieu selectionne', 'error');
    return;
  }

  const formData = new FormData();
  for (const file of input.files) {
    formData.append('photos', file);
  }

  try {
    const res = await fetch(`/api/places/${currentPhotoPlaceId}/photos`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Upload failed');

    showToast('Photos uploadees !', 'success');
    input.value = '';
    loadPhotos(currentPhotoPlaceId);
    loadPlaces();
  } catch (err) {
    showToast('Erreur lors de l\'upload', 'error');
  }
}

async function deletePhoto(photoId) {
  if (!confirm('Supprimer cette photo ?')) return;

  try {
    await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
    showToast('Photo supprimee', 'success');
    if (currentPhotoPlaceId) loadPhotos(currentPhotoPlaceId);
    loadPlaces();
  } catch (err) {
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ============ TOAST ============
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ============ UTILS ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ INIT ============
loadPlaces();

// Fix mini map rendering (Leaflet needs a size recalc)
setTimeout(() => miniMap.invalidateSize(), 100);
