import { apiBlob, apiRequest } from './api'
import type { CollectionRecord } from './collections'

export const MAX_PICKUP_PHOTO_BYTES = 5 * 1024 * 1024

export type PickupRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type PickupCategory =
  | 'GENERAL'
  | 'RECYCLABLE'
  | 'ORGANIC'
  | 'HAZARDOUS'
  | 'E_WASTE'
  | 'OTHER'

export type PickupRequest = {
  id: number
  citizen_id: number | null
  category: PickupCategory | string
  description: string | null
  location: string
  latitude: number
  longitude: number
  status: PickupRequestStatus | string
  admin_note: string | null
  is_demo: boolean
  evidence_url: string | null
  created_at: string
  updated_at: string
}

export type PickupRequestCreate = {
  category: PickupCategory
  description: string | null
  location: string
  latitude: number
  longitude: number
}

export type PickupRequestReview = {
  status: 'APPROVED' | 'REJECTED'
  admin_note: string | null
}

export function listPickupRequests() {
  return apiRequest<PickupRequest[]>('/api/pickup-requests/')
}

export function getPickupRequest(requestId: number) {
  return apiRequest<PickupRequest>(`/api/pickup-requests/${requestId}`)
}

export function createPickupRequest(request: PickupRequestCreate) {
  return apiRequest<PickupRequest>('/api/pickup-requests/', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function uploadPickupEvidence(requestId: number, file: File) {
  const body = new FormData()
  body.append('file', file)
  return apiRequest<PickupRequest>(
    `/api/pickup-requests/${requestId}/photo`,
    { method: 'POST', body },
  )
}

export function getPickupEvidence(requestId: number) {
  return apiBlob(`/api/pickup-requests/${requestId}/photo`)
}

export function reviewPickupRequest(
  requestId: number,
  review: PickupRequestReview,
) {
  return apiRequest<PickupRequest>(
    `/api/pickup-requests/${requestId}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify(review),
    },
  )
}

export type PickupRequestAssignment = {
  vehicle_id: number
  scheduled_date: string
  notes: string | null
}

export function assignPickupRequest(
  requestId: number,
  assignment: PickupRequestAssignment,
) {
  return apiRequest<CollectionRecord>(
    `/api/pickup-requests/${requestId}/assign`,
    {
      method: 'POST',
      body: JSON.stringify(assignment),
    },
  )
}