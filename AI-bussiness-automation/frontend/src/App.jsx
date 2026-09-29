import { useEffect, useState } from 'react'
import { Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const API_BASE_URL = 'http://localhost:8000'

function App() {
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'error'
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let isMounted = true

    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!isMounted) return
        setStatus('ok')
        setDetail(data)
      })
      .catch((err) => {
        if (!isMounted) return
        setStatus('error')
        setDetail({ message: err.message })
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              AI Business Automation
            </h1>
            <p className="text-sm text-slate-500">Phase 1 — Project Setup</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 bg-slate-50">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Backend connectivity check (GET /api/health)
          </p>

          {status === 'loading' && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking backend...
            </div>
          )}

          {status === 'ok' && (
            <div className="flex items-start gap-2 text-emerald-700 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Backend is reachable.</p>
                <pre className="mt-2 text-xs bg-white border border-emerald-200 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 text-red-700 text-sm">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Could not reach the backend.</p>
                <p className="text-xs text-red-600 mt-1">{detail?.message}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Make sure the FastAPI server is running at{' '}
                  <code className="bg-white px-1 py-0.5 rounded border border-slate-200">
                    {API_BASE_URL}
                  </code>
                  .
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          This page will be replaced by the full login / dashboard flow in later phases.
        </p>
      </div>
    </div>
  )
}

export default App
