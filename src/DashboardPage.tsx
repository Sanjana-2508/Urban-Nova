
import { useEffect, useState, type CSSProperties } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Check, ChevronDown, ChevronRight, CircleHelp, CloudSun,
  Download, Leaf, LayoutDashboard, Map as MapIcon, Menu, MoreHorizontal,
  Navigation, Recycle, Route, Search, Settings, ShieldCheck, Sparkles,
  Truck, Users, X, Zap, LogOut,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const navGroups = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Live GIS map', icon: MapIcon },
      { label: 'Route planner', icon: Route },
      { label: 'Fleet management', icon: Truck },
      { label: 'Collection points', icon: Recycle },
    ],
  },
  {
    title: 'CLEAN CITY',
    items: [
      { label: 'Citizen reports', icon: ShieldCheck },
      { label: 'Community impact', icon: Users },
      { label: 'Analytics', icon: Activity },
    ],
  },
]

const metrics = [
  { label: 'Bins monitored', value: '1,284', change: '+8.2%', detail: 'vs. last week', icon: Recycle, kind: 'lime', trend: 'up' },
  { label: 'Fleet operational', value: '24/28', change: '85.7%', detail: 'vehicles available', icon: Truck, kind: 'cyan', trend: 'up' },
  { label: 'Pickups completed', value: '186', change: '77.5%', detail: 'of today’s schedule', icon: Check, kind: 'violet', trend: 'up' },
  { label: 'Open reports', value: '17', change: '6 urgent', detail: 'awaiting resolution', icon: AlertTriangle, kind: 'orange', trend: 'down' },
]

const performance = [
  { day: 'MON', collection: 68, target: 58 },
  { day: 'TUE', collection: 82, target: 65 },
  { day: 'WED', collection: 74, target: 62 },
  { day: 'THU', collection: 91, target: 70 },
  { day: 'FRI', collection: 78, target: 67 },
  { day: 'SAT', collection: 96, target: 76 },
  { day: 'SUN', collection: 86, target: 72 },
]

const stops = [
  { name: 'Indiranagar · Sector 04', time: '09:42 AM', status: 'Priority', color: '#c9ff4a', bins: 12, position: [12.9784, 77.6408] as [number, number] },
  { name: 'Domlur Collection Point', time: '09:36 AM', status: 'On schedule', color: '#4edce0', bins: 8, position: [12.9609, 77.6387] as [number, number] },
  { name: 'HAL 2nd Stage', time: '09:28 AM', status: 'Completed', color: '#a4a6ff', bins: 16, position: [12.9675, 77.6532] as [number, number] },
  { name: 'Old Airport Road', time: '09:16 AM', status: 'Attention', color: '#ffb66d', bins: 9, position: [12.9592, 77.6651] as [number, number] },
]

const routeLine: [number, number][] = [
  [12.9784, 77.6408],
  [12.9719, 77.6412],
  [12.9675, 77.6532],
  [12.9609, 77.6387],
  [12.9592, 77.6651],
]

