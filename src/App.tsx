import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import TechnicalScanner from './pages/TechnicalScanner';
import PairsTrading from './pages/PairsTrading';
import MLSignals from './pages/MLSignals';
import StressTestLab from './pages/StressTestLab';
import Settings from './pages/Settings';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/scanner', label: 'Technical Scanner', icon: '🔧' },
  { to: '/pairs', label: 'Pairs Trading', icon: '📈' },
  { to: '/ml', label: 'ML Signals', icon: '🤖' },
  { to: '/stress', label: 'Stress Test Lab', icon: '🔬' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function RoutedPages() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scanner" element={<TechnicalScanner />} />
        <Route path="/pairs" element={<PairsTrading />} />
        <Route path="/ml" element={<MLSignals />} />
        <Route path="/stress" element={<StressTestLab />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen">
        {/* Sidebar */}
        <nav className="w-56 flex-shrink-0 flex flex-col p-4 border-r"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--accent-blue)' }}>
            🤖 Trading Bot v2
          </h1>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    isActive ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  color: 'var(--text-primary)',
                })}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="mt-auto pt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
            ⚠️ Not financial advice.<br />Past performance ≠ future results.
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-primary)' }}>
          <RoutedPages />
        </main>
      </div>
    </BrowserRouter>
  );
}
