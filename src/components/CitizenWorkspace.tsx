import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { ApiError } from '../services/api'
import { CleanCityEvidence } from './CleanCityEvidence'
import {
  createPickupRequest,
  getPickupRequest,
  MAX_PICKUP_PHOTO_BYTES,
  uploadPickupEvidence,
  type PickupCategory,
  type PickupRequest,
  type PickupRequestCreate,
} from '../services/pickupRequests'
import { PickupRequestEvidence } from './PickupRequestEvidence'
import {
  submitCleanCityReport,
  uploadCleanCityEvidence,
  listCleanCityReports,
  listCleanCityAwareness,
  type CleanCityReport,
  type CleanCityReportCategory,
  type CleanCityAwareness,
} from '../services/cleancity'

const INITIAL_MAP_CENTER: [number, number] = [12.968, 77.648]

const categories: { value: PickupCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General waste' },
  { value: 'RECYCLABLE', label: 'Recyclables' },
  { value: 'ORGANIC', label: 'Organic waste' },
  { value: 'HAZARDOUS', label: 'Hazardous waste' },
  { value: 'E_WASTE', label: 'Electronic waste' },
  { value: 'OTHER', label: 'Other' },
]

function getRequestError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'Your account is not authorized to access this information.'
    if (error.status === 422) return error.message
    return error.message
  }

  if (error instanceof TypeError) {
    return 'Could not connect to UrbanNova. Check your connection and try again.'
  }

  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred. Please try again.'
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MapClickSelector({
  onSelect,
}: {
  onSelect: (position: [number, number]) => void
}) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

function MapFocus({ position }: { position: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.6 })
  }, [map, position])

  return null
}