// Nearest-neighbour demo using geographic coordinates.
// This is not a road-network or live-traffic routing service.
function optimizeCollectionStops(source: typeof stops) {
  const remaining = [...source]
  const result: typeof stops = []
  let current = remaining.shift()

  if (!current) return result
  result.push(current)

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity

    remaining.forEach((candidate, index) => {
      const latitudeDifference =
        candidate.position[0] - current!.position[0]
      const longitudeDifference =
        (candidate.position[1] - current!.position[1]) *
        Math.cos((current!.position[0] * Math.PI) / 180)

      const distance = Math.hypot(
        latitudeDifference,
        longitudeDifference,
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    const next = remaining.splice(nearestIndex, 1)[0]
    if (!next) break

    current = next
    result.push(next)
  }

  return result
}

const activity = [
  { title: 'Collection completed', subtitle: 'Truck KA-03-MN-2184 · Indiranagar', time: '4m ago', icon: Check, tone: 'lime' },
  { title: 'New citizen report', subtitle: 'Overflowing bin · 100 Feet Road', time: '12m ago', icon: ShieldCheck, tone: 'cyan' },
  { title: 'Route recalculated', subtitle: 'Route R-08 · 2 stops reordered', time: '19m ago', icon: Route, tone: 'violet' },
]

const demoTrucks = [
  { id: 'KA-03-MN-2184', position: [12.9742, 77.6451] as [number, number], status: 'Collecting waste' },
  { id: 'KA-03-MN-3921', position: [12.9638, 77.6494] as [number, number], status: 'En route to next stop' },
  { id: 'KA-03-MN-1056', position: [12.9701, 77.6601] as [number, number], status: 'Route in progress' },
]

const citizenReports = [
  { id: 'CR-101', title: 'Overflowing bin', area: '100 Feet Road', urgent: true },
  { id: 'CR-102', title: 'Waste near footpath', area: 'Indiranagar', urgent: false },
  { id: 'CR-103', title: 'Missed waste pickup', area: 'Domlur', urgent: true },
  { id: 'CR-104', title: 'Litter hotspot', area: 'HAL 2nd Stage', urgent: false },
]

function exportUrbanNovaReport() {
  const rows = [
    ['Report Type', 'Name / Vehicle ID', 'Status', 'Bins', 'Last Update'],
    ...stops.map((stop) => [
      'Collection Point', stop.name, stop.status, String(stop.bins), stop.time,
    ]),
    ...demoTrucks.map((truck) => [
      'Fleet Vehicle', truck.id, truck.status, 'N/A', 'N/A',
    ]),
  ]

  const csv = rows
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `UrbanNova_Report_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const garbageTruckIcon = L.divIcon({
  className: 'urban-truck-icon',
  html: '<div style="width:36px;height:36px;border-radius:50%;background:#c9ff4a;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 3px 12px #0009;">🚛</div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function CurrentLocationControl() {
  const map = useMap()
  const [position, setPosition] = useState<[number, number] | null>(null)

  useEffect(() => {
    const control = new L.Control({ position: 'topleft' })

    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'urban-location-control')
      const button = L.DomUtil.create('button', 'location-control', container) as HTMLButtonElement

      button.type = 'button'
      button.textContent = '◎ Locate me'
      button.title = 'Show my current location'
      button.setAttribute('aria-label', 'Show my current location')

      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)

      L.DomEvent.on(button, 'click', () => {
        if (!navigator.geolocation) {
          window.alert('Your browser does not support location access.')
          return
        }

        button.disabled = true
        button.textContent = 'Locating…'

        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            const nextPosition: [number, number] = [coords.latitude, coords.longitude]
            setPosition(nextPosition)
            map.flyTo(nextPosition, 16, { duration: 1.5 })
            button.disabled = false
            button.textContent = '◎ Locate me'
          },
          (error) => {
            button.disabled = false
            button.textContent = '◎ Locate me'
            window.alert(
              error.code === 1
                ? 'Location permission denied. Allow location access in your browser.'
                : 'Could not get your location. Please try again.',
            )
          },
          { enableHighAccuracy: true, timeout: 15000 },
        )
      })

      return container
    }

    control.addTo(map)
    return () => {
  control.remove()
}
  }, [map])

  return position ? (
    <CircleMarker
      center={position}
      radius={9}
      pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#58a6ff', fillOpacity: 1 }}
    >
      <Popup>
        <strong>Your current location</strong>
        <br />
        Provided by your browser
      </Popup>
    </CircleMarker>
  ) : null
}

function RouteMap({ optimized }: { optimized: boolean }) {
  const displayedStops = optimized ? optimizeCollectionStops(stops) : stops
  const positions = optimized
    ? displayedStops.map((stop) => stop.position)
    : routeLine

  return (
    <MapContainer
      center={[12.968, 77.648]}
      zoom={13}
      scrollWheelZoom
      className="leaflet-map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <CurrentLocationControl />
      <Polyline
        positions={positions}
        pathOptions={{ color: '#4edce0', weight: 4, dashArray: '8 7' }}
      />
      {stops.map((stop) => (
        <CircleMarker
          key={stop.name}
          center={stop.position}
          radius={8}
          pathOptions={{ color: stop.color, fillColor: stop.color, fillOpacity: 1 }}
        >
          <Popup>
            <strong>{stop.name}</strong>
            <br />
            Status: {stop.status}
            <br />
            Bins: {stop.bins}
            <br />
            Last update: {stop.time}
          </Popup>
        </CircleMarker>
      ))}
      {demoTrucks.map((truck) => (
        <Marker key={truck.id} position={truck.position} icon={garbageTruckIcon}>
          <Popup>
            <strong>{truck.id}</strong>
            <br />
            {truck.status}
            <br />
            Simulated demo location
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

function SectionPage({
  active,
  onNavigate,
  optimized,
  onToggleOptimize,
}: {
  active: string
  onNavigate: (page: string) => void
  optimized: boolean
  onToggleOptimize: () => void
}) {
  const [resolvedReports, setResolvedReports] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [collectionStatuses, setCollectionStatuses] = useState<Record<string, string>>({})
  const [fleetStatuses, setFleetStatuses] = useState<Record<string, string>>({})

  const heading: Record<string, string> = {
    'Live GIS map': 'Live GIS map',
    'Route planner': 'Route planner',
    'Fleet management': 'Fleet management',
    'Collection points': 'Collection points',
    'Citizen reports': 'Citizen reports',
    'Community impact': 'Community impact',
    Analytics: 'Collection analytics',
    Settings: 'Settings',
    'Help & support': 'Help & support',
  }

  const descriptions: Record<string, string> = {
    'Live GIS map': 'Explore simulated truck locations and collection stops across East Bengaluru.',
    'Route planner': 'Review the collection sequence and simulate route optimization.',
    'Fleet management': 'Monitor the demo fleet and vehicle status.',
    'Collection points': 'Browse collection locations and update their demo service status.',
    'Citizen reports': 'Review sample public reports and mark them as resolved.',
    'Community impact': 'Explore estimated environmental and operational impact.',
    Analytics: 'Review collection performance using the available demo dataset.',
    Settings: 'Manage your local dashboard preferences.',
    'Help & support': 'Find your way around the UrbanNova frontend preview.',
  }

  const displayedStops = optimized ? optimizeCollectionStops(stops) : stops

  return (
    <section className="section-page">
      <div className="section-heading">
        <div>
          <span className="section-kicker">URBANNOVA WORKSPACE</span>
          <h2>{heading[active] ?? active}</h2>
          <p>{descriptions[active] ?? 'Explore UrbanNova dashboard tools.'}</p>
        </div>
        <span className="demo-tag">DEMO DATA</span>
      </div>

      {active === 'Live GIS map' && (
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">GEOSPATIAL INTELLIGENCE</span>
              <h2>East Bengaluru operations</h2>
              <p>Click any marker to inspect its details.</p>
            </div>
          </div>
          <div className="map-frame">
            <RouteMap optimized={optimized} />
          </div>
          <div className="map-bottom">
            <span>3 simulated trucks · {stops.length} sample stops</span>
            <button onClick={() => onNavigate('Route planner')}>
              Open route planner <ArrowRight size={14} />
            </button>
          </div>
        </article>
      )}

      {active === 'Route planner' && (
        <>
          <div className="route-summary-grid">
            <div className="route-summary-card">
              <span>Total stops</span>
              <strong>{stops.length}</strong>
            </div>
            <div className="route-summary-card">
              <span>Estimated distance</span>
              <strong>12.8 km</strong>
            </div>
            <div className="route-summary-card">
              <span>Estimated duration</span>
              <strong>48 min</strong>
            </div>
          </div>

          <article className="panel stops-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">ROUTE R-08</span>
                <h2>{optimized ? 'Demo route reordered' : 'Planned collection sequence'}</h2>
                <p>
                  {optimized
                    ? 'A simulated nearest-stop sequence has been applied.'
                    : 'Sample route · 12.8 km · 4 collection stops'}
                </p>
              </div>
              <button className="button-primary" onClick={onToggleOptimize}>
                <Zap size={16} />
                {optimized ? 'Reset demo' : 'Optimize route'}
              </button>
            </div>

            <div className="stops-list">
              {displayedStops.map((stop, index) => (
                <div className="stop-row" key={stop.name}>
                  <div className="stop-marker" style={{ '--stop-color': stop.color } as CSSProperties}>
                    {index + 1}
                  </div>
                  <div className="stop-copy">
                    <strong>{stop.name}</strong>
                    <span>{stop.bins} bins · {stop.time}</span>
                  </div>
                  <span className="status-pill">
                    {optimized ? 'Demo reordered' : stop.status}
                  </span>
                  <button
                    className="icon-button stop-arrow"
                    aria-label={`Locate ${stop.name}`}
                    onClick={() => onNavigate('Live GIS map')}
                  >
                    <Navigation size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="panel-bottom-link">
              <button onClick={() => onNavigate('Live GIS map')}>
                View route on map <ArrowRight size={15} />
              </button>
            </div>
          </article>
        </>
      )}

      {active === 'Fleet management' && (
        <div className="metrics-grid">
          {demoTrucks.map((truck, index) => {
            const status = fleetStatuses[truck.id] ?? truck.status
            return (
              <article className="metric-card metric-cyan" key={truck.id}>
                <div className="metric-icon"><Truck size={19} /></div>
                <div className="metric-value">{truck.id}</div>
                <div className="metric-label">{status}</div>
                <p>Vehicle {index + 1} · Simulated location</p>
                <button className="text-button" onClick={() => onNavigate('Live GIS map')}>
                  Locate truck <ArrowRight size={14} />
                </button>
                <button
                  className="button-secondary"
                  onClick={() => setFleetStatuses((previous) => ({
                    ...previous,
                    [truck.id]: status === 'Maintenance (demo)' ? truck.status : 'Maintenance (demo)',
                  }))}
                >
                  {status === 'Maintenance (demo)' ? 'Restore vehicle' : 'Mark maintenance'}
                </button>
              </article>
            )
          })}
        </div>
      )}

      {active === 'Collection points' && (
        <article className="panel stops-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">SERVICE LOCATIONS</span>
              <h2>Collection point status</h2>
              <p>Update the status for this local demo.</p>
            </div>
          </div>
          <div className="stops-list">
            {stops.map((stop) => {
              const status = collectionStatuses[stop.name] ?? stop.status
              return (
                <div className="stop-row" key={stop.name}>
                  <div className="stop-marker" style={{ '--stop-color': stop.color } as CSSProperties}>
                    <Recycle size={16} />
                  </div>
                  <div className="stop-copy">
                    <strong>{stop.name}</strong>
                    <span>{stop.bins} bins · Updated {stop.time}</span>
                  </div>
                  <span className="status-pill">{status}</span>
                  <button
                    className="button-secondary"
                    onClick={() => setCollectionStatuses((previous) => ({
                      ...previous,
                      [stop.name]: status === 'Collected (demo)' ? stop.status : 'Collected (demo)',
                    }))}
                  >
                    {status === 'Collected (demo)' ? 'Undo' : 'Mark collected'}
                  </button>
                  <button
                    className="icon-button stop-arrow"
                    aria-label={`View ${stop.name} on map`}
                    onClick={() => onNavigate('Live GIS map')}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              )
            })}
          </div>
        </article>
      )}

      {active === 'Citizen reports' && (
        <article className="panel stops-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">COMMUNITY REPORTING</span>
              <h2>Reports requiring attention</h2>
              <p>Sample reports for frontend demonstration.</p>
            </div>
            <span className="demo-tag">{citizenReports.filter((report) => !resolvedReports.includes(report.id)).length} OPEN</span>
          </div>
          {citizenReports.map((report) => {
            const resolved = resolvedReports.includes(report.id)
            return (
              <div className="stop-row" key={report.id}>
                <div className="stop-marker"><ShieldCheck size={16} /></div>
                <div className="stop-copy">
                  <strong>{report.title}</strong>
                  <span>{report.id} · {report.area}</span>
                </div>
                <span className="status-pill">
                  {resolved ? 'Resolved (demo)' : report.urgent ? 'Urgent' : 'Open'}
                </span>
                <button
                  className="button-secondary"
                  disabled={resolved}
                  onClick={() => setResolvedReports((previous) => [...previous, report.id])}
                >
                  {resolved ? 'Done' : 'Resolve'}
                </button>
              </div>
            )
          })}
          {resolvedReports.length > 0 && (
            <div className="panel-bottom-link">
              <button onClick={() => setResolvedReports([])}>
                Reset report statuses <ArrowRight size={15} />
              </button>
            </div>
          )}
        </article>
      )}

      {active === 'Community impact' && (
        <div className="metrics-grid">
          {[
            { label: 'Estimated emissions change', value: '−18.4%', detail: 'Demo estimate' },
            { label: 'Collection stops', value: '45', detail: 'Sample service area' },
            { label: 'Completed pickups', value: '186', detail: 'Sample daily total' },
            { label: 'Community reports', value: String(citizenReports.length), detail: 'Sample report records' },
          ].map((item) => (
            <article className="metric-card metric-lime" key={item.label}>
              <div className="metric-icon"><Leaf size={19} /></div>
              <div className="metric-value">{item.value}</div>
              <div className="metric-label">{item.label}</div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      )}

      {active === 'Analytics' && (
        <article className="panel performance-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">WEEKLY PERFORMANCE</span>
              <h2>Collections vs daily target</h2>
              <p>Illustrative data, not live municipal data.</p>
            </div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performance}>
                <CartesianGrid stroke="#293431" strokeDasharray="3 5" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="collection" name="Completed" stroke="#c9ff4a" fill="#c9ff4a" fillOpacity={0.15} />
                <Area type="monotone" dataKey="target" name="Target" stroke="#4edce0" fill="#4edce0" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <button className="text-button" onClick={() => onNavigate('Overview')}>
            Back to overview <ArrowRight size={14} />
          </button>
          <button className="button-secondary" onClick={exportUrbanNovaReport}>
            <Download size={15} /> Export CSV report
          </button>
        </article>
      )}

      {active === 'Settings' && (
        <article className="panel stops-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">PREFERENCES</span>
              <h2>Dashboard settings</h2>
              <p>These settings apply to this page preview only.</p>
            </div>
          </div>
          <div className="stop-row">
            <div className="stop-copy">
              <strong>Notifications</strong>
              <span>Show the dashboard notification indicator.</span>
            </div>
            <button className="button-secondary" onClick={() => setNotificationsEnabled((enabled) => !enabled)}>
              {notificationsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="stop-row">
            <div className="stop-copy">
              <strong>Demo data</strong>
              <span>UrbanNova currently displays simulated data.</span>
            </div>
            <span className="demo-tag">ACTIVE</span>
          </div>
        </article>
      )}

      {active === 'Help & support' && (
        <article className="panel stops-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">QUICK HELP</span>
              <h2>Explore UrbanNova</h2>
              <p>Choose a workspace to continue.</p>
            </div>
          </div>
          {[
            ['Live GIS map', 'Inspect truck and collection-point markers.'],
            ['Route planner', 'Review the sample route and simulate optimization.'],
            ['Citizen reports', 'Review and resolve sample reports.'],
            ['Analytics', 'Explore the weekly collection chart.'],
          ].map(([page, description]) => (
            <div className="stop-row" key={page}>
              <div className="stop-copy">
                <strong>{page}</strong>
                <span>{description}</span>
              </div>
              <button className="button-secondary" onClick={() => onNavigate(page)}>
                Open <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </article>
      )}
    </section>
  )
}

function App() {
  const [active, setActive] = useState('Overview')
  const [optimized, setOptimized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState('This week')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const searchItems = [
    ...navGroups.flatMap((group) =>
      group.items.map((item) => ({
        label: item.label,
        detail: 'Open workspace page',
        page: item.label,
      })),
    ),
    ...stops.map((stop) => ({
      label: stop.name,
      detail: `${stop.bins} bins · ${stop.status}`,
      page: 'Live GIS map',
    })),
    ...demoTrucks.map((truck) => ({
      label: truck.id,
      detail: truck.status,
      page: 'Live GIS map',
    })),
    { label: 'Settings', detail: 'Dashboard preferences', page: 'Settings' },
    { label: 'Help & support', detail: 'Quick help', page: 'Help & support' },
  ]

  const filteredSearchItems = searchItems
    .filter((item) =>
      `${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    )
    .slice(0, 8)

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-symbol"><Leaf size={21} strokeWidth={2.4} /></div>
          <div className="brand-name">
            urban<span>nova</span>
            <small>CITY INTELLIGENCE</small>
          </div>
          <button className="sidebar-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="workspace-switch">
          <div className="workspace-avatar">BLR</div>
          <div className="workspace-copy">
            <strong>Bengaluru Ops</strong>
            <span>Municipal workspace</span>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <div className="nav-list">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-label">{group.title}</div>
              {group.items.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setActive(label)
                    setSidebarOpen(false)
                  }}
                  className={`nav-item ${active === label ? 'nav-active' : ''}`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{label}</span>
                  {label === 'Citizen reports' && <span className="nav-count">17</span>}
                  {active === label && <span className="active-indicator" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="eco-card">
            <div className="eco-top"><Sparkles size={15} /><span>YOUR CITY, CLEANER</span></div>
            <div className="eco-number">−18.4%</div>
            <p>estimated emissions with optimized routes</p>
            <div className="eco-progress"><span /></div>
            <small>DEMO ESTIMATE · WEEKLY</small>
          </div>
          <button className="nav-item" onClick={() => setActive('Settings')}>
            <Settings size={17} /><span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setActive('Help & support')}>
            <CircleHelp size={17} /><span>Help &amp; support</span>
          </button>
          <button className="nav-item logout-button" onClick={() => { window.location.href = '/login' }}>
            <LogOut size={17} /><span>Log out</span>
          </button>
          <div className="profile-row">
            <div className="profile-avatar">RR</div>
            <div className="profile-copy">
              <strong>Operations Admin</strong>
              <span>Municipal administrator</span>
            </div>
            <MoreHorizontal size={19} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
              <Menu size={21} />
            </button>
            <span className="breadcrumb-muted">Workspace</span>
            <ChevronRight size={14} className="muted-icon" />
            <span className="breadcrumb-current">{active}</span>
          </div>

          <div className="topbar-actions">
            <div className="demo-badge"><span /> DEMO ENVIRONMENT</div>

            <div className="search-wrap">
              <button
                type="button"
                className="icon-button search-shortcut"
                aria-label="Search"
                aria-expanded={searchOpen}
                onClick={() => {
                  setSearchOpen((open) => !open)
                  setSearchQuery('')
                }}
              >
                <Search size={18} />
              </button>
              {searchOpen && (
                <div className="search-popover">
                  <input
                    autoFocus
                    type="search"
                    placeholder="Search pages, trucks, stops..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  <div className="search-results">
                    {filteredSearchItems.length > 0 ? filteredSearchItems.map((item) => (
                      <button
                        type="button"
                        key={`${item.page}-${item.label}`}
                        onClick={() => {
                          setActive(item.page)
                          setSearchOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <Search size={15} />
                        <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                        <ArrowRight size={14} />
                      </button>
                    )) : <p>No matching results found.</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="notification-wrap">
              <button
                type="button"
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                <i />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  <p>6 reports need attention.</p>
                  <p>Route R-08 was recalculated.</p>
                  <button type="button" onClick={() => setNotificationsOpen(false)}>Dismiss</button>
                </div>
              )}
            </div>
            <div className="topbar-avatar">RR</div>
          </div>
        </header>

        <div className="page-content">
          {active === 'Overview' ? (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="live-dot" /> CITY OPERATIONS OVERVIEW</div>
                  <h1>City operations,<br className="mobile-break" /> <span>in motion.</span></h1>
                  <p className="welcome-subtitle">A clearer view of collection activity across your service area.</p>
                </div>
                <div className="welcome-tools">
                  <div className="weather-chip">
                    <CloudSun size={18} />
                    <span><strong>28°C</strong><small>Bengaluru</small></span>
                  </div>
                  <button className="button-secondary" onClick={exportUrbanNovaReport}>
                    <Download size={16} /> Export report
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => {
                      setOptimized(true)
                      setActive('Route planner')
                    }}
                  >
                    <Zap size={16} /> Optimize routes <ArrowRight size={15} />
                  </button>
                </div>
              </section>

              <section className="hero-strip">
                <div className="hero-text">
                  <div className="hero-tag"><span /> INTELLIGENT COLLECTION</div>
                  <h2>Less distance.<br /><span>More impact.</span></h2>
                  <p>Smarter routes. Cleaner streets. A city that works better for everyone.</p>
                  <button className="hero-cta" onClick={() => setActive('Route planner')}>
                    Explore route planner <ArrowRight size={16} />
                  </button>
                </div>
                <div className="hero-graphic" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="hero-globe">
                    <div className="globe-line globe-line-one" />
                    <div className="globe-line globe-line-two" />
                    <div className="globe-line globe-line-three" />
                    <Leaf size={55} strokeWidth={1.2} />
                  </div>
                  <div className="floating-tag tag-top">
                    <span className="tag-dot cyan-dot" /><span>LIVE FLEET</span><strong>24 active</strong>
                  </div>
                  <div className="floating-tag tag-bottom">
                    <span className="tag-dot lime-dot" /><span>ROUTE STATUS</span><strong>{optimized ? 'Optimized' : 'Planned'}</strong>
                  </div>
                  <div className="graphic-cross cross-one">+</div>
                  <div className="graphic-cross cross-two">+</div>
                </div>
                <div className="hero-footer">
                  <span><span className="live-dot" /> SYSTEMS OPERATIONAL</span>
                  <span>GIS ENGINE <b>DEMO MODE</b></span>
                  <span>LAST SYNC · 09:42 AM</span>
                </div>
              </section>

              <section className="section-heading metrics-heading">
                <div>
                  <span className="section-kicker">AT A GLANCE</span>
                  <h2>Today’s pulse <span className="demo-tag">DEMO DATA</span></h2>
                </div>
                <button className="text-button" onClick={() => setActive('Analytics')}>
                  View all analytics <ArrowRight size={15} />
                </button>
              </section>

              <section className="metrics-grid">
                {metrics.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <article className={`metric-card metric-${metric.kind}`} key={metric.label}>
                      <div className="metric-top">
                        <div className="metric-icon"><Icon size={18} /></div>
                        <button className="icon-button tiny-more" aria-label={`More about ${metric.label}`}>
                          <MoreHorizontal size={19} />
                        </button>
                      </div>
                      <div className="metric-value">{metric.value}</div>
                      <div className="metric-label">{metric.label}</div>
                      <div className="metric-foot">
                        <span className={`metric-change ${metric.trend === 'up' ? 'change-up' : 'change-warn'}`}>
                          {metric.trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {metric.change}
                        </span>
                        <span>{metric.detail}</span>
                      </div>
                      <div className="mini-sparkline">
                        <svg viewBox="0 0 130 28" preserveAspectRatio="none">
                          <path d={metric.kind === 'orange'
                            ? 'M0 5 C15 10 22 3 36 14 S60 23 76 12 S106 20 130 25'
                            : 'M0 25 C15 22 20 5 35 13 S55 22 70 8 S96 14 110 4 S122 7 130 2'} />
                        </svg>
                      </div>
                    </article>
                  )
                })}
              </section>

              <section className="dashboard-grid">
                <article className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">GEOSPATIAL INTELLIGENCE</span>
                      <h2>Live collection map <span className="map-live"><i /> LIVE</span></h2>
                      <p>Collection activity · East Bengaluru</p>
                    </div>
                    <button className="icon-button panel-menu" aria-label="Map options" onClick={() => setActive('Live GIS map')}>
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  <div className="map-stats">
                    <span><i className="legend-dot legend-lime" /> Collection points <b>45</b></span>
                    <span><i className="legend-dot legend-cyan" /> Active routes <b>08</b></span>
                    <span><i className="legend-dot legend-orange" /> Hotspots <b>06</b></span>
                  </div>
                  <div className="map-frame">
                    <RouteMap optimized={optimized} />
                    <div className="map-live-pill"><span className="live-dot" /> TRACKING ACTIVE</div>
                    <div className="map-zoom-controls">
                      <button onClick={() => setActive('Live GIS map')} aria-label="Open full map">
                        <Navigation size={16} />
                      </button>
                    </div>
                    <div className="map-overlay-card">
                      <span className="overlay-label">ROUTE R-08</span>
                      <strong><span /> {optimized ? 'Optimized (demo)' : 'On track'}</strong>
                      <div>12.8 km <i /> 4 stops</div>
                    </div>
                  </div>
                  <div className="map-bottom">
                    <span><span className="live-dot" /> Map uses OpenStreetMap</span>
                    <button onClick={() => setActive('Live GIS map')}>Open full map <ArrowRight size={14} /></button>
                  </div>
                </article>

                <article className="panel performance-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">COLLECTION ANALYTICS</span>
                      <h2>Collection performance</h2>
                      <p>Daily completion index · demo</p>
                    </div>
                    <button className="select-period" onClick={() => setPeriod(period === 'This week' ? 'Last week' : 'This week')}>
                      {period}<ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="chart-summary">
                    <div>
                      <span>COMPLETION INDEX</span>
                      <strong>{period === 'This week' ? '86.4' : '79.2'}<small>%</small></strong>
                    </div>
                    <span className="chart-change"><ArrowUpRight size={14} /> 6.8% <small>vs prior period</small></span>
                  </div>
                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performance} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="limeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c9ff4a" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#c9ff4a" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4edce0" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#4edce0" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#293431" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71827a', fontSize: 10, fontWeight: 600 }} dy={9} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71827a', fontSize: 10 }} domain={[0, 110]} />
                        <Tooltip contentStyle={{ background: '#18221f', border: '1px solid #34443d', borderRadius: 10, color: '#f3f6ef', fontSize: 12 }} />
                        <Area type="monotone" dataKey="collection" name="Completed" stroke="#c9ff4a" strokeWidth={2.5} fill="url(#limeGradient)" activeDot={{ r: 4, fill: '#c9ff4a', stroke: '#18221f', strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="target" name="Target" stroke="#4edce0" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#cyanGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend">
                    <span><i className="legend-dot legend-lime" /> Completed collections</span>
                    <span><i className="legend-dot legend-cyan" /> Daily target</span>
                  </div>
                  <div className="performance-insight">
                    <div className="insight-icon"><Zap size={16} /></div>
                    <p><strong>Looking good.</strong> Completion is trending above the demo target this week.</p>
                  </div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel stops-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">FIELD OPERATIONS</span>
                      <h2>Collection points</h2>
                      <p>Latest service-area activity</p>
                    </div>
                    <button className="text-button" onClick={() => setActive('Collection points')}>View all <ArrowRight size={14} /></button>
                  </div>
                  <div className="stops-list">
                    {stops.map((stop) => (
                      <div className="stop-row" key={stop.name}>
                        <div className="stop-marker" style={{ '--stop-color': stop.color } as CSSProperties}><MapIcon size={16} /></div>
                        <div className="stop-copy">
                          <strong>{stop.name}</strong>
                          <span>{stop.time} <i /> {stop.bins} bins</span>
                        </div>
                        <span className={`status-pill ${stop.status.toLowerCase().replace(' ', '-')}`}><i />{stop.status}</span>
                        <button className="icon-button stop-arrow" aria-label={`View ${stop.name}`} onClick={() => setActive('Live GIS map')}>
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="panel-bottom-link">
                    <button onClick={() => setActive('Collection points')}>Explore all collection points <ArrowRight size={15} /></button>
                  </div>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">WHAT'S HAPPENING</span>
                      <h2>Recent activity</h2>
                      <p>Latest system events · demo</p>
                    </div>
                    <button className="icon-button panel-menu" aria-label="Activity options" onClick={() => setActive('Analytics')}>
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                  <div className="activity-list">
                    {activity.map((item) => {
                      const Icon = item.icon
                      return (
                        <div className="activity-row" key={item.title}>
                          <div className={`activity-icon activity-${item.tone}`}><Icon size={16} /></div>
                          <div className="activity-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></div>
                          <span className="activity-time">{item.time}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="impact-mini">
                    <div className="impact-orb"><Leaf size={20} /></div>
                    <div>
                      <span>ESTIMATED IMPACT</span>
                      <strong>Cleaner routes, lighter footprint.</strong>
                      <p>Fuel and emissions savings will be calculated after backend integration.</p>
                    </div>
                  </div>
                  <button className="activity-link" onClick={() => setActive('Analytics')}>Explore impact analytics <ArrowRight size={15} /></button>
                </article>
              </section>

              <footer className="page-footer">
                <span>© 2026 UrbanNova <i /> Built for cleaner, smarter cities.</span>
                <span><i className="footer-dot" /> FRONTEND PREVIEW <b>v0.1.0</b></span>
              </footer>
            </>
          ) : (
            <SectionPage
              active={active}
              onNavigate={setActive}
              optimized={optimized}
              onToggleOptimize={() => setOptimized((current) => !current)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
