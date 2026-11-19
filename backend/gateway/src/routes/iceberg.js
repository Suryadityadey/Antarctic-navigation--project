const express = require('express');
const axios = require('axios');
const { Iceberg } = require('../db');

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// POST /api/predict/iceberg_velocity -> { resid_east, resid_north }
// Matches src/api/client.js:getIcebergVelocity() on the frontend exactly.
router.post('/predict/iceberg_velocity', async (req, res) => {
  const { lat, lon, cur_u, cur_v, wind_u, wind_v } = req.body;

  if ([lat, lon, cur_u, cur_v, wind_u, wind_v].some((v) => typeof v !== 'number')) {
    return res.status(400).json({ error: 'lat, lon, cur_u, cur_v, wind_u, wind_v are required numbers' });
  }

  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict/iceberg_velocity`, {
      lat, lon, cur_u, cur_v, wind_u, wind_v,
    });
    res.json(data);
  } catch (err) {
    console.error('[gateway] /api/predict/iceberg_velocity failed:', err.message);
    res.status(502).json({ error: 'ML service unreachable' });
  }
});

// GET /api/icebergs/active -> { icebergs: [...] }
// Not yet called by the frontend (IcebergTracker.jsx currently uses mock
// data) — wire it up there once this collection has real satellite-derived
// positions: getIcebergList().then(setIcebergs) in IcebergTracker.jsx.
router.get('/icebergs/active', async (req, res) => {
  try {
    const icebergs = await Iceberg.find().sort({ updatedAt: -1 }).lean();
    res.json({ icebergs });
  } catch (err) {
    console.error('[gateway] /api/icebergs/active failed:', err.message);
    res.status(500).json({ error: 'database error' });
  }
});

module.exports = router;
