import { apiRequest } from './api'

export type RouteStop = {
  id: string
  name: string
  latitude: number
  longitude: number
}

export type CalculatedRoute = {
  ordered_stops: RouteStop[]
  total_distance_km: number
  baseline_distance_km: number
  optimized_distance_km: number
  distance_saved_km: number
  distance_reduction_percent: number | null
  total_travel_time_min: number
  number_of_stops: number
  route_geometry: [number, number][]
  geometry_distance_km: number
  geometry_duration_min: number
  geometry_source: string
  source: string
  status: string
}

export type SavedRoute = CalculatedRoute & {
  id: number
  depot_latitude: number
  depot_longitude: number
  vehicle_id: number | null
  collector_id: number | null
  collection_ids: number[]
  is_demo: boolean
  created_at: string
}

export function optimizeRoute(
  depot: { latitude: number; longitude: number },
  stops: RouteStop[],
) {
  return apiRequest<CalculatedRoute>('/api/routes/optimize', {
    method: 'POST',
    body: JSON.stringify({
      depot_latitude: depot.latitude,
      depot_longitude: depot.longitude,
      stops,
    }),
  })
}

export function saveRoute(
  depot: { latitude: number; longitude: number },
  collectionIds: number[],
  vehicleId: number | null,
  collectorId: number | null,
) {
  return apiRequest<SavedRoute>('/api/routes/save', {
    method: 'POST',
    body: JSON.stringify({
      depot_latitude: depot.latitude,
      depot_longitude: depot.longitude,
      collection_ids: collectionIds,
      vehicle_id: vehicleId,
      collector_id: collectorId,
    }),
  })
}

export function listSavedRoutes() {
  return apiRequest<SavedRoute[]>('/api/routes/saved')
}

export function getSavedRoute(routeId: number) {
  return apiRequest<SavedRoute>(`/api/routes/saved/${routeId}`)
}
