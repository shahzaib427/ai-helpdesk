import { Loader2 } from 'lucide-react'

export default function Loader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin mb-2" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