export function CitizenOverview({
  name,
  requests,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  name: string
  requests: PickupRequest[]
  loading: boolean
  error: string
  onRetry: () => void
  onNavigate: (page: string) => void
}) {
  const counts = {
    total: requests.length,
    pending: requests.filter((request) => request.status === 'PENDING').length,
    approved: requests.filter((request) => request.status === 'APPROVED').length,
    rejected: requests.filter((request) => request.status === 'REJECTED').length,
  }
  const countValue = (count: number) =>
    loading ? '…' : error ? '—' : String(count)

  return (
    <section className="citizen-workspace">
      <header className="citizen-welcome panel">
        <div>
          <span className="section-kicker">CITIZEN WORKSPACE</span>
          <h1>Welcome, {name}</h1>
          <p>Request a waste pickup and follow its status from your account.</p>
        </div>
        <button
          className="button-primary citizen-primary-action"
          onClick={() => onNavigate('Request Pickup')}
        >
          <Plus size={16} />
          Request Waste Pickup
          <ArrowRight size={15} />
        </button>
      </header>

      <div className="citizen-stats-grid" aria-label="Pickup request statistics">
        {[
          { label: 'Total requests', value: countValue(counts.total), icon: MapPin, tone: 'lime' },
          { label: 'Pending', value: countValue(counts.pending), icon: Clock3, tone: 'orange' },
          { label: 'Approved', value: countValue(counts.approved), icon: CheckCircle2, tone: 'cyan' },
          { label: 'Rejected', value: countValue(counts.rejected), icon: XCircle, tone: 'violet' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article className={`citizen-stat-card citizen-stat-${tone}`} key={label}>
            <div className="citizen-stat-icon"><Icon size={18} /></div>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>

      {error && (
        <div className="citizen-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="text-button" onClick={onRetry}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      <section className="panel citizen-recent-panel">
        <div className="citizen-panel-heading">
          <div>
            <span className="section-kicker">PICKUP ACTIVITY</span>
            <h2>Recent requests</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => onNavigate('My Requests')}
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <p className="citizen-empty-state" aria-live="polite">Loading your requests…</p>
        ) : error && requests.length === 0 ? (
          <p className="citizen-empty-state">Your request history is currently unavailable.</p>
        ) : requests.length === 0 ? (
          <div className="citizen-empty-state">
            <p>No pickup requests yet.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate('Request Pickup')}
            >
              Make your first request <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="citizen-recent-list">
            {requests.slice(0, 5).map((request) => (
              <button
                type="button"
                className="citizen-recent-row"
                key={request.id}
                onClick={() => onNavigate('My Requests')}
              >
                <span className="citizen-request-id">#{request.id}</span>
                <span className="citizen-recent-copy">
                  <strong>{request.category.replaceAll('_', ' ')}</strong>
                  <small>{request.location}</small>
                </span>
                <span className={`citizen-status citizen-status-${request.status.toLowerCase()}`}>
                  {statusLabel(request.status)}
                </span>
                <span className="citizen-request-date">{formatDate(request.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export function PickupRequestForm({
  onSubmitted,
  onUnauthorized,
}: {
  onSubmitted: () => Promise<void>
  onUnauthorized: () => void
}) {
  const [category, setCategory] = useState<PickupCategory | ''>('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [evidence, setEvidence] = useState<File | null>(null)
  const [evidenceInputKey, setEvidenceInputKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [success, setSuccess] = useState('')

  function useBrowserLocation() {
    setLocationError('')

    if (!navigator.geolocation) {
      setLocationError('Location access is not available in this browser.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude])
        setLocationError('')
        setLocating(false)
      },
      (geoError) => {
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission was denied. Allow access or choose a point on the map.'
            : 'Could not get your location. Choose a point on the map or try again.',
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  function selectMapPosition(nextPosition: [number, number]) {
    setPosition(nextPosition)
    setLocationError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!position) {
      setError('Choose your pickup point on the map or use your current location.')
      return
    }

    if (!category || location.trim().length < 3) {
      setError('Choose a waste category and enter a pickup location.')
      return
    }

    if (evidence && !['image/jpeg', 'image/png'].includes(evidence.type)) {
      setError('Pickup photos must be JPEG or PNG images.')
      return
    }
    if (evidence && evidence.size > MAX_PICKUP_PHOTO_BYTES) {
      setError('Pickup photos must be 5 MB or smaller.')
      return
    }

    const request: PickupRequestCreate = {
      category,
      description: description.trim() || null,
      location: location.trim(),
      latitude: position[0],
      longitude: position[1],
    }

    setSubmitting(true)
    try {
      const created = await createPickupRequest(request)
      setSuccess(`Pickup request #${created.id} was submitted successfully.`)
      setCategory('')
      setDescription('')
      setLocation('')
      setPosition(null)
      setEvidence(null)
      setEvidenceInputKey((key) => key + 1)

      if (evidence) {
        try {
          await uploadPickupEvidence(created.id, evidence)
          setSuccess(`Pickup request #${created.id} was submitted with photo evidence.`)
        } catch (uploadError) {
          setError(
            `Request #${created.id} was submitted, but photo upload failed: ${getRequestError(uploadError)}`,
          )
          if (uploadError instanceof ApiError && uploadError.status === 401) {
            onUnauthorized()
          }
        }
      }

      try {
        await onSubmitted()
      } catch (refreshError) {
        setError(
          `Request #${created.id} was submitted, but the history could not be refreshed: ${getRequestError(refreshError)}`,
        )
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          onUnauthorized()
        }
      }
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        onUnauthorized()
      } else {
        setError(getRequestError(submitError))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="citizen-workspace">
      <div className="section-heading citizen-page-heading">
        <div>
          <span className="section-kicker">NEW SERVICE REQUEST</span>
          <h2>Request Waste Pickup</h2>
          <p>Enter the pickup details and select the exact location on the map.</p>
        </div>
      </div>

      <div className="citizen-form-grid">
        <form className="panel citizen-form-card" onSubmit={handleSubmit}>
          <label className="citizen-field">
            Waste category
            <select
              value={category}
              onChange={(event) => {
                const selectedCategory = categories.find(
                  (item) => item.value === event.target.value,
                )
                setCategory(selectedCategory?.value ?? '')
              }}
              required
            >
              <option value="">Select a category</option>
              {categories.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="citizen-field">
            Photo evidence <span className="citizen-optional">(optional, JPEG or PNG up to 5 MB)</span>
            <input
              key={evidenceInputKey}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => {
                setEvidence(event.target.files?.[0] ?? null)
                setError('')
              }}
            />
          </label>

          <label className="citizen-field">
            Pickup location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Street address, landmark, or area"
              minLength={3}
              maxLength={255}
              autoComplete="street-address"
              required
            />
          </label>

          <label className="citizen-field">
            Description <span className="citizen-optional">(optional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add helpful details about the waste or access to the pickup point."
              rows={4}
            />
          </label>

          <div className="citizen-coordinate-grid">
            <label className="citizen-field">
              Latitude
              <input
                value={position?.[0].toFixed(6) ?? ''}
                placeholder="Select on map"
                readOnly
              />
            </label>
            <label className="citizen-field">
              Longitude
              <input
                value={position?.[1].toFixed(6) ?? ''}
                placeholder="Select on map"
                readOnly
              />
            </label>
          </div>

          {!position && (
            <p className="citizen-coordinate-hint">
              Coordinates are required and will only be submitted after you select a map point or use your location.
            </p>
          )}
          {error && <p className="citizen-alert citizen-form-alert" role="alert">{error}</p>}
          {success && <p className="citizen-success" role="status">{success}</p>}

          <button className="button-primary citizen-submit" type="submit" disabled={submitting}>
            {submitting ? 'Submitting request…' : 'Submit pickup request'}
            {!submitting && <ArrowRight size={15} />}
          </button>
        </form>

        <article className="panel citizen-map-card">
          <div className="citizen-map-heading">
            <div>
              <span className="section-kicker">PICKUP LOCATION</span>
              <h2>Select on map</h2>
            </div>
            <button
              type="button"
              className="button-secondary citizen-locate-button"
              onClick={useBrowserLocation}
              disabled={locating}
            >
              <LocateFixed size={15} />
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <p className="citizen-map-instruction">
            Pan and zoom, then click the exact pickup point. The initial map view is not used as your location.
          </p>
          {locationError && <p className="citizen-alert citizen-form-alert" role="alert">{locationError}</p>}
          <div className="citizen-map">
            <MapContainer
              center={INITIAL_MAP_CENTER}
              zoom={12}
              scrollWheelZoom
              className="leaflet-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickSelector onSelect={selectMapPosition} />
              <MapFocus position={position} />
              {position && (
                <CircleMarker
                  center={position}
                  radius={9}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: '#c9ff4a',
                    fillOpacity: 1,
                  }}
                >
                  <Popup>Selected pickup location</Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </div>
          <p className="citizen-selected-location">
            {position
              ? `Selected: ${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
              : 'No coordinates selected'}
          </p>
        </article>
      </div>
    </section>
  )
}

export function MyPickupRequests({
  requests,
  loading,
  error,
  onRefresh,
  onRequestPickup,
  onUnauthorized,
}: {
  requests: PickupRequest[]
  loading: boolean
  error: string
  onRefresh: () => void
  onRequestPickup: () => void
  onUnauthorized: () => void
}) {
  const [selectedRequest, setSelectedRequest] = useState<PickupRequest | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  async function openRequest(requestId: number) {
    if (selectedRequest?.id === requestId) {
      setSelectedRequest(null)
      setDetailError('')
      return
    }

    setDetailLoading(true)
    setDetailError('')
    try {
      setSelectedRequest(await getPickupRequest(requestId))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      } else {
        setDetailError(getRequestError(requestError))
      }
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <section className="citizen-workspace">
      <div className="section-heading citizen-page-heading">
        <div>
          <span className="section-kicker">YOUR SERVICE HISTORY</span>
          <h2>My Pickup Requests</h2>
          <p>Review request details and track the latest status.</p>
        </div>
        <div className="citizen-history-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={onRequestPickup}
          >
            <Plus size={15} /> Request pickup
          </button>
        </div>
      </div>

      {error && <div className="citizen-alert" role="alert">{error}</div>}
      {detailError && <div className="citizen-alert" role="alert">{detailError}</div>}

      <div className="citizen-request-list">
        {loading && requests.length === 0 ? (
          <div className="panel citizen-empty-state" aria-live="polite">Loading your requests…</div>
        ) : error && requests.length === 0 ? (
          <div className="panel citizen-empty-state">Your request history is currently unavailable.</div>
        ) : requests.length === 0 ? (
          <div className="panel citizen-empty-state">
            <h3>No pickup requests yet</h3>
            <p>Your submitted requests will appear here with their review status.</p>
            <button type="button" className="button-primary" onClick={onRequestPickup}>
              Request Waste Pickup <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          requests.map((request) => (
            <article className="panel citizen-request-card" key={request.id}>
              <div className="citizen-request-card-top">
                <div>
                  <span className="citizen-request-id">REQUEST #{request.id}</span>
                  <h3>{request.category.replaceAll('_', ' ')}</h3>
                </div>
                <span className={`citizen-status citizen-status-${request.status.toLowerCase()}`}>
                  {statusLabel(request.status)}
                </span>
              </div>
              <div className="citizen-request-summary">
                <span><MapPin size={14} /> {request.location}</span>
                <span>Submitted {formatDate(request.created_at)}</span>
              </div>
              {request.admin_note && (
                <p className="citizen-admin-note">
                  <strong>Admin note:</strong> {request.admin_note}
                </p>
              )}
              <button
                type="button"
                className="citizen-details-toggle"
                aria-expanded={selectedRequest?.id === request.id}
                onClick={() => void openRequest(request.id)}
                disabled={detailLoading}
              >
                {detailLoading && selectedRequest?.id !== request.id
                  ? 'Loading details…'
                  : selectedRequest?.id === request.id
                    ? 'Close details'
                    : 'View details'}
                <ArrowRight size={14} />
              </button>

              {selectedRequest?.id === request.id && (
                <div className="citizen-request-details">
                  <div><span>Description</span><strong>{selectedRequest.description || 'No description provided'}</strong></div>
                  <div><span>Coordinates</span><strong>{selectedRequest.latitude.toFixed(6)}, {selectedRequest.longitude.toFixed(6)}</strong></div>
                  <div><span>Last updated</span><strong>{formatDate(selectedRequest.updated_at)}</strong></div>
                  {selectedRequest.admin_note && (
                    <div><span>Admin note</span><strong>{selectedRequest.admin_note}</strong></div>
                  )}
                  {selectedRequest.evidence_url && (
                    <PickupRequestEvidence
                      requestId={selectedRequest.id}
                      onUnauthorized={onUnauthorized}
                    />
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export function CitizenReportHistory({
  onUnauthorized,
}: {
  onUnauthorized: () => void
}) {
  const [reports, setReports] = useState<CleanCityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<CleanCityReportCategory>('LITTER')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [evidence, setEvidence] = useState<File | null>(null)
  const [evidenceInputKey, setEvidenceInputKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [locationMessage, setLocationMessage] = useState('')

  const refreshReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setReports(await listCleanCityReports())
    } catch (requestError) {
      setError(getRequestError(requestError))
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      }
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void refreshReports()
  }, [refreshReports])

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!position) {
      setError('Select the report location on the map.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const report = await submitCleanCityReport({
        category,
        description: description.trim(),
        latitude: position[0],
        longitude: position[1],
      })
      const selectedEvidence = evidence
      setDescription('')
      setPosition(null)
      setEvidence(null)
      setEvidenceInputKey((key) => key + 1)
      setSuccess(`CleanCity report #${report.id} submitted.`)
      await refreshReports()
      if (selectedEvidence) {
        try {
          await uploadCleanCityEvidence(report.id, selectedEvidence)
          setSuccess(`CleanCity report #${report.id} submitted with photo evidence.`)
          await refreshReports()
        } catch (uploadError) {
          setError(`Report #${report.id} was submitted, but photo upload failed: ${getRequestError(uploadError)}`)
          if (uploadError instanceof ApiError && uploadError.status === 401) {
            onUnauthorized()
          }
        }
      }
    } catch (requestError) {
      setError(getRequestError(requestError))
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      }
    } finally {
      setSubmitting(false)
    }
  }

  function useCurrentLocation() {
    setLocationMessage('')
    if (!navigator.geolocation) {
      setLocationMessage('Location access is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (
          !Number.isFinite(coords.latitude) ||
          coords.latitude < -90 ||
          coords.latitude > 90 ||
          !Number.isFinite(coords.longitude) ||
          coords.longitude < -180 ||
          coords.longitude > 180
        ) {
          setLocationMessage('The browser returned invalid coordinates.')
          return
        }
        setPosition([coords.latitude, coords.longitude])
      },
      () => setLocationMessage('Could not access your location. Select it on the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <section className="citizen-workspace">
      <div className="section-heading citizen-page-heading">
        <div>
          <span className="section-kicker">COMMUNITY REPORTING</span>
          <h2>Citizen Reports</h2>
          <p>Reports submitted from your account and their current status.</p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void refreshReports()}
          disabled={loading}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="citizen-alert" role="alert">{error}</div>}
      {success && <div className="citizen-alert" role="status">{success}</div>}

      <form className="panel citizen-report-form" onSubmit={(event) => void submitReport(event)}>
        <div className="citizen-panel-heading">
          <div>
            <span className="section-kicker">NEW CLEANCITY REPORT</span>
            <h2>Report waste or litter</h2>
          </div>
        </div>
        <div className="citizen-request-form-grid">
          <label className="citizen-field">
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as CleanCityReportCategory)}>
              <option value="OVERFLOWING_BIN">Overflowing bin</option>
              <option value="ILLEGAL_DUMPING">Illegal dumping</option>
              <option value="LITTER">Litter</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="citizen-field">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={1}
              maxLength={1000}
              required
              rows={3}
            />
          </label>
          <label className="citizen-field">
            Photo evidence <span className="citizen-optional">(optional)</span>
            <input
              key={evidenceInputKey}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="citizen-location-block">
          <div className="citizen-map-heading">
            <span>Select the exact location</span>
            <button type="button" className="button-secondary citizen-locate-button" onClick={useCurrentLocation}>
              <LocateFixed size={14} /> Use my location
            </button>
          </div>
          <div className="citizen-map">
            <MapContainer center={position ?? INITIAL_MAP_CENTER} zoom={12} scrollWheelZoom className="leaflet-map">
              <MapFocus position={position} />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickSelector onSelect={setPosition} />
              {position && (
                <CircleMarker
                  center={position}
                  radius={8}
                  pathOptions={{ color: '#c9ff4a', fillColor: '#c9ff4a', fillOpacity: 0.9 }}
                >
                  <Popup>Selected report location</Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </div>
          <p className="citizen-selected-location">
            {position
              ? `Selected: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
              : 'Click the map to select a location.'}
          </p>
          {locationMessage && <p className="citizen-alert" role="alert">{locationMessage}</p>}
        </div>
        <div className="citizen-form-footer">
          <span />
          <button type="submit" className="button-primary" disabled={submitting || !position}>
            {submitting ? 'Submitting…' : 'Submit report'} <ArrowRight size={14} />
          </button>
        </div>
      </form>

      {loading && reports.length === 0 ? (
        <div className="panel citizen-empty-state" aria-live="polite">
          Loading your reports…
        </div>
      ) : error && reports.length === 0 ? (
        <div className="panel citizen-empty-state">
          Your reports are currently unavailable.
        </div>
      ) : reports.length === 0 ? (
        <div className="panel citizen-empty-state">
          <FileText size={22} />
          <h3>No submitted reports</h3>
          <p>Reports submitted from your account will appear here.</p>
        </div>
      ) : (
        <div className="citizen-request-list">
          {reports.map((report) => (
            <article className="panel citizen-request-card" key={report.id}>
              <div className="citizen-request-card-top">
                <div>
                  <span className="citizen-request-id">REPORT #{report.id}</span>
                  <h3>{statusLabel(report.category)}</h3>
                </div>
                <span className={`citizen-status citizen-status-${report.status.toLowerCase()}`}>
                  {statusLabel(report.status)}
                </span>
              </div>
              <div className="citizen-request-summary">
                <span><MapPin size={14} /> {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</span>
                <span><CalendarDays size={13} /> Submitted {formatDate(report.submitted_at)}</span>
              </div>
              <p className="citizen-report-description">{report.description}</p>
              {report.evidence_url && (
                <CleanCityEvidence reportId={report.id} onUnauthorized={onUnauthorized} />
              )}
              {report.status_updates.length > 0 && (
                <div className="citizen-status-history" aria-label="Report status updates">
                  <strong>Status updates</strong>
                  {report.status_updates.map((update) => (
                    <p key={`${update.status}-${update.at}`}>
                      <span>{statusLabel(update.status)}</span>
                      <time dateTime={update.at}>{formatDate(update.at)}</time>
                      {update.reason && <small>{update.reason}</small>}
                      {update.resolution_note && <small>Resolution: {update.resolution_note}</small>}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function CommunityAwareness({
  onUnauthorized,
}: {
  onUnauthorized: () => void
}) {
  const [items, setItems] = useState<CleanCityAwareness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listCleanCityAwareness())
    } catch (requestError) {
      setError(getRequestError(requestError))
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      }
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <section className="citizen-workspace">
      <div className="section-heading citizen-page-heading">
        <div>
          <span className="section-kicker">CLEAN CITY</span>
          <h2>Community awareness</h2>
          <p>Practical guidance from UrbanNova’s cleanliness awareness resources.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <div className="citizen-alert" role="alert">{error}</div>}
      {loading && items.length === 0 ? (
        <div className="panel citizen-empty-state" aria-live="polite">Loading awareness content…</div>
      ) : items.length === 0 ? (
        <div className="panel citizen-empty-state">
          {error ? 'Awareness content is currently unavailable.' : 'No awareness content is available yet.'}
        </div>
      ) : (
        <div className="citizen-request-list">
          {items.map((item) => (
            <article className="panel citizen-request-card" key={item.id}>
              <span className="section-kicker">{statusLabel(item.category)}</span>
              <h3>{item.title}</h3>
              <p className="citizen-report-description">{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export { getRequestError }
