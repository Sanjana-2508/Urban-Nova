import { apiRequest } from './api'

export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE'

export type VehicleRecord = {
  id: number
  vehicle_number: string
  vehicle_type: string
  capacity_kg: number
  status: VehicleStatus
  assigned_collector_id: number | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export type VehicleCreate = {
  vehicle_number: string
  vehicle_type: string
  capacity_kg: number
}

export function listVehicles() {
  return apiRequest<VehicleRecord[]>('/api/vehicles/')
}

export function createVehicle(vehicle: VehicleCreate) {
  return apiRequest<VehicleRecord>('/api/vehicles/', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  })
}

export function assignVehicle(vehicleId: number, collectorId: number) {
  return apiRequest<VehicleRecord>(`/api/vehicles/${vehicleId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ collector_id: collectorId }),
  })
}

export function updateVehicleStatus(vehicleId: number, status: VehicleStatus) {
  return apiRequest<VehicleRecord>(`/api/vehicles/${vehicleId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
