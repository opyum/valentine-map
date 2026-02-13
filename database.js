const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'places.json');

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading DB:', err);
  }
  return { places: [], photos: [], nextPlaceId: 1, nextPhotoId: 1 };
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize DB file if not exists
if (!fs.existsSync(DB_PATH)) {
  saveDb({ places: [], photos: [], nextPlaceId: 1, nextPhotoId: 1 });
}

module.exports = { loadDb, saveDb };
