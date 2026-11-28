import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { getDepot, updateDepot, type Depot } from '../services/depot'
import { ApiError } from '../services/api'
import { CleanCityEvidence } from './CleanCityEvidence'
import { LiveGISMap } from './LiveGISMap'
import { PickupRequestEvidence } from './PickupRequestEvidence'
import {
  getAdminDashboardStats,
  listAdminUsers,
  updateAdminUser,
  type AdminDashboardStats,
  type AdminUser,
} from '../services/admin'
import {
  assignCollection,
  createCollection,
  listCollections,
  type CollectionCreate,
  type CollectionRecord,
} from '../services/collections'
import {
  assignCleanCityCleanup,
  getCleanCityHotspots,
  listCleanCityReports,
  resolveCleanCityCleanup,
  reviewCleanCityReport,
  type CleanCityHotspots,
  type CleanCityReport,
  type CleanCityReviewDecision,
} from '../services/cleancity'
import {
  reviewPickupRequest,
  listPickupRequests,
  assignPickupRequest as assignPickupRequestApi,
  type PickupRequest,
  type PickupRequestAssignment,
} from '../services/pickupRequests'
import {
  assignVehicle,
  createVehicle,
  listVehicles,
  updateVehicleStatus,
  type VehicleCreate,
  type VehicleRecord,
  type VehicleStatus,
} from '../services/vehicles'
import {
  listSavedRoutes,
  optimizeRoute,
  saveRoute,
  type CalculatedRoute,
  type RouteStop,
  type SavedRoute,
} from '../services/routing'
import type { AuthenticatedUser } from '../services/auth'
import { getRequestError } from './CitizenWorkspace'

export type AdminWorkspaceMode =
  | 'overview'
  | 'pickup-requests'
  | 'collections'
  | 'fleet'
  | 'users'
  | 'complaints'
  | 'analytics'
  | 'map'
  | 'depot'
  | 'route'

type AdminWorkspaceProps = {
  mode: AdminWorkspaceMode
  user: AuthenticatedUser
  onUnauthorized: () => void
  onNavigate: (page: string) => void
}

type AdminFeedback = {
  kind: 'success' | 'error'
  message: string
}

function handleRequestError(error: unknown, onUnauthorized: () => void) {
  if (error instanceof ApiError && error.status === 401) onUnauthorized()
  return getRequestError(error)
}

