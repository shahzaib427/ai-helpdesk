import { useCallback, useEffect, useState } from 'react'
import { History as HistoryIcon, AlertCircle } from 'lucide-react'
import AppLayout from '../layouts/AppLayout'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { getAutomationHistory } from '../services/api'

const STATUS_OPTIONS = ['success', 'failed', 'pending']

/** request_data / response_data are stored as JSON strings — parse defensively. */
function parseJsonSafe(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function responsePreview(log) {
  const parsed = parseJsonSafe(log.response_data)
  if (parsed == null) return '—'
  if (typeof parsed === 'string') return parsed
  if (typeof parsed.output === 'string') return parsed.output
  if (typeof parsed.error === 'string') return parsed.error
  return JSON.stringify(parsed)
}

export default function HistoryPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [statusFilter, setStatusFilter] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAutomationHistory({ page, limit, status: statusFilter })
      setLogs(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load automation history.')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, statusFilter])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Automation History</h1>
        <p className="text-sm text-slate-500">Every automation run, with its real n8n result.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-200">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border-b border-red-200 px-4 py-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <Loader label="Loading history..." />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No automation runs yet"
            description="Run an automation from the Automation tab and it will show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-900 capitalize">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600">{log.lead_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge status={log.status}>{log.status.toUpperCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {responsePreview(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <div className="px-4">
            <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={`Automation #${selectedLog?.id}`}
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge status={selectedLog.status}>{selectedLog.status.toUpperCase()}</Badge>
              <span className="text-slate-500">
                {new Date(selectedLog.created_at).toLocaleString()}
              </span>
            </div>

            {selectedLog.lead_name && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Lead</p>
                <p className="text-slate-900">{selectedLog.lead_name}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Request</p>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(parseJsonSafe(selectedLog.request_data), null, 2)}
              </pre>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Response</p>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(parseJsonSafe(selectedLog.response_data), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
