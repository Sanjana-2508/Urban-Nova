import { apiRequest } from './api'

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'

export type CitizenComplaint = {
  id: number
  citizen_id: number
  category: string
  description: string
  location: string
  latitude: number | null
  longitude: number | null
  status: ComplaintStatus
  created_at: string
  updated_at: string
}

export function listMyComplaints() {
  return apiRequest<CitizenComplaint[]>('/api/complaints/')
}

export function listAllComplaints() {
  return apiRequest<CitizenComplaint[]>('/api/complaints/admin/all')
}

export function updateComplaintStatus(
  complaintId: number,
  status: ComplaintStatus,
) {
  return apiRequest<CitizenComplaint>(
    `/api/complaints/${complaintId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
}
