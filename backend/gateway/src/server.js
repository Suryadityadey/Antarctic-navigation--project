require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { connectDb } = require('./db');
const routeRouter = require('./routes/route');
const seaiceRouter = require('./routes/seaice');
const icebergRouter = require('./routes/iceberg');
const historyRouter = require('./routes/history');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/antarctic_nav';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Every route below is mounted under /api, matching the frontend's
// REACT_APP_API_URL + path convention in src/api/client.js.
app.use('/api', routeRouter);
app.use('/api', seaiceRouter);
app.use('/api', icebergRouter);
app.use('/api', historyRouter);

async function start() {
  try {
    await connectDb(MONGO_URI);
  } catch (err) {
    console.error('[gateway] MongoDB connection failed, starting without persistence:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[gateway] listening on http://localhost:${PORT}`);
  });
}

start();
