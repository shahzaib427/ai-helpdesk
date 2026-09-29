import axios from 'axios'

export const API_BASE_URL = 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
})

// Attach the JWT to every outgoing request, if we have one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Globally handle 401s: clear auth and send the user back to /login.
// (The API client can't use react-router's navigate(), so it does a hard redirect.)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ---- Auth ----

export async function registerUser({ name, email, password }) {
  const { data } = await api.post('/auth/register', { name, email, password })
  return data
}

export async function loginUser({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function getCurrentUser() {
  const { data } = await api.get('/auth/me')
  return data
}

// ---- Leads ----

export async function getLeads({ page = 1, limit = 10, search = '', status = '' } = {}) {
  const params = { page, limit }
  if (search) params.search = search
  if (status) params.status = status
  const { data } = await api.get('/leads', { params })
  return data
}

export async function getLead(leadId) {
  const { data } = await api.get(`/leads/${leadId}`)
  return data
}

export async function createLead(payload) {
  const { data } = await api.post('/leads', payload)
  return data
}

export async function updateLead(leadId, payload) {
  const { data } = await api.patch(`/leads/${leadId}`, payload)
  return data
}

export async function deleteLead(leadId) {
  await api.delete(`/leads/${leadId}`)
}

// ---- Automation ----

export async function runAutomation({ name, email, company, message }) {
  const { data } = await api.post('/automation/send', { name, email, company, message })
  return data
}

export async function getAutomationHistory({ page = 1, limit = 10, status = '' } = {}) {
  const params = { page, limit }
  if (status) params.status = status
  const { data } = await api.get('/automation/history', { params })
  return data
}

export async function getAutomationLog(automationId) {
  const { data } = await api.get(`/automation/${automationId}`)
  return data
}

// ---- Dashboard ----

export async function getDashboardStats() {
  const { data } = await api.get('/dashboard/stats')
  return data
}

export async function getRecentActivity(limit = 5) {
  const { data } = await api.get('/dashboard/recent-activity', { params: { limit } })
  return data
}
