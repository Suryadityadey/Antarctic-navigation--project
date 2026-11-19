import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { COLORS, FONT_MONO } from '../theme';
import { getRouteHistory } from '../api/client';

const MOCK_HISTORY = [
  { id: 1, date: '2026-08-30', from: '-63.2, -57.8', to: '-68.9, -25.1', distanceKm: 940, riskReduction: '18%' },
  { id: 2, date: '2026-08-27', from: '-64.0, -55.0', to: '-70.1, -30.4', distanceKm: 1120, riskReduction: '24%' },
];

export default function RouteHistory() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRouteHistory()
      .then((data) => setRoutes(data.routes))
      .catch(() => setRoutes(MOCK_HISTORY))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ color: COLORS.ice }} className="w-full p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={18} color={COLORS.accent} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Route history</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: COLORS.iceMuted, fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" />
          Loading past routes…
        </div>
      ) : (
        <div className="rounded-md" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
          <div
            className="grid px-4 py-2"
            style={{
              gridTemplateColumns: '110px 1fr 1fr 100px 100px',
              fontSize: 11.5,
              color: COLORS.iceMuted,
              borderBottom: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <span>Date</span>
            <span>From</span>
            <span>To</span>
            <span>Distance</span>
            <span>Risk cut</span>
          </div>
          {routes.map((r, i) => (
            <div
              key={r.id}
              className="grid px-4 py-3"
              style={{
                gridTemplateColumns: '110px 1fr 1fr 100px 100px',
                fontSize: 12.5,
                fontFamily: FONT_MONO,
                borderBottom: i < routes.length - 1 ? `1px solid ${COLORS.panelBorder}` : 'none',
              }}
            >
              <span>{r.date}</span>
              <span>{r.from}</span>
              <span>{r.to}</span>
              <span>{r.distanceKm} km</span>
              <span style={{ color: COLORS.safe }}>{r.riskReduction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
