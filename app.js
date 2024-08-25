const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, 'schoolData.db');
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.run(`
      CREATE TABLE IF NOT EXISTS school (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        UNIQUE(name, address)
      );
    `);

    app.listen(3001, () => {
      console.log('Server Running at http://localhost:3001/');
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();


function validateInput(name, address, latitude, longitude) {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Name must be a non-empty string.';
  }
  if (typeof address !== 'string' || address.trim() === '') {
    return 'Address must be a non-empty string.';
  }
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return 'Latitude must be a valid number.';
  }
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return 'Longitude must be a valid number.';
  }
  return null;
}


function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

// POST to enroll a new school
app.post('/register', async (request, response) => {
  const { name, address, latitude, longitude } = request.body;

  // Validate input types
  const error = validateInput(name, address, latitude, longitude);
  if (error) {
    return response.status(400).send(error);
  }

  try {
    // 
    const existingSchoolQuery = `
      SELECT * FROM school WHERE name = ? AND address = ?;
    `;
    const existingSchool = await db.get(existingSchoolQuery, [name, address]);

    if (existingSchool) {
      return response.status(400).send('School already exists.');
    }

    const insertQuery = `
      INSERT INTO school (name, address, latitude, longitude)
      VALUES (?, ?, ?, ?);
    `;

    await db.run(insertQuery, [name, address, latitude, longitude]);
    return response.status(200).send('School registered successfully');
  } catch (e) {
    return response.status(500).send('Database error');
  }
});

// GET listSchools
app.get('/listSchools', async (request, response) => {
  const latitude= 18.790894;
  const longitude=78.911850;

  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);

  if (isNaN(latNum) || isNaN(lonNum)) {
    return response.status(400).send('Latitude and longitude must be valid numbers.');
  }

  try {
    const getSchoolsQuery = `
      SELECT * FROM school;
    `;

    const schools = await db.all(getSchoolsQuery);
    if(schools.length==0){
        return response.status(200).send("The database is empty");
    }

    schools.forEach(school => {
      school.distance = calculateDistance(latNum, lonNum, school.latitude, school.longitude);
    });

    schools.sort((a, b) => a.distance - b.distance);

    return response.status(200).json(schools);
  } catch (e) {
    return response.status(500).send('Database error');
  }
});



module.exports = app;
