import { useRef } from 'react'
import kmrlLogo from '../assets/KMRL-logo-300x165.png'
import refreshIcon from '../assets/refresh.png'
import cameraIcon from '../assets/camera.png'

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
        <div className="flex items-center gap-3">
          <img src={kmrlLogo} alt="KMRL Logo" className="h-8 w-auto object-contain -ml-1 mr-2" />
          <h1 className="text-[17px] font-semibold tracking-wide text-steel-800 whitespace-nowrap">Kochi Metro Rail Limited</h1>
          {/* <span className="ml-1 px-2 py-0.5 rounded-md bg-aqua-100 text-aqua-700 text-[10px] font-semibold">AI-ASSIST</span> */}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <button onClick={onRefresh} disabled={refreshing} className="btn-secondary flex items-center gap-1" title="Refresh data">
            <img src={refreshIcon} alt="Refresh" className="w-4 h-4 object-contain" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={handlePick} disabled={scanning} className="btn-green flex items-center gap-2">
            <img src={cameraIcon} alt="Scan" className="w-5 h-5 object-contain" />
            {scanning ? 'Scanning…' : 'Scan Photo'}
          </button>
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFile} />
          <button onClick={onRun} disabled={running} className="btn">{running ? 'Creating…' : 'Create Schedule'}</button>
        </div>
      </div>
    </header>
  )
}
