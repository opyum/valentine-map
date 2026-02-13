const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { loadDb, saveDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Photo upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ============ API ROUTES ============

// Get all places with their photos
app.get('/api/places', (req, res) => {
  const db = loadDb();
  const placesWithPhotos = db.places
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id)
    .map(place => ({
      ...place,
      photos: db.photos.filter(p => p.place_id === place.id)
    }));
  res.json(placesWithPhotos);
});

// Get single place
app.get('/api/places/:id', (req, res) => {
  const db = loadDb();
  const id = parseInt(req.params.id);
  const place = db.places.find(p => p.id === id);
  if (!place) return res.status(404).json({ error: 'Place not found' });

  const photos = db.photos.filter(p => p.place_id === place.id);
  res.json({ ...place, photos });
});

// Create a place
app.post('/api/places', (req, res) => {
  const { name, address, description, latitude, longitude, date_visited, sort_order } = req.body;

  if (!name || !address || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'name, address, latitude, longitude are required' });
  }

  const db = loadDb();
  const newPlace = {
    id: db.nextPlaceId++,
    name,
    address,
    description: description || '',
    latitude,
    longitude,
    date_visited: date_visited || '',
    sort_order: sort_order || 0,
    created_at: new Date().toISOString()
  };

  db.places.push(newPlace);
  saveDb(db);

  res.status(201).json({ ...newPlace, photos: [] });
});

// Update a place
app.put('/api/places/:id', (req, res) => {
  const { name, address, description, latitude, longitude, date_visited, sort_order } = req.body;
  const id = parseInt(req.params.id);
  const db = loadDb();

  const index = db.places.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Place not found' });

  const existing = db.places[index];
  db.places[index] = {
    ...existing,
    name: name || existing.name,
    address: address || existing.address,
    description: description !== undefined ? description : existing.description,
    latitude: latitude != null ? latitude : existing.latitude,
    longitude: longitude != null ? longitude : existing.longitude,
    date_visited: date_visited !== undefined ? date_visited : existing.date_visited,
    sort_order: sort_order != null ? sort_order : existing.sort_order
  };

  saveDb(db);

  const photos = db.photos.filter(p => p.place_id === id);
  res.json({ ...db.places[index], photos });
});

// Delete a place
app.delete('/api/places/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = loadDb();

  const index = db.places.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Place not found' });

  // Delete associated photos from disk
  const photos = db.photos.filter(p => p.place_id === id);
  photos.forEach(photo => {
    const filePath = path.join(__dirname, 'uploads', photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  db.photos = db.photos.filter(p => p.place_id !== id);
  db.places.splice(index, 1);
  saveDb(db);

  res.json({ success: true });
});

// Upload photos for a place
app.post('/api/places/:id/photos', upload.array('photos', 10), (req, res) => {
  const id = parseInt(req.params.id);
  const db = loadDb();

  const place = db.places.find(p => p.id === id);
  if (!place) return res.status(404).json({ error: 'Place not found' });

  const newPhotos = [];
  for (const file of req.files) {
    const photo = {
      id: db.nextPhotoId++,
      place_id: id,
      filename: file.filename,
      original_name: file.originalname,
      created_at: new Date().toISOString()
    };
    db.photos.push(photo);
    newPhotos.push(photo);
  }

  saveDb(db);
  res.status(201).json(newPhotos);
});

// Delete a photo
app.delete('/api/photos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = loadDb();

  const index = db.photos.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Photo not found' });

  const photo = db.photos[index];
  const filePath = path.join(__dirname, 'uploads', photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.photos.splice(index, 1);
  saveDb(db);

  res.json({ success: true });
});

// ============ PAGE ROUTES ============

// Admin panel (hidden URL)
app.get('/notre-secret-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Valentine Map running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/notre-secret-admin`);
});
