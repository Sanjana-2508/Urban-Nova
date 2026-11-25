import { apiBlob, apiRequest } from './api'

export type CleanCityReportStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ASSIGNED'
  | 'RESOLVED'
  | 'DUPLICATE'

export type CleanCityReportCategory =
  | 'OVERFLOWING_BIN'
  | 'ILLEGAL_DUMPING'
  | 'LITTER'
  | 'OTHER'

export type CleanCityReport = {
  id: number
  category: CleanCityReportCategory
  description: string
  latitude: number
  longitude: number
  status: CleanCityReportStatus
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | null
  is_demo: boolean
  submitted_at: string
  evidence_url: string | null
  status_updates: CleanCityStatusUpdate[]
  reporter_id?: number
  internal_notes?: string[]
  cleanup_actions?: CleanupAction[]
}

export type CleanCityStatusUpdate = {
  status: string
  at: string
  reason: string | null
  resolution_note: string | null
}

export type CleanCityHotspot = {
  latitude: number
  longitude: number
  report_count: number
  demo_report_count: number
  last_reported_at: string
  recurrence: 'NEW' | 'REPEAT'
}

export type CleanCityHotspots = {
  method: string
  period_start: string
  period_end: string
  items: CleanCityHotspot[]
}

export type CleanCityAwareness = {
  id: number
  title: string
  category: string
  body: string
}

export type CleanCityReviewDecision =
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DUPLICATE'

export type CleanupAction = {
  id: number
  report_id: number
  assigned_to: number | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'ASSIGNED' | 'RESOLVED'
  due_at: string
  resolved_at: string | null
  resolution_note: string | null
}

export function submitCleanCityReport(report: {
  category: CleanCityReportCategory
  description: string
  latitude: number
  longitude: number
}) {
  return apiRequest<CleanCityReport>('/api/cleancity/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  })
}

export function listCleanCityReports(status?: CleanCityReportStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<CleanCityReport[]>(`/api/cleancity/reports${query}`)
}

export function getCleanCityReport(reportId: number) {
  return apiRequest<CleanCityReport>(`/api/cleancity/reports/${reportId}`)
}

export function reviewCleanCityReport(
  reportId: number,
  review: {
    decision: CleanCityReviewDecision
    reason?: string | null
    internal_note?: string | null
    duplicate_of?: number | null
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | null
  },
) {
  return apiRequest<CleanCityReport>(`/api/cleancity/reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify(review),
  })
}

export function uploadCleanCityEvidence(reportId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<CleanCityReport>(`/api/cleancity/reports/${reportId}/photo`, {
    method: 'POST',
    body: form,
  })
}

export function getCleanCityEvidence(reportId: number) {
  return apiBlob(`/api/cleancity/reports/${reportId}/photo`)
}

export function assignCleanCityCleanup(
  reportId: number,
  assignment: {
    assigned_to: number
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    due_at: string
  },
) {
  return apiRequest<CleanupAction>(`/api/cleancity/reports/${reportId}/cleanup-actions`, {
    method: 'POST',
    body: JSON.stringify(assignment),
  })
}

export function resolveCleanCityCleanup(actionId: number, resolutionNote: string) {
  return apiRequest<CleanupAction>(`/api/cleancity/cleanup-actions/${actionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'RESOLVED',
      resolution_note: resolutionNote.trim() || null,
    }),
  })
}

export function getCleanCityHotspots(
  windowDays = 30,
  minReports = 3,
  cellSizeDeg = 0.005,
) {
  const params = new URLSearchParams({
    window_days: String(windowDays),
    min_reports: String(minReports),
    cell_size_deg: String(cellSizeDeg),
  })
  return apiRequest<CleanCityHotspots>(`/api/cleancity/hotspots?${params}`)
}

export function listCleanCityAwareness() {
  return apiRequest<CleanCityAwareness[]>('/api/cleancity/awareness')
}
