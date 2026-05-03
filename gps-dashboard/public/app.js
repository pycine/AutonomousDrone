/* =============================================
   GPS Dashboard — Application Logic
   ============================================= */

// ---- State ----
let map, marker, trailLine, markerElement;
let trailCoords = [];
let showTrail = true;
let followDevice = true;
let useSatellite = false;
let totalDistance = 0;
let lastPosition = null;
let dataPointCount = 0;
let speedHistory = [];
let altHistory = [];
let ws = null;
let reconnectTimer = null;
const MAX_CHART_POINTS = 60;

// ---- Map Initialization ----
function initMap() {
  map = L.map('map', {
    center: [36.899534, 10.184127],
    zoom: 15,
    zoomControl: true,
    attributionControl: true
  });

  // Dark tile layer
  const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  });

  const satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  });

  darkTiles.addTo(map);

  // Toggle satellite
  document.getElementById('btn-satellite').addEventListener('click', function() {
    useSatellite = !useSatellite;
    this.classList.toggle('active', useSatellite);
    if (useSatellite) {
      map.removeLayer(darkTiles);
      satelliteTiles.addTo(map);
      document.getElementById('map').classList.add('satellite-tiles');
    } else {
      map.removeLayer(satelliteTiles);
      darkTiles.addTo(map);
      document.getElementById('map').classList.remove('satellite-tiles');
    }
  });

  // Custom marker
  const markerIcon = L.divIcon({
    className: 'device-marker',
    html: `
      <div class="device-marker-ring"></div>
      <div class="device-marker-inner"></div>
      <div class="device-arrow" id="marker-arrow"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  marker = L.marker([36.899534, 10.184127], { icon: markerIcon }).addTo(map);

  // Trail polyline
  trailLine = L.polyline([], {
    color: '#22d3ee',
    weight: 3,
    opacity: 0.7,
    smoothFactor: 1,
    dashArray: null,
    lineJoin: 'round'
  }).addTo(map);

  // Gradient trail effect
  const trailGlow = L.polyline([], {
    color: '#3b82f6',
    weight: 8,
    opacity: 0.15,
    smoothFactor: 1,
    lineJoin: 'round'
  }).addTo(map);

  // Store glow reference for updates
  map._trailGlow = trailGlow;
}

// ---- WebSocket Connection ----
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setConnectionStatus(true);
    console.log('WebSocket connected');
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'gps_update') {
      updateDashboard(msg.data);
    } else if (msg.type === 'history') {
      loadHistory(msg.data);
    }
  };

  ws.onclose = () => {
    setConnectionStatus(false);
    console.log('WebSocket disconnected, reconnecting...');
    if (!reconnectTimer) {
      reconnectTimer = setInterval(() => connectWebSocket(), 3000);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    ws.close();
  };
}

// ---- Load History ----
function loadHistory(historyData) {
  if (!historyData || historyData.length === 0) return;

  trailCoords = historyData
    .filter(d => d.valid && d.lat && d.lng)
    .map(d => [d.lat, d.lng]);

  if (showTrail) {
    trailLine.setLatLngs(trailCoords);
    if (map._trailGlow) map._trailGlow.setLatLngs(trailCoords);
  }

  // Build chart history
  speedHistory = historyData.slice(-MAX_CHART_POINTS).map(d => d.speed || 0);
  altHistory = historyData.slice(-MAX_CHART_POINTS).map(d => d.alt || 0);
  dataPointCount = historyData.length;

  drawChart();
}

// ---- Update Dashboard ----
function updateDashboard(data) {
  if (!data) return;
  dataPointCount++;

  const { lat, lng, alt, speed, course, satellites, valid, date, time } = data;

  // Update fix status
  setFixStatus(valid);

  if (valid && lat && lng) {
    const pos = [lat, lng];

    // Update marker position
    marker.setLatLng(pos);

    // Update heading arrow
    const arrow = document.getElementById('marker-arrow');
    if (arrow) {
      arrow.style.transform = `translateX(-50%) rotate(${course}deg)`;
    }

    // Update trail
    trailCoords.push(pos);
    if (showTrail) {
      trailLine.setLatLngs(trailCoords);
      if (map._trailGlow) map._trailGlow.setLatLngs(trailCoords);
    }

    // Calculate distance
    if (lastPosition) {
      const dist = haversine(lastPosition[0], lastPosition[1], lat, lng);
      totalDistance += dist;
    }
    lastPosition = pos;

    // Follow device
    if (followDevice) {
      map.panTo(pos, { animate: true, duration: 0.5 });
    }

    // Update coordinates bar
    document.getElementById('coord-lat').textContent = `Lat: ${lat.toFixed(6)}°`;
    document.getElementById('coord-lng').textContent = `Lng: ${lng.toFixed(6)}°`;
    document.getElementById('coord-alt').textContent = `Alt: ${alt.toFixed(1)}m`;
  }

  // Update speed gauge
  updateSpeedGauge(speed);

  // Update stat cards with flash animation
  updateStatValue('altitude-value', alt ? alt.toFixed(1) : '--');
  updateStatValue('satellites-value', satellites.toString());
  updateStatValue('course-value', course ? `${course.toFixed(1)}°` : '--');
  updateStatValue('distance-value', totalDistance.toFixed(2));

  // Update compass
  updateCompass(course);

  // Update info
  document.getElementById('gps-date').textContent = date || '--/--/----';
  document.getElementById('gps-time').textContent = time || '--:--:--';
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
  document.getElementById('data-points').textContent = dataPointCount.toString();

  // Update chart data
  speedHistory.push(speed || 0);
  altHistory.push(alt || 0);
  if (speedHistory.length > MAX_CHART_POINTS) speedHistory.shift();
  if (altHistory.length > MAX_CHART_POINTS) altHistory.shift();
  drawChart();
}

// ---- Speed Gauge ----
function updateSpeedGauge(speed) {
  const maxSpeed = 120;
  const clampedSpeed = Math.min(speed || 0, maxSpeed);
  const arcLength = 251.3; // total arc length
  const offset = arcLength - (clampedSpeed / maxSpeed) * arcLength;

  const arc = document.getElementById('speed-arc');
  const valueEl = document.getElementById('speed-value');

  arc.style.strokeDashoffset = offset;
  valueEl.textContent = Math.round(speed || 0);
}

// ---- Compass ----
function updateCompass(course) {
  const needle = document.getElementById('compass-needle');
  if (needle) {
    needle.style.transform = `translate(-50%, -50%) rotate(${course || 0}deg)`;
  }
}

// ---- Stat Value Update with Flash ----
function updateStatValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== value) {
    el.textContent = value;
    el.classList.remove('value-flash');
    void el.offsetWidth; // reflow
    el.classList.add('value-flash');
  }
}

// ---- Haversine Distance (km) ----
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Status Helpers ----
function setConnectionStatus(connected) {
  const el = document.getElementById('connection-status');
  if (connected) {
    el.className = 'status-badge connected';
    el.querySelector('.status-text').textContent = 'Connected';
  } else {
    el.className = 'status-badge disconnected';
    el.querySelector('.status-text').textContent = 'Disconnected';
  }
}

function setFixStatus(valid) {
  const el = document.getElementById('fix-status');
  if (valid) {
    el.className = 'status-badge valid-fix';
    el.querySelector('.status-text').textContent = 'GPS Fix';
  } else {
    el.className = 'status-badge no-fix';
    el.querySelector('.status-text').textContent = 'No Fix';
  }
}

// ---- Canvas Chart ----
function drawChart() {
  const canvas = document.getElementById('history-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 50, bottom: 25, left: 10 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  if (speedHistory.length < 2) return;

  // Draw speed line
  const maxSpd = Math.max(20, ...speedHistory) * 1.2;
  drawLine(ctx, speedHistory, maxSpd, padding, chartW, chartH, 'rgba(34, 211, 238, 1)', 'rgba(34, 211, 238, 0.08)', 'Speed');

  // Draw altitude line
  const maxAlt = Math.max(20, ...altHistory) * 1.2;
  drawLine(ctx, altHistory, maxAlt, padding, chartW, chartH, 'rgba(167, 139, 250, 0.8)', 'rgba(167, 139, 250, 0.05)', 'Alt');

  // Labels
  ctx.font = '500 10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
  ctx.fillText(`${Math.round(maxSpd)} km/h`, w - 4, padding.top + 4);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
  ctx.fillText(`${Math.round(maxAlt)} m`, w - 4, padding.top + 18);

  // Bottom time labels
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.textAlign = 'center';
  ctx.font = '400 9px JetBrains Mono, monospace';
  const labels = ['newest', '', '', '', 'oldest'];
  for (let i = 0; i < 5; i++) {
    const x = padding.left + (chartW / 4) * (4 - i);
    ctx.fillText(labels[i], x, h - 4);
  }
}

function drawLine(ctx, data, maxVal, padding, chartW, chartH, strokeColor, fillColor, label) {
  const len = data.length;
  if (len < 2) return;

  ctx.beginPath();
  for (let i = 0; i < len; i++) {
    const x = padding.left + (i / (len - 1)) * chartW;
    const y = padding.top + chartH - (data[i] / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Stroke
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Fill
  const lastX = padding.left + chartW;
  const bottomY = padding.top + chartH;
  ctx.lineTo(lastX, bottomY);
  ctx.lineTo(padding.left, bottomY);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Current value dot
  const lastVal = data[len - 1];
  const dotX = padding.left + chartW;
  const dotY = padding.top + chartH - (lastVal / maxVal) * chartH;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// ---- Clock ----
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hh}:${mm}:${ss}`;
}

// ---- Button Handlers ----
function setupButtons() {
  document.getElementById('btn-center').addEventListener('click', () => {
    followDevice = true;
    if (lastPosition) {
      map.flyTo(lastPosition, 16, { duration: 0.8 });
    }
  });

  document.getElementById('btn-trail').addEventListener('click', function() {
    showTrail = !showTrail;
    this.classList.toggle('active', showTrail);
    if (showTrail) {
      trailLine.setLatLngs(trailCoords);
      if (map._trailGlow) map._trailGlow.setLatLngs(trailCoords);
    } else {
      trailLine.setLatLngs([]);
      if (map._trailGlow) map._trailGlow.setLatLngs([]);
    }
  });

  // Stop following when user manually pans
  map.on('dragstart', () => { followDevice = false; });
}

// ---- Chart Resize ----
function handleResize() {
  drawChart();
}

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupButtons();
  connectWebSocket();
  updateClock();
  setInterval(updateClock, 1000);
  window.addEventListener('resize', handleResize);

  // Fetch history on load
  fetch('/api/history')
    .then(r => r.json())
    .then(data => {
      if (data.history && data.history.length > 0) {
        loadHistory(data.history);
      }
      if (data.latest) {
        updateDashboard(data.latest);
      }
    })
    .catch(err => console.warn('Could not fetch history:', err));
});
