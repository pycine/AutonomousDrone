const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store latest GPS data and history
let latestData = null;
const history = [];
const MAX_HISTORY = 500;

// Broadcast to all connected WebSocket clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ESP32 sends GPS data here via HTTP POST
app.post('/api/gps', (req, res) => {
  const data = {
    lat: parseFloat(req.body.lat),
    lng: parseFloat(req.body.lng),
    alt: parseFloat(req.body.alt) || 0,
    speed: parseFloat(req.body.speed) || 0,
    course: parseFloat(req.body.course) || 0,
    satellites: parseInt(req.body.satellites) || 0,
    valid: req.body.valid === true || req.body.valid === 'true',
    date: req.body.date || '',
    time: req.body.time || '',
    timestamp: Date.now()
  };

  latestData = data;
  history.push(data);
  if (history.length > MAX_HISTORY) history.shift();

  broadcast({ type: 'gps_update', data });
  res.json({ status: 'ok' });
});

// Get history for newly connected clients
app.get('/api/history', (req, res) => {
  res.json({ history, latest: latestData });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Dashboard client connected');
  // Send current state to newly connected client
  if (latestData) {
    ws.send(JSON.stringify({ type: 'gps_update', data: latestData }));
  }
  if (history.length > 0) {
    ws.send(JSON.stringify({ type: 'history', data: history }));
  }
  ws.on('close', () => console.log('Dashboard client disconnected'));
});

// --- DEMO MODE: simulate GPS data for testing without ESP32 ---
const DEMO_MODE = process.argv.includes('--demo');
if (DEMO_MODE) {
  console.log('🛰️  DEMO MODE: Simulating GPS data...');
  // Simulate a route around Tunis
  let demoLat = 36.899534;
  let demoLng = 10.184127;
  let demoHeading = 45;
  let demoSpeed = 0;

  setInterval(() => {
    demoHeading += (Math.random() - 0.5) * 20;
    demoSpeed = 15 + Math.random() * 40;
    const rad = demoHeading * Math.PI / 180;
    const dist = (demoSpeed / 3600) * 0.001; // rough km to degrees
    demoLat += Math.cos(rad) * dist;
    demoLng += Math.sin(rad) * dist;

    const now = new Date();
    const data = {
      lat: demoLat,
      lng: demoLng,
      alt: 10 + Math.random() * 5,
      speed: demoSpeed,
      course: ((demoHeading % 360) + 360) % 360,
      satellites: Math.floor(6 + Math.random() * 8),
      valid: true,
      date: `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`,
      time: `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}`,
      timestamp: Date.now()
    };

    latestData = data;
    history.push(data);
    if (history.length > MAX_HISTORY) history.shift();
    broadcast({ type: 'gps_update', data });
  }, 1500);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌍 GPS Dashboard Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 should POST to http://<YOUR_PC_IP>:${PORT}/api/gps`);
  if (!DEMO_MODE) {
    console.log(`\n💡 Tip: Run with --demo flag for simulated GPS data:\n   node server.js --demo\n`);
  }
});
