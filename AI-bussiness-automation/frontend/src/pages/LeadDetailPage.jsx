import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Building2, MessageSquare, Calendar, AlertCircle } from 'lucide-react'
import AppLayout from '../layouts/AppLayout'
import Badge from '../components/Badge'
import Loader from '../components/Loader'
import { getLead, updateLead } from '../services/api'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'closed']

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [lead, setLead] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    getLead(id)
      .then(setLead)
      .catch((err) => setError(err.response?.data?.detail || 'Lead not found.'))
      .finally(() => setIsLoading(false))
  }, [id])

  async function handleStatusChange(newStatus) {
    setIsUpdatingStatus(true)
    try {
      const updated = await updateLead(id, { status: newStatus })
      setLead(updated)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <AppLayout>
      <Link
        to="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      {isLoading && <Loader label="Loading lead..." />}

      {!isLoading && error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button
            onClick={() => navigate('/leads')}
            className="ml-auto font-medium underline"
          >
            Back to leads
          </button>
        </div>
      )}

      {!isLoading && lead && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{lead.name}</h1>
              <p className="text-sm text-slate-500">Lead #{lead.id}</p>
            </div>
            <Badge status={lead.status} />
          </div>

          <dl className="space-y-4 text-sm mb-6">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <dd className="text-slate-900">{lead.email}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <dd className="text-slate-900">{lead.company || 'No company listed'}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              <dd className="text-slate-900">
                {new Date(lead.created_at).toLocaleString()}
              </dd>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-slate-400 mt-0.5" />
              <dd className="text-slate-900 whitespace-pre-wrap">
                {lead.message || 'No message.'}
              </dd>
            </div>
          </dl>

          <div className="border-t border-slate-200 pt-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Update status
            </label>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isUpdatingStatus}
              className="w-full sm:w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
