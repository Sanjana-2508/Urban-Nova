
import { apiRequest } from './api'

export interface Depot {
  id: number
  name: string
  latitude: number
  longitude: number
  updated_at: string
}

export interface DepotUpdate {
  name: string
  latitude: number
  longitude: number
}

export function getDepot() {
  return apiRequest<Depot>('/api/depot')
}

export function updateDepot(data: DepotUpdate) {
  return apiRequest<Depot>('/api/depot', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
