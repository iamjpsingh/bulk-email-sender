const BASE_URL = import.meta.env.VITE_API_URL || ''

async function request(method: string, endpoint: string, data?: any) {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {}
  }

  if (data && !(data instanceof FormData)) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(data)
  } else if (data instanceof FormData) {
    options.body = data
  }

  const url = `${BASE_URL}${endpoint}`

  try {
    const res = await fetch(url, options)
    
    if (!res.ok) {
      return { success: false, message: `HTTP Error: ${res.status}` }
    }
    
    const json = await res.json()
    return json
  } catch (err) {
    return { success: false, message: 'Network error' }
  }
}

export const api = {
  get: (endpoint: string) => request('GET', endpoint),
  post: (endpoint: string, data: any) => request('POST', endpoint, data),
  put: (endpoint: string, data: any) => request('PUT', endpoint, data),
  delete: (endpoint: string) => request('DELETE', endpoint),
  upload: (endpoint: string, formData: FormData) => request('POST', endpoint, formData)
}
