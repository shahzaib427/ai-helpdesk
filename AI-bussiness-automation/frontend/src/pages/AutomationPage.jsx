import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import AppLayout from '../layouts/AppLayout'
import { runAutomation } from '../services/api'

const EMPTY_FORM = { name: '', email: '', company: '', message: '' }

/**
 * The n8n AI Agent may return { "output": "..." }, a different JSON shape,
 * or plain text. Render whatever actually comes back rather than assuming
 * a fixed structure.
 */
function N8nResponseView({ response }) {
  if (response == null) return null

  if (typeof response === 'string') {
    return <p className="text-sm text-slate-800 whitespace-pre-wrap">{response}</p>
  }

  if (typeof response === 'object' && typeof response.output === 'string') {
    return <p className="text-sm text-slate-800 whitespace-pre-wrap">{response.output}</p>
  }

  return (
    <pre className="text-xs bg-white border border-emerald-200 rounded-lg p-3 overflow-x-auto text-slate-700">
      {JSON.stringify(response, null, 2)}
    </pre>
  )
}

export default function AutomationPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState(null) // { automation_id, status, n8n_response }
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }

    setIsRunning(true)
    try {
      const data = await runAutomation(form)
      setResult(data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Automation failed. The n8n workflow may be unreachable.'
      )
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Run AI Automation</h1>
        <p className="text-sm text-slate-500">
          Sends this data to your n8n workflow (Groq AI Agent + Gmail + PostgreSQL tools).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Ali Khan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="ali@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="ABC Software"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Please send me a confirmation email."
              />
            </div>

            <button
              type="submit"
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isRunning ? 'Running AI automation...' : 'Run Automation'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Result</h2>

          {isRunning && (
            <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              <p className="text-sm">Running AI automation...</p>
              <p className="text-xs text-slate-400 mt-1">
                Waiting for n8n / the AI Agent to respond.
              </p>
            </div>
          )}

          {!isRunning && error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isRunning && result && (
            <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-xs text-emerald-600">
                  Automation #{result.automation_id} — status: {result.status}
                </p>
                <N8nResponseView response={result.n8n_response} />
              </div>
            </div>
          )}

          {!isRunning && !error && !result && (
            <p className="text-sm text-slate-400 py-10 text-center">
              Run an automation to see the AI Agent&apos;s response here.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
