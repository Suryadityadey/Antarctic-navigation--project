import { useState } from 'react';
import { LayoutDashboard, History, Radar } from 'lucide-react';
import AntarcticNavDashboard from './components/AntarcticNavDashboard';
import IcebergTracker from './components/IcebergTracker';
import RouteHistory from './components/RouteHistory';
import { COLORS, FONT_SANS, FONT_IMPORT_URL } from './theme';

const TABS = [
  { id: 'dashboard', label: 'Console', icon: LayoutDashboard, Component: AntarcticNavDashboard },
  { id: 'icebergs', label: 'Iceberg tracker', icon: Radar, Component: IcebergTracker },
  { id: 'history', label: 'Route history', icon: History, Component: RouteHistory },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const ActiveComponent = TABS.find((t) => t.id === activeTab).Component;

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', fontFamily: FONT_SANS }}>
      <style>{`@import url('${FONT_IMPORT_URL}');`}</style>

      <nav
        className="flex items-center gap-1 px-5 pt-4"
        style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                color: active ? COLORS.ice : COLORS.iceMuted,
                padding: '10px 14px',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <ActiveComponent />
    </div>
  );
}
