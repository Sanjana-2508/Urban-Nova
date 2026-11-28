
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { RefreshCw } from 'lucide-react'
import { ApiError } from '../services/api'
import type { AuthenticatedUser } from '../services/auth'
import {
  getCleanCityHotspots,
  type CleanCityHotspot,
} from '../services/cleancity'
import {
  listCollections,
  type CollectionRecord,
} from '../services/collections'
import { listAdminUsers } from '../services/admin'
import {
  listMapLocations,
  type MapLocation,
} from '../services/mapLocations'
import {
  listPickupRequests,
  type PickupRequest,
} from '../services/pickupRequests'
import {
  listSavedRoutes,
  type SavedRoute,
} from '../services/routing'
import { listVehicles, type VehicleRecord } from '../services/vehicles'
import { getRequestError } from './CitizenWorkspace'

type Props = {
  user: AuthenticatedUser
  onUnauthorized: () => void
  requests?: PickupRequest[]
  collections?: CollectionRecord[]
  hotspots?: CleanCityHotspot[]
  loading?: boolean
  error?: string
  showCollectorRouteSummaries?: boolean
  onRefresh?: () => void
}

type Layers = {
  collectionPoints: boolean
  pickupRequests: boolean
  collections: boolean
  reportingOffices: boolean
  hotspots: boolean
  routes: boolean
  vehicles: boolean
}

const initialLayers: Layers = {
  collectionPoints: true,
  pickupRequests: true,
  collections: true,
  reportingOffices: true,
  hotspots: true,
  routes: true,
  vehicles: true,
}

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946]

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function positionAlongRoute(
  points: [number, number][],
  progress: number,
): [number, number] | null {
  if (points.length === 0) return null
  if (points.length === 1) return points[0]

  const lengths = points.slice(1).map((point, index) =>
    Math.hypot(
      point[0] - points[index][0],
      point[1] - points[index][1],
    ),
  )

  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  if (totalLength === 0) return points[0]

  let remaining = totalLength * progress

  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index]

    if (remaining <= segmentLength || index === lengths.length - 1) {
      const ratio = segmentLength === 0 ? 0 : remaining / segmentLength

      return [
        points[index][0] +
          (points[index + 1][0] - points[index][0]) * ratio,
        points[index][1] +
          (points[index + 1][1] - points[index][1]) * ratio,
      ]
    }

    remaining -= segmentLength
  }

  return points[points.length - 1]
}

function MapAutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [28, 28], maxZoom: 14 })
    }
  }, [map, positions])

  return null
}

function demoTag(isDemo: boolean) {
  return isDemo ? (
    <>
      <br />
      <strong>DEMO RECORD</strong>
    </>
  ) : null
}