function sortCollections(collections: CollectionRecord[]) {
  return [...collections].sort(
    (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime(),
  )
}

export function AdminWorkspace({
  mode,
  user,
  onUnauthorized,
  onNavigate,
}: AdminWorkspaceProps) {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [pickupRequests, setPickupRequests] = useState<PickupRequest[]>([])
  const [pickupLoading, setPickupLoading] = useState(true)
  const [pickupError, setPickupError] = useState('')
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [collectionsError, setCollectionsError] = useState('')
  const [complaints, setComplaints] = useState<CleanCityReport[]>([])
  const [complaintsLoading, setComplaintsLoading] = useState(true)
  const [complaintsError, setComplaintsError] = useState('')
  const [hotspots, setHotspots] = useState<CleanCityHotspots | null>(null)
  const [hotspotsLoading, setHotspotsLoading] = useState(true)
  const [hotspotsError, setHotspotsError] = useState('')
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null)

  const refreshStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      setStats(await getAdminDashboardStats())
    } catch (error) {
      setStatsError(handleRequestError(error, onUnauthorized))
    } finally {
      setStatsLoading(false)
    }
  }, [onUnauthorized])

  const refreshPickupRequests = useCallback(async () => {
    setPickupLoading(true)
    setPickupError('')
    try {
      setPickupRequests(await listPickupRequests())
    } catch (error) {
      setPickupError(handleRequestError(error, onUnauthorized))
    } finally {
      setPickupLoading(false)
    }
  }, [onUnauthorized])

  const refreshCollections = useCallback(async () => {
    setCollectionsLoading(true)
    setCollectionsError('')
    try {
      setCollections(sortCollections(await listCollections()))
    } catch (error) {
      setCollectionsError(handleRequestError(error, onUnauthorized))
    } finally {
      setCollectionsLoading(false)
    }
  }, [onUnauthorized])

  const refreshComplaints = useCallback(async () => {
    setComplaintsLoading(true)
    setComplaintsError('')
    try {
      setComplaints(await listCleanCityReports())
    } catch (error) {
      setComplaintsError(handleRequestError(error, onUnauthorized))
    } finally {
      setComplaintsLoading(false)
    }
  }, [onUnauthorized])

  const refreshHotspots = useCallback(async () => {
    setHotspotsLoading(true)
    setHotspotsError('')
    try {
      setHotspots(await getCleanCityHotspots())
    } catch (error) {
      setHotspotsError(handleRequestError(error, onUnauthorized))
    } finally {
      setHotspotsLoading(false)
    }
  }, [onUnauthorized])

  const refreshVehicles = useCallback(async () => {
    setVehiclesLoading(true)
    setVehiclesError('')
    try {
      setVehicles(await listVehicles())
    } catch (error) {
      setVehiclesError(handleRequestError(error, onUnauthorized))
    } finally {
      setVehiclesLoading(false)
    }
  }, [onUnauthorized])

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError('')
    try {
      setUsers(await listAdminUsers())
    } catch (error) {
      setUsersError(handleRequestError(error, onUnauthorized))
    } finally {
      setUsersLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void Promise.all([
      refreshStats(),
      refreshPickupRequests(),
      refreshCollections(),
      refreshComplaints(),
      refreshHotspots(),
      refreshVehicles(),
      refreshUsers(),
    ])
  }, [
    refreshCollections,
    refreshComplaints,
    refreshHotspots,
    refreshPickupRequests,
    refreshStats,
    refreshUsers,
    refreshVehicles,
  ])

  const activeCollectors = useMemo(
    () => users.filter((account) => account.role === 'COLLECTOR' && account.is_active),
    [users],
  )

  async function reviewRequest(
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
    adminNote: string,
  ) {
    setFeedback(null)
    try {
      const updated = await reviewPickupRequest(requestId, {
        status,
        admin_note: adminNote.trim() || null,
      })
      setPickupRequests((current) =>
        current.map((request) => request.id === updated.id ? updated : request),
      )
      setFeedback({ kind: 'success', message: `Pickup request #${updated.id} ${status.toLowerCase()}.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
    }
  }

  async function assignPickupRequest(
    requestId: number,
    assignment: PickupRequestAssignment,
  ) {
    setFeedback(null)

    try {
      const created = await assignPickupRequestApi(requestId, assignment)

      setCollections((current) =>
        sortCollections([...current, created]),
      )

      setPickupRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? { ...request, status: 'APPROVED' }
            : request,
        ),
      )

      setFeedback({
        kind: 'success',
        message: `Pickup request #${requestId} was approved and assigned as collection #${created.id}.`,
      })

      void refreshStats()
      void refreshPickupRequests()
      void refreshCollections()

      return true
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: handleRequestError(error, onUnauthorized),
      })

      return false
    }
  }

  async function saveCollectionSchedule(schedule: CollectionCreate) {
    setFeedback(null)
    try {
      const created = await createCollection(schedule)
      setCollectionsError('')
      setCollections((current) => sortCollections([...current, created]))
      setFeedback({ kind: 'success', message: `Collection #${created.id} was scheduled.` })
      void refreshStats()
      return true
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      return false
    }
  }

  async function assignScheduledCollection(collectionId: number, collectorId: number) {
    setFeedback(null)
    try {
      const updated = await assignCollection(collectionId, collectorId)
      setCollections((current) =>
        sortCollections(current.map((collection) =>
          collection.id === updated.id ? updated : collection,
        )),
      )
      setFeedback({ kind: 'success', message: `Collection #${updated.id} was assigned.` })
      void refreshStats()
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshCollections()
    }
  }

  async function saveVehicle(vehicle: VehicleCreate) {
    setFeedback(null)
    try {
      const created = await createVehicle(vehicle)
      setVehiclesError('')
      setVehicles((current) => [created, ...current])
      setFeedback({ kind: 'success', message: `Vehicle ${created.vehicle_number} was added.` })
      return true
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      return false
    }
  }

  async function assignFleetVehicle(vehicleId: number, collectorId: number) {
    setFeedback(null)
    try {
      const updated = await assignVehicle(vehicleId, collectorId)
      setVehicles((current) =>
        current.map((vehicle) => vehicle.id === updated.id ? updated : vehicle),
      )
      setFeedback({ kind: 'success', message: `Vehicle ${updated.vehicle_number} was assigned.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshVehicles()
    }
  }

  async function saveVehicleStatus(vehicleId: number, status: VehicleStatus) {
    setFeedback(null)
    try {
      const updated = await updateVehicleStatus(vehicleId, status)
      setVehicles((current) =>
        current.map((vehicle) => vehicle.id === updated.id ? updated : vehicle),
      )
      setFeedback({ kind: 'success', message: `Vehicle ${updated.vehicle_number} is now ${status.toLowerCase()}.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshVehicles()
    }
  }

  async function saveUser(userId: number, update: Partial<Pick<AdminUser, 'role' | 'is_active'>>) {
    setFeedback(null)
    try {
      const updated = await updateAdminUser(userId, update)
      setUsers((current) => current.map((account) => account.id === updated.id ? updated : account))
      setFeedback({
        kind: 'success',
        message: update.role === 'COLLECTOR'
          ? `${updated.name} now has the Collector role.`
          : `Account for ${updated.name} was updated.`,
      })
      void refreshStats()
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshUsers()
    }
  }

  async function saveComplaintReview(
    complaintId: number,
    decision: CleanCityReviewDecision,
    reason: string,
    internalNote: string,
    duplicateOf: number | null,
    severity: 'LOW' | 'MEDIUM' | 'HIGH',
  ) {
    setFeedback(null)
    try {
      const updated = await reviewCleanCityReport(complaintId, {
        decision,
        reason: decision === 'REJECTED' ? reason.trim() || null : null,
        internal_note: internalNote.trim() || null,
        duplicate_of: decision === 'DUPLICATE' ? duplicateOf : null,
        severity: decision === 'VERIFIED' ? severity : null,
      })
      setComplaints((current) => current.map((complaint) =>
        complaint.id === updated.id ? updated : complaint,
      ))
      setFeedback({
        kind: 'success',
        message: `Report #${updated.id} moved to ${decision.toLowerCase().replaceAll('_', ' ')}.`,
      })
      void refreshStats()
      void refreshComplaints()
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshComplaints()
    }
  }

  async function resolveComplaint(actionId: number, resolutionNote: string) {
    setFeedback(null)
    try {
      await resolveCleanCityCleanup(actionId, resolutionNote)
      setFeedback({ kind: 'success', message: 'Cleanup resolution was recorded.' })
      void refreshComplaints()
      void refreshStats()
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshComplaints()
    }
  }

  async function assignComplaint(
    complaintId: number,
    collectorId: number,
    priority: 'LOW' | 'MEDIUM' | 'HIGH',
    dueAt: string,
  ) {
    setFeedback(null)
    try {
      await assignCleanCityCleanup(complaintId, {
        assigned_to: collectorId,
        priority,
        due_at: dueAt,
      })
      setFeedback({ kind: 'success', message: `Report #${complaintId} was assigned for cleanup.` })
      void refreshComplaints()
      void refreshStats()
    } catch (error) {
      setFeedback({ kind: 'error', message: handleRequestError(error, onUnauthorized) })
      void refreshComplaints()
    }
  }

  return (
    <section className="admin-workspace">
      {feedback && (
        <div className={`admin-feedback admin-feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </div>
      )}
      {mode === 'overview' ? (
        <AdminOverview
          name={user.name}
          stats={stats}
          statsLoading={statsLoading}
          statsError={statsError}
          pickupRequests={pickupRequests}
          pickupLoading={pickupLoading}
          pickupError={pickupError}
          reports={complaints}
          reportsLoading={complaintsLoading}
          reportsError={complaintsError}
          onRefresh={() => {
            void refreshStats()
            void refreshPickupRequests()
            void refreshComplaints()
          }}
          onNavigate={onNavigate}
        />
      ) : mode === 'pickup-requests' ? (
        <PickupRequestManagement
          requests={pickupRequests}
          collections={collections}
          vehicles={vehicles}
          collectors={activeCollectors}
          vehiclesLoading={vehiclesLoading}
          loading={pickupLoading}
          error={pickupError}
          onRefresh={() => {
            void refreshPickupRequests()
            void refreshCollections()
            void refreshVehicles()
          }}
          onUnauthorized={onUnauthorized}
          onReview={reviewRequest}
          onAssign={assignPickupRequest}
        />
      ) : mode === 'collections' ? (
        <CollectionManagement
          collections={collections}
          pickupRequests={pickupRequests}
          collectors={activeCollectors}
          users={users}
          loading={collectionsLoading}
          error={collectionsError}
          usersLoading={usersLoading}
          usersError={usersError}
          onRefresh={() => {
            void refreshCollections()
            void refreshUsers()
          }}
          onCreate={saveCollectionSchedule}
          onAssign={assignScheduledCollection}
        />
      ) : mode === 'fleet' ? (
        <FleetManagement
          vehicles={vehicles}
          collectors={activeCollectors}
          users={users}
          loading={vehiclesLoading}
          error={vehiclesError}
          usersError={usersError}
          onRefresh={() => {
            void refreshVehicles()
            void refreshUsers()
          }}
          onCreate={saveVehicle}
          onAssign={assignFleetVehicle}
          onStatusChange={saveVehicleStatus}
        />
      ) : mode === 'users' ? (
        <UserManagement
          users={users}
          loading={usersLoading}
          error={usersError}
          currentUserId={user.id}
          onRefresh={() => void refreshUsers()}
          onUpdate={saveUser}
        />
      ) : mode === 'complaints' ? (
        <ComplaintManagement
          complaints={complaints}
          collectors={activeCollectors}
          loading={complaintsLoading}
          error={complaintsError}
          onRefresh={() => void refreshComplaints()}
          onReview={saveComplaintReview}
          onAssign={assignComplaint}
          onResolve={resolveComplaint}
          onUnauthorized={onUnauthorized}
        />
      ) : mode === 'analytics' ? (
        <AdminAnalytics
          stats={stats}
          statsLoading={statsLoading}
          statsError={statsError}
          requests={pickupRequests}
          requestsLoading={pickupLoading}
          requestsError={pickupError}
          reports={complaints}
          reportsLoading={complaintsLoading}
          reportsError={complaintsError}
          hotspots={hotspots}
          hotspotsLoading={hotspotsLoading}
          hotspotsError={hotspotsError}
          onRefresh={() => {
            void refreshStats()
            void refreshPickupRequests()
            void refreshCollections()
            void refreshComplaints()
            void refreshHotspots()
          }}
        />
      ) : mode === 'map' ? (
        <LiveGISMap
          user={user}
          onUnauthorized={onUnauthorized}
          requests={pickupRequests}
          collections={collections}
          hotspots={hotspots?.items}
          loading={pickupLoading || collectionsLoading || hotspotsLoading}
          error={[pickupError, collectionsError, hotspotsError].filter(Boolean).join('\n')}
          onRefresh={() => {
            void refreshPickupRequests()
            void refreshCollections()
            void refreshHotspots()
          }}
        />
      ) : mode === 'depot' ? (
        <AdminDepotSettings onUnauthorized={onUnauthorized} />
      ) : (
        <AdminRoutePlanner
          requests={pickupRequests}
          collections={collections}
          vehicles={vehicles}
          collectors={activeCollectors}
          loading={pickupLoading}
          error={pickupError}
          onRefresh={() => void refreshPickupRequests()}
          onUnauthorized={onUnauthorized}
        />
      )}
    </section>
  )
}

function AdminAnalytics({
  stats,
  statsLoading,
  statsError,
  requests,
  requestsLoading,
  requestsError,
  reports,
  reportsLoading,
  reportsError,
  hotspots,
  hotspotsLoading,
  hotspotsError,
  onRefresh,
}: {
  stats: AdminDashboardStats | null
  statsLoading: boolean
  statsError: string
  requests: PickupRequest[]
  requestsLoading: boolean
  requestsError: string
  reports: CleanCityReport[]
  reportsLoading: boolean
  reportsError: string
  hotspots: CleanCityHotspots | null
  hotspotsLoading: boolean
  hotspotsError: string
  onRefresh: () => void
}) {
  const pendingRequests = requests.filter((request) => request.status === 'PENDING').length
  const approvedRequests = requests.filter((request) => request.status === 'APPROVED').length
  const pendingReports = reports.filter(
    (report) => report.status === 'SUBMITTED' || report.status === 'UNDER_REVIEW',
  ).length
  const verifiedReports = reports.filter(
    (report) => report.status === 'VERIFIED' || report.status === 'ASSIGNED',
  ).length
  const resolvedReports = reports.filter((report) => report.status === 'RESOLVED').length
  const includesDemoRecords =
    requests.some((request) => request.is_demo) ||
    reports.some((report) => report.is_demo)

  return (
    <>
      <AdminPageHeading
        eyebrow="OPERATIONAL ANALYTICS"
        title="Analytics"
        description="Live counts from registered users, collection schedules, pickup requests, CleanCity reports, and calculated hotspots."
        onRefresh={onRefresh}
        loading={statsLoading || requestsLoading || reportsLoading || hotspotsLoading}
      />
      {statsError && <AdminError message={statsError} />}
      {requestsError && <AdminError message={`Pickup request analytics: ${requestsError}`} />}
      {reportsError && <AdminError message={`CleanCity analytics: ${reportsError}`} />}
      {hotspotsError && <AdminError message={`Hotspot analytics: ${hotspotsError}`} />}
      {includesDemoRecords && (
        <div className="admin-info-banner">
          Counts include clearly tagged local demonstration records; they are not municipal operational totals.
        </div>
      )}
      <div className="admin-stats-grid">
        <AdminStat
          label="Registered users"
          value={statsLoading ? '…' : statsError ? '—' : stats?.users.total_users ?? '—'}
          icon={Users}
        />
        <AdminStat
          label="Total collections"
          value={statsLoading ? '…' : statsError ? '—' : stats?.collections.total_collections ?? '—'}
          icon={Route}
        />
        <AdminStat
          label="Completed collections"
          value={statsLoading ? '…' : statsError ? '—' : stats?.collections.completed ?? '—'}
          icon={CheckCircle2}
          tone="cyan"
        />
        <AdminStat
          label="Pending pickup requests"
          value={requestsLoading ? '…' : requestsError ? '—' : pendingRequests}
          icon={Clock3}
          tone="orange"
        />
        <AdminStat
          label="Approved pickup requests"
          value={requestsLoading ? '…' : requestsError ? '—' : approvedRequests}
          icon={CheckCircle2}
          tone="cyan"
        />
        <AdminStat
          label="Total CleanCity reports"
          value={reportsLoading ? '…' : reportsError ? '—' : reports.length}
          icon={Activity}
          tone="violet"
        />
        <AdminStat
          label="Pending CleanCity reports"
          value={reportsLoading ? '…' : reportsError ? '—' : pendingReports}
          icon={Clock3}
          tone="orange"
        />
        <AdminStat
          label="Verified / assigned reports"
          value={reportsLoading ? '…' : reportsError ? '—' : verifiedReports}
          icon={ShieldCheck}
          tone="cyan"
        />
        <AdminStat
          label="Resolved CleanCity reports"
          value={reportsLoading ? '…' : reportsError ? '—' : resolvedReports}
          icon={CheckCircle2}
        />
        <AdminStat
          label="Calculated CleanCity hotspots"
          value={hotspotsLoading ? '…' : hotspotsError ? '—' : hotspots?.items.length ?? 0}
          icon={Activity}
          tone="violet"
        />
      </div>
      {hotspots && hotspots.items.some((hotspot) => hotspot.demo_report_count > 0) && (
        <div className="admin-info-banner">
          Hotspots are computed dynamically from verified reports; the displayed counts include demo reports.
        </div>
      )}
    </>
  )
}

function AdminOverview({
  name,
  stats,
  statsLoading,
  statsError,
  pickupRequests,
  pickupLoading,
  pickupError,
  reports,
  reportsLoading,
  reportsError,
  onRefresh,
  onNavigate,
}: {
  name: string
  stats: AdminDashboardStats | null
  statsLoading: boolean
  statsError: string
  pickupRequests: PickupRequest[]
  pickupLoading: boolean
  pickupError: string
  reports: CleanCityReport[]
  reportsLoading: boolean
  reportsError: string
  onRefresh: () => void
  onNavigate: (page: string) => void
}) {
  const pendingRequests = pickupRequests.filter((request) => request.status === 'PENDING').length
  const pendingCollections = stats
    ? stats.collections.scheduled + stats.collections.assigned
    : null
  const reportCount = (status: CleanCityReport['status']) =>
    reports.filter((report) => report.status === status).length
  const pendingReports = reportCount('SUBMITTED') + reportCount('UNDER_REVIEW')
  const statValue = (value: number | null | undefined, loading: boolean, error: string) =>
    loading ? '…' : error || value === null || value === undefined ? '—' : value

  return (
    <>
      <header className="panel admin-welcome">
        <div>
          <span className="section-kicker">ADMINISTRATOR WORKSPACE</span>
          <h1>Welcome, {name}</h1>
          <p>Current operations and account totals from UrbanNova services.</p>
        </div>
        <button type="button" className="button-secondary" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh dashboard
        </button>
      </header>

      {statsError && <AdminError message={statsError} />}
      {pickupError && <AdminError message={`Pickup request totals: ${pickupError}`} />}
      {reportsError && <AdminError message={`CleanCity report totals: ${reportsError}`} />}

      <div className="admin-section-heading">
        <div>
          <span className="section-kicker">REGISTERED USERS</span>
          <h2>Accounts</h2>
        </div>
        <button type="button" className="text-button" onClick={() => onNavigate('User management')}>
          Manage users <ArrowRight size={14} />
        </button>
      </div>
      <div className="admin-stats-grid admin-user-stats">
        <AdminStat label="Total users" value={statValue(stats?.users.total_users, statsLoading, statsError)} icon={Users} />
        <AdminStat label="Citizens" value={statValue(stats?.users.total_citizens, statsLoading, statsError)} icon={Users} />
        <AdminStat label="Collectors" value={statValue(stats?.users.total_collectors, statsLoading, statsError)} icon={Truck} />
        <AdminStat label="Admins" value={statValue(stats?.users.total_admins, statsLoading, statsError)} icon={ShieldCheck} />
      </div>

      <div className="admin-section-heading">
        <div>
          <span className="section-kicker">SERVICE OPERATIONS</span>
          <h2>Current workload</h2>
        </div>
        <button type="button" className="text-button" onClick={() => onNavigate('Pickup requests')}>
          Review pickup requests <ArrowRight size={14} />
        </button>
      </div>
      <div className="admin-stats-grid">
        <AdminStat label="Pending pickup requests" value={statValue(pendingRequests, pickupLoading, pickupError)} icon={Clock3} tone="orange" />
        <AdminStat label="Total collections" value={statValue(stats?.collections.total_collections, statsLoading, statsError)} icon={Route} />
        <AdminStat label="Completed collections" value={statValue(stats?.collections.completed, statsLoading, statsError)} icon={CheckCircle2} tone="cyan" />
        <AdminStat label="Pending collections" value={statValue(pendingCollections, statsLoading, statsError)} icon={CalendarDays} tone="orange" />
        <AdminStat label="CleanCity reports" value={statValue(reports.length, reportsLoading, reportsError)} icon={Activity} tone="violet" />
        <AdminStat label="Pending reports" value={statValue(pendingReports, reportsLoading, reportsError)} icon={Clock3} tone="orange" />
        <AdminStat label="Verified reports" value={statValue(reportCount('VERIFIED'), reportsLoading, reportsError)} icon={CheckCircle2} tone="cyan" />
        <AdminStat label="Resolved reports" value={statValue(reportCount('RESOLVED'), reportsLoading, reportsError)} icon={CheckCircle2} />
      </div>

      {(stats && !statsError) || (!reportsError && !reportsLoading) ? (
        <article className="panel admin-status-summary">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">STATUS BREAKDOWN</span>
              <h2>Collections and CleanCity reports</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onNavigate('Citizen reports')}>
              View CleanCity reports <ArrowRight size={14} />
            </button>
          </div>
          <div className="admin-status-columns">
          {stats && !statsError && (
            <StatusSummary
              title="Collections"
              items={[
                ['Scheduled', stats.collections.scheduled],
                ['Assigned', stats.collections.assigned],
                ['In progress', stats.collections.in_progress],
                ['Completed', stats.collections.completed],
                ['Cancelled', stats.collections.cancelled],
              ]}
            />
          )}
            {!reportsLoading && !reportsError && (
              <StatusSummary
                title="CleanCity reports"
                items={[
                  ['Submitted', reportCount('SUBMITTED')],
                  ['Under review', reportCount('UNDER_REVIEW')],
                  ['Verified', reportCount('VERIFIED')],
                  ['Assigned', reportCount('ASSIGNED')],
                  ['Resolved', reportCount('RESOLVED')],
                  ['Rejected', reportCount('REJECTED')],
                ]}
              />
            )}
          </div>
        </article>
      ) : null}
    </>
  )
}

function AdminStat({
  label,
  value,
  icon: Icon,
  tone = 'lime',
}: {
  label: string
  value: string | number
  icon: typeof Users
  tone?: string
}) {
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <div className="admin-stat-icon"><Icon size={17} /></div>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

function StatusSummary({
  title,
  items,
}: {
  title: string
  items: [string, number][]
}) {
  return (
    <div className="admin-status-group">
      <h3>{title}</h3>
      <div>
        {items.map(([label, count]) => (
          <div className="admin-status-row" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminPageHeading({
  eyebrow,
  title,
  description,
  onRefresh,
  loading,
}: {
  eyebrow: string
  title: string
  description: string
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <div className="section-heading admin-page-heading">
      <div>
        <span className="section-kicker">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button type="button" className="button-secondary" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  )
}

function AdminError({ message }: { message: string }) {
  return <div className="admin-feedback admin-feedback-error" role="alert">{message}</div>
}

function AdminEmpty({
  message,
  loading,
  error,
  onRefresh,
}: {
  message: string
  loading: boolean
  error: string
  onRefresh: () => void
}) {
  if (loading) return <div className="admin-empty-state" aria-live="polite">Loading…</div>
  if (error) {
    return (
      <div className="admin-empty-state">
        <p>Data is unavailable.</p>
        <button type="button" className="button-secondary" onClick={onRefresh}>Retry</button>
      </div>
    )
  }
  return <div className="admin-empty-state">{message}</div>
}

function PickupRequestManagement({
  requests,
  collections,
  vehicles,
  collectors,
  vehiclesLoading,
  loading,
  error,
  onRefresh,
  onUnauthorized,
  onReview,
  onAssign,
}: {
  requests: PickupRequest[]
  collections: CollectionRecord[]
  vehicles: VehicleRecord[]
  collectors: AdminUser[]
  vehiclesLoading: boolean
  loading: boolean
  error: string
  onRefresh: () => void
  onUnauthorized: () => void
  onReview: (
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
    note: string,
  ) => Promise<void>
  onAssign: (
    requestId: number,
    assignment: PickupRequestAssignment,
  ) => Promise<boolean>
}) {
  return (
    <>
      <AdminPageHeading
        eyebrow="CITIZEN SERVICES"
        title="Pickup requests"
        description="Review requests submitted by Citizens and record an approval decision."
        onRefresh={onRefresh}
        loading={loading}
      />
      {error && <AdminError message={error} />}
      {requests.length === 0 ? (
        <AdminEmpty message="No pickup requests have been submitted." loading={loading} error={error} onRefresh={onRefresh} />
      ) : (
        <div className="admin-record-list">
          {requests.map((request) => (
            <PickupRequestRow
              key={request.id}
              request={request}
              collections={collections}
              vehicles={vehicles}
              collectors={collectors}
              vehiclesLoading={vehiclesLoading}
              onReview={onReview}
              onAssign={onAssign}
              onUnauthorized={onUnauthorized}
            />
          ))}
        </div>
      )}
    </>
  )
}

function PickupRequestRow({
  request,
  collections,
  vehicles,
  collectors,
  vehiclesLoading,
  onReview,
  onAssign,
  onUnauthorized,
}: {
  request: PickupRequest
  collections: CollectionRecord[]
  vehicles: VehicleRecord[]
  collectors: AdminUser[]
  vehiclesLoading: boolean
  onReview: (
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
    note: string,
  ) => Promise<void>
  onAssign: (
    requestId: number,
    assignment: PickupRequestAssignment,
  ) => Promise<boolean>
  onUnauthorized: () => void
}) {
  const [note, setNote] = useState(request.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [vehicleId, setVehicleId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')

  const eligibleVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.status === 'ASSIGNED' &&
      vehicle.assigned_collector_id !== null &&
      collectors.some(
        (collector) =>
          collector.id === vehicle.assigned_collector_id &&
          collector.is_active,
      ),
  )

  const alreadyAssigned = collections.some(
    (collection) => collection.pickup_request_id === request.id,
  )

  async function review(status: 'APPROVED' | 'REJECTED') {
    setBusy(true)
    try {
      await onReview(request.id, status, note)
    } finally {
      setBusy(false)
    }
  }

  async function assign() {
    if (!vehicleId || !scheduledDate) return

    setBusy(true)

    try {
      const success = await onAssign(request.id, {
        vehicle_id: Number(vehicleId),
        scheduled_date: new Date(scheduledDate).toISOString(),
        notes: assignmentNotes.trim() || null,
      })

      if (success) {
        setVehicleId('')
        setScheduledDate('')
        setAssignmentNotes('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="panel admin-record-card">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-id">REQUEST #{request.id}</span>
          <h3>{request.category.replaceAll('_', ' ')}</h3>
        </div>
        <span className={`admin-status-pill admin-status-${request.status.toLowerCase()}`}>
          {request.status.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="admin-record-grid">
        <div><span>Pickup location</span><strong>{request.location}</strong></div>
        <div><span>Citizen account</span><strong>{request.citizen_id === null ? 'Account unavailable' : `User #${request.citizen_id}`}</strong></div>
        <div><span>Submitted</span><strong>{formatAdminDate(request.created_at)}</strong></div>
        <div><span>Coordinates</span><strong>{request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}</strong></div>
      </div>
      <div className="admin-record-description">
        <span>Description</span>
        <p>{request.description || 'No description provided.'}</p>
      </div>
      {request.evidence_url && (
        <PickupRequestEvidence
          requestId={request.id}
          onUnauthorized={onUnauthorized}
        />
      )}
      {request.status === 'PENDING' ? (
        <div className="admin-review-controls">
          <label className="admin-field">
            Admin note <span className="admin-optional">(optional)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </label>
          <div className="admin-action-row">
            <button type="button" className="button-primary" disabled={busy} onClick={() => void review('APPROVED')}>
              <CheckCircle2 size={15} /> {busy ? 'Saving…' : 'Approve'}
            </button>
            <button type="button" className="button-secondary admin-reject-button" disabled={busy} onClick={() => void review('REJECTED')}>
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      ) : request.admin_note && (
        <p className="admin-note"><strong>Admin note:</strong> {request.admin_note}</p>
      )}
            {(request.status === 'PENDING' || request.status === 'APPROVED') && (
        <div className="admin-review-controls">
          <h4>Approve & assign collection</h4>

          {alreadyAssigned ? (
            <p className="admin-note">
              This pickup request has already been converted into a collection.
            </p>
          ) : (
            <>
              <label className="admin-field">
                Assigned vehicle
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  disabled={busy || vehiclesLoading}
                >
                  <option value="">
                    {vehiclesLoading ? 'Loading vehicles...' : 'Select assigned vehicle'}
                  </option>

                  {eligibleVehicles.map((vehicle) => {
                    const collector = collectors.find(
                      (item) => item.id === vehicle.assigned_collector_id,
                    )

                    return (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.vehicle_number} — {collector?.name ?? 'Collector'}
                      </option>
                    )
                  })}
                </select>
              </label>

              {eligibleVehicles.length === 0 && !vehiclesLoading && (
                <p className="admin-note">
                  No vehicles assigned to active Collectors are available.
                  Assign a vehicle to a Collector in Fleet Management first.
                </p>
              )}

              <label className="admin-field">
                Scheduled date and time
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  disabled={busy}
                />
              </label>

              <label className="admin-field">
                Assignment notes <span className="admin-optional">(optional)</span>
                <textarea
                  value={assignmentNotes}
                  onChange={(event) => setAssignmentNotes(event.target.value)}
                  rows={2}
                  disabled={busy}
                  placeholder="Additional instructions for the Collector"
                />
              </label>

              <div className="admin-action-row">
                <button
                  type="button"
                  className="button-primary"
                  disabled={
                    busy ||
                    vehiclesLoading ||
                    !vehicleId ||
                    !scheduledDate
                  }
                  onClick={() => void assign()}
                >
                  <Truck size={15} />
                  {busy ? 'Assigning...' : 'Approve & Assign'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

function formatAdminDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const wasteTypes = [
  'GENERAL',
  'RECYCLABLE',
  'ORGANIC',
  'HAZARDOUS',
  'E_WASTE',
  'OTHER',
]

function CollectionManagement({
  collections,
  pickupRequests,
  collectors,
  users,
  loading,
  error,
  usersLoading,
  usersError,
  onRefresh,
  onCreate,
  onAssign,
}: {
  collections: CollectionRecord[]
  pickupRequests: PickupRequest[]
  collectors: AdminUser[]
  users: AdminUser[]
  loading: boolean
  error: string
  usersLoading: boolean
  usersError: string
  onRefresh: () => void
  onCreate: (schedule: CollectionCreate) => Promise<boolean>
  onAssign: (collectionId: number, collectorId: number) => Promise<void>
}) {
  return (
    <>
      <AdminPageHeading
        eyebrow="COLLECTION OPERATIONS"
        title="Collection scheduling"
        description="Create schedules and assign them to active Collector accounts."
        onRefresh={onRefresh}
        loading={loading}
      />
      {error && <AdminError message={error} />}
      {usersError && <AdminError message={`Collector accounts are unavailable: ${usersError}`} />}
      <CollectionScheduleForm pickupRequests={pickupRequests} onCreate={onCreate} />
      <div className="admin-section-heading">
        <div>
          <span className="section-kicker">SCHEDULED WORK</span>
          <h2>All collections <span className="admin-count">{collections.length}</span></h2>
        </div>
      </div>
      {collections.length === 0 ? (
        <AdminEmpty message="No collection schedules are available." loading={loading} error={error} onRefresh={onRefresh} />
      ) : (
        <div className="admin-record-list">
          {collections.map((collection) => (
            <CollectionAdminCard
              key={collection.id}
              collection={collection}
              collectors={collectors}
              users={users}
              usersLoading={usersLoading}
              usersError={usersError}
              onAssign={onAssign}
            />
          ))}
        </div>
      )}
    </>
  )
}

function CollectionScheduleForm({
  pickupRequests,
  onCreate,
}: {
  pickupRequests: PickupRequest[]
  onCreate: (schedule: CollectionCreate) => Promise<boolean>
}) {
  const [location, setLocation] = useState('')
  const [wasteType, setWasteType] = useState(wasteTypes[0])
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')
  const [pickupRequestId, setPickupRequestId] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [saving, setSaving] = useState(false)
  const approvedRequests = pickupRequests.filter(
    (request) => request.status === 'APPROVED',
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await onCreate({
        location: location.trim(),
        waste_type: wasteType,
        scheduled_date: scheduledDate,
        notes: notes.trim() || null,
        pickup_request_id: pickupRequestId ? Number(pickupRequestId) : null,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
      })
      if (saved) {
        setLocation('')
        setScheduledDate('')
        setNotes('')
        setPickupRequestId('')
        setLatitude('')
        setLongitude('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel admin-form-card" onSubmit={(event) => void submit(event)}>
      <div className="admin-card-heading">
        <div>
          <span className="section-kicker">NEW SCHEDULE</span>
          <h3>Create a collection</h3>
        </div>
      </div>
      <div className="admin-form-grid">
        {approvedRequests.length > 0 && (
          <label className="admin-field admin-form-wide">
            Convert approved pickup request
            <select
              value={pickupRequestId}
              onChange={(event) => {
                const requestId = event.target.value
                setPickupRequestId(requestId)
                const request = approvedRequests.find(
                  (item) => item.id === Number(requestId),
                )
                if (request) {
                  setLocation(request.location)
                  setLatitude(String(request.latitude))
                  setLongitude(String(request.longitude))
                  setWasteType(
                    wasteTypes.includes(request.category as (typeof wasteTypes)[number])
                      ? request.category as (typeof wasteTypes)[number]
                      : 'OTHER',
                  )
                }
              }}
            >
              <option value="">Create a standalone collection</option>
              {approvedRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  Request #{request.id} · {request.location}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="admin-field">
          Collection location
          <input value={location} onChange={(event) => setLocation(event.target.value)} minLength={3} maxLength={255} required />
        </label>
        <label className="admin-field">
          Waste type
          <select value={wasteType} onChange={(event) => setWasteType(event.target.value)} required>
            {wasteTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="admin-field">
          Scheduled date and time
          <input type="datetime-local" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} required />
        </label>
        <label className="admin-field">
          Latitude <span className="admin-optional">(optional)</span>
          <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} disabled={Boolean(pickupRequestId)} />
        </label>
        <label className="admin-field">
          Longitude <span className="admin-optional">(optional)</span>
          <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} disabled={Boolean(pickupRequestId)} />
        </label>
        <label className="admin-field admin-form-wide">
          Notes <span className="admin-optional">(optional)</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={2000} />
        </label>
      </div>
      <div className="admin-form-footer">
        <p>New schedules are created first, then assigned below to an active Collector.</p>
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create schedule'} <ArrowRight size={14} />
        </button>
      </div>
    </form>
  )
}

function CollectionAdminCard({
  collection,
  collectors,
  users,
  usersLoading,
  usersError,
  onAssign,
}: {
  collection: CollectionRecord
  collectors: AdminUser[]
  users: AdminUser[]
  usersLoading: boolean
  usersError: string
  onAssign: (collectionId: number, collectorId: number) => Promise<void>
}) {
  const [selectedCollector, setSelectedCollector] = useState(
    collection.collector_id?.toString() ?? '',
  )
  const [saving, setSaving] = useState(false)
  const collector = users.find((account) => account.id === collection.collector_id)
  const canAssign =
    collection.status === 'SCHEDULED' || collection.status === 'ASSIGNED'

  useEffect(() => {
    setSelectedCollector(collection.collector_id?.toString() ?? '')
  }, [collection.collector_id])

  async function assign() {
    if (!selectedCollector) return
    setSaving(true)
    try {
      await onAssign(collection.id, Number(selectedCollector))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="panel admin-record-card">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-id">COLLECTION #{collection.id}</span>
          <h3>{collection.location}</h3>
        </div>
        <span className={`admin-status-pill admin-status-${collection.status.toLowerCase()}`}>
          {collection.status.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="admin-record-grid">
        <div><span>Waste type</span><strong>{collection.waste_type.replaceAll('_', ' ')}</strong></div>
        <div><span>Scheduled</span><strong>{formatAdminDate(collection.scheduled_date)}</strong></div>
        <div><span>Assigned Collector</span><strong>{collector ? `${collector.name} · ${collector.email}` : collection.collector_id ? `User #${collection.collector_id}` : 'Unassigned'}</strong></div>
        <div><span>Created</span><strong>{formatAdminDate(collection.created_at)}</strong></div>
      </div>
      {collection.notes && <p className="admin-note">{collection.notes}</p>}
      {canAssign && (
        <div className="admin-assign-controls">
          <label className="admin-field">
            Assign to active Collector
            <select
              value={selectedCollector}
              onChange={(event) => setSelectedCollector(event.target.value)}
              disabled={usersLoading || Boolean(usersError) || collectors.length === 0}
            >
              <option value="">
                {usersLoading
                  ? 'Loading Collectors…'
                  : usersError
                    ? 'Collector accounts unavailable'
                    : collectors.length
                      ? 'Select a Collector'
                      : 'No active Collectors'}
              </option>
              {collectors.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.email}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void assign()}
            disabled={
              saving ||
              !selectedCollector ||
              selectedCollector === collection.collector_id?.toString() ||
              usersLoading ||
              Boolean(usersError)
            }
          >
            {saving ? 'Assigning…' : 'Assign collection'}
          </button>
        </div>
      )}
      {collection.completed_at && (
        <p className="admin-record-footnote">Completed {formatAdminDate(collection.completed_at)}</p>
      )}
    </article>
  )
}

function FleetManagement({
  vehicles,
  collectors,
  users,
  loading,
  error,
  usersError,
  onRefresh,
  onCreate,
  onAssign,
  onStatusChange,
}: {
  vehicles: VehicleRecord[]
  collectors: AdminUser[]
  users: AdminUser[]
  loading: boolean
  error: string
  usersError: string
  onRefresh: () => void
  onCreate: (vehicle: VehicleCreate) => Promise<boolean>
  onAssign: (vehicleId: number, collectorId: number) => Promise<void>
  onStatusChange: (vehicleId: number, status: VehicleStatus) => Promise<void>
}) {
  const counts = {
    total: vehicles.length,
    available: vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').length,
    assigned: vehicles.filter((vehicle) => vehicle.status === 'ASSIGNED').length,
    maintenance: vehicles.filter((vehicle) => vehicle.status === 'MAINTENANCE').length,
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="FLEET OPERATIONS"
        title="Fleet management"
        description="Vehicles and their current status from the fleet service."
        onRefresh={onRefresh}
        loading={loading}
      />
      {error && <AdminError message={error} />}
      {usersError && <AdminError message={`Collector accounts are unavailable: ${usersError}`} />}
      <div className="admin-stats-grid admin-fleet-stats">
        <AdminStat label="Total vehicles" value={loading && !vehicles.length ? '…' : counts.total} icon={Truck} />
        <AdminStat label="Available" value={loading && !vehicles.length ? '…' : counts.available} icon={CheckCircle2} tone="cyan" />
        <AdminStat label="Assigned" value={loading && !vehicles.length ? '…' : counts.assigned} icon={Users} />
        <AdminStat label="Maintenance" value={loading && !vehicles.length ? '…' : counts.maintenance} icon={Activity} tone="orange" />
      </div>
      <VehicleCreateForm onCreate={onCreate} />
      <div className="admin-section-heading">
        <div>
          <span className="section-kicker">REGISTERED VEHICLES</span>
          <h2>Vehicles <span className="admin-count">{vehicles.length}</span></h2>
        </div>
      </div>
      {vehicles.length === 0 ? (
        <AdminEmpty message="No vehicles are registered." loading={loading} error={error} onRefresh={onRefresh} />
      ) : (
        <div className="admin-vehicle-grid">
          {vehicles.map((vehicle) => (
            <VehicleAdminCard
              key={vehicle.id}
              vehicle={vehicle}
              collectors={collectors}
              users={users}
              usersError={usersError}
              onAssign={onAssign}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </>
  )
}

function VehicleCreateForm({
  onCreate,
}: {
  onCreate: (vehicle: VehicleCreate) => Promise<boolean>
}) {
  const [number, setNumber] = useState('')
  const [type, setType] = useState('')
  const [capacity, setCapacity] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await onCreate({
        vehicle_number: number.trim(),
        vehicle_type: type.trim(),
        capacity_kg: Number(capacity),
      })
      if (saved) {
        setNumber('')
        setType('')
        setCapacity('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel admin-form-card" onSubmit={(event) => void submit(event)}>
      <div className="admin-card-heading">
        <div>
          <span className="section-kicker">FLEET REGISTER</span>
          <h3>Add vehicle</h3>
        </div>
      </div>
      <div className="admin-form-grid">
        <label className="admin-field">Vehicle number<input value={number} onChange={(event) => setNumber(event.target.value)} minLength={3} maxLength={30} required /></label>
        <label className="admin-field">Vehicle type<input value={type} onChange={(event) => setType(event.target.value)} minLength={3} maxLength={50} required /></label>
        <label className="admin-field">Capacity (kg)<input type="number" min="0.01" step="any" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /></label>
      </div>
      <div className="admin-form-footer">
        <span />
        <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Adding…' : 'Add vehicle'} <ArrowRight size={14} /></button>
      </div>
    </form>
  )
}

function VehicleAdminCard({
  vehicle,
  collectors,
  users,
  usersError,
  onAssign,
  onStatusChange,
}: {
  vehicle: VehicleRecord
  collectors: AdminUser[]
  users: AdminUser[]
  usersError: string
  onAssign: (vehicleId: number, collectorId: number) => Promise<void>
  onStatusChange: (vehicleId: number, status: VehicleStatus) => Promise<void>
}) {
  const [collectorId, setCollectorId] = useState('')
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status)
  const [saving, setSaving] = useState(false)
  const assignedCollector = users.find((account) => account.id === vehicle.assigned_collector_id)

  useEffect(() => {
    setStatus(vehicle.status)
  }, [vehicle.status])

  useEffect(() => {
    setCollectorId('')
  }, [vehicle.assigned_collector_id])

  async function assign() {
    if (!collectorId) return
    setSaving(true)
    try {
      await onAssign(vehicle.id, Number(collectorId))
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus() {
    setSaving(true)
    try {
      await onStatusChange(vehicle.id, status)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="panel admin-vehicle-card">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-id">VEHICLE #{vehicle.id}</span>
          <h3>{vehicle.vehicle_number}</h3>
        </div>
        <span className={`admin-status-pill admin-status-${vehicle.status.toLowerCase()}`}>{vehicle.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="admin-record-grid">
        <div><span>Vehicle type</span><strong>{vehicle.vehicle_type}</strong></div>
        <div><span>Capacity</span><strong>{vehicle.capacity_kg} kg</strong></div>
        <div><span>Assigned Collector</span><strong>{assignedCollector ? `${assignedCollector.name} · ${assignedCollector.email}` : vehicle.assigned_collector_id ? `User #${vehicle.assigned_collector_id}` : 'Unassigned'}</strong></div>
      </div>
      <div className="admin-vehicle-controls">
        {vehicle.status === 'AVAILABLE' && (
          <div className="admin-inline-control">
            <select aria-label={`Assign ${vehicle.vehicle_number} to Collector`} value={collectorId} onChange={(event) => setCollectorId(event.target.value)} disabled={!collectors.length || Boolean(usersError)}>
              <option value="">{usersError ? 'Collector accounts unavailable' : collectors.length ? 'Select active Collector' : 'No active Collectors'}</option>
              {collectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}
            </select>
            <button type="button" className="button-secondary" disabled={saving || !collectorId || Boolean(usersError)} onClick={() => void assign()}>{saving ? 'Saving…' : 'Assign'}</button>
          </div>
        )}
        <div className="admin-inline-control">
          <select aria-label={`Change status for ${vehicle.vehicle_number}`} value={status} onChange={(event) => setStatus(event.target.value as VehicleStatus)}>
            <option value="AVAILABLE">Available</option>
            {vehicle.status === 'ASSIGNED' &&             <option value="ASSIGNED" disabled>Assigned</option>}
            <option value="MAINTENANCE">Maintenance</option>
          </select>
          <button type="button" className="button-secondary" disabled={saving || status === vehicle.status} onClick={() => void updateStatus()}>{saving ? 'Saving…' : 'Update status'}</button>
        </div>
      </div>
    </article>
  )
}

function UserManagement({
  users,
  loading,
  error,
  currentUserId,
  onRefresh,
  onUpdate,
}: {
  users: AdminUser[]
  loading: boolean
  error: string
  currentUserId: number
  onRefresh: () => void
  onUpdate: (userId: number, update: Partial<Pick<AdminUser, 'role' | 'is_active'>>) => Promise<void>
}) {
  return (
    <>
      <AdminPageHeading
        eyebrow="ACCOUNT ADMINISTRATION"
        title="User management"
        description="Review account details and authorize active accounts as Collectors."
        onRefresh={onRefresh}
        loading={loading}
      />
      <div className="admin-info-banner">
        Public registration creates Citizen accounts only. There is no Admin API for creating accounts; promote an existing Citizen to Collector here.
      </div>
      {error && <AdminError message={error} />}
      {users.length === 0 ? (
        <AdminEmpty message="No registered accounts were returned." loading={loading} error={error} onRefresh={onRefresh} />
      ) : (
        <div className="admin-record-list">
          {users.map((account) => (
            <UserAdminCard
              key={account.id}
              account={account}
              currentUserId={currentUserId}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </>
  )
}

function UserAdminCard({
  account,
  currentUserId,
  onUpdate,
}: {
  account: AdminUser
  currentUserId: number
  onUpdate: (userId: number, update: Partial<Pick<AdminUser, 'role' | 'is_active'>>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  async function update(updateData: Partial<Pick<AdminUser, 'role' | 'is_active'>>) {
    setSaving(true)
    try {
      await onUpdate(account.id, updateData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="panel admin-record-card admin-user-card">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-id">USER #{account.id}</span>
          <h3>{account.name}</h3>
          <p>{account.email}</p>
        </div>
        <div className="admin-user-badges">
          <span className={`admin-role-badge admin-role-${account.role.toLowerCase()}`}>{account.role}</span>
          <span className={`admin-status-pill ${account.is_active ? 'admin-status-active' : 'admin-status-inactive'}`}>{account.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
      </div>
      <div className="admin-record-grid">
        <div><span>Registered</span><strong>{formatAdminDate(account.created_at)}</strong></div>
        <div><span>Account status</span><strong>{account.is_active ? 'Active' : 'Inactive'}</strong></div>
      </div>
      <div className="admin-action-row">
        {account.role === 'CITIZEN' && (
          <button
            type="button"
            className="button-primary"
            disabled={saving}
            onClick={() => void update({ role: 'COLLECTOR', is_active: true })}
          >
            <ShieldCheck size={14} /> {saving ? 'Saving…' : 'Authorize as Collector'}
          </button>
        )}
        {account.id !== currentUserId && (
          <button
            type="button"
            className="button-secondary"
            disabled={saving}
            onClick={() => void update({ is_active: !account.is_active })}
          >
            {saving ? 'Saving…' : account.is_active ? 'Deactivate account' : 'Activate account'}
          </button>
        )}
      </div>
    </article>
  )
}

function ComplaintManagement({
  complaints,
  collectors,
  loading,
  error,
  onRefresh,
  onReview,
  onAssign,
  onResolve,
  onUnauthorized,
}: {
  complaints: CleanCityReport[]
  collectors: AdminUser[]
  loading: boolean
  error: string
  onRefresh: () => void
  onReview: (complaintId: number, decision: CleanCityReviewDecision, reason: string, internalNote: string, duplicateOf: number | null, severity: 'LOW' | 'MEDIUM' | 'HIGH') => Promise<void>
  onAssign: (complaintId: number, collectorId: number, priority: 'LOW' | 'MEDIUM' | 'HIGH', dueAt: string) => Promise<void>
  onResolve: (actionId: number, resolutionNote: string) => Promise<void>
  onUnauthorized: () => void
}) {
  return (
    <>
      <AdminPageHeading
        eyebrow="COMMUNITY REPORTING"
        title="Citizen reports"
        description="Inspect evidence, review submissions, assign verified reports and record cleanup resolutions."
        onRefresh={onRefresh}
        loading={loading}
      />
      {error && <AdminError message={error} />}
      {complaints.length === 0 ? (
        <AdminEmpty message="No Citizen reports have been submitted." loading={loading} error={error} onRefresh={onRefresh} />
      ) : (
        <div className="admin-record-list">
          {complaints.map((complaint) => (
            <ComplaintAdminCard
              key={complaint.id}
              complaint={complaint}
              reports={complaints}
              collectors={collectors}
              onUnauthorized={onUnauthorized}
              onReview={onReview}
              onAssign={onAssign}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ComplaintAdminCard({
  complaint,
  reports,
  collectors,
  onUnauthorized,
  onReview,
  onAssign,
  onResolve,
}: {
  complaint: CleanCityReport
  reports: CleanCityReport[]
  collectors: AdminUser[]
  onUnauthorized: () => void
  onReview: (complaintId: number, decision: CleanCityReviewDecision, reason: string, internalNote: string, duplicateOf: number | null, severity: 'LOW' | 'MEDIUM' | 'HIGH') => Promise<void>
  onAssign: (complaintId: number, collectorId: number, priority: 'LOW' | 'MEDIUM' | 'HIGH', dueAt: string) => Promise<void>
  onResolve: (actionId: number, resolutionNote: string) => Promise<void>
}) {
  const reviewChoices = useMemo<CleanCityReviewDecision[]>(
    () => complaint.status === 'SUBMITTED'
      ? ['UNDER_REVIEW', 'REJECTED', 'DUPLICATE']
      : complaint.status === 'UNDER_REVIEW'
        ? ['VERIFIED', 'REJECTED', 'DUPLICATE']
        : [],
    [complaint.status],
  )
  const [decision, setDecision] = useState<CleanCityReviewDecision | ''>(reviewChoices[0] ?? '')
  const [reason, setReason] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [duplicateOf, setDuplicateOf] = useState('')
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(
    complaint.severity ?? 'MEDIUM',
  )
  const [collectorId, setCollectorId] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [dueAt, setDueAt] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setDecision(reviewChoices[0] ?? '')
    setReason('')
    setInternalNote('')
    setDuplicateOf('')
  }, [complaint.status])

  async function review() {
    if (!decision) return
    setSaving(true)
    try {
      await onReview(
        complaint.id,
        decision,
        reason,
        internalNote,
        duplicateOf ? Number(duplicateOf) : null,
        severity,
      )
    } finally {
      setSaving(false)
    }
  }

  async function assign() {
    if (!collectorId || !dueAt) return
    setSaving(true)
    try {
      await onAssign(complaint.id, Number(collectorId), priority, new Date(dueAt).toISOString())
    } finally {
      setSaving(false)
    }
  }

  async function resolve(actionId: number) {
    if (!resolutionNote.trim()) return
    setSaving(true)
    try {
      await onResolve(actionId, resolutionNote)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="panel admin-record-card">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-id">REPORT #{complaint.id}</span>
          <h3>{complaint.category.replaceAll('_', ' ')}</h3>
        </div>
        <span className={`admin-status-pill admin-status-${complaint.status.toLowerCase()}`}>
          {complaint.status.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="admin-record-grid">
        <div><span>Coordinates</span><strong>{complaint.latitude.toFixed(5)}, {complaint.longitude.toFixed(5)}</strong></div>
        <div><span>Citizen account</span><strong>{complaint.reporter_id ? `User #${complaint.reporter_id}` : 'Citizen account unavailable'}</strong></div>
        <div><span>Submitted</span><strong>{formatAdminDate(complaint.submitted_at)}</strong></div>
        <div><span>Severity</span><strong>{complaint.severity ?? 'Not set'}</strong></div>
      </div>
      <div className="admin-record-description">
        <span>Description</span>
        <p>{complaint.description}</p>
      </div>
      {complaint.evidence_url && (
        <CleanCityEvidence reportId={complaint.id} onUnauthorized={onUnauthorized} />
      )}
      {reviewChoices.length > 0 && (
      <div className="admin-inline-control">
        <label className="admin-field">
          Review decision
          <select value={decision} onChange={(event) => setDecision(event.target.value as CleanCityReviewDecision)}>
            {reviewChoices.map((value) => (
              <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>
        {decision === 'REJECTED' && (
          <label className="admin-field">
            Rejection reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </label>
        )}
        {decision === 'DUPLICATE' && (
          <label className="admin-field">
            Matching report
            <select value={duplicateOf} onChange={(event) => setDuplicateOf(event.target.value)}>
              <option value="">Select the original report</option>
              {reports.filter((report) => report.id !== complaint.id).map((report) => (
                <option key={report.id} value={report.id}>
                  #{report.id} · {report.category.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        )}
        {decision === 'VERIFIED' && (
          <label className="admin-field">
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
        )}
        <label className="admin-field">
          Internal review note <span className="citizen-optional">(staff only)</span>
          <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} maxLength={1000} rows={2} />
        </label>
        <button
          type="button"
          className="button-secondary"
          disabled={
            saving ||
            !decision ||
            (decision === 'REJECTED' && !reason.trim()) ||
            (decision === 'DUPLICATE' && (!duplicateOf || Number(duplicateOf) === complaint.id))
          }
          onClick={() => void review()}
        >
          {saving ? 'Saving…' : 'Submit review'}
        </button>
      </div>
      )}
      {complaint.status === 'VERIFIED' && (
        <div className="admin-inline-control">
          <label className="admin-field">
            Assign Collector
            <select value={collectorId} onChange={(event) => setCollectorId(event.target.value)}>
              <option value="">Select an active Collector</option>
              {collectors.map((collector) => (
                <option key={collector.id} value={collector.id}>
                  {collector.name} · {collector.email}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label className="admin-field">
            Due date
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
          <button type="button" className="button-secondary" disabled={saving || !collectorId || !dueAt} onClick={() => void assign()}>
            {saving ? 'Saving…' : 'Assign cleanup'}
          </button>
        </div>
      )}
      {complaint.cleanup_actions?.map((action) => {
        const assignedCollector = collectors.find((collector) => collector.id === action.assigned_to)
        return (
          <div className="admin-cleanup-action" key={action.id}>
            <div className="admin-record-grid">
              <div><span>Cleanup assignment</span><strong>{assignedCollector?.name ?? (action.assigned_to ? `Collector #${action.assigned_to}` : 'Unassigned')}</strong></div>
              <div><span>Priority</span><strong>{action.priority}</strong></div>
              <div><span>Action status</span><strong>{action.status}</strong></div>
              <div><span>Due</span><strong>{formatAdminDate(action.due_at)}</strong></div>
            </div>
            {action.status === 'ASSIGNED' ? (
              <div className="admin-inline-control">
                <label className="admin-field">
                  Resolution details
                  <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} maxLength={1000} rows={2} required />
                </label>
                <button type="button" className="button-secondary" disabled={saving || !resolutionNote.trim()} onClick={() => void resolve(action.id)}>
                  {saving ? 'Saving…' : 'Record resolution'}
                </button>
              </div>
            ) : (
              <p className="admin-record-description">
                Resolved {action.resolved_at ? formatAdminDate(action.resolved_at) : ''}
                {action.resolution_note ? ` · ${action.resolution_note}` : ''}
              </p>
            )}
          </div>
        )
      })}
      {(complaint.internal_notes?.length || complaint.status_updates.length > 0) && (
        <div className="admin-report-history">
          {complaint.internal_notes?.map((note, index) => (
            <p key={`note-${index}`}><strong>Internal note:</strong> {note}</p>
          ))}
          {complaint.status_updates.map((update) => (
            <p key={`${update.status}-${update.at}`}>
              <strong>{update.status.replaceAll('_', ' ')}</strong> · {formatAdminDate(update.at)}
              {update.reason ? ` · ${update.reason}` : ''}
            </p>
          ))}
        </div>
      )}
    </article>
  )
}

function hasValidCoordinates(request: PickupRequest) {
  return (
    Number.isFinite(request.latitude) &&
    request.latitude >= -90 &&
    request.latitude <= 90 &&
    Number.isFinite(request.longitude) &&
    request.longitude >= -180 &&
    request.longitude <= 180
  )
}

function MapAutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [24, 24], maxZoom: 14 })
    }
  }, [map, positions])

  return null
}

function DepotMapClick({
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

function AdminDepotSettings({
  onUnauthorized,
}: {
  onUnauthorized: () => void
}) {
  const [depot, setDepot] = useState<Depot | null>(null)
  const [name, setName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDepot = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await getDepot()
      setDepot(result)
      setName(result.name)
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
    } catch (requestError) {
      setError(handleRequestError(requestError, onUnauthorized))
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void loadDepot()
  }, [loadDepot])

  const parsedLatitude = Number(latitude)
  const parsedLongitude = Number(longitude)
  const validCoordinates =
    latitude.trim() !== '' &&
    longitude.trim() !== '' &&
    Number.isFinite(parsedLatitude) &&
    Number.isFinite(parsedLongitude) &&
    parsedLatitude >= -90 &&
    parsedLatitude <= 90 &&
    parsedLongitude >= -180 &&
    parsedLongitude <= 180

  const mapPosition: [number, number] = validCoordinates
    ? [parsedLatitude, parsedLongitude]
    : [depot?.latitude ?? 12.9716, depot?.longitude ?? 77.5946]

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      setError('Please enter a depot name.')
      return
    }

    if (!validCoordinates) {
      setError('Enter valid latitude and longitude values.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await updateDepot({
        name: name.trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      })
      setDepot(updated)
      setName(updated.name)
      setLatitude(String(updated.latitude))
      setLongitude(String(updated.longitude))
      setSuccess(
        'Depot settings updated successfully. Newly optimized routes will use these coordinates.',
      )
    } catch (requestError) {
      setError(handleRequestError(requestError, onUnauthorized))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-depot-settings">
      <div className="admin-depot-header">
        <div>
          <span className="admin-depot-eyebrow">SYSTEM CONFIGURATION</span>
          <h2>Depot settings</h2>
          <p>
            Configure the shared central collection hub used as the default
            starting point for newly optimized routes.
          </p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void loadDepot()}
          disabled={loading || saving}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-feedback admin-feedback-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="admin-feedback admin-feedback-success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <p className="admin-depot-status">Loading depot configuration...</p>
      ) : (
        <>
          <div className="admin-depot-current">
            <div>
              <span>ACTIVE SHARED DEPOT</span>
              <strong>{depot?.name ?? 'Not configured'}</strong>
            </div>
            <div>
              <span>COORDINATES</span>
              <strong>
                {depot
                  ? `${depot.latitude}, ${depot.longitude}`
                  : 'Not available'}
              </strong>
            </div>
          </div>

          <form className="admin-depot-form" onSubmit={handleSave}>
            <h3>Update depot location</h3>
            <p>
              Enter coordinates manually or click anywhere on the map to
              select the new location.
            </p>

            <label className="admin-depot-field">
              Depot name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={150}
                required
                placeholder="Urban Nova Central Collection Hub"
              />
            </label>

            <div className="admin-depot-coordinate-grid">
              <label className="admin-depot-field">
                Latitude
                <input
                  type="number"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  min="-90"
                  max="90"
                  step="any"
                  required
                />
              </label>
              <label className="admin-depot-field">
                Longitude
                <input
                  type="number"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  min="-180"
                  max="180"
                  step="any"
                  required
                />
              </label>
            </div>

            <div className="admin-depot-map-heading">
              <strong>Select on map</strong>
              <span>Click the map to update the coordinates</span>
            </div>
            <div className="admin-depot-map">
              <MapContainer
                key="admin-depot-settings-map"
                center={mapPosition}
                zoom={13}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <DepotMapClick
                  onSelect={(position) => {
                    setLatitude(position[0].toFixed(6))
                    setLongitude(position[1].toFixed(6))
                    setError('')
                    setSuccess('')
                  }}
                />
                <CircleMarker
                  center={mapPosition}
                  radius={10}
                  pathOptions={{
                    color: '#00e69a',
                    fillColor: '#00e69a',
                    fillOpacity: 0.8,
                  }}
                >
                  <Popup>{name || 'Selected depot location'}</Popup>
                </CircleMarker>
              </MapContainer>
            </div>

            <div className="admin-depot-actions">
              <button
                type="submit"
                className="button-primary"
                disabled={saving || !validCoordinates || !name.trim()}
              >
                {saving ? 'Saving...' : 'Save depot configuration'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

function AdminRoutePlanner({
  requests,
  collections,
  vehicles,
  collectors,
  loading,
  error,
  onRefresh,
  onUnauthorized,
}: {
  requests: PickupRequest[]
  collections: CollectionRecord[]
  vehicles: VehicleRecord[]
  collectors: AdminUser[]
  loading: boolean
  error: string
  onRefresh: () => void
  onUnauthorized: () => void
}) {
  const eligibleRequests = useMemo(
    () => requests.filter(
      (request) => request.status === 'APPROVED' && hasValidCoordinates(request),
    ),
    [requests],
  )
  const eligibleCollections = useMemo(
    () => collections.filter(
      (
        collection,
      ): collection is CollectionRecord & {
        latitude: number
        longitude: number
      } =>
        (collection.status === 'SCHEDULED' || collection.status === 'ASSIGNED') &&
        collection.latitude !== null &&
        collection.longitude !== null &&
        Number.isFinite(collection.latitude) &&
        Number.isFinite(collection.longitude) &&
        collection.latitude >= -90 &&
        collection.latitude <= 90 &&
        collection.longitude >= -180 &&
        collection.longitude <= 180,
    ),
    [collections],
  )
  const [routeSource, setRouteSource] = useState<'collections' | 'requests'>('collections')
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null)
  const [depot, setDepot] = useState<[number, number] | null>(null)
  const [route, setRoute] = useState<CalculatedRoute | null>(null)
  const [savedRouteId, setSavedRouteId] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [routeError, setRouteError] = useState('')

  useEffect(() => {
    let active = true

    getDepot()
      .then((sharedDepot) => {
        if (!active) return
        setDepot((current) =>
          current ?? [sharedDepot.latitude, sharedDepot.longitude],
        )
      })
      .catch((requestError) => {
        if (active) {
          setRouteError(handleRequestError(requestError, onUnauthorized))
        }
      })

    return () => {
      active = false
    }
  }, [onUnauthorized])
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savingRoute, setSavingRoute] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedCollectorId, setSelectedCollectorId] = useState('')
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[] | null>(null)
  const effectiveSelectedIds = useMemo(
    () => selectedIds ?? eligibleRequests.map((request) => request.id),
    [eligibleRequests, selectedIds],
  )
  const selectedRequests = useMemo(
    () => eligibleRequests.filter((request) =>
      effectiveSelectedIds.includes(request.id),
    ),
    [effectiveSelectedIds, eligibleRequests],
  )
  const effectiveCollectionIds = useMemo(
    () => selectedCollectionIds ?? eligibleCollections.map((collection) => collection.id),
    [eligibleCollections, selectedCollectionIds],
  )
  const selectedCollections = useMemo(
    () => eligibleCollections.filter((collection) =>
      effectiveCollectionIds.includes(collection.id),
    ),
    [effectiveCollectionIds, eligibleCollections],
  )
  const selectedStops = useMemo<RouteStop[]>(
    () => routeSource === 'collections'
      ? selectedCollections.map((collection) => ({
          id: `collection-${collection.id}`,
          name: collection.location,
          latitude: collection.latitude,
          longitude: collection.longitude,
        }))
      : selectedRequests.map((request) => ({
          id: `pickup-${request.id}`,
          name: request.location,
          latitude: request.latitude,
          longitude: request.longitude,
        })),
    [routeSource, selectedCollections, selectedRequests],
  )
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === Number(selectedVehicleId),
  )
  const selectedVehicleCollectorId = selectedVehicle?.assigned_collector_id
  const selectedCollectors = selectedVehicleCollectorId
    ? collectors.filter((collector) => collector.id === selectedVehicleCollectorId)
    : collectors
  const hasVehicleAssignmentConflict =
    routeSource === 'collections' &&
    Boolean(selectedVehicleId) &&
    selectedCollections.some(
      (collection) =>
        collection.vehicle_id !== null &&
        collection.vehicle_id !== Number(selectedVehicleId),
    )
  const routeCenter: [number, number] =
    depot ??
    (selectedStops.length
      ? [selectedStops[0].latitude, selectedStops[0].longitude]
      : [12.9716, 77.5946])
  const mapPositions = useMemo(() => {
    const positions = selectedStops.map(
      (stop) => [stop.latitude, stop.longitude] as [number, number],
    )
    if (depot) positions.push(depot)
    if (route) positions.push(...route.route_geometry)
    return positions
  }, [depot, route, selectedStops])

  useEffect(() => {
    const availableIds = new Set(eligibleRequests.map((request) => request.id))
    setSelectedIds((current) =>
      current === null ? null : current.filter((id) => availableIds.has(id)),
    )
    if (savedRouteId === null) {
      setRoute(null)
      setRouteError('')
    }
  }, [eligibleRequests, savedRouteId])

  useEffect(() => {
    const availableIds = new Set(eligibleCollections.map((collection) => collection.id))
    setSelectedCollectionIds((current) =>
      current === null ? null : current.filter((id) => availableIds.has(id)),
    )
    if (savedRouteId === null) {
      setRoute(null)
      setRouteError('')
    }
  }, [eligibleCollections, savedRouteId])

  useEffect(() => {
    let active = true
    setSavedLoading(true)
    listSavedRoutes()
      .then((routes) => {
        if (active) setSavedRoutes(routes)
      })
      .catch((requestError) => {
        if (active) setSaveError(handleRequestError(requestError, onUnauthorized))
      })
      .finally(() => {
        if (active) setSavedLoading(false)
      })
    return () => {
      active = false
    }
  }, [onUnauthorized])

  function toggleRequest(requestId: number) {
    setRoute(null)
    setSavedRouteId(null)
    setSelectedIds((current) => {
      const currentIds = current ?? eligibleRequests.map((request) => request.id)
      return currentIds.includes(requestId)
        ? currentIds.filter((id) => id !== requestId)
        : [...currentIds, requestId]
    })
  }

  function toggleCollection(collectionId: number) {
    setRoute(null)
    setSavedRouteId(null)
    setSelectedCollectionIds((current) => {
      const currentIds =
        current ?? eligibleCollections.map((collection) => collection.id)
      return currentIds.includes(collectionId)
        ? currentIds.filter((id) => id !== collectionId)
        : [...currentIds, collectionId]
    })
  }

  async function calculateRoute() {
    if (!depot) {
      setRouteError('Choose a depot location by clicking the map.')
      return
    }
    if (selectedStops.length === 0) {
      setRouteError('Select at least one route stop with valid coordinates.')
      return
    }

    setCalculating(true)
    setRouteError('')
    setRoute(null)
    setSavedRouteId(null)
    try {
      setRoute(await optimizeRoute(
        { latitude: depot[0], longitude: depot[1] },
        selectedStops,
      ))
    } catch (requestError) {
      setRouteError(handleRequestError(requestError, onUnauthorized))
    } finally {
      setCalculating(false)
    }
  }

  async function saveCalculatedRoute() {
    if (!depot) {
      setSaveError('Choose a depot location before saving the route.')
      return
    }
    if (routeSource !== 'collections') {
      setSaveError('Only collection-based routes can be saved and assigned.')
      return
    }
    if (effectiveCollectionIds.length === 0) {
      setSaveError('Select at least one scheduled or assigned collection.')
      return
    }
    if (!selectedVehicleId || !selectedCollectorId) {
      setSaveError('Select an assigned vehicle and its Collector before saving.')
      return
    }

    setSavingRoute(true)
    setSaveError('')
    try {
      const saved = await saveRoute(
        { latitude: depot[0], longitude: depot[1] },
        effectiveCollectionIds,
        selectedVehicleId ? Number(selectedVehicleId) : null,
        selectedCollectorId ? Number(selectedCollectorId) : null,
      )
      setSavedRoutes((current) => [saved, ...current])
      setRoute(saved)
      setSavedRouteId(saved.id)
    } catch (requestError) {
      setSaveError(handleRequestError(requestError, onUnauthorized))
    } finally {
      setSavingRoute(false)
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="GIS ROUTING"
        title="Route planner"
        description="Choose route stops, set a depot, preview the optimized order, then save and assign collection routes."
        onRefresh={onRefresh}
        loading={loading}
      />
      {error && <AdminError message={error} />}
      {routeError && <AdminError message={routeError} />}
      {saveError && <AdminError message={saveError} />}
      <div className="admin-info-banner">
        Pickup-request routes are preview-only. Routes saved from scheduled or assigned collections are persisted and assigned.
      </div>

      <article className="panel admin-form-card">
        <div className="admin-card-heading">
          <div>
            <span className="section-kicker">ROUTE SETUP</span>
            <h3>Preview and assign a route</h3>
          </div>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field admin-form-wide">
            Route stops
            <select
              value={routeSource}
              disabled={calculating || savingRoute}
              onChange={(event) => {
                setRouteSource(
                  event.target.value === 'requests' ? 'requests' : 'collections',
                )
                setRoute(null)
                setSavedRouteId(null)
                setRouteError('')
                setSaveError('')
              }}
            >
              <option value="collections">Scheduled or assigned collections</option>
              <option value="requests">Approved pickup requests · preview only</option>
            </select>
          </label>
          <label className="admin-field">
            Vehicle
            <select
              value={selectedVehicleId}
              disabled={routeSource !== 'collections' || calculating || savingRoute}
              onChange={(event) => {
                const vehicleId = event.target.value
                setSelectedVehicleId(vehicleId)

                const vehicle = vehicles.find(
                  (item) => item.id === Number(vehicleId),
                )

                setSelectedCollectorId(
                  vehicle?.assigned_collector_id
                    ? String(vehicle.assigned_collector_id)
                    : '',
                )

                setSelectedCollectionIds((current) => {
                  const currentIds =
                    current ?? eligibleCollections.map((collection) => collection.id)

                  return currentIds.filter((id) => {
                    const collection = eligibleCollections.find(
                      (item) => item.id === id,
                    )

                    return (
                      collection !== undefined &&
                      (
                        !vehicleId ||
                        collection.vehicle_id === null ||
                        collection.vehicle_id === Number(vehicleId)
                      )
                    )
                  })
                })

                setRoute(null)
                setSavedRouteId(null)
                setRouteError('')
                setSaveError('')
              }}
            >
              <option value="">Select an assigned vehicle</option>
              {vehicles.filter(
                (vehicle) =>
                  vehicle.status === 'ASSIGNED' &&
                  vehicle.assigned_collector_id !== null &&
                  collectors.some(
                    (collector) => collector.id === vehicle.assigned_collector_id,
                  ),
              ).map((vehicle) => {
                const collector = collectors.find(
                  (item) => item.id === vehicle.assigned_collector_id,
                )
                return (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_number} · {collector?.name ?? 'Assigned Collector'}
                  </option>
                )
              })}
            </select>
          </label>
          <label className="admin-field">
            Collector
            <select
              value={selectedCollectorId}
              disabled={routeSource !== 'collections' || calculating || savingRoute}
              onChange={(event) => setSelectedCollectorId(event.target.value)}
            >
              <option value="">Select a Collector</option>
              {selectedCollectors.map((collector) => (
                <option key={collector.id} value={collector.id}>
                  {collector.name} · {collector.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="admin-route-disclaimer">
          Preview calculation does not save anything. Saving recalculates the selected collection route and persists its ordered stops, geometry, vehicle and Collector assignment.
        </p>
        {hasVehicleAssignmentConflict && (
          <p className="admin-form-error" role="alert">
            A selected collection is assigned to a different vehicle. Choose its assigned vehicle or remove that collection before saving.
          </p>
        )}
        <div className="admin-form-footer">
          <p>
            {selectedStops.length} stop(s) selected
            {routeSource === 'requests' ? ' · preview only' : ' · collections'}
          </p>
          <button
            type="button"
            className="button-primary"
            onClick={() => void saveCalculatedRoute()}
            disabled={
              savingRoute ||
              !depot ||
              routeSource !== 'collections' ||
              effectiveCollectionIds.length === 0 ||
              !selectedVehicleId ||
              !selectedCollectorId ||
              hasVehicleAssignmentConflict ||
              !route ||
              savedRouteId !== null
            }
          >
            {savingRoute ? 'Saving route…' : 'Save & assign route'} <ArrowRight size={14} />
          </button>
        </div>
      </article>

      {savedLoading ? (
        <p className="admin-loading">Loading saved routes…</p>
      ) : savedRoutes.length > 0 ? (
        <div className="admin-record-list">
          {savedRoutes.map((savedRoute) => (
            <article className="panel admin-record-card" key={savedRoute.id}>
              <div className="admin-record-heading">
                <div>
                  <span className="admin-record-id">ROUTE #{savedRoute.id}</span>
                  <h3>{savedRoute.number_of_stops} collection stops</h3>
                </div>
                <span className="admin-status-pill admin-status-assigned">CALCULATED</span>
              </div>
              <div className="admin-record-grid">
                <div><span>Distance</span><strong>{savedRoute.geometry_distance_km} km</strong></div>
                <div><span>Duration</span><strong>{savedRoute.geometry_duration_min} min</strong></div>
                <div>
                  <span>Vehicle</span>
                  <strong>
                    {savedRoute.vehicle_id
                      ? vehicles.find((item) => item.id === savedRoute.vehicle_id)?.vehicle_number
                        ?? `Vehicle #${savedRoute.vehicle_id}`
                      : 'Unassigned'}
                  </strong>
                </div>
                <div>
                  <span>Collector</span>
                  <strong>
                    {savedRoute.collector_id
                      ? collectors.find((item) => item.id === savedRoute.collector_id)?.name
                        ?? `User #${savedRoute.collector_id}`
                      : 'Unassigned'}
                  </strong>
                </div>
              </div>
              <div className="admin-form-footer">
                <span />
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setRouteSource('collections')
                    setDepot([savedRoute.depot_latitude, savedRoute.depot_longitude])
                    setSelectedCollectionIds(savedRoute.collection_ids)
                    setSelectedVehicleId(
                      savedRoute.vehicle_id ? String(savedRoute.vehicle_id) : '',
                    )
                    setSelectedCollectorId(
                      savedRoute.collector_id ? String(savedRoute.collector_id) : '',
                    )
                    setRoute(savedRoute)
                    setSavedRouteId(savedRoute.id)
                    setRouteError('')
                    setSaveError('')
                  }}
                >
                  View saved route
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="admin-route-layout">
        <article className="panel admin-route-map-panel">
          <div className="admin-card-heading">
            <div>
              <span className="section-kicker">DEPOT AND STOPS</span>
              <h3>Select route locations</h3>
              <p>Click anywhere on the map to set or change the depot.</p>
            </div>
          </div>
          <div className="admin-map-frame admin-route-map-frame">
            <MapContainer
              center={routeCenter}
              zoom={12}
              scrollWheelZoom
              className="leaflet-map"
            >
              <MapAutoFit positions={mapPositions} />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DepotMapClick
                onSelect={(position) => {
                  if (calculating || savingRoute) return
                  setDepot(position)
                  setRoute(null)
                  setSavedRouteId(null)
                  setRouteError('')
                  setSaveError('')
                }}
              />
              {routeSource === 'collections'
                ? eligibleCollections.map((collection) => {
                    const selected = effectiveCollectionIds.includes(collection.id)
                    return (
                      <CircleMarker
                        key={`collection-${collection.id}`}
                        center={[collection.latitude, collection.longitude]}
                        radius={selected ? 9 : 6}
                        interactive={false}
                        pathOptions={{
                          color: selected ? '#c9ff4a' : '#7b8b80',
                          fillColor: selected ? '#c9ff4a' : '#7b8b80',
                          fillOpacity: selected ? 0.95 : 0.55,
                        }}
                      />
                    )
                  })
                : eligibleRequests.map((request) => {
                    const selected = effectiveSelectedIds.includes(request.id)
                    return (
                      <CircleMarker
                        key={`pickup-${request.id}`}
                        center={[request.latitude, request.longitude]}
                        radius={selected ? 9 : 6}
                        interactive={false}
                        pathOptions={{
                          color: selected ? '#c9ff4a' : '#7b8b80',
                          fillColor: selected ? '#c9ff4a' : '#7b8b80',
                          fillOpacity: selected ? 0.95 : 0.55,
                        }}
                      />
                    )
                  })}
              {route?.ordered_stops.map((stop, index) => (
                <CircleMarker
                  key={`${stop.id}-${index}`}
                  center={[stop.latitude, stop.longitude]}
                  radius={7}
                  pathOptions={{
                    color: '#c9ff4a',
                    fillColor: '#c9ff4a',
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <strong>Stop {index + 1}</strong>
                    <br />
                    {stop.name}
                  </Popup>
                </CircleMarker>
              ))}
              {depot && (
                <CircleMarker
                  center={depot}
                  radius={10}
                  pathOptions={{ color: '#ffb66d', fillColor: '#ffb66d', fillOpacity: 1 }}
                >
                  <Popup>Selected depot</Popup>
                </CircleMarker>
              )}
              {route?.route_geometry.length ? (
                <Polyline positions={route.route_geometry} pathOptions={{ color: '#4edce0', weight: 5 }} />
              ) : null}
            </MapContainer>
          </div>
          <p className="admin-depot-coordinate">
            {depot
              ? `Depot selected: ${depot[0].toFixed(5)}, ${depot[1].toFixed(5)}`
              : 'No depot selected. Click the map to choose one.'}
          </p>
        </article>
        <article className="panel admin-route-stops">
          <div className="admin-card-heading">
            <div>
              <span className="section-kicker">
                {routeSource === 'collections' ? 'COLLECTIONS' : 'APPROVED REQUESTS'}
              </span>
              <h3>Route stops <span className="admin-count">{selectedStops.length}</span></h3>
            </div>
          </div>
          <div className="admin-route-stop-list">
            {routeSource === 'collections'
              ? eligibleCollections.map((collection) => (
                  <label className="admin-route-stop" key={collection.id}>
                    <input
                      type="checkbox"
                      disabled={
                        calculating ||
                        savingRoute ||
                        (
                          Boolean(selectedVehicleId) &&
                          collection.vehicle_id !== null &&
                          collection.vehicle_id !== Number(selectedVehicleId)
                        )
                      }
                      checked={effectiveCollectionIds.includes(collection.id)}
                      onChange={() => toggleCollection(collection.id)}
                    />
                    <span>
                      <strong>Collection #{collection.id} · {collection.location}</strong>
                      <small>{collection.status} · {collection.latitude.toFixed(5)}, {collection.longitude.toFixed(5)}</small>
                    </span>
                  </label>
                ))
              : eligibleRequests.map((request) => (
                  <label className="admin-route-stop" key={request.id}>
                    <input
                      type="checkbox"
                      disabled={calculating || savingRoute}
                      checked={effectiveSelectedIds.includes(request.id)}
                      onChange={() => toggleRequest(request.id)}
                    />
                    <span>
                      <strong>Request #{request.id} · {request.location}</strong>
                      <small>{request.category.replaceAll('_', ' ')} · {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}</small>
                    </span>
                  </label>
                ))}
            {selectedStops.length === 0 && (
              <small>
                {routeSource === 'collections'
                  ? 'No scheduled or assigned collections have valid coordinates yet.'
                  : 'No approved pickup requests with valid coordinates are available.'}
              </small>
            )}
          </div>
          <button
            type="button"
            className="button-primary admin-route-submit"
            onClick={() => void calculateRoute()}
            disabled={
              calculating ||
              savingRoute ||
              loading ||
              !depot ||
              selectedStops.length === 0
            }
          >
            <Route size={15} /> {calculating ? 'Calculating route…' : 'Calculate route preview'}
          </button>
        </article>
      </div>

      {route && (
        <article className="panel admin-calculated-route">
          <div className="admin-route-result-heading">
            <div>
              <span className="section-kicker">
                {savedRouteId === null ? 'CALCULATED ROUTE · NOT SAVED' : `SAVED ROUTE #${savedRouteId}`}
              </span>
              <h3>Optimized stop order</h3>
            </div>
            <span className={`admin-status-pill ${savedRouteId === null ? 'admin-status-approved' : 'admin-status-assigned'}`}>
              {savedRouteId === null ? 'PREVIEW' : 'PERSISTED'}
            </span>
          </div>
          <div className="admin-route-metrics">
            <div><span>Distance</span><strong>{route.optimized_distance_km} km</strong></div>
            <div><span>Estimated duration</span><strong>{route.total_travel_time_min} min</strong></div>
            <div><span>Stops</span><strong>{route.number_of_stops}</strong></div>
            <div><span>Distance saved</span><strong>{route.distance_saved_km} km</strong></div>
          </div>
          <p className="admin-route-disclaimer">
            {savedRouteId === null
              ? routeSource === 'collections'
                ? 'This preview is temporary. Select an assigned vehicle and Collector, then choose Save & assign route to persist it.'
                : 'This approved-pickup preview is temporary and cannot be assigned or saved as a collection route.'
              : 'This route is persisted with its ordered stops, geometry and assignments.'}
          </p>
          <ol className="admin-ordered-stops">
            {route.ordered_stops.map((stop) => (
              <li key={stop.id}>{stop.name}</li>
            ))}
          </ol>
        </article>
      )}
    </>
  )
}
