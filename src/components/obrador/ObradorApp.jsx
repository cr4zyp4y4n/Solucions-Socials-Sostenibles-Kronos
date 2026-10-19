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
import ObradorRegistresTornPage from './ObradorRegistresTornPage';
import ObradorExportacioPage from './ObradorExportacioPage';
import ObradorEscandallsPage from './ObradorEscandallsPage';
import ObradorKpisMensualPage from './ObradorKpisMensualPage';
import ObradorFinancamentBanner from './ObradorFinancamentBanner';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'recepcions', label: 'Recepcions' },
  { id: 'productes', label: 'Productes', roles: ['admin', 'management', 'manager'] },
  { id: 'lots', label: 'Lots' },
  { id: 'expedicions', label: 'Expedicions' },
  { id: 'incidencies', label: 'Incidències', roles: ['admin', 'management', 'manager'] },
  { id: 'registres-torn', label: 'Registres de torn' },
  { id: 'exportacio', label: 'Exportació' },
  { id: 'escandalls', label: 'Escandalls', roles: ['admin', 'management', 'manager'], provisional: true },
  { id: 'kpis-mensuals', label: 'KPIs mensuals', roles: ['admin', 'management', 'manager'], provisional: true }
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
      case 'registres-torn':
        return <ObradorRegistresTornPage />;
      case 'exportacio':
        return <ObradorExportacioPage />;
      case 'escandalls':
        return <ObradorEscandallsPage />;
      case 'kpis-mensuals':
        return <ObradorKpisMensualPage />;
      default:
        return <ObradorDashboardPage />;
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      background: colors.background,
      boxSizing: 'border-box'
    }}>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 24px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          overflowX: 'auto',
          flexWrap: 'nowrap',
          flexShrink: 0
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
              {tab.provisional ? (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75 }}>·</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1 }}>{renderView()}</div>
      <ObradorFinancamentBanner />
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
