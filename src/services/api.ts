const API_BASE_URL = 'http://localhost:8000';

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getErrorMessage(data: unknown, status: number) {
  if (typeof data !== 'object' || data === null || !('detail' in data)) {
    return `Request failed with status ${status}`
  }

  const detail = data.detail
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('msg' in item)) {
        return []
      }

      const message = typeof item.msg === 'string' ? item.msg : ''
      const location =
        'loc' in item && Array.isArray(item.loc)
          ? item.loc.filter((part: unknown): part is string => typeof part === 'string')
          : []
      const field = location.filter((part) => part !== 'body').join('.')

      return [field ? `${field}: ${message}` : message].filter(Boolean)
    })

    if (messages.length > 0) return messages.join('\n')
  }

  return `Request failed with status ${status}`
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('urbannova-token');
  const headers = new Headers(options.headers)

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(data, response.status),
      response.status,
    )
  }

  return data as T;
}

export async function apiBlob(endpoint: string): Promise<Blob> {
  const token = sessionStorage.getItem('urbannova-token')
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    throw new ApiError(getErrorMessage(data, response.status), response.status)
  }

  return response.blob()
}