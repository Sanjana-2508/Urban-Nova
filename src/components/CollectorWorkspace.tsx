import { useState } from 'react'
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
                  : 'Saved route details assigned by Admin appear on the map when available.'}
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

      {mode === 'map' || mode === 'route' ? (
        <LiveGISMap
          user={user}
          onUnauthorized={onUnauthorized}
          collections={collections}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
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
