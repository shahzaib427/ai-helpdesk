import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import AppLayout from '../layouts/AppLayout'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { getDashboardStats, getRecentActivity, getLeads } from '../services/api'

function responsePreview(log) {
  if (!log.response_data) return '—'
  try {
    const parsed = JSON.parse(log.response_data)
    if (typeof parsed === 'string') return parsed
    if (typeof parsed.output === 'string') return parsed.output
    if (typeof parsed.error === 'string') return parsed.error
    return JSON.stringify(parsed)
  } catch {
    return log.response_data
  }
}

export default function DashboardPage() {
  const { user } = useAuth()

  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentLeads, setRecentLeads] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([
      getDashboardStats(),
      getRecentActivity(5),
      getLeads({ page: 1, limit: 5 }),
    ])
      .then(([statsData, activityData, leadsData]) => {
        setStats(statsData)
        setRecentActivity(activityData.items)
        setRecentLeads(leadsData.items)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load dashboard data.'))
      .finally(() => setIsLoading(false))
  }, [])

  const successRate =
    stats && stats.successful_automations + stats.failed_automations > 0
      ? Math.round(
          (stats.successful_automations /
            (stats.successful_automations + stats.failed_automations)) *
            100
        )
      : null

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Welcome back, {user?.name}</h1>
        <p className="text-sm text-slate-500">Here&apos;s what&apos;s happening across your account.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <Loader label="Loading dashboard..." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard icon={Users} label="Total Leads" value={stats.total_leads} tone="brand" />
            <StatCard icon={UserPlus} label="New Leads" value={stats.new_leads} tone="slate" />
            <StatCard icon={Mail} label="Emails Sent" value={stats.emails_sent} tone="amber" />
            <StatCard
              icon={CheckCircle2}
              label="Successful Automations"
              value={stats.successful_automations}
              tone="emerald"
            />
            <StatCard
              icon={XCircle}
              label="Failed Automations"
              value={stats.failed_automations}
              tone="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Leads */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden lg:col-span-1">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Recent Leads</h2>
                <Link to="/leads" className="text-xs text-brand-600 font-medium hover:underline">
                  View all
                </Link>
              </div>
              {recentLeads.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No leads yet"
                  description="Leads you create will show up here."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentLeads.map((lead) => (
                    <li key={lead.id} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {lead.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{lead.email}</p>
                        </div>
                        <Badge status={lead.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent Automation Activity */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Recent Automation Activity</h2>
                <Link to="/history" className="text-xs text-brand-600 font-medium hover:underline">
                  View all
                </Link>
              </div>
              {recentActivity.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No automation runs yet"
                  description="Run an automation and it will show up here."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentActivity.map((log) => (
                    <li key={log.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-900 truncate">
                            {responsePreview(log)}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge status={log.status}>{log.status.toUpperCase()}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Automation Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Automation Status</h2>
            {successRate === null ? (
              <p className="text-sm text-slate-400">No automation runs yet.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">
                    {stats.successful_automations} successful / {stats.failed_automations} failed
                  </span>
                  <span className="font-medium text-slate-900">{successRate}% success rate</span>
                </div>
                <div className="w-full h-2 rounded-full bg-red-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AppLayout>
  )
}
