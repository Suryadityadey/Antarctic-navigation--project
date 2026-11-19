const mongoose = require('mongoose');

async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[gateway] connected to MongoDB');
}

const RouteHistorySchema = new mongoose.Schema({
  date: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  distanceKm: { type: Number, required: true },
  riskReduction: { type: String, required: true },
  // Full A* result kept for replay / audit, matches route.geojson shape.
  geojson: { type: Object },
}, { timestamps: true });

const IcebergSchema = new mongoose.Schema({
  icebergId: { type: String, required: true, unique: true },
  lat: Number,
  lon: Number,
  size: String,
  driftSpeedKmh: Number,
  risk: { type: String, enum: ['low', 'medium', 'high'] },
  updatedAt: { type: Date, default: Date.now },
});

const RouteHistory = mongoose.model('RouteHistory', RouteHistorySchema);
const Iceberg = mongoose.model('Iceberg', IcebergSchema);

module.exports = { connectDb, RouteHistory, Iceberg };
