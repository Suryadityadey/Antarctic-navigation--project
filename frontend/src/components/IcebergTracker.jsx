import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { COLORS, FONT_MONO } from '../theme';

// Placeholder data — replace with a real backend endpoint (e.g. GET
// /api/icebergs/active) once your Node server exposes tracked icebergs
// from the transaction/traceability dataset.
const MOCK_ICEBERGS = [
  { id: 'B12', lat: -64.1, lon: -56.4, size: 'Large (>5km)', driftSpeed: '0.8 km/h', risk: 'high' },
  { id: 'C04', lat: -65.7, lon: -48.2, size: 'Medium (1-5km)', driftSpeed: '1.4 km/h', risk: 'medium' },
  { id: 'A21', lat: -63.0, lon: -30.9, size: 'Small (<1km)', driftSpeed: '2.1 km/h', risk: 'low' },
  { id: 'D09', lat: -67.3, lon: -41.5, size: 'Medium (1-5km)', driftSpeed: '1.0 km/h', risk: 'medium' },
];

const RISK_COLOR = { high: COLORS.danger, medium: COLORS.route, low: COLORS.safe };

export default function IcebergTracker() {
  const [icebergs, setIcebergs] = useState([]);

  useEffect(() => {
    // Swap this for: getIcebergList().then(setIcebergs).catch(() => setIcebergs(MOCK_ICEBERGS));
    setIcebergs(MOCK_ICEBERGS);
  }, []);

  return (
    <div style={{ color: COLORS.ice }} className="w-full p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} color={COLORS.accent} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Iceberg tracker</div>
      </div>

      <div className="rounded-md" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        {icebergs.map((b, i) => (
          <div
            key={b.id}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: i < icebergs.length - 1 ? `1px solid ${COLORS.panelBorder}` : 'none' }}
          >
            <div className="flex items-center gap-3">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: RISK_COLOR[b.risk],
                  display: 'inline-block',
                }}
              />
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600 }}>{b.id}</div>
                <div style={{ fontSize: 11.5, color: COLORS.iceMuted }}>{b.size}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: COLORS.iceMuted }}>
              <MapPin size={13} />
              <span style={{ fontFamily: FONT_MONO }}>
                {b.lat.toFixed(1)}°, {b.lon.toFixed(1)}°
              </span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12.5 }}>{b.driftSpeed}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
