import { useEffect, useMemo, useState } from 'react'
import './index.css'
import Header from './components/Header'
import ParameterControls from './components/ParameterControls'
import Sidebar from './components/Sidebar'
import FiltersBar from './components/FiltersBar'
import TrainTable from './components/TrainTable'
import { fetchSnapshot, runSchedule, uploadImage } from './api/client'
import WelcomeSplash from './components/WelcomeSplash'
import InsightsView from './components/InsightsView'
// Tab icons
import trainIcon from './assets/train.png'
import scheduleIcon from './assets/schedule (1).png'
import diagramIcon from './assets/growth.png'
import alertIcon from './assets/alert.png'
import settingsIcon from './assets/settings.png'

// Fallback static trains list (Train, Model, Capacity) used if backend snapshot returns no trains
const STATIC_TRAINS = [
  ['T1','4-car',1200],['T2','3-car',900],['T3','4-car',1200],['T4','4-car',1200],['T5','4-car',1200],
  ['T6','4-car',1200],['T7','6-car',1800],['T8','3-car',900],['T9','4-car',1200],['T10','3-car',900],
  ['T11','4-car',1200],['T12','4-car',1200],['T13','3-car',900],['T14','3-car',900],['T15','4-car',1200],
  ['T16','4-car',1200],['T17','4-car',1200],['T18','4-car',1200],['T19','6-car',1800],['T20','3-car',900],
  ['T21','6-car',1800],['T22','4-car',1200],['T23','4-car',1200],['T24','3-car',900],['T25','6-car',1800],
  ['T26','4-car',1200],['T27','3-car',900],['T28','3-car',900],['T29','6-car',1800],['T30','4-car',1200],
  ['T31','6-car',1800],['T32','4-car',1200],['T33','4-car',1200],['T34','6-car',1800],['T35','4-car',1200],
  ['T36','4-car',1200],['T37','6-car',1800],['T38','4-car',1200],['T39','6-car',1800],['T40','4-car',1200]
].map(([id,model,capacity])=>({ train_id: id, model, capacity }))

function deriveTrains(dataFiles) {
  if (!dataFiles) return []
  const trainsRows = dataFiles['trains.csv'] || []
  const map = {}
  trainsRows.forEach(r => { if (r.train_id) map[r.train_id] = { train_id: r.train_id, model: r.model } })
  function merge(file, fn) {
    ;(dataFiles[file]||[]).forEach(r => {
      const id = r.train_id
      if (!id) return
      map[id] = map[id] || { train_id: id }
      fn(map[id], r)
    })
  }
  merge('fitness.csv', (t,r)=>{ t.fitness_score = r.score; t.fitness_valid = r.valid })
  merge('jobcard.csv', (t,r)=>{ t.jobcard_open = r.open })
  merge('cleaning.csv', (t,r)=>{ t.last_cleaned_days = r.last_cleaned_days })
  merge('branding.csv', (t,r)=>{ t.branding_priority = r.priority })
  merge('mileage.csv', (t,r)=>{ t.mileage_km = r.km })
  merge('stabling.csv', (t,r)=>{ t.stabling_site = r.site || r.depot || r.yard || r.location || r.stabling || r.bay })
  // derive capacity from model if not present (e.g., "4-car" => 4 * 300 = 1200)
  Object.values(map).forEach(t => {
    if (t.capacity == null) {
      if (t.model && /([0-9]+)\s*-?\s*car/i.test(t.model)) {
        const cars = parseInt(t.model.match(/([0-9]+)/)[1], 10)
        if (!isNaN(cars)) t.capacity = cars * 300 // rule of thumb
      }
    }
  })
  return Object.values(map)
}

