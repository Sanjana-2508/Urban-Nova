import { apiRequest } from './api';

export type UserRole = 'CITIZEN' | 'COLLECTOR' | 'ADMIN'

export type AuthenticatedUser = {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

type LoginResponse = {
  access_token: string
  token_type: string
}

export async function login(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  const result = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  sessionStorage.setItem('urbannova-token', result.access_token);

  try {
    return await apiRequest<AuthenticatedUser>('/api/auth/me')
  } catch (error) {
    logout()
    throw error
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function logout() {
  sessionStorage.removeItem('urbannova-token');
  sessionStorage.removeItem('urbannova-role');
}