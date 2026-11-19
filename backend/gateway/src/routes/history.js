const express = require('express');
const { RouteHistory } = require('../db');

const router = express.Router();

// GET /api/routes/history -> { routes: [...] }
// Matches src/api/client.js:getRouteHistory() on the frontend exactly.
router.get('/routes/history', async (req, res) => {
  try {
    const routes = await RouteHistory.find().sort({ createdAt: -1 }).limit(50).lean();

    res.json({
      routes: routes.map((r) => ({
        id: r._id,
        date: r.date,
        from: r.from,
        to: r.to,
        distanceKm: r.distanceKm,
        riskReduction: r.riskReduction,
      })),
    });
  } catch (err) {
    console.error('[gateway] /api/routes/history failed:', err.message);
    res.status(500).json({ error: 'database error' });
  }
});

module.exports = router;
