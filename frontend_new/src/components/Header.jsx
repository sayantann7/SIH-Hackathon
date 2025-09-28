import { useRef } from 'react'

export default function Header({ onRun, onRefresh, running, refreshing, onScan, scanning }) {
  const fileRef = useRef(null)

  function handlePick() {
    if (fileRef.current) fileRef.current.click()
  }
  function handleFile(e) {
    const f = e.target.files?.[0]
    if (f) {
      onScan && onScan(f)
      e.target.value = '' // reset so same file can be chosen again
    }
  }
  return (
    <header className="w-full border-b border-steel-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-aqua-500 flex items-center justify-center text-white font-bold">K</div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-steel-800">Metro Scheduler</h1>
            <p className="text-[11px] text-steel-500">Kochi Metro • Operator Console</p>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-aqua-100 text-aqua-700 text-[10px] font-semibold">AI-ASSIST</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <button onClick={onRefresh} disabled={refreshing} className="btn-secondary" title="Refresh data">
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={handlePick} disabled={scanning} className="btn-secondary">{scanning ? 'Scanning…' : 'Scan Photo'}</button>
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFile} />
          <button onClick={onRun} disabled={running} className="btn">{running ? 'Creating…' : 'Create Schedule'}</button>
        </div>
      </div>
    </header>
  )
}