export default function App() {
  const [dataFiles, setDataFiles] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [conflicts, setConflicts] = useState([])
  // What-if comparison state
  const [whatIfBase, setWhatIfBase] = useState({ cleaning_slots: 3, fail_train: '' })
  const [whatIfScenario, setWhatIfScenario] = useState({ cleaning_slots: 4, fail_train: '' })
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [whatIfBaselineSchedule, setWhatIfBaselineSchedule] = useState([])
  const [whatIfScenarioSchedule, setWhatIfScenarioSchedule] = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [params, setParams] = useState({
    cleaning_capacity: 3,
    min_run: 4,
    risk_w: 50,
    mileage_w: 1,
    branding_w: 20,
    fail_train: '',
    cleaning_due_threshold: 7,
    min_clean_due: 0
  })
  const [filters, setFilters] = useState({ run: true })
  // Sidebar (Show Controls) should start closed by default
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const trainsBase = useMemo(()=>deriveTrains(dataFiles), [dataFiles])
  const [activeTab, setActiveTab] = useState('trains') // trains | schedule | insights | issues | whatif
  const [issueFilters, setIssueFilters] = useState({ fitness: true, jobcard: true, cleaning: true })
  // Toast notifications (e.g., preset applied)
  const [toasts, setToasts] = useState([])

  function pushToast(message, opts={}) {
    const id = Math.random().toString(36).slice(2)
    const t = { id, message, type: opts.type||'info', ts: Date.now() }
    setToasts(list => [...list, t])
    // auto remove after 3.2s
    setTimeout(()=> setToasts(list => list.filter(x=>x.id!==id)), opts.ttl || 3200)
  }

  useEffect(()=>{ refresh() }, [])

  async function refresh() {
    setLoading(true)
    try { setDataFiles(await fetchSnapshot()) } catch(e){ console.error(e) } finally { setLoading(false) }
    // After fetch, if no trains present, inject static fallback so UI shows list
    setDataFiles(prev => {
      if (!prev) return { 'trains.csv': STATIC_TRAINS }
      const trainsCsv = prev['trains.csv'] || []
      if (trainsCsv.length === 0) return { ...prev, 'trains.csv': STATIC_TRAINS }
      return prev
    })
  }
  async function createSchedule() {
    setRunning(true)
    try {
      const res = await runSchedule(params)
      setSchedule(res.schedule || [])
      setConflicts(res.conflicts || [])
      // Navigate to schedule tab & toast success
      setActiveTab('schedule')
      pushToast('Schedule created.', { type: 'success' })
    } catch(e) { console.error(e) } finally { setRunning(false) }
  }
  async function scan(file) {
    setScanning(true)
    try {
      await uploadImage(file)
      await refresh()
    } catch(e) { console.error(e) } finally { setScanning(false) }
  }

  // merge schedule assignments onto trains list
  const trains = useMemo(()=>{
    if (!trainsBase.length) return []
    const assignMap = {}
    schedule.forEach(r=>{ assignMap[r.train_id] = r })
    return trainsBase.map(t=> ({ ...t, ...(assignMap[t.train_id]||{}) , cleaning_due: (t.last_cleaned_days==null || Number(t.last_cleaned_days)>=7) ? 1:0, has_cleaning_record: t.last_cleaned_days!=null }))
  }, [trainsBase, schedule])

  const filtered = useMemo(()=>{
    return trains.filter(t => {
      // status filters: if any status filter active, require assignment in an active one OR if no schedule yet allow pass through
      const statusKeys = ['run','standby','maintenance','cleaning']
      const activeStatuses = statusKeys.filter(k=>filters[k])
      if (activeStatuses.length && t.assigned && !activeStatuses.includes(t.assigned)) return false
      if (filters.cleaning_due && !t.cleaning_due) return false
      if (filters.jobcard_open && !t.jobcard_open) return false
      if (filters.branding_priority && !t.branding_priority) return false
      return true
    })
  }, [trains, filters])

  // classify and filter conflicts for Issues tab
  const conflictsFiltered = useMemo(()=>{
    function classify(reasons=[]) {
      const cats = new Set()
      reasons.forEach(r => {
        const txt = String(r).toLowerCase()
        if (txt.includes('fitness')) cats.add('fitness')
        if (txt.includes('open job card') || txt.includes('job card')) cats.add('jobcard')
        if (txt.includes('cleaning')) cats.add('cleaning')
      })
      return cats
    }
    return conflicts.filter(c => {
      const cats = classify(c.reasons||[])
      // include if any selected category appears; if no category detected treat as pass-through
      if (!cats.size) return true
      for (const cat of cats) if (issueFilters[cat]) return true
      return false
    })
  }, [conflicts, issueFilters])

  const conflictCounts = useMemo(()=>{
    const counts = { fitness:0, jobcard:0, cleaning:0 }
    conflicts.forEach(c => {
      (c.reasons||[]).forEach(r => {
        const txt = String(r).toLowerCase()
        if (txt.includes('fitness')) counts.fitness++
        if (txt.includes('open job card') || txt.includes('job card')) counts.jobcard++
        if (txt.includes('cleaning')) counts.cleaning++
      })
    })
    return counts
  }, [conflicts])

  function toggleIssueFilter(k){ setIssueFilters(f => ({ ...f, [k]: !f[k] })) }

  // What-if run
  async function runWhatIfComparison(){
    setWhatIfLoading(true)
    try {
      const baseParams = { ...params, cleaning_slots: parseInt(whatIfBase.cleaning_slots||0,10), fail_train: whatIfBase.fail_train?.trim() }
      const scenParams = { ...params, cleaning_slots: parseInt(whatIfScenario.cleaning_slots||0,10), fail_train: whatIfScenario.fail_train?.trim() }
      const [baseRes, scenRes] = await Promise.all([
        runSchedule(baseParams),
        runSchedule(scenParams)
      ])
      setWhatIfBaselineSchedule(baseRes.schedule||[])
      setWhatIfScenarioSchedule(scenRes.schedule||[])
      // Toast feedback
      setToasts(list => [
        ...list,
        { id: Date.now()+Math.random(), message: 'What-if comparison complete.', type: 'success' }
      ])
    } catch(e){ console.error('What-if comparison failed', e) }
    finally { setWhatIfLoading(false) }
  }

  function scheduleSummary(list){
    if(!list?.length) return '—'
    const counts = {}
    list.forEach(r => { counts[r.assigned] = (counts[r.assigned]||0)+1 })
    return Object.entries(counts).map(([k,v])=>`${k||'unknown'}: ${v}`).join('  ·  ')
  }

  const whatIfChanges = useMemo(()=>{
    if(!whatIfBaselineSchedule.length || !whatIfScenarioSchedule.length) return []
    const baseMap = new Map(whatIfBaselineSchedule.map(r => [r.train_id, r.assigned]))
    const scenMap = new Map(whatIfScenarioSchedule.map(r => [r.train_id, r.assigned]))
    const rows = []
    scenMap.forEach((assign, train) => {
      const b = baseMap.get(train)
      if (b !== assign) rows.push({ train_id: train, baseline: b, scenario: assign })
    })
    rows.sort((a,b)=> a.train_id.localeCompare(b.train_id))
    return rows
  }, [whatIfBaselineSchedule, whatIfScenarioSchedule])

  const tabs = [
    { id: 'trains', label: 'Trains', icon: trainIcon, alt: 'Trains' },
    { id: 'schedule', label: 'Schedule', icon: scheduleIcon, alt: 'Schedule' },
    { id: 'insights', label: 'Insights', icon: diagramIcon, alt: 'Insights' },
    { id: 'issues', label: 'Issues', icon: alertIcon, alt: 'Issues' },
  { id: 'whatif', label: 'What-if', icon: settingsIcon, alt: 'What-if' }
  ]

  return (
  <div className="flex flex-col h-screen relative overflow-hidden">
      <WelcomeSplash />
  <Sidebar open={sidebarOpen} onToggle={setSidebarOpen} params={params} onParamsChange={setParams} onToast={pushToast} />
  <div className="pl-0">
        <Header onRun={createSchedule} running={running} onRefresh={refresh} refreshing={loading} onScan={scan} scanning={scanning} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 overflow-hidden flex flex-col">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2 justify-center">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={()=>setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border transition-all text-[14px] font-semibold tracking-wide ${activeTab===t.id ? 'bg-aqua-50 border-aqua-400 text-aqua-700 shadow-md' : 'bg-white border-steel-200 text-steel-600 hover:border-aqua-300 hover:text-aqua-700 hover:shadow-sm'}`}
                >
                  <img src={t.icon} alt={t.alt} className="w-5 h-5 object-contain -mt-0.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'trains' && (
              <div className="space-y-2 flex flex-col flex-1 overflow-hidden">
                <h2 className="text-lg font-semibold text-steel-800">Trains</h2>
                <p className="text-[11px] text-steel-500">{trainsBase.length} trains loaded</p>
                {/* Helper to format IDs like T1 => T-1 for user expectation */}
                {/* (kept internal id untouched for logic) */}
                <div className="card p-0 overflow-auto h-[500px] scroll-thin pb-5"> {/* Increased bottom padding for clear end-of-list visibility */}
                  <table className="simple table-fixed w-full">
                    <thead>
                      <tr>
                        <th className="w-1/3">Train</th>
                        <th className="w-1/3">Model</th>
                        <th className="w-1/3">Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainsBase.map((r) => {
                        const displayId = /^T\d+$/.test(r.train_id) ? 'T-' + r.train_id.slice(1) : r.train_id
                        return (
                          <tr key={r.train_id} className="odd:bg-white even:bg-steel-50/40 last:mb-2">
                            <td className="font-medium text-steel-800 truncate">{displayId}</td>
                            <td className="truncate">{r.model || '—'}</td>
                            <td className="truncate">{r.capacity || '—'}</td>
                          </tr>
                        )
                      })}
                      {/* Spacer row to guarantee full visibility for final train row when scaled on hover */}
                      <tr aria-hidden="true">
                        <td colSpan={3} className="p-0 h-4"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {trainsBase.length > 15 && (
                  <p className="text-[10px] text-steel-500 italic">Scroll inside the list to view trains up to T-40.</p>
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="flex flex-col overflow-x-hidden">
                <FiltersBar filters={filters} onToggle={setFilters} onShowControls={()=>setSidebarOpen(true)} />
                <TrainTable trains={filtered} />
                {filtered.length===0 && <p className="mt-4 text-xs text-steel-500">No trains match current filters.</p>}
              </div>
            )}

            {activeTab === 'insights' && (
              <InsightsView ranked={schedule} />
            )}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-steel-800 mb-2">Show only</h3>
                  <div className="grid grid-cols-3 gap-y-2 text-[11px] text-steel-600 max-w-md">
                    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" className="accent-aqua-500" checked={issueFilters.fitness} onChange={()=>toggleIssueFilter('fitness')} />
                      Fitness <span className="text-[10px] text-steel-400">({conflictCounts.fitness})</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" className="accent-aqua-500" checked={issueFilters.jobcard} onChange={()=>toggleIssueFilter('jobcard')} />
                      Jobcard <span className="text-[10px] text-steel-400">({conflictCounts.jobcard})</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" className="accent-aqua-500" checked={issueFilters.cleaning} onChange={()=>toggleIssueFilter('cleaning')} />
                      Cleaning threshold <span className="text-[10px] text-steel-400">({conflictCounts.cleaning})</span>
                    </label>
                  </div>
                  <p className="mt-3 text-[11px] text-steel-500 font-medium">{conflictsFiltered.length} conflicts</p>
                </div>
                {!schedule.length && <p className="text-[12px] text-steel-500">Run a schedule to view conflicts.</p>}
                {!!schedule.length && (
                  <div className="card p-0 overflow-auto max-h-[65vh] scroll-thin pb-2">
                    <table className="simple table-fixed w-full">
                      <thead>
                        <tr>
                          <th className="w-20">Train</th>
                          <th className="w-28">Assigned</th>
                          <th>Reasons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflictsFiltered.map(c => (
                          <tr key={c.train_id} className="odd:bg-white even:bg-steel-50/40">
                            <td className="font-medium text-steel-800">{c.train_id}</td>
                            <td>
                              {c.assigned ? (
                                <span className={`chip ${c.assigned==='maintenance'?'chip-maintenance': c.assigned==='standby'?'chip-standby': c.assigned==='cleaning'?'chip-cleaning':'chip-run'}`}>{c.assigned}</span>
                              ) : '—'}
                            </td>
                            <td className="text-[12px] font-semibold leading-snug space-y-0.5">
                              {(c.reasons||[]).map((r,i)=>(<div key={i}>{r}</div>))}
                            </td>
                          </tr>
                        ))}
                        {conflictsFiltered.length===0 && (
                          <tr>
                            <td colSpan={3} className="text-center py-6 text-[11px] text-steel-500">No conflicts match current filters.</td>
                          </tr>
                        )}
                        {/* Spacer row to allow slight overscroll breathing room so last row isn't flush with viewport bottom */}
                        <tr aria-hidden="true">
                          <td colSpan={3} className="p-0 h-4"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'whatif' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h3 className="text-lg font-semibold text-steel-800 mb-4">Baseline</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-steel-600 mb-1">Cleaning capacity</label>
                        <input type="number" min={0} className="input" value={whatIfBase.cleaning_slots} onChange={e=>setWhatIfBase(s=>({...s, cleaning_slots: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-steel-600 mb-1">Simulate failure</label>
                        <input type="text" placeholder="e.g. T5" className="input" value={whatIfBase.fail_train} onChange={e=>setWhatIfBase(s=>({...s, fail_train: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <h3 className="text-lg font-semibold text-steel-800 mb-4">Scenario</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-steel-600 mb-1">Cleaning capacity</label>
                        <input type="number" min={0} className="input" value={whatIfScenario.cleaning_slots} onChange={e=>setWhatIfScenario(s=>({...s, cleaning_slots: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-steel-600 mb-1">Simulate failure</label>
                        <input type="text" placeholder="e.g. T10" className="input" value={whatIfScenario.fail_train} onChange={e=>setWhatIfScenario(s=>({...s, fail_train: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center py-2">
                  <button onClick={runWhatIfComparison} disabled={whatIfLoading} className="btn-outline-primary">
                    {whatIfLoading ? 'Running…' : 'Run Comparison'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h4 className="text-base font-semibold mb-2">Baseline summary</h4>
                    <div className="text-[12px] text-steel-700">{scheduleSummary(whatIfBaselineSchedule)}</div>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-base font-semibold mb-2">Scenario summary</h4>
                    <div className="text-[12px] text-steel-700">{scheduleSummary(whatIfScenarioSchedule)}</div>
                  </div>
                </div>
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 pb-2">
                    <h4 className="text-base font-semibold">Changed assignments</h4>
                  </div>
                  <div className="overflow-y-auto overflow-x-hidden">
                    <table className="simple w-full table-fixed">
                      <thead>
                        <tr>
                          <th className="w-24">Train</th>
                          <th className="w-32">Baseline</th>
                          <th className="w-32">Scenario</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whatIfChanges.map(row => (
                          <tr key={row.train_id} className="odd:bg-white even:bg-steel-50/40">
                            <td className="font-medium text-steel-800">{row.train_id}</td>
                            <td><span className={`chip ${row.baseline==='maintenance'?'chip-maintenance': row.baseline==='standby'?'chip-standby': row.baseline==='cleaning'?'chip-cleaning':'chip-run'}`}>{row.baseline}</span></td>
                            <td><span className={`chip ${row.scenario==='maintenance'?'chip-maintenance': row.scenario==='standby'?'chip-standby': row.scenario==='cleaning'?'chip-cleaning':'chip-run'}`}>{row.scenario}</span></td>
                            <td className="text-[11px] text-steel-600 whitespace-normal break-words pr-1">{row.baseline==='maintenance' && row.scenario!=='maintenance' ? 'Freed from maintenance' : row.baseline!==row.scenario && row.scenario==='maintenance' ? 'Moved to maintenance' : '—'}</td>
                          </tr>
                        ))}
                        {whatIfChanges.length===0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-[11px] text-steel-500">{whatIfBaselineSchedule.length && whatIfScenarioSchedule.length ? 'No assignment changes.' : 'Run a comparison to see changes.'}</td>
                          </tr>
                        )}
                        {/* Spacer to avoid last row flush with container edge */}
                        <tr aria-hidden="true">
                          <td colSpan={4} className="p-0 h-4"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {/* Removed obsolete placeholder text for What-if tab now that feature is implemented */}
          </div>
        </main>
      </div>
      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-72 max-w-[85vw]">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto select-none bg-white/95 backdrop-blur-sm border border-aqua-200 shadow-lg rounded-md px-3 py-2 text-[13px] text-steel-700 flex items-start gap-2 toast-enter">
            <div className="toast-dot" />
            <div className="flex-1 leading-snug pr-2 font-semibold">
              <span className="font-bold text-steel-800 block mb-0.5 tracking-wide">{t.type==='success'?'Applied': t.type==='error'?'Error': 'Notice'}</span>
              <span className="font-semibold text-steel-700">{t.message}</span>
            </div>
            <button onClick={()=>setToasts(list=>list.filter(x=>x.id!==t.id))} className="ml-1 text-steel-400 hover:text-steel-600 text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