export function LiveGISMap({
  user,
  onUnauthorized,
  requests,
  collections,
  hotspots,
  loading = false,
  error = '',
  showCollectorRouteSummaries = true,
  onRefresh,
}: Props) {
  const [mapLocations, setMapLocations] = useState<MapLocation[]>([])
  const [loadedRequests, setLoadedRequests] = useState<PickupRequest[]>([])
  const [loadedCollections, setLoadedCollections] = useState<CollectionRecord[]>([])
  const [loadedHotspots, setLoadedHotspots] = useState<CleanCityHotspot[]>([])
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [userNames, setUserNames] = useState<Map<number, string>>(new Map())
  const [loadingLayers, setLoadingLayers] = useState(true)
  const [layerErrors, setLayerErrors] = useState<string[]>([])
  const [layers, setLayers] = useState<Layers>(initialLayers)
  const [simulationEnabled, setSimulationEnabled] = useState(false)
  const [simulationStartedAt, setSimulationStartedAt] = useState<number | null>(null)
  const [simulationNow, setSimulationNow] = useState(() => Date.now())

  const loadLayers = useCallback(async () => {
    setLoadingLayers(true)
    setLayerErrors([])

    const errors: string[] = []

    const load = async <T,>(
      action: () => Promise<T>,
      onSuccess: (value: T) => void,
      label: string,
    ) => {
      try {
        onSuccess(await action())
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          requestError.status === 401
        ) {
          onUnauthorized()
        }

        errors.push(`${label}: ${getRequestError(requestError)}`)
      }
    }

    const tasks: Promise<void>[] = [
      load(listMapLocations, setMapLocations, 'Map locations'),
    ]

    const canViewRoutes =
      user.role === 'ADMIN' || user.role === 'COLLECTOR'

    if (canViewRoutes) {
      tasks.push(
        load(listSavedRoutes, setSavedRoutes, 'Saved routes'),
      )
      tasks.push(
        load(listVehicles, setVehicles, 'Assigned vehicles'),
      )
    } else {
      setSavedRoutes([])
      setVehicles([])
    }

    if (
      requests === undefined &&
      (user.role === 'ADMIN' || user.role === 'CITIZEN')
    ) {
      tasks.push(
        load(
          listPickupRequests,
          setLoadedRequests,
          'Pickup requests',
        ),
      )
    } else if (user.role === 'COLLECTOR') {
      setLoadedRequests([])
    }

    if (
      collections === undefined &&
      (user.role === 'ADMIN' || user.role === 'COLLECTOR')
    ) {
      tasks.push(
        load(
          listCollections,
          setLoadedCollections,
          'Collections',
        ),
      )
    } else if (user.role === 'CITIZEN') {
      setLoadedCollections([])
    }

    if (hotspots === undefined) {
      tasks.push(
        load(
          () => getCleanCityHotspots(),
          (response) => setLoadedHotspots(response.items),
          'CleanCity hotspots',
        ),
      )
    }

    if (user.role === 'ADMIN') {
      tasks.push(
        load(
          listAdminUsers,
          (accounts) =>
            setUserNames(
              new Map(
                accounts.map((account) => [
                  account.id,
                  account.name,
                ]),
              ),
            ),
          'User directory',
        ),
      )
    } else {
      setUserNames(new Map([[user.id, user.name]]))
    }

    await Promise.all(tasks)

    setLayerErrors(errors)
    setLoadingLayers(false)
  }, [collections, hotspots, onUnauthorized, requests, user])

  useEffect(() => {
    void loadLayers()
  }, [loadLayers])

  useEffect(() => {
    if (!simulationEnabled) return

    const intervalId = window.setInterval(
      () => setSimulationNow(Date.now()),
      1000,
    )

    return () => window.clearInterval(intervalId)
  }, [simulationEnabled])

  const displayedRequests = requests ?? loadedRequests
  const displayedCollections = collections ?? loadedCollections
  const displayedHotspots = hotspots ?? loadedHotspots

  const displayErrors = [
    ...(error ? [error] : []),
    ...layerErrors,
  ]

  const mappedHotspots = useMemo(
    () =>
      displayedHotspots.filter((hotspot) =>
        validCoordinate(
          hotspot.latitude,
          hotspot.longitude,
        ),
      ),
    [displayedHotspots],
  )

  const mappedRequests = useMemo(
    () =>
      displayedRequests.filter(
        (request) =>
          request.status !== 'REJECTED' &&
          validCoordinate(
            request.latitude,
            request.longitude,
          ),
      ),
    [displayedRequests],
  )

  const mappedCollections = useMemo(
    () =>
      displayedCollections.filter(
        (
          collection,
        ): collection is CollectionRecord & {
          latitude: number
          longitude: number
        } =>
          collection.status !== 'CANCELLED' &&
          collection.latitude !== null &&
          collection.longitude !== null &&
          validCoordinate(
            collection.latitude,
            collection.longitude,
          ),
      ),
    [displayedCollections],
  )

  const points = useMemo(
    () =>
      mapLocations.filter(
        (location) =>
          location.location_type === 'COLLECTION_POINT' &&
          validCoordinate(
            location.latitude,
            location.longitude,
          ),
      ),
    [mapLocations],
  )

  const offices = useMemo(
    () =>
      mapLocations.filter(
        (location) =>
          location.location_type === 'REPORTING_OFFICE' &&
          validCoordinate(
            location.latitude,
            location.longitude,
          ),
      ),
    [mapLocations],
  )

  const vehicleNames = useMemo(
    () =>
      new Map(
        vehicles.map((vehicle) => [
          vehicle.id,
          vehicle.vehicle_number,
        ]),
      ),
    [vehicles],
  )

  const simulationRoutes = useMemo(
    () =>
      savedRoutes.filter(
        (route) =>
          route.is_demo &&
          route.vehicle_id !== null &&
          route.route_geometry.filter(
            (position): position is [number, number] =>
              position.length >= 2 &&
              validCoordinate(
                position[0],
                position[1],
              ),
          ).length > 1,
      ),
    [savedRoutes],
  )

  const simulationProgress =
    simulationStartedAt === null
      ? 0
      : ((simulationNow - simulationStartedAt) % 300_000) /
        300_000

  const simulatedVehiclePositions = useMemo(() => {
    if (!simulationEnabled || simulationStartedAt === null) {
      return []
    }

    return simulationRoutes.flatMap((route) => {
      const geometry = route.route_geometry.filter(
        (position): position is [number, number] =>
          position.length >= 2 &&
          validCoordinate(
            position[0],
            position[1],
          ),
      )

      const position = positionAlongRoute(
        geometry,
        simulationProgress,
      )

      return position ? [{ route, position }] : []
    })
  }, [
    simulationEnabled,
    simulationRoutes,
    simulationProgress,
    simulationStartedAt,
  ])

  const positions = useMemo(() => {
    const result: [number, number][] = []

    if (layers.collectionPoints) {
      result.push(
        ...points.map(
          (point): [number, number] => [
            point.latitude,
            point.longitude,
          ],
        ),
      )
    }

    if (layers.reportingOffices) {
      result.push(
        ...offices.map(
          (office): [number, number] => [
            office.latitude,
            office.longitude,
          ],
        ),
      )
    }

    if (layers.pickupRequests) {
      result.push(
        ...mappedRequests.map(
          (request): [number, number] => [
            request.latitude,
            request.longitude,
          ],
        ),
      )
    }

    if (layers.collections) {
      result.push(
        ...mappedCollections.map(
          (collection): [number, number] => [
            collection.latitude,
            collection.longitude,
          ],
        ),
      )
    }

    if (layers.hotspots) {
      result.push(
        ...mappedHotspots.map(
          (hotspot): [number, number] => [
            hotspot.latitude,
            hotspot.longitude,
          ],
        ),
      )
    }

    if (layers.routes) {
      for (const route of savedRoutes) {
        if (
          validCoordinate(
            route.depot_latitude,
            route.depot_longitude,
          )
        ) {
          result.push([
            route.depot_latitude,
            route.depot_longitude,
          ])
        }

        result.push(
          ...route.route_geometry.filter(
            (position): position is [number, number] =>
              position.length >= 2 &&
              validCoordinate(
                position[0],
                position[1],
              ),
          ),
        )
      }
    }

    return result
  }, [
    layers,
    mappedCollections,
    mappedHotspots,
    mappedRequests,
    offices,
    points,
    savedRoutes,
  ])

  function toggleLayer(layer: keyof Layers) {
    setLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }))
  }

  return (
    <section className="live-gis-workspace">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            GEOSPATIAL INTELLIGENCE
          </span>
          <h2>GIS map</h2>
          <p>
            Map overlays use API-backed records. Vehicle GPS
            tracking is unavailable; optional movement simulation
            is limited to demo routes.
          </p>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            onRefresh?.()
            void loadLayers()
          }}
          disabled={loadingLayers || loading}
        >
          <RefreshCw size={14} />
          {loadingLayers || loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <article className="panel live-gis-panel">
        <div
          className="live-gis-layer-controls"
          aria-label="Map layers"
        >
          {([
            ['collectionPoints', 'Collection points'],
            ...(user.role !== 'COLLECTOR'
              ? [['pickupRequests', 'Pickup requests'] as const]
              : []),
            [
              'collections',
              user.role === 'COLLECTOR'
                ? 'Assigned collections'
                : 'Collections',
            ],
            ['reportingOffices', 'Reporting offices'],
            ['hotspots', 'CleanCity hotspots'],
            ['routes', 'Saved optimized routes'],
            ...(user.role === 'ADMIN' ||
            user.role === 'COLLECTOR'
              ? [['vehicles', 'Vehicles'] as const]
              : []),
          ] as const).map(([layer, label]) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={() => toggleLayer(layer)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {(user.role === 'ADMIN' ||
          user.role === 'COLLECTOR') && (
          <div className="live-gis-simulation-controls">
            <label>
              <input
                type="checkbox"
                checked={simulationEnabled}
                disabled={simulationRoutes.length === 0}
                onChange={(event) => {
                  const enabled = event.target.checked
                  const now = Date.now()

                  setSimulationEnabled(enabled)
                  setSimulationStartedAt(
                    enabled ? now : null,
                  )
                  setSimulationNow(now)
                }}
              />
              <span>Simulate demo vehicle movement</span>
            </label>

            <small>
              {simulationRoutes.length === 0
                ? 'No demo routes with assigned vehicles are available to simulate.'
                : 'SIMULATED — NOT GPS. Uses demo-tagged saved route geometry only; no telemetry is read or stored.'}
            </small>
          </div>
        )}

        {displayErrors.length > 0 && (
          <div className="live-gis-errors" role="alert">
            {displayErrors.map((message, index) => (
              <p key={`${index}-${message}`}>
                {message}
              </p>
            ))}

            <button
              type="button"
              className="button-secondary"
              onClick={() => void loadLayers()}
            >
              Retry map layers
            </button>
          </div>
        )}

        {loadingLayers &&
        mapLocations.length === 0 &&
        !loading ? (
          <div
            className="live-gis-state"
            aria-live="polite"
          >
            Loading map layers…
          </div>
        ) : (
          <>
            <div className="live-gis-map-frame">
              <MapContainer
                center={BENGALURU_CENTER}
                zoom={11}
                scrollWheelZoom
                className="leaflet-map"
              >
                <MapAutoFit positions={positions} />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {layers.collectionPoints &&
                  points.map((point) => (
                    <CircleMarker
                      key={`collection-point-${point.id}`}
                      center={[
                        point.latitude,
                        point.longitude,
                      ]}
                      radius={9}
                      pathOptions={{
                        color: '#c9ff4a',
                        fillColor: '#c9ff4a',
                        fillOpacity: 0.9,
                      }}
                    >
                      <Popup>
                        <strong>
                          Collection point · {point.name}
                        </strong>
                        <br />
                        {point.description}
                        {demoTag(point.is_demo)}
                      </Popup>
                    </CircleMarker>
                  ))}

                {layers.reportingOffices &&
                  offices.map((office) => (
                    <CircleMarker
                      key={`reporting-office-${office.id}`}
                      center={[
                        office.latitude,
                        office.longitude,
                      ]}
                      radius={8}
                      pathOptions={{
                        color: '#4edce0',
                        fillColor: '#4edce0',
                        fillOpacity: 0.9,
                      }}
                    >
                      <Popup>
                        <strong>
                          Reporting office · {office.name}
                        </strong>
                        <br />
                        {office.description}
                        {demoTag(office.is_demo)}
                      </Popup>
                    </CircleMarker>
                  ))}

                {layers.pickupRequests &&
                  mappedRequests.map((request) => (
                    <CircleMarker
                      key={`pickup-${request.id}`}
                      center={[
                        request.latitude,
                        request.longitude,
                      ]}
                      radius={7}
                      pathOptions={{
                        color: '#f5ad56',
                        fillColor: '#f5ad56',
                        fillOpacity: 0.88,
                      }}
                    >
                      <Popup>
                        <strong>
                          Pickup request #{request.id}
                        </strong>
                        <br />
                        {request.location}
                        <br />
                        {request.category} · {request.status}
                        {demoTag(request.is_demo)}
                      </Popup>
                    </CircleMarker>
                  ))}

                {layers.collections &&
                  mappedCollections.map((collection) => (
                    <CircleMarker
                      key={`collection-${collection.id}`}
                      center={[
                        collection.latitude,
                        collection.longitude,
                      ]}
                      radius={7}
                      pathOptions={{
                        color: '#a4a6ff',
                        fillColor: '#a4a6ff',
                        fillOpacity: 0.88,
                      }}
                    >
                      <Popup>
                        <strong>
                          Collection #{collection.id}
                        </strong>
                        <br />
                        {collection.location}
                        <br />
                        {collection.status}
                        <br />
                        Collector:{' '}
                        {collection.collector_id
                          ? userNames.get(
                              collection.collector_id,
                            ) ??
                            `User #${collection.collector_id}`
                          : 'Unassigned'}
                        <br />
                        Vehicle:{' '}
                        {collection.vehicle_id
                          ? vehicleNames.get(
                              collection.vehicle_id,
                            ) ??
                            `Vehicle #${collection.vehicle_id}`
                          : 'Unassigned'}
                        {demoTag(collection.is_demo)}
                      </Popup>
                    </CircleMarker>
                  ))}

                {layers.hotspots &&
                  mappedHotspots.map((hotspot, index) => (
                    <CircleMarker
                      key={`hotspot-${index}`}
                      center={[
                        hotspot.latitude,
                        hotspot.longitude,
                      ]}
                      radius={Math.min(
                        17,
                        7 + hotspot.report_count,
                      )}
                      pathOptions={{
                        color:
                          hotspot.recurrence === 'REPEAT'
                            ? '#ff7b76'
                            : '#f5ad56',
                        fillColor:
                          hotspot.recurrence === 'REPEAT'
                            ? '#ff7b76'
                            : '#f5ad56',
                        fillOpacity: 0.72,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <strong>
                          {hotspot.recurrence === 'REPEAT'
                            ? 'Recurring'
                            : 'New'}{' '}
                          CleanCity hotspot
                        </strong>
                        <br />
                        {hotspot.report_count} verified reports ·{' '}
                        {hotspot.demo_report_count} demo
                        <br />
                        Last reported{' '}
                        {new Date(
                          hotspot.last_reported_at,
                        ).toLocaleString()}
                      </Popup>
                    </CircleMarker>
                  ))}

                {layers.routes &&
                  savedRoutes.map((route) => {
                    const geometry =
                      route.route_geometry.filter(
                        (
                          position,
                        ): position is [number, number] =>
                          position.length >= 2 &&
                          validCoordinate(
                            position[0],
                            position[1],
                          ),
                      )

                    return (
                      <Fragment key={`route-${route.id}`}>
                        {geometry.length > 1 && (
                          <Polyline
                            positions={geometry}
                            pathOptions={{
                              color: '#c9ff4a',
                              weight: 4,
                              opacity: 0.82,
                            }}
                          />
                        )}

                        {validCoordinate(
                          route.depot_latitude,
                          route.depot_longitude,
                        ) && (
                          <CircleMarker
                            center={[
                              route.depot_latitude,
                              route.depot_longitude,
                            ]}
                            radius={6}
                            pathOptions={{
                              color: '#ffffff',
                              fillColor: '#303a34',
                              fillOpacity: 1,
                            }}
                          >
                            <Popup>
                              <strong>
                                Saved route #{route.id} · Depot
                              </strong>
                              <br />
                              Vehicle:{' '}
                              {route.vehicle_id
                                ? vehicleNames.get(
                                    route.vehicle_id,
                                  ) ??
                                  `Vehicle #${route.vehicle_id}`
                                : 'Unassigned'}
                              <br />
                              Collector:{' '}
                              {route.collector_id
                                ? userNames.get(
                                    route.collector_id,
                                  ) ??
                                  `User #${route.collector_id}`
                                : 'Unassigned'}
                              <br />
                              {route.geometry_distance_km.toFixed(
                                2,
                              )}{' '}
                              km ·{' '}
                              {route.geometry_duration_min.toFixed(
                                0,
                              )}{' '}
                              min
                              {demoTag(route.is_demo)}
                            </Popup>
                          </CircleMarker>
                        )}

                        {route.ordered_stops.map(
                          (stop, index) => (
                            <CircleMarker
                              key={`route-${route.id}-stop-${stop.id}`}
                              center={[
                                stop.latitude,
                                stop.longitude,
                              ]}
                              radius={5}
                              pathOptions={{
                                color: '#c9ff4a',
                                fillColor: '#c9ff4a',
                                fillOpacity: 1,
                              }}
                            >
                              <Popup>
                                <strong>
                                  Route #{route.id} · Stop{' '}
                                  {index + 1}
                                </strong>
                                <br />
                                {stop.name}
                                {demoTag(route.is_demo)}
                              </Popup>
                            </CircleMarker>
                          ),
                        )}
                      </Fragment>
                    )
                  })}

                {layers.vehicles &&
                  simulatedVehiclePositions.map(
                    ({ route, position }) => (
                      <CircleMarker
                        key={`simulated-vehicle-${route.id}`}
                        center={position}
                        radius={10}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor: '#f05fe7',
                          fillOpacity: 1,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <strong>
                            SIMULATED POSITION · NOT GPS
                          </strong>
                          <br />
                          Vehicle:{' '}
                          {route.vehicle_id
                            ? vehicleNames.get(
                                route.vehicle_id,
                              ) ??
                              `Vehicle #${route.vehicle_id}`
                            : 'Unassigned'}
                          <br />
                          Collector:{' '}
                          {route.collector_id
                            ? userNames.get(
                                route.collector_id,
                              ) ??
                              `User #${route.collector_id}`
                            : 'Unassigned'}
                          <br />
                          Route #{route.id} ·{' '}
                          {Math.round(
                            simulationProgress * 1000,
                          ) / 10}
                          % complete
                          <br />
                          Simulated at{' '}
                          {new Date(
                            simulationNow,
                          ).toLocaleString()}
                        </Popup>
                      </CircleMarker>
                    ),
                  )}
              </MapContainer>
            </div>

            <div className="live-gis-legend">
              <span>
                <i className="live-gis-key collection-point-key" />{' '}
                Collection points · {points.length}
              </span>

              {user.role !== 'COLLECTOR' && (
                <span>
                  <i className="live-gis-key pickup-key" />{' '}
                  Pickup requests · {mappedRequests.length}
                </span>
              )}

              <span>
                <i className="live-gis-key collection-key" />{' '}
                Collections · {mappedCollections.length}
              </span>

              <span>
                <i className="live-gis-key office-key" />{' '}
                Reporting offices · {offices.length}
              </span>

              <span>
                <i className="live-gis-key hotspot-key" />{' '}
                Hotspots · {mappedHotspots.length}
              </span>

              <span>
                <i className="live-gis-key route-key" />{' '}
                Saved routes · {savedRoutes.length}
              </span>

              {(user.role === 'ADMIN' ||
                user.role === 'COLLECTOR') && (
                <span>
                  <i className="live-gis-key vehicle-key" />
                  Vehicles · {vehicles.length} · GPS unavailable
                </span>
              )}

              {simulationEnabled && (
                <span>
                  <i className="live-gis-key simulated-vehicle-key" />{' '}
                  Simulated vehicle ·{' '}
                  {simulatedVehiclePositions.length}
                </span>
              )}
            </div>

            <p className="live-gis-attribution">
              Demo locations are marked in their popups. Map tiles
              and landmark lookup use OpenStreetMap data. No real
              vehicle telemetry is available.
            </p>

            {user.role === 'COLLECTOR' && (
              <section
                className="collector-assigned-vehicles"
                aria-label="Assigned vehicles"
              >
                <h3>Assigned vehicle</h3>

                {vehicles.length === 0 ? (
                  <div className="live-gis-state">
                    No vehicle is assigned to your account.
                  </div>
                ) : (
                  vehicles.map((vehicle) => (
                    <article
                      className="panel collector-vehicle-summary"
                      key={vehicle.id}
                    >
                      <strong>{vehicle.vehicle_number}</strong>
                      <span>
                        {vehicle.vehicle_type} · {vehicle.status} ·{' '}
                        {vehicle.capacity_kg} kg
                      </span>
                    </article>
                  ))
                )}
              </section>
            )}

            {user.role === 'COLLECTOR' &&
              showCollectorRouteSummaries && (
                <section
                  className="collector-route-summaries"
                  aria-label="Assigned saved routes"
                >
                  {savedRoutes.length === 0 ? (
                    <div className="live-gis-state">
                      No saved route is assigned to your account yet.
                    </div>
                  ) : (
                    savedRoutes.map((route) => {
                      const routeCollections =
                        displayedCollections.filter(
                          (collection) =>
                            route.collection_ids.includes(
                              collection.id,
                            ),
                        )

                      const completedCount =
                        routeCollections.filter(
                          (collection) =>
                            collection.status === 'COMPLETED',
                        ).length

                      const vehicle = vehicles.find(
                        (item) =>
                          item.id === route.vehicle_id,
                      )

                      return (
                        <article
                          className="panel collector-route-summary"
                          key={route.id}
                        >
                          <div className="admin-record-heading">
                            <div>
                              <span className="section-kicker">
                                ASSIGNED SAVED ROUTE
                              </span>
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
                                  ? `${vehicle.vehicle_number} · ${vehicle.vehicle_type} · ${vehicle.status}`
                                  : route.vehicle_id
                                    ? vehicleNames.get(
                                        route.vehicle_id,
                                      ) ??
                                      `Vehicle #${route.vehicle_id}`
                                    : 'No vehicle assigned'}
                              </strong>
                            </div>

                            <div>
                              <span>Collection progress</span>
                              <strong>
                                {completedCount} of{' '}
                                {route.collection_ids.length}{' '}
                                completed
                              </strong>
                            </div>

                            <div>
                              <span>
                                Distance / estimated time
                              </span>
                              <strong>
                                {route.geometry_distance_km.toFixed(
                                  2,
                                )}{' '}
                                km ·{' '}
                                {route.geometry_duration_min.toFixed(
                                  0,
                                )}{' '}
                                min
                              </strong>
                            </div>
                          </div>

                          <ol className="admin-ordered-stops">
                            {route.ordered_stops.map(
                              (stop, index) => (
                                <li
                                  key={`${route.id}-${stop.id}`}
                                >
                                  Stop {index + 1}: {stop.name}
                                </li>
                              ),
                            )}
                          </ol>
                        </article>
                      )
                    })
                  )}
                </section>
              )}

            {positions.length === 0 && !loadingLayers && (
              <div className="live-gis-state">
                No records with valid coordinates are available
                in the selected layers.
              </div>
            )}
          </>
        )}
      </article>
    </section>
  )
}
