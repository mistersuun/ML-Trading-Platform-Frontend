import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ThemeToggle from './components/ui/ThemeToggle';
import { HeaderSlotContext } from './components/ui/headerSlot';
import Overview from './pages/Overview';
import TechnicalScanner from './pages/TechnicalScanner';
import PairsTrading from './pages/PairsTrading';
import MLSignals from './pages/MLSignals';
import StressTestLab from './pages/StressTestLab';
import Allocation from './pages/Allocation';
import Risk from './pages/Risk';
import Settings from './pages/Settings';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/pairs', label: 'Pairs' },
  { to: '/ml', label: 'ML' },
  { to: '/stress', label: 'Stress' },
  { to: '/allocation', label: 'Allocation' },
  { to: '/risk', label: 'Risk & orders' },
  { to: '/settings', label: 'Settings' },
];

function RoutedPages() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/scanner" element={<TechnicalScanner />} />
        <Route path="/pairs" element={<PairsTrading />} />
        <Route path="/ml" element={<MLSignals />} />
        <Route path="/stress" element={<StressTestLab />} />
        <Route path="/allocation" element={<Allocation />} />
        <Route path="/risk" element={<Risk />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  // The 40px header bar is a portal target: each page's <PageHeader> renders into it.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', background: 'var(--bg)' }}>
        <nav
          className="side" aria-label="Main"
          style={{ flex: '0 0 200px', padding: '12px 0', borderRight: '1px solid var(--border)', background: 'var(--sidebar)' }}
        >
          <div style={{ padding: '4px 12px 14px', fontWeight: 600 }}>Trading platform</div>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'on' : undefined)}>
              {item.label}
            </NavLink>
          ))}
          <div className="side-foot" style={{ padding: '16px 12px 0', color: 'var(--text-3)', fontSize: 12 }}>
            <div style={{ marginBottom: 10 }}><ThemeToggle compact /></div>
            Paper trading only. Not financial advice.
          </div>
        </nav>

        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header
            ref={setSlot}
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', minHeight: 40,
              padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel)',
            }}
          />
          <main style={{ padding: 16, maxWidth: 1240, width: '100%' }}>
            <HeaderSlotContext.Provider value={slot}>
              <RoutedPages />
            </HeaderSlotContext.Provider>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
