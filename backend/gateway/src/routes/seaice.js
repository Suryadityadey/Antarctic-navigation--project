const express = require('express');
const axios = require('axios');

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// POST /api/seaice-forecast -> { forecast: number[][] }
// Matches src/api/client.js:getSeaIceForecast() on the frontend exactly.
router.post('/seaice-forecast', async (req, res) => {
  const { last_5_days } = req.body;

  if (!Array.isArray(last_5_days) || last_5_days.length !== 5) {
    return res.status(400).json({ error: 'last_5_days must be an array of 5 concentration grids' });
  }

  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/seaice-forecast`, { last_5_days });
    res.json(data);
  } catch (err) {
    console.error('[gateway] /api/seaice-forecast failed:', err.message);
    res.status(502).json({ error: 'ML service unreachable' });
  }
});

module.exports = router;
