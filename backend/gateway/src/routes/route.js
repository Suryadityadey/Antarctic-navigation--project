const express = require('express');
const axios = require('axios');
const { RouteHistory } = require('../db');

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// POST /api/route -> { route: [{gx, gy}], total_cost }
// Matches src/api/client.js:getRoute() on the frontend exactly.
router.post('/route', async (req, res) => {
  const { start_lat, start_lon, goal_lat, goal_lon, icebergs = [] } = req.body;

  if ([start_lat, start_lon, goal_lat, goal_lon].some((v) => typeof v !== 'number')) {
    return res.status(400).json({ error: 'start_lat, start_lon, goal_lat, goal_lon are required numbers' });
  }

  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/route`, {
      start_lat, start_lon, goal_lat, goal_lon, icebergs,
    });

    // Fire-and-forget history log so /api/routes/history has real data.
    RouteHistory.create({
      date: new Date().toISOString().slice(0, 10),
      from: `${start_lat.toFixed(1)}, ${start_lon.toFixed(1)}`,
      to: `${goal_lat.toFixed(1)}, ${goal_lon.toFixed(1)}`,
      distanceKm: Math.round(data.total_cost * 25),
      riskReduction: '—',
      geojson: data,
    }).catch((e) => console.error('[gateway] failed to log route history:', e.message));

    res.json(data);
  } catch (err) {
    console.error('[gateway] /api/route failed:', err.message);
    res.status(502).json({ error: 'ML service unreachable' });
  }
});

module.exports = router;
