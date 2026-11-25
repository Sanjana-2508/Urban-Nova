import { apiRequest } from './api'
import type { UserRole } from './auth'

export type AdminDashboardStats = {
  users: {
    total_users: number
    total_citizens: number
    total_collectors: number
    total_admins: number
  }
  complaints: {
    total_complaints: number
    submitted: number
    assigned: number
    in_progress: number
    resolved: number
  }
  collections: {
    total_collections: number
    scheduled: number
    assigned: number
    in_progress: number
    completed: number
    cancelled: number
  }
}

export type AdminUser = {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export function getAdminDashboardStats() {
  return apiRequest<AdminDashboardStats>('/api/dashboard/stats')
}

export function listAdminUsers() {
  return apiRequest<AdminUser[]>('/api/admin/users/')
}

export function updateAdminUser(
  userId: number,
  update: Partial<Pick<AdminUser, 'role' | 'is_active'>>,
) {
  return apiRequest<AdminUser>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}
