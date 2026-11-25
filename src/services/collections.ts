import { apiRequest } from './api'

export type CollectionStatus =
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type CollectionRecord = {
  id: number
  collector_id: number | null
  location: string
  waste_type: string
  scheduled_date: string
  status: CollectionStatus
  notes: string | null
  vehicle_id: number | null
  pickup_request_id: number | null
  latitude: number | null
  longitude: number | null
  is_demo: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type CollectionCreate = {
  location: string
  waste_type: string
  scheduled_date: string
  notes: string | null
  latitude?: number | null
  longitude?: number | null
  pickup_request_id?: number | null
}

export function listCollections() {
  return apiRequest<CollectionRecord[]>('/api/collections/')
}

export function createCollection(collection: CollectionCreate) {
  return apiRequest<CollectionRecord>('/api/collections/', {
    method: 'POST',
    body: JSON.stringify(collection),
  })
}

export function assignCollection(collectionId: number, collectorId: number) {
  return apiRequest<CollectionRecord>(
    `/api/collections/${collectionId}/assign`,
    {
      method: 'PATCH',
      body: JSON.stringify({ collector_id: collectorId }),
    },
  )
}

export function updateCollectionStatus(
  collectionId: number,
  status: 'IN_PROGRESS' | 'COMPLETED',
) {
  return apiRequest<CollectionRecord>(
    `/api/collections/${collectionId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
}
