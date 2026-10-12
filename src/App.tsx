
import { useState } from 'react'
import {
  Activity,
  Bell,
  ChevronRight,
  LayoutDashboard,
  Map,
  Menu,
  Recycle,
  Route,
  Settings,
  Truck,
  Users,
  X,
} from 'lucide-react'
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route as RouterRoute,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import DashboardPage from './DashboardPage'
import AuthPage from './AuthPage'
import './App.css'

const navigation = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'GIS Map', path: '/map', icon: Map },
  { label: 'Route Optimization', path: '/routes', icon: Route },
  { label: 'Fleet Management', path: '/fleet', icon: Truck },
  { label: 'CleanCity', path: '/cleancity', icon: Recycle },
  { label: 'Citizen Reports', path: '/reports', icon: Users },
  { label: 'Analytics', path: '/analytics', icon: Activity },
]

function AuthRoute() {
  const navigate = useNavigate()

  function handleLogin(role: 'citizen' | 'admin') {
    // Temporary demo navigation only. Not real authentication.
    sessionStorage.setItem('urbannova-demo-role', role)
    navigate('/dashboard')
  }

  return <AuthPage onLogin={handleLogin} />
}

function FeaturePage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className="un-feature-page">
      <div className="un-eyebrow">
        URBANNOVA <span> / </span> MUNICIPAL OPERATIONS
      </div>
      <h1>{title}</h1>
      <p className="un-feature-description">{description}</p>

      <div className="un-feature-card">
        <div className="un-feature-icon">
          <Activity size={24} />
        </div>
        <h2>Your workspace starts here.</h2>
        <p>
          This section has its own page. Its interactive features
          will be developed in the next stages.
        </p>
        <div className="un-coming-soon">
          <span />
          MODULE READY FOR DEVELOPMENT
        </div>
      </div>
    </section>
  )
}

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const currentPage =
    navigation.find((item) => item.path === location.pathname)?.label ??
    'Overview'

  function signOut() {
    sessionStorage.removeItem('urbannova-demo-role')
    navigate('/login')
  }

  return (
    <div className="un-shell">
      {menuOpen && (
        <button
          className="un-mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`un-sidebar ${menuOpen ? 'un-sidebar-open' : ''}`}>
        <NavLink
          to="/dashboard"
          className="un-brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="un-brand-mark">
            <Recycle size={23} />
          </span>
          <span>
            <strong>UrbanNova</strong>
            <small>SMART CITY OPERATIONS</small>
          </span>
        </NavLink>

        <div className="un-nav-caption">WORKSPACE</div>

        <nav className="un-nav">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `un-nav-link ${isActive ? 'un-nav-active' : ''}`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.path === '/dashboard' && (
                  <ChevronRight className="un-nav-chevron" size={15} />
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="un-sidebar-bottom">
          <div className="un-system-status">
            <span className="un-status-dot" />
            <div>
              <strong>UrbanNova System</strong>
              <small>Frontend demo environment</small>
            </div>
          </div>

          <button
            className="un-settings-link"
            onClick={() =>
              window.alert('Settings will be added in a later step.')
            }
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <button className="un-settings-link" onClick={signOut}>
            <X size={17} />
            <span>Sign out (demo)</span>
          </button>
        </div>
      </aside>

      <main className="un-main">
        <header className="un-mobile-header">
          <button
            className="un-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span>{currentPage}</span>
          <Bell size={19} />
        </header>

        <div className="un-page-holder">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <RouterRoute path="/login" element={<AuthRoute />} />

        <RouterRoute element={<AppLayout />}>
          <RouterRoute
            index
            element={<Navigate to="/login" replace />}
          />

          <RouterRoute
            path="/dashboard"
            element={<DashboardPage />}
          />

          <RouterRoute
            path="/map"
            element={
              <FeaturePage
                title="GIS Command Map"
                description="Explore collection zones, waste hotspots and geographic operations."
              />
            }
          />

          <RouterRoute
            path="/routes"
            element={
              <FeaturePage
                title="Route Optimization"
                description="Plan efficient collection routes and compare distance, time and fuel."
              />
            }
          />

          <RouterRoute
            path="/fleet"
            element={
              <FeaturePage
                title="Fleet Management"
                description="Manage collection vehicles, driver assignments and fleet status."
              />
            }
          />

          <RouterRoute
            path="/cleancity"
            element={
              <FeaturePage
                title="CleanCity"
                description="Support citizen participation, cleaner neighbourhoods and rewards."
              />
            }
          />

          <RouterRoute
            path="/reports"
            element={
              <FeaturePage
                title="Citizen Reports"
                description="Review litter complaints and their resolution status."
              />
            }
          />

          <RouterRoute
            path="/analytics"
            element={
              <FeaturePage
                title="Impact Analytics"
                description="Track collection performance, fuel use and estimated emissions."
              />
            }
          />

          <RouterRoute
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </RouterRoute>
      </Routes>
    </BrowserRouter>
  )
}

export default App
