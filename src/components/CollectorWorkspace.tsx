import { useEffect, useState } from 'react'
import {
  listSavedRoutes,
  type SavedRoute,
} from '../services/routing'

import {
  listVehicles,
  type VehicleRecord,
} from '../services/vehicles'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Route,
  Truck,
} from 'lucide-react'
import { ApiError } from '../services/api'
import {
  updateCollectionStatus,
  type CollectionRecord,
  type CollectionStatus,
} from '../services/collections'
import { getRequestError } from './CitizenWorkspace'
import { LiveGISMap } from './LiveGISMap'
import type { AuthenticatedUser } from '../services/auth'

export type CollectorWorkspaceMode =
  | 'overview'
  | 'collections'
  | 'map'
  | 'route'

type CollectorWorkspaceProps = {
  mode: CollectorWorkspaceMode
  user: AuthenticatedUser
  collections: CollectionRecord[]
  loading: boolean
  error: string
  onRefresh: () => void
  routeRefreshKey: number
  onUnauthorized: () => void
  onCollectionUpdated: (collection: CollectionRecord) => void
  onNavigate: (page: string) => void
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

function statusLabel(status: CollectionStatus) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isScheduledToday(value: string) {
  const scheduledDate = new Date(value)
  const today = new Date()

  return (
    !Number.isNaN(scheduledDate.getTime()) &&
    scheduledDate.getFullYear() === today.getFullYear() &&
    scheduledDate.getMonth() === today.getMonth() &&
    scheduledDate.getDate() === today.getDate()
  )
}

function nextStatus(status: CollectionStatus) {
  if (status === 'SCHEDULED' || status === 'ASSIGNED') return 'IN_PROGRESS'
  if (status === 'IN_PROGRESS') return 'COMPLETED'
  return null
}

function CollectionCard({
  collection,
  updating,
  disabled,
  onUpdate,
}: {
  collection: CollectionRecord
  updating: boolean
  disabled: boolean
  onUpdate: (collection: CollectionRecord) => void
}) {
  const actionStatus = nextStatus(collection.status)
  const actionLabel =
    actionStatus === 'IN_PROGRESS'
      ? 'Start collection'
      : actionStatus === 'COMPLETED'
        ? 'Mark completed'
        : null

  return (
    <article className="panel collector-collection-card">
      <div className="collector-collection-top">
        <div>
          <span className="citizen-request-id">COLLECTION #{collection.id}</span>
          <h3>{collection.location}</h3>
        </div>
        <span
          className={`collector-status-badge collector-status-${collection.status.toLowerCase()}`}
        >
          {statusLabel(collection.status)}
        </span>
      </div>
      <div className="collector-collection-meta">
        <span><CalendarDays size={14} /> {formatDate(collection.scheduled_date)}</span>
        <span><Truck size={14} /> {collection.waste_type.replaceAll('_', ' ')}</span>
      </div>
      {collection.notes && (
        <p className="collector-collection-notes">{collection.notes}</p>
      )}
      {collection.completed_at && (
        <p className="collector-collection-completed">
          <CheckCircle2 size={14} /> Completed {formatDate(collection.completed_at)}
        </p>
      )}
      {actionLabel && actionStatus && (
        <button
          type="button"
          className={actionStatus === 'COMPLETED' ? 'button-secondary' : 'button-primary'}
          onClick={() => onUpdate(collection)}
          disabled={disabled}
        >
          {updating ? 'Updating…' : actionLabel}
          {!updating && <ArrowRight size={14} />}
        </button>
      )}
    </article>
  )
}

export function CollectorWorkspace({
  mode,
  user,
  collections,
  loading,
  error,
  onRefresh,
  routeRefreshKey,
  onUnauthorized,
  onCollectionUpdated,
  onNavigate,
}: CollectorWorkspaceProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const counts = {
    total: collections.length,
    pending: collections.filter(
      (item) => item.status === 'SCHEDULED' || item.status === 'ASSIGNED',
    ).length,
    inProgress: collections.filter((item) => item.status === 'IN_PROGRESS').length,
    completed: collections.filter((item) => item.status === 'COMPLETED').length,
    today: collections.filter(
      (item) =>
        item.status !== 'CANCELLED' && isScheduledToday(item.scheduled_date),
    ).length,
  }

  async function handleStatusUpdate(collection: CollectionRecord) {
    const status = nextStatus(collection.status)
    if (!status || updatingId !== null) return

    setUpdatingId(collection.id)
    setActionError('')
    setActionSuccess('')
    try {
      const updated = await updateCollectionStatus(collection.id, status)
      onCollectionUpdated(updated)
      setActionSuccess(
        `Collection #${updated.id} is now ${statusLabel(updated.status)}.`,
      )
    } catch (requestError) {
      setActionError(getRequestError(requestError))
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized()
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const heading = {
    overview: 'Your assigned work',
    collections: 'Assigned collections',
    map: 'Assigned collection map',
    route: 'Assigned route',
  }[mode]

  return (
    <section className="collector-workspace">
      {mode === 'overview' ? (
        <header className="panel collector-welcome">
          <div>
            <span className="section-kicker">COLLECTOR WORKSPACE</span>
            <h1>Welcome, {user.name}</h1>
            <p>Here is the latest status of your assigned collection work.</p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh assignments
          </button>
        </header>
      ) : (
        <div className="section-heading collector-page-heading">
          <div>
            <span className="section-kicker">COLLECTOR WORKSPACE</span>
            <h2>{heading}</h2>
            <p>
              {mode === 'collections'
                ? 'Only collections assigned to your account are listed.'
                : mode === 'map'
                  ? 'Map layers show municipal reference locations and your assigned collection locations.'
                  : 'View your Admin-optimized collection sequence, assigned vehicle and collection progress.'}
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      {error && <div className="collector-alert" role="alert">{error}</div>}
      {actionError && <div className="collector-alert" role="alert">{actionError}</div>}
      {actionSuccess && <div className="collector-success" role="status">{actionSuccess}</div>}

      {mode === 'overview' && (
        <div className="collector-stats-grid">
          {[
            { label: 'Assigned collections', value: counts.total, icon: Route, tone: 'lime' },
            { label: 'Pending', value: counts.pending, icon: Clock3, tone: 'orange' },
            { label: 'In progress', value: counts.inProgress, icon: Truck, tone: 'cyan' },
            { label: 'Completed', value: counts.completed, icon: CheckCircle2, tone: 'violet' },
            { label: 'Scheduled today', value: counts.today, icon: CalendarDays, tone: 'lime' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <article className={`collector-stat-card collector-stat-${tone}`} key={label}>
              <div className="collector-stat-icon"><Icon size={17} /></div>
              <strong>{loading && collections.length === 0 ? '…' : error && collections.length === 0 ? '—' : value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      )}

      {mode === 'map' ? (
        <LiveGISMap
          user={user}
          onUnauthorized={onUnauthorized}
          collections={collections}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
          showCollectorRouteSummaries={false}
        />
      ) : mode === 'route' ? (
        <AssignedRoutePanel
          user={user}
          collections={collections}
          loading={loading}
          updatingId={updatingId}
          onUpdate={(collection) => void handleStatusUpdate(collection)}
          onUnauthorized={onUnauthorized}
          routeRefreshKey={routeRefreshKey}
        />
      ) : mode === 'overview' ? (
        <article className="panel collector-assigned-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">NEXT ASSIGNMENTS</span>
              <h2>Assigned work</h2>
              <p>Upcoming work and current collection status.</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate('Collection points')}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <CollectionList
            collections={collections.slice(0, 4)}
            loading={loading}
            error={error}
            updatingId={updatingId}
            onUpdate={(collection) => void handleStatusUpdate(collection)}
            onRefresh={onRefresh}
          />
        </article>
      ) : (
        <CollectionList
          collections={collections}
          loading={loading}
          error={error}
          updatingId={updatingId}
          onUpdate={(collection) => void handleStatusUpdate(collection)}
          onRefresh={onRefresh}
        />
      )}
    </section>
  )
}

function CollectionList({
  collections,
  loading,
  error,
  updatingId,
  onUpdate,
  onRefresh,
}: {
  collections: CollectionRecord[]
  loading: boolean
  error: string
  updatingId: number | null
  onUpdate: (collection: CollectionRecord) => void
  onRefresh: () => void
}) {
  if (loading && collections.length === 0) {
    return <div className="collector-empty-state" aria-live="polite">Loading assigned collections…</div>
  }

  if (error && collections.length === 0) {
    return (
      <div className="collector-empty-state">
        <p>Assigned collections are unavailable.</p>
        <button type="button" className="button-secondary" onClick={onRefresh}>
          Retry
        </button>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="collector-empty-state">
        <Route size={20} />
        <h3>No assigned collections</h3>
        <p>New assignments will appear here when they are assigned to your account.</p>
      </div>
    )
  }

  return (
    <div className="collector-collection-list">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          updating={updatingId === collection.id}
          disabled={updatingId !== null}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}


function AssignedRoutePanel({
  user,
  collections,
  loading,
  updatingId,
  onUpdate,
  onUnauthorized,
  routeRefreshKey,
}: {
  user: AuthenticatedUser
  collections: CollectionRecord[]
  loading: boolean
  updatingId: number | null
  onUpdate: (collection: CollectionRecord) => void
  onUnauthorized: () => void
  routeRefreshKey: number
}) {
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [routeLoading, setRouteLoading] = useState(true)
  const [routeError, setRouteError] = useState('')

  useEffect(() => {
    let active = true

    async function loadRoutes() {
      setRouteLoading(true)
      setRouteError('')

      try {
        const [savedRoutes, assignedVehicles] = await Promise.all([
          listSavedRoutes(),
          listVehicles(),
        ])

        if (!active) return

        const assignedIds = new Set(collections.map((item) => item.id))

        const myRoutes = savedRoutes.filter(
          (route) =>
            route.collector_id === user.id ||
            route.collection_ids.some((id) => assignedIds.has(id)),
        )

        setRoutes(myRoutes)
        setVehicles(assignedVehicles)
      } catch (requestError) {
        if (!active) return

        setRouteError(getRequestError(requestError))

        if (
          requestError instanceof ApiError &&
          requestError.status === 401
        ) {
          onUnauthorized()
        }
      } finally {
        if (active) setRouteLoading(false)
      }
    }

    void loadRoutes()

    return () => {
      active = false
    }
  }, [user.id, collections, onUnauthorized, routeRefreshKey])

  if (routeLoading) {
    return (
      <div className="collector-empty-state" aria-live="polite">
        Loading your assigned routes…
      </div>
    )
  }

  if (routeError) {
    return (
      <div className="collector-empty-state" role="alert">
        <p>Unable to load assigned routes: {routeError}</p>
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <div className="collector-empty-state">
        <Route size={22} />
        <h3>No assigned route available</h3>
        <p>
          Routes optimized and assigned by Admin will appear here.
        </p>
        {collections.length > 0 && (
          <p>
            You currently have {collections.length} assigned collection(s).
            Check the Assigned Collections section for their details.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="collector-route-summaries">
      {routes.map((route) => {
        const routeCollections = route.collection_ids
          .map((id) => collections.find((item) => item.id === id))
          .filter((item): item is CollectionRecord => item !== undefined)

        const completedCount = routeCollections.filter(
          (item) => item.status === 'COMPLETED',
        ).length

        const vehicle = vehicles.find(
          (item) => item.id === route.vehicle_id,
        )

        return (
          <article className="panel collector-route-summary" key={route.id}>
            <div className="admin-record-heading">
              <div>
                <span className="section-kicker">YOUR OPTIMIZED ROUTE</span>
                <h3>Route #{route.id}</h3>
              </div>
              <span className="admin-status-pill admin-status-assigned">
                {route.status}
              </span>
            </div>

            <div className="admin-record-grid">
              <div>
                <span>Assigned vehicle</span>
                <strong>
                  {vehicle
                    ? `${vehicle.vehicle_number} · ${vehicle.vehicle_type}`
                    : route.vehicle_id
                      ? `Vehicle #${route.vehicle_id}`
                      : 'No vehicle assigned'}
                </strong>
              </div>

              <div>
                <span>Collection progress</span>
                <strong>
                  {completedCount} of {route.collection_ids.length} completed
                </strong>
              </div>

              <div>
                <span>Route distance</span>
                <strong>
                  {route.geometry_distance_km.toFixed(2)} km
                </strong>
              </div>

              <div>
                <span>Estimated travel time</span>
                <strong>
                  {route.geometry_duration_min.toFixed(0)} minutes
                </strong>
              </div>
            </div>

            <div className="collector-route-progress">
              <div className="collector-route-progress-track">
                <div
                  className="collector-route-progress-fill"
                  style={{
                    width: `${
                      route.collection_ids.length > 0
                        ? (completedCount / route.collection_ids.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span>
                {route.collection_ids.length > 0
                  ? Math.round(
                      (completedCount / route.collection_ids.length) * 100,
                    )
                  : 0}% completed
              </span>
            </div>

            <h4>Optimized collection sequence</h4>

            <ol className="admin-ordered-stops collector-ordered-stops">
              {route.ordered_stops.map((stop, index) => {
                const match = stop.id.match(/^collection-(\d+)$/)
                const collectionId = match ? Number(match[1]) : null

                const collection = collectionId === null
                  ? undefined
                  : collections.find((item) => item.id === collectionId)

                return (
                  <li key={`${route.id}-${stop.id}`}>
                    <div className="collector-route-stop">
                      <div>
                        <strong>Stop {index + 1}: {stop.name}</strong>

                        {collection ? (
                          <>
                            <span>
                              Collection #{collection.id} ·{' '}
                              {collection.waste_type.replaceAll('_', ' ')}
                            </span>
                            <span
                              className={`collector-status-badge collector-status-${collection.status.toLowerCase()}`}
                            >
                              {statusLabel(collection.status)}
                            </span>

                            {collection.notes && (
                              <span>{collection.notes}</span>
                            )}
                          </>
                        ) : (
                          <span>
                            Collection details are not currently available.
                          </span>
                        )}
                      </div>

                      {collection &&
                        nextStatus(collection.status) && (
                          <button
                            type="button"
                            className={
                              nextStatus(collection.status) === 'COMPLETED'
                                ? 'button-secondary'
                                : 'button-primary'
                            }
                            onClick={() => onUpdate(collection)}
                            disabled={
                              updatingId !== null ||
                              loading
                            }
                          >
                            {updatingId === collection.id
                              ? 'Updating…'
                              : nextStatus(collection.status) === 'IN_PROGRESS'
                                ? 'Start collection'
                                : 'Mark completed'}
                          </button>
                        )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {route.is_demo && (
              <p className="collector-collection-notes">
                DEMO ROUTE — This route contains demo collection data.
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
