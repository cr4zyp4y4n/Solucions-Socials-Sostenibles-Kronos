import React, { useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { ObradorProvider, useObrador } from './ObradorContext';
import ObradorDashboardPage from './ObradorDashboardPage';
import ObradorRecepcionsPage from './ObradorRecepcionsPage';
import ObradorProductesPage from './ObradorProductesPage';
import ObradorLotsPage from './ObradorLotsPage';
import ObradorExpedicionsPage from './ObradorExpedicionsPage';
import ObradorIncidenciesPage from './ObradorIncidenciesPage';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'recepcions', label: 'Recepcions' },
  { id: 'productes', label: 'Productes', roles: ['admin', 'management', 'manager'] },
  { id: 'lots', label: 'Lots' },
  { id: 'expedicions', label: 'Expedicions' },
  { id: 'incidencies', label: 'Incidències', roles: ['admin', 'management', 'manager'] }
];

function ObradorShell() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentView, navigateTo } = useObrador();

  const role = (user?.user_metadata?.role || '').toLowerCase();

  const tabsVisibles = useMemo(
    () => TABS.filter((tab) => {
      if (!tab.roles) return true;
      return tab.roles.includes(role);
    }),
    [role]
  );

  function renderView() {
    switch (currentView) {
      case 'dashboard':
        return <ObradorDashboardPage />;
      case 'recepcions':
        return <ObradorRecepcionsPage />;
      case 'productes':
        return <ObradorProductesPage />;
      case 'lots':
        return <ObradorLotsPage />;
      case 'expedicions':
        return <ObradorExpedicionsPage />;
      case 'incidencies':
        return <ObradorIncidenciesPage />;
      default:
        return <ObradorDashboardPage />;
    }
  }

  return (
    <div style={{ width: '100%', minHeight: '100%', background: colors.background }}>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 24px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          overflowX: 'auto',
          flexWrap: 'nowrap'
        }}
      >
        {tabsVisibles.map((tab) => {
          const actiu = currentView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: actiu ? 600 : 400,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: actiu ? `${colors.primary}22` : 'transparent',
                color: actiu ? colors.primary : colors.textSecondary
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      <div>{renderView()}</div>
    </div>
  );
}

export default function ObradorApp() {
  return (
    <ObradorProvider>
      <ObradorShell />
    </ObradorProvider>
  );
}
