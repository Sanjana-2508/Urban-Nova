import { apiRequest } from './api'

export type MapLocationType = 'COLLECTION_POINT' | 'REPORTING_OFFICE'

export type MapLocation = {
  id: number
  location_type: MapLocationType
  name: string
  description: string | null
  latitude: number
  longitude: number
  is_demo: boolean
  created_at: string
}

export function listMapLocations(locationType?: MapLocationType) {
  const query = locationType
    ? `?location_type=${encodeURIComponent(locationType)}`
    : ''
  return apiRequest<MapLocation[]>(`/api/map-locations/${query}`)
}
