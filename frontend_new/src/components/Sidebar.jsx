import ParameterControls from './ParameterControls'

export default function Sidebar({ open, onToggle, params, onParamsChange, onToast }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-steel-900/30 backdrop-blur-sm" onClick={()=>onToggle(false)} />
      <div className="relative w-full max-w-5xl rounded-xl border border-steel-100 bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 h-12 border-b border-steel-100 rounded-t-xl">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-steel-700">Scheduling Parameters</h2>
          <button onClick={()=>onToggle(false)} className="text-steel-500 hover:text-aqua-600 text-xs font-medium">Close</button>
        </div>
        <div className="relative">
          <ParameterControls params={params} onChange={onParamsChange} onToast={onToast} />
        </div>
      </div>
    </div>
  )
}