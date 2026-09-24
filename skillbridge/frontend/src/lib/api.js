function inferBase() {
  const configured = import.meta.env.VITE_API_URL
  if (configured) return configured.replace(/\/$/, '')
  // Default to a relative base: Vite's dev server proxies API paths to the
  // backend (see vite.config.js), so the browser only ever talks to the one
  // origin it's already on. This avoids cross-origin requests altogether -
  // notably GitHub Codespaces, where a JS fetch() between two different
  // forwarded-port subdomains doesn't reliably receive CORS headers even
  // when both ports are set to Public, unlike a same-origin proxied request.
  return ''
}

export const API_BASE = inferBase()

let token = localStorage.getItem('sb_token') || ''

export function setToken(value) {
  token = value || ''
  if (value) localStorage.setItem('sb_token', value)
  else localStorage.removeItem('sb_token')
}

export function getToken() {
  return token
}

async function request(path, { method = 'GET', body, isForm } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(`Cannot reach the API at ${API_BASE}. Start the backend, or set VITE_API_URL.`)
  }

  if (res.status === 204) return null
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const detail = data?.detail
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status}).`)
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, file, kind = 'resume') => {
    const form = new FormData()
    form.append('file', file)
    return request(`${p}?kind=${encodeURIComponent(kind)}`, { method: 'POST', body: form, isForm: true })
  },
}
